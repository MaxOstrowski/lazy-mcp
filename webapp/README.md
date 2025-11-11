# Lazy MCP WebApp (PyWebView)

This project combines the backend (Python logic) and frontend (React UI) into a single desktop application using PyWebView.

## Structure
- `main.py`: Entry point. Launches the app and exposes backend logic to the frontend via JS API.
- Uses built React frontend from `../frontend/dist/index.html`.
- Imports backend logic from `../backend/src/llm_client.py`.

## How to Run
1. Build the React frontend:
   ```bash
   cd ../frontend
   npm install
   npm run build
   ```
2. Install PyWebView:
   ```bash
   pip install pywebview
   ```
3. Run the app:
   ```bash
   python main.py
   ```

## Features
- Chat and logs functionality are available via the browser UI.
- All backend logic runs locally in Python.
- No server required; everything is packaged as a desktop app.

## Notes
- You may need to refactor backend imports for clean integration.
- For advanced features (file dialogs, notifications), see PyWebView documentation.
