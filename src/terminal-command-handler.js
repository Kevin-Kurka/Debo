import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import logger from './logger.js';

export class TerminalCommandHandler {
  constructor(orchestrator, taskManager) {
    this.orchestrator = orchestrator;
    this.taskManager = taskManager;
    this.activeSpinners = new Map();
    this.commandHistory = [];
  }

  async handleCommand(command, args = {}) {
    const spinner = ora(`Processing ${command}...`).start();
    this.activeSpinners.set(command, spinner);
    
    try {
      let result;
      
      switch (command) {
        case 'create':
          result = await this.handleCreateProject(args);
          break;
          
        case 'develop':
          result = await this.handleDevelopFeature(args);
          break;
          
        case 'status':
          result = await this.handleProjectStatus(args);
          break;
          
        case 'deploy':
          result = await this.handleDeploy(args);
          break;
          
        case 'maintain':
          result = await this.handleMaintenance(args);
          break;
          
        case 'analyze':
          result = await this.handleAnalyze(args);
          break;
          
        case 'help':
          result = await this.showHelp();
          break;
          
        case 'list':
          result = await this.listProjects();
          break;
          
        case 'tasks':
          result = await this.listActiveTasks(args);
          break;
          
        case 'logs':
          result = await this.showLogs(args);
          break;
          
        default:
          throw new Error(`Unknown command: ${command}`);
      }
      
      spinner.succeed(`${command} completed successfully`);
      this.displayResult(result);
      
      return result;
      
    } catch (error) {
      spinner.fail(`${command} failed: ${error.message}`);
      logger.error(`Command ${command} failed`, error);
      throw error;
    } finally {
      this.activeSpinners.delete(command);
    }
  }

  async handleCreateProject(args) {
    const { name, description, stack } = args;
    
    if (!name || !description) {
      throw new Error('Project name and description are required');
    }
    
    console.log(chalk.blue('\n📦 Creating new project...'));
    console.log(chalk.gray(`Name: ${name}`));
    console.log(chalk.gray(`Stack: ${stack || 'auto-detect'}`));
    
    const projectId = await this.orchestrator.initializeProject(name, description, stack);
    
    return {
      projectId,
      name,
      message: `Project ${name} created successfully`,
      webSocketUrl: 'ws://localhost:3001',
      monitorUrl: 'http://localhost:3001'
    };
  }

  async handleDevelopFeature(args) {
    const { project, feature } = args;
    
    if (!project || !feature) {
      throw new Error('Project name and feature description are required');
    }
    
    // Find project ID by name
    const projectId = await this.findProjectId(project);
    
    console.log(chalk.blue('\n🚀 Developing new feature...'));
    console.log(chalk.gray(`Project: ${project}`));
    console.log(chalk.gray(`Feature: ${feature}`));
    
    const taskId = await this.orchestrator.processFeatureRequest(projectId, feature);
    
    return {
      taskId,
      projectId,
      message: `Feature development started`,
      monitorUrl: `http://localhost:3001?projectId=${projectId}`
    };
  }

  async handleProjectStatus(args) {
    const { project } = args;
    
    if (!project) {
      throw new Error('Project name is required');
    }
    
    const projectId = await this.findProjectId(project);
    const status = await this.taskManager.getProjectStatus(projectId);
    const activeTasks = await this.taskManager.getActiveTasks(projectId);
    
    return {
      projectId,
      status: status.status || 'unknown',
      phase: status.phase || 'unknown',
      activeTasks: activeTasks.length,
      completedTasks: status.completedTasks || 0,
      lastActivity: status.lastActivity || 'N/A'
    };
  }

  async handleDeploy(args) {
    const { project, environment } = args;
    
    if (!project || !environment) {
      throw new Error('Project name and environment are required');
    }
    
    const projectId = await this.findProjectId(project);
    
    console.log(chalk.blue('\n🚢 Deploying application...'));
    console.log(chalk.gray(`Project: ${project}`));
    console.log(chalk.gray(`Environment: ${environment}`));
    
    // Create deployment task
    const taskId = await this.orchestrator.createAgentTask('devops', 'deploy_application', {
      projectId,
      deploymentConfig: environment
    });
    
    return {
      taskId,
      projectId,
      environment,
      message: `Deployment to ${environment} initiated`
    };
  }

