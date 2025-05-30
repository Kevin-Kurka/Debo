# DBot - Development Bot MCP Server

## Quick Start
```bash
git clone https://github.com/Kevin-Kurka/dbot.git
cd dbot
npm install
npm run setup  # Starts server immediately, downloads models in background
```

## Features
- Multi-project management with Redis persistence
- Vision-guided style onboarding  
- Tech stack auto-detection and documentation RAG
- Feature analysis and integration
- Git branch management for parallel development
- Model schema translation (TS/Python/SQL)
- Local embedding model for fast similarity search

## MCP Integration
Add to any MCP-capable application:
```json
{
  "dbot": {
    "command": "node",
    "args": ["path/to/dbot/src/mcp_server.js"]
  }
}
```

Use `@dbot` in chat or call the `dbot` tool directly.

## Commands
- `dbot` - Single tool for all development tasks

Ready for production use with any MCP-compatible application.
