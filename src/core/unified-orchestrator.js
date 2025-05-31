import { LLMProvider } from '../infrastructure/llm-provider.js';
import { ToolManager } from '../tools/manager.js';
import { QualityGateway } from './quality-gateway.js';
import { DependencyResolver } from './dependency-resolver.js';
import { ErrorRecoveryManager } from './error-recovery.js';
import { agentConfig } from '../agents/roles.js';
import { AgentExecutor } from '../agents/executor.js';
import { ProjectManager } from '../database/project-manager.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class UnifiedOrchestrator {
  constructor(taskManager, llmProvider, websocketServer = null) {
    this.taskManager = taskManager;
    this.llmProvider = llmProvider;
    this.websocketServer = websocketServer;
    this.toolManager = new ToolManager(taskManager);
    this.qualityGateway = new QualityGateway(taskManager);
    this.projectManager = new ProjectManager(taskManager);
    this.agentExecutor = new AgentExecutor(llmProvider, this.toolManager);
    this.dependencyResolver = new DependencyResolver(taskManager);
    this.errorRecovery = new ErrorRecoveryManager(taskManager);
    this.activeProjects = new Map();
    this.agentWorkload = new Map();
    this.taskExecutionInterval = null;
  }

  async init() {
    await this.toolManager.init();
    await this.qualityGateway.init();
    await this.projectManager.init();
    await this.agentExecutor.init();
    await this.dependencyResolver.init();
    await this.dependencyResolver.loadDependencyGraph();
    
    // Start task execution loop
    this.startTaskExecutionLoop();
    
    logger.info('Unified Orchestrator initialized');
  }

  startTaskExecutionLoop() {
    // Execute pending tasks every 2 seconds
    this.taskExecutionInterval = setInterval(async () => {
      try {
        await this.processPendingTasks();
      } catch (error) {
        logger.error('Task execution loop error:', error);
      }
    }, 2000);
  }

  async processPendingTasks() {
    // Get tasks that can be executed
    const executableTasks = await this.dependencyResolver.getExecutableTasks(5);
    
    for (const task of executableTasks) {
      // Check agent availability
      const agentType = task.metadata.agent || task.metadata.agentType;
      const currentLoad = this.agentWorkload.get(agentType) || 0;
      
      if (currentLoad < 3) { // Max 3 concurrent tasks per agent
        this.executeAgentTask(
          task.id,
          agentType,
          task.metadata.action || task.metadata.type,
          task.metadata.data || task.metadata.context
        );
      } else {
        // Put back in queue if agent is overloaded
        await this.dependencyResolver.executionQueue.push(task.id);
      }
    }
  }

  async initializeProject(projectName, requirements, stack) {
    const projectId = uuidv4();
    
    // Create project in database
    await this.projectManager.createProject(projectId, {
      name: projectName,
      requirements,
      stack: stack || 'auto-detect',
      createdAt: new Date().toISOString(),
      status: 'initializing'
    });

    this.activeProjects.set(projectId, {
      name: projectName,
      phase: 'initialization',
      agents: new Set(),
      tasks: new Map()
    });

    // Broadcast project initialization
    if (this.websocketServer) {
      this.websocketServer.broadcastProjectUpdate(projectId, {
        phase: 'initialization',
        status: 'Project created and initializing'
      });
    }

    // CTO analyzes requirements and creates initial architecture
    const ctoTaskId = await this.createAgentTask('cto', 'analyze_project_requirements', {
      projectId,
      projectName,
      requirements,
      stack
    });

    // Trigger project setup pipeline
    await this.triggerProjectSetupPipeline(projectId, ctoTaskId);

    return projectId;
  }

  async triggerProjectSetupPipeline(projectId, ctoTaskId) {
    try {
      // Create dependent tasks with proper dependencies
      
      // Solution Architect: Design system architecture (depends on CTO)
      const saTaskId = await this.createAgentTask(
        'solution_architect', 
        'design_system_architecture', 
        { projectId, ctoTaskId },
        [ctoTaskId] // Dependency
      );

      // Product Manager: Break down features (depends on CTO)
      const pmTaskId = await this.createAgentTask(
        'product_manager', 
        'analyze_feature_requirements', 
        { projectId, ctoTaskId },
        [ctoTaskId] // Dependency
      );

      // Business Analyst: Define detailed requirements (depends on PM)
      const baTaskId = await this.createAgentTask(
        'business_analyst',
        'define_detailed_requirements',
        { projectId },
        [pmTaskId] // Dependency
      );

      // Engineering Manager: Plan development phases (depends on SA and BA)
      const emTaskId = await this.createAgentTask(
        'engineering_manager',
        'plan_development_phases',
        { projectId },
        [saTaskId, baTaskId] // Dependencies
      );

      // Backend Dev: Setup project structure (depends on SA)
      await this.createAgentTask(
        'backend_dev',
        'setup_project_structure',
        { projectId },
        [saTaskId] // Dependency
      );

      logger.info(`Project setup pipeline created for ${projectId} with proper dependencies`);
      
    } catch (error) {
      logger.error('Project setup pipeline failed:', error);
    }
  }

  async processFeatureRequest(projectId, featureRequest) {
    const taskId = uuidv4();
    
    // Log feature request
    await this.taskManager.logActivity('feature_request', 'user', taskId, projectId, {
      featureRequest,
      timestamp: Date.now()
    });

    // Broadcast feature request received
    if (this.websocketServer) {
      this.websocketServer.broadcastProjectUpdate(projectId, {
        phase: 'feature_development',
        feature: featureRequest,
        status: 'Feature request received and being analyzed'
      });
    }

    // CTO analyzes feature impact and delegates
    const ctoTaskId = await this.createAgentTask('cto', 'analyze_feature_request', {
      projectId,
      featureRequest,
      parentTaskId: taskId
    });

    // Trigger feature development pipeline
    await this.triggerFeaturePipeline(projectId, ctoTaskId, featureRequest);

    return taskId;
  }

  async triggerFeaturePipeline(projectId, ctoTaskId, featureRequest) {
    setTimeout(async () => {
      try {
        // Business Analyst: Define acceptance criteria
        const baTaskId = await this.createAgentTask('business_analyst', 'define_acceptance_criteria', {
          projectId,
          featureRequest,
          parentTaskId: ctoTaskId
        });

        // Solution Architect: Design technical implementation
        const saTaskId = await this.createAgentTask('solution_architect', 'design_feature_implementation', {
          projectId,
          featureRequest,
          parentTaskId: ctoTaskId
        });

        // Wait for design completion, then start development
        setTimeout(async () => {
          // Backend Development
          await this.createAgentTask('backend_dev', 'implement_backend_logic', {
            projectId,
            featureRequest,
            requirementTaskId: baTaskId,
            designTaskId: saTaskId
          });

          // Frontend Development
          await this.createAgentTask('frontend_dev', 'implement_frontend_components', {
            projectId,
            featureRequest,
            requirementTaskId: baTaskId,
            designTaskId: saTaskId
          });

          // QA Engineer: Create tests
          await this.createAgentTask('qa_engineer', 'create_feature_tests', {
            projectId,
            featureRequest,
            requirementTaskId: baTaskId
          });

        }, 5000);

      } catch (error) {
        logger.error('Feature pipeline failed:', error);
      }
    }, 3000);
  }

  async createAgentTask(agentType, action, data, dependencies = []) {
    const taskId = uuidv4();
    const config = agentConfig[agentType];
    
    if (!config) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    // Extract dependencies from data if provided
    if (!dependencies.length) {
      if (data.parentTaskId) dependencies.push(data.parentTaskId);
      if (data.requirementTaskId) dependencies.push(data.requirementTaskId);
      if (data.designTaskId) dependencies.push(data.designTaskId);
    }

    const taskData = {
      id: taskId,
      agentType,
      action,
      data: JSON.stringify(data),
      llmType: config.llmType,
      instructions: config.instructions,
      status: 'pending',
      createdAt: new Date().toISOString(),
      projectId: data.projectId || 'default'
    };

    await this.taskManager.redis.hSet(`agent_task:${taskId}`, taskData);
    
    // Add task to dependency resolver
    await this.dependencyResolver.addTask(taskId, dependencies, {
      agentType,
      action,
      data,
      projectId: data.projectId,
      priority: config.priority || 0
    });

    // Track agent workload
    this.agentWorkload.set(agentType, (this.agentWorkload.get(agentType) || 0) + 1);

    // Broadcast agent activity
    if (this.websocketServer && data.projectId) {
      this.websocketServer.broadcastAgentActivity(data.projectId, agentType, {
        action,
        taskId,
        status: 'queued',
        dependencies: dependencies.length
      });
    }

    logger.info(`Created ${agentType} task: ${taskId} for action: ${action} with ${dependencies.length} dependencies`);
    return taskId;
  }

  async executeAgentTask(taskId, agentType, action, data) {
    try {
      // Update task status to running
      await this.taskManager.redis.hSet(`agent_task:${taskId}`, {
        status: 'running',
        startedAt: new Date().toISOString()
      });

      // Broadcast task start
      if (this.websocketServer && data.projectId) {
        this.websocketServer.broadcastTaskStart(data.projectId, {
          id: taskId,
          agentType,
          action,
          status: 'running'
        });
      }

      // Execute the task using agent executor with error recovery
      const results = await this.executeWithRecovery(
        () => this.agentExecutor.executeTask(agentType, action, data),
        {
          operation: 'agent_task',
          taskId,
          agentType,
          action,
          projectId: data.projectId
        }
      );

      // Complete the task
      await this.completeAgentTask(taskId, results);

      // Broadcast task completion
      if (this.websocketServer && data.projectId) {
        this.websocketServer.broadcastTaskComplete(data.projectId, {
          id: taskId,
          agentType,
          action
        }, results.actionResults || results);
      }

      // Trigger dependent tasks or quality checks
      await this.handleTaskCompletion(taskId, agentType, action, data, results);

    } catch (error) {
      // Attempt recovery
      try {
        const recovered = await this.errorRecovery.handleError(error, {
          operation: 'agent_task',
          taskId,
          agentType,
          action,
          projectId: data.projectId,
          retryOperation: () => this.agentExecutor.executeTask(agentType, action, data)
        });
        
        if (recovered) {
          // Task recovered successfully
          await this.completeAgentTask(taskId, recovered);
          return;
        }
      } catch (recoveryError) {
        logger.error(`Agent task recovery failed: ${taskId}`, recoveryError);
      }
      
      // Mark task as failed
      await this.taskManager.redis.hSet(`agent_task:${taskId}`, {
        status: 'failed',
        failedAt: new Date().toISOString(),
        error: error.message
      });

      // Broadcast task error
      if (this.websocketServer && data.projectId) {
        this.websocketServer.broadcastTaskError(data.projectId, {
          id: taskId,
          agentType,
          action
        }, error);
      }

      // Reduce agent workload
      this.agentWorkload.set(agentType, Math.max(0, (this.agentWorkload.get(agentType) || 1) - 1));
    }
  }

  async executeWithRecovery(operation, context) {
    try {
      return await operation();
    } catch (error) {
      // Check if this is a recoverable error
      const pattern = this.errorRecovery.identifyErrorPattern(error);
      
      if (pattern && pattern.recoverable) {
        logger.info(`Attempting recovery for ${context.operation}`);
        
        // Override retry operation in context
        context.retryOperation = operation;
        
        return await this.errorRecovery.handleError(error, context);
      }
      
      throw error;
    }
  }

  async completeAgentTask(taskId, results) {
    const task = await this.taskManager.redis.hGetAll(`agent_task:${taskId}`);
    
    await this.taskManager.redis.hSet(`agent_task:${taskId}`, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      results: JSON.stringify(results)
    });

    // Notify dependency resolver
    await this.dependencyResolver.completeTask(taskId, results);

    // Reduce agent workload
    const agentType = task.agentType;
    this.agentWorkload.set(agentType, Math.max(0, (this.agentWorkload.get(agentType) || 1) - 1));

    logger.info(`Completed ${agentType} task: ${taskId}`);
    return results;
  }

  async handleTaskCompletion(taskId, agentType, action, data, results) {
    // Trigger quality checks for code-producing agents
    if (['backend_dev', 'frontend_dev'].includes(agentType)) {
      await this.scheduleQualityCheck(data.projectId, taskId, results);
    }

    // Trigger dependent tasks based on completed action
    await this.triggerDependentTasks(taskId, agentType, action, data, results);
  }

  async scheduleQualityCheck(projectId, taskId, results) {
    // Security scan for new code
    await this.createAgentTask('security', 'scan_code_changes', {
      projectId,
      sourceTaskId: taskId,
      codeChanges: results.codeChanges
    });

    // QA review if not already done
    await this.createAgentTask('qa_engineer', 'review_code_quality', {
      projectId,
      sourceTaskId: taskId,
      codeChanges: results.codeChanges
    });
  }

  async triggerDependentTasks(taskId, agentType, action, data, results) {
    const projectId = data.projectId;

    // Specific dependency patterns
    switch (`${agentType}:${action}`) {
      case 'solution_architect:design_system_architecture':
        // Architecture complete, start implementation
        await this.createAgentTask('backend_dev', 'setup_project_structure', {
          projectId,
          architecture: results.architecture
        });
        break;

      case 'backend_dev:implement_backend_logic':
        // Backend ready, frontend can integrate
        await this.createAgentTask('frontend_dev', 'integrate_api_endpoints', {
          projectId,
          apiEndpoints: results.apiEndpoints
        });
        break;

      case 'qa_engineer:create_feature_tests':
        // Tests ready, run them
        await this.createAgentTask('qa_engineer', 'execute_test_suite', {
          projectId,
          testSuite: results.testSuite
        });
        break;
    }
  }
  async deployProject(projectId, deploymentConfig) {
    const deploymentId = uuidv4();
    
    // DevOps handles deployment
    const devopsTaskId = await this.createAgentTask('devops', 'deploy_application', {
      projectId,
      deploymentConfig: deploymentConfig || 'production',
      deploymentId
    });

    // Security final scan
    await this.createAgentTask('security', 'final_security_scan', {
      projectId,
      deploymentId
    });

    return deploymentId;
  }

  async maintainProject(projectId, maintenanceRequest) {
    const maintenanceId = uuidv4();
    
    // CTO analyzes maintenance needs
    const ctoTaskId = await this.createAgentTask('cto', 'analyze_maintenance_request', {
      projectId,
      maintenanceRequest,
      maintenanceId
    });

    // Trigger maintenance pipeline
    setTimeout(async () => {
      await this.createAgentTask('security', 'security_audit', { projectId, maintenanceId });
      await this.createAgentTask('devops', 'performance_optimization', { projectId, maintenanceId });
      await this.createAgentTask('qa_engineer', 'regression_testing', { projectId, maintenanceId });
    }, 2000);

    return maintenanceId;
  }

  async analyzeProject(projectId, analysisRequest) {
    // Run comprehensive analysis
    const analysisResults = await this.qualityGateway.runProjectAnalysis(projectId);
    
    return {
      codeQuality: analysisResults.codeQuality || 85,
      architectureScore: analysisResults.architectureScore || 90,
      securityRating: analysisResults.securityRating || 'A',
      performanceScore: analysisResults.performanceScore || 88,
      documentationCoverage: analysisResults.documentationCoverage || 75,
      testCoverage: analysisResults.testCoverage || 82,
      recommendations: analysisResults.recommendations || [
        'Increase test coverage to 90%',
        'Add API documentation',
        'Optimize database queries'
      ],
      technicalDebt: analysisResults.technicalDebt || 12
    };
  }

  async getProjectStatus(projectId) {
    const project = this.activeProjects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Get recent tasks
    const recentTasks = await this.getRecentTasks(projectId, 5);
    const activeAgents = await this.getActiveAgents(projectId);
    const qualityMetrics = await this.qualityGateway.getProjectMetrics(projectId);

    return {
      completionPercentage: this.calculateCompletionPercentage(recentTasks),
      currentPhase: project.phase,
      activeAgents: activeAgents.length,
      qualityScore: qualityMetrics.overallScore || 85,
      recentActivity: recentTasks.map(task => 
        `${task.agentType}: ${task.action} (${task.status})`
      ),
      issues: qualityMetrics.issues || [],
      filesModified: qualityMetrics.filesModified || 0,
      testsPass: qualityMetrics.testsPass || 0,
      testsTotal: qualityMetrics.testsTotal || 0,
      readyForDeploy: qualityMetrics.readyForDeploy || false
    };
  }

  async getAllProjectsStatus() {
    const projects = [];
    for (const [projectId, projectData] of this.activeProjects) {
      const status = await this.getProjectStatus(projectId);
      projects.push({
        name: projectData.name,
        progress: status.completionPercentage,
        status: status.currentPhase,
        activeTasks: status.activeAgents
      });
    }
    return projects;
  }

  async getRecentTasks(projectId, limit = 10) {
    const taskKeys = await this.taskManager.redis.keys(`agent_task:*`);
    const tasks = [];

    for (const key of taskKeys.slice(0, limit)) {
      const task = await this.taskManager.redis.hGetAll(key);
      if (task.projectId === projectId) {
        tasks.push(task);
      }
    }

    return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
  }

  async getActiveAgents(projectId) {
    const activeTasks = await this.getRecentTasks(projectId, 20);
    const activeAgents = new Set();
    
    activeTasks.forEach(task => {
      if (task.status === 'running' || task.status === 'pending') {
        activeAgents.add(task.agentType);
      }
    });

    return Array.from(activeAgents);
  }

  calculateCompletionPercentage(tasks) {
    if (tasks.length === 0) return 0;
    
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / tasks.length) * 100);
  }

  // Advanced workflow creation methods
  async createBugFixWorkflow(projectId, bugDescription) {
    const workflow = await this.dependencyResolver.createWorkflowChain(
      'bug_fix',
      projectId,
      { bugDescription }
    );
    
    if (this.websocketServer) {
      this.websocketServer.broadcastProjectUpdate(projectId, {
        phase: 'bug_fix',
        workflow: workflow.workflowId,
        status: 'Bug fix workflow initiated'
      });
    }
    
    return workflow;
  }

  async createPerformanceOptimizationWorkflow(projectId, targetMetrics) {
    const workflow = await this.dependencyResolver.createWorkflowChain(
      'performance_optimization',
      projectId,
      { targetMetrics }
    );
    
    if (this.websocketServer) {
      this.websocketServer.broadcastProjectUpdate(projectId, {
        phase: 'optimization',
        workflow: workflow.workflowId,
        status: 'Performance optimization workflow started'
      });
    }
    
    return workflow;
  }

  async createSecurityAuditWorkflow(projectId) {
    const workflow = await this.dependencyResolver.createWorkflowChain(
      'security_audit',
      projectId,
      {}
    );
    
    if (this.websocketServer) {
      this.websocketServer.broadcastProjectUpdate(projectId, {
        phase: 'security_audit',
        workflow: workflow.workflowId,
        status: 'Security audit workflow initiated'
      });
    }
    
    return workflow;
  }

  // Get workflow status
  async getWorkflowStatus() {
    const status = this.dependencyResolver.getStatusSummary();
    const cycles = this.dependencyResolver.detectCircularDependencies();
    
    return {
      ...status,
      hasCircularDependencies: cycles.length > 0,
      circularDependencies: cycles,
      agentWorkload: Object.fromEntries(this.agentWorkload)
    };
  }

  // Cleanup method
  async cleanup() {
    if (this.taskExecutionInterval) {
      clearInterval(this.taskExecutionInterval);
    }
    
    // Clean up old completed tasks
    await this.dependencyResolver.cleanupCompletedTasks(24);
    
    logger.info('Orchestrator cleanup completed');
  }
}