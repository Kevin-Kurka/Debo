import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

/**
 * ConfidenceEvaluator
 * 
 * PURPOSE:
 * Evaluates LLM output confidence and triggers revisions for low-confidence results.
 * Implements self-evaluation and dynamic thinking agent involvement.
 * 
 * RESPONSIBILITIES:
 * - Extract and validate confidence scores from LLM outputs
 * - Trigger revision workflows for low confidence
 * - Coordinate with thinking agents for complex evaluations
 * - Track confidence patterns and improve over time
 * 
 * TODO:
 * - None
 */
export class ConfidenceEvaluator {
  constructor(taskManager, llmProvider) {
    this.taskManager = taskManager;
    this.llmProvider = llmProvider;
    this.redis = taskManager.redis;
    
    // Confidence thresholds
    this.thresholds = {
      acceptable: 80,    // Minimum for acceptance
      review: 70,        // Needs peer review
      revision: 50,      // Requires revision
      escalation: 30     // Escalate to thinking agents
    };
    
    // Revision strategies
    this.revisionStrategies = {
      peer_review: 'Get second opinion from same role',
      thinking_review: 'Escalate to thinking agent',
      context_enhancement: 'Provide more context',
      task_breakdown: 'Break down into smaller tasks',
      expert_consultation: 'Consult domain expert'
    };
  }

  async evaluateResponse(response, task, agentId, agentRole) {
    await this.taskManager.ensureConnection();
    
    const evaluationId = uuidv4();
    const evaluation = {
      id: evaluationId,
      taskId: task.id,
      agentId,
      agentRole,
      originalResponse: response,
      timestamp: new Date().toISOString()
    };
    
    // Extract confidence score
    const confidenceData = this.extractConfidence(response);
    evaluation.confidence = confidenceData;
    
    // Validate response format
    const formatValidation = this.validateResponseFormat(response);
    evaluation.formatValidation = formatValidation;
    
    // Assess technical quality
    const qualityAssessment = await this.assessTechnicalQuality(response, task);
    evaluation.qualityAssessment = qualityAssessment;
    
    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(
      confidenceData,
      formatValidation,
      qualityAssessment
    );
    evaluation.overallConfidence = overallConfidence;
    
    // Determine action based on confidence
    const action = this.determineAction(overallConfidence, task);
    evaluation.recommendedAction = action;
    
    // Store evaluation
    await this.storeEvaluation(evaluation);
    
    // Execute action if needed
    if (action.type !== 'accept') {
      return await this.executeRevisionAction(evaluation, action);
    }
    
    return {
      accepted: true,
      confidence: overallConfidence.score,
      evaluation
    };
  }

  extractConfidence(response) {
    const confidencePatterns = [
      /CONFIDENCE SCORE:\s*(\d+)%/i,
      /Confidence:\s*(\d+)%/i,
      /I am (\d+)% confident/i,
      /(\d+)% sure/i
    ];
    
    let extractedScore = null;
    let extractedReasoning = '';
    
    // Try to extract confidence score
    for (const pattern of confidencePatterns) {
      const match = response.match(pattern);
      if (match) {
        extractedScore = parseInt(match[1]);
        break;
      }
    }
    
    // Extract reasoning if present
    const reasoningMatch = response.match(/REASONING:\s*([^\n]+(?:\n(?!IMPLEMENTATION:|TESTING:|CONSIDERATIONS:)[^\n]+)*)/i);
    if (reasoningMatch) {
      extractedReasoning = reasoningMatch[1].trim();
    }
    
    // Check for uncertainty indicators
    const uncertaintyIndicators = [
      'might work', 'probably', 'should work', 'likely',
      'not sure', 'uncertain', 'guess', 'assume'
    ];
    
    const hasUncertainty = uncertaintyIndicators.some(indicator =>
      response.toLowerCase().includes(indicator)
    );
    
    return {
      explicit: extractedScore,
      reasoning: extractedReasoning,
      hasUncertainty,
      uncertaintyIndicators: uncertaintyIndicators.filter(indicator =>
        response.toLowerCase().includes(indicator)
      )
    };
  }

