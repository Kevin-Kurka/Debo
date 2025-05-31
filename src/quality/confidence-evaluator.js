/**
 * Confidence Evaluator for Debo
 * Evaluates confidence levels for all coding tasks and prevents low-confidence implementations
 */

const logger = require('../logger.js');

class ConfidenceEvaluator {
  constructor(llmProvider, taskManager) {
    this.llmProvider = llmProvider;
    this.taskManager = taskManager;
    this.confidenceThreshold = 90; // 90% minimum confidence
    this.evaluationCriteria = this.initializeEvaluationCriteria();
  }

  initializeEvaluationCriteria() {
    return {
      code_generation: {
        accuracy: 0.25,      // Code correctness and syntax
        completeness: 0.20,  // Fulfills all requirements
        best_practices: 0.20, // Follows coding standards
        maintainability: 0.15, // Code readability and structure
        performance: 0.10,   // Efficiency considerations
        security: 0.10       // Security implications
      },
      architecture: {
        scalability: 0.30,   // System can grow
        reliability: 0.25,   // System stability
        maintainability: 0.20, // Easy to modify
        performance: 0.15,   // System efficiency
        security: 0.10       // Security architecture
      },
      bug_fix: {
        root_cause: 0.35,    // Addresses actual problem
        correctness: 0.30,   // Fix is correct
        side_effects: 0.20,  // No unintended consequences
        testing: 0.15        // Verifiable solution
      },
      feature_implementation: {
        requirements: 0.30,   // Meets all requirements
        integration: 0.25,   // Integrates well with existing code
        usability: 0.20,     // User-friendly implementation
        performance: 0.15,   // Efficient implementation
        testability: 0.10    // Can be properly tested
      }
    };
  }

  async evaluateTaskConfidence(task, proposedSolution) {
    logger.info(`Evaluating confidence for task: ${task.id} (${task.type})`);

    // Get task-specific criteria
    const criteria = this.evaluationCriteria[task.type] || this.evaluationCriteria.code_generation;
    
    // Evaluate each criterion
    const scores = {};
    let totalScore = 0;

    for (const [criterion, weight] of Object.entries(criteria)) {
      const score = await this.evaluateCriterion(task, proposedSolution, criterion);
      scores[criterion] = score;
      totalScore += score * weight;
    }

    const confidencePercentage = Math.round(totalScore);

    // Store evaluation results
    const evaluation = {
      taskId: task.id,
      confidencePercentage,
      criteriaScores: scores,
      proposedSolution: this.sanitizeSolution(proposedSolution),
      evaluatedAt: new Date().toISOString(),
      meetsThreshold: confidencePercentage >= this.confidenceThreshold
    };

    await this.storeEvaluation(evaluation);

    return evaluation;
  }

  async evaluateCriterion(task, solution, criterion) {
    const evaluationPrompt = this.createEvaluationPrompt(task, solution, criterion);
    
    try {
      const response = await this.llmProvider.generateResponse(evaluationPrompt, 'thinking');
      const score = this.parseConfidenceScore(response);
      
      logger.debug(`Criterion ${criterion}: ${score}/100`);
      return score;
    } catch (error) {
      logger.error(`Failed to evaluate criterion ${criterion}:`, error);
      return 50; // Default middle score on error
    }
  }

  createEvaluationPrompt(task, solution, criterion) {
    const criterionDescriptions = {
      accuracy: 'Is the code syntactically correct and logically sound?',
      completeness: 'Does the solution fulfill ALL specified requirements?',
      best_practices: 'Does the code follow established best practices and conventions?',
      maintainability: 'Is the code clean, readable, and easy to maintain?',
      performance: 'Is the solution efficient and performant?',
      security: 'Does the solution follow security best practices?',
      scalability: 'Can the system handle increased load and growth?',
      reliability: 'Is the system stable and dependable?',
      root_cause: 'Does the fix address the actual root cause of the problem?',
      correctness: 'Is the proposed fix technically correct?',
      side_effects: 'Are there any negative side effects from this change?',
      testing: 'Can this solution be properly tested and verified?',
      requirements: 'Does the implementation meet all specified requirements?',
      integration: 'Does this integrate well with existing systems?',
      usability: 'Is this user-friendly and intuitive?',
      testability: 'Can this be easily tested and validated?'
    };

    return `
Evaluate the confidence level for this ${criterion} criterion:

TASK:
Type: ${task.type}
Description: ${task.description}
Requirements: ${JSON.stringify(task.requirements || {})}

PROPOSED SOLUTION:
${solution}

EVALUATION CRITERION: ${criterion.toUpperCase()}
Question: ${criterionDescriptions[criterion]}

Consider:
- Technical correctness
- Alignment with requirements
- Industry best practices
- Potential risks and issues
- Overall quality

Rate your confidence that this solution excels in the "${criterion}" criterion.

Provide:
1. A detailed analysis (2-3 sentences)
2. Specific concerns or strengths
3. A confidence score from 0-100

Format your response as:
ANALYSIS: [Your detailed analysis]
CONCERNS: [Any specific concerns or "None identified"]
STRENGTHS: [Key strengths of the solution]
CONFIDENCE: [0-100 number only]
`;
  }

