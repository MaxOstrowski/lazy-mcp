from typing import List, Optional, TypedDict

# Define Tool and ListToolsResult for local use

# Extended Tool TypedDict for local and remote tools

# LocalTool as a class for attribute access (getattr)
class LocalTool:
    def __init__(self, name, description, function, type, inputSchema):
        self.name = name
        self.description = description
        self.function = function
        self.type = type
        self.inputSchema = inputSchema

class ListToolsResult:
    def __init__(self, tools: list[LocalTool]):
        self.tools = tools

from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp import ClientSession
from contextlib import AsyncExitStack

class MCPClient:
    def __init__(self, name, config):
        self.name = name
        self.config = config
        self.session = None
        self.exit_stack = AsyncExitStack()
        self.stdio = None
        self.write = None
        self.initialized = False

    async def connect(self):
        command = self.config.get("command")
        args = self.config.get("args", [])
        params = StdioServerParameters(command=command, args=args, env=None)
        stdio_transport = await self.exit_stack.enter_async_context(stdio_client(params))
        self.stdio, self.write = stdio_transport
        self.session = await self.exit_stack.enter_async_context(ClientSession(self.stdio, self.write))
        await self.session.initialize()
        self.initialized = True

    async def list_tools(self):
        if not self.initialized:
            await self.connect()
        return await self.session.list_tools()

    async def call_tool(self, tool_name, params):
        if not self.initialized:
            await self.connect()
        return await self.session.call_tool(tool_name, params)
    

class MCPLocalClient:
    def __init__(self, name, tools: list[LocalTool]):
        self.name = name
        self.tools = tools
        self.my_tools = {tool.name: tool for tool in tools}

    async def connect(self):
        pass

    async def list_tools(self):
        # Return the correct type for lost-tools (ListToolsResult)
        return ListToolsResult(self.tools)
    
    async def call_tool(self, tool_name, params):
        tool = self.my_tools.get(tool_name)
        if not tool:
            raise ValueError(f"Tool {tool_name} not found")
        return tool.function(**params)
