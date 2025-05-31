import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class AgentQueueManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.redis = taskManager.redis;
  }

  // Task Queue Management
  async enqueueTask(task) {
    await this.taskManager.ensureConnection();
    const taskId = task.id || uuidv4();
    
    const queuedTask = {
      id: taskId,
      projectId: task.projectId,
      featureId: task.featureId || '',
      type: task.type,
      priority: task.priority || 'medium',
      requiredRole: task.requiredRole,
      requiredSkills: JSON.stringify(task.requiredSkills || []),
      estimatedTime: task.estimatedTime || 60,
      dependencies: JSON.stringify(task.dependencies || []),
      blockedBy: JSON.stringify(task.blockedBy || []),
      status: 'queued',
      title: task.title,
      description: task.description,
      deliverables: JSON.stringify(task.deliverables || {}),
      acceptanceCriteria: JSON.stringify(task.acceptanceCriteria || []),
      testRequirements: JSON.stringify(task.testRequirements || {}),
      createdAt: new Date().toISOString(),
      createdBy: task.createdBy || 'system'
    };

    // Store task
    await this.redis.hSet(`queued_task:${taskId}`, queuedTask);
    
    // Add to appropriate queue based on role
    const queueKey = `agent_queue:${task.requiredRole}`;
    const score = this.calculatePriorityScore(task.priority);
    await this.redis.zAdd(queueKey, { score, value: taskId });
    
    // Add to project task index
    await this.redis.sAdd(`project:${task.projectId}:queued_tasks`, taskId);
    
    // Track dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        await this.redis.sAdd(`task:${depId}:dependents`, taskId);
      }
    }
    
    logger.info(`Task ${taskId} enqueued for role: ${task.requiredRole}`);
    return taskId;
  }

  // Agent Task Checkout
  async checkoutTask(agentId, agentRole, agentSkills = []) {
    await this.taskManager.ensureConnection();
    
    // Try to get highest priority task for agent's role
    const queueKey = `agent_queue:${agentRole}`;
    const taskIds = await this.redis.zRange(queueKey, -1, -1);
    
    if (!taskIds || taskIds.length === 0) {
      // Try to find tasks from other queues if agent can adapt
      return await this.findAdaptableTask(agentId, agentRole, agentSkills);
    }
    
    const taskId = taskIds[0];
    
    // Check if task is still available and not blocked
    const task = await this.redis.hGetAll(`queued_task:${taskId}`);
    if (!task || task.status !== 'queued') {
      // Remove from queue and try next
      await this.redis.zRem(queueKey, taskId);
      return await this.checkoutTask(agentId, agentRole, agentSkills);
    }
    
    // Check dependencies
    const blockedBy = JSON.parse(task.blockedBy || '[]');
    if (blockedBy.length > 0) {
      const stillBlocked = await this.checkBlockingTasks(blockedBy);
      if (stillBlocked.length > 0) {
        // Task is still blocked, try another
        return await this.checkoutTask(agentId, agentRole, agentSkills);
      }
    }
    
    // Checkout the task
    await this.redis.hSet(`queued_task:${taskId}`, {
      status: 'checked_out',
      assignedAgent: agentId,
      checkoutTime: new Date().toISOString()
    });
    
    // Remove from queue
    await this.redis.zRem(queueKey, taskId);
    
    // Add to agent's active tasks
    await this.redis.sAdd(`agent:${agentId}:active_tasks`, taskId);
    
    // Create checkout record
    await this.redis.hSet(`checkout:${taskId}`, {
      taskId,
      agentId,
      agentRole,
      checkoutTime: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + (task.estimatedTime * 60000)).toISOString()
    });
    
    logger.info(`Agent ${agentId} checked out task ${taskId}`);
    
    return {
      ...task,
      id: taskId,
      requiredSkills: JSON.parse(task.requiredSkills || '[]'),
      dependencies: JSON.parse(task.dependencies || '[]'),
      deliverables: JSON.parse(task.deliverables || '{}'),
      acceptanceCriteria: JSON.parse(task.acceptanceCriteria || '[]'),
      testRequirements: JSON.parse(task.testRequirements || '{}')
    };
  }

  // Task Check-in (completion or return to queue)
  async checkinTask(agentId, taskId, result) {
    await this.taskManager.ensureConnection();
    
    const checkout = await this.redis.hGetAll(`checkout:${taskId}`);
    if (!checkout || checkout.agentId !== agentId) {
      throw new Error(`Task ${taskId} not checked out by agent ${agentId}`);
    }
    
    if (result.status === 'completed') {
      // Mark task as completed
      await this.redis.hSet(`queued_task:${taskId}`, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        completedBy: agentId,
        result: JSON.stringify(result.deliverables || {})
      });
      
      // Update dependent tasks
      const dependents = await this.redis.sMembers(`task:${taskId}:dependents`);
      for (const depId of dependents) {
        await this.updateTaskDependencies(depId, taskId);
      }
      
      // Trigger quality check if needed
      if (result.requiresQualityCheck) {
        await this.enqueueTask({
          projectId: result.projectId,
          type: 'quality_check',
          requiredRole: 'qa_engineer',
          priority: 'high',
          title: `Quality check for ${taskId}`,
          description: `Review deliverables from task ${taskId}`,
          dependencies: [taskId]
        });
      }
      
    } else if (result.status === 'failed') {
      // Mark as failed and potentially retry
      await this.redis.hSet(`queued_task:${taskId}`, {
        status: 'failed',
        failedAt: new Date().toISOString(),
        failureReason: result.reason || 'Unknown error',
        retryCount: parseInt(checkout.retryCount || '0') + 1
      });
      
      // Re-queue if retry limit not reached
      const retryCount = parseInt(checkout.retryCount || '0') + 1;
      if (retryCount < 3) {
        await this.requeueTask(taskId);
      }
      
    } else if (result.status === 'returned') {
      // Return task to queue
      await this.requeueTask(taskId, result.reason);
    }
    
    // Clean up checkout
    await this.redis.del(`checkout:${taskId}`);
    await this.redis.sRem(`agent:${agentId}:active_tasks`, taskId);
    
    return taskId;
  }

  // Dynamic Agent Role Assignment
  async reassignAgent(agentId, currentRole, newRole, reason) {
    await this.taskManager.ensureConnection();
    
    // Get agent's current tasks
    const activeTasks = await this.redis.sMembers(`agent:${agentId}:active_tasks`);
    
    // Return active tasks to queue if they require specific role
    for (const taskId of activeTasks) {
      const task = await this.redis.hGetAll(`queued_task:${taskId}`);
      if (task && task.requiredRole === currentRole) {
        await this.checkinTask(agentId, taskId, { 
          status: 'returned', 
          reason: `Agent reassigned from ${currentRole} to ${newRole}` 
        });
      }
    }
    
    // Update agent record
    await this.redis.hSet(`agent:${agentId}`, {
      currentRole: newRole,
      previousRole: currentRole,
      reassignedAt: new Date().toISOString(),
      reassignmentReason: reason
    });
    
    // Log role change
    await this.taskManager.logActivity(
      'agent_reassigned',
      'system',
      agentId,
      'system',
      { from: currentRole, to: newRole, reason }
    );
    
    return { agentId, newRole };
  }

  // Helper Methods
  calculatePriorityScore(priority) {
    const now = Date.now();
    const priorityMultiplier = {
      critical: 1000000,
      high: 100000,
      medium: 10000,
      low: 1000
    };
    return now + (priorityMultiplier[priority] || 10000);
  }

  async checkBlockingTasks(taskIds) {
    const stillBlocked = [];
    for (const taskId of taskIds) {
      const task = await this.redis.hGetAll(`queued_task:${taskId}`);
      if (!task || task.status !== 'completed') {
        stillBlocked.push(taskId);
      }
    }
    return stillBlocked;
  }

  async updateTaskDependencies(taskId, completedDepId) {
    const task = await this.redis.hGetAll(`queued_task:${taskId}`);
    if (!task) return;
    
    const blockedBy = JSON.parse(task.blockedBy || '[]');
    const newBlockedBy = blockedBy.filter(id => id !== completedDepId);
    
    await this.redis.hSet(`queued_task:${taskId}`, {
      blockedBy: JSON.stringify(newBlockedBy)
    });
    
    // If no longer blocked, update priority to push it up in queue
    if (newBlockedBy.length === 0 && blockedBy.length > 0) {
      const queueKey = `agent_queue:${task.requiredRole}`;
      const currentScore = await this.redis.zScore(queueKey, taskId);
      if (currentScore) {
        // Boost priority
        await this.redis.zAdd(queueKey, { 
          score: currentScore + 1000000, 
          value: taskId 
        });
      }
    }
  }

  async requeueTask(taskId, reason = '') {
    const task = await this.redis.hGetAll(`queued_task:${taskId}`);
    if (!task) return;
    
    await this.redis.hSet(`queued_task:${taskId}`, {
      status: 'queued',
      requeuedAt: new Date().toISOString(),
      requeueReason: reason
    });
    
    const score = this.calculatePriorityScore(task.priority);
    await this.redis.zAdd(`agent_queue:${task.requiredRole}`, { score, value: taskId });
  }

  async findAdaptableTask(agentId, agentRole, agentSkills) {
    // Logic to find tasks from other queues that agent can handle
    const adaptableRoles = this.getAdaptableRoles(agentRole);
    
    for (const role of adaptableRoles) {
      const queueKey = `agent_queue:${role}`;
      const taskIds = await this.redis.zRange(queueKey, -1, -1);
      
      if (taskIds && taskIds.length > 0) {
        // Found adaptable task
        logger.info(`Agent ${agentId} (${agentRole}) adapting to ${role} task`);
        return await this.checkoutTask(agentId, role, agentSkills);
      }
    }
    
    return null;
  }

  getAdaptableRoles(currentRole) {
    const adaptabilityMap = {
      'backend_developer': ['frontend_developer', 'qa_engineer'],
      'frontend_developer': ['backend_developer', 'ux_designer', 'qa_engineer'],
      'qa_engineer': ['backend_developer', 'frontend_developer'],
      'devops_engineer': ['backend_developer', 'security_engineer'],
      'security_engineer': ['qa_engineer', 'devops_engineer'],
      'ux_designer': ['frontend_developer', 'technical_writer'],
      'technical_writer': ['business_analyst', 'ux_designer']
    };
    
    return adaptabilityMap[currentRole] || [];
  }

  // Queue Statistics
  async getQueueStats() {
    await this.taskManager.ensureConnection();
    
    const roles = [
      'cto', 'engineering_manager', 'product_manager', 'business_analyst',
      'solution_architect', 'technical_writer', 'backend_developer',
      'frontend_developer', 'qa_engineer', 'devops_engineer',
      'security_engineer', 'ux_designer'
    ];
    
    const stats = {};
    
    for (const role of roles) {
      const queueKey = `agent_queue:${role}`;
      const count = await this.redis.zCard(queueKey);
      
      const priorities = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      };
      
      // Get task priorities
      const taskIds = await this.redis.zRange(queueKey, 0, -1);
      for (const taskId of taskIds) {
        const task = await this.redis.hGet(`queued_task:${taskId}`, 'priority');
        if (task) {
          priorities[task]++;
        }
      }
      
      stats[role] = {
        total: count,
        priorities
      };
    }
    
    return stats;
  }

  // Active Agent Monitoring
  async getActiveAgents() {
    await this.taskManager.ensureConnection();
    
    const agentKeys = await this.redis.keys('agent:*:active_tasks');
    const agents = [];
    
    for (const key of agentKeys) {
      const agentId = key.split(':')[1];
      const agent = await this.redis.hGetAll(`agent:${agentId}`);
      const activeTasks = await this.redis.sMembers(key);
      
      if (agent) {
        agents.push({
          id: agentId,
          role: agent.currentRole,
          activeTasks: activeTasks.length,
          lastActivity: agent.lastActivity || 'N/A'
        });
      }
    }
    
    return agents;
  }
}