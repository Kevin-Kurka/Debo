import { jest } from '@jest/globals';
import { TerminalCommandHandler } from '../../src/terminal-command-handler.js';

describe('TerminalCommandHandler', () => {
  let handler;
  let mockOrchestrator;
  let mockTaskManager;

  beforeEach(() => {
    // Mock orchestrator
    mockOrchestrator = {
      initializeProject: jest.fn().mockResolvedValue('project-id-123'),
      processFeatureRequest: jest.fn().mockResolvedValue('task-id-456'),
      createAgentTask: jest.fn().mockResolvedValue('task-id-789'),
      qualityGateway: {
        runFullAnalysis: jest.fn().mockResolvedValue({
          overallScore: 85,
          issues: []
        })
      }
    };

    // Mock task manager
    mockTaskManager = {
      getProjectStatus: jest.fn().mockResolvedValue({
        status: 'active',
        phase: 'development',
        completedTasks: 10,
        lastActivity: '2024-01-01T10:00:00Z'
      }),
      getActiveTasks: jest.fn().mockResolvedValue([]),
      getAllProjects: jest.fn().mockResolvedValue({
        'project-1': { name: 'Test Project', status: 'active', createdAt: '2024-01-01' }
      }),
      getAllActiveTasks: jest.fn().mockResolvedValue([]),
      getProjectLogs: jest.fn().mockResolvedValue([]),
      getRecentLogs: jest.fn().mockResolvedValue([])
    };

    handler = new TerminalCommandHandler(mockOrchestrator, mockTaskManager);
  });

  describe('handleCommand', () => {
    it('should handle create command', async () => {
      const args = {
        name: 'test-project',
        description: 'A test project',
        stack: 'react'
      };

      const result = await handler.handleCommand('create', args);

      expect(mockOrchestrator.initializeProject).toHaveBeenCalledWith(
        'test-project',
        'A test project',
        'react'
      );
      expect(result.projectId).toBe('project-id-123');
      expect(result.name).toBe('test-project');
    });

    it('should handle develop command', async () => {
      const args = {
        project: 'Test Project',
        feature: 'Add user authentication'
      };

      const result = await handler.handleCommand('develop', args);

      expect(mockOrchestrator.processFeatureRequest).toHaveBeenCalled();
      expect(result.taskId).toBe('task-id-456');
    });

    it('should handle status command', async () => {
      const args = { project: 'Test Project' };

      const result = await handler.handleCommand('status', args);

      expect(result.status).toBe('active');
      expect(result.phase).toBe('development');
      expect(result.completedTasks).toBe(10);
    });

    it('should handle help command', async () => {
      const result = await handler.handleCommand('help');

      expect(result.commands).toBeDefined();
      expect(result.commands.length).toBeGreaterThan(0);
      expect(result.commands[0]).toHaveProperty('cmd');
      expect(result.commands[0]).toHaveProperty('desc');
      expect(result.commands[0]).toHaveProperty('usage');
    });

    it('should throw error for unknown command', async () => {
      await expect(handler.handleCommand('unknown')).rejects.toThrow('Unknown command');
    });
  });

  describe('handleCreateProject', () => {
    it('should throw error if name or description missing', async () => {
      await expect(handler.handleCreateProject({})).rejects.toThrow(
        'Project name and description are required'
      );

      await expect(handler.handleCreateProject({ name: 'test' })).rejects.toThrow(
        'Project name and description are required'
      );
    });

    it('should return project creation result', async () => {
      const args = {
        name: 'test-project',
        description: 'Test description'
      };

      const result = await handler.handleCreateProject(args);

      expect(result).toMatchObject({
        projectId: 'project-id-123',
        name: 'test-project',
        message: expect.stringContaining('created successfully'),
        webSocketUrl: 'ws://localhost:3001',
        monitorUrl: 'http://localhost:3001'
      });
    });
  });

  describe('handleDevelopFeature', () => {
    it('should throw error if project or feature missing', async () => {
      await expect(handler.handleDevelopFeature({})).rejects.toThrow(
        'Project name and feature description are required'
      );
    });

    it('should find project and create feature task', async () => {
      const args = {
        project: 'Test Project',
        feature: 'Add login feature'
      };

      const result = await handler.handleDevelopFeature(args);

      expect(result).toMatchObject({
        taskId: 'task-id-456',
        projectId: 'project-1',
        message: 'Feature development started'
      });
    });
  });

  describe('handleDeploy', () => {
    it('should create deployment task', async () => {
      const args = {
        project: 'Test Project',
        environment: 'production'
      };

      const result = await handler.handleDeploy(args);

      expect(mockOrchestrator.createAgentTask).toHaveBeenCalledWith(
        'devops',
        'deploy_application',
        expect.objectContaining({
          projectId: 'project-1',
          deploymentConfig: 'production'
        })
      );
      expect(result.environment).toBe('production');
    });
  });

  describe('handleMaintenance', () => {
    it('should create maintenance tasks', async () => {
      const args = {
        project: 'Test Project',
        tasks: 'update deps, fix warnings, optimize build'
      };

      const result = await handler.handleMaintenance(args);

      expect(mockOrchestrator.createAgentTask).toHaveBeenCalledTimes(3);
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks).toContain('update deps');
      expect(result.tasks).toContain('fix warnings');
      expect(result.tasks).toContain('optimize build');
    });
  });

  describe('handleAnalyze', () => {
    it('should run quality analysis', async () => {
      const args = { project: 'Test Project' };

      const result = await handler.handleAnalyze(args);

      expect(mockOrchestrator.qualityGateway.runFullAnalysis).toHaveBeenCalledWith('project-1');
      expect(result.quality.overallScore).toBe(85);
    });
  });

  describe('findProjectId', () => {
    it('should find project by name', async () => {
      const projectId = await handler.findProjectId('Test Project');

      expect(projectId).toBe('project-1');
    });

    it('should throw error if project not found', async () => {
      await expect(handler.findProjectId('Unknown Project')).rejects.toThrow(
        "Project 'Unknown Project' not found"
      );
    });
  });

  describe('listProjects', () => {
    it('should return formatted project list', async () => {
      const result = await handler.listProjects();

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0]).toMatchObject({
        id: 'project-1',
        name: 'Test Project',
        status: 'active'
      });
      expect(result.total).toBe(1);
    });
  });

  describe('listActiveTasks', () => {
    beforeEach(() => {
      mockTaskManager.getActiveTasks.mockResolvedValue([
        {
          id: 'task-1',
          agentType: 'backend_dev',
          action: 'implement_feature',
          status: 'running',
          projectId: 'project-1'
        }
      ]);
      mockTaskManager.getAllActiveTasks.mockResolvedValue([
        {
          id: 'task-2',
          agentType: 'qa_engineer',
          action: 'run_tests',
          status: 'pending',
          projectId: 'project-2'
        }
      ]);
    });

    it('should list tasks for specific project', async () => {
      const result = await handler.listActiveTasks({ project: 'Test Project' });

      expect(mockTaskManager.getActiveTasks).toHaveBeenCalledWith('project-1');
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].agent).toBe('backend_dev');
    });

    it('should list all active tasks when no project specified', async () => {
      const result = await handler.listActiveTasks({});

      expect(mockTaskManager.getAllActiveTasks).toHaveBeenCalled();
      expect(result.tasks).toHaveLength(1);
    });
  });

  describe('showLogs', () => {
    beforeEach(() => {
      const mockLogs = [
        { timestamp: '2024-01-01T10:00:00Z', message: 'Log entry 1' },
        { timestamp: '2024-01-01T10:01:00Z', message: 'Log entry 2' }
      ];
      mockTaskManager.getProjectLogs.mockResolvedValue(mockLogs);
      mockTaskManager.getRecentLogs.mockResolvedValue(mockLogs);
    });

    it('should show project logs', async () => {
      const result = await handler.showLogs({ project: 'Test Project', lines: 100 });

      expect(mockTaskManager.getProjectLogs).toHaveBeenCalledWith('project-1', 100);
      expect(result.logs).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('should show recent logs when no project specified', async () => {
      const result = await handler.showLogs({ lines: 50 });

      expect(mockTaskManager.getRecentLogs).toHaveBeenCalledWith(50);
      expect(result.logs).toHaveLength(2);
    });
  });
});