  parseConfidenceScore(response) {
    // Extract confidence score from response
    const confidenceMatch = response.match(/CONFIDENCE:\s*(\d+)/i);
    if (confidenceMatch) {
      const score = parseInt(confidenceMatch[1]);
      return Math.min(Math.max(score, 0), 100); // Clamp between 0-100
    }

    // Fallback: look for any percentage in the response
    const percentageMatch = response.match(/(\d+)%/);
    if (percentageMatch) {
      const score = parseInt(percentageMatch[1]);
      return Math.min(Math.max(score, 0), 100);
    }

    // Last resort: analyze sentiment
    return this.analyzeSentimentConfidence(response);
  }

  analyzeSentimentConfidence(response) {
    const positiveWords = ['excellent', 'good', 'solid', 'correct', 'proper', 'well', 'strong'];
    const negativeWords = ['poor', 'bad', 'incorrect', 'wrong', 'weak', 'problematic', 'concerning'];
    const uncertainWords = ['might', 'could', 'maybe', 'possibly', 'uncertain', 'unclear'];

    const lowerResponse = response.toLowerCase();
    
    let positiveCount = positiveWords.filter(word => lowerResponse.includes(word)).length;
    let negativeCount = negativeWords.filter(word => lowerResponse.includes(word)).length;
    let uncertainCount = uncertainWords.filter(word => lowerResponse.includes(word)).length;

    // Base score calculation
    let score = 70; // Default middle-high score
    score += positiveCount * 5;  // Boost for positive indicators
    score -= negativeCount * 8;  // Penalty for negative indicators
    score -= uncertainCount * 3; // Small penalty for uncertainty

    return Math.min(Math.max(score, 0), 100);
  }

  async createConfidenceFeedbackLoop(task, evaluation) {
    if (evaluation.meetsThreshold) {
      logger.info(`Task ${task.id} meets confidence threshold: ${evaluation.confidencePercentage}%`);
      return { approved: true, message: 'Confidence threshold met' };
    }

    logger.warn(`Task ${task.id} below confidence threshold: ${evaluation.confidencePercentage}% < ${this.confidenceThreshold}%`);

    // Identify areas for improvement
    const lowScoreCriteria = Object.entries(evaluation.criteriaScores)
      .filter(([_, score]) => score < 70)
      .map(([criterion, score]) => ({ criterion, score }))
      .sort((a, b) => a.score - b.score);

    // Generate improvement suggestions
    const improvementSuggestions = await this.generateImprovementSuggestions(task, lowScoreCriteria);

    // Create feedback for agent
    const feedback = {
      approved: false,
      confidencePercentage: evaluation.confidencePercentage,
      threshold: this.confidenceThreshold,
      areasForImprovement: lowScoreCriteria,
      suggestions: improvementSuggestions,
      nextSteps: this.determineNextSteps(evaluation.confidencePercentage, lowScoreCriteria)
    };

    // Store feedback
    await this.storeFeedback(task.id, feedback);

    return feedback;
  }

  async generateImprovementSuggestions(task, lowScoreCriteria) {
    if (lowScoreCriteria.length === 0) return [];

    const prompt = `
Task: ${task.description}
Low-scoring criteria: ${lowScoreCriteria.map(c => `${c.criterion}: ${c.score}%`).join(', ')}

Generate specific, actionable suggestions to improve these areas:

For each low-scoring criterion, provide:
1. What specifically needs improvement
2. How to address the issue
3. Best practices to follow

Return as JSON array:
[{
  "criterion": "criterion_name",
  "issue": "specific problem identified",
  "solution": "actionable improvement step",
  "bestPractice": "relevant best practice"
}]
`;

    try {
      const response = await this.llmProvider.generateResponse(prompt, 'thinking');
      return JSON.parse(response);
    } catch (error) {
      logger.error('Failed to generate improvement suggestions:', error);
      return lowScoreCriteria.map(c => ({
        criterion: c.criterion,
        issue: `Low confidence score: ${c.score}%`,
        solution: 'Review and revise the solution approach',
        bestPractice: 'Follow established industry standards'
      }));
    }
  }

  determineNextSteps(confidencePercentage, lowScoreCriteria) {
    if (confidencePercentage < 50) {
      return {
        action: 'escalate_to_architect',
        reason: 'Very low confidence - requires architectural review',
        priority: 'high'
      };
    }

    if (confidencePercentage < 70) {
      return {
        action: 'research_alternatives',
        reason: 'Low confidence - explore alternative solutions',
        priority: 'medium'
      };
    }

    if (lowScoreCriteria.length > 3) {
      return {
        action: 'comprehensive_revision',
        reason: 'Multiple areas need improvement',
        priority: 'medium'
      };
    }

    return {
      action: 'targeted_improvement',
      reason: 'Address specific low-scoring areas',
      priority: 'low'
    };
  }

