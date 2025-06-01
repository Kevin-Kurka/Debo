/**
 * Dynamic Agent Manager
 * 
 * PURPOSE:
 * Enables runtime creation of specialized agents for any domain or task.
 * Manages agent templates, behaviors, and custom data schemas.
 * 
 * FEATURES:
 * - Dynamic agent registration and creation
 * - Custom agent behaviors and prompts
 * - Domain-specific knowledge integration
 * - Flexible data schema management
 * - Agent discovery and matching
 * 
 * TECHNICAL DETAILS:
 * - Stores agent definitions in Redis
 * - Supports custom LLM configurations per agent
 * - Enables agent-specific tools and capabilities
 * - Tracks agent performance and usage
 * 
 * TODO:
 * - Add agent versioning support
 * - Implement agent sharing/export functionality
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class DynamicAgentManager {
  constructor(taskManager, llmProvider) {
    this.taskManager = taskManager;
    this.llmProvider = llmProvider;
    this.redis = taskManager.redis;
    this.agentRegistry = new Map(); // Local cache
  }

  /**
   * Initialize the dynamic agent system
   */
  async init() {
    // Load existing dynamic agents from Redis
    await this.loadDynamicAgents();
    
    // Register default agent templates
    await this.registerDefaultTemplates();
    
    logger.info('Dynamic Agent Manager initialized');
  }

  /**
   * Register a new agent type dynamically
   */
  async registerAgent(agentDefinition) {
    const {
      name,
      domain,
      description,
      llmType = 'thinking',
      capabilities = [],
      knowledgeBase = {},
      dataSchema = {},
      prompts = {},
      tools = [],
      examples = []
    } = agentDefinition;

    const agentId = `${domain}_${name.toLowerCase().replace(/\s+/g, '_')}`;
    
    const agent = {
      id: agentId,
      name,
      domain,
      description,
      llmType,
      capabilities,
      knowledgeBase,
      dataSchema,
      prompts: {
        system: prompts.system || this.generateSystemPrompt(name, domain, capabilities),
        taskAnalysis: prompts.taskAnalysis || this.generateTaskAnalysisPrompt(domain),
        execution: prompts.execution || this.generateExecutionPrompt(domain),
        validation: prompts.validation || this.generateValidationPrompt(domain)
      },
      tools,
      examples,
      createdAt: new Date().toISOString(),
      usage: {
        totalTasks: 0,
        successfulTasks: 0,
        averageConfidence: 0
      }
    };

    // Store in Redis
    await this.redis.hSet(`dynamic_agent:${agentId}`, {
      definition: JSON.stringify(agent),
      active: 'true'
    });

    // Update local cache
    this.agentRegistry.set(agentId, agent);

    // Register data schema if provided
    if (Object.keys(dataSchema).length > 0) {
      await this.registerDataSchema(agentId, dataSchema);
    }

    logger.info(`Registered dynamic agent: ${agentId}`);
    return agent;
  }

  /**
   * Create specialized agent through user dialogue
   */
  async createAgentThroughDialogue(initialRequest) {
    const dialogue = {
      id: uuidv4(),
      stage: 'understanding',
      context: {
        request: initialRequest,
        domain: null,
        capabilities: [],
        dataNeeds: [],
        examples: []
      }
    };

    // Store dialogue state
    await this.redis.hSet(`agent_dialogue:${dialogue.id}`, {
      state: JSON.stringify(dialogue),
      timestamp: new Date().toISOString()
    });

    return {
      dialogueId: dialogue.id,
      nextStep: 'clarify_domain',
      questions: [
        "What domain or field is this agent for? (e.g., legal, scientific, medical, educational)",
        "What specific tasks should this agent handle?",
        "Can you provide an example of a typical request this agent would process?"
      ],
      message: "I'll help you create a specialized agent. Let's start by understanding what you need."
    };
  }

  /**
   * Continue agent creation dialogue
   */
  async continueAgentDialogue(dialogueId, userResponse) {
    const dialogueData = await this.redis.hGet(`agent_dialogue:${dialogueId}`, 'state');
    const dialogue = JSON.parse(dialogueData);

    switch (dialogue.stage) {
      case 'understanding':
        return await this.processDomainUnderstanding(dialogue, userResponse);
      
      case 'capabilities':
        return await this.processCapabilities(dialogue, userResponse);
      
      case 'data_schema':
        return await this.processDataSchema(dialogue, userResponse);
      
      case 'examples':
        return await this.processExamples(dialogue, userResponse);
      
      case 'confirmation':
        return await this.confirmAndCreateAgent(dialogue, userResponse);
      
      default:
        throw new Error('Unknown dialogue stage');
    }
  }

  /**
   * Match task to appropriate dynamic agent
   */
  async matchTaskToAgent(taskDescription, domain = null) {
    const agents = Array.from(this.agentRegistry.values());
    
    // Filter by domain if specified
    const candidateAgents = domain 
      ? agents.filter(a => a.domain === domain)
      : agents;

    if (candidateAgents.length === 0) {
      return null;
    }

    // Score each agent based on capability match
    const scores = await Promise.all(
      candidateAgents.map(async (agent) => {
        const score = await this.scoreAgentMatch(agent, taskDescription);
        return { agent, score };
      })
    );

    // Return best matching agent
    const bestMatch = scores.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    return bestMatch.score > 0.7 ? bestMatch.agent : null;
  }

  /**
   * Execute task with dynamic agent
   */
  async executeWithDynamicAgent(agentId, task) {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Dynamic agent not found: ${agentId}`);
    }

    logger.info(`Executing task with dynamic agent: ${agentId}`);

    // Prepare agent context
    const context = {
      agent,
      task,
      knowledgeBase: agent.knowledgeBase,
      examples: agent.examples,
      dataSchema: await this.getDataSchema(agentId)
    };

    // Execute through LLM with agent-specific prompts
    const result = await this.llmProvider.generateResponse(
      agent.prompts.system,
      this.buildExecutionPrompt(agent, task),
      {
        temperature: agent.llmType === 'thinking' ? 0.3 : 0.1,
        maxTokens: 4000
      }
    );

    // Store execution result with agent-specific data
    await this.storeAgentExecution(agentId, task.id, result);

    // Update agent usage statistics
    await this.updateAgentStats(agentId, result);

    return result;
  }

  /**
   * Register data schema for agent
   */
  async registerDataSchema(agentId, schema) {
    await this.redis.hSet(`agent_schema:${agentId}`, {
      schema: JSON.stringify(schema),
      version: '1.0',
      createdAt: new Date().toISOString()
    });

    // Create indexes for efficient querying
    for (const [entityName, entitySchema] of Object.entries(schema)) {
      await this.redis.sAdd(`agent_entities:${agentId}`, entityName);
    }
  }

  /**
   * Store data using agent-specific schema
   */
  async storeAgentData(agentId, entityType, data) {
    const schema = await this.getDataSchema(agentId);
    const entitySchema = schema[entityType];
    
    if (!entitySchema) {
      throw new Error(`Unknown entity type for agent ${agentId}: ${entityType}`);
    }

    // Validate data against schema
    const validatedData = this.validateAgainstSchema(data, entitySchema);

    // Store with agent-specific key pattern
    const id = data.id || uuidv4();
    const key = `agent_data:${agentId}:${entityType}:${id}`;
    
    await this.redis.hSet(key, {
      ...this.flattenObject(validatedData),
      _metadata: JSON.stringify({
        agentId,
        entityType,
        createdAt: new Date().toISOString(),
        version: '1.0'
      })
    });

    // Update indexes
    await this.redis.sAdd(`agent_data_index:${agentId}:${entityType}`, id);

    return { id, key };
  }

  /**
   * Query agent-specific data
   */
  async queryAgentData(agentId, entityType, query = {}) {
    const indexKey = `agent_data_index:${agentId}:${entityType}`;
    const ids = await this.redis.sMembers(indexKey);
    
    const results = [];
    for (const id of ids) {
      const key = `agent_data:${agentId}:${entityType}:${id}`;
      const data = await this.redis.hGetAll(key);
      
      // Apply query filters
      if (this.matchesQuery(data, query)) {
        results.push(this.unflattenObject(data));
      }
    }

    return results;
  }

  /**
   * Generate system prompt for agent
   */
  generateSystemPrompt(name, domain, capabilities) {
    return `You are ${name}, a specialized AI agent in the ${domain} domain.

Your expertise includes:
${capabilities.map(cap => `- ${cap}`).join('\n')}

You provide accurate, detailed, and domain-specific assistance while maintaining professional standards and best practices in the ${domain} field.

Always:
1. Use appropriate ${domain} terminology and conventions
2. Cite relevant regulations, standards, or authorities when applicable
3. Provide structured, actionable responses
4. Flag any uncertainties or areas requiring human expert review
5. Maintain confidentiality and ethical standards`;
  }

  /**
   * Load dynamic agents from Redis
   */
  async loadDynamicAgents() {
    const agentKeys = await this.redis.keys('dynamic_agent:*');
    
    for (const key of agentKeys) {
      const agentData = await this.redis.hGet(key, 'definition');
      if (agentData) {
        const agent = JSON.parse(agentData);
        this.agentRegistry.set(agent.id, agent);
      }
    }
    
    logger.info(`Loaded ${this.agentRegistry.size} dynamic agents`);
  }

  /**
   * Register default agent templates
   */
  async registerDefaultTemplates() {
    const templates = [
      {
        name: 'Legal Discovery Specialist',
        domain: 'legal',
        description: 'Handles federal court discovery procedures and document analysis',
        capabilities: [
          'Federal Rules of Civil Procedure expertise',
          'Document request drafting',
          'Privilege log creation',
          'Discovery timeline management',
          'Interrogatory drafting and response'
        ],
        dataSchema: {
          case: {
            caseNumber: 'string',
            court: 'string',
            parties: 'array',
            discoveryDeadlines: 'object',
            documents: 'array'
          },
          discoveryRequest: {
            type: 'string',
            requestingParty: 'string',
            respondingParty: 'string',
            dueDate: 'date',
            items: 'array'
          }
        }
      },
      {
        name: 'Scientific Method Advisor',
        domain: 'scientific',
        description: 'Guides through scientific research and experimental design',
        capabilities: [
          'Hypothesis formulation',
          'Experimental design',
          'Statistical analysis planning',
          'Literature review assistance',
          'Research methodology guidance'
        ],
        dataSchema: {
          experiment: {
            hypothesis: 'string',
            methodology: 'object',
            variables: 'object',
            controls: 'array',
            expectedOutcomes: 'array'
          },
          dataPoint: {
            experimentId: 'string',
            timestamp: 'date',
            measurements: 'object',
            conditions: 'object',
            notes: 'string'
          }
        }
      },
      {
        name: 'Medical Diagnosis Assistant',
        domain: 'medical',
        description: 'Assists with medical diagnosis workflows and patient data management',
        capabilities: [
          'Symptom analysis',
          'Differential diagnosis generation',
          'Medical history organization',
          'Lab result interpretation guidance',
          'Treatment option research'
        ],
        dataSchema: {
          patient: {
            patientId: 'string',
            demographics: 'object',
            medicalHistory: 'array',
            currentMedications: 'array',
            allergies: 'array'
          },
          consultation: {
            patientId: 'string',
            symptoms: 'array',
            vitalSigns: 'object',
            differentialDiagnosis: 'array',
            recommendedTests: 'array'
          }
        }
      }
    ];

    // Register templates if they don't exist
    for (const template of templates) {
      const agentId = `${template.domain}_${template.name.toLowerCase().replace(/\s+/g, '_')}`;
      const exists = await this.redis.exists(`dynamic_agent:${agentId}`);
      
      if (!exists) {
        await this.registerAgent(template);
      }
    }
  }

  /**
   * Helper methods
   */
  
  flattenObject(obj, prefix = '') {
    const flattened = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value === null || value === undefined) {
        flattened[newKey] = '';
      } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = JSON.stringify(value);
      } else {
        flattened[newKey] = String(value);
      }
    }
    
    return flattened;
  }

  unflattenObject(flattened) {
    const unflattened = {};
    
    for (const [key, value] of Object.entries(flattened)) {
      const parts = key.split('.');
      let current = unflattened;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        current[part] = current[part] || {};
        current = current[part];
      }
      
      const lastPart = parts[parts.length - 1];
      
      try {
        current[lastPart] = JSON.parse(value);
      } catch {
        current[lastPart] = value;
      }
    }
    
    return unflattened;
  }

  matchesQuery(data, query) {
    for (const [field, expectedValue] of Object.entries(query)) {
      if (data[field] !== String(expectedValue)) {
        return false;
      }
    }
    return true;
  }

  validateAgainstSchema(data, schema) {
    // Simple validation - can be enhanced
    const validated = {};
    
    for (const [field, type] of Object.entries(schema)) {
      if (data[field] !== undefined) {
        validated[field] = data[field];
      }
    }
    
    return validated;
  }

  async scoreAgentMatch(agent, taskDescription) {
    // Simple keyword matching - can be enhanced with embeddings
    const keywords = taskDescription.toLowerCase().split(/\s+/);
    const agentText = [
      agent.name,
      agent.description,
      ...agent.capabilities
    ].join(' ').toLowerCase();
    
    let matches = 0;
    for (const keyword of keywords) {
      if (agentText.includes(keyword)) {
        matches++;
      }
    }
    
    return matches / keywords.length;
  }

  buildExecutionPrompt(agent, task) {
    return `${agent.prompts.execution}

Task: ${task.description}

Context:
${JSON.stringify(task.context, null, 2)}

Please provide a detailed response following the standards and practices of the ${agent.domain} domain.`;
  }

  async processDomainUnderstanding(dialogue, response) {
    // Update dialogue context
    dialogue.context.domain = this.extractDomain(response);
    dialogue.context.initialTasks = this.extractTasks(response);
    dialogue.stage = 'capabilities';
    
    await this.updateDialogue(dialogue);
    
    return {
      dialogueId: dialogue.id,
      nextStep: 'define_capabilities',
      questions: [
        `For a ${dialogue.context.domain} agent, what specific expertise should it have?`,
        "What kind of data or information will this agent need to track?",
        "Are there specific formats, standards, or regulations it should follow?"
      ],
      context: dialogue.context
    };
  }

  async processCapabilities(dialogue, response) {
    dialogue.context.capabilities = this.extractCapabilities(response);
    dialogue.stage = 'data_schema';
    
    await this.updateDialogue(dialogue);
    
    return {
      dialogueId: dialogue.id,
      nextStep: 'define_data_structure',
      questions: [
        "What types of data entities will this agent work with?",
        "What fields or properties should each entity have?",
        "How should these entities relate to each other?"
      ],
      suggestedSchema: this.suggestDataSchema(dialogue.context)
    };
  }

  async processDataSchema(dialogue, response) {
    dialogue.context.dataSchema = this.extractDataSchema(response);
    dialogue.stage = 'examples';
    
    await this.updateDialogue(dialogue);
    
    return {
      dialogueId: dialogue.id,
      nextStep: 'provide_examples',
      questions: [
        "Can you provide 2-3 example requests this agent should handle?",
        "What would be the expected output for these requests?"
      ]
    };
  }

  async processExamples(dialogue, response) {
    dialogue.context.examples = this.extractExamples(response);
    dialogue.stage = 'confirmation';
    
    await this.updateDialogue(dialogue);
    
    // Generate agent definition
    const agentDefinition = {
      name: `${dialogue.context.domain} Specialist`,
      domain: dialogue.context.domain,
      description: `Specialized agent for ${dialogue.context.domain} tasks`,
      capabilities: dialogue.context.capabilities,
      dataSchema: dialogue.context.dataSchema,
      examples: dialogue.context.examples
    };
    
    return {
      dialogueId: dialogue.id,
      nextStep: 'confirm_creation',
      agentDefinition,
      message: "Here's the agent I'll create based on our conversation. Should I proceed?"
    };
  }

  async confirmAndCreateAgent(dialogue, response) {
    if (response.toLowerCase().includes('yes') || response.toLowerCase().includes('proceed')) {
      const agentDefinition = dialogue.context.agentDefinition;
      const agent = await this.registerAgent(agentDefinition);
      
      return {
        success: true,
        agent,
        message: `Successfully created ${agent.name}! You can now use this agent for ${agent.domain} tasks.`
      };
    } else {
      return {
        success: false,
        message: "Agent creation cancelled. Let me know if you'd like to try again with different specifications."
      };
    }
  }

  async updateDialogue(dialogue) {
    await this.redis.hSet(`agent_dialogue:${dialogue.id}`, {
      state: JSON.stringify(dialogue),
      timestamp: new Date().toISOString()
    });
  }

  extractDomain(response) {
    // Simple extraction - can be enhanced with NLP
    const domains = ['legal', 'scientific', 'medical', 'educational', 'financial', 'engineering'];
    const lower = response.toLowerCase();
    
    for (const domain of domains) {
      if (lower.includes(domain)) {
        return domain;
      }
    }
    
    return 'general';
  }

  extractTasks(response) {
    // Extract task descriptions from response
    const lines = response.split('\n');
    return lines.filter(line => line.trim().length > 10).slice(0, 5);
  }

  extractCapabilities(response) {
    // Extract capabilities from response
    const lines = response.split('\n');
    return lines
      .filter(line => line.trim().length > 5)
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 10);
  }

  extractDataSchema(response) {
    // Simple schema extraction - can be enhanced
    const schema = {};
    const entities = response.match(/\b(\w+):\s*{([^}]+)}/g) || [];
    
    for (const entity of entities) {
      const [name, fields] = entity.split(':');
      schema[name.trim()] = this.parseFields(fields);
    }
    
    return schema;
  }

  parseFields(fieldsStr) {
    const fields = {};
    const fieldMatches = fieldsStr.match(/(\w+):\s*(\w+)/g) || [];
    
    for (const match of fieldMatches) {
      const [field, type] = match.split(':').map(s => s.trim());
      fields[field] = type;
    }
    
    return fields;
  }

  extractExamples(response) {
    // Extract examples from response
    const examples = [];
    const exampleBlocks = response.split(/example\s*\d*:?/i);
    
    for (const block of exampleBlocks.slice(1)) {
      if (block.trim()) {
        examples.push({
          request: block.split('\n')[0].trim(),
          expectedOutput: block.split('\n').slice(1).join('\n').trim()
        });
      }
    }
    
    return examples;
  }

  suggestDataSchema(context) {
    // Suggest schema based on domain
    const domainSchemas = {
      legal: {
        case: { id: 'string', title: 'string', status: 'string' },
        document: { id: 'string', type: 'string', content: 'text' }
      },
      scientific: {
        experiment: { id: 'string', hypothesis: 'string', status: 'string' },
        data: { id: 'string', experimentId: 'string', values: 'object' }
      },
      medical: {
        patient: { id: 'string', name: 'string', history: 'array' },
        diagnosis: { id: 'string', patientId: 'string', findings: 'array' }
      }
    };
    
    return domainSchemas[context.domain] || {};
  }

  async storeAgentExecution(agentId, taskId, result) {
    const key = `agent_execution:${agentId}:${taskId}`;
    await this.redis.hSet(key, {
      agentId,
      taskId,
      result: JSON.stringify(result),
      timestamp: new Date().toISOString()
    });
  }

  async updateAgentStats(agentId, result) {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) return;
    
    agent.usage.totalTasks++;
    if (result.success) {
      agent.usage.successfulTasks++;
    }
    
    // Update in Redis
    await this.redis.hSet(`dynamic_agent:${agentId}`, {
      definition: JSON.stringify(agent)
    });
  }

  async getDataSchema(agentId) {
    const schemaData = await this.redis.hGet(`agent_schema:${agentId}`, 'schema');
    return schemaData ? JSON.parse(schemaData) : {};
  }
}

export default DynamicAgentManager;