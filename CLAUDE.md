# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Debo is a Fortune 500 Enterprise AI System that provides a complete company structure with 54 specialized business agents. It uses a single natural language interface to handle ANY business task - from software development to financial forecasting, HR management, legal compliance, and strategic planning. The system implements LangGraph-style workflows with full Redis state management.

## Common Development Commands

### Setup and Running
```bash
npm install                      # Install dependencies
npm run setup                    # Initial setup (Redis, Ollama models, system config)
npm run start:generic            # Start Fortune 500 Enterprise system (recommended)
npm run dev:generic              # Start with nodemon for development

# Legacy commands (still available)
npm start                        # Original MCP server
npm run dev                      # Original dev mode
```

### Testing
```bash
npm test                         # Run Jest tests
npm run test:watch              # Watch mode
npm run test:coverage           # Coverage report
npm run test:unit               # Unit tests only

# Run specific business system tests
node test-business-system.js     # Test Fortune 500 capabilities
node test-generic-system.js      # Test generic agent creation
```

### Utilities
```bash
npm run health                   # System health check
npm run clean                    # Clean old Redis data
./start-generic.sh              # Quick start script with status display
```

## High-Level Architecture

### Fortune 500 Enterprise Structure

```
Fortune500Orchestrator (src/core/fortune500-orchestrator.js)
├── C-Suite Executives (8 agents - GPT-4/GPT-3.5)
│   ├── CEO - Overall strategy and decision making
│   ├── CFO - Financial strategy and risk management
│   ├── COO - Operations and efficiency
│   ├── CTO - Technology strategy
│   ├── CMO - Marketing and brand
│   ├── CHRO - People and culture
│   ├── CLO - Legal and compliance
│   └── CRO - Revenue and sales
│
└── Departments (46 specialized agents)
    ├── Finance (8) - Controllers, CPAs, Analysts
    ├── Operations (6) - Supply Chain, Quality, Project Mgmt
    ├── HR (6) - Talent, Compensation, Training
    ├── Legal (6) - Attorneys, Compliance, IP
    ├── Sales (6) - Directors, Account Execs, Customer Success
    ├── Marketing (6) - Brand, Product, Digital
    ├── Strategy (5) - Research, Competitive Intel
    └── Engineering (11) - Original dev team + business awareness
```

### Core Components

1. **MCP Interface** (`src/mcp_server_generic.js`)
   - Single `debo` tool for ALL requests
   - Natural language understanding
   - Automatic routing to appropriate agents
   - JSON-RPC protocol implementation

2. **Fortune500Orchestrator** (`src/core/fortune500-orchestrator.js`)
   - Extends GenericOrchestrator
   - CEO analyzes all requests first
   - Routes through corporate hierarchy
   - Manages cross-department collaboration

3. **Workflow Engine** (`src/core/workflow-engine.js`)
   - LangGraph-style state management
   - Parallel task execution
   - Human approval gates
   - Checkpoint/recovery support
   - Business workflow templates

4. **Department Manager** (`src/agents/department-manager.js`)
   - Coordinates department-level workflows
   - Manages specialized agent pools
   - Handles inter-department communication

5. **Enhanced Agent Executor** (`src/agents/enhanced-executor.js`)
   - Full Redis integration for data sharing
   - Context preservation across agents
   - Deliverable storage and retrieval

### Business Request Flow

1. User sends natural language request via `debo` tool
2. CEO agent analyzes and determines scope
3. Relevant C-suite executives provide strategic input
4. Work delegated to appropriate departments
5. Specialized agents execute tasks in parallel
6. Department heads review work
7. Results aggregated and returned

### Redis Data Architecture

```
company:{metric}              # Company KPIs and metrics
department:{name}:{data}      # Department-specific data
workflow:{id}:state          # Active workflow states
workflow:{id}:checkpoints    # Workflow snapshots
agent:{id}:context          # Agent execution contexts
task:{id}:results           # Task outputs
decision:{id}              # Strategic decisions with rationale
approval:{id}              # Pending approvals
```

## Key Capabilities

### Business Operations
- Financial forecasting, budgeting, and reporting
- HR management: recruiting, onboarding, retention
- Legal compliance and contract management
- Sales pipeline and customer success
- Marketing campaigns and brand strategy
- Operations optimization and supply chain
- Strategic planning and market analysis

### Technical Features
- 54 specialized agents with business expertise
- LangGraph workflows with state persistence
- Parallel execution across departments
- Human-in-the-loop approvals
- Full audit trail in Redis
- Cross-department data sharing
- Business objective optimization

## Important Implementation Notes

### Single Tool Design
The system uses ONLY the `debo` tool - no separate dialogue or query tools. Everything is handled through natural language context.

### Agent Communication
All agents use EnhancedAgentExecutor for proper Redis integration. Data is shared through structured Redis keys, enabling true collaboration.

### Workflow Management
The WorkflowEngine supports complex business processes with branching, approvals, and checkpoints. Common patterns include financial approvals, product launches, and hiring workflows.

### Error Handling
Comprehensive error recovery with retry strategies, pattern matching, and escalation to senior agents when needed.

## Testing Business Capabilities

```bash
# Test financial operations
debo "prepare Q3 financial statements with variance analysis"

# Test HR workflows  
debo "create employee onboarding process for engineers"

# Test strategic planning
debo "analyze market entry opportunities in Europe"

# Test cross-functional
debo "plan product launch with budget and marketing strategy"
```

## Environment Variables

Required in `.env`:
```bash
REDIS_URL=redis://localhost:6379
OLLAMA_BASE_URL=http://localhost:11434
ENABLE_BUSINESS_MODE=true
WORKFLOW_ENGINE=langgraph
```

## Recent Architectural Changes

1. **Simplified to Single Tool** - Removed debo_dialogue and debo_query
2. **Fortune 500 Structure** - Added complete business agent hierarchy
3. **LangGraph Workflows** - Implemented stateful business processes
4. **Enhanced Redis Usage** - All agents share state properly
5. **Business Intelligence** - Agents understand and optimize for business objectives

## Key Files for Business System

- `src/agents/fortune500-roles.js` - All 54 business agent definitions
- `src/core/fortune500-orchestrator.js` - Corporate hierarchy orchestration
- `src/core/workflow-engine.js` - LangGraph-style workflows
- `src/agents/department-manager.js` - Department coordination
- `BUSINESS-SYSTEM-README.md` - Comprehensive business documentation