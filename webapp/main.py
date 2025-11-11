"""
Entry point for Lazy MCP desktop app using PyWebView.
Uses proper package imports and config for frontend path.
"""
import webview
import os
from webapp.backend.src.llm_client import LLMClient

class Api:
    def __init__(self):
        self.llm = LLMClient()

    def chat(self, message: str):
        """Chat endpoint: send a message to the LLM and get a reply."""
        import asyncio
        return asyncio.run(self.llm.ask_llm_with_tools(message))

    def get_logs(self):
        """Logs endpoint: retrieve and format logs from the LLM client."""
        return self.llm.get_and_clear_logs()

def get_frontend_path():
    """Get the path to the built frontend index.html using config or environment variable."""
    # Look for React build in frontend/dist
    frontend_dir = os.getenv("FRONTEND_DIST", os.path.join(os.path.dirname(__file__), "frontend/dist"))
    index_path = os.path.join(frontend_dir, "index.html")
    if not os.path.exists(index_path):
        raise FileNotFoundError(
            f"Frontend build not found at {index_path}.\n"
            "Run 'npm run build' in the frontend directory to generate the React build."
        )
    return index_path

if __name__ == "__main__":
    api = Api()
    webview.create_window('Lazy MCP', get_frontend_path(), js_api=api)
    webview.start()
