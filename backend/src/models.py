"""
Pydantic models for FastAPI endpoints, tool call payloads and configuration.
"""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# Chat models
class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: List[str]


# Log models
class LogEntry(BaseModel):
    level: str
    message: str
    time: str


class LogsResponse(BaseModel):
    logs: List[LogEntry]


# History models
class ClearHistoryResponse(BaseModel):
    success: bool


class HistoryMessage(BaseModel):
    role: str
    content: str


class HistoryResponse(BaseModel):
    messages: List[HistoryMessage]


# Agent models
class DeleteAgentResponse(BaseModel):
    success: bool
    agents: List[str]


# Servers models
class ServersResponse(BaseModel):
    servers: Dict[str, Any]  # Use Any for MCPServerConfig, avoids circular import


class UpdateFlagRequest(BaseModel):
    server_name: str
    function_name: str = ""
    flag_name: str
    value: Any


class UpdateFlagResponse(BaseModel):
    success: bool
    detail: str = ""


# Tool call confirmation payload
class ToolCallPending(BaseModel):
    name: str
    args: Any
    description: Optional[str] = None


# Tool call confirmation response
class ToolCallConfirmation(BaseModel):
    tool_call_confirmed: "ConfirmationStateResponse"


# Pydantic models for configuration


class ConfirmationState(str, Enum):
    ALWAYS_CONFIRMED = "always_confirmed"
    ALWAYS_REJECTED = "always_rejected"
    ALWAYS_ASK = "always_ask"


class ConfirmationStateResponse(str, Enum):
    ALWAYS_CONFIRMED = ConfirmationState.ALWAYS_CONFIRMED.value
    ALWAYS_REJECTED = ConfirmationState.ALWAYS_REJECTED.value
    ALWAYS_ASK = ConfirmationState.ALWAYS_ASK.value
    REJECT = "reject"


class Function(BaseModel):
    description: str
    parameters: dict[str, Any]
    allowed: bool = True
    confirmed: ConfirmationState = Field(default=ConfirmationState.ALWAYS_ASK)


class MCPServerConfig(BaseModel):
    type: str
    command: str
    args: Optional[list[str]] = Field(default_factory=list)
    gallery: Optional[str] = None
    version: Optional[str] = None
    functions: Optional[dict[str, Function]] = None
    allowed: bool = True


class Message(BaseModel):
    role: str
    content: Optional[str] = None
    refusal: Optional[Any] = None
    annotations: Optional[list[Any]] = Field(default_factory=list)
    audio: Optional[Any] = None
    function_call: Optional[Any] = None
    tool_calls: Optional[Any] = None
    tool_call_id: Optional[str] = None


class AgentConfig(BaseModel):
    description: str = ""
    servers: dict[str, MCPServerConfig]
    history: Optional[list[Message]] = Field(default_factory=list)
