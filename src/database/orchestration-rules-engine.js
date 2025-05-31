import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class OrchestrationRulesEngine {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.redis = taskManager.redis;
    this.agentQueue = taskManager.agentQueue;
    this.minAgents = 3;
    this.maxAgents = 20;
  }

  // Core Orchestration Rules
  async initializeProjectWorkflow(projectId, projectRequest) {
    await this.taskManager.ensureConnection();
    
    const workflow = {
      id: uuidv4(),
      projectId,
      type: 'project_initialization',
      status: 'active',
      createdAt: new Date().toISOString(),
      phases: [
        'user_clarification',
        'requirements_gathering',
        'architecture_design',
        'repository_setup',
        'feature_planning',
        'task_generation',
        'development',
        'testing',
        'deployment'
      ],
      currentPhase: 'user_clarification',
      context: {
        request: projectRequest,
        clarifications: [],
        requirements: [],
        features: [],
        repository: null
      }
    };
    
    // Store workflow
    await this.redis.hSet(`workflow:${workflow.id}`, {
      ...workflow,
      context: JSON.stringify(workflow.context)
    });
    
    // Start user clarification phase
    await this.startUserClarification(workflow);
    
    return workflow;
  }

  // User Clarification Phase
  async startUserClarification(workflow) {
    const clarificationQuestions = await this.generateClarificationQuestions(workflow.context.request);
    
    // Create CTO task for analysis
    const ctoTask = {
      projectId: workflow.projectId,
      type: 'strategic_analysis',
      requiredRole: 'cto',
      priority: 'critical',
      title: 'Analyze project request and generate clarification questions',
      description: `Analyze the project request and identify areas that need clarification.
Request: ${workflow.context.request}`,
      deliverables: {
        questions: 'Array of prioritized clarification questions',
        assumptions: 'List of assumptions made',
        risks: 'Identified risks and concerns',
        suggestions: 'Feature enhancement suggestions'
      }
    };
    
    await this.agentQueue.enqueueTask(ctoTask);
    
    return clarificationQuestions;
  }

  async generateClarificationQuestions(request) {
    // Analyze request for ambiguities
    const questions = [];
    const categories = {
      functional: [
        'What specific user roles will interact with this system?',
        'What are the key user workflows?',
        'What are the performance requirements?',
        'What are the scalability expectations?'
      ],
      technical: [
        'What technology stack preferences do you have?',
        'Are there any existing systems to integrate with?',
        'What are the deployment requirements?',
        'What are the security requirements?'
      ],
      business: [
        'What is the primary business goal?',
        'Who is the target audience?',
        'What is the expected timeline?',
        'What are the success metrics?'
      ]
    };
    
    // Extract keywords from request
    const keywords = this.extractKeywords(request);
    
    // Generate context-specific questions
    for (const [category, baseQuestions] of Object.entries(categories)) {
      for (const question of baseQuestions) {
        if (this.isQuestionRelevant(question, keywords)) {
          questions.push({
            id: uuidv4(),
            category,
            question,
            priority: this.calculateQuestionPriority(question, keywords),
            required: this.isQuestionRequired(question)
          });
        }
      }
    }
    
    // Sort by priority
    questions.sort((a, b) => b.priority - a.priority);
    
    return questions;
  }

  // Feature Planning and Task Generation
  async planFeatures(projectId, requirements) {
    const features = [];
    
    // Group requirements into features
    const featureGroups = this.groupRequirementsIntoFeatures(requirements);
    
    for (const group of featureGroups) {
      const feature = {
        id: uuidv4(),
        projectId,
        name: group.name,
        description: group.description,
        requirements: group.requirements,
        priority: group.priority,
        dependencies: [],
        estimatedEffort: 0,
        tasks: []
      };
      
      // Identify dependencies
      feature.dependencies = await this.identifyFeatureDependencies(feature, features);
      
      // Generate tasks for feature
      feature.tasks = await this.generateFeatureTasks(feature);
      
      // Calculate effort
      feature.estimatedEffort = this.calculateFeatureEffort(feature);
      
      features.push(feature);
    }
    
    // Order features by dependencies and priority
    const orderedFeatures = this.orderFeaturesByDependencies(features);
    
    return orderedFeatures;
  }

  async generateFeatureTasks(feature) {
    const tasks = [];
    const taskTemplates = this.getTaskTemplatesForFeature(feature);
    
    for (const template of taskTemplates) {
      const task = {
        id: uuidv4(),
        featureId: feature.id,
        type: template.type,
        requiredRole: template.role,
        title: template.title.replace('{feature}', feature.name),
        description: template.description,
        priority: template.priority || 'medium',
        estimatedTime: template.estimatedTime,
        requiredSkills: template.skills || [],
        dependencies: [],
        deliverables: template.deliverables,
        acceptanceCriteria: template.acceptanceCriteria,
        testRequirements: template.testRequirements
      };
      
      tasks.push(task);
    }
    
    // Set task dependencies
    this.setTaskDependencies(tasks);
    
    return tasks;
  }

  getTaskTemplatesForFeature(feature) {
    const templates = [];
    
    // Always start with requirements analysis
    templates.push({
      type: 'requirements_analysis',
      role: 'business_analyst',
      title: 'Analyze requirements for {feature}',
      description: 'Break down feature requirements into detailed specifications',
      priority: 'high',
      estimatedTime: 120,
      skills: ['requirements_analysis', 'user_stories'],
      deliverables: {
        specifications: 'Detailed feature specifications',
        userStories: 'User stories with acceptance criteria',
        dataFlow: 'Data flow diagrams'
      }
    });
    
    // Architecture design
    templates.push({
      type: 'architecture_design',
      role: 'solution_architect',
      title: 'Design architecture for {feature}',
      description: 'Create technical architecture and design documents',
      priority: 'high',
      estimatedTime: 180,
      skills: ['system_design', 'architecture'],
      deliverables: {
        architecture: 'Technical architecture document',
        apiDesign: 'API specifications',
        dataModel: 'Data model design'
      }
    });
    
    // Backend development
    if (this.requiresBackend(feature)) {
      templates.push({
        type: 'backend_development',
        role: 'backend_developer',
        title: 'Implement backend for {feature}',
        description: 'Develop API endpoints and business logic',
        priority: 'high',
        estimatedTime: 480,
        skills: ['nodejs', 'database', 'api_development'],
        deliverables: {
          apiEndpoints: 'Implemented API endpoints',
          businessLogic: 'Business logic implementation',
          database: 'Database schema and queries'
        },
        testRequirements: {
          unitTests: true,
          integrationTests: true,
          coverage: 80
        }
      });
    }
    
    // Frontend development
    if (this.requiresFrontend(feature)) {
      templates.push({
        type: 'frontend_development',
        role: 'frontend_developer',
        title: 'Implement UI for {feature}',
        description: 'Develop user interface components',
        priority: 'high',
        estimatedTime: 360,
        skills: ['react', 'css', 'responsive_design'],
        deliverables: {
          components: 'React components',
          styles: 'CSS/styling',
          interactions: 'User interactions'
        },
        testRequirements: {
          unitTests: true,
          e2eTests: true,
          accessibility: true
        }
      });
    }
    
    // Testing
    templates.push({
      type: 'testing',
      role: 'qa_engineer',
      title: 'Test {feature}',
      description: 'Create and execute test cases',
      priority: 'high',
      estimatedTime: 240,
      skills: ['testing', 'automation'],
      deliverables: {
        testPlan: 'Test plan document',
        testCases: 'Test cases',
        testResults: 'Test execution results',
        bugReports: 'Bug reports'
      }
    });
    
    // Documentation
    templates.push({
      type: 'documentation',
      role: 'technical_writer',
      title: 'Document {feature}',
      description: 'Create user and technical documentation',
      priority: 'medium',
      estimatedTime: 120,
      skills: ['technical_writing', 'documentation'],
      deliverables: {
        userGuide: 'User documentation',
        apiDocs: 'API documentation',
        technicalDocs: 'Technical documentation'
      }
    });
    
    return templates;
  }

  // Task Dependency Management
  setTaskDependencies(tasks) {
    const taskMap = new Map(tasks.map(t => [t.type, t]));
    
    const dependencies = {
      'architecture_design': ['requirements_analysis'],
      'backend_development': ['architecture_design'],
      'frontend_development': ['architecture_design'],
      'testing': ['backend_development', 'frontend_development'],
      'documentation': ['testing']
    };
    
    for (const task of tasks) {
      const deps = dependencies[task.type] || [];
      task.dependencies = deps.map(depType => taskMap.get(depType)?.id).filter(Boolean);
      task.blockedBy = [...task.dependencies];
    }
  }

  // Agent Load Balancing
  async balanceAgentLoad() {
    const stats = await this.agentQueue.getQueueStats();
    const activeAgents = await this.agentQueue.getActiveAgents();
    
    // Calculate load per role
    const loadAnalysis = {};
    for (const [role, data] of Object.entries(stats)) {
      const activeInRole = activeAgents.filter(a => a.role === role).length;
      const queuedTasks = data.total;
      const criticalTasks = data.priorities.critical + data.priorities.high;
      
      loadAnalysis[role] = {
        queuedTasks,
        criticalTasks,
        activeAgents: activeInRole,
        loadFactor: activeInRole > 0 ? queuedTasks / activeInRole : Infinity
      };
    }
    
    // Identify overloaded and underutilized roles
    const overloaded = [];
    const underutilized = [];
    
    for (const [role, analysis] of Object.entries(loadAnalysis)) {
      if (analysis.loadFactor > 5 || analysis.criticalTasks > 3) {
        overloaded.push(role);
      } else if (analysis.loadFactor < 1 && analysis.activeAgents > 0) {
        underutilized.push(role);
      }
    }
    
    // Reassign agents if needed
    for (const underRole of underutilized) {
      for (const overRole of overloaded) {
        const agent = activeAgents.find(a => 
          a.role === underRole && 
          a.activeTasks === 0 &&
          this.canAgentAdaptToRole(a.role, overRole)
        );
        
        if (agent) {
          await this.agentQueue.reassignAgent(
            agent.id,
            underRole,
            overRole,
            'Load balancing'
          );
        }
      }
    }
    
    return { loadAnalysis, reassignments: { from: underutilized, to: overloaded } };
  }

  canAgentAdaptToRole(fromRole, toRole) {
    const adaptability = {
      'backend_developer': ['frontend_developer', 'qa_engineer'],
      'frontend_developer': ['backend_developer', 'ux_designer'],
      'qa_engineer': ['backend_developer', 'frontend_developer'],
      'technical_writer': ['business_analyst'],
      'business_analyst': ['product_manager']
    };
    
    return adaptability[fromRole]?.includes(toRole) || false;
  }

  // Continuous Workflow Management
  async manageWorkflow(workflowId) {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow || workflow.status !== 'active') return;
    
    // Check current phase completion
    const phaseComplete = await this.isPhaseComplete(workflow);
    
    if (phaseComplete) {
      // Move to next phase
      const nextPhase = this.getNextPhase(workflow);
      if (nextPhase) {
        await this.transitionToPhase(workflow, nextPhase);
      } else {
        // Workflow complete
        await this.completeWorkflow(workflow);
      }
    }
    
    // Monitor active tasks
    await this.monitorActiveTasks(workflow);
    
    // Check for blockers
    const blockers = await this.identifyBlockers(workflow);
    if (blockers.length > 0) {
      await this.handleBlockers(workflow, blockers);
    }
    
    // Generate status update
    const status = await this.generateWorkflowStatus(workflow);
    await this.taskManager.feedback.sendFeedback(workflow.projectId, {
      type: 'workflow_update',
      severity: 'info',
      title: `Workflow Status: ${workflow.currentPhase}`,
      message: status.summary,
      details: status
    });
  }

  // Priority-based Task Scheduling
  async scheduleTasks(projectId) {
    const features = await this.getProjectFeatures(projectId);
    const allTasks = [];
    
    // Collect all tasks
    for (const feature of features) {
      const tasks = await this.getFeatureTasks(feature.id);
      allTasks.push(...tasks);
    }
    
    // Build dependency graph
    const graph = this.buildDependencyGraph(allTasks);
    
    // Topological sort for dependency order
    const sortedTasks = this.topologicalSort(graph);
    
    // Calculate priority scores
    for (const task of sortedTasks) {
      task.priorityScore = this.calculateTaskPriority(task, graph);
    }
    
    // Sort by priority score
    sortedTasks.sort((a, b) => b.priorityScore - a.priorityScore);
    
    // Enqueue tasks respecting dependencies
    for (const task of sortedTasks) {
      const canSchedule = await this.canScheduleTask(task);
      if (canSchedule) {
        await this.agentQueue.enqueueTask(task);
      }
    }
    
    return sortedTasks;
  }

  calculateTaskPriority(task, graph) {
    let score = 0;
    
    // Base priority
    const priorityScores = { critical: 1000, high: 100, medium: 10, low: 1 };
    score += priorityScores[task.priority] || 10;
    
    // Number of dependents (tasks that depend on this)
    const dependents = graph.dependents[task.id] || [];
    score += dependents.length * 50;
    
    // Critical path factor
    if (this.isOnCriticalPath(task, graph)) {
      score += 500;
    }
    
    // Feature priority
    score += task.featurePriority * 10;
    
    return score;
  }

  // Repository Setup
  async setupGitRepository(projectId, repoConfig) {
    const setup = {
      id: uuidv4(),
      projectId,
      status: 'initializing',
      steps: []
    };
    
    // Check if repo exists
    if (!repoConfig.url) {
      setup.steps.push({
        step: 'create_repository',
        status: 'pending',
        description: 'Create new Git repository'
      });
    }
    
    // Initialize repo structure
    setup.steps.push({
      step: 'initialize_structure',
      status: 'pending',
      description: 'Create initial project structure'
    });
    
    // Setup branching strategy
    setup.steps.push({
      step: 'setup_branches',
      status: 'pending',
      description: 'Setup branching strategy',
      details: {
        strategy: repoConfig.branchingStrategy || 'gitflow',
        mainBranch: repoConfig.mainBranch || 'main',
        developBranch: 'develop',
        featureBranchPrefix: 'feature/',
        releaseBranchPrefix: 'release/',
        hotfixBranchPrefix: 'hotfix/'
      }
    });
    
    // Create initial files
    setup.steps.push({
      step: 'create_initial_files',
      status: 'pending',
      description: 'Create README, .gitignore, and initial structure'
    });
    
    // Store setup configuration
    await this.redis.hSet(`repo_setup:${setup.id}`, {
      ...setup,
      steps: JSON.stringify(setup.steps),
      createdAt: new Date().toISOString()
    });
    
    // Create DevOps task
    const devopsTask = {
      projectId,
      type: 'repository_setup',
      requiredRole: 'devops_engineer',
      priority: 'critical',
      title: 'Setup Git repository and branching strategy',
      description: 'Initialize Git repository with proper structure and branching',
      deliverables: {
        repository: 'Initialized Git repository',
        branches: 'Configured branches',
        ci_cd: 'Basic CI/CD setup'
      }
    };
    
    await this.agentQueue.enqueueTask(devopsTask);
    
    return setup;
  }

  // Helper Methods
  extractKeywords(text) {
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const words = text.toLowerCase().split(/\s+/);
    return words.filter(w => w.length > 3 && !commonWords.has(w));
  }

  isQuestionRelevant(question, keywords) {
    const questionWords = question.toLowerCase().split(/\s+/);
    return keywords.some(keyword => questionWords.includes(keyword));
  }

  calculateQuestionPriority(question, keywords) {
    let priority = 50; // Base priority
    
    // Critical keywords
    const criticalKeywords = ['security', 'compliance', 'performance', 'scale'];
    if (criticalKeywords.some(k => question.toLowerCase().includes(k))) {
      priority += 50;
    }
    
    // Keyword matches
    const matches = keywords.filter(k => question.toLowerCase().includes(k)).length;
    priority += matches * 10;
    
    return priority;
  }

  isQuestionRequired(question) {
    const requiredPatterns = ['technology stack', 'deployment', 'timeline', 'user roles'];
    return requiredPatterns.some(pattern => question.toLowerCase().includes(pattern));
  }

  groupRequirementsIntoFeatures(requirements) {
    // Group related requirements into features
    const groups = [];
    const grouped = new Set();
    
    for (const req of requirements) {
      if (grouped.has(req.id)) continue;
      
      const related = requirements.filter(r => 
        !grouped.has(r.id) && 
        this.areRequirementsRelated(req, r)
      );
      
      const group = {
        name: this.generateFeatureName(req, related),
        description: this.generateFeatureDescription(req, related),
        requirements: [req, ...related],
        priority: Math.max(req.priority, ...related.map(r => r.priority))
      };
      
      groups.push(group);
      grouped.add(req.id);
      related.forEach(r => grouped.add(r.id));
    }
    
    return groups;
  }

  areRequirementsRelated(req1, req2) {
    // Check if requirements are related based on keywords, entities, etc.
    const keywords1 = this.extractKeywords(req1.description);
    const keywords2 = this.extractKeywords(req2.description);
    
    const commonKeywords = keywords1.filter(k => keywords2.includes(k));
    return commonKeywords.length > 2;
  }

  requiresBackend(feature) {
    const backendKeywords = ['api', 'database', 'server', 'endpoint', 'authentication', 'data'];
    return backendKeywords.some(k => 
      feature.description.toLowerCase().includes(k) ||
      feature.requirements.some(r => r.description.toLowerCase().includes(k))
    );
  }

  requiresFrontend(feature) {
    const frontendKeywords = ['ui', 'interface', 'page', 'form', 'display', 'user', 'screen'];
    return frontendKeywords.some(k => 
      feature.description.toLowerCase().includes(k) ||
      feature.requirements.some(r => r.description.toLowerCase().includes(k))
    );
  }

  buildDependencyGraph(tasks) {
    const graph = {
      nodes: tasks,
      edges: {},
      dependents: {}
    };
    
    for (const task of tasks) {
      graph.edges[task.id] = task.dependencies || [];
      
      // Build reverse edges (dependents)
      for (const dep of task.dependencies || []) {
        if (!graph.dependents[dep]) {
          graph.dependents[dep] = [];
        }
        graph.dependents[dep].push(task.id);
      }
    }
    
    return graph;
  }

  topologicalSort(graph) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();
    
    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error('Circular dependency detected');
      }
      
      visiting.add(nodeId);
      
      const dependencies = graph.edges[nodeId] || [];
      for (const dep of dependencies) {
        visit(dep);
      }
      
      visiting.delete(nodeId);
      visited.add(nodeId);
      
      const node = graph.nodes.find(n => n.id === nodeId);
      if (node) sorted.push(node);
    };
    
    for (const node of graph.nodes) {
      visit(node.id);
    }
    
    return sorted;
  }

  isOnCriticalPath(task, graph) {
    // Simplified critical path detection
    // A task is on critical path if delaying it delays the project
    const dependents = graph.dependents[task.id] || [];
    return dependents.some(depId => {
      const depTask = graph.nodes.find(n => n.id === depId);
      return depTask && depTask.priority === 'critical';
    });
  }
}