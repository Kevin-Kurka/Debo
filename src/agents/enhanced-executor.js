import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';
import AgentDatabaseIntegration from './agent-database-integration.js';

/**
 * Enhanced Agent Executor
 * 
 * PURPOSE:
 * Executes agents with complete database integration, ensuring every database
 * table is properly utilized as a project management tool.
 * 
 * FEATURES:
 * - Comprehensive input validation
 * - Database-driven agent execution
 * - Complete deliverable tracking
 * - Success criteria validation
 * - Project state management
 * 
 * TODO:
 * - None
 */
export class EnhancedAgentExecutor {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.dbIntegration = new AgentDatabaseIntegration(taskManager);
    this.redis = taskManager.redis;
    this.activeExecutions = new Map();
  }

  async executeAgent(agentId, task) {
    const executionId = uuidv4();
    logger.info(`Starting agent execution: ${agentId} for task: ${task.id}`);
    
    this.activeExecutions.set(executionId, {
      agentId,
      taskId: task.id,
      startTime: Date.now(),
      status: 'running'
    });

    try {
      // 1. Validate agent role and capabilities
      const agentRole = task.requiredRole;
      if (!this.dbIntegration.agentSpecs[agentRole]) {
        throw new Error(`Unknown agent role: ${agentRole}`);
      }

      // 2. Pre-execution validation
      await this.preExecutionValidation(agentId, agentRole, task);

      // 3. Execute agent with full database integration
      const result = await this.dbIntegration.executeAgentTask(agentId, agentRole, task);

      // 4. Post-execution processing
      await this.postExecutionProcessing(executionId, agentId, task, result);

      // 5. Update execution tracking
      this.activeExecutions.set(executionId, {
        ...this.activeExecutions.get(executionId),
        status: 'completed',
        success: result.success,
        endTime: Date.now()
      });

      logger.info(`Agent execution completed successfully: ${agentId}`);
      return result;

    } catch (error) {
      // Handle execution failure
      await this.handleExecutionFailure(executionId, agentId, task, error);
      throw error;
    } finally {
      // Cleanup
      setTimeout(() => this.activeExecutions.delete(executionId), 300000); // 5 minutes
    }
  }

  async preExecutionValidation(agentId, agentRole, task) {
    // 1. Check agent readiness
    const agentStatus = await this.getAgentStatus(agentId);
    if (agentStatus.status !== 'available') {
      throw new Error(`Agent ${agentId} not available: ${agentStatus.reason}`);
    }

    // 2. Validate project exists and is active
    const project = await this.redis.hGetAll(`project:${task.projectId}`);
    if (!project || project.status === 'archived') {
      throw new Error(`Project ${task.projectId} not found or archived`);
    }

    // 3. Check for blocking dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      const blockers = await this.checkTaskDependencies(task.dependencies);
      if (blockers.length > 0) {
        throw new Error(`Task blocked by incomplete dependencies: ${blockers.join(', ')}`);
      }
    }

    // 4. Validate required database state
    await this.validateDatabasePrerequisites(agentRole, task);
  }

  async validateDatabasePrerequisites(agentRole, task) {
    const agentSpec = this.dbIntegration.agentSpecs[agentRole];
    const missingPrereqs = [];

    // Check required data based on agent type
    switch (agentRole) {
      case 'backend_developer':
        // Needs API specifications from solution architect
        const apiSpecs = await this.redis.hGetAll(`architecture:${task.projectId}`);
        if (!apiSpecs || !apiSpecs.apiReference) {
          missingPrereqs.push('API specifications');
        }
        break;

      case 'frontend_developer':
        // Needs UI specifications and API contracts
        const uiSpecs = await this.redis.hGetAll(`design:${task.projectId}`);
        if (!uiSpecs) {
          missingPrereqs.push('UI specifications');
        }
        break;

      case 'qa_engineer':
        // Needs requirements and implemented features
        const requirements = await this.redis.sMembers(`project:${task.projectId}:requirements`);
        if (requirements.length === 0) {
          missingPrereqs.push('Documented requirements');
        }
        break;

      case 'devops_engineer':
        // Needs architecture and deployment requirements
        const infraSpecs = await this.redis.hGetAll(`infrastructure:${task.projectId}`);
        if (!infraSpecs) {
          missingPrereqs.push('Infrastructure specifications');
        }
        break;
    }

    if (missingPrereqs.length > 0) {
      throw new Error(`Missing prerequisites for ${agentRole}: ${missingPrereqs.join(', ')}`);
    }
  }

  async postExecutionProcessing(executionId, agentId, task, result) {
    // 1. Record execution metrics
    await this.recordExecutionMetrics(executionId, agentId, task, result);

    // 2. Trigger dependent tasks if applicable
    await this.triggerDependentTasks(task, result);

    // 3. Update project dashboard
    await this.updateProjectDashboard(task.projectId, agentId, result);

    // 4. Send notifications if configured
    await this.sendCompletionNotifications(task, result);

    // 5. Schedule quality checks if needed
    await this.scheduleQualityChecks(task, result);
  }

  async recordExecutionMetrics(executionId, agentId, task, result) {
    const execution = this.activeExecutions.get(executionId);
    const metrics = {
      executionId,
      agentId,
      agentRole: task.requiredRole,
      taskId: task.id,
      projectId: task.projectId,
      startTime: execution.startTime,
      endTime: Date.now(),
      duration: Date.now() - execution.startTime,
      success: result.success,
      confidence: result.confidence || 0,
      databaseUpdates: result.databaseUpdates?.length || 0,
      successCriteriaScore: result.successCriteria?.score || 0,
      timestamp: new Date().toISOString()
    };

    // Store execution metrics
    await this.redis.hSet(`execution_metrics:${executionId}`, metrics);

    // Update agent performance tracking
    await this.updateAgentPerformanceMetrics(agentId, metrics);

    // Update project performance tracking
    await this.updateProjectPerformanceMetrics(task.projectId, metrics);
  }

  async updateAgentPerformanceMetrics(agentId, execution) {
    const metricsKey = `agent_performance:${agentId}`;
    const current = await this.redis.hGetAll(metricsKey) || {};

    const updated = {
      totalExecutions: parseInt(current.totalExecutions || '0') + 1,
      successfulExecutions: parseInt(current.successfulExecutions || '0') + (execution.success ? 1 : 0),
      totalDuration: parseInt(current.totalDuration || '0') + execution.duration,
      averageConfidence: this.calculateRunningAverage(
        parseFloat(current.averageConfidence || '0'),
        parseInt(current.totalExecutions || '0'),
        execution.confidence
      ),
      lastExecution: execution.timestamp,
      currentRole: execution.agentRole
    };

    updated.successRate = (updated.successfulExecutions / updated.totalExecutions) * 100;
    updated.averageDuration = updated.totalDuration / updated.totalExecutions;

    await this.redis.hSet(metricsKey, updated);
  }

  async updateProjectPerformanceMetrics(projectId, execution) {
    const metricsKey = `project_performance:${projectId}`;
    const current = await this.redis.hGetAll(metricsKey) || {};

    const updated = {
      totalAgentExecutions: parseInt(current.totalAgentExecutions || '0') + 1,
      successfulExecutions: parseInt(current.successfulExecutions || '0') + (execution.success ? 1 : 0),
      totalDuration: parseInt(current.totalDuration || '0') + execution.duration,
      lastActivity: execution.timestamp
    };

    // Track by agent role
    const roleKey = `${execution.agentRole}Executions`;
    updated[roleKey] = parseInt(current[roleKey] || '0') + 1;

    await this.redis.hSet(metricsKey, updated);
  }

  async triggerDependentTasks(completedTask, result) {
    if (!result.success) return;

    // Find tasks that depend on this completed task
    const dependentTaskIds = await this.redis.sMembers(`task:${completedTask.id}:dependents`);

    for (const taskId of dependentTaskIds) {
      const task = await this.redis.hGetAll(`queued_task:${taskId}`);
      if (!task) continue;

      // Update task dependencies
      const blockedBy = JSON.parse(task.blockedBy || '[]');
      const updatedBlockedBy = blockedBy.filter(id => id !== completedTask.id);

      await this.redis.hSet(`queued_task:${taskId}`, {
        blockedBy: JSON.stringify(updatedBlockedBy)
      });

      // If no longer blocked, increase priority
      if (updatedBlockedBy.length === 0 && blockedBy.length > 0) {
        const queueKey = `agent_queue:${task.requiredRole}`;
        const currentScore = await this.redis.zScore(queueKey, taskId);
        if (currentScore) {
          await this.redis.zAdd(queueKey, {
            score: currentScore + 1000000, // Boost priority
            value: taskId
          });
        }

        logger.info(`Task ${taskId} unblocked and priority boosted`);
      }
    }
  }

  async updateProjectDashboard(projectId, agentId, result) {
    // Update real-time project dashboard
    const dashboardUpdate = {
      timestamp: new Date().toISOString(),
      agentId,
      result: result.success ? 'success' : 'failure',
      confidence: result.confidence,
      deliverables: Object.keys(result.deliverables || {}).length
    };

    // Store in dashboard feed
    await this.redis.lPush(`dashboard:${projectId}:feed`, JSON.stringify(dashboardUpdate));

    // Keep only last 100 updates
    await this.redis.lTrim(`dashboard:${projectId}:feed`, 0, 99);

    // Update dashboard statistics
    await this.updateDashboardStats(projectId, result);
  }

  async updateDashboardStats(projectId, result) {
    const statsKey = `dashboard:${projectId}:stats`;
    const current = await this.redis.hGetAll(statsKey) || {};

    const updated = {
      totalTasks: parseInt(current.totalTasks || '0') + 1,
      successfulTasks: parseInt(current.successfulTasks || '0') + (result.success ? 1 : 0),
      totalDeliverables: parseInt(current.totalDeliverables || '0') + 
        Object.keys(result.deliverables || {}).length,
      lastUpdate: new Date().toISOString()
    };

    updated.successRate = (updated.successfulTasks / updated.totalTasks) * 100;

    await this.redis.hSet(statsKey, updated);
  }

  async sendCompletionNotifications(task, result) {
    // Send completion notification
    await this.taskManager.feedback.sendFeedback(task.projectId, {
      type: 'task_completion',
      severity: result.success ? 'info' : 'warning',
      title: `Task ${result.success ? 'Completed' : 'Failed'}: ${task.title}`,
      message: `Agent ${task.requiredRole} ${result.success ? 'completed' : 'failed'} task with ${(result.confidence || 0).toFixed(0)}% confidence`,
      details: {
        taskId: task.id,
        agentRole: task.requiredRole,
        deliverables: Object.keys(result.deliverables || {}),
        successCriteria: result.successCriteria
      }
    });
  }

  async scheduleQualityChecks(task, result) {
    if (!result.success) return;

    // Determine if quality check is needed
    const codeDeliverables = ['api_endpoints', 'ui_components', 'test_scripts', 'infrastructure_code'];
    const hasCodeDeliverables = Object.keys(result.deliverables || {}).some(d => 
      codeDeliverables.includes(d)
    );

    if (hasCodeDeliverables) {
      // Schedule QA review task
      const qaTask = {
        projectId: task.projectId,
        type: 'quality_review',
        requiredRole: 'qa_engineer',
        priority: 'high',
        title: `Quality review for ${task.title}`,
        description: `Review deliverables from ${task.requiredRole}`,
        dependencies: [task.id],
        deliverables: {
          qualityReport: 'Comprehensive quality assessment',
          testResults: 'Test execution results',
          recommendations: 'Quality improvement recommendations'
        }
      };

      await this.taskManager.agentQueue.enqueueTask(qaTask);
      logger.info(`Quality review task scheduled for task ${task.id}`);
    }
  }

  async handleExecutionFailure(executionId, agentId, task, error) {
    logger.error(`Agent execution failed: ${agentId} - ${error.message}`);

    // Update execution tracking
    this.activeExecutions.set(executionId, {
      ...this.activeExecutions.get(executionId),
      status: 'failed',
      error: error.message,
      endTime: Date.now()
    });

    // Record failure metrics
    await this.recordExecutionMetrics(executionId, agentId, task, {
      success: false,
      confidence: 0,
      error: error.message
    });

    // Send failure notification
    await this.taskManager.feedback.sendFeedback(task.projectId, {
      type: 'task_failure',
      severity: 'error',
      title: `Task Failed: ${task.title}`,
      message: `Agent ${agentId} failed to complete task: ${error.message}`,
      details: {
        taskId: task.id,
        agentId,
        error: error.message,
        executionId
      }
    });

    // Determine retry strategy
    const retryStrategy = await this.determineRetryStrategy(task, error);
    if (retryStrategy.shouldRetry) {
      await this.scheduleRetry(task, retryStrategy);
    }
  }

  async determineRetryStrategy(task, error) {
    // Get task retry history
    const retryCount = parseInt(task.retryCount || '0');
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      return { shouldRetry: false, reason: 'Max retries exceeded' };
    }

    // Analyze error type
    if (error.message.includes('Missing prerequisites')) {
      return {
        shouldRetry: true,
        delay: 300000, // 5 minutes
        strategy: 'wait_for_prerequisites'
      };
    }

    if (error.message.includes('confidence')) {
      return {
        shouldRetry: true,
        delay: 60000, // 1 minute
        strategy: 'retry_with_enhanced_context'
      };
    }

    return {
      shouldRetry: true,
      delay: 120000, // 2 minutes
      strategy: 'standard_retry'
    };
  }

  async scheduleRetry(task, strategy) {
    const retryTask = {
      ...task,
      retryCount: parseInt(task.retryCount || '0') + 1,
      retryStrategy: strategy.strategy,
      priority: 'high' // Boost priority for retries
    };

    // Schedule retry after delay
    setTimeout(async () => {
      await this.taskManager.agentQueue.enqueueTask(retryTask);
      logger.info(`Retry scheduled for task ${task.id} (attempt ${retryTask.retryCount})`);
    }, strategy.delay);
  }

  // Utility methods
  calculateRunningAverage(currentAvg, count, newValue) {
    return ((currentAvg * count) + newValue) / (count + 1);
  }

  async getAgentStatus(agentId) {
    const activeTasks = await this.redis.sMembers(`agent:${agentId}:active_tasks`);
    const metrics = await this.redis.hGetAll(`agent_performance:${agentId}`);

    return {
      status: activeTasks.length > 0 ? 'busy' : 'available',
      activeTasks: activeTasks.length,
      successRate: parseFloat(metrics.successRate || '0'),
      averageConfidence: parseFloat(metrics.averageConfidence || '0'),
      lastExecution: metrics.lastExecution
    };
  }

  async checkTaskDependencies(dependencyIds) {
    const blockers = [];

    for (const depId of dependencyIds) {
      const depTask = await this.redis.hGetAll(`queued_task:${depId}`);
      if (!depTask || depTask.status !== 'completed') {
        blockers.push(depId);
      }
    }

    return blockers;
  }

  // Monitoring and reporting
  async getExecutionReport(projectId) {
    const report = {
      projectId,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageConfidence: 0,
      averageDuration: 0,
      agentPerformance: {},
      recentActivity: []
    };

    // Get all execution metrics for the project
    const executionKeys = await this.redis.keys('execution_metrics:*');
    const executions = [];

    for (const key of executionKeys) {
      const execution = await this.redis.hGetAll(key);
      if (execution.projectId === projectId) {
        executions.push(execution);
      }
    }

    report.totalExecutions = executions.length;
    report.successfulExecutions = executions.filter(e => e.success === 'true').length;
    report.failedExecutions = executions.filter(e => e.success === 'false').length;

    if (executions.length > 0) {
      report.averageConfidence = executions.reduce((sum, e) => 
        sum + parseFloat(e.confidence || '0'), 0) / executions.length;
      report.averageDuration = executions.reduce((sum, e) => 
        sum + parseInt(e.duration || '0'), 0) / executions.length;
    }

    // Agent performance breakdown
    const agentGroups = executions.reduce((groups, execution) => {
      const role = execution.agentRole;
      if (!groups[role]) groups[role] = [];
      groups[role].push(execution);
      return groups;
    }, {});

    for (const [role, roleExecutions] of Object.entries(agentGroups)) {
      report.agentPerformance[role] = {
        total: roleExecutions.length,
        successful: roleExecutions.filter(e => e.success === 'true').length,
        averageConfidence: roleExecutions.reduce((sum, e) => 
          sum + parseFloat(e.confidence || '0'), 0) / roleExecutions.length
      };
    }

    // Recent activity (last 10 executions)
    report.recentActivity = executions
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map(e => ({
        agentRole: e.agentRole,
        success: e.success === 'true',
        confidence: parseFloat(e.confidence || '0'),
        duration: parseInt(e.duration || '0'),
        timestamp: e.timestamp
      }));

    return report;
  }

  async getDatabaseUtilizationReport(projectId) {
    return await this.dbIntegration.getDatabaseUtilizationReport(projectId);
  }
}

export default EnhancedAgentExecutor;