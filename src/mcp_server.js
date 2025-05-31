#!/usr/bin/env node

import { UnifiedOrchestrator } from './core/unified-orchestrator.js';
import { EnhancedTaskManager } from './database/task-manager.js';
import { LLMProvider } from './infrastructure/llm-provider.js';
import { WebSocketIntegration, createTestClient } from './websocket-integration.js';
import { TerminalCommandHandler } from './terminal-command-handler.js';
import { HelpSystem } from './help-system.js';
import logger from './logger.js';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';

class DeboMCPServer {
  constructor() {
    this.taskManager = new EnhancedTaskManager();
    this.llmProvider = new LLMProvider();
    this.websocketIntegration = null;
    this.orchestrator = null;
    this.terminalHandler = null;
    this.helpSystem = new HelpSystem();
    this.activeProjects = new Map();
    this.activeWorkflows = new Map();
    this.userSubscriptions = new Map();
    this.init();
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', this.handleData.bind(this));
    process.stdin.resume();
  }

  async init() {
    try {
      await this.taskManager.connect();
      await this.llmProvider.init();
      
      // Initialize WebSocket integration
      this.websocketIntegration = new WebSocketIntegration();
      const websocketServer = await this.websocketIntegration.init();
      
      // Create orchestrator with WebSocket support
      this.orchestrator = new UnifiedOrchestrator(this.taskManager, this.llmProvider, websocketServer);
      await this.orchestrator.init();
      
      // Initialize terminal command handler
      this.terminalHandler = new TerminalCommandHandler(this.orchestrator, this.taskManager);
      
      // Setup WebSocket test client route
      this.setupWebSocketTestClient();
      
      // Start background processes
      this.startBackgroundProcesses();
      
      logger.info("Debo Autonomous Development System ready");
      logger.info("All subsystems initialized:");
      logger.info("- Task Queue Management ✓");
      logger.info("- Documentation RAG System ✓");
      logger.info("- Compatibility Checking ✓");
      logger.info("- Git Workflow Management ✓");
      logger.info("- Feedback & Reporting ✓");
      logger.info("- Agent Orchestration ✓");
      logger.info("- Real-time WebSocket Monitoring ✓");
      logger.info("");
      logger.info("WebSocket monitoring available at: http://localhost:3001");
    } catch (error) {
      logger.error("Failed to initialize Debo system:", error);
      this.handleInitError(error);
    }
  }

  setupWebSocketTestClient() {
    if (this.websocketIntegration && this.websocketIntegration.app) {
      this.websocketIntegration.app.get('/', (req, res) => {
        res.send(createTestClient());
      });
    }
  }

