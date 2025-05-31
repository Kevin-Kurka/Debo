/**
 * Error Tracking Manager for Debo
 * Tracks all errors, solutions, and prevents circular fix attempts
 */

const crypto = require('crypto');
const logger = require('../logger.js');

class ErrorTrackingManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.circularFixThreshold = 3; // Max attempts for same error pattern
    this.similarityThreshold = 0.8; // Similarity threshold for duplicate errors
  }

  async init() {
    await this.createErrorTrackingSchema();
    logger.info('Error Tracking Manager initialized');
  }

  async createErrorTrackingSchema() {
    // Initialize error tracking tables in Redis
    const schemaKey = 'error_tracking_schema';
    const schema = {
      errors: {
        description: 'Main error tracking table',
        fields: {
          id: 'unique error identifier',
          hash: 'error signature hash',
          projectId: 'associated project',
          taskId: 'associated task',
          errorType: 'category of error',
          errorMessage: 'error description',
          stackTrace: 'error stack trace',
          context: 'surrounding code/context',
          severity: 'error severity level',
          firstOccurred: 'when first seen',
          lastOccurred: 'most recent occurrence',
          occurrenceCount: 'total occurrences',
          status: 'open/resolved/ignored'
        }
      },
      solutions: {
        description: 'Attempted solutions for errors',
        fields: {
          id: 'unique solution identifier',
          errorId: 'associated error',
          solutionType: 'type of solution attempted',
          description: 'solution description',
          code: 'solution code/changes',
          agentType: 'which agent proposed solution',
          confidence: 'confidence level when attempted',
          result: 'success/failure/partial',
          sideEffects: 'any side effects observed',
          attemptedAt: 'when solution was tried',
          feedback: 'outcome feedback'
        }
      },
      error_patterns: {
        description: 'Common error patterns and their contexts',
        fields: {
          pattern: 'error pattern signature',
          commonCauses: 'frequent root causes',
          successfulSolutions: 'solutions that worked',
          failedSolutions: 'solutions that failed',
          complexity: 'estimated fix complexity',
          escalationTriggers: 'when to escalate'
        }
      }
    };

    await this.taskManager.redis.hSet(schemaKey, schema);
  }

  async trackError(error, context = {}) {
    const errorHash = this.generateErrorHash(error);
    const errorId = `error_${Date.now()}_${errorHash.substring(0, 8)}`;

    // Check if this error has been seen before
    const existingErrorId = await this.findExistingError(errorHash);
    
    if (existingErrorId) {
      // Update existing error occurrence
      await this.updateErrorOccurrence(existingErrorId);
      return existingErrorId;
    }

    // Create new error record
    const errorRecord = {
      id: errorId,
      hash: errorHash,
      projectId: context.projectId || 'unknown',
      taskId: context.taskId || 'unknown',
      errorType: this.categorizeError(error),
      errorMessage: error.message || String(error),
      stackTrace: error.stack || '',
      context: JSON.stringify(context),
      severity: this.assessErrorSeverity(error, context),
      firstOccurred: new Date().toISOString(),
      lastOccurred: new Date().toISOString(),
      occurrenceCount: 1,
      status: 'open'
    };

    await this.storeError(errorRecord);
    await this.updateErrorIndex(errorId, errorHash);
    
    logger.info(`Tracked new error: ${errorId}`);
    return errorId;
  }

  async proposeSolution(errorId, solution, agentType, confidence) {
    // Check if this solution has been tried before
    const duplicateCheck = await this.checkForDuplicateSolution(errorId, solution);
    
    if (duplicateCheck.isDuplicate) {
      logger.warn(`Duplicate solution detected for error ${errorId}`);
      return {
        allowed: false,
        reason: 'duplicate_solution',
        previousAttempts: duplicateCheck.attempts,
        recommendation: await this.getAlternativeSolutionRecommendation(errorId)
      };
    }

    // Check for circular fix patterns
    const circularCheck = await this.checkCircularFixPattern(errorId, solution);
    
    if (circularCheck.isCircular) {
      logger.warn(`Circular fix pattern detected for error ${errorId}`);
      return {
        allowed: false,
        reason: 'circular_pattern',
        pattern: circularCheck.pattern,
        recommendation: {
          action: 'escalate_to_architect',
          reason: 'Circular pattern detected - requires architectural review'
        }
      };
    }

    // Check solution count for this error
    const solutionCount = await this.getSolutionCount(errorId);
    
    if (solutionCount >= this.circularFixThreshold) {
      logger.warn(`Too many solution attempts for error ${errorId}`);
      return {
        allowed: false,
        reason: 'max_attempts_reached',
        attemptCount: solutionCount,
        recommendation: {
          action: 'escalate_to_thinking_agent',
          reason: 'Multiple failed attempts - requires higher-level analysis'
        }
      };
    }

    // Solution is allowed - store the proposal
    const solutionId = await this.storeSolutionProposal(errorId, solution, agentType, confidence);
    
    return {
      allowed: true,
      solutionId,
      recommendation: {
        action: 'proceed',
        reason: 'No conflicts detected'
      }
    };
  }

  async recordSolutionResult(solutionId, result, feedback = {}) {
    const solution = await this.getSolution(solutionId);
    
    if (!solution) {
      throw new Error(`Solution not found: ${solutionId}`);
    }

    // Update solution record
    await this.taskManager.redis.hSet(`solution:${solutionId}`, {
      result: result, // 'success', 'failure', 'partial'
      feedback: JSON.stringify(feedback),
      completedAt: new Date().toISOString()
    });

    // Update error status if solution was successful
    if (result === 'success') {
      await this.markErrorResolved(solution.errorId, solutionId);
      await this.updateSuccessfulSolutionPattern(solution);
    } else {
      await this.updateFailedSolutionPattern(solution);
    }

    // Check if we need to escalate after failed attempts
    if (result === 'failure') {
      await this.checkForEscalation(solution.errorId);
    }

    logger.info(`Solution result recorded: ${solutionId} - ${result}`);
  }

  generateErrorHash(error) {
    // Create a hash that represents the error's essential characteristics
    const errorSignature = {
      message: this.normalizeErrorMessage(error.message || String(error)),
      type: error.constructor?.name || 'Error',
      // Include relevant stack trace patterns (not exact lines)
      stackPattern: this.extractStackPattern(error.stack)
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(errorSignature))
      .digest('hex');
  }

  normalizeErrorMessage(message) {
    // Remove variable content that might change between occurrences
    return message
      .replace(/line \d+/gi, 'line X')
      .replace(/column \d+/gi, 'column X')
      .replace(/\d+/g, 'N')
      .replace(/["']([^"']+)["']/g, '"variable"')
      .toLowerCase()
      .trim();
  }

  extractStackPattern(stack) {
    if (!stack) return '';
    
    // Extract function names and file patterns, ignore line numbers
    return stack
      .split('\n')
      .slice(0, 5) // Only top 5 stack frames
      .map(line => {
        const match = line.match(/at\s+([^(]+)/);
        return match ? match[1].trim() : '';
      })
      .filter(Boolean)
      .join('|');
  }

  categorizeError(error) {
    const message = (error.message || String(error)).toLowerCase();
    const errorType = error.constructor?.name || 'Error';

    // Categorize based on error patterns
    if (message.includes('syntax')) return 'syntax_error';
    if (message.includes('reference') || message.includes('undefined')) return 'reference_error';
    if (message.includes('type')) return 'type_error';
    if (message.includes('network') || message.includes('fetch')) return 'network_error';
    if (message.includes('permission') || message.includes('access')) return 'permission_error';
    if (message.includes('timeout')) return 'timeout_error';
    if (message.includes('memory')) return 'memory_error';
    if (errorType.includes('SQL') || message.includes('database')) return 'database_error';
    if (errorType.includes('Validation')) return 'validation_error';
    
    return 'general_error';
  }

  assessErrorSeverity(error, context) {
    // Assess severity based on error type and context
    const message = (error.message || String(error)).toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) return 'critical';
    if (message.includes('security') || message.includes('vulnerability')) return 'critical';
    if (message.includes('data loss') || message.includes('corruption')) return 'critical';
    if (message.includes('crash') || message.includes('segfault')) return 'high';
    if (message.includes('memory leak') || message.includes('deadlock')) return 'high';
    if (message.includes('performance') || message.includes('slow')) return 'medium';
    if (message.includes('warning') || message.includes('deprecated')) return 'low';
    
    return 'medium'; // Default severity
  }

  async findExistingError(errorHash) {
    const errorId = await this.taskManager.redis.hGet('error_hash_index', errorHash);
    return errorId || null;
  }

  async updateErrorOccurrence(errorId) {
    const error = await this.taskManager.redis.hGetAll(`error:${errorId}`);
    if (error.id) {
      await this.taskManager.redis.hSet(`error:${errorId}`, {
        lastOccurred: new Date().toISOString(),
        occurrenceCount: parseInt(error.occurrenceCount || 0) + 1
      });
    }
  }

  async storeError(errorRecord) {
    await this.taskManager.redis.hSet(`error:${errorRecord.id}`, errorRecord);
    
    // Add to project error list
    await this.taskManager.redis.sAdd(`project_errors:${errorRecord.projectId}`, errorRecord.id);
    
    // Add to global error timeline
    await this.taskManager.redis.zAdd('error_timeline', Date.now(), errorRecord.id);
  }

  async updateErrorIndex(errorId, errorHash) {
    await this.taskManager.redis.hSet('error_hash_index', errorHash, errorId);
  }

  async checkForDuplicateSolution(errorId, solution) {
    const solutionHash = this.generateSolutionHash(solution);
    const existingSolutions = await this.getErrorSolutions(errorId);
    
    const duplicates = [];
    
    for (const existingSolution of existingSolutions) {
      const existingHash = this.generateSolutionHash(existingSolution);
      const similarity = this.calculateSolutionSimilarity(solutionHash, existingHash);
      
      if (similarity > this.similarityThreshold) {
        duplicates.push({
          solutionId: existingSolution.id,
          similarity,
          result: existingSolution.result
        });
      }
    }

    return {
      isDuplicate: duplicates.length > 0,
      attempts: duplicates
    };
  }

  async checkCircularFixPattern(errorId, solution) {
    const recentSolutions = await this.getRecentSolutions(errorId, 5);
    
    // Look for patterns where similar solutions were attempted multiple times
    const solutionPatterns = new Map();
    
    for (const recentSolution of recentSolutions) {
      const pattern = this.extractSolutionPattern(recentSolution);
      const count = solutionPatterns.get(pattern) || 0;
      solutionPatterns.set(pattern, count + 1);
    }

    const currentPattern = this.extractSolutionPattern(solution);
    const currentCount = solutionPatterns.get(currentPattern) || 0;

    return {
      isCircular: currentCount >= 2, // Same pattern attempted 3+ times
      pattern: currentPattern,
      previousAttempts: currentCount
    };
  }

  generateSolutionHash(solution) {
    // Create hash based on solution approach, not exact implementation
    const solutionSignature = {
      type: solution.solutionType || 'unknown',
      approach: this.extractSolutionApproach(solution.description || ''),
      codePattern: this.extractCodePattern(solution.code || '')
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(solutionSignature))
      .digest('hex');
  }

  extractSolutionApproach(description) {
    // Extract high-level approach from solution description
    const keywords = [
      'refactor', 'rewrite', 'modify', 'add', 'remove', 'update',
      'fix', 'patch', 'optimize', 'validate', 'check', 'handle'
    ];

    return keywords
      .filter(keyword => description.toLowerCase().includes(keyword))
      .sort()
      .join('|');
  }

  extractCodePattern(code) {
    if (!code) return '';
    
    // Extract structural patterns from code
    const patterns = [];
    
    if (code.includes('try') && code.includes('catch')) patterns.push('try-catch');
    if (code.includes('if') && code.includes('else')) patterns.push('if-else');
    if (code.includes('for') || code.includes('while')) patterns.push('loop');
    if (code.includes('async') && code.includes('await')) patterns.push('async-await');
    if (code.includes('Promise')) patterns.push('promise');
    if (code.includes('class') && code.includes('extends')) patterns.push('inheritance');
    
    return patterns.sort().join('|');
  }

  extractSolutionPattern(solution) {
    return `${solution.solutionType || 'unknown'}:${this.extractSolutionApproach(solution.description || '')}`;
  }

  calculateSolutionSimilarity(hash1, hash2) {
    if (hash1 === hash2) return 1.0;
    
    // Calculate hash similarity (simplified)
    let matches = 0;
    const length = Math.min(hash1.length, hash2.length);
    
    for (let i = 0; i < length; i++) {
      if (hash1[i] === hash2[i]) matches++;
    }
    
    return matches / length;
  }

  async getSolutionCount(errorId) {
    const solutions = await this.taskManager.redis.lRange(`error_solutions:${errorId}`, 0, -1);
    return solutions.length;
  }

  async storeSolutionProposal(errorId, solution, agentType, confidence) {
    const solutionId = `solution_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const solutionRecord = {
      id: solutionId,
      errorId,
      solutionType: solution.type || 'general',
      description: solution.description || '',
      code: solution.code || '',
      agentType,
      confidence,
      result: 'pending',
      sideEffects: '',
      attemptedAt: new Date().toISOString(),
      feedback: ''
    };

    await this.taskManager.redis.hSet(`solution:${solutionId}`, solutionRecord);
    await this.taskManager.redis.lPush(`error_solutions:${errorId}`, solutionId);
    
    return solutionId;
  }

  async getSolution(solutionId) {
    const solution = await this.taskManager.redis.hGetAll(`solution:${solutionId}`);
    return solution.id ? solution : null;
  }

  async getErrorSolutions(errorId) {
    const solutionIds = await this.taskManager.redis.lRange(`error_solutions:${errorId}`, 0, -1);
    const solutions = [];
    
    for (const solutionId of solutionIds) {
      const solution = await this.getSolution(solutionId);
      if (solution) solutions.push(solution);
    }
    
    return solutions;
  }

  async getRecentSolutions(errorId, limit = 10) {
    const solutionIds = await this.taskManager.redis.lRange(`error_solutions:${errorId}`, 0, limit - 1);
    const solutions = [];
    
    for (const solutionId of solutionIds) {
      const solution = await this.getSolution(solutionId);
      if (solution) solutions.push(solution);
    }
    
    return solutions;
  }

  async markErrorResolved(errorId, solutionId) {
    await this.taskManager.redis.hSet(`error:${errorId}`, {
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      resolvedBy: solutionId
    });
  }

  async updateSuccessfulSolutionPattern(solution) {
    const pattern = this.extractSolutionPattern(solution);
    const patternKey = `successful_pattern:${pattern}`;
    
    await this.taskManager.redis.hIncrBy('successful_patterns', pattern, 1);
    await this.taskManager.redis.lPush(patternKey, solution.id);
  }

  async updateFailedSolutionPattern(solution) {
    const pattern = this.extractSolutionPattern(solution);
    await this.taskManager.redis.hIncrBy('failed_patterns', pattern, 1);
  }

  async checkForEscalation(errorId) {
    const error = await this.taskManager.redis.hGetAll(`error:${errorId}`);
    const solutionCount = await this.getSolutionCount(errorId);
    
    if (solutionCount >= this.circularFixThreshold) {
      // Escalate to thinking agent
      await this.createEscalationTask(errorId, 'max_attempts');
    }
    
    if (error.severity === 'critical' && solutionCount >= 2) {
      // Escalate critical errors faster
      await this.createEscalationTask(errorId, 'critical_severity');
    }
  }

  async createEscalationTask(errorId, reason) {
    const escalationTask = {
      id: `escalation_${errorId}_${Date.now()}`,
      type: 'error_escalation',
      errorId,
      reason,
      priority: 'high',
      assignedTo: 'solution_architect',
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    await this.taskManager.redis.hSet(`escalation:${escalationTask.id}`, escalationTask);
    await this.taskManager.redis.lPush('escalation_queue', escalationTask.id);
    
    logger.warn(`Error escalated: ${errorId} - ${reason}`);
  }

  async getAlternativeSolutionRecommendation(errorId) {
    const error = await this.taskManager.redis.hGetAll(`error:${errorId}`);
    const failedSolutions = await this.getErrorSolutions(errorId);
    
    // Look for successful patterns for similar errors
    const similarErrors = await this.findSimilarResolvedErrors(error);
    const successfulPatterns = await this.getSuccessfulPatternsForErrorType(error.errorType);

    return {
      action: 'try_alternative_approach',
      suggestions: [
        'Consider a different architectural approach',
        'Research external libraries or frameworks',
        'Simplify the solution approach',
        'Break down the problem into smaller parts'
      ],
      successfulPatterns: successfulPatterns.slice(0, 3),
      similarSuccesses: similarErrors.slice(0, 2)
    };
  }

  async findSimilarResolvedErrors(targetError) {
    // Find errors with similar characteristics that were resolved
    const allErrors = await this.taskManager.redis.zRange('error_timeline', 0, -1);
    const similarErrors = [];
    
    for (const errorId of allErrors) {
      const error = await this.taskManager.redis.hGetAll(`error:${errorId}`);
      
      if (error.status === 'resolved' && 
          error.errorType === targetError.errorType &&
          error.id !== targetError.id) {
        
        const similarity = this.calculateErrorSimilarity(targetError, error);
        if (similarity > 0.7) {
          similarErrors.push({ error, similarity });
        }
      }
    }
    
    return similarErrors
      .sort((a, b) => b.similarity - a.similarity)
      .map(item => item.error);
  }

  calculateErrorSimilarity(error1, error2) {
    // Simple similarity calculation based on message and type
    const msg1 = this.normalizeErrorMessage(error1.errorMessage);
    const msg2 = this.normalizeErrorMessage(error2.errorMessage);
    
    let similarity = 0;
    
    // Type match
    if (error1.errorType === error2.errorType) similarity += 0.4;
    
    // Message similarity
    const commonWords = this.getCommonWords(msg1, msg2);
    similarity += (commonWords.length / Math.max(msg1.split(' ').length, msg2.split(' ').length)) * 0.6;
    
    return similarity;
  }

  getCommonWords(str1, str2) {
    const words1 = new Set(str1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(str2.split(' ').filter(w => w.length > 2));
    
    return [...words1].filter(word => words2.has(word));
  }

  async getSuccessfulPatternsForErrorType(errorType) {
    const patterns = await this.taskManager.redis.hGetAll('successful_patterns');
    const relevantPatterns = [];
    
    for (const [pattern, count] of Object.entries(patterns)) {
      if (parseInt(count) > 0) {
        relevantPatterns.push({ pattern, successCount: parseInt(count) });
      }
    }
    
    return relevantPatterns
      .sort((a, b) => b.successCount - a.successCount);
  }

  // Public API methods
  async getErrorStatistics(projectId) {
    const errorIds = await this.taskManager.redis.sMembers(`project_errors:${projectId}`);
    const stats = {
      totalErrors: errorIds.length,
      openErrors: 0,
      resolvedErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      averageSolutionAttempts: 0
    };

    let totalSolutionAttempts = 0;

    for (const errorId of errorIds) {
      const error = await this.taskManager.redis.hGetAll(`error:${errorId}`);
      
      if (error.id) {
        if (error.status === 'resolved') {
          stats.resolvedErrors++;
        } else {
          stats.openErrors++;
        }

        stats.errorsByType[error.errorType] = (stats.errorsByType[error.errorType] || 0) + 1;
        stats.errorsBySeverity[error.severity] = (stats.errorsBySeverity[error.severity] || 0) + 1;
        
        const solutionCount = await this.getSolutionCount(errorId);
        totalSolutionAttempts += solutionCount;
      }
    }

    if (stats.totalErrors > 0) {
      stats.averageSolutionAttempts = Math.round(totalSolutionAttempts / stats.totalErrors * 10) / 10;
    }

    return stats;
  }

  async getProjectErrors(projectId, status = 'all') {
    const errorIds = await this.taskManager.redis.sMembers(`project_errors:${projectId}`);
    const errors = [];

    for (const errorId of errorIds) {
      const error = await this.taskManager.redis.hGetAll(`error:${errorId}`);
      
      if (error.id && (status === 'all' || error.status === status)) {
        errors.push(error);
      }
    }

    return errors.sort((a, b) => new Date(b.lastOccurred) - new Date(a.lastOccurred));
  }
}

module.exports = { ErrorTrackingManager };