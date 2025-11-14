"""
LLMClient: Handles interaction with Azure/OpenAI and MCP tool clients.
Provides logging, tool initialization, and chat with tool support.
"""

import inspect
import json
import logging
import os
from collections import defaultdict

from config_utils import DEFAULT_AGENT_NAME, get_config_path
from dotenv import load_dotenv
from mcp_client import LocalTool, MCPClient, MCPLocalClient
from memory_log_handler import MemoryLogHandler
from models import (
    AgentConfig,
    ChatResponse,
    ConfirmationState,
    ConfirmationStateResponse,
    Message,
    ToolCallConfirmation,
    ToolCallPending,
)
from openai import AzureOpenAI, BadRequestError

logging.basicConfig(level=logging.WARNING)


from typing import Any, Optional

LOCAL_MCP_NAMES = ["local"]


class LLMClient:
    """Main client for LLM and MCP tool management and chat operations."""

    def __init__(self, agent_name: str = DEFAULT_AGENT_NAME) -> None:
        """Initialize the LLMClient, load config, and set up logging and tools."""
        load_dotenv()
        self._set_logger()
        self.api_key = os.getenv("AZURE_OPENAI_KEY") or os.getenv("OPENAI_API_KEY")
        self.azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT") or os.getenv("OPENAI_API_ENDPOINT")
        self.api_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT") or os.getenv("OPENAI_API_DEPLOYMENT")
        self.api_version = os.getenv(f"OPENAI_API_VERSION", "2023-07-01-preview")
        self.client = AzureOpenAI(
            api_key=self.api_key,
            api_version=self.api_version,
            azure_endpoint=self.azure_endpoint,
        )
        self.mcp_clients = {}
        self.agent_name = agent_name
        self.agent_config = AgentConfig(servers={})
        config_path = get_config_path(self.agent_name)
        if config_path.exists():
            with config_path.open("r") as f:
                self.agent_config = AgentConfig(**json.load(f))
        elif get_config_path(DEFAULT_AGENT_NAME).exists():
            with get_config_path(DEFAULT_AGENT_NAME).open("r") as f:
                self.agent_config = AgentConfig(**json.load(f))
        self.tools = defaultdict(list)
        if not self.agent_config.history:
            self.clear_history()

        self._init_local_tools()

    def clear_history(self) -> None:
        """Clear the conversation history."""
        self.agent_config.history = [Message(role="system", content=self.agent_config.description)]

    def _init_local_tools(self) -> None:
        """Initialize local MCP client with built-in tools."""

        def bind_function(fn):
            async def wrapper(*args, **kwargs):
                if inspect.iscoroutinefunction(fn):
                    return await fn(*args, **kwargs)
                else:
                    return fn(*args, **kwargs)

            return wrapper

        self.mcp_clients["local"] = MCPLocalClient(
            "local",
            [
                LocalTool(
                    name="list_available_mcps",
                    type="function",
                    description="List all available MCP clients",
                    inputSchema={},
                    function=bind_function(self.list_available_mcps),
                ),
                LocalTool(
                    name="load_mcp",
                    type="function",
                    description="Load an MCP client by name",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "mcp_name": {
                                "type": "string",
                                "description": "Name of the MCP client to load",
                            }
                        },
                        "required": ["mcp_name"],
                    },
                    function=bind_function(self.load_mcp),
                ),
                LocalTool(
                    name="unload_mcp",
                    type="function",
                    description="Unload an MCP client by name",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "mcp_name": {
                                "type": "string",
                                "description": "Name of the MCP client to unload",
                            }
                        },
                        "required": ["mcp_name"],
                    },
                    function=bind_function(self.unload_mcp),
                ),
            ],
        )

    def _set_logger(self) -> None:
        """Set up the local logger and memory handler."""

        self.logger = logging.getLogger(f"LLMClient_{id(self)}")
        self.logger.setLevel(logging.INFO)
        self.memory_handler = MemoryLogHandler()
        formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
        self.memory_handler.setFormatter(formatter)
        self.logger.addHandler(self.memory_handler)

    def save_agent_configuration(self):
        """Save the current agent configuration to the configuration file."""
        try:
            config_path = get_config_path(self.agent_name)
            with config_path.open("w") as f:
                f.write(self.agent_config.model_dump_json(indent=2))
        except Exception as e:
            self.logger.error(f"Failed to write agent_config: {e}")

    def list_available_mcps(self) -> list[str]:
        """List all available MCP clients from config."""
        self.logger.debug(f"Listing available MCP clients {list(self.agent_config.servers.keys())}")
        return list(self.agent_config.servers.keys())

    async def load_mcp(self, mcp_name: str) -> Any:
        """Load an MCP client by name and initialize its tools."""
        self.logger.debug(f"Loading MCP client '{mcp_name}'")
        if mcp_name in self.agent_config.servers:
            self.mcp_clients[mcp_name] = MCPClient(mcp_name, self.agent_config.servers[mcp_name])
            return await self.initialize_tools()
        else:
            return str({"Error": f"MCP client '{mcp_name}' not found in configuration"})

    def unload_mcp(self, mcp_name: str) -> Optional[str]:
        """Unload an MCP client by name."""
        if mcp_name in self.mcp_clients:
            del self.mcp_clients[mcp_name]
            return None
        else:
            return str({"Error": f"MCP client '{mcp_name}' is not loaded"})

    async def initialize_tools(self) -> None:
        """Initialize and collect available tools from all loaded MCP clients."""
        self.tools = defaultdict(list)
        for client_name, mcp_client in self.mcp_clients.items():
            tools = await mcp_client.list_tools()
            for tool in tools.tools:
                self.tools[client_name].append(
                    {
                        "type": "function",
                        "function": {
                            "name": getattr(tool, "name", None),
                            "description": getattr(tool, "description", None),
                            "parameters": getattr(tool, "inputSchema"),
                        },
                    }
                )
            self.logger.debug(f"Initialized tools for MCP client '{client_name}': {self.tools[client_name]}")

    def _collect_allowed_tools(self) -> list[dict[str, Any]]:
        """Collect all allowed tools from loaded MCP clients."""
        tools_list = []
        for client_name, tools in self.tools.items():
            if client_name in LOCAL_MCP_NAMES:
                for tool in tools:
                    tools_list.append(tool)
            else:
                if client_name not in self.agent_config.servers or not self.agent_config.servers[client_name].allowed:
                    continue
                for tool in tools:
                    assert "function" in tool
                    assert "name" in tool["function"]
                    tool_name = tool.get("function", {}).get("name")
                    assert tool_name is not None or tool_name in self.agent_config.servers[client_name].functions
                    if not tool_name or self.agent_config.servers[client_name].functions[tool_name].allowed:
                        tools_list.append(tool)
        return tools_list

    async def ask_llm_with_tools(self, prompt: Optional[str] = None, websocket=None) -> ChatResponse:
        """Send a prompt to the LLM, handle tool calls, and return responses. If websocket is provided, request frontend confirmation before tool call."""
        self.agent_config.history.append(Message(role="user", content=prompt))
        tools_list = self._collect_allowed_tools()

        self.logger.warning(f"Using tools: {[tool['function']['name'] for tool in tools_list]}")
        tokens_used = 0
        try:
            ret: list[str] = []
            while True:
                response = self.client.chat.completions.create(
                    model=self.api_deployment,
                    messages=self.agent_config.history,
                    tools=tools_list,
                    tool_choice="auto",
                    parallel_tool_calls=False,
                )
                message = response.choices[0].message
                self.agent_config.history.append(Message(**message.model_dump()))
                if message.content:
                    ret.append(message.content)
                tokens_used += response.usage.total_tokens

                if hasattr(message, "tool_calls") and message.tool_calls:
                    await self._handle_tool_calls(message.tool_calls, websocket)
                else:
                    break
        except BadRequestError as e:
            self.logger.error(f"OpenAI content filter triggered: {e}")

        return ChatResponse(reply=ret, tokens_used=tokens_used)

    async def _handle_tool_calls(self, tool_calls, websocket=None):
        """Handle tool calls from LLM response."""
        for tool_call in tool_calls:
            tool_name = tool_call.function.name
            tool_args = tool_call.function.arguments
            tool_desc = None
            for client_name, tools in self.tools.items():
                for tool in tools:
                    if tool["function"]["name"] == tool_name:
                        tool_desc = tool["function"].get("description", "")
                        mcp_client = self.mcp_clients[client_name]
                        # Request confirmation from frontend
                        if client_name in LOCAL_MCP_NAMES:
                            confirmation_state = ConfirmationStateResponse.ALWAYS_CONFIRMED
                        else:
                            confirmation_state = self.agent_config.servers[client_name].functions[tool_name].confirmed
                        if websocket is not None and confirmation_state == ConfirmationState.ALWAYS_ASK:
                            payload = ToolCallPending(
                                name=tool_name,
                                args=tool_args,
                                description=tool_desc,
                            ).model_dump()
                            await websocket.send_json({"tool_call_pending": payload})
                            # Wait for confirmation and update state
                            confirmation_state = ToolCallConfirmation(**await websocket.receive_json()).tool_call_confirmed
                            if confirmation_state == ConfirmationStateResponse.REJECT:
                                confirmation_state_update = ConfirmationState.ALWAYS_ASK
                            else:
                                confirmation_state_update = confirmation_state
                            if (
                                confirmation_state_update
                                != self.agent_config.servers[client_name].functions[tool_name].confirmed
                            ):
                                self.agent_config.servers[client_name].functions[
                                    tool_name
                                ].confirmed = confirmation_state_update
                                self.save_agent_configuration()

                        if confirmation_state not in (ConfirmationState.ALWAYS_REJECTED, ConfirmationStateResponse.REJECT):
                            self.logger.info(f"Calling tool '{tool_name}' with args: {tool_args}")
                            tool_result = await mcp_client.call_tool(tool_name, json.loads(tool_args))
                            self.logger.info(f"Tool '{tool_name}' returned: {tool_result}")
                            self.agent_config.history.append(
                                Message(
                                    role="tool",
                                    tool_call_id=getattr(tool_call, "id", None),
                                    content=str(tool_result),
                                )
                            )
                        else:
                            self.agent_config.history.append(
                                Message(
                                    role="tool",
                                    tool_call_id=getattr(tool_call, "id", None),
                                    content="rejected by user",
                                )
                            )

    def get_and_clear_logs(self) -> list[dict[str, str]]:
        """Return and clear all logs from the memory handler."""
        return self.memory_handler.get_and_clear_logs()
