/**
 * Generic Orchestrator for Debo
 * 
 * PURPOSE:
 * Extends the unified orchestrator to support dynamic agent creation and
 * generic task handling beyond just software development.
 * 
 * FEATURES:
 * - Dynamic agent creation and management
 * - Domain-agnostic task processing
 * - Interactive requirement clarification
 * - Custom data schema support
 * - RAG integration for knowledge management
 * 
 * TECHNICAL DETAILS:
 * - Inherits from UnifiedOrchestrator
 * - Integrates DynamicAgentManager
 * - Supports conversational agent creation
 * - Enables custom workflow definitions
 * 
 * TODO:
 * - Add multi-modal agent support
 * - Implement agent collaboration patterns
 */

import { UnifiedOrchestrator } from './unified-orchestrator.js';
import { DynamicAgentManager } from '../agents/dynamic-agent-manager.js';
import { EnhancedAgentExecutor } from '../agents/enhanced-executor.js';
import { DocumentationRAGManager } from '../database/documentation-rag-manager.js';
import logger from '../logger.js';
import { v4 as uuidv4 } from 'uuid';

export class GenericOrchestrator extends UnifiedOrchestrator {
  constructor(taskManager, llmProvider, websocketServer = null) {
    super(taskManager, llmProvider, websocketServer);
    
    // Replace the basic executor with enhanced executor
    this.agentExecutor = new EnhancedAgentExecutor(taskManager);
    
    // Initialize dynamic agent manager
    this.dynamicAgentManager = new DynamicAgentManager(taskManager, llmProvider);
    
    // Initialize RAG for knowledge management
    this.ragManager = new DocumentationRAGManager(taskManager);
    
    // Track active dialogues
    this.activeDialogues = new Map();
  }

  async init() {
    await super.init();
    await this.dynamicAgentManager.init();
    await this.ragManager.init();
    await this.agentExecutor.init();
    
    logger.info('Generic Orchestrator initialized with dynamic agent support');
  }

  /**
   * Process any type of request - not just coding
   */
  async processGenericRequest(request, context = {}) {
    const requestId = uuidv4();
    
    logger.info(`Processing generic request: ${requestId}`);
    
    // Analyze request to determine handling strategy
    const analysis = await this.analyzeRequest(request, context);
    
    switch (analysis.type) {
      case 'software_development':
        // Use existing software development flow
        return await this.handleSoftwareRequest(analysis, context);
        
      case 'agent_creation':
        // User wants to create a new type of agent
        return await this.handleAgentCreation(analysis, context);
        
      case 'specialized_task':
        // Task for an existing or new specialized agent
        return await this.handleSpecializedTask(analysis, context);
        
      case 'clarification_needed':
        // Need more information from user
        return await this.handleClarificationRequest(analysis, context);
        
      case 'knowledge_query':
        // Query existing knowledge base
        return await this.handleKnowledgeQuery(analysis, context);
        
      default:
        // General request
        return await this.handleGeneralRequest(analysis, context);
    }
  }

  /**
   * Analyze request to determine type and requirements
   */
  async analyzeRequest(request, context) {
    const ctoAnalysis = await this.llmProvider.generateResponse(
      `You are the CTO of a highly flexible AI agency that can create specialized agents for any domain.
       Analyze this request and determine:
       1. Type: software_development, agent_creation, specialized_task, clarification_needed, knowledge_query, or general
       2. Domain: (e.g., legal, medical, scientific, educational, business, etc.)
       3. Required capabilities
       4. Whether existing agents can handle it
       5. What clarifications might be needed`,
      
      `Request: ${request}
       Context: ${JSON.stringify(context)}
       
       Provide structured analysis.`,
      
      { temperature: 0.3 }
    );

    return this.parseAnalysis(ctoAnalysis);
  }

  /**
   * Handle agent creation requests
   */
  async handleAgentCreation(analysis, context) {
    const dialogue = await this.dynamicAgentManager.createAgentThroughDialogue(
      analysis.request
    );
    
    // Store dialogue reference
    this.activeDialogues.set(dialogue.dialogueId, {
      type: 'agent_creation',
      startTime: Date.now(),
      context
    });
    
    return {
      type: 'dialogue',
      dialogueId: dialogue.dialogueId,
      stage: dialogue.nextStep,
      questions: dialogue.questions,
      message: dialogue.message,
      requiresResponse: true
    };
  }

  /**
   * Continue an active dialogue
   */
  async continueDialogue(dialogueId, userResponse) {
    const dialogueInfo = this.activeDialogues.get(dialogueId);
    
    if (!dialogueInfo) {
      throw new Error('Dialogue not found or expired');
    }
    
    switch (dialogueInfo.type) {
      case 'agent_creation':
        return await this.dynamicAgentManager.continueAgentDialogue(
          dialogueId,
          userResponse
        );
        
      case 'requirement_clarification':
        return await this.continueRequirementClarification(
          dialogueId,
          userResponse
        );
        
      default:
        throw new Error('Unknown dialogue type');
    }
  }

