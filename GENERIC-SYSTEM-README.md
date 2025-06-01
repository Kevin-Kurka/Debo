# Debo Generic System - Enhanced Capabilities

## Overview

The Debo system has been significantly enhanced to support:
- **Dynamic agent creation** for any domain (not just software development)
- **Full Redis integration** for agent data sharing
- **Generic task processing** for any conceptualized task
- **Dialogue-based interactions** for requirement clarification
- **Custom data schemas** per agent domain
- **RAG (Retrieval-Augmented Generation)** for knowledge management

## Key Improvements Implemented

### 1. Enhanced Redis Integration

The system now uses `EnhancedAgentExecutor` instead of the basic `AgentExecutor`, ensuring:
- All agents read from and write to Redis
- Complete data persistence across agent executions
- Shared context between agents
- Comprehensive activity logging

### 2. Dynamic Agent Creation

Create specialized agents at runtime for any domain:

```javascript
// Example: Create a Legal Discovery Agent
await debo({
  request: "Create an agent for federal court discovery procedures",
  context: { domain: "legal" }
});

// Example: Create a Scientific Research Agent
await debo({
  request: "Create an agent for scientific method and experimental design",
  context: { domain: "scientific" }
});
```

### 3. Generic Orchestrator

The new `GenericOrchestrator` extends `UnifiedOrchestrator` with:
- Domain-agnostic request processing
- Dynamic agent matching
- Custom workflow creation
- Intelligent task routing

### 4. Dialogue System

When Debo needs clarification:
```javascript
// Initial request
const response = await debo({
  request: "Help me with my research project"
});

// Continue dialogue
const clarified = await debo_dialogue({
  dialogueId: response.dialogueId,
  response: "It's about quantum computing applications in cryptography"
});
```

### 5. Custom Data Schemas

Each agent can have domain-specific data schemas:

```javascript
// Legal agent schema
{
  case: {
    caseNumber: "string",
    court: "string",
    parties: "array",
    discoveryDeadlines: "object"
  },
  discoveryRequest: {
    type: "string",
    requestingParty: "string",
    items: "array"
  }
}

// Scientific agent schema
{
  experiment: {
    hypothesis: "string",
    methodology: "object",
    variables: "object"
  },
  dataPoint: {
    measurements: "object",
    conditions: "object"
  }
}
```

## Usage Examples

### 1. Creating a Specialized Agent

```bash
# Using the MCP tool
debo "I need an agent that specializes in medical diagnosis workflows, 
      patient data management, and treatment recommendations"
```

### 2. Generic Task Processing

```bash
# Business process automation
debo "Create a customer onboarding workflow with compliance checks"

# Research assistance
debo "Help me design an experiment to test the effects of temperature on enzyme activity"

# Legal document analysis
debo "Review these discovery requests and identify potentially privileged documents"
```

### 3. Knowledge Queries

```bash
# Query specific domain knowledge
debo_query --domain "legal" "What are the deadlines for discovery responses in federal court?"

# Query agent-specific data
debo_query --agentId "legal_discovery_specialist" "Show all active cases"
```

## Architecture Changes

### Before (Limited)
```
User → MCP → UnifiedOrchestrator → AgentExecutor → Static Agents
                                         ↓
                                   Minimal Redis
```

### After (Enhanced)
```
User → MCP → GenericOrchestrator → EnhancedAgentExecutor → Dynamic Agents
                ↓                           ↓                      ↓
        DynamicAgentManager          Full Redis Integration   Custom Schemas
                ↓                           ↓                      ↓
          RAG Manager                Shared Context          Domain Knowledge
```

## Starting the Enhanced System

```bash
# Install dependencies
npm install

# Setup (starts Redis, configures system)
npm run setup

# Start the generic MCP server
npm run start:generic

# Or for development with auto-reload
npm run dev:generic
```

## Testing the New Capabilities

```bash
# Run the comprehensive test suite
node test-generic-system.js

# Check Redis integration
redis-cli
> KEYS *
> HGETALL agent:*
```

## Configuration

The system now supports additional configuration in `.env`:

```env
# Existing configs...

# Generic System Settings
ENABLE_DYNAMIC_AGENTS=true
MAX_DIALOGUE_TURNS=10
AGENT_CREATION_MODEL=qwen2.5:14b
KNOWLEDGE_EMBEDDING_MODEL=nomic-embed-text
```

## Monitoring

### WebSocket Dashboard
Connect to `ws://localhost:3001` to monitor:
- Dynamic agent creation
- Cross-agent data sharing
- Task execution with Redis persistence
- Knowledge base updates

### Redis Monitoring
```bash
# Monitor Redis activity
redis-cli MONITOR

# Check agent data
redis-cli HGETALL "dynamic_agent:legal_discovery_specialist"

# View task queues
redis-cli LRANGE "agent_queue:pending" 0 -1
```

## Extending the System

### Adding New Agent Templates

Edit `src/agents/dynamic-agent-manager.js`:

```javascript
{
  name: 'Financial Analyst',
  domain: 'finance',
  capabilities: [
    'Financial modeling',
    'Risk assessment',
    'Portfolio analysis'
  ],
  dataSchema: {
    portfolio: {
      assets: 'array',
      totalValue: 'number',
      riskScore: 'number'
    }
  }
}
```

### Creating Custom Workflows

```javascript
// In your code
const workflow = await orchestrator.createCustomWorkflow('financial_analysis', {
  steps: [
    { agent: 'financial_analyst', action: 'analyze_portfolio' },
    { agent: 'risk_assessor', action: 'calculate_risk' },
    { agent: 'report_generator', action: 'create_report' }
  ]
});
```

## Troubleshooting

### Agents Not Sharing Data
- Check Redis connection: `redis-cli ping`
- Verify EnhancedAgentExecutor is being used
- Check logs: `tail -f logs/agents.log`

### Dynamic Agent Creation Fails
- Ensure sufficient Ollama models are available
- Check dialogue state in Redis
- Verify LLM provider configuration

### Performance Issues
- Monitor Redis memory usage
- Check agent queue sizes
- Review dependency resolution logs

## Future Enhancements

1. **Multi-modal Agents**: Support for image, audio, and video processing
2. **Agent Marketplace**: Share and import agent definitions
3. **Distributed Execution**: Run agents across multiple machines
4. **Advanced RAG**: Vector databases for better knowledge retrieval
5. **Agent Learning**: Agents that improve from usage patterns

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review Redis data structure
- Consult `CLAUDE.md` for development guidance
- Open an issue on GitHub