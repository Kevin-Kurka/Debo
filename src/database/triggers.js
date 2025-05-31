import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class DatabaseTriggers {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.agentQueues = {
      orchestrator: 'queue:orchestrator',
      product_manager: 'queue:product_manager', 
      coding: 'queue:coding',
      testing: 'queue:testing',
      qa: 'queue:qa'
    };
  }

  async init() {
    await this.taskManager.connect();
    await this.setupAgentQueues();
    await this.startAgentProcessors();
  }

  async setupAgentQueues() {
    // Initialize agent queues
    for (const queue of Object.values(this.agentQueues)) {
      await this.taskManager.redis.del(queue); // Clear on restart
    }
  }

  // TRIGGERS: Automatic database consistency

  async onFeatureCreated(featureId, projectId) {
    // Auto-assign to product manager for task breakdown
    const taskId = await this.createAgentTask('product_manager', 
      'break_down_feature', { featureId, projectId });
    
    await this.taskManager.redis.lPush(this.agentQueues.product_manager, taskId);
    logger.info('Feature triggered PM task', { featureId, taskId });
  }

  async onTaskCreated(taskId, taskData) {
    // Route task to appropriate queue based on type
    const queue = this.getTaskQueue(taskData.type);
    await this.taskManager.redis.lPush(queue, taskId);
    
    // Create corresponding test placeholders
    await this.createTestsForTask(taskId, taskData);
    
    logger.info('Task routed to queue', { taskId, queue });
  }

  async onTaskCompleted(taskId, result) {
    const task = await this.taskManager.redis.hGetAll(`task:${taskId}`);
    
    // Move to testing queue if code task
    if (task.type === 'development') {
      const testTaskId = await this.createAgentTask('testing', 
        'run_tests', { originalTaskId: taskId });
      await this.taskManager.redis.lPush(this.agentQueues.testing, testTaskId);
    }
    
    // Update feature progress
    await this.updateFeatureProgress(task.featureId);
  }

  async onTestCompleted(testId, passed) {
    const test = await this.taskManager.redis.hGetAll(`test:${testId}`);
    
    if (!passed) {
      // Send back to coding queue for fixes
      const fixTaskId = await this.createAgentTask('coding', 
        'fix_failing_test', { testId, originalTaskId: test.taskId });
      await this.taskManager.redis.lPush(this.agentQueues.coding, fixTaskId);
    } else {
      // Move to QA queue
      const qaTaskId = await this.createAgentTask('qa', 
        'quality_review', { testId, taskId: test.taskId });
      await this.taskManager.redis.lPush(this.agentQueues.qa, qaTaskId);
    }
  }

  // AGENT PROCESSORS: Background workers

  async startAgentProcessors() {
    // Start background processors for each agent type
    setInterval(() => this.processOrchestratorQueue(), 5000);
    setInterval(() => this.processProductManagerQueue(), 3000);
    setInterval(() => this.processCodingQueue(), 2000);
    setInterval(() => this.processTestingQueue(), 2000);
    setInterval(() => this.processQAQueue(), 4000);
  }  async processOrchestratorQueue() {
    const taskId = await this.taskManager.redis.rPop(this.agentQueues.orchestrator);
    if (!taskId) return;

    const task = await this.taskManager.redis.hGetAll(`task:${taskId}`);
    
    // Orchestrator analyzes request and creates feature
    if (task.agentAction === 'analyze_request') {
      const featureId = await this.taskManager.createFeature(
        task.projectId || 'default', 
        `Feature for: ${task.description}`,
        task.description
      );
      
      await this.onFeatureCreated(featureId, task.projectId || 'default');
      await this.taskManager.completeTask(taskId, `Created feature: ${featureId}`);
    }
  }

  async processProductManagerQueue() {
    const taskId = await this.taskManager.redis.rPop(this.agentQueues.product_manager);
    if (!taskId) return;

    const task = await this.taskManager.redis.hGetAll(`task:${taskId}`);
    
    if (task.agentAction === 'break_down_feature') {
      const { featureId } = JSON.parse(task.agentData);
      
      // Create development tasks
      const devTaskId = await this.taskManager.createTask(
        task.projectId, featureId, 
        'Implement feature', 'Development task auto-generated'
      );
      
      await this.onTaskCreated(devTaskId, { type: 'development', featureId });
      await this.taskManager.completeTask(taskId, `Created tasks for feature: ${featureId}`);
    }
  }

  async processCodingQueue() {
    const taskId = await this.taskManager.redis.rPop(this.agentQueues.coding);
    if (!taskId) return;

    // Simulate coding work
    await this.simulateCodingWork(taskId);
  }

  async processTestingQueue() {
    const taskId = await this.taskManager.redis.rPop(this.agentQueues.testing);
    if (!taskId) return;

    // Simulate test execution
    await this.simulateTestExecution(taskId);
  }

  async processQAQueue() {
    const taskId = await this.taskManager.redis.rPop(this.agentQueues.qa);
    if (!taskId) return;

    // Simulate QA review
    await this.simulateQAReview(taskId);
  }

  // Helper methods
  async createAgentTask(agentType, action, data) {
    const taskId = uuidv4();
    await this.taskManager.redis.hSet(`task:${taskId}`, {
      id: taskId,
      agentType,
      agentAction: action,
      agentData: JSON.stringify(data),
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    return taskId;
  }

  getTaskQueue(taskType) {
    switch (taskType) {
      case 'development': return this.agentQueues.coding;
      case 'testing': return this.agentQueues.testing;
      case 'qa': return this.agentQueues.qa;
      default: return this.agentQueues.coding;
    }
  }
}
