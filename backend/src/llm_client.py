import logging
import os
import json
from typing import Optional
from dotenv import load_dotenv
from openai import AzureOpenAI
from mcp_client import MCPClient, MCPLocalClient, LocalTool
from collections import defaultdict
import importlib.resources


logging.basicConfig(level=logging.WARNING)


class LLMClient:
    def __init__(self):
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
        self.mcp_clients["local"] = MCPLocalClient("local", [
            LocalTool(
                name="list_available_mcps",
                type="function",
                description="List all available MCP clients",
                inputSchema={},
                function=lambda: self.list_available_mcps()
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
                function=lambda mcp_name: self.load_mcp(mcp_name)
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
                function=lambda mcp_name: self.unload_mcp(mcp_name)
            )
        ])

    def list_available_mcps(self):
        logging.warning(f"Listing available MCP clients {list(self.mcp_clients.keys())}")
        return list(self.mcp_clients_extern.keys())

    async def load_mcp(self, mcp_name: str):
        logging.warning(f"Loading MCP client '{mcp_name}'")
        if mcp_name in self.mcp_clients_extern:
            self.mcp_clients[mcp_name] = self.mcp_clients_extern[mcp_name]
            await self.initialize_tools()
        else:
            raise ValueError(f"MCP client '{mcp_name}' not found in configuration")

    def unload_mcp(self, mcp_name: str):
        logging.warning(f"Unloading MCP client '{mcp_name}'")
        if mcp_name in self.mcp_clients:
            del self.mcp_clients[mcp_name]
        else:
            raise ValueError(f"MCP client '{mcp_name}' is not loaded")

    async def initialize_tools(self):
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
            logging.warning(f"Initialized tools for MCP client '{client_name}': {self.tools[client_name]}")

    async def ask_llm_with_tools(self, prompt: Optional[str] = None):
        # Add user prompt to history
        if prompt is not None:
            self.history.append({"role": "user", "content": prompt})
        tools_list = [tool for tools in self.tools.values() for tool in tools]
        logging.warning(f"Tools available: {tools_list}")
        response = self.client.chat.completions.create(
            model=self.api_deployment,
            messages=self.history,
            tools=tools_list,
            tool_choice="auto"
        )
        message = response.choices[0].message
        self.history.append(message)

        # Handle tool calls if present
        if hasattr(message, "tool_calls") and message.tool_calls:
            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                tool_args = tool_call.function.arguments
                for client_name, tools in self.tools.items():
                    for tool in tools:
                        if tool["function"]["name"] == tool_name:
                            mcp_client = self.mcp_clients[client_name]
                            import json
                            result = await mcp_client.call_tool(tool_name, json.loads(tool_args))
                            self.history.append({
                                "role": "tool",
                                "tool_call_id": tool_call.id,
                                "content": str(result)
                            })
                            
            if hasattr(message, "tool_calls") and message.tool_calls:
                return await self.ask_llm_with_tools()  # Recursive call to handle follow-up
            

        # No tool call, just return the LLM's response
        self.history.append({"role": "assistant", "content": message.content})
        return message.content