  validateResponseFormat(response) {
    const requiredSections = [
      'CONFIDENCE SCORE',
      'REASONING',
      'IMPLEMENTATION',
      'TESTING',
      'CONSIDERATIONS'
    ];
    
    const validation = {
      hasAllSections: true,
      missingSections: [],
      hasCode: false,
      hasComments: false,
      hasTodos: false
    };
    
    // Check for required sections
    for (const section of requiredSections) {
      if (!response.toUpperCase().includes(section)) {
        validation.hasAllSections = false;
        validation.missingSections.push(section);
      }
    }
    
    // Check for code blocks
    validation.hasCode = /```[\s\S]*?```/.test(response);
    
    // Check for comments in code
    validation.hasComments = /\/\*[\s\S]*?\*\/|\/\/.*$/m.test(response);
    
    // Check for TODOs
    validation.hasTodos = /TODO:/i.test(response);
    
    return validation;
  }

  async assessTechnicalQuality(response, task) {
    const assessment = {
      codeQuality: 0,
      completeness: 0,
      bestPractices: 0,
      errorHandling: 0,
      documentation: 0
    };
    
    // Extract code blocks for analysis
    const codeBlocks = response.match(/```[\s\S]*?```/g) || [];
    
    if (codeBlocks.length > 0) {
      for (const block of codeBlocks) {
        const code = block.replace(/```\w*\n?/g, '').replace(/```$/g, '');
        
        // Assess code quality
        assessment.codeQuality += this.assessCodeQuality(code);
        
        // Check for error handling
        if (/try\s*{|catch\s*\(|\.catch\(|throw\s+new/.test(code)) {
          assessment.errorHandling += 20;
        }
        
        // Check for input validation
        if (/validate|check|verify|sanitize/.test(code)) {
          assessment.bestPractices += 15;
        }
        
        // Check for logging
        if (/log|console\.|logger\./.test(code)) {
          assessment.bestPractices += 10;
        }
        
        // Check for comments
        if (/\/\*[\s\S]*?\*\/|\/\//.test(code)) {
          assessment.documentation += 20;
        }
      }
      
      // Normalize scores
      const blockCount = codeBlocks.length;
      Object.keys(assessment).forEach(key => {
        assessment[key] = Math.min(100, assessment[key] / blockCount);
      });
    }
    
    // Assess completeness based on deliverables
    assessment.completeness = this.assessCompleteness(response, task.deliverables);
    
    return assessment;
  }

  assessCodeQuality(code) {
    let score = 50; // Base score
    
    // Positive indicators
    if (/async|await/.test(code)) score += 10; // Modern async patterns
    if (/const|let/.test(code) && !/var/.test(code)) score += 10; // Modern variable declarations
    if (/\w+\s*=>\s*{/.test(code)) score += 5; // Arrow functions
    if (/export|import/.test(code)) score += 5; // Module usage
    
    // Negative indicators
    if (/eval\(|innerHTML\s*=/.test(code)) score -= 20; // Dangerous patterns
    if (/var\s+/.test(code)) score -= 10; // Old variable declarations
    if (code.split('\n').some(line => line.length > 120)) score -= 5; // Long lines
    
    return Math.max(0, Math.min(100, score));
  }

  assessCompleteness(response, deliverables) {
    if (!deliverables || Object.keys(deliverables).length === 0) {
      return 100; // No specific deliverables required
    }
    
    let foundDeliverables = 0;
    const totalDeliverables = Object.keys(deliverables).length;
    
    for (const deliverable of Object.keys(deliverables)) {
      if (response.toLowerCase().includes(deliverable.toLowerCase())) {
        foundDeliverables++;
      }
    }
    
    return (foundDeliverables / totalDeliverables) * 100;
  }

  calculateOverallConfidence(confidenceData, formatValidation, qualityAssessment) {
    let score = 0;
    const weights = {
      explicit: 0.4,      // Explicit confidence score
      format: 0.2,        // Response format compliance
      quality: 0.3,       // Technical quality
      uncertainty: 0.1    // Uncertainty indicators
    };
    
    // Explicit confidence score
    if (confidenceData.explicit !== null) {
      score += confidenceData.explicit * weights.explicit;
    } else {
      score += 50 * weights.explicit; // Default if no explicit score
    }
    
    // Format compliance
    const formatScore = formatValidation.hasAllSections ? 100 : 
      ((5 - formatValidation.missingSections.length) / 5) * 100;
    score += formatScore * weights.format;
    
    // Technical quality (average of all quality metrics)
    const avgQuality = Object.values(qualityAssessment).reduce((a, b) => a + b, 0) / 
      Object.keys(qualityAssessment).length;
    score += avgQuality * weights.quality;
    
    // Uncertainty penalty
    const uncertaintyPenalty = confidenceData.hasUncertainty ? 30 : 0;
    score -= uncertaintyPenalty * weights.uncertainty;
    
    return {
      score: Math.max(0, Math.min(100, score)),
      breakdown: {
        explicit: confidenceData.explicit,
        format: formatScore,
        quality: avgQuality,
        uncertainty: uncertaintyPenalty
      }
    };
  }

  determineAction(overallConfidence, task) {
    const score = overallConfidence.score;
    
    if (score >= this.thresholds.acceptable) {
      return { type: 'accept', reason: 'Confidence meets acceptance criteria' };
    } else if (score >= this.thresholds.review) {
      return { 
        type: 'peer_review', 
        reason: 'Moderate confidence - needs peer review',
        strategy: this.revisionStrategies.peer_review
      };
    } else if (score >= this.thresholds.revision) {
      return { 
        type: 'revision', 
        reason: 'Low confidence - needs revision',
        strategy: this.selectRevisionStrategy(overallConfidence, task)
      };
    } else {
      return { 
        type: 'escalation', 
        reason: 'Very low confidence - escalate to thinking agents',
        strategy: this.revisionStrategies.thinking_review
      };
    }
  }

  selectRevisionStrategy(confidence, task) {
    const breakdown = confidence.breakdown;
    
    // If format is the main issue
    if (breakdown.format < 70) {
      return this.revisionStrategies.context_enhancement;
    }
    
    // If quality is the main issue
    if (breakdown.quality < 60) {
      return this.revisionStrategies.expert_consultation;
    }
    
    // If task seems complex
    if (task.estimatedTime > 240) { // > 4 hours
      return this.revisionStrategies.task_breakdown;
    }
    
    return this.revisionStrategies.thinking_review;
  }

  async executeRevisionAction(evaluation, action) {
    const revisionId = uuidv4();
    
    switch (action.type) {
      case 'peer_review':
        return await this.requestPeerReview(evaluation, revisionId);
        
      case 'revision':
        return await this.requestRevision(evaluation, action.strategy, revisionId);
        
      case 'escalation':
        return await this.escalateToThinkingAgent(evaluation, revisionId);
        
      default:
        return { accepted: false, reason: 'Unknown action type' };
    }
  }

  async requestPeerReview(evaluation, revisionId) {
    // Create a peer review task
    const reviewTask = {
      id: uuidv4(),
      projectId: evaluation.task?.projectId,
      type: 'peer_review',
      requiredRole: evaluation.agentRole, // Same role for peer review
      priority: 'high',
      title: `Peer review for task ${evaluation.taskId}`,
      description: `Review the following solution and provide feedback:\n\n${evaluation.originalResponse}`,
      deliverables: {
        review: 'Detailed review comments',
        confidence: 'Your confidence in the original solution',
        suggestions: 'Improvement suggestions'
      },
      originalTaskId: evaluation.taskId,
      revisionId
    };
    
    await this.taskManager.agentQueue.enqueueTask(reviewTask);
    
    return {
      accepted: false,
      reason: 'Sent for peer review',
      revisionId,
      nextStep: 'peer_review'
    };
  }

  async requestRevision(evaluation, strategy, revisionId) {
    // Create enhanced context based on strategy
    const enhancedContext = await this.createEnhancedContext(evaluation, strategy);
    
    // Create revision task
    const revisionTask = {
      id: uuidv4(),
      projectId: evaluation.task?.projectId,
      type: 'revision',
      requiredRole: evaluation.agentRole,
      priority: 'high',
      title: `Revision for task ${evaluation.taskId}`,
      description: `Revise the previous solution based on low confidence score.\n\nOriginal attempt:\n${evaluation.originalResponse}\n\nIssues identified:\n${this.formatIssues(evaluation)}\n\nEnhanced context:\n${enhancedContext}`,
      deliverables: evaluation.task?.deliverables || {},
      originalTaskId: evaluation.taskId,
      revisionId,
      revisionStrategy: strategy
    };
    
    await this.taskManager.agentQueue.enqueueTask(revisionTask);
    
    return {
      accepted: false,
      reason: `Revision requested: ${strategy}`,
      revisionId,
      nextStep: 'revision'
    };
  }

  async escalateToThinkingAgent(evaluation, revisionId) {
    // Select appropriate thinking agent
    const thinkingRole = this.selectThinkingAgent(evaluation.agentRole);
    
    // Create escalation task
    const escalationTask = {
      id: uuidv4(),
      projectId: evaluation.task?.projectId,
      type: 'escalation_review',
      requiredRole: thinkingRole,
      priority: 'critical',
      title: `Escalation review for task ${evaluation.taskId}`,
      description: `A ${evaluation.agentRole} provided a low-confidence solution. Please review and provide guidance.\n\nOriginal task:\n${JSON.stringify(evaluation.task, null, 2)}\n\nLow-confidence solution:\n${evaluation.originalResponse}\n\nConfidence analysis:\n${JSON.stringify(evaluation.confidence, null, 2)}`,
      deliverables: {
        analysis: 'Analysis of the problem and solution approach',
        guidance: 'Specific guidance for the agent',
        approach: 'Recommended implementation approach',
        resources: 'Additional resources or context needed'
      },
      originalTaskId: evaluation.taskId,
      revisionId
    };
    
    await this.taskManager.agentQueue.enqueueTask(escalationTask);
    
    return {
      accepted: false,
      reason: `Escalated to ${thinkingRole}`,
      revisionId,
      nextStep: 'thinking_review'
    };
  }

  selectThinkingAgent(executionRole) {
    const escalationMap = {
      backend_developer: 'solution_architect',
      frontend_developer: 'solution_architect',
      qa_engineer: 'engineering_manager',
      devops_engineer: 'solution_architect',
      security_engineer: 'solution_architect',
      ux_designer: 'product_manager'
    };
    
    return escalationMap[executionRole] || 'cto';
  }

  async createEnhancedContext(evaluation, strategy) {
    let enhancement = '';
    
    switch (strategy) {
      case 'context_enhancement':
        // Add more documentation and examples
        const docs = await this.taskManager.documentation.queryDocumentation(
          evaluation.task?.description || '',
          { maxResults: 5 }
        );
        enhancement = `Additional Documentation:\n${JSON.stringify(docs, null, 2)}`;
        break;
        
      case 'expert_consultation':
        // Add expert patterns and best practices
        const patterns = await this.getExpertPatterns(evaluation.agentRole);
        enhancement = `Expert Patterns:\n${JSON.stringify(patterns, null, 2)}`;
        break;
        
      case 'task_breakdown':
        // Suggest breaking down the task
        enhancement = 'Consider breaking this task into smaller, more manageable subtasks.';
        break;
        
      default:
        enhancement = 'Please review the requirements more carefully and provide a more confident solution.';
    }
    
    return enhancement;
  }

  formatIssues(evaluation) {
    const issues = [];
    
    if (evaluation.confidence.explicit !== null && evaluation.confidence.explicit < 70) {
      issues.push(`Low self-reported confidence: ${evaluation.confidence.explicit}%`);
    }
    
    if (evaluation.confidence.hasUncertainty) {
      issues.push(`Uncertainty indicators found: ${evaluation.confidence.uncertaintyIndicators.join(', ')}`);
    }
    
    if (!evaluation.formatValidation.hasAllSections) {
      issues.push(`Missing required sections: ${evaluation.formatValidation.missingSections.join(', ')}`);
    }
    
    const qualityIssues = Object.entries(evaluation.qualityAssessment)
      .filter(([key, value]) => value < 70)
      .map(([key, value]) => `${key}: ${value.toFixed(0)}%`);
    
    if (qualityIssues.length > 0) {
      issues.push(`Quality concerns: ${qualityIssues.join(', ')}`);
    }
    
    return issues.join('\n');
  }

  async getExpertPatterns(role) {
    // Get expert patterns for the role
    const patterns = await this.redis.hGetAll(`patterns:${role}`);
    return patterns || {};
  }

  async storeEvaluation(evaluation) {
    await this.redis.hSet(`evaluation:${evaluation.id}`, {
      ...evaluation,
      confidence: JSON.stringify(evaluation.confidence),
      formatValidation: JSON.stringify(evaluation.formatValidation),
      qualityAssessment: JSON.stringify(evaluation.qualityAssessment),
      overallConfidence: JSON.stringify(evaluation.overallConfidence)
    });
    
    // Track confidence trends
    await this.updateConfidenceTrends(evaluation);
  }

  async updateConfidenceTrends(evaluation) {
    const trendKey = `confidence_trend:${evaluation.agentId}`;
    const trend = {
      timestamp: evaluation.timestamp,
      confidence: evaluation.overallConfidence.score,
      taskType: evaluation.task?.type || 'unknown'
    };
    
    await this.redis.lPush(trendKey, JSON.stringify(trend));
    
    // Keep only last 100 evaluations
    await this.redis.lTrim(trendKey, 0, 99);
  }

  async getConfidenceTrends(agentId) {
    const trends = await this.redis.lRange(`confidence_trend:${agentId}`, 0, -1);
    return trends.map(t => JSON.parse(t));
  }

  async getEvaluationStats() {
    const stats = {
      totalEvaluations: 0,
      acceptanceRate: 0,
      averageConfidence: 0,
      revisionRate: 0,
      escalationRate: 0
    };
    
    const evaluationKeys = await this.redis.keys('evaluation:*');
    stats.totalEvaluations = evaluationKeys.length;
    
    if (stats.totalEvaluations > 0) {
      let totalConfidence = 0;
      let revisions = 0;
      let escalations = 0;
      let accepted = 0;
      
      for (const key of evaluationKeys) {
        const eval = await this.redis.hGetAll(key);
        const confidence = JSON.parse(eval.overallConfidence || '{}');
        totalConfidence += confidence.score || 0;
        
        if (eval.recommendedAction) {
          const action = JSON.parse(eval.recommendedAction);
          if (action.type === 'accept') accepted++;
          else if (action.type === 'revision') revisions++;
          else if (action.type === 'escalation') escalations++;
        }
      }
      
      stats.averageConfidence = totalConfidence / stats.totalEvaluations;
      stats.acceptanceRate = (accepted / stats.totalEvaluations) * 100;
      stats.revisionRate = (revisions / stats.totalEvaluations) * 100;
      stats.escalationRate = (escalations / stats.totalEvaluations) * 100;
    }
    
    return stats;
  }
}