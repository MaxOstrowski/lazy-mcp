
"""
LLMClient: Handles interaction with Azure/OpenAI and MCP tool clients.
Provides logging, tool initialization, and chat with tool support.
"""
import logging
import os
import json
from dotenv import load_dotenv
from openai import AzureOpenAI, BadRequestError
from mcp_client import MCPClient, MCPLocalClient, LocalTool
from collections import defaultdict
import importlib.resources


logging.basicConfig(level=logging.WARNING)


from typing import Any, Optional

class MemoryLogHandler(logging.Handler):
    """In-memory log handler for collecting logs during LLMClient operations."""
    def __init__(self) -> None:
        """Initialize the memory log handler."""
        super().__init__()
        self.records: list[dict[str, str]] = []

    def emit(self, record: logging.LogRecord) -> None:
        """Store a log record in memory."""
        self.records.append({
            "level": record.levelname,
            "message": record.getMessage(),
            "time": self.formatTime(record)
        })

    def formatTime(self, record: logging.LogRecord) -> str:
        """Format the log record time as a string."""
        import datetime
        ct = datetime.datetime.fromtimestamp(record.created)
        return ct.strftime("%Y-%m-%d %H:%M:%S")

    def get_and_clear_logs(self) -> list[dict[str, str]]:
        """Return and clear all stored log records."""
        logs = self.records.copy()
        self.records.clear()
        return logs

class LLMClient:
    """Main client for LLM and MCP tool management and chat operations."""
    def __init__(self) -> None:
        """Initialize the LLMClient, load config, and set up logging and tools."""
        load_dotenv()
        self.api_key = os.getenv("AZURE_OPENAI_KEY") or os.getenv("OPENAI_API_KEY")
        self.azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT") or os.getenv("OPENAI_API_ENDPOINT")
        self.api_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT") or os.getenv("OPENAI_API_DEPLOYMENT")
        self.api_version = os.getenv("OPENAI_API_VERSION", "2023-07-01-preview")
        self.client = AzureOpenAI(
            api_key=self.api_key,
            api_version=self.api_version,
            azure_endpoint=self.azure_endpoint
        )
        self.mcp_clients = {}
        with importlib.resources.files(__package__ or "src").joinpath("..", "mcp_config.json").open("r") as f:
            self.mcp_config = json.load(f)
        self.mcp_clients_extern = {name: MCPClient(name, cfg) for name, cfg in self.mcp_config["servers"].items()}
        self.tools = defaultdict(list)
        self.history = []
        import inspect
        def bind_function(fn):
            async def wrapper(*args, **kwargs):
                if inspect.iscoroutinefunction(fn):
                    return await fn(*args, **kwargs)
                else:
                    return fn(*args, **kwargs)
            return wrapper

        self.mcp_clients["local"] = MCPLocalClient("local", [
            LocalTool(
                name="list_available_mcps",
                type="function",
                description="List all available MCP clients",
                inputSchema={},
                function=bind_function(self.list_available_mcps)
            ),
            LocalTool(
                name="load_mcp",
                type="function",
                description="Load an MCP client by name",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "mcp_name": {"type": "string", "description": "Name of the MCP client to load"}
                    },
                    "required": ["mcp_name"]
                },
                function=bind_function(self.load_mcp)
            ),
            LocalTool(
                name="unload_mcp",
                type="function",
                description="Unload an MCP client by name",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "mcp_name": {"type": "string", "description": "Name of the MCP client to unload"}
                    },
                    "required": ["mcp_name"]
                },
                function=bind_function(self.unload_mcp)
            )
        ])

        # Local logger and memory handler
        self.logger = logging.getLogger(f"LLMClient_{id(self)}")
        self.logger.setLevel(logging.INFO)
        self.memory_handler = MemoryLogHandler()
        formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
        self.memory_handler.setFormatter(formatter)
        self.logger.addHandler(self.memory_handler)

    def list_available_mcps(self) -> list[str]:
        """List all available MCP clients from config."""
        self.logger.info(f"Listing available MCP clients {list(self.mcp_clients.keys())}")
        return list(self.mcp_clients_extern.keys())

    async def load_mcp(self, mcp_name: str) -> Any:
        """Load an MCP client by name and initialize its tools."""
        self.logger.info(f"Loading MCP client '{mcp_name}'")
        if mcp_name in self.mcp_clients_extern:
            self.mcp_clients[mcp_name] = self.mcp_clients_extern[mcp_name]
            return await self.initialize_tools()
        else:
            return str({
                "Error": f"MCP client '{mcp_name}' not found in configuration"
            })

    def unload_mcp(self, mcp_name: str) -> Optional[str]:
        """Unload an MCP client by name."""
        self.logger.info(f"Unloading MCP client '{mcp_name}'")
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
                self.tools[client_name].append({
                    "type": "function",
                    "function": {
                        "name": getattr(tool, "name", None),
                        "description": getattr(tool, "description", None),
                        "parameters": getattr(tool, "inputSchema")
                    }
                })
            self.logger.info(f"Initialized tools for MCP client '{client_name}': {self.tools[client_name]}")

    async def ask_llm_with_tools(self, prompt: Optional[str] = None) -> list[str]:
        """Send a prompt to the LLM, handle tool calls, and return responses."""
        self.history.append({"role": "user", "content": prompt})
        tools_list = [tool for tools in self.tools.values() for tool in tools]
        self.logger.info(f"Tools available: {tools_list}")
        try:
            ret: list[str] = []
            while True:
                response = self.client.chat.completions.create(
                    model=self.api_deployment,
                    messages=self.history,
                    tools=tools_list,
                    tool_choice="auto",
                    parallel_tool_calls=False,
                )
                message = response.choices[0].message
                self.history.append(message)
                if message.content:
                    ret.append(message.content)

                self.logger.info(f"LLM response: {message}")

                # Handle tool calls if present
                if hasattr(message, "tool_calls") and message.tool_calls:
                    for tool_call in message.tool_calls:
                        tool_name = tool_call.function.name
                        tool_args = tool_call.function.arguments
                        for client_name, tools in self.tools.items():
                            for tool in tools:
                                if tool["function"]["name"] == tool_name:
                                    mcp_client = self.mcp_clients[client_name]
                                    self.logger.info(f"Calling tool '{tool_name}' with args: {tool_args}")
                                    tool_result = await mcp_client.call_tool(tool_name, json.loads(tool_args))
                                    self.logger.info(f"Tool '{tool_name}' returned: {tool_result}")
                                    self.history.append({
                                        "role": "tool",
                                        "tool_call_id": tool_call.id,
                                        "content": str(tool_result)
                                    })
                else:
                    break
        except BadRequestError as e:
            self.logger.error(f"OpenAI content filter triggered: {e}")

        self.logger.info(f"Final responses: {ret}")
        return ret

    def get_and_clear_logs(self) -> list[dict[str, str]]:
        """Return and clear all logs from the memory handler."""
        return self.memory_handler.get_and_clear_logs()
