"""
API endpoints for Lazy MCP backend using FastAPI.
Provides chat and log retrieval endpoints, and initializes LLM tools on startup.
"""

from typing import Any

from config_utils import get_config_path, list_available_agents
from fastapi import Body, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from llm_client import LLMClient
from models import (
    ClearHistoryResponse,
    DeleteAgentResponse,
    HistoryMessage,
    HistoryResponse,
    LogEntry,
    LogsResponse,
    ServersResponse,
    UpdateFlagRequest,
    UpdateFlagResponse,
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global dictionary to hold all agent LLMClients
agents: dict[str, LLMClient] = {}


async def get_agent(agent: str) -> LLMClient:
    if agent not in agents:
        agents[agent] = LLMClient(agent)
        await agents[agent].initialize_tools()
    return agents[agent]


@app.websocket("/chat")
async def chat(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            agent = data.get("agent", "default")
            message = data.get("message", "")
            llm = await get_agent(agent)
            result = await llm.ask_llm_with_tools(message, websocket)
            llm.save_agent_configuration()
            await websocket.send_json(result.dict())
    except WebSocketDisconnect:
        pass


@app.get("/logs", response_model=LogsResponse)
async def get_logs(agent: str = Query(..., description="Agent name/ID")) -> LogsResponse:
    """Logs endpoint: retrieve and format logs from the LLM client."""
    llm = await get_agent(agent)
    try:
        log_entries: list[Any] = llm.get_and_clear_logs()
        logs: list[LogEntry] = [LogEntry(**entry) if isinstance(entry, dict) else entry for entry in log_entries]
        return LogsResponse(logs=logs)
    except Exception as e:
        return LogsResponse(logs=[LogEntry(level="ERROR", message=f"Error fetching logs: {str(e)}", time="")])


@app.post("/clear_history", response_model=ClearHistoryResponse)
async def clear_history(agent: str = Query(..., description="Agent name/ID")) -> ClearHistoryResponse:
    """Endpoint to clear the conversation history."""
    llm = await get_agent(agent)
    try:
        llm.clear_history()
        llm.save_agent_configuration()
        return ClearHistoryResponse(success=True)
    except Exception:
        return ClearHistoryResponse(success=False)


@app.get("/history", response_model=HistoryResponse)
async def get_history(agent: str = Query(..., description="Agent name/ID")) -> HistoryResponse:
    """Endpoint to get the current conversation history."""
    llm = await get_agent(agent)
    messages = []
    assert llm.agent_config.history
    for msg in llm.agent_config.history[1:]:  # Skip system message
        if msg.content:
            messages.append(HistoryMessage(role=msg.role, content=msg.content))
    return HistoryResponse(messages=messages)


@app.get("/agents", response_model=list[str])
async def get_agents():
    return list_available_agents()


# Delete agent endpoint
@app.delete("/agent", response_model=DeleteAgentResponse)
async def delete_agent(agent: str = Query(..., description="Agent name/ID")) -> DeleteAgentResponse:
    """Delete the agent config file and remove from memory."""
    config_path = get_config_path(agent)
    try:
        if config_path.exists():
            config_path.unlink()
        if agent in agents:
            del agents[agent]
        updated_agents = list_available_agents()
        return DeleteAgentResponse(success=True, agents=updated_agents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete agent: {e}")


# Endpoint to return the complete servers dict from the AgentConfig


@app.get("/servers", response_model=ServersResponse)
async def get_servers(agent: str = Query(..., description="Agent name/ID")) -> ServersResponse:
    """Get the complete servers dict from the agent's configuration."""
    llm = await get_agent(agent)
    return ServersResponse(servers=llm.agent_config.servers)


# Request model for updating a server or function flag


# Endpoint to update a flag for a server or function
@app.patch("/servers/update_flag", response_model=UpdateFlagResponse)
async def update_flag(
    agent: str = Query(..., description="Agent name/ID"),
    request: UpdateFlagRequest = Body(...),
) -> UpdateFlagResponse:
    """Update a flag for a server or function. If function_name is empty, update the server flag; otherwise, update the function flag."""
    llm = await get_agent(agent)
    try:
        servers = llm.agent_config.servers
        if request.server_name not in servers:
            return UpdateFlagResponse(success=False, detail="Server not found")
        server = servers[request.server_name]
        if request.function_name:
            # Update flag in function
            if not server.functions or request.function_name not in server.functions:
                return UpdateFlagResponse(success=False, detail="Function not found")
            func = server.functions[request.function_name]
            setattr(func, request.flag_name, request.value)
        else:
            # Update flag in server
            setattr(server, request.flag_name, request.value)
        llm.save_agent_configuration()
        return UpdateFlagResponse(success=True)
    except Exception as e:
        return UpdateFlagResponse(success=False, detail=str(e))
