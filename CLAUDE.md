# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Debo is an **open source AI enterprise system** with 54 specialized business agents that run entirely locally on the user's machine. All agents operate via Ollama with optional external access when explicitly configured. The system provides complete privacy with no vendor lock-in.

## Common Development Commands

### Setup and Running
```bash
npm install              # Install dependencies  
npm run setup           # Initial setup (Redis, Ollama models, system config)
npm start               # Start MCP server (production)
npm run dev             # Start with nodemon for development
```

### Testing and Quality
```bash
npm test                # Run Jest tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
npm run test:unit       # Run unit tests only
npm run test:integration # Run integration tests
npm run health          # Check system health
npm run clean           # Clean up old Redis data
```

### Installation and Dependencies
```bash
npm run install-deps    # Run system installer (./install.sh)
./install-oneliner.sh   # One-line system installation
```

## High-Level Architecture

### Privacy-First Design
- **Local Processing**: All 54 agents run on user's machine via Ollama
- **Local Storage**: Redis database stores all data locally
- **Optional External**: Agents only reach out when explicitly configured
- **Open Source**: MIT licensed, completely transparent

### Unified Services Architecture
The system uses a consolidated service architecture (ServiceFactory pattern):

1. **DatabaseService**: Unified Redis operations with connection pooling
2. **AgentExecutionEngine**: Optimized agent processing with batch operations  
3. **LLMRequestManager**: Request batching, caching, and cost optimization
4. **MemoryManager**: Intelligent cleanup and auto-summarization
5. **UnifiedOrchestratorService**: Strategic orchestration with multiple patterns

### Agent Hierarchy (54 Agents)
```
CEO Agent (Strategic Analysis)
├── C-Suite (8 Executive Agents) - Strategic thinking models
│   ├── CFO, COO, CTO, CMO, CHRO, CLO, CRO
└── Departments (46 Specialist Agents) - Fast execution models
    ├── Finance (8), Engineering (11), Legal (6)
    ├── Sales (6), Marketing (6), Operations (6), HR (6)
```

### MCP Server Flow
1. **Single Tool Interface**: Only `debo` tool accepts natural language
2. **CEO Analysis**: Strategic analysis and task delegation
3. **Parallel Execution**: Departments work simultaneously with Redis state sharing
4. **Quality Gateway**: Automated checks for all deliverables
5. **Result Aggregation**: Unified response with full audit trail

## Key Design Patterns

### Service Factory Pattern
```javascript
// All services initialized through ServiceFactory
const services = await ServiceFactory.createOptimizedServices();
// Returns: database, llmRequest, memory, agentExecution, orchestrator
```

### Agent Role Architecture
- **fortune500-roles.js**: All 54 business agent definitions
- **enhanced-executor.js**: Unified agent execution with Redis integration
- **department-manager.js**: Cross-department coordination

### Redis Schema
```
project:{id}              # Project metadata and status
task:{id}                 # Task details and results  
agent:{id}:state         # Agent execution contexts
workflow:{id}            # Business workflow data
```

## Development Guidelines

### Prerequisites for Development
- **Redis Server**: Must be running locally (`redis-server`)
- **Ollama**: Required for local AI models (auto-installed via `npm run setup`)
- **Node.js 18+**: Required for ES modules and modern features

### Working with Services
- Use ServiceFactory for service initialization
- All services support graceful shutdown and health checks
- Services auto-initialize dependencies in correct order
- Shared utilities available in `src/utils/shared-utilities.js`

### Adding New Agents
1. Define role in `src/agents/fortune500-roles.js` or create new role file
2. Use EnhancedExecutor for Redis integration
3. Follow department structure (thinking vs execution agents)
4. Ensure deliverables follow quality gateway patterns

### When Adding New Features
1. Consider which agent(s) should handle the work
2. Update the orchestrator if new workflows are needed
3. Ensure quality checks are included for code-producing tasks
4. Add appropriate logging for monitoring
5. Write tests following the Jest configuration in `jest.config.js`

### Local-First Development
- Default configuration uses local Ollama models
- External APIs require explicit environment variable configuration
- All processing happens locally unless user specifically requests external access
- Test with `npm run health` to verify local-only operation

### Performance Optimization
- Services are pre-optimized with batching and caching
- Use `logger.js` with createLogger for named loggers
- Monitor performance through built-in metrics in services
- Agent state automatically persists to Redis

### Testing Guidelines
- Tests use ES modules (`.js` files with `type: "module"`)
- Mock utilities available in `tests/setup.js`
- Set `DEBUG_TESTS=1` to enable console output during testing
- Use `npm run test:watch` for active development

### Error Handling
- The system includes comprehensive error handling and recovery
- Failed tasks are logged with detailed error information
- Agents can retry failed operations with exponential backoff
- Monitor logs in the `logs/` directory for debugging
- Error recovery manager prevents circular error loops

### MCP Integration
- The system implements Model Context Protocol for AI tool integration
- Main server entry point: `src/mcp_server.js`
- Tools are managed through `src/tools/manager.js`
- Custom MCP tools can be added via the tool registry

## Environment Variables

Required for local operation:
```bash
REDIS_URL=redis://localhost:6379
OLLAMA_BASE_URL=http://localhost:11434
```

Optional for external access:
```bash
# Only set these if you want external capabilities
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

## Important Implementation Notes

1. **Open Source Focus**: MIT licensed, no proprietary dependencies
2. **Privacy First**: No external calls without explicit user configuration
3. **Single Tool Design**: Only `debo` command - no separate dialogue/query tools
4. **Unified Architecture**: One optimized service layer, no legacy code
5. **Local LLMs**: Primary operation through Ollama models
6. **Agent Collaboration**: Full Redis state sharing between all 54 agents
7. **Quality Gateway**: Automated validation for all agent outputs

## Agent Communication Flow

Agents communicate through Redis with these key patterns:
- **Task Delegation**: CEO → C-Suite → Departments
- **State Sharing**: All agents read/write shared project state
- **Deliverable Storage**: Structured outputs stored with metadata
- **Workflow Coordination**: Department managers orchestrate team efforts

The system is designed for complete local operation with the flexibility to reach out for external information only when the user explicitly requests it.
