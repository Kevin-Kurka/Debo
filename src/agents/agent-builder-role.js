// Agent Builder Role - Expert in Creating and Managing AI Agents
export const agentBuilderConfig = {
  agent_builder: {
    llmType: 'thinking',
    deliverables: {
      code: ['agent_configurations', 'workflow_definitions', 'integration_scripts'],
      database: ['agent_specifications', 'capability_mappings', 'performance_metrics', 'dependency_graphs'],
      outputs: ['functional_agent', 'integration_plan', 'monitoring_setup', 'documentation']
    },
    instructions: `You are an Agent Builder - a world-class expert in AI agent architecture and modern automation frameworks. Your role is to design, create, and integrate new agents into the Debo ecosystem.

CORE EXPERTISE:
1. **LangGraph Workflow Frameworks**:
   - Design state machines for complex agent workflows
   - Implement branching logic and conditional execution paths
   - Create robust error handling and recovery mechanisms
   - Optimize workflow performance and resource usage

2. **LangChain Tools and Chains**:
   - Build sophisticated tool chains for complex tasks
   - Implement custom tools with proper validation
   - Design memory-aware conversation flows
   - Integrate external APIs and services seamlessly

3. **AI/LLM Industry Best Practices**:
   - Prompt engineering for optimal performance
   - Model selection based on task requirements (thinking vs fast LLMs)
   - Token optimization and cost management
   - Safety filters and content moderation

4. **Process Automation Frameworks**:
   - Event-driven architectures for reactive systems
   - Queue-based processing for scalable workflows
   - Dependency resolution and task orchestration
   - Performance monitoring and auto-scaling

5. **Agent Architecture Patterns**:
   - Multi-agent coordination and communication
   - Role-based access control and permissions
   - State management and persistence strategies
   - Fault tolerance and graceful degradation

AGENT CREATION PROCESS:
1. **Requirements Analysis**:
   - Parse natural language requests into technical specifications
   - Identify required capabilities and constraints
   - Map to existing Debo patterns and integrations
   - Define success criteria and performance metrics

2. **Architecture Design**:
   - Select appropriate LLM type (thinking/fast) based on complexity
   - Design agent state machine and workflow paths
   - Plan data inputs/outputs and storage requirements
   - Define integration points with existing agents

3. **Implementation Planning**:
   - Generate agent configuration with proper prompts
   - Create validation schemas and error handling
   - Plan testing and quality assurance approach
   - Design monitoring and performance tracking

4. **Integration Strategy**:
   - Map dependencies with existing agents
   - Plan deployment and rollout strategy
   - Design backward compatibility measures
   - Create documentation and training materials

DELIVERABLE STANDARDS:
- All agents must integrate with Debo's Redis-based memory system
- Must follow the established deliverables pattern (code/database/outputs)
- Include comprehensive error handling and logging
- Provide clear performance metrics and monitoring hooks
- Support graceful shutdown and resource cleanup

QUALITY REQUIREMENTS:
- Agents must be testable and debuggable
- Include comprehensive documentation
- Follow security best practices
- Optimize for resource efficiency
- Support horizontal scaling where applicable

When creating agents, always consider:
- How the agent fits into the Fortune 500 company structure
- What other agents it needs to collaborate with
- How to handle failures and edge cases gracefully
- What data it needs to persist and how to organize it
- How to measure and improve its performance over time

Your output should be production-ready agent specifications that can be immediately deployed into the Debo ecosystem.`,
    
    capabilities: {
      frameworks: [
        'LangGraph',
        'LangChain', 
        'LlamaIndex',
        'AutoGen',
        'CrewAI',
        'Semantic Kernel'
      ],
      patterns: [
        'Multi-agent systems',
        'Event-driven architecture',
        'State machines',
        'Pipeline processing',
        'Observer pattern',
        'Command pattern',
        'Strategy pattern'
      ],
      technologies: [
        'Redis for state management',
        'WebSocket for real-time communication',
        'REST APIs for integration',
        'Docker for containerization',
        'Kubernetes for orchestration',
        'Prometheus for monitoring'
      ],
      specializations: [
        'Natural language processing',
        'Code generation and analysis',
        'Data processing and ETL',
        'API integration and automation',
        'Monitoring and alerting',
        'Security and compliance'
      ]
    },

    templates: {
      research_agent: {
        description: 'Autonomous research and data collection',
        llmType: 'thinking',
        commonUses: ['market research', 'competitive analysis', 'literature review']
      },
      automation_agent: {
        description: 'Process automation and workflow management',
        llmType: 'fast', 
        commonUses: ['data processing', 'file management', 'scheduled tasks']
      },
      monitoring_agent: {
        description: 'System monitoring and alerting',
        llmType: 'fast',
        commonUses: ['health checks', 'performance monitoring', 'anomaly detection']
      },
      integration_agent: {
        description: 'Third-party service integration',
        llmType: 'fast',
        commonUses: ['API consumption', 'data synchronization', 'webhook handling']
      },
      analysis_agent: {
        description: 'Data analysis and reporting',
        llmType: 'thinking',
        commonUses: ['business intelligence', 'trend analysis', 'decision support']
      }
    },

    validationCriteria: {
      required: ['name', 'description', 'llmType', 'deliverables', 'instructions'],
      namePattern: '^[a-z][a-z0-9_]*$',
      maxInstructionLength: 5000,
      maxDeliverableItems: 10,
      supportedLLMTypes: ['thinking', 'fast'],
      requiredCapabilities: ['error_handling', 'logging', 'state_management']
    }
  }
};

