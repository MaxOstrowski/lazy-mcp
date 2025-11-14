"""
mcp_client.py: Defines MCPClient and MCPLocalClient for managing tool servers and local tools.
Provides classes for tool listing and invocation.
"""

from contextlib import AsyncExitStack
from typing import Any, Callable

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client
from models import Function, MCPServerConfig


class LocalTool:
    """Represents a local tool with metadata and callable function."""

    def __init__(
        self,
        name: str,
        description: str,
        function: Callable[..., Any],
        type: str,
        inputSchema: dict[str, Any],
    ) -> None:
        """Initialize a LocalTool with name, description, function, type, and input schema."""
        self.name: str = name
        self.description: str = description
        self.function: Callable[..., Any] = function
        self.type: str = type
        self.inputSchema: dict[str, Any] = inputSchema


class ListToolsResult:
    """Result wrapper for a list of LocalTool objects."""

    def __init__(self, tools: list[LocalTool]) -> None:
        """Initialize with a list of LocalTool objects."""
        self.tools: list[LocalTool] = tools


class MCPClient:
    """Client for managing remote MCP tool servers via stdio transport."""

    def __init__(self, name: str, config: MCPServerConfig):
        """Initialize MCPClient with name and configuration."""
        self.name: str = name
        self.config: MCPServerConfig = config
        self.session: Any = None
        self.exit_stack: AsyncExitStack = AsyncExitStack()
        self.stdio: Any = None
        self.write: Any = None
        self.initialized: bool = False

    async def connect(self) -> None:
        """Establish connection to the MCP server using stdio transport."""
        command: str = self.config.command
        args: list[str] = self.config.args or []
        params: StdioServerParameters = StdioServerParameters(command=command, args=args, env=None)
        stdio_transport = await self.exit_stack.enter_async_context(stdio_client(params))
        self.stdio, self.write = stdio_transport
        self.session = await self.exit_stack.enter_async_context(ClientSession(self.stdio, self.write))
        await self.session.initialize()
        self.initialized = True

    async def list_tools(self) -> Any:
        """List available tools from the connected MCP server."""
        if not self.initialized:
            await self.connect()
        res = await self.session.list_tools()
        # fill self.config functions
        for tool in res.tools:
            func = Function(
                description=tool.description,
                parameters=tool.inputSchema,
            )
            if self.config.functions is None:
                self.config.functions = {}
            # reset if changes are detected
            if (
                tool.name not in self.config.functions
                or self.config.functions[tool.name].description != func.description
                or self.config.functions[tool.name].parameters != func.parameters
            ):
                self.config.functions[tool.name] = func
        return res

    async def call_tool(self, tool_name: str, params: dict[str, Any]) -> Any:
        """Call a tool on the MCP server by name with given parameters."""
        if not self.initialized:
            await self.connect()
        return await self.session.call_tool(tool_name, params)


class MCPLocalClient:
    """Client for managing and invoking local tools."""

    def __init__(self, name: str, tools: list[LocalTool]) -> None:
        """Initialize MCPLocalClient with name and a list of LocalTool objects."""
        self.name: str = name
        self.tools: list[LocalTool] = tools
        self.my_tools: dict[str, LocalTool] = {tool.name: tool for tool in tools}

    async def connect(self) -> None:
        """No-op for local client connection."""
        pass

    async def list_tools(self) -> ListToolsResult:
        """Return a ListToolsResult containing all local tools."""
        return ListToolsResult(self.tools)

    async def call_tool(self, tool_name: str, params: dict[str, Any]) -> Any:
        """Call a local tool by name with given parameters."""
        import inspect

        tool = self.my_tools.get(tool_name)
        if not tool:
            raise ValueError(f"Tool {tool_name} not found")
        fn = tool.function
        if inspect.iscoroutinefunction(fn):
            return await fn(**params)
        else:
            return fn(**params)
