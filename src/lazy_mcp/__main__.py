import importlib.resources as pkg_resources
import threading
import webbrowser
from pathlib import Path

import uvicorn
from fastapi.staticfiles import StaticFiles

from lazy_mcp import api


def open_browser(port: int):
    url = f"http://localhost:{port}"
    threading.Timer(1.5, lambda: webbrowser.open(url)).start()


def main(port=8000):
    """
    Start FastAPI backend, mount static frontend files from src/lazy_mcp/static, and open browser.
    """

    static_dir = Path(pkg_resources.files("lazy_mcp").joinpath("static"))
    api.app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="frontend")
    open_browser(port)
    uvicorn.run(api.app, host="127.0.0.1", port=port)


if __name__ == "__main__":
    main(port=8000)