// Helper functions for agent building
export class AgentBuilderHelpers {
  static parseRequirements(naturalLanguageRequest) {
    // Extract key components from natural language
    const patterns = {
      agentType: /(?:create|build|make)\s+(?:an?\s+)?(\w+)\s+agent/i,
      action: /(?:that|to|will)\s+(.*?)(?:\s+and|\s+or|$)/gi,
      frequency: /(?:every|each)\s+(\d+\s+\w+)/i,
      triggers: /(?:when|if)\s+(.*?)(?:\s+then|\s+,|$)/gi,
      outputs: /(?:send|create|generate|produce)\s+(.*?)(?:\s+to|\s+for|$)/gi
    };

    const requirements = {
      type: 'custom_agent',
      name: null,
      actions: [],
      triggers: [],
      outputs: [],
      frequency: null
    };

    // Extract agent type
    const typeMatch = naturalLanguageRequest.match(patterns.agentType);
    if (typeMatch) {
      requirements.name = typeMatch[1].toLowerCase() + '_agent';
      requirements.type = typeMatch[1].toLowerCase();
    }

    // Extract actions
    let actionMatch;
    while ((actionMatch = patterns.action.exec(naturalLanguageRequest)) !== null) {
      requirements.actions.push(actionMatch[1].trim());
    }

    // Extract triggers
    let triggerMatch;
    while ((triggerMatch = patterns.triggers.exec(naturalLanguageRequest)) !== null) {
      requirements.triggers.push(triggerMatch[1].trim());
    }

    // Extract outputs
    let outputMatch;
    while ((outputMatch = patterns.outputs.exec(naturalLanguageRequest)) !== null) {
      requirements.outputs.push(outputMatch[1].trim());
    }

    // Extract frequency
    const frequencyMatch = naturalLanguageRequest.match(patterns.frequency);
    if (frequencyMatch) {
      requirements.frequency = frequencyMatch[1];
    }

    return requirements;
  }

  static generateAgentName(description) {
    // Generate a valid agent name from description
    const words = description.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3);
    
    return words.join('_') + '_agent';
  }

  static determineAgentType(requirements) {
    // Determine if agent should use thinking or fast LLM
    const thinkingKeywords = [
      'analyze', 'plan', 'strategy', 'decide', 'evaluate', 'assess',
      'research', 'investigate', 'review', 'compare', 'prioritize'
    ];

    const fastKeywords = [
      'monitor', 'alert', 'notify', 'process', 'transform', 'convert',
      'send', 'update', 'sync', 'backup', 'deploy', 'execute'
    ];

    const text = JSON.stringify(requirements).toLowerCase();
    
    const thinkingScore = thinkingKeywords.reduce((score, keyword) => 
      score + (text.includes(keyword) ? 1 : 0), 0);
    
    const fastScore = fastKeywords.reduce((score, keyword) => 
      score + (text.includes(keyword) ? 1 : 0), 0);

    return thinkingScore > fastScore ? 'thinking' : 'fast';
  }

  static generateDeliverables(requirements, agentType) {
    const deliverables = {
      code: [],
      database: [],
      outputs: []
    };

    // Code deliverables based on agent type
    if (requirements.actions.some(action => action.includes('script') || action.includes('code'))) {
      deliverables.code.push('automation_scripts');
    }
    if (requirements.outputs.some(output => output.includes('report') || output.includes('document'))) {
      deliverables.code.push('report_templates');
    }
    if (requirements.triggers.length > 0) {
      deliverables.code.push('trigger_handlers');
    }

    // Database deliverables
    deliverables.database.push('execution_logs');
    deliverables.database.push('performance_metrics');
    if (requirements.frequency) {
      deliverables.database.push('schedule_tracking');
    }
    if (requirements.triggers.length > 0) {
      deliverables.database.push('trigger_history');
    }

    // Output deliverables
    requirements.outputs.forEach(output => {
      const sanitized = output.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
      deliverables.outputs.push(sanitized);
    });

    // Default outputs if none specified
    if (deliverables.outputs.length === 0) {
      deliverables.outputs.push('task_completion_status');
    }

    return deliverables;
  }

  static validateAgentConfig(config) {
    const errors = [];
    const criteria = agentBuilderConfig.agent_builder.validationCriteria;

    // Check required fields
    criteria.required.forEach(field => {
      if (!config[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Validate name pattern
    if (config.name && !new RegExp(criteria.namePattern).test(config.name)) {
      errors.push(`Agent name must match pattern: ${criteria.namePattern}`);
    }

    // Validate LLM type
    if (config.llmType && !criteria.supportedLLMTypes.includes(config.llmType)) {
      errors.push(`Unsupported LLM type: ${config.llmType}`);
    }

    // Validate instruction length
    if (config.instructions && config.instructions.length > criteria.maxInstructionLength) {
      errors.push(`Instructions too long: ${config.instructions.length} > ${criteria.maxInstructionLength}`);
    }

    return errors;
  }
}