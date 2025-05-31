import { jest } from '@jest/globals';
import { DependencyResolver } from '../../src/core/dependency-resolver.js';

describe('DependencyResolver', () => {
  let resolver;
  let mockTaskManager;

  beforeEach(() => {
    mockTaskManager = {
      redis: {
        hSet: jest.fn(),
        hGetAll: jest.fn(),
        keys: jest.fn()
      }
    };
    resolver = new DependencyResolver(mockTaskManager);
  });

  describe('addTask', () => {
    it('should add task with no dependencies to execution queue', async () => {
      const taskId = 'task1';
      const dependencies = [];
      const metadata = { type: 'test' };

      await resolver.addTask(taskId, dependencies, metadata);

      expect(resolver.executionQueue).toContain(taskId);
      expect(resolver.dependencyGraph.get(taskId)).toMatchObject({
        id: taskId,
        dependencies: new Set(),
        metadata,
        status: 'pending'
      });
    });

    it('should add task with dependencies to blocked tasks', async () => {
      const taskId = 'task2';
      const dependencies = ['task1'];
      const metadata = { type: 'test' };

      await resolver.addTask(taskId, dependencies, metadata);

      expect(resolver.executionQueue).not.toContain(taskId);
      expect(resolver.blockedTasks.get('task1')).toContain(taskId);
    });
  });

  describe('completeTask', () => {
    beforeEach(async () => {
      await resolver.addTask('task1', []);
      await resolver.addTask('task2', ['task1']);
      await resolver.addTask('task3', ['task1', 'task2']);
    });

    it('should mark task as completed', async () => {
      await resolver.completeTask('task1', { result: 'success' });

      const task = resolver.dependencyGraph.get('task1');
      expect(task.status).toBe('completed');
      expect(resolver.completedTasks.has('task1')).toBe(true);
    });

    it('should unblock dependent tasks', async () => {
      await resolver.completeTask('task1');

      expect(resolver.executionQueue).toContain('task2');
      const task2 = resolver.dependencyGraph.get('task2');
      expect(task2.dependencies.size).toBe(0);
    });

    it('should not unblock tasks with remaining dependencies', async () => {
      await resolver.completeTask('task1');

      expect(resolver.executionQueue).not.toContain('task3');
      const task3 = resolver.dependencyGraph.get('task3');
      expect(task3.dependencies.size).toBe(1);
    });
  });

  describe('getExecutableTasks', () => {
    beforeEach(async () => {
      await resolver.addTask('task1', []);
      await resolver.addTask('task2', []);
      await resolver.addTask('task3', ['task1']);
    });

    it('should return tasks with no dependencies', async () => {
      const tasks = await resolver.getExecutableTasks(2);

      expect(tasks).toHaveLength(2);
      expect(tasks.map(t => t.id)).toContain('task1');
      expect(tasks.map(t => t.id)).toContain('task2');
    });

    it('should mark returned tasks as running', async () => {
      await resolver.getExecutableTasks(2);

      expect(resolver.runningTasks.has('task1')).toBe(true);
      expect(resolver.runningTasks.has('task2')).toBe(true);
    });

    it('should respect max tasks limit', async () => {
      const tasks = await resolver.getExecutableTasks(1);

      expect(tasks).toHaveLength(1);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect simple circular dependency', async () => {
      await resolver.addTask('task1', ['task2']);
      await resolver.addTask('task2', ['task1']);

      const cycles = resolver.detectCircularDependencies();

      expect(cycles).toHaveLength(2); // Each task sees the cycle
      expect(cycles[0]).toContain('task1');
      expect(cycles[0]).toContain('task2');
    });

    it('should detect complex circular dependency', async () => {
      await resolver.addTask('task1', ['task2']);
      await resolver.addTask('task2', ['task3']);
      await resolver.addTask('task3', ['task1']);

      const cycles = resolver.detectCircularDependencies();

      expect(cycles.length).toBeGreaterThan(0);
      const cycle = cycles[0];
      expect(cycle).toContain('task1');
      expect(cycle).toContain('task2');
      expect(cycle).toContain('task3');
    });

    it('should return empty array for no cycles', async () => {
      await resolver.addTask('task1', []);
      await resolver.addTask('task2', ['task1']);
      await resolver.addTask('task3', ['task2']);

      const cycles = resolver.detectCircularDependencies();

      expect(cycles).toHaveLength(0);
    });
  });

  describe('createWorkflowChain', () => {
    it('should create feature development workflow', async () => {
      const projectId = 'project1';
      const workflow = await resolver.createWorkflowChain('feature_development', projectId);

      expect(workflow.workflowType).toBe('feature_development');
      expect(workflow.tasks).toHaveLength(7);
      expect(workflow.workflowId).toBeDefined();
    });

    it('should create tasks with proper dependencies', async () => {
      const workflow = await resolver.createWorkflowChain('bug_fix', 'project1');

      // First task should have no dependencies
      const firstTask = resolver.dependencyGraph.get(workflow.tasks[0]);
      expect(firstTask.dependencies.size).toBe(0);

      // Later tasks should have dependencies
      const secondTask = resolver.dependencyGraph.get(workflow.tasks[1]);
      expect(secondTask.dependencies.has(workflow.tasks[0])).toBe(true);
    });

    it('should throw error for unknown workflow type', async () => {
      await expect(
        resolver.createWorkflowChain('unknown_workflow', 'project1')
      ).rejects.toThrow('Unknown workflow type');
    });
  });

  describe('optimizeExecutionPlan', () => {
    beforeEach(async () => {
      await resolver.addTask('task1', [], { priority: 1 });
      await resolver.addTask('task2', [], { priority: 3 });
      await resolver.addTask('task3', ['task1'], { priority: 2 });
      await resolver.addTask('task4', [], { priority: 2 });
    });

    it('should prioritize tasks with no dependencies', async () => {
      await resolver.optimizeExecutionPlan();

      const firstTasks = resolver.executionQueue.slice(0, 3);
      expect(firstTasks).toContain('task1');
      expect(firstTasks).toContain('task2');
      expect(firstTasks).toContain('task4');
    });

    it('should order by priority for tasks with no dependencies', async () => {
      await resolver.optimizeExecutionPlan();

      const queue = resolver.executionQueue;
      const task2Index = queue.indexOf('task2');
      const task4Index = queue.indexOf('task4');
      const task1Index = queue.indexOf('task1');

      // task2 has highest priority (3)
      expect(task2Index).toBeLessThan(task4Index);
      expect(task2Index).toBeLessThan(task1Index);
    });
  });

  describe('getStatusSummary', () => {
    beforeEach(async () => {
      await resolver.addTask('task1', []);
      await resolver.addTask('task2', ['task1']);
      await resolver.addTask('task3', ['task1']);
      await resolver.completeTask('task1');
    });

    it('should return correct status counts', () => {
      const summary = resolver.getStatusSummary();

      expect(summary).toMatchObject({
        total: 3,
        completed: 1,
        running: 0,
        blocked: 0,
        ready: 2
      });
    });
  });

  describe('cleanupCompletedTasks', () => {
    beforeEach(async () => {
      await resolver.addTask('task1', []);
      await resolver.addTask('task2', []);
      
      // Complete task1 and set its completion time to 25 hours ago
      await resolver.completeTask('task1');
      const task1 = resolver.dependencyGraph.get('task1');
      task1.completedAt = Date.now() - (25 * 60 * 60 * 1000);
    });

    it('should remove old completed tasks', async () => {
      const removed = await resolver.cleanupCompletedTasks(24);

      expect(removed).toBe(1);
      expect(resolver.dependencyGraph.has('task1')).toBe(false);
      expect(resolver.completedTasks.has('task1')).toBe(false);
    });

    it('should keep recent completed tasks', async () => {
      await resolver.completeTask('task2');
      const removed = await resolver.cleanupCompletedTasks(24);

      expect(removed).toBe(1); // Only task1 removed
      expect(resolver.dependencyGraph.has('task2')).toBe(true);
    });
  });
});