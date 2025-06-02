import redis from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import logger from '../logger.js';
import { VersionControlManager } from './version-control-manager.js';
import { DependencyManager } from './dependency-manager.js';
import { AgentQueueManager } from './agent-queue-manager.js';
import { DocumentationRAGManager } from './documentation-rag-manager.js';
import { CompatibilityManager } from './compatibility-manager.js';
import { FeedbackReportingManager } from './feedback-reporting-manager.js';
import { CodeDocumentationManager } from './code-documentation-manager.js';
import { OrchestrationRulesEngine } from './orchestration-rules-engine.js';
import { GitWorkflowManager } from './git-workflow-manager.js';
import { MemorySummarizer } from './memory-summarizer.js';
import { DiffLogger } from './diff-logger.js';
import { getTerminalFeedbackSystem } from '../terminal-feedback-system.js';

export class EnhancedTaskManager extends EventEmitter {
  constructor() {
    super();
    this.redis = redis.createClient({ 
      url: 'redis://localhost:6379',
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server connection refused');
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });
    this.connected = false;
    this.feedbackSystem = null;
    
    // Initialize sub-managers
    this.versionControl = new VersionControlManager(this);
    this.dependencies = new DependencyManager(this);
    this.agentQueue = new AgentQueueManager(this);
    this.documentation = new DocumentationRAGManager(this);
    this.compatibility = new CompatibilityManager(this);
    this.feedback = new FeedbackReportingManager(this);
    this.codeDocumentation = new CodeDocumentationManager(this);
    this.orchestration = new OrchestrationRulesEngine(this);
    this.git = new GitWorkflowManager(this);
    
    // Memory management and change tracking
    this.memorySummarizer = null; // Initialized later with LLM provider
    this.diffLogger = null; // Initialized later with LLM provider
    this.summarizationTriggers = {
      taskCompletionCount: 0,
      dataSize: 0,
      lastSummarization: null,
      thresholds: {
        taskCount: 100,
        dataSize: 50 * 1024 * 1024, // 50MB
        timeInterval: 6 * 60 * 60 * 1000 // 6 hours
      }
    };
  }

