# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Debo is an Enterprise AI System with 54 specialized business agents that handle ANY task through natural language. The system provides a complete Fortune 500 company structure optimized for performance and cost efficiency.

## Common Development Commands

### Setup and Running
```bash
npm install              # Install dependencies  
npm run setup           # Initial setup (Redis, Ollama models, system config)
npm start               # Start optimized enterprise system
npm run dev             # Start with nodemon for development
```

### Testing and Quality
```bash
npm test                # Run tests
npm run health          # Check system health
npm run clean           # Clean up old data
```

### Using Debo
```bash
# Single command for everything
debo "your request in natural language"

# Examples
debo "create a REST API with authentication"
debo "prepare Q3 financial statements"
debo "design employee onboarding workflow" 
debo "analyze our competitive market position"
```

## High-Level Architecture

### Enterprise Structure (54 Agents)
```
CEO Agent (Strategic Analysis)
├── C-Suite (8 Executive Agents)
│   ├── CFO - Financial Strategy
│   ├── COO - Operations  
│   ├── CTO - Technology
│   ├── CMO - Marketing
│   ├── CHRO - Human Resources
│   ├── CLO - Legal
│   └── CRO - Revenue
│
└── Departments (46 Specialist Agents)
    ├── Finance (8 agents)
    ├── Engineering (11 agents) 
    ├── Legal (6 agents)
    ├── Sales (6 agents)
    ├── Marketing (6 agents)
    ├── Operations (6 agents)
    └── HR (6 agents)
```

### Core Components

1. **MCP Server** (`src/mcp_server.js`): Main entry point with optimized performance
2. **Unified Services** (`src/services/`): Consolidated database, LLM, and orchestration services
3. **Agent System** (`src/agents/`): All 54 business agents with specialized roles
4. **Quality Gateway** (`src/core/quality-gateway.js`): Automated quality checks
5. **Redis State Management**: All agent data shared through optimized Redis operations

### Request Flow
1. User sends natural language request via `debo` tool
2. CEO agent analyzes and determines scope
3. Work delegated to appropriate departments
4. Specialized agents execute tasks in parallel
5. Results aggregated and returned with quality checks

### Database Schema
Redis with optimized structure:
- `project:{id}`: Project metadata
- `task:{id}`: Task details and results
- `agent:{id}:state`: Agent execution state
- `workflow:{id}`: Business workflow data

## Key Design Patterns
- **Single Tool Interface**: Everything through one `debo` command
- **Optimized Services**: Consolidated architecture for 3x performance
- **Event-driven execution**: Asynchronous task coordination
- **Quality-first**: Automated checks for all deliverables
- **Enterprise-grade**: Redis state management and error recovery

## Development Guidelines

### When Adding Features
1. Use the optimized services architecture
2. Ensure all agents use proper Redis integration
3. Follow the single tool design pattern
4. Add appropriate quality checks

### Performance Optimization
- All services are enterprise-optimized
- Use batch operations for database access
- Implement proper error handling and recovery
- Monitor agent performance through built-in metrics

### Working with Agents
- All agents use the unified agent execution engine
- State is automatically persisted to Redis
- Follow existing agent role patterns
- Ensure deliverables are properly structured

## Environment Variables

Required in `.env`:
```bash
REDIS_URL=redis://localhost:6379
OLLAMA_BASE_URL=http://localhost:11434
```

## Important Notes

1. **Single Installation**: Only one optimized version - no legacy systems
2. **Performance**: Enterprise-grade optimization for speed and cost efficiency
3. **Simplicity**: One command (`debo`) handles everything
4. **Enterprise-grade**: Designed for business use across all domains
5. **Natural Language**: No complex syntax or configuration required