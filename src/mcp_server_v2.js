#!/usr/bin/env node

/**
 * @file mcp_server_v2.js
 * @description Debo MCP Server - Autonomous Development System
 * @author CTO Agent
 * @created 2024-01-01
 * @modified 2024-01-01
 * 
 * PURPOSE:
 * Single-function MCP server that autonomously handles all software development
 * tasks through natural language requests. Uses AI orchestration to manage
 * entire development lifecycle without requiring technical knowledge.
 * 
 * DEPENDENCIES:
 * - EnhancedTaskManager: Complete database and state management
 * - LLMProvider: AI model orchestration (Ollama/External)
 * - All subsystem managers for specialized functionality
 * 
 * TODO:
 * - None
 */

import { EnhancedTaskManager } from './database/task-manager.js';
import { LLMProvider } from './infrastructure/llm-provider.js';
import logger from './logger.js';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

class DeboMCPServer {
  constructor() {
    this.taskManager = new EnhancedTaskManager();
    this.llmProvider = new LLMProvider();
    this.activeWorkflows = new Map();
    this.userContext = new Map();
    this.init();
    
    // Setup stdin/stdout for MCP protocol
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', this.handleData.bind(this));
    process.stdin.resume();
  }

  async init() {
    try {
      // Initialize core systems
      await this.taskManager.connect();
      await this.llmProvider.init();
      
      // Start background processes
      this.startAgentSystem();
      this.startMonitoring();
      
      logger.info("🚀 Debo Autonomous Development System Ready");
      logger.info("✅ All subsystems initialized successfully");
      
    } catch (error) {
      logger.error("Failed to initialize Debo:", error);
      // Auto-recovery attempt
      await this.autoRecover(error);
    }
  }

