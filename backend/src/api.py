from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from llm_client import LLMClient

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
async def startup_event():
    await llm.initialize_tools()


class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: list[str]

class LogEntry(BaseModel):
    level: str
    message: str
    time: str

class LogsResponse(BaseModel):
    logs: list[LogEntry]


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    reply = await llm.ask_llm_with_tools(request.message)
    return {"reply": reply}

@app.get("/logs", response_model=LogsResponse)
async def get_logs():
    try:
        log_entries = llm.get_and_clear_logs()
        return {"logs": log_entries}
    except Exception as e:
        return {"logs": [{"level": "ERROR", "message": f"Error fetching logs: {str(e)}", "time": ""}]}
