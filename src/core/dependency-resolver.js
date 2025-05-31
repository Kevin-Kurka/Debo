import logger from '../logger.js';
import { v4 as uuidv4 } from 'uuid';

export class DependencyResolver {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.dependencyGraph = new Map();
    this.executionQueue = [];
    this.completedTasks = new Set();
    this.runningTasks = new Set();
    this.blockedTasks = new Map();
  }

  async init() {
    logger.info('Dependency Resolver initialized');
  }

  // Add task with dependencies
  async addTask(taskId, dependencies = [], metadata = {}) {
    this.dependencyGraph.set(taskId, {
      id: taskId,
      dependencies: new Set(dependencies),
      metadata,
      status: 'pending',
      addedAt: Date.now()
    });

    // Check if task can be executed immediately
    if (dependencies.length === 0) {
      this.executionQueue.push(taskId);
    } else {
      // Add to blocked tasks
      for (const dep of dependencies) {
        if (!this.blockedTasks.has(dep)) {
          this.blockedTasks.set(dep, new Set());
        }
        this.blockedTasks.get(dep).add(taskId);
      }
    }

    await this.persistDependencyGraph();
    return taskId;
  }

  // Mark task as completed and resolve dependencies
  async completeTask(taskId, results = {}) {
    if (!this.dependencyGraph.has(taskId)) {
      logger.warn(`Task ${taskId} not found in dependency graph`);
      return;
    }

    const task = this.dependencyGraph.get(taskId);
    task.status = 'completed';
    task.completedAt = Date.now();
    task.results = results;

    this.completedTasks.add(taskId);
    this.runningTasks.delete(taskId);

    // Check blocked tasks that depend on this one
    if (this.blockedTasks.has(taskId)) {
      const blockedByThis = this.blockedTasks.get(taskId);
      
      for (const blockedTaskId of blockedByThis) {
        const blockedTask = this.dependencyGraph.get(blockedTaskId);
        if (blockedTask) {
          blockedTask.dependencies.delete(taskId);
          
          // If all dependencies are resolved, add to execution queue
          if (blockedTask.dependencies.size === 0) {
            this.executionQueue.push(blockedTaskId);
            logger.info(`Task ${blockedTaskId} unblocked and added to execution queue`);
          }
        }
      }
      
      this.blockedTasks.delete(taskId);
    }

    await this.persistDependencyGraph();
  }

  // Get next tasks that can be executed
  async getExecutableTasks(maxTasks = 5) {
    const executableTasks = [];
    const tasksToCheck = [...this.executionQueue];
    this.executionQueue = [];

    for (const taskId of tasksToCheck) {
      if (executableTasks.length >= maxTasks) {
        this.executionQueue.push(taskId);
        continue;
      }

      const task = this.dependencyGraph.get(taskId);
      if (task && task.status === 'pending' && !this.runningTasks.has(taskId)) {
        // Double-check dependencies are met
        const dependenciesMet = Array.from(task.dependencies).every(dep => 
          this.completedTasks.has(dep)
        );

        if (dependenciesMet) {
          executableTasks.push({
            id: taskId,
            metadata: task.metadata
          });
          this.runningTasks.add(taskId);
          task.status = 'running';
        } else {
          // Dependencies not met, keep in queue
          this.executionQueue.push(taskId);
        }
      }
    }

    return executableTasks;
  }

  // Create task chains for common workflows
  async createWorkflowChain(workflowType, projectId, context = {}) {
    const workflows = {
      'feature_development': [
        { type: 'analyze_requirements', agent: 'business_analyst' },
        { type: 'design_architecture', agent: 'solution_architect', deps: [0] },
        { type: 'implement_backend', agent: 'backend_dev', deps: [1] },
        { type: 'implement_frontend', agent: 'frontend_dev', deps: [1] },
        { type: 'create_tests', agent: 'qa_engineer', deps: [2, 3] },
        { type: 'security_scan', agent: 'security', deps: [2, 3] },
        { type: 'deploy_feature', agent: 'devops', deps: [4, 5] }
      ],
      'bug_fix': [
        { type: 'analyze_bug', agent: 'qa_engineer' },
        { type: 'locate_issue', agent: 'backend_dev', deps: [0] },
        { type: 'fix_issue', agent: 'backend_dev', deps: [1] },
        { type: 'create_regression_test', agent: 'qa_engineer', deps: [2] },
        { type: 'verify_fix', agent: 'qa_engineer', deps: [3] }
      ],
      'performance_optimization': [
        { type: 'profile_performance', agent: 'backend_dev' },
        { type: 'identify_bottlenecks', agent: 'solution_architect', deps: [0] },
        { type: 'optimize_backend', agent: 'backend_dev', deps: [1] },
        { type: 'optimize_frontend', agent: 'frontend_dev', deps: [1] },
        { type: 'performance_tests', agent: 'qa_engineer', deps: [2, 3] }
      ],
      'security_audit': [
        { type: 'dependency_scan', agent: 'security' },
        { type: 'code_analysis', agent: 'security' },
        { type: 'penetration_test', agent: 'security', deps: [0, 1] },
        { type: 'fix_vulnerabilities', agent: 'backend_dev', deps: [2] },
        { type: 'verify_fixes', agent: 'security', deps: [3] }
      ]
    };

    const workflow = workflows[workflowType];
    if (!workflow) {
      throw new Error(`Unknown workflow type: ${workflowType}`);
    }

    const taskIds = [];
    const taskMap = new Map();

    // Create tasks for each step
    for (let i = 0; i < workflow.length; i++) {
      const step = workflow[i];
      const taskId = uuidv4();
      
      const dependencies = (step.deps || []).map(depIndex => taskIds[depIndex]);
      
      await this.addTask(taskId, dependencies, {
        projectId,
        workflowType,
        stepIndex: i,
        type: step.type,
        agent: step.agent,
        context
      });

      taskIds.push(taskId);
      taskMap.set(i, taskId);
    }

    return {
      workflowId: uuidv4(),
      workflowType,
      tasks: taskIds,
      startTask: taskIds[0],
      endTask: taskIds[taskIds.length - 1]
    };
  }

  // Analyze and optimize task execution order
  async optimizeExecutionPlan() {
    const tasks = Array.from(this.dependencyGraph.values())
      .filter(task => task.status === 'pending');

    // Sort by priority and dependencies
    tasks.sort((a, b) => {
      // Tasks with no dependencies first
      if (a.dependencies.size === 0 && b.dependencies.size > 0) return -1;
      if (b.dependencies.size === 0 && a.dependencies.size > 0) return 1;
      
      // Then by priority
      const aPriority = a.metadata.priority || 0;
      const bPriority = b.metadata.priority || 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      // Then by age (older first)
      return a.addedAt - b.addedAt;
    });

    // Rebuild execution queue
    this.executionQueue = tasks
      .filter(task => task.dependencies.size === 0)
      .map(task => task.id);
  }

  // Detect circular dependencies
  detectCircularDependencies() {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (taskId, path = []) => {
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const task = this.dependencyGraph.get(taskId);
      if (task) {
        for (const dep of task.dependencies) {
          if (!visited.has(dep)) {
            dfs(dep, [...path]);
          } else if (recursionStack.has(dep)) {
            // Found cycle
            const cycleStart = path.indexOf(dep);
            cycles.push(path.slice(cycleStart));
          }
        }
      }

      recursionStack.delete(taskId);
    };

    for (const [taskId] of this.dependencyGraph) {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    }

    return cycles;
  }

  // Get task status summary
  getStatusSummary() {
    const summary = {
      total: this.dependencyGraph.size,
      completed: this.completedTasks.size,
      running: this.runningTasks.size,
      blocked: 0,
      ready: this.executionQueue.length
    };

    // Count blocked tasks
    for (const [taskId, task] of this.dependencyGraph) {
      if (task.status === 'pending' && task.dependencies.size > 0) {
        summary.blocked++;
      }
    }

    return summary;
  }

  // Persist dependency graph to Redis
  async persistDependencyGraph() {
    const graphData = {
      tasks: Array.from(this.dependencyGraph.entries()).map(([id, task]) => ({
        id,
        dependencies: Array.from(task.dependencies),
        metadata: task.metadata,
        status: task.status,
        addedAt: task.addedAt,
        completedAt: task.completedAt
      })),
      executionQueue: this.executionQueue,
      completedTasks: Array.from(this.completedTasks),
      runningTasks: Array.from(this.runningTasks)
    };

    await this.taskManager.redis.hSet('dependency_graph', {
      data: JSON.stringify(graphData),
      lastUpdated: new Date().toISOString()
    });
  }

  // Load dependency graph from Redis
  async loadDependencyGraph() {
    const stored = await this.taskManager.redis.hGetAll('dependency_graph');
    if (stored && stored.data) {
      const graphData = JSON.parse(stored.data);
      
      // Rebuild graph
      this.dependencyGraph.clear();
      for (const task of graphData.tasks) {
        this.dependencyGraph.set(task.id, {
          ...task,
          dependencies: new Set(task.dependencies)
        });
      }

      this.executionQueue = graphData.executionQueue || [];
      this.completedTasks = new Set(graphData.completedTasks || []);
      this.runningTasks = new Set(graphData.runningTasks || []);

      // Rebuild blocked tasks map
      this.blockedTasks.clear();
      for (const [taskId, task] of this.dependencyGraph) {
        for (const dep of task.dependencies) {
          if (!this.blockedTasks.has(dep)) {
            this.blockedTasks.set(dep, new Set());
          }
          this.blockedTasks.get(dep).add(taskId);
        }
      }

      logger.info(`Loaded dependency graph with ${this.dependencyGraph.size} tasks`);
    }
  }

  // Clear completed tasks older than specified hours
  async cleanupCompletedTasks(hoursOld = 24) {
    const cutoffTime = Date.now() - (hoursOld * 60 * 60 * 1000);
    let removed = 0;

    for (const [taskId, task] of this.dependencyGraph) {
      if (task.status === 'completed' && task.completedAt < cutoffTime) {
        this.dependencyGraph.delete(taskId);
        this.completedTasks.delete(taskId);
        removed++;
      }
    }

    if (removed > 0) {
      await this.persistDependencyGraph();
      logger.info(`Cleaned up ${removed} completed tasks older than ${hoursOld} hours`);
    }

    return removed;
  }
}

export default DependencyResolver;