  async handleData(data) {
    try {
      const request = JSON.parse(data.trim());
      let response;

      switch (request.method) {
        case 'initialize':
          response = this.handleInitialize(request);
          break;

        case 'tools/list':
          response = this.handleToolsList(request);
          break;

        case 'tools/call':
          response = await this.handleToolCall(request);
          break;

        default:
          response = this.createErrorResponse(request.id, -32601, "Method not found");
      }

      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (error) {
      logger.error('Request failed:', error);
      const errorResponse = this.createErrorResponse(
        request?.id || null,
        -32603,
        "Internal error",
        error.message
      );
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }

  handleInitialize(request) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "debo",
          version: "3.0.0",
          description: "Autonomous AI Development System - Just describe what you want to build"
        }
      }
    };
  }

  handleToolsList(request) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: [{
          name: "debo",
          description: "Autonomous AI development system. Simply describe what you want in natural language and Debo handles everything: architecture, coding, testing, deployment. Examples: 'Build a task management app', 'Add user authentication', 'Fix the login bug', 'Deploy to AWS'",
          inputSchema: {
            type: "object",
            properties: {
              request: {
                type: "string",
                description: "Natural language description of what you want to build or do"
              },
              feedback: {
                type: "string",
                enum: ["minimal", "normal", "detailed", "live"],
                description: "How much progress feedback to show (default: normal)",
                optional: true
              }
            },
            required: ["request"]
          }
        }]
      }
    };
  }

  async handleToolCall(request) {
    if (request.params?.name !== 'debo') {
      return this.createErrorResponse(request.id, -32602, "Invalid params");
    }

    const { request: userRequest, feedback = 'normal' } = request.params.arguments;
    
    try {
      // Process the request autonomously
      const result = await this.processRequest(userRequest, feedback);
      
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          content: [{
            type: "text",
            text: result
          }]
        }
      };
    } catch (error) {
      logger.error('Debo processing failed:', error);
      return this.createErrorResponse(request.id, -32603, "Processing failed", error.message);
    }
  }

  async processRequest(userRequest, feedbackMode) {
    const requestId = uuidv4();
    const startTime = Date.now();
    
    // Subscribe user to updates if requested
    if (feedbackMode === 'live') {
      await this.taskManager.feedback.subscribeToUpdates(`user_${requestId}`, {
        type: 'live_stream',
        frequency: 'immediate',
        channels: ['status', 'features', 'errors', 'progress']
      });
    }
    
    // Analyze request using CTO agent
    const analysis = await this.analyzeRequest(userRequest);
    
    // Determine action type
    const actionType = this.determineActionType(analysis);
    
    // Execute appropriate workflow
    let result;
    switch (actionType) {
      case 'create_project':
        result = await this.createProject(analysis, feedbackMode);
        break;
        
      case 'add_feature':
        result = await this.addFeature(analysis, feedbackMode);
        break;
        
      case 'fix_issue':
        result = await this.fixIssue(analysis, feedbackMode);
        break;
        
      case 'deploy':
        result = await this.deployProject(analysis, feedbackMode);
        break;
        
      case 'status':
        result = await this.getStatus(analysis, feedbackMode);
        break;
        
      case 'clarification_needed':
        result = await this.requestClarification(analysis, feedbackMode);
        break;
        
      default:
        result = await this.handleGeneralRequest(analysis, feedbackMode);
    }
    
    // Add execution time
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    result += `\n\n⏱️ Completed in ${executionTime}s`;
    
    return result;
  }

  async analyzeRequest(userRequest) {
    // Use CTO agent to analyze the request
    const prompt = `Analyze this development request and extract:
1. Action type (create_project, add_feature, fix_issue, deploy, status, etc.)
2. Project name (if mentioned)
3. Technical requirements
4. Any ambiguities that need clarification
5. Suggested approach

Request: "${userRequest}"`;

    const analysis = await this.llmProvider.complete(prompt, {
      model: 'thinking',
      temperature: 0.3
    });

    return {
      request: userRequest,
      ...this.parseAnalysis(analysis)
    };
  }

  async createProject(analysis, feedbackMode) {
    const projectId = uuidv4();
    const projectName = analysis.projectName || `project_${Date.now()}`;
    
    // Initialize workflow
    const workflow = await this.taskManager.orchestration.initializeProjectWorkflow(
      projectId,
      analysis.request
    );
    
    this.activeWorkflows.set(projectId, workflow);
    
    // Check if clarification is needed
    if (analysis.clarificationNeeded) {
      return this.formatClarificationRequest(analysis.clarificationQuestions, projectName);
    }
    
    // Initialize Git repository
    const gitSetup = await this.taskManager.git.initializeRepository(projectId, {
      name: projectName,
      url: analysis.gitRepo
    });
    
    // Create initial project structure
    const projectPath = path.join(process.cwd(), 'projects', projectName);
    await fs.ensureDir(projectPath);
    
    // Start autonomous development
    this.startAutonomousDevelopment(projectId, workflow, analysis);
    
    // Format response based on feedback mode
    if (feedbackMode === 'minimal') {
      return `✅ Project "${projectName}" created. Development in progress.`;
    }
    
    return this.formatProjectCreationResponse(projectName, projectId, workflow, analysis);
  }

  async addFeature(analysis, feedbackMode) {
    const projectId = await this.findProjectId(analysis.projectName);
    if (!projectId) {
      return `❌ Project "${analysis.projectName}" not found. Please create it first.`;
    }
    
    // Create feature branch
    const feature = await this.taskManager.orchestration.planFeatures(
      projectId,
      [analysis.requirements]
    );
    
    const branch = await this.taskManager.git.createFeatureBranch(
      projectId,
      feature[0].id,
      feature[0].name
    );
    
    // Enqueue feature tasks
    for (const task of feature[0].tasks) {
      await this.taskManager.agentQueue.enqueueTask({
        ...task,
        projectId
      });
    }
    
    if (feedbackMode === 'minimal') {
      return `✅ Feature "${feature[0].name}" development started.`;
    }
    
    return this.formatFeatureResponse(feature[0], branch, feedbackMode);
  }

  async getStatus(analysis, feedbackMode) {
    if (!analysis.projectName) {
      // Show all projects
      const projects = await this.getAllProjectsStatus();
      return this.formatAllProjectsStatus(projects, feedbackMode);
    }
    
    const projectId = await this.findProjectId(analysis.projectName);
    if (!projectId) {
      return `❌ Project "${analysis.projectName}" not found.`;
    }
    
    // Generate comprehensive report
    const report = await this.taskManager.feedback.generateProjectReport(projectId, {
      type: feedbackMode === 'detailed' ? 'comprehensive' : 'summary'
    });
    
    return this.formatStatusReport(report, feedbackMode);
  }

  // Background Processes
  async startAgentSystem() {
    // Initialize minimum 3 agents
    const initialAgents = [
      { id: 'agent_1', role: 'backend_developer' },
      { id: 'agent_2', role: 'frontend_developer' },
      { id: 'agent_3', role: 'qa_engineer' }
    ];
    
    for (const agent of initialAgents) {
      this.startAgent(agent);
    }
    
    // Start load balancer
    setInterval(async () => {
      await this.taskManager.orchestration.balanceAgentLoad();
    }, 30000); // Every 30 seconds
  }

  async startAgent(agent) {
    const agentProcess = async () => {
      while (true) {
        try {
          // Check out a task
          const task = await this.taskManager.agentQueue.checkoutTask(
            agent.id,
            agent.role,
            agent.skills || []
          );
          
          if (!task) {
            // No tasks available, wait
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          
          // Process the task
          const result = await this.processAgentTask(agent, task);
          
          // Check in the result
          await this.taskManager.agentQueue.checkinTask(agent.id, task.id, result);
          
        } catch (error) {
          logger.error(`Agent ${agent.id} error:`, error);
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    };
    
    // Start agent in background
    agentProcess().catch(error => {
      logger.error(`Agent ${agent.id} crashed:`, error);
    });
  }

  async processAgentTask(agent, task) {
    // Generate appropriate prompt for the agent role
    const prompt = this.generateAgentPrompt(agent.role, task);
    
    // Execute task using appropriate LLM
    const llmType = this.isThinkingRole(agent.role) ? 'thinking' : 'fast';
    const response = await this.llmProvider.complete(prompt, {
      model: llmType,
      temperature: 0.7
    });
    
    // Extract deliverables
    const deliverables = this.extractDeliverables(response, task.deliverables);
    
    // Write files if needed
    if (deliverables.files) {
      await this.writeAgentFiles(task.projectId, deliverables.files);
    }
    
    // Update documentation if needed
    if (deliverables.documentation) {
      await this.updateDocumentation(task.projectId, deliverables.documentation);
    }
    
    // Check compatibility if dependency-related
    if (task.type === 'dependency_install') {
      const compatReport = await this.taskManager.compatibility.checkCompatibility(
        task.projectId,
        deliverables.dependency
      );
      
      if (compatReport.status === 'incompatible') {
        return {
          status: 'failed',
          reason: 'Dependency incompatible',
          details: compatReport
        };
      }
    }
    
    return {
      status: 'completed',
      deliverables,
      requiresQualityCheck: this.requiresQualityCheck(task.type)
    };
  }

  // Helper Methods
  parseAnalysis(analysisText) {
    // Parse LLM response into structured data
    const lines = analysisText.split('\n');
    const parsed = {
      actionType: 'general',
      projectName: null,
      requirements: [],
      clarificationNeeded: false,
      clarificationQuestions: []
    };
    
    // Extract information from analysis
    for (const line of lines) {
      if (line.includes('Action type:')) {
        parsed.actionType = line.split(':')[1].trim().toLowerCase().replace(/\s+/g, '_');
      } else if (line.includes('Project name:')) {
        parsed.projectName = line.split(':')[1].trim();
      } else if (line.includes('Clarification needed:')) {
        parsed.clarificationNeeded = line.toLowerCase().includes('yes');
      }
    }
    
    return parsed;
  }

  determineActionType(analysis) {
    const actionKeywords = {
      create_project: ['create', 'build', 'new project', 'start'],
      add_feature: ['add', 'implement', 'feature', 'functionality'],
      fix_issue: ['fix', 'bug', 'error', 'issue', 'problem'],
      deploy: ['deploy', 'launch', 'publish', 'release'],
      status: ['status', 'progress', 'check', 'report']
    };
    
    const request = analysis.request.toLowerCase();
    
    for (const [action, keywords] of Object.entries(actionKeywords)) {
      if (keywords.some(keyword => request.includes(keyword))) {
        return action;
      }
    }
    
    return analysis.clarificationNeeded ? 'clarification_needed' : 'general';
  }

  async findProjectId(projectName) {
    if (!projectName) return null;
    
    // Search for project in Redis
    const keys = await this.taskManager.redis.keys('project:*');
    for (const key of keys) {
      const project = await this.taskManager.redis.hGetAll(key);
      if (project.name === projectName) {
        return project.id;
      }
    }
    
    return null;
  }

  isThinkingRole(role) {
    const thinkingRoles = [
      'cto', 'engineering_manager', 'product_manager',
      'business_analyst', 'solution_architect', 'technical_writer'
    ];
    return thinkingRoles.includes(role);
  }

  requiresQualityCheck(taskType) {
    const qualityCheckTypes = [
      'backend_development', 'frontend_development',
      'api_implementation', 'database_design'
    ];
    return qualityCheckTypes.includes(taskType);
  }

  generateAgentPrompt(role, task) {
    const rolePrompts = {
      backend_developer: `As a Backend Developer, implement the following:
Task: ${task.title}
Description: ${task.description}
Requirements: ${JSON.stringify(task.acceptanceCriteria)}
Deliverables: ${JSON.stringify(task.deliverables)}

Provide complete, production-ready code with proper error handling, logging, and comments.`,
      
      frontend_developer: `As a Frontend Developer, implement the following:
Task: ${task.title}
Description: ${task.description}
Requirements: ${JSON.stringify(task.acceptanceCriteria)}
Deliverables: ${JSON.stringify(task.deliverables)}

Create responsive, accessible UI components with proper state management and styling.`,
      
      qa_engineer: `As a QA Engineer, create comprehensive tests:
Task: ${task.title}
Description: ${task.description}
Test Requirements: ${JSON.stringify(task.testRequirements)}

Provide unit tests, integration tests, and test documentation.`
    };
    
    return rolePrompts[role] || `As a ${role}, complete the following task:\n${JSON.stringify(task)}`;
  }

  extractDeliverables(response, expectedDeliverables) {
    // Extract code blocks, documentation, and other deliverables
    const deliverables = {};
    
    // Extract code files
    const codeBlocks = response.match(/```(\w+)?\n([\s\S]*?)```/g) || [];
    deliverables.files = codeBlocks.map(block => {
      const match = block.match(/```(\w+)?\n([\s\S]*?)```/);
      return {
        language: match[1] || 'text',
        content: match[2],
        path: this.inferFilePath(match[2], match[1])
      };
    });
    
    // Extract other deliverables based on expected format
    for (const [key, description] of Object.entries(expectedDeliverables)) {
      if (!deliverables[key]) {
        // Try to extract from response
        const pattern = new RegExp(`${key}:?\\s*([\\s\\S]+?)(?=\\n\\n|$)`, 'i');
        const match = response.match(pattern);
        if (match) {
          deliverables[key] = match[1].trim();
        }
      }
    }
    
    return deliverables;
  }

  inferFilePath(content, language) {
    // Infer file path from content and language
    const patterns = {
      javascript: /(?:class|function|const|export)\s+(\w+)/,
      python: /(?:class|def)\s+(\w+)/,
      typescript: /(?:interface|type|class|function|const|export)\s+(\w+)/
    };
    
    const pattern = patterns[language];
    if (pattern) {
      const match = content.match(pattern);
      if (match) {
        const name = match[1];
        const extension = {
          javascript: '.js',
          typescript: '.ts',
          python: '.py'
        }[language] || `.${language}`;
        
        return `src/${name.toLowerCase()}${extension}`;
      }
    }
    
    return `src/file_${Date.now()}.${language || 'txt'}`;
  }

  async writeAgentFiles(projectId, files) {
    for (const file of files) {
      // Add mandatory comments
      const commentedContent = await this.addMandatoryComments(file);
      
      // Create file version
      await this.taskManager.versionControl.createFileVersion(
        projectId,
        file.path,
        commentedContent,
        {
          taskId: file.taskId,
          changeType: 'created'
        }
      );
      
      // Write to filesystem
      const project = await this.taskManager.redis.hGetAll(`project:${projectId}`);
      const fullPath = path.join(project.rootDirectory, file.path);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, commentedContent);
      
      // Extract and store TODOs
      const todos = this.taskManager.codeDocumentation.extractInlineTODOs(commentedContent);
      for (const todo of todos) {
        await this.taskManager.codeDocumentation.createTODO(projectId, {
          ...todo,
          filePath: file.path
        });
      }
    }
  }

  async addMandatoryComments(file) {
    const fileDoc = {
      type: file.language || 'javascript',
      name: path.basename(file.path),
      description: 'Auto-generated file',
      purpose: file.purpose || 'TODO: Add purpose',
      createdBy: file.agentRole || 'system',
      dependencies: file.dependencies || [],
      todos: file.todos || []
    };
    
    const header = await this.taskManager.codeDocumentation.generateFileHeader(fileDoc);
    return header + '\n\n' + file.content;
  }

  async updateDocumentation(projectId, documentation) {
    for (const [type, content] of Object.entries(documentation)) {
      if (type === 'feature') {
        await this.taskManager.documentation.documentFeature(
          projectId,
          content.featureId,
          content
        );
      } else if (type === 'api') {
        // Update API documentation
        await this.taskManager.documentation.updateDocumentation(
          content.packageName,
          content.version,
          { apiReference: content.endpoints }
        );
      }
    }
  }

  // Response Formatting
  formatProjectCreationResponse(projectName, projectId, workflow, analysis) {
    return `🚀 **Project Creation Started**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 **Project**: ${projectName}
🆔 **ID**: ${projectId}
📁 **Location**: ./projects/${projectName}

🏢 **Autonomous Development Pipeline Activated**

**Current Phase**: ${workflow.currentPhase}
**Active Agents**: 
• CTO: Strategic planning and delegation
• Solution Architect: System design
• Product Manager: Feature breakdown
• Engineering Teams: Ready for implementation

📊 **Next Steps**:
1. Requirements analysis and clarification
2. Architecture design and documentation
3. Feature implementation with test coverage
4. Continuous integration and deployment

🔄 **Background Tasks**:
• Git repository initialization
• Development environment setup
• Dependency compatibility checking
• Documentation generation

💡 **Commands**:
• Check progress: \`debo "status ${projectName}"\`
• Add features: \`debo "add user authentication to ${projectName}"\`
• Deploy: \`debo "deploy ${projectName} to production"\`

⏱️ Estimated time to MVP: 30-45 minutes`;
  }

  formatFeatureResponse(feature, branch, feedbackMode) {
    if (feedbackMode === 'detailed') {
      return `⚡ **Feature Development Pipeline**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **Feature**: ${feature.name}
📝 **Description**: ${feature.description}
🌿 **Branch**: ${branch.name}

📋 **Tasks Generated** (${feature.tasks.length} total):
${feature.tasks.map(t => `• [${t.requiredRole}] ${t.title}`).join('\n')}

👥 **Agent Assignment**:
${feature.tasks.map(t => `• ${t.requiredRole}: ${t.title} (${t.estimatedTime}min)`).join('\n')}

🔄 **Development Flow**:
1. Requirements analysis ➜ 2. Architecture design
3. Implementation ➜ 4. Testing ➜ 5. Documentation

📊 **Quality Gates**:
✓ Code review required
✓ 80% test coverage minimum
✓ Security scan on completion
✓ Performance benchmarks

⏱️ **Estimated Completion**: ${feature.estimatedEffort} minutes`;
    }
    
    return `⚡ **Feature Development Started**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **Feature**: ${feature.name}
🌿 **Branch**: ${branch.name}
📋 **Tasks**: ${feature.tasks.length} tasks across ${new Set(feature.tasks.map(t => t.requiredRole)).size} teams
⏱️ **ETA**: ${feature.estimatedEffort} minutes

🔄 Development pipeline active. Track progress with \`debo "status"\``;
  }

  formatStatusReport(report, feedbackMode) {
    const { overview, progress, agentActivity, quality, issues } = report.sections;
    
    if (feedbackMode === 'minimal') {
      return `📊 ${overview.name}: ${overview.overallProgress.toFixed(0)}% complete`;
    }
    
    let output = `📊 **Project Status Report**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**${overview.name}**
Progress: ${'█'.repeat(Math.floor(overview.overallProgress/10))}${'░'.repeat(10-Math.floor(overview.overallProgress/10))} ${overview.overallProgress.toFixed(0)}%

📈 **Features** (${overview.completedFeatures}/${overview.totalFeatures})
${progress.features.map(f => 
  `• ${f.name}: ${f.progress.toFixed(0)}% ${f.status === 'completed' ? '✅' : '🔄'}`
).join('\n')}

👥 **Active Agents** (${agentActivity.activeAgents}/${agentActivity.totalAgents})
${agentActivity.agentDetails.map(a => 
  `• ${a.role}: ${a.status} (${a.currentTasks} tasks)`
).join('\n')}`;

    if (feedbackMode === 'detailed') {
      output += `\n
🏆 **Quality Metrics**
• Code Quality: ${quality.codeQuality.score}/100
• Test Coverage: ${quality.testCoverage.coverage}%
• Security: ${quality.securityScan.vulnerabilities === 0 ? '✅ No issues' : `⚠️ ${quality.securityScan.vulnerabilities} issues`}
• Documentation: ${quality.documentation.coverage}%

⚠️ **Issues** (${issues.blockers.length + issues.critical.length})
${issues.blockers.map(i => `• 🚫 ${i.title}`).join('\n')}
${issues.critical.map(i => `• ❌ ${i.title}`).join('\n')}`;
    }
    
    return output;
  }

  formatClarificationRequest(questions, projectName) {
    return `🤔 **Clarification Needed**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To build "${projectName}" optimally, I need some clarification:

${questions.map((q, i) => `${i+1}. ${q.question}${q.required ? ' *' : ''}`).join('\n\n')}

💡 **Tips**:
• Questions marked with * are required
• You can answer in natural language
• Example: \`debo "For the task app: 1. Web and mobile, 2. 100 users, 3. React Native"\`

Or proceed with defaults: \`debo "Build ${projectName} with standard settings"\``;
  }

  async startAutonomousDevelopment(projectId, workflow, analysis) {
    // This runs in the background
    const developmentProcess = async () => {
      try {
        // Plan features
        const features = await this.taskManager.orchestration.planFeatures(
          projectId,
          analysis.requirements
        );
        
        // Create tasks for all features
        for (const feature of features) {
          for (const task of feature.tasks) {
            await this.taskManager.agentQueue.enqueueTask({
              ...task,
              projectId
            });
          }
        }
        
        // Monitor workflow
        const monitoringInterval = setInterval(async () => {
          await this.taskManager.orchestration.manageWorkflow(workflow.id);
          
          // Check if complete
          if (workflow.status === 'completed') {
            clearInterval(monitoringInterval);
            await this.onProjectComplete(projectId);
          }
        }, 10000); // Every 10 seconds
        
      } catch (error) {
        logger.error(`Autonomous development failed for ${projectId}:`, error);
        await this.handleDevelopmentError(projectId, error);
      }
    };
    
    // Start in background
    developmentProcess();
  }

  async onProjectComplete(projectId) {
    // Generate final report
    const report = await this.taskManager.feedback.generateProjectReport(projectId, {
      type: 'comprehensive'
    });
    
    // Create final deliverables
    await this.createDeliverables(projectId);
    
    // Send completion notification
    await this.taskManager.feedback.sendFeedback(projectId, {
      type: 'completion',
      severity: 'info',
      title: 'Project Development Complete',
      message: 'All features implemented, tested, and documented',
      details: report
    });
  }

  async createDeliverables(projectId) {
    const project = await this.taskManager.redis.hGetAll(`project:${projectId}`);
    const deliverables = path.join(project.rootDirectory, 'DELIVERABLES');
    
    await fs.ensureDir(deliverables);
    
    // Generate documentation
    const docs = await this.generateProjectDocumentation(projectId);
    await fs.writeFile(path.join(deliverables, 'README.md'), docs.readme);
    await fs.writeFile(path.join(deliverables, 'API.md'), docs.api);
    await fs.writeFile(path.join(deliverables, 'DEPLOYMENT.md'), docs.deployment);
    
    // Generate TODO file
    const todos = await this.taskManager.codeDocumentation.generateTODOFile(projectId);
    await fs.writeFile(path.join(deliverables, 'TODO.md'), todos);
  }

  async generateProjectDocumentation(projectId) {
    // This would generate comprehensive documentation
    return {
      readme: '# Project Documentation\n\nAuto-generated by Debo',
      api: '# API Documentation\n\nAuto-generated by Debo',
      deployment: '# Deployment Guide\n\nAuto-generated by Debo'
    };
  }

  async handleDevelopmentError(projectId, error) {
    logger.error(`Project ${projectId} error:`, error);
    
    // Attempt recovery
    await this.taskManager.feedback.sendFeedback(projectId, {
      type: 'error',
      severity: 'error',
      title: 'Development Error',
      message: error.message,
      details: { error: error.stack }
    });
  }

  async autoRecover(error) {
    logger.info('Attempting auto-recovery...');
    
    // Try to restart Redis if needed
    if (error.message.includes('Redis')) {
      try {
        execSync('redis-server --daemonize yes');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.taskManager.connect();
        logger.info('Redis recovered');
      } catch (e) {
        logger.error('Redis recovery failed:', e);
      }
    }
    
    // Try to restart Ollama if needed
    if (error.message.includes('Ollama')) {
      try {
        execSync('ollama serve &');
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.llmProvider.init();
        logger.info('Ollama recovered');
      } catch (e) {
        logger.error('Ollama recovery failed:', e);
      }
    }
  }

  createErrorResponse(id, code, message, data = null) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(data && { data })
      }
    };
  }

  async startMonitoring() {
    // Monitor system health
    setInterval(async () => {
      try {
        const stats = await this.taskManager.getSystemStats();
        
        // Scale agents if needed
        const queueStats = await this.taskManager.agentQueue.getQueueStats();
        const totalQueued = Object.values(queueStats).reduce((sum, stat) => sum + stat.total, 0);
        const activeAgents = await this.taskManager.agentQueue.getActiveAgents();
        
        if (totalQueued > activeAgents.length * 5 && activeAgents.length < 20) {
          // Add more agents
          const newAgent = {
            id: `agent_${Date.now()}`,
            role: this.getMostNeededRole(queueStats)
          };
          this.startAgent(newAgent);
          logger.info(`Added new agent: ${newAgent.role}`);
        }
        
      } catch (error) {
        logger.error('Monitoring error:', error);
      }
    }, 60000); // Every minute
  }

  getMostNeededRole(queueStats) {
    let maxQueued = 0;
    let neededRole = 'backend_developer';
    
    for (const [role, stats] of Object.entries(queueStats)) {
      if (stats.total > maxQueued) {
        maxQueued = stats.total;
        neededRole = role;
      }
    }
    
    return neededRole;
  }
}

// Start the server
const server = new DeboMCPServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down Debo...');
  await server.taskManager.disconnect();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});