  async handleData(data) {
    try {
      const request = JSON.parse(data.trim());
      let response;

      switch (request.method) {
        case 'initialize':
          response = { 
            jsonrpc: "2.0", 
            id: request.id, 
            result: {
              protocolVersion: "2024-11-05", 
              capabilities: { tools: {} },
              serverInfo: { 
                name: "debo-autonomous-dev", 
                version: "2.0.0",
                description: "Autonomous development system with Fortune 500 agent structure"
              }
            }
          };
          break;

        case 'tools/list':
          response = { 
            jsonrpc: "2.0", 
            id: request.id, 
            result: { 
              tools: [{
                name: "debo", 
                description: "Complete autonomous development system. Simply describe what you want to build and Debo handles everything: requirements gathering, architecture, coding, testing, documentation, and deployment. Features include dependency management, Git workflows, real-time progress tracking, and quality assurance.",
                inputSchema: { 
                  type: "object", 
                  properties: { 
                    request: { 
                      type: "string", 
                      description: "Natural language description of what you want. Examples: 'Build a task management app with React', 'Add user authentication to my project', 'Fix the login bug', 'Deploy to production'" 
                    },
                    options: {
                      type: "object",
                      description: "Optional configuration",
                      properties: {
                        projectName: { type: "string", description: "Specific project name" },
                        reportingMode: { type: "string", enum: ["minimal", "normal", "detailed", "live"], description: "How much feedback to provide" },
                        gitRepo: { type: "string", description: "Git repository URL if exists" },
                        deployTarget: { type: "string", description: "Deployment target (aws, vercel, heroku, etc.)" }
                      },
                      optional: true
                    }
                  }, 
                  required: ["request"] 
                }
              }]
            }
          };
          break;

        case 'tools/call':
          if (request.params?.name === 'debo') {
            const { command, project, request: userRequest, stack } = request.params.arguments;
            const result = await this.handleDeboCommand(command, project, userRequest, stack);
            
            response = { 
              jsonrpc: "2.0", 
              id: request.id, 
              result: { 
                content: [{ 
                  type: "text", 
                  text: result 
                }]
              }
            };
          }
          break;
      }

      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (error) {
      logger.error('Request failed:', error);
      const errorResponse = {
        jsonrpc: "2.0",
        id: request?.id || null,
        error: {
          code: -32603,
          message: "Internal error",
          data: error.message
        }
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }

  async handleDeboCommand(command, project, userRequest, stack) {
    // Parse natural language request if no explicit command
    if (!command && userRequest) {
      const parsedCommand = this.parseNaturalLanguageRequest(userRequest);
      command = parsedCommand.command;
      project = parsedCommand.project || project;
      userRequest = parsedCommand.request || userRequest;
      stack = parsedCommand.stack || stack;
    }
    
    try {
      // Use terminal handler for structured commands
      const args = this.buildCommandArgs(command, project, userRequest, stack);
      const result = await this.terminalHandler.handleCommand(command, args);
      
      // Format result for MCP response
      return this.formatTerminalResult(command, result);
      
    } catch (error) {
      // Fallback to legacy handlers
      switch (command) {
        case 'create':
          return await this.createProject(project, userRequest, stack);
        case 'develop':
          return await this.developFeature(project, userRequest);
        case 'status':
          return await this.getProjectStatus(project);
        case 'deploy':
          return await this.deployProject(project, userRequest);
        case 'maintain':
          return await this.maintainProject(project, userRequest);
        case 'analyze':
          return await this.analyzeProject(project, userRequest);
        case 'help':
          return await this.showHelp(project);
        default:
          return this.showUnknownCommandHelp(command);
      }
    }
  }

  parseNaturalLanguageRequest(request) {
    const lowerRequest = request.toLowerCase();
    
    // Detect command from natural language
    let command = 'develop'; // default
    let project = null;
    let parsedRequest = request;
    let stack = null;
    
    if (lowerRequest.includes('create') || lowerRequest.includes('new project') || lowerRequest.includes('build')) {
      command = 'create';
      // Extract project name
      const nameMatch = request.match(/(?:called|named|project)\s+([\w-]+)/i);
      if (nameMatch) {
        project = nameMatch[1];
      }
      // Extract stack
      const stackMatch = request.match(/(?:with|using|in)\s+(react|vue|next\.js|node|express)/i);
      if (stackMatch) {
        stack = stackMatch[1];
      }
    } else if (lowerRequest.includes('status') || lowerRequest.includes('check')) {
      command = 'status';
    } else if (lowerRequest.includes('deploy')) {
      command = 'deploy';
    } else if (lowerRequest.includes('analyze') || lowerRequest.includes('quality')) {
      command = 'analyze';
    } else if (lowerRequest.includes('help')) {
      command = 'help';
    }
    
    return { command, project, request: parsedRequest, stack };
  }

  buildCommandArgs(command, project, request, stack) {
    const args = {};
    
    switch (command) {
      case 'create':
        args.name = project || 'my-project';
        args.description = request;
        args.stack = stack;
        break;
      case 'develop':
        args.project = project;
        args.feature = request;
        break;
      case 'status':
      case 'analyze':
        args.project = project;
        break;
      case 'deploy':
        args.project = project;
        args.environment = request || 'production';
        break;
      case 'maintain':
        args.project = project;
        args.tasks = request;
        break;
    }
    
    return args;
  }

  formatTerminalResult(command, result) {
    let response = `✅ **${result.message || 'Command completed'}**\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (result.projectId) {
      response += `🆔 **Project ID**: ${result.projectId}\n`;
    }
    
    if (result.name) {
      response += `📋 **Name**: ${result.name}\n`;
    }
    
    if (result.webSocketUrl) {
      response += `\n📡 **Real-time Monitoring**: ${result.monitorUrl || 'http://localhost:3001'}\n`;
    }
    
    if (result.status) {
      response += `\n📊 **Status**: ${result.status}\n`;
      if (result.activeTasks) {
        response += `⚡ **Active Tasks**: ${result.activeTasks}\n`;
      }
      if (result.completedTasks) {
        response += `✅ **Completed Tasks**: ${result.completedTasks}\n`;
      }
    }
    
    if (result.quality) {
      response += `\n🔍 **Quality Metrics**:\n`;
      for (const [metric, value] of Object.entries(result.quality)) {
        response += `  • ${metric}: ${value}\n`;
      }
    }
    
    if (result.commands) {
      response += `\n📚 **Available Commands**:\n`;
      for (const cmd of result.commands) {
        response += `  • **${cmd.cmd}**: ${cmd.desc}\n`;
        response += `    Usage: \`${cmd.usage}\`\n`;
      }
    }
    
    return response;
  }

  async createProject(projectName, requirements, stack) {
    try {
      const projectId = await this.orchestrator.initializeProject(projectName, requirements, stack);
      this.activeProjects.set(projectName, projectId);
      
      return `🚀 **Project Creation Initiated**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 **Project**: ${projectName}
🏗️ **Stack**: ${stack || 'Auto-detected'}
🆔 **ID**: ${projectId}

🏢 **CTO Analysis**: Requirements analyzed, architecture planned
👥 **Teams Assigned**: Full development pipeline activated
⚡ **Status**: Autonomous development in progress

🔄 **Background Tasks Running**:
• Solution Architect: System design
• Product Manager: Feature breakdown  
• Backend Team: API development
• Frontend Team: UI implementation
• QA Team: Test automation
• DevOps: Infrastructure setup

📊 Check status with: debo status ${projectName}`;

    } catch (error) {
      logger.error('Project creation failed:', error);
      return `❌ **Project Creation Failed**: ${error.message}`;
    }
  }

  async developFeature(projectName, featureRequest) {
    try {
      if (!this.activeProjects.has(projectName)) {
        return `❌ **Project Not Found**: ${projectName}. Create it first with 'create' command.`;
      }

      const projectId = this.activeProjects.get(projectName);
      const taskId = await this.orchestrator.processFeatureRequest(projectId, featureRequest);
      
      return `⚡ **Feature Development Started**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 **Project**: ${projectName}
🎯 **Feature**: ${featureRequest}
🆔 **Task ID**: ${taskId}

🏢 **CTO Delegation**: Feature analyzed and assigned
👥 **Active Teams**:
• Business Analyst: Requirements gathering
• Solution Architect: Technical design
• Development Teams: Implementation
• QA Engineer: Testing strategy
• Security Team: Vulnerability assessment

⏱️ **Estimated Completion**: 15-30 minutes
🔄 **Status**: Autonomous development pipeline active

📊 Monitor progress: debo status ${projectName}`;

    } catch (error) {
      logger.error('Feature development failed:', error);
      return `❌ **Feature Development Failed**: ${error.message}`;
    }
  }

  async getProjectStatus(projectName) {
    try {
      if (!projectName) {
        // Show all active projects
        const allProjects = await this.orchestrator.getAllProjectsStatus();
        return this.formatAllProjectsStatus(allProjects);
      }

      const projectId = this.activeProjects.get(projectName);
      if (!projectId) {
        return `❌ **Project Not Found**: ${projectName}`;
      }

      const status = await this.orchestrator.getProjectStatus(projectId);
      return this.formatProjectStatus(projectName, status);
      
    } catch (error) {
      logger.error('Status check failed:', error);
      return `❌ **Status Check Failed**: ${error.message}`;
    }
  }

  async deployProject(projectName, deploymentConfig) {
    try {
      const projectId = this.activeProjects.get(projectName);
      if (!projectId) {
        return `❌ **Project Not Found**: ${projectName}`;
      }

      const deploymentId = await this.orchestrator.deployProject(projectId, deploymentConfig);
      
      return `🚀 **Deployment Initiated**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 **Project**: ${projectName}
🔧 **Config**: ${deploymentConfig || 'Auto-configured'}
🆔 **Deployment ID**: ${deploymentId}

🏢 **DevOps Team Active**:
• Infrastructure provisioning
• CI/CD pipeline execution
• Security scans
• Performance testing
• Monitoring setup

⏱️ **ETA**: 5-10 minutes
🔄 **Status**: Autonomous deployment in progress`;

    } catch (error) {
      logger.error('Deployment failed:', error);
      return `❌ **Deployment Failed**: ${error.message}`;
    }
  }

  async maintainProject(projectName, maintenanceRequest) {
    try {
      const projectId = this.activeProjects.get(projectName);
      if (!projectId) {
        return `❌ **Project Not Found**: ${projectName}`;
      }

      const maintenanceId = await this.orchestrator.maintainProject(projectId, maintenanceRequest);
      
      return `🔧 **Maintenance Started**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 **Project**: ${projectName}
🛠️ **Request**: ${maintenanceRequest}
🆔 **Task ID**: ${maintenanceId}

🏢 **Maintenance Teams Active**:
• Security: Vulnerability patches
• Performance: Optimization analysis
• QA: Regression testing
• DevOps: Infrastructure updates
• Documentation: Updates

🔄 **Status**: Autonomous maintenance in progress`;

    } catch (error) {
      logger.error('Maintenance failed:', error);
      return `❌ **Maintenance Failed**: ${error.message}`;
    }
  }

  async analyzeProject(projectName, analysisRequest) {
    try {
      const projectId = this.activeProjects.get(projectName);
      if (!projectId) {
        return `❌ **Project Not Found**: ${projectName}`;
      }

      const analysis = await this.orchestrator.analyzeProject(projectId, analysisRequest);
      
      return `📊 **Project Analysis Complete**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 **Project**: ${projectName}
🔍 **Analysis**: ${analysisRequest}

${this.formatAnalysisResults(analysis)}`;

    } catch (error) {
      logger.error('Analysis failed:', error);
      return `❌ **Analysis Failed**: ${error.message}`;
    }
  }

  formatProjectStatus(projectName, status) {
    const progressBar = this.createProgressBar(status.completionPercentage);
    
    return `📊 **Project Status: ${projectName}**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 **Progress**: ${progressBar} ${status.completionPercentage}%
⏱️ **Phase**: ${status.currentPhase}
👥 **Active Agents**: ${status.activeAgents}
🏆 **Quality Score**: ${status.qualityScore}/100

🔄 **Recent Activity**:
${status.recentActivity.map(activity => `• ${activity}`).join('\n')}

⚠️ **Issues**: ${status.issues.length || 'None'}
${status.issues.map(issue => `• ${issue}`).join('\n')}

📁 **Files Modified**: ${status.filesModified}
🧪 **Tests**: ${status.testsPass}/${status.testsTotal} passing
🚀 **Ready for Deploy**: ${status.readyForDeploy ? '✅' : '❌'}`;
  }

  formatAllProjectsStatus(projects) {
    return `📊 **All Active Projects**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${projects.map(project => 
  `📋 **${project.name}** | ${this.createProgressBar(project.progress)} ${project.progress}% | ${project.status}`
).join('\n')}

🔄 **System Health**: All agents operational
📈 **Total Projects**: ${projects.length}
⚡ **Active Tasks**: ${projects.reduce((sum, p) => sum + p.activeTasks, 0)}`;
  }

  formatAnalysisResults(analysis) {
    return `📈 **Code Quality**: ${analysis.codeQuality}/100
🏗️ **Architecture Score**: ${analysis.architectureScore}/100
🔒 **Security Rating**: ${analysis.securityRating}
⚡ **Performance**: ${analysis.performanceScore}/100
📚 **Documentation**: ${analysis.documentationCoverage}%
🧪 **Test Coverage**: ${analysis.testCoverage}%

💡 **Recommendations**:
${analysis.recommendations.map(rec => `• ${rec}`).join('\n')}

⚠️ **Technical Debt**: ${analysis.technicalDebt} hours estimated`;
  }

  createProgressBar(percentage) {
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  async showHelp(commandName) {
    if (!commandName || commandName === 'help') {
      return this.formatGeneralHelp();
    }
    
    return this.formatCommandHelp(commandName);
  }

  formatGeneralHelp() {
    return `🤖 **DEBO - Autonomous Development System**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 **Overview**
Debo automates the entire software development lifecycle using AI agents.

🚀 **Core Commands**
• **create** - Create a new project with intelligent scaffolding
• **develop** - Add features to existing projects
• **status** - Check project development progress
• **deploy** - Deploy to cloud providers
• **maintain** - Run maintenance tasks
• **analyze** - Analyze code quality

📊 **Monitoring Commands**
• **list** - List all projects
• **tasks** - View active development tasks
• **logs** - View development logs
• **monitor** - Open real-time dashboard

💡 **Quick Start**
1. Create: \`debo create my-app "Todo app with React"\`
2. Monitor: \`debo monitor my-app\`
3. Deploy: \`debo deploy my-app production\`

📚 **Examples**
• React App: \`debo create todo "Task manager with categories" react\`
• API Service: \`debo create api "REST API for users" express\`
• Full Stack: \`debo create shop "E-commerce site" fullstack\`

🌐 **Real-time Monitoring**
http://localhost:3001

❓ **Detailed Help**
\`debo help <command>\` for specific command details`;
  }

  formatCommandHelp(commandName) {
    const usage = this.helpSystem.formatCommandUsage(commandName);
    
    if (!usage) {
      return this.showUnknownCommandHelp(commandName);
    }
    
    return `📘 **${commandName.toUpperCase()} Command**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 **Description**
${usage.description}

💻 **Usage**
\`${usage.usage}\`

📌 **Examples**
${usage.examples.map(ex => `• \`${ex}\``).join('\n')}

💡 **Tips**
• Use quotes for multi-word arguments
• Project names are case-sensitive
• Natural language descriptions work best

🔗 **Related Commands**
${this.getRelatedCommands(commandName).join(', ')}`;
  }

  showUnknownCommandHelp(command) {
    const suggestions = this.helpSystem.getCommandSuggestions(command);
    
    return `❌ **Unknown command: ${command}**

${suggestions.length > 0 
      ? `💡 **Did you mean?**\n${suggestions.map(s => `• ${s}`).join('\n')}\n\n`
      : ''
    }📘 **Available Commands**
create, develop, status, deploy, maintain, analyze, list, tasks, logs, monitor, help

❓ **Get Help**
• \`debo help\` - Show all commands
• \`debo help <command>\` - Show command details
• Real-time monitor: http://localhost:3001`;
  }

  getRelatedCommands(command) {
    const relations = {
      create: ['develop', 'status', 'deploy'],
      develop: ['status', 'analyze', 'maintain'],
      deploy: ['status', 'monitor'],
      status: ['tasks', 'logs', 'monitor'],
      analyze: ['maintain', 'status'],
      maintain: ['analyze', 'status']
    };
    
    return relations[command] || ['status', 'help'];
  }
}

new DeboMCPServer();