  async handleMaintenance(args) {
    const { project, tasks } = args;
    
    if (!project || !tasks) {
      throw new Error('Project name and maintenance tasks are required');
    }
    
    const projectId = await this.findProjectId(project);
    
    console.log(chalk.blue('\n🔧 Running maintenance...'));
    console.log(chalk.gray(`Project: ${project}`));
    console.log(chalk.gray(`Tasks: ${tasks}`));
    
    // Create maintenance workflow
    const maintenanceTasks = tasks.split(',').map(task => task.trim());
    const taskIds = [];
    
    for (const task of maintenanceTasks) {
      const taskId = await this.orchestrator.createAgentTask('backend_dev', 'perform_maintenance', {
        projectId,
        maintenanceTask: task
      });
      taskIds.push(taskId);
    }
    
    return {
      taskIds,
      projectId,
      tasks: maintenanceTasks,
      message: `${maintenanceTasks.length} maintenance tasks scheduled`
    };
  }

  async handleAnalyze(args) {
    const { project } = args;
    
    if (!project) {
      throw new Error('Project name is required');
    }
    
    const projectId = await this.findProjectId(project);
    
    console.log(chalk.blue('\n🔍 Analyzing project...'));
    console.log(chalk.gray(`Project: ${project}`));
    
    // Run quality analysis
    const qualityResults = await this.orchestrator.qualityGateway.runFullAnalysis(projectId);
    
    return {
      projectId,
      quality: qualityResults,
      message: 'Project analysis complete'
    };
  }

  async findProjectId(projectName) {
    // Search for project by name
    const projects = await this.taskManager.getAllProjects();
    
    for (const [id, project] of Object.entries(projects)) {
      if (project.name === projectName) {
        return id;
      }
    }
    
    throw new Error(`Project '${projectName}' not found`);
  }

  async listProjects() {
    const projects = await this.taskManager.getAllProjects();
    const projectList = [];
    
    for (const [id, project] of Object.entries(projects)) {
      projectList.push({
        id,
        name: project.name,
        status: project.status,
        created: project.createdAt
      });
    }
    
    return {
      projects: projectList,
      total: projectList.length,
      message: `Found ${projectList.length} projects`
    };
  }

  async listActiveTasks(args) {
    const { project } = args;
    let tasks = [];
    
    if (project) {
      const projectId = await this.findProjectId(project);
      tasks = await this.taskManager.getActiveTasks(projectId);
    } else {
      // Get all active tasks
      tasks = await this.taskManager.getAllActiveTasks();
    }
    
    return {
      tasks: tasks.map(task => ({
        id: task.id,
        agent: task.agentType,
        action: task.action,
        status: task.status,
        project: task.projectId
      })),
      total: tasks.length,
      message: `${tasks.length} active tasks`
    };
  }

  async showLogs(args) {
    const { project, lines = 50 } = args;
    
    let logs;
    if (project) {
      const projectId = await this.findProjectId(project);
      logs = await this.taskManager.getProjectLogs(projectId, lines);
    } else {
      logs = await this.taskManager.getRecentLogs(lines);
    }
    
    return {
      logs,
      count: logs.length,
      message: `Showing ${logs.length} log entries`
    };
  }

  async showHelp() {
    const commands = [
      { cmd: 'create', desc: 'Create a new project', usage: 'create <name> <description> [stack]' },
      { cmd: 'develop', desc: 'Add feature to project', usage: 'develop <project> <feature>' },
      { cmd: 'status', desc: 'Check project status', usage: 'status <project>' },
      { cmd: 'deploy', desc: 'Deploy project', usage: 'deploy <project> <environment>' },
      { cmd: 'maintain', desc: 'Run maintenance tasks', usage: 'maintain <project> <tasks>' },
      { cmd: 'analyze', desc: 'Analyze project quality', usage: 'analyze <project>' },
      { cmd: 'list', desc: 'List all projects', usage: 'list' },
      { cmd: 'tasks', desc: 'List active tasks', usage: 'tasks [project]' },
      { cmd: 'logs', desc: 'Show recent logs', usage: 'logs [project] [lines]' },
      { cmd: 'help', desc: 'Show this help', usage: 'help' }
    ];
    
    return {
      commands,
      message: 'Debo Command Reference',
      webMonitor: 'http://localhost:3001',
      documentation: 'https://github.com/Kevin-Kurka/Debo'
    };
  }

  displayResult(result) {
    const box = boxen(
      JSON.stringify(result, null, 2),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    );
    
    console.log(box);
  }

  formatCommandForDisplay(command, args) {
    let display = chalk.cyan(command);
    
    if (args) {
      const argStr = Object.entries(args)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      display += ` ${chalk.gray(argStr)}`;
    }
    
    return display;
  }
}

export default TerminalCommandHandler;