  async connect() {
    if (!this.connected) {
      try {
        await this.redis.connect();
        this.connected = true;
        logger.info('Connected to Redis database');
        
        // Initialize feedback system if available
        try {
          this.feedbackSystem = getTerminalFeedbackSystem();
        } catch (err) {
          logger.debug('Terminal feedback system not available');
        }
        
        // Set up Redis event handlers
        this.redis.on('error', (err) => {
          logger.error('Redis error:', err);
        });
        
        this.redis.on('end', () => {
          this.connected = false;
          logger.warn('Redis connection ended');
        });
        
      } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        throw error;
      }
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.redis.disconnect();
      this.connected = false;
      logger.info('Disconnected from Redis');
    }
  }

  async ensureConnection() {
    if (!this.connected) {
      await this.connect();
    }
  }

  setFileSystemManager(fileSystemManager) {
    // Pass file system manager to sub-managers that need it
    if (this.git && this.git.setFileSystemManager) {
      this.git.setFileSystemManager(fileSystemManager);
    }
  }

  /**
   * Initialize memory management components with LLM provider
   */
  async initializeMemoryManagement(llmProvider) {
    if (!this.memorySummarizer) {
      this.memorySummarizer = new MemorySummarizer(this, llmProvider);
      await this.memorySummarizer.init();
    }
    
    if (!this.diffLogger) {
      this.diffLogger = new DiffLogger(this, llmProvider);
      await this.diffLogger.init();
    }
    
    // Load existing summarization state
    await this.loadSummarizationState();
    
    logger.info('Memory management components initialized');
  }

  /**
   * Load summarization state from database
   */
  async loadSummarizationState() {
    try {
      const state = await this.getData('summarization_state');
      if (state) {
        this.summarizationTriggers = { ...this.summarizationTriggers, ...JSON.parse(state) };
      }
    } catch (error) {
      logger.warn('Failed to load summarization state:', error);
    }
  }

  /**
   * Save summarization state to database
   */
  async saveSummarizationState() {
    try {
      await this.setData('summarization_state', JSON.stringify(this.summarizationTriggers));
    } catch (error) {
      logger.error('Failed to save summarization state:', error);
    }
  }

  /**
   * Check if summarization should be triggered
   */
  async checkSummarizationTriggers() {
    const triggers = this.summarizationTriggers;
    const thresholds = triggers.thresholds;
    
    let shouldSummarize = false;
    const reasons = [];
    
    // Check task completion count
    if (triggers.taskCompletionCount >= thresholds.taskCount) {
      shouldSummarize = true;
      reasons.push(`Task count threshold reached: ${triggers.taskCompletionCount}/${thresholds.taskCount}`);
    }
    
    // Check data size
    if (triggers.dataSize >= thresholds.dataSize) {
      shouldSummarize = true;
      reasons.push(`Data size threshold reached: ${Math.round(triggers.dataSize / 1024 / 1024)}MB`);
    }
    
    // Check time interval
    if (triggers.lastSummarization) {
      const timeSinceLastSummarization = Date.now() - new Date(triggers.lastSummarization).getTime();
      if (timeSinceLastSummarization >= thresholds.timeInterval) {
        shouldSummarize = true;
        reasons.push(`Time threshold reached: ${Math.round(timeSinceLastSummarization / 1000 / 60 / 60)} hours`);
      }
    } else {
      // First time - trigger after some initial data
      if (triggers.taskCompletionCount >= 10) {
        shouldSummarize = true;
        reasons.push('Initial summarization trigger');
      }
    }
    
    if (shouldSummarize) {
      logger.info('Summarization triggered:', reasons);
      await this.triggerSummarization();
    }
  }

  /**
   * Trigger memory summarization
   */
  async triggerSummarization() {
    if (!this.memorySummarizer) {
      logger.warn('Memory summarizer not initialized');
      return;
    }
    
    try {
      await this.memorySummarizer.performAutomaticCompression();
      
      // Reset counters
      this.summarizationTriggers.taskCompletionCount = 0;
      this.summarizationTriggers.dataSize = 0;
      this.summarizationTriggers.lastSummarization = new Date().toISOString();
      
      await this.saveSummarizationState();
      
      logger.info('Memory summarization completed successfully');
    } catch (error) {
      logger.error('Memory summarization failed:', error);
    }
  }

  /**
   * Log a change with diff tracking
   */
  async logChange(entityType, entityId, changes, context = {}) {
    if (!this.diffLogger) {
      return null;
    }
    
    try {
      return await this.diffLogger.logChange(entityType, entityId, changes, context);
    } catch (error) {
      logger.error('Failed to log change:', error);
      return null;
    }
  }

  async createTask(taskData) {
    await this.ensureConnection();
    const taskId = uuidv4();
    
    const task = {
      id: taskId,
      ...taskData,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Report database operation
    this.reportDatabaseOperation({
      type: 'create',
      table: 'task',
      key: taskId,
      operation: 'hSet',
      data: task,
      agent: taskData.agentType || 'system'
    });

    await this.redis.hSet(`task:${taskId}`, task);
    await this.redis.sAdd('active_tasks', taskId);
    
    if (taskData.projectId) {
      this.reportDatabaseOperation({
        type: 'update',
        table: 'project_tasks',
        key: taskData.projectId,
        operation: 'sAdd',
        data: taskId,
        agent: taskData.agentType || 'system'
      });
      await this.redis.sAdd(`project_tasks:${taskData.projectId}`, taskId);
    }

    await this.logActivity('task_created', 'system', taskId, taskData.projectId || 'default', {
      taskType: taskData.type,
      agentType: taskData.agentType
    });

    logger.info(`Created task: ${taskId}`);
    return taskId;
  }

  async updateTaskStatus(taskId, status, additionalData = {}) {
    await this.ensureConnection();
    
    const updateData = {
      status,
      updatedAt: new Date().toISOString(),
      ...additionalData
    };

    if (status === 'completed') {
      updateData.completedAt = new Date().toISOString();
      await this.redis.sRem('active_tasks', taskId);
      await this.redis.sAdd('completed_tasks', taskId);
    } else if (status === 'failed') {
      updateData.failedAt = new Date().toISOString();
      await this.redis.sRem('active_tasks', taskId);
      await this.redis.sAdd('failed_tasks', taskId);
    } else if (status === 'running') {
      updateData.startedAt = new Date().toISOString();
    }

    await this.redis.hSet(`task:${taskId}`, updateData);
    
    const task = await this.redis.hGetAll(`task:${taskId}`);
    
    // Log change with diff tracking
    await this.logChange('task', taskId, updateData, {
      operation: 'status_update',
      previousStatus: task.status,
      agent: task.agentType || 'system'
    });
    
    await this.logActivity('task_status_updated', task.agentType || 'system', taskId, task.projectId || 'default', {
      oldStatus: task.status,
      newStatus: status
    });

    // Update summarization triggers
    if (status === 'completed' || status === 'failed') {
      this.summarizationTriggers.taskCompletionCount++;
      
      // Estimate data size increase (rough calculation)
      const dataSize = JSON.stringify(task).length + JSON.stringify(updateData).length;
      this.summarizationTriggers.dataSize += dataSize;
      
      // Check if summarization should be triggered
      await this.checkSummarizationTriggers();
    }

    return updateData;
  }

  async getTask(taskId) {
    await this.ensureConnection();
    const task = await this.redis.hGetAll(`task:${taskId}`);
    return Object.keys(task).length > 0 ? task : null;
  }

  async getProjectTasks(projectId, status = null) {
    await this.ensureConnection();
    const taskIds = await this.redis.sMembers(`project_tasks:${projectId}`);
    const tasks = [];

    for (const taskId of taskIds) {
      const task = await this.getTask(taskId);
      if (task && (!status || task.status === status)) {
        tasks.push(task);
      }
    }

    return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getActiveTasks(limit = 50) {
    await this.ensureConnection();
    const taskIds = await this.redis.sMembers('active_tasks');
    const tasks = [];

    for (const taskId of taskIds.slice(0, limit)) {
      const task = await this.getTask(taskId);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async logActivity(action, agentId, taskId, projectId, details = {}) {
    await this.ensureConnection();
    const timestamp = Date.now();
    const activityId = `${timestamp}_${uuidv4()}`;
    
    const activity = {
      id: activityId,
      timestamp: new Date().toISOString(),
      agentId: agentId || 'system',
      taskId: taskId || '',
      projectId: projectId || 'default',
      action,
      details: JSON.stringify(details)
    };

    await this.redis.hSet(`activity:${activityId}`, activity);
    await this.redis.zAdd('activity_timeline', {
      score: timestamp,
      value: activityId
    });

    // Keep only last 1000 activities
    await this.redis.zRemRangeByRank('activity_timeline', 0, -1001);

    return activityId;
  }

  async getRecentActivity(limit = 20, projectId = null) {
    await this.ensureConnection();
    const activityIds = await this.redis.zRevRange('activity_timeline', 0, limit - 1);
    const activities = [];

    for (const activityId of activityIds) {
      const activity = await this.redis.hGetAll(`activity:${activityId}`);
      if (activity && activity.id) {
        if (!projectId || activity.projectId === projectId) {
          activities.push({
            ...activity,
            details: JSON.parse(activity.details || '{}')
          });
        }
      }
    }

    return activities;
  }

  async storeAgentResult(taskId, agentType, results) {
    await this.ensureConnection();
    const resultId = uuidv4();
    
    const agentResult = {
      id: resultId,
      taskId,
      agentType,
      results: JSON.stringify(results),
      timestamp: new Date().toISOString()
    };

    await this.redis.hSet(`agent_result:${resultId}`, agentResult);
    await this.redis.sAdd(`task_results:${taskId}`, resultId);

    return resultId;
  }

  async getTaskResults(taskId) {
    await this.ensureConnection();
    const resultIds = await this.redis.sMembers(`task_results:${taskId}`);
    const results = [];

    for (const resultId of resultIds) {
      const result = await this.redis.hGetAll(`agent_result:${resultId}`);
      if (result && result.id) {
        results.push({
          ...result,
          results: JSON.parse(result.results || '{}')
        });
      }
    }

    return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async storeProjectData(projectId, key, data) {
    await this.ensureConnection();
    await this.redis.hSet(`project_data:${projectId}`, {
      [key]: JSON.stringify(data),
      [`${key}_updated`]: new Date().toISOString()
    });
  }

  async getProjectData(projectId, key = null) {
    await this.ensureConnection();
    if (key) {
      const data = await this.redis.hGet(`project_data:${projectId}`, key);
      return data ? JSON.parse(data) : null;
    } else {
      const allData = await this.redis.hGetAll(`project_data:${projectId}`);
      const parsed = {};
      for (const [k, v] of Object.entries(allData)) {
        if (!k.endsWith('_updated')) {
          try {
            parsed[k] = JSON.parse(v);
          } catch (error) {
            parsed[k] = v;
          }
        }
      }
      return parsed;
    }
  }

  async getSystemStats() {
    await this.ensureConnection();
    
    const stats = {
      activeTasks: await this.redis.sCard('active_tasks'),
      completedTasks: await this.redis.sCard('completed_tasks'),
      failedTasks: await this.redis.sCard('failed_tasks'),
      totalProjects: (await this.redis.keys('project:*')).length,
      recentActivity: await this.getRecentActivity(5),
      redisConnected: this.connected
    };

    return stats;
  }

  async cleanupOldData(daysOld = 7) {
    await this.ensureConnection();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTimestamp = cutoffDate.getTime();

    // Remove old activities
    await this.redis.zRemRangeByScore('activity_timeline', 0, cutoffTimestamp);

    // Remove old completed tasks
    const completedTasks = await this.redis.sMembers('completed_tasks');
    for (const taskId of completedTasks) {
      const task = await this.getTask(taskId);
      if (task && task.completedAt) {
        const completedDate = new Date(task.completedAt);
        if (completedDate < cutoffDate) {
          await this.redis.del(`task:${taskId}`);
          await this.redis.sRem('completed_tasks', taskId);
        }
      }
    }

    logger.info(`Cleaned up data older than ${daysOld} days`);
  }

  async getAllProjects() {
    await this.ensureConnection();
    const projectIds = await this.redis.sMembers('all_projects');
    const projects = {};
    
    for (const projectId of projectIds) {
      const project = await this.redis.hGetAll(`project:${projectId}`);
      if (project && project.id) {
        projects[projectId] = project;
      }
    }
    
    return projects;
  }

  async getProjectStatus(projectId) {
    await this.ensureConnection();
    const project = await this.redis.hGetAll(`project:${projectId}`);
    
    if (!project || !project.id) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    // Get task counts
    const allTasks = await this.redis.sMembers(`project_tasks:${projectId}`);
    let completedCount = 0;
    let activeCount = 0;
    
    for (const taskId of allTasks) {
      const task = await this.redis.hGetAll(`task:${taskId}`);
      if (task.status === 'completed') {
        completedCount++;
      } else if (task.status === 'running' || task.status === 'pending') {
        activeCount++;
      }
    }
    
    // Get last activity
    const activities = await this.getRecentActivity(10, projectId);
    const lastActivity = activities[0]?.timestamp || project.createdAt;
    
    return {
      ...project,
      totalTasks: allTasks.length,
      completedTasks: completedCount,
      activeTasks: activeCount,
      lastActivity
    };
  }

  async getActiveTasks(projectId = null) {
    await this.ensureConnection();
    const activeTasks = [];
    
    if (projectId) {
      const taskIds = await this.redis.sMembers(`project_tasks:${projectId}`);
      for (const taskId of taskIds) {
        const task = await this.redis.hGetAll(`agent_task:${taskId}`);
        if (task && (task.status === 'running' || task.status === 'pending')) {
          activeTasks.push(task);
        }
      }
    } else {
      // Get all active tasks
      const taskIds = await this.redis.sMembers('active_tasks');
      for (const taskId of taskIds) {
        const task = await this.redis.hGetAll(`agent_task:${taskId}`);
        if (task && task.id) {
          activeTasks.push(task);
        }
      }
    }
    
    return activeTasks;
  }

  async getAllActiveTasks() {
    return await this.getActiveTasks();
  }

  async getProjectLogs(projectId, limit = 50) {
    await this.ensureConnection();
    const activities = await this.getRecentActivity(limit, projectId);
    
    return activities.map(activity => ({
      timestamp: activity.timestamp,
      type: activity.type,
      actor: activity.actor,
      message: `${activity.type}: ${activity.actor} - ${JSON.stringify(activity.details)}`,
      projectId: activity.projectId
    }));
  }

  async getRecentLogs(limit = 50) {
    await this.ensureConnection();
    const activities = await this.getRecentActivity(limit);
    
    return activities.map(activity => ({
      timestamp: activity.timestamp,
      type: activity.type,
      actor: activity.actor,
      message: `${activity.type}: ${activity.actor} - ${JSON.stringify(activity.details)}`,
      projectId: activity.projectId
    }));
  }

  /**
   * Report database operation to feedback system
   */
  reportDatabaseOperation(operation) {
    if (this.feedbackSystem) {
      this.feedbackSystem.reportDatabaseOperation(operation);
    }
    
    // Also emit event
    this.emit('database:operation', operation);
  }

  /**
   * Report task status to feedback system
   */
  reportTaskStatus(taskId, status) {
    if (this.feedbackSystem) {
      this.feedbackSystem.reportTaskStatus(taskId, status);
    }
    
    // Also emit event
    this.emit('task:status', { taskId, ...status });
  }

  /**
   * Report agent activity
   */
  reportAgentActivity(agentId, activity) {
    if (this.feedbackSystem) {
      this.feedbackSystem.reportAgentActivity(agentId, activity);
    }
    
    // Also emit event
    this.emit('agent:activity', { agentId, activity });
  }
}