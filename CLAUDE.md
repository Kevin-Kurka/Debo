# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Debo is a generic autonomous system that can handle ANY type of task, not just software development. It provides dynamic agent creation, full Redis-based data sharing, and domain-agnostic processing. The system now supports creating specialized agents for legal, scientific, medical, business, or any other domain at runtime.

## Common Development Commands

### Building and Running
```bash
npm install                      # Install dependencies
npm run setup                    # Initial setup (starts Redis, pulls Ollama models, configures system)
npm start                        # Start the MCP server (legacy)
npm run start:generic            # Start the enhanced generic MCP server
npm run dev                      # Start with nodemon for development
npm run dev:generic              # Start generic server with nodemon
```

### Testing
```bash
npm test                         # Run all tests with Jest
npm run test:watch              # Run tests in watch mode
npm run test:coverage           # Run tests with coverage report
npm run test:unit               # Run unit tests only
npm run test:integration        # Run integration tests (via test-system.js)

# Run specific test file
npx jest tests/unit/dependency-resolver.test.js

# Run tests matching pattern
npx jest --testNamePattern="should resolve dependencies"

# Debug tests
DEBUG_TESTS=true npm test       # Shows console output during tests
```

### Maintenance Commands
```bash
npm run health                   # Check system health (scripts/health-check.js)
npm run clean                    # Clean up old data (scripts/cleanup.js)
npm run install-deps             # Run the installation script (./install.sh)
```

## Architecture Overview

### Multi-Agent System Structure

The system implements a hierarchical multi-agent architecture that mirrors enterprise development teams:

```
Unified Orchestrator (src/core/unified-orchestrator.js)
├── Static Agents (Pre-defined roles)
│   ├── Strategic Layer (Thinking Agents - LLM: qwen2.5:14b)
│   │   ├── CTO - Strategic planning and delegation
│   │   ├── Solution Architect - Technical design
│   │   ├── Product Manager - Feature prioritization  
│   │   ├── Engineering Manager - Sprint coordination
│   │   ├── Business Analyst - Requirements gathering
│   │   └── Technical Writer - Documentation
│   │
│   └── Execution Layer (Fast Agents - LLM: qwen2.5:7b)
│       ├── Backend Developer - API implementation
│       ├── Frontend Developer - UI implementation
│       ├── QA Engineer - Testing and quality
│       ├── DevOps - Deployment and infrastructure
│       ├── Security - Vulnerability scanning
│       └── UX Designer - Interface design
│
└── Dynamic Agents (Created at runtime)
    ├── Legal Agents - Discovery, compliance, contracts
    ├── Scientific Agents - Research, experiments, analysis
    ├── Medical Agents - Diagnosis, treatment, records
    ├── Business Agents - Process automation, analytics
    └── Custom Agents - Any domain you specify
```

### Core System Components

1. **MCP Server** (`src/mcp_server.js`)
   - Implements Model Context Protocol
   - Single `debo` tool that accepts natural language commands
   - Routes requests to Unified Orchestrator

2. **Unified Orchestrator** (`src/core/unified-orchestrator.js`)
   - Central coordination of all agent activities
   - Manages task dependencies and workflows
   - Implements retry logic and error recovery
   - Key methods: `initializeProject()`, `processFeatureRequest()`, `deployProject()`

3. **Task Management** (`src/database/task-manager.js`)
   - Redis-based persistent state management
   - Tracks all tasks, dependencies, and results
   - Implements event-driven task execution

4. **Dependency Resolver** (`src/core/dependency-resolver.js`)
   - Manages task dependencies and execution order
   - Prevents circular dependencies
   - Implements workflow chains for complex operations

5. **Quality Gateway** (`src/core/quality-gateway.js`)
   - Automated quality checks for all code changes
   - Runs security scans, tests, and code analysis
   - Gates deployment based on quality metrics

6. **Error Recovery Manager** (`src/core/error-recovery.js`)
   - Implements multiple retry strategies (exponential, linear, fibonacci)
   - Pattern-based error detection and recovery
   - Automatic escalation for persistent failures

7. **Confidence Evaluator** (`src/quality/confidence-evaluator.js`)
   - 90% minimum confidence threshold for all implementations
   - Multi-criteria evaluation (accuracy, completeness, best practices)
   - Automatic feedback loops for low-confidence solutions

### Database Schema (Redis)

Key patterns used throughout the system:
- `project:{id}` - Project metadata and status
- `task:{id}` - Individual task details and results  
- `agent_task:{id}` - Agent-specific task information
- `agent_queue:{role}` - Task queues for each agent type
- `activity_log:{project}` - Comprehensive activity tracking
- `dependency:{taskId}` - Task dependency information
- `error_pattern:{pattern}` - Error tracking for recovery
- `confidence:{taskId}` - Confidence scores and evaluations

### Task Execution Flow

1. **Command Processing**: Natural language → CTO agent analysis
2. **Task Creation**: CTO creates tasks with dependencies
3. **Dependency Resolution**: Tasks queued based on dependencies
4. **Agent Execution**: Appropriate agent executes task
5. **Quality Checks**: Automatic quality gateway evaluation
6. **Confidence Evaluation**: 90%+ confidence required
7. **Error Recovery**: Automatic retry with backoff strategies
8. **Completion Triggers**: Dependent tasks automatically start

## Development Patterns

