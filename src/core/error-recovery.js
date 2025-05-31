import logger from '../logger.js';
import { v4 as uuidv4 } from 'uuid';

export class ErrorRecoveryManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.retryStrategies = {
      'exponential': this.exponentialBackoff.bind(this),
      'linear': this.linearBackoff.bind(this),
      'fixed': this.fixedDelay.bind(this),
      'fibonacci': this.fibonacciBackoff.bind(this)
    };
    this.defaultConfig = {
      maxRetries: 3,
      initialDelay: 1000, // 1 second
      maxDelay: 60000, // 1 minute
      strategy: 'exponential',
      jitter: true
    };
    this.errorPatterns = this.initializeErrorPatterns();
    this.recoveryActions = this.initializeRecoveryActions();
  }

  initializeErrorPatterns() {
    return {
      'ECONNREFUSED': {
        type: 'connection',
        recoverable: true,
        strategy: 'exponential',
        maxRetries: 5
      },
      'ETIMEDOUT': {
        type: 'timeout',
        recoverable: true,
        strategy: 'exponential',
        maxRetries: 3
      },
      'ENOTFOUND': {
        type: 'dns',
        recoverable: true,
        strategy: 'linear',
        maxRetries: 2
      },
      'rate_limit': {
        type: 'rate_limit',
        recoverable: true,
        strategy: 'exponential',
        maxRetries: 5,
        initialDelay: 5000
      },
      'quota_exceeded': {
        type: 'quota',
        recoverable: false,
        action: 'notify_and_halt'
      },
      'authentication_failed': {
        type: 'auth',
        recoverable: false,
        action: 'refresh_credentials'
      },
      'out_of_memory': {
        type: 'resource',
        recoverable: true,
        strategy: 'fixed',
        maxRetries: 2,
        action: 'cleanup_resources'
      }
    };
  }

  initializeRecoveryActions() {
    return {
      'notify_and_halt': async (error, context) => {
        logger.error(`Unrecoverable error: ${error.message}`, context);
        await this.notifyError(error, context);
        throw error;
      },
      'refresh_credentials': async (error, context) => {
        logger.info('Attempting to refresh credentials');
        // Implementation would refresh auth tokens
        return { refreshed: true };
      },
      'cleanup_resources': async (error, context) => {
        logger.info('Cleaning up resources');
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        return { cleaned: true };
      },
      'switch_provider': async (error, context) => {
        logger.info('Switching to alternate provider');
        // Switch to backup LLM provider
        return { provider: 'alternate' };
      }
    };
  }

  async handleError(error, context = {}) {
    const errorRecord = {
      id: uuidv4(),
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString(),
      attempts: 0
    };

    // Check if error matches known patterns
    const pattern = this.identifyErrorPattern(error);
    
    if (pattern && pattern.recoverable) {
      return await this.attemptRecovery(error, errorRecord, pattern);
    } else if (pattern && pattern.action) {
      // Execute specific recovery action
      const action = this.recoveryActions[pattern.action];
      if (action) {
        return await action(error, context);
      }
    }

    // Log unrecoverable error
    await this.logError(errorRecord);
    throw error;
  }

  identifyErrorPattern(error) {
    // Check error code
    if (error.code && this.errorPatterns[error.code]) {
      return this.errorPatterns[error.code];
    }

    // Check error message patterns
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('rate limit')) {
      return this.errorPatterns['rate_limit'];
    }
    if (errorMessage.includes('quota')) {
      return this.errorPatterns['quota_exceeded'];
    }
    if (errorMessage.includes('memory')) {
      return this.errorPatterns['out_of_memory'];
    }
    if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
      return this.errorPatterns['authentication_failed'];
    }

    return null;
  }

  async attemptRecovery(error, errorRecord, pattern) {
    const config = {
      ...this.defaultConfig,
      ...pattern
    };

    errorRecord.recoveryStrategy = config.strategy;
    errorRecord.maxRetries = config.maxRetries;

    // Store error record
    await this.storeErrorRecord(errorRecord);

    return new Promise((resolve, reject) => {
      this.retryWithBackoff(
        errorRecord,
        config,
        resolve,
        reject
      );
    });
  }

  async retryWithBackoff(errorRecord, config, resolve, reject) {
    const attemptExecution = async () => {
      try {
        errorRecord.attempts++;
        logger.info(`Retry attempt ${errorRecord.attempts}/${config.maxRetries}`);

        // Re-execute the original operation
        const result = await this.retryOperation(errorRecord.context);
        
        // Success - update record
        errorRecord.recovered = true;
        errorRecord.recoveredAt = new Date().toISOString();
        await this.updateErrorRecord(errorRecord);
        
        resolve(result);
      } catch (retryError) {
        if (errorRecord.attempts >= config.maxRetries) {
          // Max retries reached
          errorRecord.recovered = false;
          errorRecord.finalError = retryError.message;
          await this.updateErrorRecord(errorRecord);
          
          reject(new Error(`Max retries (${config.maxRetries}) exceeded: ${retryError.message}`));
        } else {
          // Calculate delay and retry
          const delay = this.calculateDelay(
            errorRecord.attempts,
            config
          );
          
          logger.info(`Retrying after ${delay}ms delay`);
          setTimeout(attemptExecution, delay);
        }
      }
    };

    // Start first attempt
    attemptExecution();
  }

  calculateDelay(attempt, config) {
    const strategy = this.retryStrategies[config.strategy] || this.exponentialBackoff;
    let delay = strategy(attempt, config);

    // Apply max delay cap
    delay = Math.min(delay, config.maxDelay);

    // Apply jitter if enabled
    if (config.jitter) {
      delay = this.applyJitter(delay);
    }

    return delay;
  }

  exponentialBackoff(attempt, config) {
    return config.initialDelay * Math.pow(2, attempt - 1);
  }

  linearBackoff(attempt, config) {
    return config.initialDelay * attempt;
  }

  fixedDelay(attempt, config) {
    return config.initialDelay;
  }

  fibonacciBackoff(attempt, config) {
    if (attempt <= 1) return config.initialDelay;
    if (attempt === 2) return config.initialDelay * 2;
    
    let prev = config.initialDelay;
    let curr = config.initialDelay * 2;
    
    for (let i = 3; i <= attempt; i++) {
      const next = prev + curr;
      prev = curr;
      curr = next;
    }
    
    return curr;
  }

  applyJitter(delay) {
    // Add random jitter ±25%
    const jitter = delay * 0.25;
    return delay + (Math.random() * 2 - 1) * jitter;
  }

  async retryOperation(context) {
    // Use provided retry operation if available
    if (context.retryOperation && typeof context.retryOperation === 'function') {
      return await context.retryOperation();
    }
    
    // Otherwise, use context to determine what operation to retry
    if (context.operation) {
      switch (context.operation) {
        case 'api_call':
          return await this.retryApiCall(context);
        case 'file_operation':
          return await this.retryFileOperation(context);
        case 'database_query':
          return await this.retryDatabaseQuery(context);
        case 'agent_task':
          return await this.retryAgentTask(context);
        default:
          throw new Error(`Unknown operation type: ${context.operation}`);
      }
    }
    
    throw new Error('No operation specified for retry');
  }

  async retryApiCall(context) {
    // Placeholder for API retry logic
    const { url, method, data } = context;
    // Would make actual API call here
    return { success: true, data: 'Retry successful' };
  }

  async retryFileOperation(context) {
    // Placeholder for file operation retry
    const { action, path } = context;
    // Would perform file operation here
    return { success: true, path };
  }

  async retryDatabaseQuery(context) {
    // Placeholder for database retry
    const { query, params } = context;
    // Would execute query here
    return { success: true, result: [] };
  }

  async retryAgentTask(context) {
    // Agent task retry logic
    const { taskId, agentType, action } = context;
    logger.info(`Retrying agent task ${taskId} (${agentType}:${action})`);
    
    // Check if we have a retry function
    if (context.retryOperation) {
      return await context.retryOperation();
    }
    
    // Otherwise, return placeholder
    return { success: true, taskId, retried: true };
  }

  async storeErrorRecord(errorRecord) {
    await this.taskManager.redis.hSet(
      `error:${errorRecord.id}`,
      {
        ...errorRecord,
        error: JSON.stringify(errorRecord.error),
        context: JSON.stringify(errorRecord.context)
      }
    );
    
    // Add to error index
    await this.taskManager.redis.zAdd(
      'error_timeline',
      Date.now(),
      errorRecord.id
    );
  }

  async updateErrorRecord(errorRecord) {
    await this.taskManager.redis.hSet(
      `error:${errorRecord.id}`,
      {
        attempts: errorRecord.attempts,
        recovered: errorRecord.recovered || false,
        recoveredAt: errorRecord.recoveredAt || null,
        finalError: errorRecord.finalError || null
      }
    );
  }

  async logError(errorRecord) {
    logger.error('Unrecoverable error:', {
      id: errorRecord.id,
      error: errorRecord.error.message,
      context: errorRecord.context
    });
    
    await this.storeErrorRecord(errorRecord);
  }

  async notifyError(error, context) {
    // Send notification about critical error
    const notification = {
      id: uuidv4(),
      type: 'critical_error',
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    };
    
    await this.taskManager.redis.hSet(
      `notification:${notification.id}`,
      notification
    );
    
    // Could also send email, Slack message, etc.
  }

  async getErrorStatistics(timeRange = 86400000) { // 24 hours default
    const now = Date.now();
    const since = now - timeRange;
    
    // Get error IDs from timeline
    const errorIds = await this.taskManager.redis.zRangeByScore(
      'error_timeline',
      since,
      now
    );
    
    const stats = {
      total: errorIds.length,
      recovered: 0,
      unrecovered: 0,
      byType: {},
      byStrategy: {}
    };
    
    for (const errorId of errorIds) {
      const error = await this.taskManager.redis.hGetAll(`error:${errorId}`);
      
      if (error.recovered === 'true') {
        stats.recovered++;
      } else {
        stats.unrecovered++;
      }
      
      // Parse error details
      const errorData = JSON.parse(error.error || '{}');
      const errorType = errorData.code || 'unknown';
      
      stats.byType[errorType] = (stats.byType[errorType] || 0) + 1;
      
      if (error.recoveryStrategy) {
        stats.byStrategy[error.recoveryStrategy] = 
          (stats.byStrategy[error.recoveryStrategy] || 0) + 1;
      }
    }
    
    stats.recoveryRate = stats.total > 0 
      ? (stats.recovered / stats.total * 100).toFixed(2) + '%'
      : '0%';
    
    return stats;
  }

  // Circuit breaker pattern
  async withCircuitBreaker(operation, options = {}) {
    const config = {
      threshold: 5, // failures before opening
      timeout: 60000, // 1 minute
      halfOpenRequests: 3,
      ...options
    };
    
    const circuitKey = `circuit:${operation}`;
    const state = await this.getCircuitState(circuitKey);
    
    if (state === 'open') {
      throw new Error(`Circuit breaker is open for ${operation}`);
    }
    
    try {
      const result = await this.executeWithTracking(operation, config);
      
      if (state === 'half-open') {
        await this.recordSuccess(circuitKey);
      }
      
      return result;
    } catch (error) {
      await this.recordFailure(circuitKey, config);
      throw error;
    }
  }

  async getCircuitState(circuitKey) {
    const circuit = await this.taskManager.redis.hGetAll(circuitKey);
    
    if (!circuit.state) return 'closed';
    
    if (circuit.state === 'open') {
      const openedAt = parseInt(circuit.openedAt);
      const timeout = parseInt(circuit.timeout);
      
      if (Date.now() - openedAt > timeout) {
        // Transition to half-open
        await this.taskManager.redis.hSet(circuitKey, {
          state: 'half-open',
          halfOpenRequests: 0
        });
        return 'half-open';
      }
    }
    
    return circuit.state;
  }

  async recordFailure(circuitKey, config) {
    const circuit = await this.taskManager.redis.hGetAll(circuitKey);
    const failures = parseInt(circuit.failures || 0) + 1;
    
    if (failures >= config.threshold) {
      // Open the circuit
      await this.taskManager.redis.hSet(circuitKey, {
        state: 'open',
        failures,
        openedAt: Date.now(),
        timeout: config.timeout
      });
      
      logger.warn(`Circuit breaker opened for ${circuitKey}`);
    } else {
      await this.taskManager.redis.hSet(circuitKey, { failures });
    }
  }

  async recordSuccess(circuitKey) {
    const circuit = await this.taskManager.redis.hGetAll(circuitKey);
    
    if (circuit.state === 'half-open') {
      const requests = parseInt(circuit.halfOpenRequests || 0) + 1;
      
      if (requests >= 3) {
        // Close the circuit
        await this.taskManager.redis.del(circuitKey);
        logger.info(`Circuit breaker closed for ${circuitKey}`);
      } else {
        await this.taskManager.redis.hSet(circuitKey, {
          halfOpenRequests: requests
        });
      }
    }
  }

  async executeWithTracking(operation, config) {
    // This would be overridden with actual operation execution
    throw new Error(`Operation ${operation} not implemented`);
  }
}

export default ErrorRecoveryManager;