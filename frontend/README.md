# Lazy MCP Frontend

A simple React-based chat interface for your API using Vite.

## Features
- Chat window for messages
- Input field to send messages
- Log window for logs (right side)

## Getting Started

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:5173](http://localhost:5173) in your browser.

## API Integration
- The chat window sends messages to `/chat` via POST.
- Update the API endpoint in `vite.config.js` if needed.