  async storeEvaluation(evaluation) {
    const key = `confidence_evaluation:${evaluation.taskId}:${Date.now()}`;
    
    await this.taskManager.redis.hSet(key, {
      ...evaluation,
      criteriaScores: JSON.stringify(evaluation.criteriaScores),
      proposedSolution: JSON.stringify(evaluation.proposedSolution)
    });

    // Add to task's evaluation history
    await this.taskManager.redis.lPush(
      `task_evaluations:${evaluation.taskId}`,
      key
    );

    // Keep only last 10 evaluations per task
    await this.taskManager.redis.lTrim(`task_evaluations:${evaluation.taskId}`, 0, 9);
  }

  async storeFeedback(taskId, feedback) {
    const key = `confidence_feedback:${taskId}:${Date.now()}`;
    
    await this.taskManager.redis.hSet(key, {
      ...feedback,
      areasForImprovement: JSON.stringify(feedback.areasForImprovement),
      suggestions: JSON.stringify(feedback.suggestions),
      nextSteps: JSON.stringify(feedback.nextSteps)
    });
  }

  async getTaskEvaluationHistory(taskId) {
    const evaluationKeys = await this.taskManager.redis.lRange(`task_evaluations:${taskId}`, 0, -1);
    const evaluations = [];

    for (const key of evaluationKeys) {
      const evaluation = await this.taskManager.redis.hGetAll(key);
      if (evaluation.taskId) {
        evaluation.criteriaScores = JSON.parse(evaluation.criteriaScores || '{}');
        evaluation.proposedSolution = JSON.parse(evaluation.proposedSolution || '{}');
        evaluations.push(evaluation);
      }
    }

    return evaluations.sort((a, b) => new Date(b.evaluatedAt) - new Date(a.evaluatedAt));
  }

  async getConfidenceStatistics(projectId) {
    // Get all tasks for project
    const tasks = await this.taskManager.getProjectTasks(projectId);
    const stats = {
      totalTasks: tasks.length,
      evaluatedTasks: 0,
      averageConfidence: 0,
      aboveThreshold: 0,
      belowThreshold: 0,
      criteriaBreakdown: {}
    };

    let totalConfidence = 0;
    const allCriteriaScores = {};

    for (const task of tasks) {
      const evaluations = await this.getTaskEvaluationHistory(task.id);
      
      if (evaluations.length > 0) {
        const latestEvaluation = evaluations[0];
        stats.evaluatedTasks++;
        
        const confidence = parseInt(latestEvaluation.confidencePercentage);
        totalConfidence += confidence;
        
        if (confidence >= this.confidenceThreshold) {
          stats.aboveThreshold++;
        } else {
          stats.belowThreshold++;
        }

        // Aggregate criteria scores
        for (const [criterion, score] of Object.entries(latestEvaluation.criteriaScores)) {
          if (!allCriteriaScores[criterion]) {
            allCriteriaScores[criterion] = [];
          }
          allCriteriaScores[criterion].push(parseInt(score));
        }
      }
    }

    if (stats.evaluatedTasks > 0) {
      stats.averageConfidence = Math.round(totalConfidence / stats.evaluatedTasks);
      
      // Calculate average scores per criterion
      for (const [criterion, scores] of Object.entries(allCriteriaScores)) {
        stats.criteriaBreakdown[criterion] = Math.round(
          scores.reduce((sum, score) => sum + score, 0) / scores.length
        );
      }
    }

    return stats;
  }

  sanitizeSolution(solution) {
    // Remove sensitive information and limit size for storage
    if (typeof solution === 'string') {
      return {
        type: 'string',
        preview: solution.substring(0, 500),
        length: solution.length
      };
    }
    
    if (typeof solution === 'object') {
      return {
        type: 'object',
        keys: Object.keys(solution),
        preview: JSON.stringify(solution).substring(0, 500)
      };
    }

    return {
      type: typeof solution,
      value: String(solution).substring(0, 100)
    };
  }

  // Public API methods
  async evaluateCodeGeneration(task, code) {
    return await this.evaluateTaskConfidence({
      ...task,
      type: 'code_generation'
    }, code);
  }

  async evaluateBugFix(task, fix) {
    return await this.evaluateTaskConfidence({
      ...task,
      type: 'bug_fix'
    }, fix);
  }

  async evaluateArchitecture(task, architecture) {
    return await this.evaluateTaskConfidence({
      ...task,
      type: 'architecture'
    }, architecture);
  }

  async evaluateFeatureImplementation(task, implementation) {
    return await this.evaluateTaskConfidence({
      ...task,
      type: 'feature_implementation'
    }, implementation);
  }

  setConfidenceThreshold(threshold) {
    this.confidenceThreshold = Math.min(Math.max(threshold, 0), 100);
    logger.info(`Confidence threshold updated to ${this.confidenceThreshold}%`);
  }

  getConfidenceThreshold() {
    return this.confidenceThreshold;
  }
}

module.exports = { ConfidenceEvaluator };