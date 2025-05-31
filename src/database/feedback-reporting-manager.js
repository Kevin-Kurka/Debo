import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class FeedbackReportingManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.redis = taskManager.redis;
    this.subscribers = new Map();
    this.streamActive = false;
  }

  // User Subscription Management
  async subscribeToUpdates(userId, preferences) {
    await this.taskManager.ensureConnection();
    
    const subscription = {
      userId,
      type: preferences.type || 'on_demand',
      frequency: preferences.frequency || 'immediate',
      channels: preferences.channels || ['status', 'features', 'errors'],
      filters: preferences.filters || {},
      createdAt: new Date().toISOString(),
      lastUpdate: null
    };
    
    await this.redis.hSet(`subscription:${userId}`, subscription);
    this.subscribers.set(userId, subscription);
    
    logger.info(`User ${userId} subscribed to updates: ${subscription.type}`);
    return subscription;
  }

  // Real-time Feedback System
  async sendFeedback(projectId, feedback) {
    await this.taskManager.ensureConnection();
    const feedbackId = uuidv4();
    
    const feedbackData = {
      id: feedbackId,
      projectId,
      type: feedback.type,
      severity: feedback.severity || 'info',
      title: feedback.title,
      message: feedback.message,
      details: JSON.stringify(feedback.details || {}),
      source: feedback.source || 'system',
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    // Store feedback
    await this.redis.hSet(`feedback:${feedbackId}`, feedbackData);
    
    // Add to project feedback stream
    await this.redis.xAdd(
      `feedback_stream:${projectId}`,
      '*',
      feedbackData
    );
    
    // Send to subscribers
    await this.notifySubscribers(projectId, feedbackData);
    
    return feedbackId;
  }

  // Project Status Reporting
  async generateProjectReport(projectId, options = {}) {
    await this.taskManager.ensureConnection();
    
    const report = {
      projectId,
      generatedAt: new Date().toISOString(),
      type: options.type || 'comprehensive',
      sections: {}
    };
    
    // Project Overview
    if (options.includeOverview !== false) {
      report.sections.overview = await this.getProjectOverview(projectId);
    }
    
    // Progress Report
    if (options.includeProgress !== false) {
      report.sections.progress = await this.getProgressReport(projectId);
    }
    
    // Agent Activity
    if (options.includeAgentActivity !== false) {
      report.sections.agentActivity = await this.getAgentActivityReport(projectId);
    }
    
    // Quality Metrics
    if (options.includeQuality !== false) {
      report.sections.quality = await this.getQualityReport(projectId);
    }
    
    // Dependency Status
    if (options.includeDependencies !== false) {
      report.sections.dependencies = await this.getDependencyReport(projectId);
    }
    
    // Issues and Blockers
    if (options.includeIssues !== false) {
      report.sections.issues = await this.getIssuesReport(projectId);
    }
    
    // Recent Activity
    if (options.includeActivity !== false) {
      report.sections.recentActivity = await this.getRecentActivityReport(projectId);
    }
    
    // Store report
    const reportId = uuidv4();
    await this.redis.hSet(`report:${reportId}`, {
      id: reportId,
      projectId,
      type: report.type,
      report: JSON.stringify(report),
      createdAt: report.generatedAt
    });
    
    return report;
  }

  // Live Stream Management
  async startLiveStream(projectId, userId) {
    await this.taskManager.ensureConnection();
    
    const streamId = uuidv4();
    const stream = {
      id: streamId,
      projectId,
      userId,
      startedAt: new Date().toISOString(),
      active: true,
      lastEventId: '0'
    };
    
    await this.redis.hSet(`stream:${streamId}`, stream);
    await this.redis.sAdd(`active_streams:${projectId}`, streamId);
    
    // Start streaming events
    this.streamActive = true;
    this.streamProjectEvents(streamId, projectId);
    
    return streamId;
  }

  async stopLiveStream(streamId) {
    await this.taskManager.ensureConnection();
    
    const stream = await this.redis.hGetAll(`stream:${streamId}`);
    if (stream) {
      await this.redis.hSet(`stream:${streamId}`, 'active', false);
      await this.redis.sRem(`active_streams:${stream.projectId}`, streamId);
    }
    
    return streamId;
  }

  // Report Generation Methods
  async getProjectOverview(projectId) {
    const project = await this.redis.hGetAll(`project:${projectId}`);
    const stats = await this.getProjectStats(projectId);
    
    return {
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt,
      totalFeatures: stats.features.total,
      completedFeatures: stats.features.completed,
      totalTasks: stats.tasks.total,
      completedTasks: stats.tasks.completed,
      activeAgents: stats.agents.active,
      overallProgress: this.calculateOverallProgress(stats)
    };
  }

  async getProgressReport(projectId) {
    const features = await this.getProjectFeatures(projectId);
    const milestones = await this.getProjectMilestones(projectId);
    
    const progress = {
      features: [],
      milestones: [],
      velocity: await this.calculateVelocity(projectId),
      estimatedCompletion: null
    };
    
    // Feature progress
    for (const feature of features) {
      const tasks = await this.getFeatureTasks(feature.id);
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      
      progress.features.push({
        id: feature.id,
        name: feature.name,
        status: feature.status,
        progress: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0,
        tasksCompleted: completedTasks,
        tasksTotal: tasks.length,
        estimatedCompletion: this.estimateFeatureCompletion(feature, tasks)
      });
    }
    
    // Milestone progress
    for (const milestone of milestones) {
      progress.milestones.push({
        id: milestone.id,
        name: milestone.name,
        dueDate: milestone.dueDate,
        status: milestone.status,
        progress: milestone.progress,
        onTrack: this.isMilestoneOnTrack(milestone)
      });
    }
    
    // Calculate estimated completion
    progress.estimatedCompletion = this.estimateProjectCompletion(progress);
    
    return progress;
  }

  async getAgentActivityReport(projectId) {
    const agents = await this.taskManager.agentQueue.getActiveAgents();
    const activity = {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.activeTasks > 0).length,
      agentDetails: [],
      taskDistribution: {},
      performanceMetrics: {}
    };
    
    for (const agent of agents) {
      const agentTasks = await this.getAgentTasks(agent.id, projectId);
      const completedTasks = await this.getAgentCompletedTasks(agent.id, projectId);
      
      activity.agentDetails.push({
        id: agent.id,
        role: agent.role,
        status: agent.activeTasks > 0 ? 'busy' : 'idle',
        currentTasks: agent.activeTasks,
        completedToday: completedTasks.today,
        completedTotal: completedTasks.total,
        averageTaskTime: this.calculateAverageTaskTime(completedTasks.tasks),
        efficiency: this.calculateAgentEfficiency(agent, completedTasks)
      });
      
      // Update task distribution
      activity.taskDistribution[agent.role] = 
        (activity.taskDistribution[agent.role] || 0) + agent.activeTasks;
    }
    
    // Calculate performance metrics
    activity.performanceMetrics = {
      averageTasksPerAgent: activity.totalAgents > 0 ? 
        Object.values(activity.taskDistribution).reduce((a, b) => a + b, 0) / activity.totalAgents : 0,
      utilizationRate: activity.totalAgents > 0 ? 
        (activity.activeAgents / activity.totalAgents) * 100 : 0
    };
    
    return activity;
  }

  async getQualityReport(projectId) {
    const quality = {
      codeQuality: await this.getCodeQualityMetrics(projectId),
      testCoverage: await this.getTestCoverageMetrics(projectId),
      securityScan: await this.getSecurityMetrics(projectId),
      performance: await this.getPerformanceMetrics(projectId),
      documentation: await this.getDocumentationMetrics(projectId),
      overallScore: 0
    };
    
    // Calculate overall quality score
    const weights = {
      codeQuality: 0.3,
      testCoverage: 0.25,
      securityScan: 0.2,
      performance: 0.15,
      documentation: 0.1
    };
    
    quality.overallScore = Object.entries(weights).reduce((score, [metric, weight]) => {
      return score + (quality[metric].score || 0) * weight;
    }, 0);
    
    return quality;
  }

  async getDependencyReport(projectId) {
    const dependencies = await this.taskManager.dependencies.getProjectDependencies(projectId);
    const outdated = await this.taskManager.dependencies.getOutdatedDependencies(projectId);
    const vulnerable = await this.taskManager.dependencies.getVulnerableDependencies();
    
    return {
      total: dependencies.length,
      direct: dependencies.filter(d => d.projectConfig.directDependency).length,
      transitive: dependencies.filter(d => !d.projectConfig.directDependency).length,
      outdated: outdated.length,
      vulnerable: vulnerable.filter(v => v.projectId === projectId).length,
      lastUpdated: await this.getLastDependencyUpdate(projectId),
      criticalIssues: await this.getCriticalDependencyIssues(projectId),
      recommendations: await this.getDependencyRecommendations(projectId)
    };
  }

  async getIssuesReport(projectId) {
    const issues = {
      blockers: [],
      critical: [],
      warnings: [],
      suggestions: []
    };
    
    // Get blocked tasks
    const blockedTasks = await this.getBlockedTasks(projectId);
    for (const task of blockedTasks) {
      issues.blockers.push({
        type: 'blocked_task',
        taskId: task.id,
        title: task.title,
        blockedBy: task.blockedBy,
        duration: this.calculateBlockedDuration(task)
      });
    }
    
    // Get failed tasks
    const failedTasks = await this.getFailedTasks(projectId);
    for (const task of failedTasks) {
      issues.critical.push({
        type: 'failed_task',
        taskId: task.id,
        title: task.title,
        failureReason: task.failureReason,
        retryCount: task.retryCount
      });
    }
    
    // Get quality issues
    const qualityIssues = await this.getQualityIssues(projectId);
    issues.warnings.push(...qualityIssues);
    
    // Get improvement suggestions
    const suggestions = await this.getImprovementSuggestions(projectId);
    issues.suggestions.push(...suggestions);
    
    return issues;
  }

  async getRecentActivityReport(projectId, hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const activities = await this.taskManager.getProjectActivity(projectId);
    
    const recent = activities.filter(a => new Date(a.timestamp) > cutoff);
    
    return {
      totalActivities: recent.length,
      byType: this.groupActivitiesByType(recent),
      byAgent: this.groupActivitiesByAgent(recent),
      timeline: this.createActivityTimeline(recent),
      highlights: this.extractActivityHighlights(recent)
    };
  }

  // Helper Methods
  async notifySubscribers(projectId, feedback) {
    const subscribers = await this.getProjectSubscribers(projectId);
    
    for (const sub of subscribers) {
      const shouldNotify = this.shouldNotifySubscriber(sub, feedback);
      
      if (shouldNotify) {
        await this.sendNotification(sub.userId, {
          projectId,
          feedback,
          subscription: sub
        });
      }
    }
  }

  shouldNotifySubscriber(subscription, feedback) {
    // Check if feedback type matches subscription channels
    if (!subscription.channels.includes(feedback.type)) {
      return false;
    }
    
    // Check severity filter
    if (subscription.filters.minSeverity) {
      const severityLevels = ['info', 'warning', 'error', 'critical'];
      const minLevel = severityLevels.indexOf(subscription.filters.minSeverity);
      const feedbackLevel = severityLevels.indexOf(feedback.severity);
      
      if (feedbackLevel < minLevel) {
        return false;
      }
    }
    
    // Check frequency
    if (subscription.frequency === 'batched') {
      // Check if enough time has passed since last update
      const lastUpdate = new Date(subscription.lastUpdate || 0);
      const timeSinceUpdate = Date.now() - lastUpdate;
      const batchInterval = subscription.filters.batchInterval || 3600000; // 1 hour default
      
      if (timeSinceUpdate < batchInterval) {
        return false;
      }
    }
    
    return true;
  }

  async sendNotification(userId, notification) {
    const notificationId = uuidv4();
    
    await this.redis.hSet(`notification:${notificationId}`, {
      id: notificationId,
      userId,
      projectId: notification.projectId,
      type: notification.feedback.type,
      title: notification.feedback.title,
      message: notification.feedback.message,
      details: JSON.stringify(notification.feedback.details),
      createdAt: new Date().toISOString(),
      read: false
    });
    
    // Add to user's notification queue
    await this.redis.lPush(`user:${userId}:notifications`, notificationId);
    
    // Update last notification time
    await this.redis.hSet(`subscription:${userId}`, 
      'lastUpdate', new Date().toISOString()
    );
    
    logger.info(`Notification sent to user ${userId}`);
  }

  async streamProjectEvents(streamId, projectId) {
    const stream = await this.redis.hGetAll(`stream:${streamId}`);
    
    if (!stream || stream.active !== 'true') {
      return;
    }
    
    try {
      // Read new events from Redis stream
      const events = await this.redis.xRead(
        { key: `feedback_stream:${projectId}`, id: stream.lastEventId },
        { COUNT: 10, BLOCK: 1000 }
      );
      
      if (events && events.length > 0) {
        for (const event of events[0].messages) {
          // Send event to user
          await this.sendStreamEvent(stream.userId, {
            streamId,
            eventId: event.id,
            data: event.message
          });
          
          // Update last event ID
          await this.redis.hSet(`stream:${streamId}`, 'lastEventId', event.id);
        }
      }
      
      // Continue streaming if active
      if (this.streamActive) {
        setImmediate(() => this.streamProjectEvents(streamId, projectId));
      }
    } catch (error) {
      logger.error(`Error streaming events: ${error.message}`);
    }
  }

  async sendStreamEvent(userId, event) {
    // This would send the event to the user via WebSocket, SSE, or other real-time mechanism
    logger.info(`Stream event sent to user ${userId}: ${event.eventId}`);
  }

  // Calculation Methods
  calculateOverallProgress(stats) {
    const weights = {
      features: 0.4,
      tasks: 0.3,
      tests: 0.2,
      documentation: 0.1
    };
    
    const progress = {
      features: stats.features.total > 0 ? 
        (stats.features.completed / stats.features.total) : 0,
      tasks: stats.tasks.total > 0 ? 
        (stats.tasks.completed / stats.tasks.total) : 0,
      tests: stats.tests.total > 0 ? 
        (stats.tests.passed / stats.tests.total) : 0,
      documentation: stats.documentation.coverage || 0
    };
    
    return Object.entries(weights).reduce((total, [metric, weight]) => {
      return total + (progress[metric] * weight * 100);
    }, 0);
  }

  async calculateVelocity(projectId) {
    const lastWeek = await this.getCompletedTasksInPeriod(projectId, 7);
    const previousWeek = await this.getCompletedTasksInPeriod(projectId, 14, 7);
    
    return {
      current: lastWeek.length,
      previous: previousWeek.length,
      trend: lastWeek.length > previousWeek.length ? 'increasing' : 
             lastWeek.length < previousWeek.length ? 'decreasing' : 'stable'
    };
  }

  estimateProjectCompletion(progress) {
    const avgVelocity = progress.velocity.current;
    const remainingTasks = progress.features.reduce((total, f) => {
      return total + (f.tasksTotal - f.tasksCompleted);
    }, 0);
    
    if (avgVelocity > 0) {
      const weeksRemaining = remainingTasks / avgVelocity;
      const completionDate = new Date();
      completionDate.setDate(completionDate.getDate() + (weeksRemaining * 7));
      return completionDate.toISOString();
    }
    
    return null;
  }

  // Periodic Report Generation
  async schedulePeriodicReports(projectId, schedule) {
    const scheduleId = uuidv4();
    
    await this.redis.hSet(`report_schedule:${scheduleId}`, {
      id: scheduleId,
      projectId,
      frequency: schedule.frequency || 'daily',
      reportType: schedule.reportType || 'summary',
      recipients: JSON.stringify(schedule.recipients || []),
      nextRun: this.calculateNextRunTime(schedule.frequency),
      active: true
    });
    
    return scheduleId;
  }

  calculateNextRunTime(frequency) {
    const now = new Date();
    
    switch (frequency) {
      case 'hourly':
        now.setHours(now.getHours() + 1);
        break;
      case 'daily':
        now.setDate(now.getDate() + 1);
        now.setHours(9, 0, 0, 0); // 9 AM
        break;
      case 'weekly':
        now.setDate(now.getDate() + 7);
        now.setHours(9, 0, 0, 0);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        now.setDate(1);
        now.setHours(9, 0, 0, 0);
        break;
    }
    
    return now.toISOString();
  }
}