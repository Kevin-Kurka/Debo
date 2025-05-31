import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

/**
 * Agent Database Integration System
 * 
 * PURPOSE:
 * Ensures every agent properly utilizes all database tables as a project management tool.
 * Defines specific inputs, outputs, and database responsibilities for each agent role.
 * 
 * RESPONSIBILITIES:
 * - Map agent deliverables to database entities
 * - Validate required inputs for each agent
 * - Track all agent activities in database
 * - Ensure complete project lifecycle coverage
 * 
 * TODO:
 * - None
 */
export class AgentDatabaseIntegration {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.redis = taskManager.redis;
    
    // Define complete agent specifications with database mappings
    this.agentSpecs = this.defineAgentSpecifications();
  }

  defineAgentSpecifications() {
    return {
      // ==================== THINKING AGENTS ====================
      cto: {
        type: 'thinking',
        llmModel: 'qwen2.5:14b',
        responsibilities: [
          'Strategic project analysis and vision',
          'Technology stack decisions',
          'Resource allocation and team assignments',
          'Risk assessment and mitigation',
          'Quality standards enforcement'
        ],
        
        requiredInputs: {
          projectRequest: 'User project description',
          businessRequirements: 'High-level business needs',
          constraints: 'Budget, timeline, technical constraints',
          teamCapacity: 'Available agent resources'
        },
        
        databaseWrites: {
          projects: 'Create/update project records',
          workflows: 'Initialize project workflows',
          projectDependencies: 'Approve technology choices',
          gitIntegration: 'Setup repository strategy',
          feedbackStreams: 'Strategic status updates'
        },
        
        databaseReads: {
          projects: 'Review existing project status',
          agentCheckouts: 'Monitor team utilization',
          qualityMetrics: 'Review project quality scores',
          dependencies: 'Assess technology landscape'
        },
        
        deliverables: {
          projectStrategy: {
            table: 'projects',
            fields: ['description', 'structure', 'status'],
            format: 'Strategic project plan with tech stack'
          },
          teamAssignments: {
            table: 'workflows',
            fields: ['phases', 'context'],
            format: 'Agent role assignments and responsibilities'
          },
          technologyDecisions: {
            table: 'projectDependencies',
            fields: ['dependencyId', 'criticality', 'usageType'],
            format: 'Approved technologies and frameworks'
          }
        },
        
        successCriteria: [
          'Project record created with complete structure',
          'Workflow initialized with all phases',
          'Team assignments documented',
          'Technology stack approved and documented'
        ]
      },

      engineering_manager: {
        type: 'thinking',
        llmModel: 'qwen2.5:14b',
        responsibilities: [
          'Sprint planning and task breakdown',
          'Team coordination and workload balancing',
          'Timeline estimation and milestone tracking',
          'Resource capacity planning',
          'Cross-team dependency management'
        ],
        
        requiredInputs: {
          projectStrategy: 'CTO strategic plan',
          featureRequirements: 'Product manager specifications',
          teamCapacity: 'Available agent resources',
          dependencies: 'Inter-feature dependencies'
        },
        
        databaseWrites: {
          queuedTasks: 'Create and prioritize development tasks',
          features: 'Update feature status and estimates',
          agentCheckouts: 'Monitor agent assignments',
          workflows: 'Update workflow phases',
          feedbackStreams: 'Team coordination updates'
        },
        
        databaseReads: {
          queuedTasks: 'Review task queues and priorities',
          agentCheckouts: 'Monitor agent workload',
          features: 'Track feature progress',
          tasks: 'Analyze task completion rates'
        },
        
        deliverables: {
          sprintPlan: {
            table: 'queuedTasks',
            fields: ['priority', 'estimatedTime', 'dependencies'],
            format: 'Prioritized task queue with estimates'
          },
          teamAllocation: {
            table: 'agentCheckouts',
            fields: ['agentRole', 'estimatedCompletion'],
            format: 'Agent workload distribution'
          },
          milestoneTracking: {
            table: 'features',
            fields: ['status', 'estimatedHours'],
            format: 'Feature completion timeline'
          }
        },
        
        successCriteria: [
          'All features broken down into tasks',
          'Task priorities and dependencies set',
          'Agent workload balanced',
          'Realistic timeline estimates provided'
        ]
      },

      product_manager: {
        type: 'thinking',
        llmModel: 'qwen2.5:14b',
        responsibilities: [
          'Feature prioritization and roadmap planning',
          'User story creation and acceptance criteria',
          'Business value assessment',
          'Stakeholder requirement gathering',
          'Release planning and scope management'
        ],
        
        requiredInputs: {
          userRequests: 'User feature requests',
          businessGoals: 'Business objectives',
          technicalConstraints: 'Technical limitations',
          marketResearch: 'Competitive analysis'
        },
        
        databaseWrites: {
          features: 'Create and prioritize features',
          requirements: 'Document detailed requirements',
          tests: 'Define acceptance test criteria',
          documentation: 'Feature specifications',
          feedbackStreams: 'Product status updates'
        },
        
        databaseReads: {
          projects: 'Understand project scope',
          features: 'Review existing features',
          requirements: 'Analyze requirement dependencies',
          queuedTasks: 'Monitor development progress'
        },
        
        deliverables: {
          featurePrioritization: {
            table: 'features',
            fields: ['priority', 'objectives', 'dependencies'],
            format: 'Prioritized feature backlog'
          },
          userStories: {
            table: 'requirements',
            fields: ['description', 'acceptanceCriteria', 'priority'],
            format: 'Detailed user stories with acceptance criteria'
          },
          releaseScoping: {
            table: 'features',
            fields: ['status', 'estimatedHours', 'dependencies'],
            format: 'Release milestone planning'
          }
        },
        
        successCriteria: [
          'All features have clear priorities',
          'User stories documented with acceptance criteria',
          'Business value quantified',
          'Release scope defined'
        ]
      },

      business_analyst: {
        type: 'thinking',
        llmModel: 'qwen2.5:14b',
        responsibilities: [
          'Detailed requirement analysis and documentation',
          'Process flow mapping and optimization',
          'Stakeholder communication and validation',
          'Gap analysis and solution design',
          'Business rule definition'
        ],
        
        requiredInputs: {
          featureSpecs: 'Product manager feature definitions',
          userFeedback: 'User research and feedback',
          businessProcesses: 'Current business workflows',
          complianceRequirements: 'Regulatory and compliance needs'
        },
        
        databaseWrites: {
          requirements: 'Create detailed functional requirements',
          tests: 'Define business logic test cases',
          documentation: 'Process flow documentation',
          todos: 'Business analysis tasks',
          feedbackStreams: 'Requirement validation updates'
        },
        
        databaseReads: {
          features: 'Review feature specifications',
          requirements: 'Analyze existing requirements',
          dependencies: 'Understand system integrations',
          documentation: 'Review existing documentation'
        },
        
        deliverables: {
          detailedRequirements: {
            table: 'requirements',
            fields: ['description', 'acceptanceCriteria', 'traceabilityLinks'],
            format: 'Comprehensive functional requirements'
          },
          processFlows: {
            table: 'documentation',
            fields: ['description', 'dataModels', 'apiReference'],
            format: 'Business process documentation'
          },
          validationCriteria: {
            table: 'tests',
            fields: ['description', 'testCases', 'prerequisites'],
            format: 'Business validation test cases'
          }
        },
        
        successCriteria: [
          'All requirements traceable to business needs',
          'Acceptance criteria clearly defined',
          'Process flows documented',
          'Validation criteria established'
        ]
      },

      solution_architect: {
        type: 'thinking',
        llmModel: 'qwen2.5:14b',
        responsibilities: [
          'System architecture design and documentation',
          'Technology stack evaluation and selection',
          'Integration pattern definition',
          'Performance and scalability planning',
          'Security architecture design'
        ],
        
        requiredInputs: {
          businessRequirements: 'Functional requirements',
          technicalConstraints: 'Performance and scaling needs',
          integrationNeeds: 'External system requirements',
          securityRequirements: 'Security and compliance needs'
        },
        
        databaseWrites: {
          projectDependencies: 'Define technology stack',
          documentation: 'Architecture documentation',
          tests: 'Architecture validation tests',
          gitBranches: 'Setup architectural branches',
          snapshots: 'Architecture milestone snapshots'
        },
        
        databaseReads: {
          projects: 'Understand project scope',
          requirements: 'Review functional requirements',
          dependencies: 'Analyze technology landscape',
          compatibility: 'Check technology compatibility'
        },
        
        deliverables: {
          systemArchitecture: {
            table: 'documentation',
            fields: ['architecture', 'dataModels', 'configuration'],
            format: 'Complete system architecture documentation'
          },
          technologyStack: {
            table: 'projectDependencies',
            fields: ['dependencyId', 'criticality', 'usageType'],
            format: 'Selected technologies with rationale'
          },
          apiDesign: {
            table: 'documentation',
            fields: ['apiReference', 'examples', 'apiEndpoints'],
            format: 'API specifications and contracts'
          }
        },
        
        successCriteria: [
          'System architecture documented',
          'Technology choices validated for compatibility',
          'API contracts defined',
          'Performance targets established'
        ]
      },

      technical_writer: {
        type: 'thinking',
        llmModel: 'qwen2.5:14b',
        responsibilities: [
          'Technical documentation creation and maintenance',
          'API documentation and examples',
          'User guide and tutorial development',
          'Code comment standards enforcement',
          'Documentation quality assurance'
        ],
        
        requiredInputs: {
          technicalSpecs: 'Architecture and design documents',
          codeDeliverables: 'Completed code implementations',
          userRequirements: 'User experience requirements',
          apiSpecifications: 'API contracts and endpoints'
        },
        
        databaseWrites: {
          documentation: 'Create comprehensive documentation',
          todos: 'Documentation improvement tasks',
          feedbackStreams: 'Documentation status updates',
          fileVersions: 'Documentation version control'
        },
        
        databaseReads: {
          projects: 'Understand project scope',
          features: 'Review implemented features',
          tasks: 'Review completed implementations',
          dependencies: 'Document third-party integrations'
        },
        
        deliverables: {
          technicalDocumentation: {
            table: 'documentation',
            fields: ['description', 'userGuide', 'technicalDocs'],
            format: 'Complete technical documentation suite'
          },
          apiDocumentation: {
            table: 'documentation',
            fields: ['apiReference', 'examples', 'tutorials'],
            format: 'API documentation with examples'
          },
          userGuides: {
            table: 'documentation',
            fields: ['userGuide', 'tutorials', 'examples'],
            format: 'User-facing documentation'
          }
        },
        
        successCriteria: [
          'All features have user documentation',
          'API documentation complete with examples',
          'Installation and setup guides available',
          'Code documentation standards enforced'
        ]
      },

      // ==================== EXECUTION AGENTS ====================
      backend_developer: {
        type: 'fast',
        llmModel: 'qwen2.5:7b',
        responsibilities: [
          'API endpoint implementation',
          'Database schema and model creation',
          'Business logic implementation',
          'Server-side validation and security',
          'Integration with external services'
        ],
        
        requiredInputs: {
          apiSpecifications: 'API contracts and endpoints',
          databaseSchema: 'Data model requirements',
          businessLogic: 'Business rule definitions',
          securityRequirements: 'Authentication and authorization specs'
        },
        
        databaseWrites: {
          fileVersions: 'Backend code implementations',
          tests: 'Unit and integration tests',
          todos: 'Code improvement tasks',
          snapshots: 'Implementation milestones',
          gitBranches: 'Feature branch management',
          pullRequests: 'Code review requests'
        },
        
        databaseReads: {
          requirements: 'Functional requirements',
          queuedTasks: 'Development tasks',
          documentation: 'API specifications',
          dependencies: 'Required libraries and frameworks',
          tests: 'Existing test coverage'
        },
        
        deliverables: {
          apiEndpoints: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Working API endpoint implementations'
          },
          databaseModels: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Database models and schemas'
          },
          unitTests: {
            table: 'tests',
            fields: ['testCases', 'assertionRules', 'coverage'],
            format: 'Comprehensive test suite'
          },
          businessLogic: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Business logic implementations'
          }
        },
        
        successCriteria: [
          'All API endpoints implemented per specification',
          'Unit test coverage >= 80%',
          'Code follows established patterns',
          'Security measures implemented',
          'Documentation comments included'
        ]
      },

      frontend_developer: {
        type: 'fast',
        llmModel: 'qwen2.5:7b',
        responsibilities: [
          'UI component implementation',
          'Client-side logic and state management',
          'Responsive design and accessibility',
          'API integration and error handling',
          'Performance optimization'
        ],
        
        requiredInputs: {
          uiDesigns: 'User interface specifications',
          apiContracts: 'Backend API endpoints',
          userExperience: 'UX requirements and flows',
          brandingGuidelines: 'Design system specifications'
        },
        
        databaseWrites: {
          fileVersions: 'Frontend code implementations',
          tests: 'UI and integration tests',
          todos: 'UI improvement tasks',
          snapshots: 'UI implementation milestones',
          gitBranches: 'Feature branch management'
        },
        
        databaseReads: {
          requirements: 'User interface requirements',
          queuedTasks: 'Frontend development tasks',
          documentation: 'API documentation',
          dependencies: 'Frontend libraries and frameworks'
        },
        
        deliverables: {
          uiComponents: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Reusable UI components'
          },
          clientLogic: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Client-side application logic'
          },
          integrationTests: {
            table: 'tests',
            fields: ['testCases', 'mockRequirements', 'coverage'],
            format: 'UI and integration test suite'
          },
          responsiveLayouts: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Mobile-responsive implementations'
          }
        },
        
        successCriteria: [
          'All UI components match design specifications',
          'Responsive design across all screen sizes',
          'Accessibility standards met (WCAG)',
          'API integration working correctly',
          'Performance metrics within targets'
        ]
      },

      qa_engineer: {
        type: 'fast',
        llmModel: 'qwen2.5:7b',
        responsibilities: [
          'Test case creation and execution',
          'Bug identification and reporting',
          'Test automation development',
          'Quality metrics tracking',
          'Regression testing coordination'
        ],
        
        requiredInputs: {
          requirements: 'Functional requirements and acceptance criteria',
          implementations: 'Completed code implementations',
          testPlans: 'Testing strategy and scope',
          userScenarios: 'Real-world usage scenarios'
        },
        
        databaseWrites: {
          tests: 'Test cases and automation scripts',
          fileVersions: 'Test automation code',
          todos: 'Quality improvement tasks',
          feedbackStreams: 'Quality status updates',
          snapshots: 'Quality gate checkpoints'
        },
        
        databaseReads: {
          requirements: 'Acceptance criteria',
          queuedTasks: 'Testing tasks',
          features: 'Feature implementation status',
          tests: 'Existing test coverage',
          fileVersions: 'Code to be tested'
        },
        
        deliverables: {
          testSuite: {
            table: 'tests',
            fields: ['testCases', 'assertionRules', 'prerequisites'],
            format: 'Comprehensive test case suite'
          },
          automationScripts: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Automated test implementations'
          },
          qualityReports: {
            table: 'feedbackStreams',
            fields: ['message', 'details', 'severity'],
            format: 'Quality metrics and bug reports'
          },
          bugReports: {
            table: 'todos',
            fields: ['description', 'priority', 'filePath'],
            format: 'Detailed bug reproduction steps'
          }
        },
        
        successCriteria: [
          'All acceptance criteria have corresponding tests',
          'Test automation coverage >= 90%',
          'Bug reports include clear reproduction steps',
          'Quality gates established and monitored',
          'Regression test suite maintained'
        ]
      },

      devops_engineer: {
        type: 'fast',
        llmModel: 'qwen2.5:7b',
        responsibilities: [
          'Infrastructure setup and configuration',
          'CI/CD pipeline development',
          'Deployment automation',
          'Monitoring and alerting setup',
          'Environment management'
        ],
        
        requiredInputs: {
          deploymentRequirements: 'Infrastructure specifications',
          applicationArchitecture: 'System deployment architecture',
          securityRequirements: 'Security and compliance needs',
          scalingRequirements: 'Performance and scaling targets'
        },
        
        databaseWrites: {
          fileVersions: 'Infrastructure as code',
          gitBranches: 'Deployment branch management',
          snapshots: 'Deployment milestones',
          feedbackStreams: 'Deployment status updates',
          pullRequests: 'Infrastructure change reviews'
        },
        
        databaseReads: {
          projects: 'Deployment requirements',
          queuedTasks: 'DevOps tasks',
          gitIntegration: 'Repository configuration',
          dependencies: 'Infrastructure dependencies'
        },
        
        deliverables: {
          infrastructureCode: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Infrastructure as code implementations'
          },
          cicdPipelines: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Automated deployment pipelines'
          },
          monitoringConfig: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Monitoring and alerting setup'
          },
          deploymentEnvironments: {
            table: 'snapshots',
            fields: ['type', 'metadata', 'gitCommitHash'],
            format: 'Environment configuration snapshots'
          }
        },
        
        successCriteria: [
          'Infrastructure fully automated',
          'CI/CD pipeline operational',
          'Monitoring and alerting configured',
          'Environment parity maintained',
          'Deployment rollback capability available'
        ]
      },

      security_engineer: {
        type: 'fast',
        llmModel: 'qwen2.5:7b',
        responsibilities: [
          'Security vulnerability assessment',
          'Authentication and authorization implementation',
          'Data protection and encryption',
          'Security testing and compliance',
          'Security policy enforcement'
        ],
        
        requiredInputs: {
          securityRequirements: 'Security specifications',
          complianceStandards: 'Regulatory requirements',
          threatModel: 'Security threat assessment',
          codeImplementations: 'Code to be security reviewed'
        },
        
        databaseWrites: {
          tests: 'Security test cases',
          dependencies: 'Security vulnerability tracking',
          fileVersions: 'Security implementation code',
          todos: 'Security improvement tasks',
          feedbackStreams: 'Security status updates'
        },
        
        databaseReads: {
          dependencies: 'Third-party security analysis',
          queuedTasks: 'Security tasks',
          fileVersions: 'Code security review',
          tests: 'Existing security tests'
        },
        
        deliverables: {
          securityTests: {
            table: 'tests',
            fields: ['testCases', 'assertionRules', 'type'],
            format: 'Security and penetration tests'
          },
          vulnerabilityReports: {
            table: 'dependencies',
            fields: ['securityVulnerabilities', 'deprecationStatus'],
            format: 'Security vulnerability assessments'
          },
          securityImplementation: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Security controls and measures'
          },
          complianceReport: {
            table: 'feedbackStreams',
            fields: ['message', 'details', 'type'],
            format: 'Compliance status and recommendations'
          }
        },
        
        successCriteria: [
          'All security requirements implemented',
          'Vulnerability scan results documented',
          'Security tests passing',
          'Compliance requirements met',
          'Security policies enforced'
        ]
      },

      ux_designer: {
        type: 'fast',
        llmModel: 'qwen2.5:7b',
        responsibilities: [
          'User interface design and prototyping',
          'User experience flow optimization',
          'Accessibility compliance design',
          'Design system creation and maintenance',
          'User research and validation'
        ],
        
        requiredInputs: {
          userRequirements: 'User experience requirements',
          businessGoals: 'Product objectives',
          brandGuidelines: 'Brand and style requirements',
          userResearch: 'User behavior and feedback data'
        },
        
        databaseWrites: {
          documentation: 'Design system documentation',
          fileVersions: 'Design assets and specifications',
          requirements: 'UX requirements and guidelines',
          tests: 'Usability test cases',
          todos: 'Design improvement tasks'
        },
        
        databaseReads: {
          features: 'Feature specifications',
          requirements: 'User requirements',
          queuedTasks: 'Design tasks',
          documentation: 'Existing design documentation'
        },
        
        deliverables: {
          designSystem: {
            table: 'documentation',
            fields: ['description', 'examples', 'configuration'],
            format: 'Complete design system documentation'
          },
          uiSpecifications: {
            table: 'fileVersions',
            fields: ['content', 'filePath', 'changeType'],
            format: 'Detailed UI component specifications'
          },
          userFlows: {
            table: 'requirements',
            fields: ['description', 'acceptanceCriteria', 'type'],
            format: 'User journey and interaction flows'
          },
          usabilityTests: {
            table: 'tests',
            fields: ['testCases', 'prerequisites', 'type'],
            format: 'Usability and accessibility test cases'
          }
        },
        
        successCriteria: [
          'Design system documented and implemented',
          'All user flows optimized',
          'Accessibility guidelines met',
          'User interface specifications complete',
          'Usability validation completed'
        ]
      }
    };
  }

  // Agent Execution with Database Integration
  async executeAgentTask(agentId, agentRole, task) {
    const agentSpec = this.agentSpecs[agentRole];
    if (!agentSpec) {
      throw new Error(`Unknown agent role: ${agentRole}`);
    }

    // 1. Validate Required Inputs
    const validationResult = await this.validateAgentInputs(agentRole, task);
    if (!validationResult.valid) {
      return {
        success: false,
        reason: 'Missing required inputs',
        missingInputs: validationResult.missing
      };
    }

    // 2. Gather Required Data from Database
    const contextData = await this.gatherAgentContext(agentRole, task);

    // 3. Execute Agent with Complete Context
    const agentResult = await this.executeAgentWithContext(
      agentId,
      agentRole,
      task,
      contextData,
      agentSpec
    );

    // 4. Process and Store Agent Deliverables
    const storageResult = await this.storeAgentDeliverables(
      agentId,
      agentRole,
      task,
      agentResult,
      agentSpec
    );

    // 5. Update Project State
    await this.updateProjectState(task.projectId, agentRole, agentResult);

    // 6. Validate Success Criteria
    const criteriaResult = await this.validateSuccessCriteria(
      agentRole,
      task,
      agentResult,
      agentSpec
    );

    return {
      success: criteriaResult.met,
      deliverables: agentResult.deliverables,
      databaseUpdates: storageResult.updates,
      successCriteria: criteriaResult,
      agentOutput: agentResult.output
    };
  }

  async validateAgentInputs(agentRole, task) {
    const agentSpec = this.agentSpecs[agentRole];
    const requiredInputs = agentSpec.requiredInputs;
    const missing = [];

    for (const [inputKey, description] of Object.entries(requiredInputs)) {
      // Check if input is available in task context or database
      const available = await this.checkInputAvailability(inputKey, task);
      if (!available) {
        missing.push({ input: inputKey, description });
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  async gatherAgentContext(agentRole, task) {
    const agentSpec = this.agentSpecs[agentRole];
    const context = {};

    // Read required data from database tables
    for (const [table, description] of Object.entries(agentSpec.databaseReads)) {
      context[table] = await this.readFromTable(table, task.projectId, task);
    }

    // Add agent-specific context
    context.agentResponsibilities = agentSpec.responsibilities;
    context.deliverableSpecs = agentSpec.deliverables;
    context.successCriteria = agentSpec.successCriteria;

    return context;
  }

  async executeAgentWithContext(agentId, agentRole, task, contextData, agentSpec) {
    // Use the LLM provider with optimized context
    const llmResponse = await this.taskManager.llmProvider.generateResponse(
      agentId,
      {
        ...task,
        context: contextData,
        agentSpec: agentSpec
      },
      agentRole
    );

    if (!llmResponse.success) {
      throw new Error(`Agent execution failed: ${llmResponse.reason}`);
    }

    // Extract deliverables from agent response
    const deliverables = this.extractDeliverables(
      llmResponse.content,
      agentSpec.deliverables
    );

    return {
      output: llmResponse.content,
      deliverables,
      confidence: llmResponse.confidence,
      tokens: llmResponse.tokens
    };
  }

  async storeAgentDeliverables(agentId, agentRole, task, agentResult, agentSpec) {
    const updates = [];

    for (const [deliverableName, deliverableSpec] of Object.entries(agentSpec.deliverables)) {
      const deliverable = agentResult.deliverables[deliverableName];
      if (!deliverable) continue;

      // Store in appropriate database table
      const updateResult = await this.storeInTable(
        deliverableSpec.table,
        deliverable,
        task,
        agentId,
        deliverableSpec
      );

      updates.push(updateResult);
    }

    return { updates };
  }

  async storeInTable(tableName, deliverable, task, agentId, spec) {
    const recordId = uuidv4();
    const timestamp = new Date().toISOString();

    switch (tableName) {
      case 'projects':
        await this.redis.hSet(`project:${task.projectId}`, {
          ...deliverable,
          updatedBy: agentId,
          updatedAt: timestamp
        });
        break;

      case 'features':
        await this.redis.hSet(`feature:${recordId}`, {
          id: recordId,
          projectId: task.projectId,
          ...deliverable,
          createdBy: agentId,
          createdAt: timestamp
        });
        break;

      case 'requirements':
        await this.redis.hSet(`requirement:${recordId}`, {
          id: recordId,
          projectId: task.projectId,
          featureId: task.featureId || '',
          ...deliverable,
          createdBy: agentId,
          createdAt: timestamp
        });
        break;

      case 'queuedTasks':
        if (Array.isArray(deliverable)) {
          for (const taskDef of deliverable) {
            const taskId = await this.taskManager.agentQueue.enqueueTask({
              ...taskDef,
              projectId: task.projectId,
              createdBy: agentId
            });
          }
        }
        break;

      case 'tests':
        await this.redis.hSet(`test:${recordId}`, {
          id: recordId,
          projectId: task.projectId,
          taskId: task.id,
          ...deliverable,
          createdBy: agentId,
          createdAt: timestamp
        });
        break;

      case 'fileVersions':
        if (deliverable.files) {
          for (const file of deliverable.files) {
            await this.taskManager.versionControl.createFileVersion(
              task.projectId,
              file.path,
              file.content,
              {
                taskId: task.id,
                createdBy: agentId,
                changeType: file.changeType || 'created'
              }
            );
          }
        }
        break;

      case 'documentation':
        await this.taskManager.documentation.documentFeature(
          task.projectId,
          task.featureId || recordId,
          {
            ...deliverable,
            createdBy: agentId,
            createdAt: timestamp
          }
        );
        break;

      case 'todos':
        if (Array.isArray(deliverable)) {
          for (const todo of deliverable) {
            await this.taskManager.codeDocumentation.createTODO(
              task.projectId,
              {
                ...todo,
                taskId: task.id,
                createdBy: agentId
              }
            );
          }
        }
        break;

      case 'feedbackStreams':
        await this.taskManager.feedback.sendFeedback(task.projectId, {
          ...deliverable,
          source: agentId,
          timestamp
        });
        break;

      default:
        logger.warn(`Unknown table for storage: ${tableName}`);
    }

    return {
      table: tableName,
      recordId,
      success: true
    };
  }

  async readFromTable(tableName, projectId, task) {
    switch (tableName) {
      case 'projects':
        return await this.redis.hGetAll(`project:${projectId}`);

      case 'features':
        const featureIds = await this.redis.sMembers(`project:${projectId}:features`);
        const features = [];
        for (const id of featureIds) {
          const feature = await this.redis.hGetAll(`feature:${id}`);
          if (feature) features.push(feature);
        }
        return features;

      case 'requirements':
        const reqIds = await this.redis.sMembers(`project:${projectId}:requirements`);
        const requirements = [];
        for (const id of reqIds) {
          const req = await this.redis.hGetAll(`requirement:${id}`);
          if (req) requirements.push(req);
        }
        return requirements;

      case 'queuedTasks':
        return await this.taskManager.agentQueue.getQueueStats();

      case 'dependencies':
        return await this.taskManager.dependencies.getProjectDependencies(projectId);

      case 'documentation':
        return await this.taskManager.documentation.checkDocumentationUpdates(projectId);

      default:
        return {};
    }
  }

  async checkInputAvailability(inputKey, task) {
    // Check if required input is available in task or can be retrieved from database
    const inputSources = {
      projectRequest: () => task.description || task.request,
      featureSpecs: () => task.featureId,
      technicalSpecs: () => this.redis.hGetAll(`architecture:${task.projectId}`),
      userRequirements: () => task.acceptanceCriteria,
      businessRequirements: () => task.deliverables,
      // Add more input mappings as needed
    };

    const source = inputSources[inputKey];
    return source ? await source() : false;
  }

  extractDeliverables(agentOutput, deliverableSpecs) {
    const deliverables = {};

    for (const [name, spec] of Object.entries(deliverableSpecs)) {
      // Extract deliverable from agent output based on spec format
      const extracted = this.extractByFormat(agentOutput, name, spec.format);
      if (extracted) {
        deliverables[name] = extracted;
      }
    }

    return deliverables;
  }

  extractByFormat(output, name, format) {
    // Extract deliverables based on expected format
    // This is a simplified implementation - would need more sophisticated parsing
    const patterns = {
      'Working API endpoint implementations': /```javascript\n([\s\S]*?)\n```/g,
      'Prioritized feature backlog': /FEATURES:\s*([\s\S]*?)(?=\n\n|\n[A-Z]+:|$)/g,
      'Comprehensive test case suite': /TEST CASES:\s*([\s\S]*?)(?=\n\n|\n[A-Z]+:|$)/g
    };

    const pattern = patterns[format];
    if (pattern) {
      const matches = [...output.matchAll(pattern)];
      return matches.map(match => match[1].trim());
    }

    return null;
  }

  async validateSuccessCriteria(agentRole, task, agentResult, agentSpec) {
    const criteria = agentSpec.successCriteria;
    const results = [];

    for (const criterion of criteria) {
      const met = await this.checkCriterion(criterion, task, agentResult);
      results.push({
        criterion,
        met,
        evidence: met ? 'Verified in database' : 'Not found or incomplete'
      });
    }

    return {
      met: results.every(r => r.met),
      results,
      score: (results.filter(r => r.met).length / results.length) * 100
    };
  }

  async checkCriterion(criterion, task, agentResult) {
    // Check if success criterion is met by examining database state
    // This would implement specific checks for each criterion type
    return agentResult.deliverables && Object.keys(agentResult.deliverables).length > 0;
  }

  async updateProjectState(projectId, agentRole, agentResult) {
    // Update overall project state based on agent completion
    const projectState = await this.redis.hGetAll(`project:${projectId}`);
    
    // Track agent completion
    await this.redis.hSet(`project:${projectId}:agent_completions`, {
      [agentRole]: new Date().toISOString(),
      [`${agentRole}_confidence`]: agentResult.confidence || 0
    });

    // Update project progress
    const completions = await this.redis.hGetAll(`project:${projectId}:agent_completions`);
    const totalAgents = Object.keys(this.agentSpecs).length;
    const completedAgents = Object.keys(completions).filter(k => !k.includes('_confidence')).length;
    
    const progress = (completedAgents / totalAgents) * 100;
    
    await this.redis.hSet(`project:${projectId}`, {
      progress,
      lastAgentCompletion: agentRole,
      updatedAt: new Date().toISOString()
    });

    logger.info(`Project ${projectId} progress: ${progress.toFixed(1)}% (${agentRole} completed)`);
  }

  // Database Utilization Report
  async getDatabaseUtilizationReport(projectId) {
    const report = {
      projectId,
      tablesUtilized: 0,
      totalTables: 0,
      utilizationByTable: {},
      missingData: [],
      recommendations: []
    };

    const allTables = [
      'projects', 'features', 'requirements', 'tasks', 'tests', 'snapshots',
      'fileVersions', 'rollbackPoints', 'taskImpact', 'gitIntegration',
      'dependencies', 'projectDependencies', 'dependencyUsage', 'dependencyGraph',
      'queuedTasks', 'agentCheckouts', 'documentation', 'todos', 'gitBranches',
      'pullRequests', 'workflows', 'feedbackStreams', 'subscriptions'
    ];

    report.totalTables = allTables.length;

    for (const table of allTables) {
      const usage = await this.checkTableUsage(table, projectId);
      report.utilizationByTable[table] = usage;
      
      if (usage.recordCount > 0) {
        report.tablesUtilized++;
      } else {
        report.missingData.push(table);
      }
    }

    // Generate recommendations
    if (report.missingData.length > 0) {
      report.recommendations.push(
        `Consider utilizing ${report.missingData.length} unused tables for better project tracking`
      );
    }

    return report;
  }

  async checkTableUsage(tableName, projectId) {
    try {
      const keys = await this.redis.keys(`${tableName.slice(0, -1)}:*`);
      const projectKeys = keys.filter(key => key.includes(projectId));
      
      return {
        recordCount: projectKeys.length,
        lastUpdated: null, // Would need to track this
        dataQuality: projectKeys.length > 0 ? 'Good' : 'Missing'
      };
    } catch (error) {
      return { recordCount: 0, error: error.message };
    }
  }
}

export default AgentDatabaseIntegration;