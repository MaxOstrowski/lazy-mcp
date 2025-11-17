
import os
from fastapi.staticfiles import StaticFiles
import uvicorn

def run_server(port=8080, frontend_dir=None):
    """
    Start FastAPI backend, mount frontend static files, and run uvicorn.
    """
    from api import app
    build_dir = os.path.join(frontend_dir, "dist") if frontend_dir else None
    if build_dir and os.path.exists(build_dir):
        app.mount("/", StaticFiles(directory=build_dir, html=True), name="frontend")
    uvicorn.run(app, host="127.0.0.1", port=port)