  /**
   * Handle specialized tasks with dynamic agents
   */
  async handleSpecializedTask(analysis, context) {
    const { domain, requirements } = analysis;
    
    // Try to find matching dynamic agent
    let agent = await this.dynamicAgentManager.matchTaskToAgent(
      requirements,
      domain
    );
    
    if (!agent) {
      // No matching agent, offer to create one
      return {
        type: 'agent_needed',
        message: `I don't have a specialized agent for ${domain} tasks yet. Would you like me to create one?`,
        suggestedAgent: {
          domain,
          capabilities: analysis.requiredCapabilities,
          name: `${domain} Specialist`
        },
        requiresResponse: true
      };
    }
    
    // Execute task with dynamic agent
    const taskId = uuidv4();
    const task = {
      id: taskId,
      type: 'specialized',
      domain,
      description: requirements,
      context,
      agentId: agent.id
    };
    
    // Store task
    await this.taskManager.createTask({
      ...task,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    // Execute with dynamic agent
    const result = await this.dynamicAgentManager.executeWithDynamicAgent(
      agent.id,
      task
    );
    
    // Store results using agent's data schema
    if (result.data) {
      for (const [entityType, entityData] of Object.entries(result.data)) {
        await this.dynamicAgentManager.storeAgentData(
          agent.id,
          entityType,
          entityData
        );
      }
    }
    
    return {
      type: 'task_result',
      taskId,
      agentUsed: agent.name,
      result: result.output,
      data: result.data,
      confidence: result.confidence || 0.85,
      storedEntities: Object.keys(result.data || {})
    };
  }

  /**
   * Handle requests that need clarification
   */
  async handleClarificationRequest(analysis, context) {
    const dialogueId = uuidv4();
    
    const clarification = {
      id: dialogueId,
      type: 'requirement_clarification',
      context: {
        originalRequest: analysis.request,
        ambiguities: analysis.ambiguities,
        possibleInterpretations: analysis.interpretations
      },
      questions: this.generateClarificationQuestions(analysis)
    };
    
    // Store dialogue
    await this.redis.hSet(`clarification_dialogue:${dialogueId}`, {
      state: JSON.stringify(clarification),
      timestamp: new Date().toISOString()
    });
    
    this.activeDialogues.set(dialogueId, {
      type: 'requirement_clarification',
      startTime: Date.now(),
      context
    });
    
    return {
      type: 'clarification',
      dialogueId,
      questions: clarification.questions,
      message: "I need some clarification to better assist you:",
      requiresResponse: true
    };
  }

  /**
   * Handle knowledge queries using RAG
   */
  async handleKnowledgeQuery(analysis, context) {
    const { query, domain } = analysis;
    
    // Search across all relevant knowledge bases
    const results = await this.ragManager.search(query, {
      domain,
      limit: 10,
      includeMetadata: true
    });
    
    // If domain-specific, also check dynamic agent knowledge
    if (domain) {
      const domainAgents = await this.dynamicAgentManager.matchTaskToAgent(query, domain);
      if (domainAgents) {
        // Include agent-specific knowledge
        const agentData = await this.dynamicAgentManager.queryAgentData(
          domainAgents.id,
          'knowledge_item',
          { relevance: query }
        );
        results.push(...agentData);
      }
    }
    
    // Synthesize response from found knowledge
    const response = await this.synthesizeKnowledgeResponse(query, results);
    
    return {
      type: 'knowledge_response',
      query,
      response: response.answer,
      sources: response.sources,
      confidence: response.confidence,
      relatedTopics: response.relatedTopics
    };
  }

  /**
   * Handle general requests
   */
  async handleGeneralRequest(analysis, context) {
    // Determine if we should create a task or provide direct response
    if (analysis.requiresExecution) {
      // Create a general task
      const taskId = uuidv4();
      const task = {
        id: taskId,
        type: 'general',
        description: analysis.request,
        context,
        estimatedComplexity: analysis.complexity
      };
      
      // Use CTO to break down into subtasks
      const breakdown = await this.createGeneralTaskBreakdown(task);
      
      // Execute subtasks
      const results = await this.executeGeneralWorkflow(breakdown);
      
      return {
        type: 'task_complete',
        taskId,
        results,
        summary: await this.summarizeResults(results)
      };
    } else {
      // Direct response
      const response = await this.generateDirectResponse(analysis);
      
      return {
        type: 'direct_response',
        response,
        confidence: 0.9
      };
    }
  }

  /**
   * Enhanced agent execution with proper Redis integration
   */
  async executeAgentTask(taskId, agentType, action, data) {
    try {
      // Check if this is a dynamic agent
      if (agentType.startsWith('dynamic:')) {
        const agentId = agentType.replace('dynamic:', '');
        const agent = await this.dynamicAgentManager.agentRegistry.get(agentId);
        
        if (agent) {
          const result = await this.dynamicAgentManager.executeWithDynamicAgent(
            agentId,
            { id: taskId, description: action, context: data }
          );
          
          await this.completeAgentTask(taskId, result);
          return;
        }
      }
      
      // Use enhanced executor for better Redis integration
      await this.agentExecutor.executeAgent(agentType, {
        id: taskId,
        action,
        data,
        metadata: {
          agentType,
          action,
          data
        }
      });
      
    } catch (error) {
      logger.error(`Failed to execute agent task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  
  parseAnalysis(llmResponse) {
    // Parse LLM response into structured analysis
    try {
      // Attempt to extract JSON if present
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Fallback to text parsing
    }
    
    // Simple text-based parsing
    const analysis = {
      type: 'general',
      domain: null,
      requiredCapabilities: [],
      request: llmResponse
    };
    
    if (llmResponse.toLowerCase().includes('create') && 
        llmResponse.toLowerCase().includes('agent')) {
      analysis.type = 'agent_creation';
    } else if (llmResponse.toLowerCase().includes('software') ||
               llmResponse.toLowerCase().includes('code') ||
               llmResponse.toLowerCase().includes('app')) {
      analysis.type = 'software_development';
    } else if (llmResponse.match(/\?|what|how|why|when|where/i)) {
      analysis.type = 'knowledge_query';
    }
    
    return analysis;
  }

  generateClarificationQuestions(analysis) {
    const questions = [];
    
    if (!analysis.domain) {
      questions.push("What domain or field is this request related to?");
    }
    
    if (analysis.ambiguities?.includes('scope')) {
      questions.push("Can you provide more details about the scope of what you need?");
    }
    
    if (analysis.ambiguities?.includes('output')) {
      questions.push("What format or type of output are you expecting?");
    }
    
    if (analysis.interpretations?.length > 1) {
      questions.push(
        "I see multiple ways to interpret your request:\n" +
        analysis.interpretations.map((interp, i) => `${i + 1}. ${interp}`).join('\n') +
        "\nWhich one matches your intent?"
      );
    }
    
    return questions;
  }

  async synthesizeKnowledgeResponse(query, results) {
    if (results.length === 0) {
      return {
        answer: "I don't have specific information about that in my knowledge base.",
        sources: [],
        confidence: 0.3,
        relatedTopics: []
      };
    }
    
    // Use LLM to synthesize response from results
    const synthesis = await this.llmProvider.generateResponse(
      "You are a knowledge synthesis expert. Create a comprehensive answer from the provided sources.",
      
      `Query: ${query}
       
       Sources:
       ${results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n')}
       
       Synthesize a clear, accurate answer citing source numbers.`,
      
      { temperature: 0.2 }
    );
    
    return {
      answer: synthesis,
      sources: results.map(r => ({ id: r.id, title: r.title || 'Untitled' })),
      confidence: 0.85,
      relatedTopics: this.extractRelatedTopics(results)
    };
  }

  extractRelatedTopics(results) {
    const topics = new Set();
    
    results.forEach(result => {
      if (result.metadata?.tags) {
        result.metadata.tags.forEach(tag => topics.add(tag));
      }
      if (result.metadata?.category) {
        topics.add(result.metadata.category);
      }
    });
    
    return Array.from(topics).slice(0, 5);
  }

  async createGeneralTaskBreakdown(task) {
    const breakdown = await this.llmProvider.generateResponse(
      "You are a task decomposition expert. Break down complex tasks into manageable subtasks.",
      
      `Task: ${task.description}
       Context: ${JSON.stringify(task.context)}
       
       Create a structured breakdown with:
       1. Subtasks with clear deliverables
       2. Dependencies between subtasks
       3. Suggested agent types or skills needed
       4. Estimated complexity for each`,
      
      { temperature: 0.3 }
    );
    
    return this.parseTaskBreakdown(breakdown);
  }

  parseTaskBreakdown(breakdownText) {
    // Simple parsing - can be enhanced
    const subtasks = [];
    const lines = breakdownText.split('\n');
    let currentTask = null;
    
    lines.forEach(line => {
      if (line.match(/^\d+\./)) {
        if (currentTask) subtasks.push(currentTask);
        currentTask = {
          description: line.replace(/^\d+\.\s*/, ''),
          dependencies: [],
          agentType: 'general',
          complexity: 'medium'
        };
      } else if (currentTask && line.includes('depends on')) {
        const depMatch = line.match(/depends on (\d+)/);
        if (depMatch) {
          currentTask.dependencies.push(parseInt(depMatch[1]) - 1);
        }
      }
    });
    
    if (currentTask) subtasks.push(currentTask);
    
    return { subtasks };
  }

  async executeGeneralWorkflow(breakdown) {
    const results = [];
    
    for (const [index, subtask] of breakdown.subtasks.entries()) {
      // Wait for dependencies
      for (const depIndex of subtask.dependencies) {
        if (!results[depIndex]) {
          throw new Error(`Dependency ${depIndex} not completed`);
        }
      }
      
      // Execute subtask
      const result = await this.executeGeneralSubtask(subtask, results);
      results.push(result);
    }
    
    return results;
  }

  async executeGeneralSubtask(subtask, previousResults) {
    // Use appropriate agent or direct LLM
    const context = {
      subtask,
      previousResults: previousResults.map(r => r.summary)
    };
    
    const result = await this.llmProvider.generateResponse(
      "You are a task execution expert. Complete the given subtask.",
      
      `Subtask: ${subtask.description}
       Previous results: ${JSON.stringify(context.previousResults)}
       
       Provide a detailed solution or completion of this subtask.`,
      
      { temperature: 0.2 }
    );
    
    return {
      subtask: subtask.description,
      result,
      summary: result.substring(0, 200) + '...'
    };
  }

  async summarizeResults(results) {
    const summary = await this.llmProvider.generateResponse(
      "You are a results summarization expert.",
      
      `Summarize these task results into a cohesive response:
       ${results.map(r => `- ${r.subtask}: ${r.summary}`).join('\n')}`,
      
      { temperature: 0.2 }
    );
    
    return summary;
  }

  async generateDirectResponse(analysis) {
    return await this.llmProvider.generateResponse(
      "You are a helpful AI assistant. Provide clear, accurate responses.",
      analysis.request,
      { temperature: 0.3 }
    );
  }

  async continueRequirementClarification(dialogueId, userResponse) {
    const dialogueData = await this.redis.hGet(`clarification_dialogue:${dialogueId}`, 'state');
    const dialogue = JSON.parse(dialogueData);
    
    // Update dialogue with response
    dialogue.responses = dialogue.responses || [];
    dialogue.responses.push(userResponse);
    
    // Check if we have enough information
    const analysis = await this.analyzeRequest(
      dialogue.context.originalRequest + '\n\nClarifications: ' + dialogue.responses.join('\n'),
      dialogue.context
    );
    
    if (analysis.type !== 'clarification_needed') {
      // We have enough info, proceed with request
      this.activeDialogues.delete(dialogueId);
      return await this.processGenericRequest(
        dialogue.context.originalRequest,
        { ...dialogue.context, clarifications: dialogue.responses }
      );
    } else {
      // Need more clarification
      dialogue.questions = this.generateClarificationQuestions(analysis);
      
      await this.redis.hSet(`clarification_dialogue:${dialogueId}`, {
        state: JSON.stringify(dialogue),
        timestamp: new Date().toISOString()
      });
      
      return {
        type: 'clarification',
        dialogueId,
        questions: dialogue.questions,
        message: "Thanks for the clarification. I have a few more questions:",
        requiresResponse: true
      };
    }
  }

  /**
   * Override handleSoftwareRequest to use enhanced executor
   */
  async handleSoftwareRequest(analysis, context) {
    // Determine if it's a new project or feature addition
    if (analysis.request.toLowerCase().includes('create') || 
        analysis.request.toLowerCase().includes('build')) {
      // New project
      const projectName = this.extractProjectName(analysis.request) || `project_${Date.now()}`;
      const requirements = analysis.request;
      const stack = analysis.suggestedStack || 'auto-detect';
      
      return await this.initializeProject(projectName, requirements, stack);
    } else {
      // Feature addition or modification
      const projectId = context.projectId || await this.identifyProject(analysis.request);
      
      if (!projectId) {
        return {
          type: 'clarification',
          message: "Which project should I work on? Please specify the project name or create a new one.",
          requiresResponse: true
        };
      }
      
      return await this.processFeatureRequest(projectId, analysis.request);
    }
  }

  extractProjectName(request) {
    const match = request.match(/(?:create|build|make)\s+(?:a\s+)?([a-zA-Z0-9-_]+)/i);
    return match ? match[1] : null;
  }

  async identifyProject(request) {
    // Try to identify project from request
    const projects = await this.taskManager.redis.keys('project:*');
    
    for (const projectKey of projects) {
      const projectData = await this.taskManager.redis.hGetAll(projectKey);
      if (request.toLowerCase().includes(projectData.name?.toLowerCase())) {
        return projectKey.replace('project:', '');
      }
    }
    
    return null;
  }
}

export default GenericOrchestrator;