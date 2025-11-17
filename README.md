# lazy-mcp: Unified CLI and project structure

This package provides a single command (`lazy-mcp`) to build and run the backend and frontend, serving the app and opening the browser automatically.

## Usage

```bash
pip install .
lazy-mcp
```

- On first run, the frontend is built (requires npm).
- The backend serves the frontend and API.
- The browser opens automatically to the correct port.

## Project Structure

- `lazy_mcp/__main__.py`: Top-level CLI entry point
- `backend/src/main.py`: Backend server logic (exposed as `run_server`)
- `frontend/`: React app (built with Vite)

## Development
- Edit backend logic in `backend/src/`
- Edit frontend in `frontend/src/`
- Default agent config in `backend/resources/default.json`

## Packaging
- PyPI installable via `pyproject.toml`
- Includes resource files for config reset

---

For more details, see individual `README.md` files in `backend/` and `frontend/`.