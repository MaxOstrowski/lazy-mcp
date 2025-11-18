# lazy-mcp: Chat Agent with lazy loading MCP capabilities

This package provides a single command (`lazy-mcp`) to run a backend server and fowards the user to a browser to interact with the chat.

## Usage

```bash
uvx https://github.com/MaxOstrowski/lazy-mcp.git
```

or from source

```bash
hatch build
pip install .
lazy-mcp
```


## Authorization

An .env file is needed with the AZURE_OPENAI credentials:

AZURE_OPENAI_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=https://oai-service-pro-westeu-1.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4.1
AZURE_OPENAI_MODEL=gpt-4.1
AZURE_OPENAI_API_VERSION=2025-01-01-preview

## Development
- If the frontend has changed the hatch command has to be reexecuted to create the static frontend files
