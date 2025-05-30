# DBot - Development Bot MCP Server

## Quick Start
```bash
git clone https://github.com/your-username/dbot
cd dbot
npm install
npm run setup
npm start
```

## Usage with Any MCP Application
Add to your MCP-capable application's configuration:
```json
{
  "dbot": {
    "command": "node",
    "args": ["path/to/dbot/src/mcp_server.js"],
    "env": {
      "MCP_PORT": "3000"
    }
  }
}
```

Use `@dbot` in any chat or reference the `dbot` tool directly.

## Features
- Multi-project management with Redis persistence
- Vision-guided style onboarding
- Tech stack auto-detection and documentation RAG
- Feature analysis and integration
- Git branch management for parallel development
- Model schema translation (TS/Python/SQL)
- Local embedding model for fast similarity search

## Commands
- `dbot` - Main development assistant tool
- `create_project` - Initialize new project with interviews
- `list_projects` - Show all managed projects

## Architecture
- **MCP Server** (Node.js) - Cursor integration
- **Orchestrator** (Python) - Request routing and interviews
- **Agent Pool** - Specialized coding agents with Ollama
- **Redis Stack** - State persistence and vector search
- **Local Models** - No API dependencies

Ready for production use with Cursor IDE.
