"""
API endpoints for Lazy MCP backend using FastAPI.
Provides chat and log retrieval endpoints, and initializes LLM tools on startup.
"""

from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from llm_client import LLMClient
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


llm = LLMClient()


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize LLM tools on FastAPI startup."""
    await llm.initialize_tools()


# Ensure agent_config is persisted on shutdown
@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Persist agent_config on FastAPI shutdown."""
    llm.save_agent_configuration()


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""

    message: str


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""

    reply: list[str]


class LogEntry(BaseModel):
    """Model for a single log entry."""

    level: str
    message: str
    time: str


class LogsResponse(BaseModel):
    """Response model for logs endpoint."""

    logs: list[LogEntry]


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Chat endpoint: send a message to the LLM and get a reply."""
    reply: list[str] = await llm.ask_llm_with_tools(request.message)
    return ChatResponse(reply=reply)


@app.get("/logs", response_model=LogsResponse)
async def get_logs() -> LogsResponse:
    """Logs endpoint: retrieve and format logs from the LLM client."""
    try:
        log_entries: list[Any] = llm.get_and_clear_logs()
        logs: list[LogEntry] = [
            LogEntry(**entry) if isinstance(entry, dict) else entry
            for entry in log_entries
        ]
        return LogsResponse(logs=logs)
    except Exception as e:
        return LogsResponse(
            logs=[
                LogEntry(
                    level="ERROR", message=f"Error fetching logs: {str(e)}", time=""
                )
            ]
        )
