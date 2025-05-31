import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../logger.js';
import { ContextManager } from './context-manager.js';
import { ConfidenceEvaluator } from './confidence-evaluator.js';

const execAsync = promisify(exec);

/**
 * Enhanced LLM Provider v2
 * 
 * PURPOSE:
 * Provides optimized LLM interactions with dynamic context management,
 * confidence evaluation, and zero-temperature code generation.
 * 
 * FEATURES:
 * - Dynamic context window management
 * - Confidence scoring and evaluation
 * - Memory-efficient state management
 * - Temperature control for code generation
 * - Automatic revision workflows
 * 
 * TODO:
 * - None
 */
export class LLMProviderV2 {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.ollamaUrl = 'http://localhost:11434';
    this.contextManager = new ContextManager(taskManager);
    this.confidenceEvaluator = new ConfidenceEvaluator(taskManager, this);
    
    // Model capabilities with zero temperature for code generation
    this.models = {
      thinking: {
        name: 'qwen2.5:14b',
        contextWindow: 32768,
        temperature: 0.0,  // No hallucination
        maxTokens: 2048,
        type: 'thinking'
      },
      fast: {
        name: 'qwen2.5:7b',
        contextWindow: 32768,
        temperature: 0.0,  // No hallucination
        maxTokens: 1536,
        type: 'fast'
      },
      vision: {
        name: 'qwen2.5-vl:32b',
        contextWindow: 32768,
        temperature: 0.0,  // No hallucination
        maxTokens: 1024,
        type: 'vision'
      },
      reasoning: {
        name: 'deepseek-r1:1.5b',
        contextWindow: 4096,
        temperature: 0.0,  // No hallucination
        maxTokens: 1024,
        type: 'fast'
      }
    };
    
