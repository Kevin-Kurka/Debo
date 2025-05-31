# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Debo is an autonomous development system that mimics a Fortune 500 enterprise structure. It provides a single MCP tool (`debo`) that orchestrates multiple specialized AI agents to handle complete software development lifecycles.

## Common Development Commands

### Building and Running
```bash
npm install              # Install dependencies
npm run setup           # Initial setup (starts Redis, pulls Ollama models, configures system)
npm start               # Start the MCP server
npm run dev             # Start with nodemon for development
```

### Testing and Quality
```bash
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
npm run test:unit       # Run unit tests only
npm run test:integration # Run integration tests (via test-system.js)
npm run health          # Check system health
npm run clean           # Clean up old data
```

### Installation and Dependencies
```bash
npm run install-deps    # Run the installation script (./install.sh)
```

### Using Debo in MCP Applications
```bash
# Create a new project
debo create "project-name" "Project description and requirements"

# Add features to existing project
debo develop "project-name" "Feature description"

# Check project status
debo status "project-name"

# Deploy project
debo deploy "project-name" "environment"

# Perform maintenance
debo maintain "project-name" "Maintenance tasks"

# Analyze project quality
debo analyze "project-name"
```

## High-Level Architecture

### Agent-Based System
The system uses a Fortune 500 company structure with two types of agents:

1. **Thinking Agents** (use larger LLMs for strategic planning):
   - CTO: Strategic analysis and delegation
   - Engineering Manager: Sprint planning and coordination
   - Product Manager: Feature prioritization
   - Business Analyst: Requirements gathering
   - Solution Architect: System design
   - Technical Writer: Documentation

2. **Fast Execution Agents** (use smaller LLMs for implementation):
   - Backend/Frontend Developers: Code implementation
   - QA Engineer: Testing
   - DevOps: Deployment
   - Security: Vulnerability scanning
   - UX Designer: Interface design

### Supported Technology Stacks
- **Frontend**: React, Next.js, Vue, Angular, Svelte
- **Backend**: Express, FastAPI, Django, Rails, Spring Boot
- **Fullstack**: MERN, MEAN, T3, Blitz.js
- **Deployment**: Vercel, Netlify, Heroku, AWS, GCP, Azure, Docker/Kubernetes

### Core Components

1. **MCP Server** (`src/mcp_server.js`): Main entry point implementing the Model Context Protocol
2. **Unified Orchestrator** (`src/core/unified-orchestrator.js`): Coordinates all agent activities and task dependencies
3. **Task Management** (`src/database/task-manager.js`): Redis-based persistent state management
4. **Quality Gateway** (`src/core/quality-gateway.js`): Automated quality checks and metrics
5. **Agent Executor** (`src/agents/executor.js`): Standardized agent execution and result handling

### Task Flow
1. Commands trigger the CTO agent for strategic analysis
2. CTO delegates to appropriate teams based on the task
3. Tasks are executed asynchronously with dependency tracking
4. Quality checks run automatically for code-producing agents
5. Dependent tasks trigger based on completion patterns

### Database Schema
Uses Redis with structured keys:
- `project:{id}`: Project metadata and status
- `task:{id}`: Individual task details and results
- `agent_queue:{role}`: Task queues for each agent type
- `activity_log:{project}`: Comprehensive activity tracking

### Key Design Patterns
- **Event-driven architecture** for asynchronous task execution
- **Quality gateway pattern** for automated quality assurance
- **Pipeline architecture** for structured workflows
- **Dependency-aware scheduling** for optimal task execution

## Development Guidelines

### When Adding New Features
1. Consider which agent(s) should handle the work
2. Update the orchestrator if new workflows are needed
3. Ensure quality checks are included for code-producing tasks
4. Add appropriate logging for monitoring

### When Modifying Agents
1. Maintain the separation between thinking and fast agents
2. Follow the existing prompt structure in `src/agents/roles.js`
3. Ensure deliverables are properly stored in the database
4. Update agent capabilities in the orchestrator

### Working with Redis
- All project state is stored in Redis for persistence
- Use the TaskManager class for database operations
- Follow existing key naming conventions
- Clean up old data periodically with `npm run clean`

### Error Handling
- The system includes comprehensive error handling and recovery
- Failed tasks are logged with detailed error information
- Agents can retry failed operations with exponential backoff
- Monitor logs in the `logs/` directory for debugging

## System Requirements

- **Node.js**: 18.0.0 or higher
- **Redis**: 6.0 or higher
- **Memory**: 8GB RAM minimum
- **OS**: macOS or Linux (Windows WSL2 supported)
- **LLM Backend**: Ollama (default) or external providers

## Environment Configuration

Create a `.env` file with these settings:
```bash
# LLM Provider
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434

# Redis
REDIS_URL=redis://localhost:6379

# WebSocket
WEBSOCKET_PORT=3001

# Logging
LOG_LEVEL=info
```

## WebSocket Monitoring

The system includes a real-time monitoring dashboard accessible at `http://localhost:3001` that shows:
- Live agent activity and task progress
- Code changes in real-time
- Quality metrics and test results
- Deployment status and logs

## CLI Usage

The system provides a `debo` CLI command installed globally via npm:
```bash
debo create <project-name> <requirements> [stack]
debo develop <project-name> <feature-description>
debo status <project-name>
debo deploy <project-name> <environment> [provider]
debo analyze <project-name>
debo maintain <project-name> <tasks>
debo monitor [project-name]
debo help [command]
```