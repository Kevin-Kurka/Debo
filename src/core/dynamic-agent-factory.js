import { AgentBuilderHelpers } from '../agents/agent-builder-role.js';
import { agentConfig } from '../agents/roles.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class DynamicAgentFactory {
  constructor(taskManager, memoryManager) {
    this.taskManager = taskManager;
    this.memoryManager = memoryManager;
    this.agentRegistry = new Map();
    this.agentVersions = new Map();
    this.createdAgents = new Map();
  }

  async init() {
    // Load existing dynamic agents from database
    await this.loadExistingAgents();
    logger.info('Dynamic Agent Factory initialized');
  }

  /**
   * Create a new agent from natural language requirements
   */
  async createAgentFromDescription(description, options = {}) {
    try {
      // Parse natural language into structured requirements
      const requirements = AgentBuilderHelpers.parseRequirements(description);
      
      // Generate agent configuration
      const agentConfig = await this.generateAgentConfig(requirements, options);
      
      // Validate configuration
      const validationErrors = AgentBuilderHelpers.validateAgentConfig(agentConfig);
      if (validationErrors.length > 0) {
        throw new Error(`Agent validation failed: ${validationErrors.join(', ')}`);
      }
      
      // Register agent in system
      const agentId = await this.registerAgent(agentConfig);
      
      // Store in memory system
      await this.persistAgent(agentId, agentConfig);
      
      logger.info(`Created new agent: ${agentConfig.name} (${agentId})`);
      
      return {
        id: agentId,
        config: agentConfig,
        status: 'created',
        capabilities: this.analyzeCapabilities(agentConfig)
      };
      
    } catch (error) {
      logger.error('Failed to create agent:', error);
      throw error;
    }
  }

  /**
   * Generate agent configuration from requirements
   */
  async generateAgentConfig(requirements, options = {}) {
    const agentName = options.name || AgentBuilderHelpers.generateAgentName(requirements.actions.join(' '));
    const agentType = options.llmType || AgentBuilderHelpers.determineAgentType(requirements);
    const deliverables = AgentBuilderHelpers.generateDeliverables(requirements, agentType);
    
    // Generate comprehensive instructions based on requirements
    const instructions = this.generateInstructions(requirements, agentType);
    
    // Create agent configuration
    const config = {
      name: agentName,
      llmType: agentType,
      deliverables,
      instructions,
      
      // Metadata
      created: new Date().toISOString(),
      version: '1.0.0',
      requirements: requirements,
      capabilities: this.inferCapabilities(requirements),
      
      // Integration settings
      dependencies: this.identifyDependencies(requirements),
      triggers: this.processTriggers(requirements.triggers),
      schedule: this.parseSchedule(requirements.frequency),
      
      // Performance settings
      timeout: options.timeout || 300000, // 5 minutes default
      retryCount: options.retryCount || 3,
      priority: options.priority || 'medium',
      
      // Resource limits
      maxConcurrency: options.maxConcurrency || 1,
      memoryLimit: options.memoryLimit || '512MB',
      
      // Security settings
      permissions: options.permissions || ['read', 'write'],
      securityLevel: options.securityLevel || 'standard'
    };

    return config;
  }

  /**
   * Generate detailed instructions for the agent
   */
  generateInstructions(requirements, agentType) {
    const baseInstructions = agentType === 'thinking' 
      ? this.generateThinkingAgentInstructions(requirements)
      : this.generateFastAgentInstructions(requirements);
    
    const contextualInstructions = this.addContextualInstructions(requirements);
    const errorHandlingInstructions = this.addErrorHandlingInstructions();
    const integrationInstructions = this.addIntegrationInstructions(requirements);
    
    return [
      baseInstructions,
      contextualInstructions,
      errorHandlingInstructions,
      integrationInstructions
    ].join('\n\n');
  }

  generateThinkingAgentInstructions(requirements) {
    return `You are a specialized thinking agent designed to ${requirements.actions.join(', ')}.

STRATEGIC APPROACH:
- Analyze situations thoroughly before taking action
- Consider multiple perspectives and potential outcomes
- Make data-driven decisions with clear reasoning
- Document your thought process for future reference

CORE RESPONSIBILITIES:
${requirements.actions.map(action => `- ${action.charAt(0).toUpperCase() + action.slice(1)}`).join('\n')}

DECISION FRAMEWORK:
1. Gather and validate all relevant information
2. Identify key stakeholders and impact areas
3. Evaluate options against success criteria
4. Select optimal approach with risk mitigation
5. Document decisions and rationale

OUTPUT STANDARDS:
- Provide detailed analysis and recommendations
- Include confidence levels for key decisions
- Document assumptions and limitations
- Create actionable implementation plans`;
  }

  generateFastAgentInstructions(requirements) {
    return `You are a specialized execution agent designed to ${requirements.actions.join(', ')}.

EXECUTION APPROACH:
- Act quickly and efficiently on clear instructions
- Follow established procedures and best practices
- Handle routine tasks with minimal oversight
- Escalate complex decisions to thinking agents

CORE RESPONSIBILITIES:
${requirements.actions.map(action => `- ${action.charAt(0).toUpperCase() + action.slice(1)}`).join('\n')}

EXECUTION FRAMEWORK:
1. Validate inputs and prerequisites
2. Execute tasks following established procedures
3. Monitor progress and handle errors gracefully
4. Report results and status updates
5. Clean up resources and complete logging

PERFORMANCE STANDARDS:
- Optimize for speed and efficiency
- Maintain high accuracy and reliability
- Handle errors gracefully with proper logging
- Provide clear status updates and results`;
  }

  addContextualInstructions(requirements) {
    let context = 'CONTEXTUAL GUIDELINES:\n';
    
    if (requirements.triggers.length > 0) {
      context += `- Respond to triggers: ${requirements.triggers.join(', ')}\n`;
    }
    
    if (requirements.frequency) {
      context += `- Execute on schedule: ${requirements.frequency}\n`;
    }
    
    if (requirements.outputs.length > 0) {
      context += `- Generate outputs: ${requirements.outputs.join(', ')}\n`;
    }
    
    context += '- Integrate seamlessly with existing Debo agents\n';
    context += '- Follow Fortune 500 enterprise standards\n';
    context += '- Maintain audit trails for all actions';
    
    return context;
  }

  addErrorHandlingInstructions() {
    return `ERROR HANDLING:
- Log all errors with detailed context and stack traces
- Implement exponential backoff for retry scenarios
- Escalate persistent failures to human operators
- Maintain system stability during error conditions
- Clean up partial work on failure scenarios
- Provide clear error messages for debugging`;
  }

  addIntegrationInstructions(requirements) {
    return `INTEGRATION REQUIREMENTS:
- Store all deliverables in Redis using established patterns
- Update task status in real-time during execution
- Coordinate with other agents through the orchestrator
- Follow database schema patterns for consistent data storage
- Emit events for important state changes
- Support graceful shutdown and resource cleanup`;
  }

  /**
   * Infer capabilities from requirements
   */
  inferCapabilities(requirements) {
    const capabilities = new Set();
    
    // Analyze actions for capabilities
    requirements.actions.forEach(action => {
      if (action.includes('monitor') || action.includes('watch')) {
        capabilities.add('monitoring');
      }
      if (action.includes('analyze') || action.includes('process')) {
        capabilities.add('analysis');
      }
      if (action.includes('send') || action.includes('notify')) {
        capabilities.add('communication');
      }
      if (action.includes('data') || action.includes('information')) {
        capabilities.add('data_processing');
      }
      if (action.includes('api') || action.includes('service')) {
        capabilities.add('integration');
      }
    });
    
    // Analyze triggers for capabilities
    if (requirements.triggers.length > 0) {
      capabilities.add('event_driven');
    }
    
    // Analyze frequency for capabilities
    if (requirements.frequency) {
      capabilities.add('scheduled');
    }
    
    // Default capabilities
    capabilities.add('error_handling');
    capabilities.add('logging');
    capabilities.add('state_management');
    
    return Array.from(capabilities);
  }

  /**
   * Identify dependencies with other agents
   */
  identifyDependencies(requirements) {
    const dependencies = [];
    
    // Check if agent needs to interact with existing roles
    const text = JSON.stringify(requirements).toLowerCase();
    
    Object.keys(agentConfig).forEach(role => {
      const roleConfig = agentConfig[role];
      
      // Check if this agent's outputs match another agent's inputs
      if (roleConfig.deliverables && roleConfig.deliverables.outputs) {
        const hasMatchingInput = roleConfig.deliverables.outputs.some(output => 
          text.includes(output.replace(/_/g, ' '))
        );
        
        if (hasMatchingInput) {
          dependencies.push({
            agent: role,
            type: 'input_dependency',
            description: `Requires outputs from ${role}`
          });
        }
      }
      
      // Check if this agent's inputs match another agent's outputs
      if (requirements.outputs.length > 0) {
        const providesOutput = requirements.outputs.some(output =>
          roleConfig.deliverables && 
          roleConfig.deliverables.database &&
          roleConfig.deliverables.database.some(db => 
            db.includes(output.replace(/\s+/g, '_'))
          )
        );
        
        if (providesOutput) {
          dependencies.push({
            agent: role,
            type: 'output_dependency', 
            description: `Provides inputs to ${role}`
          });
        }
      }
    });
    
    return dependencies;
  }

  /**
   * Process triggers into executable format
   */
  processTriggers(triggers) {
    return triggers.map(trigger => {
      // Parse different trigger types
      if (trigger.includes('file') || trigger.includes('document')) {
        return {
          type: 'file_event',
          pattern: this.extractFilePattern(trigger),
          event: this.extractFileEvent(trigger)
        };
      } else if (trigger.includes('time') || trigger.includes('schedule')) {
        return {
          type: 'time_event',
          schedule: this.extractSchedule(trigger)
        };
      } else if (trigger.includes('api') || trigger.includes('webhook')) {
        return {
          type: 'api_event',
          endpoint: this.extractEndpoint(trigger)
        };
      } else {
        return {
          type: 'custom_event',
          condition: trigger
        };
      }
    });
  }

  /**
   * Parse schedule from frequency string
   */
  parseSchedule(frequency) {
    if (!frequency) return null;
    
    const patterns = {
      minutes: /(\d+)\s*minute/i,
      hours: /(\d+)\s*hour/i,
      days: /(\d+)\s*day/i,
      weeks: /(\d+)\s*week/i
    };
    
    for (const [unit, pattern] of Object.entries(patterns)) {
      const match = frequency.match(pattern);
      if (match) {
        return {
          interval: parseInt(match[1]),
          unit: unit,
          cron: this.generateCronExpression(parseInt(match[1]), unit)
        };
      }
    }
    
    return { raw: frequency };
  }

  generateCronExpression(interval, unit) {
    switch (unit) {
      case 'minutes': return `*/${interval} * * * *`;
      case 'hours': return `0 */${interval} * * *`;
      case 'days': return `0 0 */${interval} * *`;
      case 'weeks': return `0 0 * * ${interval === 1 ? '0' : `*/${interval}`}`;
      default: return null;
    }
  }

  /**
   * Register agent in the system
   */
  async registerAgent(config) {
    const agentId = uuidv4();
    
    // Store in local registry
    this.agentRegistry.set(agentId, config);
    this.createdAgents.set(config.name, agentId);
    
    // Version tracking
    this.agentVersions.set(agentId, {
      current: config.version,
      history: [{ version: config.version, created: config.created }]
    });
    
    return agentId;
  }

  /**
   * Persist agent to database
   */
  async persistAgent(agentId, config) {
    const key = `dynamic_agent:${agentId}`;
    await this.taskManager.setData(key, JSON.stringify(config));
    
    // Add to agent index
    await this.taskManager.sadd('dynamic_agents_index', agentId);
    
    // Store by name for quick lookup
    await this.taskManager.setData(`agent_name:${config.name}`, agentId);
  }

  /**
   * Load existing dynamic agents from database
   */
  async loadExistingAgents() {
    try {
      const agentIds = await this.taskManager.smembers('dynamic_agents_index');
      
      for (const agentId of agentIds) {
        const configData = await this.taskManager.getData(`dynamic_agent:${agentId}`);
        if (configData) {
          const config = JSON.parse(configData);
          this.agentRegistry.set(agentId, config);
          this.createdAgents.set(config.name, agentId);
        }
      }
      
      logger.info(`Loaded ${agentIds.length} dynamic agents from database`);
    } catch (error) {
      logger.error('Failed to load existing agents:', error);
    }
  }

  /**
   * Get agent by name or ID
   */
  async getAgent(identifier) {
    // Try as agent ID first
    if (this.agentRegistry.has(identifier)) {
      return {
        id: identifier,
        config: this.agentRegistry.get(identifier)
      };
    }
    
    // Try as agent name
    const agentId = this.createdAgents.get(identifier);
    if (agentId) {
      return {
        id: agentId,
        config: this.agentRegistry.get(agentId)
      };
    }
    
    return null;
  }

  /**
   * Update existing agent
   */
  async updateAgent(identifier, updates) {
    const agent = await this.getAgent(identifier);
    if (!agent) {
      throw new Error(`Agent not found: ${identifier}`);
    }
    
    const updatedConfig = { ...agent.config, ...updates };
    updatedConfig.version = this.incrementVersion(agent.config.version);
    updatedConfig.updated = new Date().toISOString();
    
    // Validate updated configuration
    const validationErrors = AgentBuilderHelpers.validateAgentConfig(updatedConfig);
    if (validationErrors.length > 0) {
      throw new Error(`Agent validation failed: ${validationErrors.join(', ')}`);
    }
    
    // Update registry
    this.agentRegistry.set(agent.id, updatedConfig);
    
    // Update version history
    const versionInfo = this.agentVersions.get(agent.id);
    versionInfo.current = updatedConfig.version;
    versionInfo.history.push({
      version: updatedConfig.version,
      updated: updatedConfig.updated,
      changes: Object.keys(updates)
    });
    
    // Persist changes
    await this.persistAgent(agent.id, updatedConfig);
    
    return {
      id: agent.id,
      config: updatedConfig,
      status: 'updated'
    };
  }

  /**
   * Delete agent
   */
  async deleteAgent(identifier) {
    const agent = await this.getAgent(identifier);
    if (!agent) {
      throw new Error(`Agent not found: ${identifier}`);
    }
    
    // Remove from registries
    this.agentRegistry.delete(agent.id);
    this.createdAgents.delete(agent.config.name);
    this.agentVersions.delete(agent.id);
    
    // Remove from database
    await this.taskManager.del(`dynamic_agent:${agent.id}`);
    await this.taskManager.del(`agent_name:${agent.config.name}`);
    await this.taskManager.srem('dynamic_agents_index', agent.id);
    
    return { id: agent.id, status: 'deleted' };
  }

  /**
   * List all dynamic agents
   */
  listAgents() {
    return Array.from(this.agentRegistry.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      type: config.llmType,
      version: config.version,
      created: config.created,
      capabilities: config.capabilities,
      status: 'active'
    }));
  }

  /**
   * Analyze agent capabilities
   */
  analyzeCapabilities(config) {
    return {
      type: config.llmType,
      capabilities: config.capabilities,
      deliverables: Object.keys(config.deliverables).reduce((acc, key) => {
        acc[key] = config.deliverables[key].length;
        return acc;
      }, {}),
      dependencies: config.dependencies.length,
      triggers: config.triggers.length,
      hasSchedule: !!config.schedule
    };
  }

  // Helper methods
  extractFilePattern(trigger) {
    const match = trigger.match(/file[s]?\s+.*?([^\s]+\.[^\s]+)/i);
    return match ? match[1] : '*';
  }

  extractFileEvent(trigger) {
    if (trigger.includes('create') || trigger.includes('new')) return 'created';
    if (trigger.includes('update') || trigger.includes('change')) return 'modified';
    if (trigger.includes('delete') || trigger.includes('remove')) return 'deleted';
    return 'any';
  }

  extractSchedule(trigger) {
    const match = trigger.match(/(\d+:\d+)/);
    return match ? match[1] : null;
  }

  extractEndpoint(trigger) {
    const match = trigger.match(/(\/[\w\/\-]+)/);
    return match ? match[1] : '/webhook';
  }

  incrementVersion(version) {
    const parts = version.split('.');
    parts[2] = (parseInt(parts[2]) + 1).toString();
    return parts.join('.');
  }
}