    this.initialized = false;
    this.activeRequests = new Map();
  }

  async init() {
    try {
      await this.checkOllamaStatus();
      await this.ensureModelsAvailable();
      this.initialized = true;
      logger.info('Enhanced LLM Provider v2 initialized');
      logger.info('✅ Zero-temperature code generation enabled');
      logger.info('✅ Context optimization active');
      logger.info('✅ Confidence evaluation ready');
    } catch (error) {
      logger.error('LLM Provider initialization failed:', error);
      throw error;
    }
  }

  async generateResponse(agentId, task, agentRole, options = {}) {
    if (!this.initialized) {
      await this.init();
    }

    const requestId = `${agentId}_${Date.now()}`;
    this.activeRequests.set(requestId, { agentId, task, startTime: Date.now() });
    
    try {
      // Clear agent memory for fresh context
      await this.contextManager.clearAgentMemory(agentId);
      
      // Determine model type
      const modelType = this.getModelTypeForRole(agentRole);
      const model = this.models[modelType];
      
      // Build optimized context
      const context = await this.contextManager.buildTaskContext(
        agentId,
        task,
        model.name
      );
      
      // Generate response with context
      const response = await this.callModel(model, context, options);
      
      // Evaluate confidence
      const evaluation = await this.confidenceEvaluator.evaluateResponse(
        response.content,
        task,
        agentId,
        agentRole
      );
      
      // Handle revision if needed
      if (!evaluation.accepted) {
        logger.info(`Low confidence detected for agent ${agentId}, triggering revision`);
        return {
          success: false,
          reason: evaluation.reason,
          confidence: evaluation.confidence,
          revisionId: evaluation.revisionId,
          nextStep: evaluation.nextStep
        };
      }
      
      // Log successful completion
      await this.logCompletion(requestId, response, evaluation, context);
      
      return {
        success: true,
        content: response.content,
        confidence: evaluation.confidence,
        evaluation: evaluation.evaluation,
        context: context.metadata,
        tokens: response.tokens
      };
      
    } catch (error) {
      logger.error(`LLM request failed for agent ${agentId}:`, error);
      return {
        success: false,
        error: error.message,
        confidence: 0
      };
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  async callModel(model, context, options = {}) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model.name,
          prompt: context.userPrompt,
          system: context.systemPrompt,
          stream: false,
          options: {
            temperature: model.temperature,  // Always 0.0 for no hallucination
            top_p: 0.95,  // Focused responses
            top_k: 40,    // Limited token selection
            max_tokens: model.maxTokens,
            num_predict: model.maxTokens,
            repeat_penalty: 1.1,
            stop: ['Human:', 'Assistant:', '```\n\n'],
            ...options
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Model request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.response) {
        throw new Error('Empty response from model');
      }

      const executionTime = Date.now() - startTime;
      const tokenCount = this.estimateTokens(result.response);
      
      logger.debug(`Model ${model.name} responded in ${executionTime}ms (${tokenCount} tokens)`);
      
      return {
        content: result.response,
        tokens: tokenCount,
        executionTime,
        model: model.name
      };
      
    } catch (error) {
      logger.error(`Model ${model.name} call failed:`, error);
      throw error;
    }
  }

  getModelTypeForRole(role) {
    const thinkingRoles = [
      'cto', 'engineering_manager', 'product_manager',
      'business_analyst', 'solution_architect', 'technical_writer'
    ];
    
    return thinkingRoles.includes(role) ? 'thinking' : 'fast';
  }

  // Simplified interface for backward compatibility
  async complete(prompt, options = {}) {
    const model = this.models[options.model || 'fast'];
    
    const context = {
      systemPrompt: options.system || 'You are a helpful AI assistant.',
      userPrompt: prompt,
      metadata: { simple: true }
    };
    
    return await this.callModel(model, context, options);
  }

  // Model management
  async checkOllamaStatus() {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!response.ok) {
        throw new Error('Ollama not running');
      }
      logger.info('✅ Ollama service is running');
    } catch (error) {
      logger.warn('⚠️ Ollama not available, attempting to start...');
      await this.startOllama();
    }
  }

  async startOllama() {
    try {
      await execAsync('ollama serve &');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.checkOllamaStatus();
    } catch (error) {
      throw new Error('Failed to start Ollama service');
    }
  }

  async ensureModelsAvailable() {
    const modelPullPromises = Object.values(this.models).map(async (model) => {
      try {
        await this.pullModel(model.name);
        logger.info(`✅ Model ${model.name} ready`);
      } catch (error) {
        logger.warn(`⚠️ Failed to pull model ${model.name}:`, error.message);
      }
    });
    
    await Promise.allSettled(modelPullPromises);
  }

  async pullModel(modelName) {
    try {
      logger.info(`📥 Pulling model: ${modelName}...`);
      await execAsync(`ollama pull ${modelName}`, { timeout: 300000 }); // 5 min timeout
    } catch (error) {
      if (error.message.includes('already exists')) {
        logger.info(`Model ${modelName} already available`);
      } else {
        throw error;
      }
    }
  }

  // Utility methods
  estimateTokens(text) {
    return Math.ceil(text.length / 3.5);
  }

  async logCompletion(requestId, response, evaluation, context) {
    const request = this.activeRequests.get(requestId);
    if (!request) return;
    
    const completionLog = {
      requestId,
      agentId: request.agentId,
      taskId: request.task.id,
      executionTime: Date.now() - request.startTime,
      tokens: response.tokens,
      confidence: evaluation.confidence,
      contextEfficiency: context.metadata.efficiency,
      model: response.model,
      timestamp: new Date().toISOString()
    };
    
    // Store completion log
    await this.taskManager.redis.hSet(
      `completion_log:${requestId}`,
      completionLog
    );
    
    // Update agent performance metrics
    await this.updateAgentMetrics(request.agentId, completionLog);
  }

  async updateAgentMetrics(agentId, completionLog) {
    const metricsKey = `agent_metrics:${agentId}`;
    const metrics = await this.taskManager.redis.hGetAll(metricsKey) || {};
    
    const updated = {
      totalRequests: parseInt(metrics.totalRequests || '0') + 1,
      totalTokens: parseInt(metrics.totalTokens || '0') + completionLog.tokens,
      totalTime: parseInt(metrics.totalTime || '0') + completionLog.executionTime,
      averageConfidence: this.calculateRunningAverage(
        parseFloat(metrics.averageConfidence || '0'),
        parseInt(metrics.totalRequests || '0'),
        completionLog.confidence
      ),
      lastRequest: completionLog.timestamp
    };
    
    await this.taskManager.redis.hSet(metricsKey, updated);
  }

  calculateRunningAverage(currentAvg, count, newValue) {
    return ((currentAvg * count) + newValue) / (count + 1);
  }

  // Health and monitoring
  async getProviderHealth() {
    const health = {
      status: 'healthy',
      models: {},
      activeRequests: this.activeRequests.size,
      initialized: this.initialized
    };
    
    // Check each model
    for (const [type, model] of Object.entries(this.models)) {
      try {
        const testResponse = await fetch(`${this.ollamaUrl}/api/show`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: model.name })
        });
        
        health.models[type] = {
          name: model.name,
          status: testResponse.ok ? 'ready' : 'error',
          contextWindow: model.contextWindow,
          temperature: model.temperature
        };
      } catch (error) {
        health.models[type] = {
          name: model.name,
          status: 'unavailable',
          error: error.message
        };
        health.status = 'degraded';
      }
    }
    
    return health;
  }

  async getPerformanceStats() {
    const stats = {
      totalRequests: 0,
      averageResponseTime: 0,
      averageConfidence: 0,
      modelUsage: {},
      confidenceDistribution: { high: 0, medium: 0, low: 0 }
    };
    
    const logKeys = await this.taskManager.redis.keys('completion_log:*');
    
    if (logKeys.length > 0) {
      let totalTime = 0;
      let totalConfidence = 0;
      
      for (const key of logKeys) {
        const log = await this.taskManager.redis.hGetAll(key);
        
        stats.totalRequests++;
        totalTime += parseInt(log.executionTime || '0');
        totalConfidence += parseFloat(log.confidence || '0');
        
        // Model usage
        const model = log.model;
        stats.modelUsage[model] = (stats.modelUsage[model] || 0) + 1;
        
        // Confidence distribution
        const confidence = parseFloat(log.confidence || '0');
        if (confidence >= 80) stats.confidenceDistribution.high++;
        else if (confidence >= 60) stats.confidenceDistribution.medium++;
        else stats.confidenceDistribution.low++;
      }
      
      stats.averageResponseTime = totalTime / stats.totalRequests;
      stats.averageConfidence = totalConfidence / stats.totalRequests;
    }
    
    return stats;
  }

  // Cleanup and maintenance
  async cleanup() {
    // Clear old completion logs (keep last 1000)
    const logKeys = await this.taskManager.redis.keys('completion_log:*');
    if (logKeys.length > 1000) {
      const toDelete = logKeys.slice(0, logKeys.length - 1000);
      if (toDelete.length > 0) {
        await this.taskManager.redis.del(...toDelete);
      }
    }
    
    // Clear agent memory for inactive agents
    const agentKeys = await this.taskManager.redis.keys('agent_metrics:*');
    for (const key of agentKeys) {
      const metrics = await this.taskManager.redis.hGetAll(key);
      const lastRequest = new Date(metrics.lastRequest);
      const hoursSinceLastRequest = (Date.now() - lastRequest.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastRequest > 24) {
        const agentId = key.split(':')[1];
        await this.contextManager.clearAgentMemory(agentId);
      }
    }
    
    logger.info('LLM Provider cleanup completed');
  }

  // External API support (fallback)
  async callExternalAPI(provider, prompt, options = {}) {
    switch (provider) {
      case 'openai':
        return await this.callOpenAI(prompt, options);
      case 'anthropic':
        return await this.callAnthropic(prompt, options);
      default:
        throw new Error(`Unsupported external provider: ${provider}`);
    }
  }

  async callOpenAI(prompt, options = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,  // No hallucination for code
        max_tokens: options.maxTokens || 2048
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    return {
      content: result.choices[0].message.content,
      tokens: result.usage.total_tokens,
      model: 'openai'
    };
  }

  async callAnthropic(prompt, options = {}) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-sonnet-20240229',
        max_tokens: options.maxTokens || 2048,
        temperature: 0.0,  // No hallucination for code
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const result = await response.json();
    return {
      content: result.content[0].text,
      tokens: result.usage.input_tokens + result.usage.output_tokens,
      model: 'anthropic'
    };
  }
}