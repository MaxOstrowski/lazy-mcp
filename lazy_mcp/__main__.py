"""
Unified CLI entry point for lazy-mcp.
Serves backend and frontend, builds frontend if needed, and opens browser.
"""


import os
import sys
import subprocess
import threading
import webbrowser
from pathlib import Path

def build_frontend(frontend_dir: Path, always_rebuild=False):
    """Build the frontend using npm. If always_rebuild, always run build."""
    dist_dir = frontend_dir / "dist"
    if always_rebuild or not dist_dir.exists():
        print("Building frontend...")
        subprocess.run(["npm", "install", "--legacy-peer-deps"], cwd=frontend_dir, check=True)
        subprocess.run(["npm", "run", "build"], cwd=frontend_dir, check=True)
    else:
        print("Frontend already built.")

def run_vite_dev(frontend_dir: Path, port: int):
    """Run Vite dev server in a subprocess, using local npm install."""
    print("Starting Vite dev server...")
    # Always install dependencies in dev mode
    print("Installing frontend dependencies...")
    subprocess.run(["npm", "install", "--legacy-peer-deps"], cwd=frontend_dir, check=True)
    try:
        proc = subprocess.Popen(["npm", "run", "dev"], cwd=frontend_dir)
    except FileNotFoundError:
        # Fallback to npx vite if npm run dev fails
        print("npm run dev failed, trying npx vite...")
        proc = subprocess.Popen(["npx", "vite"], cwd=frontend_dir)
    return proc

def open_browser(port: int):
    url = f"http://localhost:{port}"
    threading.Timer(1.5, lambda: webbrowser.open(url)).start()

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Run lazy-mcp unified CLI.")
    parser.add_argument("--dev", action="store_true", help="Always rebuild frontend and use Vite dev server.")
    args = parser.parse_args()

    root_dir = Path(__file__).parent.parent
    frontend_dir = root_dir / "frontend"
    backend_dir = root_dir / "lazy_mcp" / "backend"
    port = int(os.environ.get("LAZY_MCP_PORT", "8000"))

    if args.dev:
        # Start Vite dev server
        vite_proc = run_vite_dev(frontend_dir, port)
        # Start backend with hot-reload
        print("Starting backend with hot-reload...")
        backend_proc = subprocess.Popen([
            sys.executable, "-m", "uvicorn", "api:app", "--reload", "--host", "127.0.0.1", "--port", str(port)
        ], cwd=backend_dir)
        open_browser(5173)  # Vite default port
        print("Frontend: http://localhost:5173\nBackend API: http://localhost:{}".format(port))
        try:
            vite_proc.wait()
        except KeyboardInterrupt:
            vite_proc.terminate()
            backend_proc.terminate()
    else:
        build_frontend(frontend_dir)
        open_browser(port)
        run_server(port=port, frontend_dir=frontend_dir)

if __name__ == "__main__":
    main()