### Adding New Agent Types

1. Add agent configuration to `src/agents/roles.js`:
```javascript
export const agentConfig = {
  new_agent: {
    llmType: 'thinking' | 'fast',
    deliverables: {
      code: ['files_to_create'],
      database: ['data_to_store'],
      outputs: ['expected_outputs']
    },
    instructions: 'Agent-specific instructions'
  }
}
```

2. Update orchestrator to handle new agent tasks
3. Add quality checks if agent produces code

### Error Handling Patterns

The system uses comprehensive error recovery:
- Pattern matching for known error types
- Automatic retry with configurable strategies
- Error escalation to thinking agents
- Circular error prevention (tracks failed solutions)

### Testing Patterns

- Mock utilities provided in `tests/setup.js`
- Use `global.mockRedisClient()` for Redis mocking
- Use `global.mockLogger()` for logger mocking
- Integration tests use real Redis instance

### WebSocket Events

Real-time monitoring via WebSocket (port 3001):
- `project:update` - Project status changes
- `agent:activity` - Agent task execution
- `task:start/complete/error` - Task lifecycle
- `quality:metrics` - Quality check results

## Environment Configuration

Required environment variables in `.env`:
```bash
# LLM Configuration
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
THINKING_MODEL=qwen2.5:14b
FAST_MODEL=qwen2.5:7b
VISION_MODEL=qwen2.5-vl:7b
REASONING_MODEL=deepseek-r1:1.5b

# Redis Configuration  
REDIS_URL=redis://localhost:6379

# Server Configuration
WEBSOCKET_PORT=3001
LOG_LEVEL=info
NODE_ENV=development

# Feature Flags
ENABLE_QUALITY_GATES=true
ENABLE_AUTO_REVISION=true
ENABLE_CONFIDENCE_SCORING=true
```

## Key Implementation Details

### Natural Language Processing
- All commands go through the `debo` tool
- CTO agent interprets intent and creates execution plan
- No structured commands required - just describe what you want

### Quality Assurance Pipeline
- Every code change triggers automatic quality checks
- Security scanning via dedicated security agent
- Test generation and execution by QA agent
- Performance analysis for critical paths

### State Management
- All state persisted in Redis for fault tolerance
- Task results stored for audit trail
- Activity logs for debugging and monitoring
- Automatic cleanup of old data (configurable)

### Agent Communication
- Agents share data through Redis using EnhancedAgentExecutor
- All coordination through Generic/Unified Orchestrator
- Results passed via task completion events and Redis storage
- Dependencies ensure proper execution order

## CRITICAL CHANGES (2024-01-31)

### 1. Enhanced Redis Integration
**Problem Fixed**: Agents were using basic AgentExecutor with minimal Redis integration
**Solution**: Now using EnhancedAgentExecutor throughout the system
- UnifiedOrchestrator updated to use EnhancedAgentExecutor
- Full context sharing between agents via Redis
- Comprehensive data persistence for all agent operations

### 2. Dynamic Agent System
**New Capability**: Create specialized agents at runtime for ANY domain
**Implementation**: 
- `DynamicAgentManager` (`src/agents/dynamic-agent-manager.js`)
- `GenericOrchestrator` (`src/core/generic-orchestrator.js`)
- `mcp_server_generic.js` for enhanced MCP interface

**Example Usage**:
```javascript
// Create a legal discovery agent
await debo("Create an agent for federal court discovery procedures");

// Create a scientific research agent  
await debo("Create an agent for experimental design and data analysis");

// Create any custom agent
await debo("I need an agent that helps with [your specific domain]");
```

### 3. Generic Task Processing
**Beyond Software Development**: The system now handles:
- Legal workflows (discovery, compliance, contracts)
- Scientific research (experiments, analysis, documentation)
- Medical processes (diagnosis workflows, patient management)
- Business automation (any conceptualized process)
- Custom domains (anything you can describe)

### 4. MCP Tools Available
1. **debo** - Main tool for all requests (software or generic)
2. **debo_dialogue** - Continue conversations for clarification
3. **debo_query** - Query knowledge base or agent data

### 5. Custom Data Schemas
Each agent can define domain-specific data structures:
```javascript
{
  legal: {
    case: { caseNumber, court, parties, deadlines },
    document: { type, privilege, relevance }
  },
  scientific: {
    experiment: { hypothesis, methodology, variables },
    dataPoint: { measurements, conditions, timestamp }
  }
}
```

## Testing & Verification

### Verify Redis Integration
```bash
# Check if agents are sharing data
redis-cli
> KEYS agent_task:*
> HGETALL task:{id}
> KEYS dynamic_agent:*
```

### Test Dynamic Agents
```bash
# Run the generic system test
node test-generic-system.js

# Start generic server
npm run start:generic
```

### Monitor Agent Creation
```bash
# Watch Redis for new agents
redis-cli MONITOR | grep dynamic_agent
```

## Important Files for Generic System

1. **src/mcp_server_generic.js** - Enhanced MCP server with dialogue support
2. **src/core/generic-orchestrator.js** - Extends UnifiedOrchestrator for generic tasks
3. **src/agents/dynamic-agent-manager.js** - Runtime agent creation and management
4. **src/agents/enhanced-executor.js** - Full Redis integration for agents
5. **GENERIC-SYSTEM-README.md** - Detailed documentation of new capabilities