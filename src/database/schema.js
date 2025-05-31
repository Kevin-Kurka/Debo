// Enhanced DBot Database Schema with Version Control & Dependency Management
export const schema = {
  // Core Project Management
  projects: {
    keyPattern: 'project:{projectId}',
    fields: {
      id: 'string',
      name: 'string',
      description: 'text',
      rootDirectory: 'string',
      structure: 'json',
      createdAt: 'timestamp',
      status: 'active|archived|paused'
    },
    vectors: {
      description_embedding: 'vector[1536]',
      structure_embedding: 'vector[1536]'
    }
  },

  features: {
    keyPattern: 'feature:{featureId}',
    fields: {
      id: 'string',
      projectId: 'string',
      name: 'string',
      description: 'text',
      objectives: 'json',
      priority: 'low|medium|high|critical',
      status: 'planned|in_progress|testing|completed|blocked',
      dependencies: 'json',
      dependents: 'json',
      createdAt: 'timestamp',
      estimatedHours: 'number'
    },
    vectors: {
      description_embedding: 'vector[1536]',
      objectives_embedding: 'vector[1536]'
    }
  },

  requirements: {
    keyPattern: 'requirement:{requirementId}',
    fields: {
      id: 'string',
      projectId: 'string',
      featureId: 'string',
      type: 'functional|non_functional|technical|business',
      title: 'string',
      description: 'text',
      acceptanceCriteria: 'json',
      priority: 'must_have|should_have|could_have|won_t_have',
      dependencies: 'json',
      traceabilityLinks: 'json',
      status: 'draft|approved|implemented|verified'
    },
    vectors: {
      description_embedding: 'vector[1536]',
      criteria_embedding: 'vector[1536]'
    }
  },  tasks: {
    keyPattern: 'task:{taskId}',
    fields: {
      id: 'string',
      projectId: 'string',
      featureId: 'string',
      requirementIds: 'json',
      type: 'development|testing|documentation|review|deployment',
      title: 'string',
      description: 'text',
      detailedSpecs: 'json',
      fileTargets: 'json',
      dependencies: 'json',
      blockedBy: 'json',
      testIds: 'json',
      assignedAgent: 'string',
      status: 'pending|in_progress|code_review|testing|completed|failed|blocked',
      estimatedHours: 'number',
      actualHours: 'number',
      createdAt: 'timestamp',
      completedAt: 'timestamp',
      result: 'text',
      codeChanges: 'json'
    },
    vectors: {
      description_embedding: 'vector[1536]',
      specs_embedding: 'vector[1536]'
    }
  },

  tests: {
    keyPattern: 'test:{testId}',
    fields: {
      id: 'string',
      projectId: 'string',
      taskId: 'string',
      featureId: 'string',
      requirementId: 'string',
      type: 'unit|integration|e2e|performance|security',
      level: 'component|feature|system',
      title: 'string',
      description: 'text',
      testCases: 'json',
      prerequisites: 'json',
      dependencies: 'json',
      targetFiles: 'json',
      testFiles: 'json',
      assertionRules: 'json',
      mockRequirements: 'json',
      status: 'not_run|running|passed|failed|skipped|blocked',
      lastRun: 'timestamp',
      runHistory: 'json',
      failureReasons: 'json',
      coverage: 'number',
      executionTime: 'number'
    },
    vectors: {
      description_embedding: 'vector[1536]',
      cases_embedding: 'vector[1536]'
    }
  },// Version Control & Rollback
  snapshots: {
    keyPattern: 'snapshot:{snapshotId}',
    fields: {
      id: 'string', projectId: 'string', type: 'commit|branch|tag|milestone|task_completion',
      name: 'string', description: 'text', gitCommitHash: 'string', gitBranch: 'string',
      gitTag: 'string', createdAt: 'timestamp', createdBy: 'string',
      fileStates: 'json', taskIds: 'json', featureIds: 'json', testResults: 'json', metadata: 'json'
    },
    vectors: { description_embedding: 'vector[1536]' }
  },

  fileVersions: {
    keyPattern: 'fileversion:{projectId}:{filePath}:{versionId}',
    fields: {
      id: 'string', projectId: 'string', filePath: 'string', versionId: 'string',
      content: 'text', contentHash: 'string', size: 'number', taskId: 'string',
      snapshotId: 'string', gitCommitHash: 'string', createdAt: 'timestamp',
      createdBy: 'string', changeType: 'created|modified|deleted|renamed',
      previousVersionId: 'string', nextVersionId: 'string'
    }
  },

  rollbackPoints: {
    keyPattern: 'rollback:{projectId}:{pointId}',
    fields: {
      id: 'string', projectId: 'string', name: 'string', description: 'text',
      type: 'stable|feature_complete|pre_deploy|emergency|manual', snapshotId: 'string',
      gitCommitHash: 'string', gitBranch: 'string', allTestsPassing: 'boolean',
      criticalTestsPassing: 'boolean', createdAt: 'timestamp', isProtected: 'boolean', retentionDays: 'number'
    }
  },

  // Dependencies
  dependencies: {
    keyPattern: 'dependency:{dependencyId}',
    fields: {
      id: 'string', name: 'string', type: 'package|library|service|database|api|framework|tool',
      version: 'string', source: 'npm|pip|maven|nuget|docker|git|url', repository: 'string',
      description: 'text', license: 'string', maintainer: 'string', lastUpdated: 'timestamp',
      securityVulnerabilities: 'json', deprecationStatus: 'active|deprecated|end_of_life', compatibilityMatrix: 'json'
    },
    vectors: { description_embedding: 'vector[1536]' }
  },

  projectDependencies: {
    keyPattern: 'projdep:{projectId}:{dependencyId}',
    fields: {
      projectId: 'string', dependencyId: 'string', currentVersion: 'string', requiredVersion: 'string',
      maxVersion: 'string', usageType: 'runtime|development|testing|build', criticality: 'critical|important|optional',
      directDependency: 'boolean', installPath: 'string', configFiles: 'json', lastVerified: 'timestamp',
      updateAvailable: 'boolean', latestVersion: 'string'
    }
  },

  dependencyUsage: {
    keyPattern: 'depuse:{projectId}:{dependencyId}:{fileId}',
    fields: {
      projectId: 'string', dependencyId: 'string', filePath: 'string', taskId: 'string',
      usageType: 'import|require|reference|config', lineNumbers: 'json', usageContext: 'json', lastScanned: 'timestamp'
    }
  },

  // Additional Version Control entities
  taskImpact: {
    keyPattern: 'impact:{taskId}',
    fields: {
      taskId: 'string',
      projectId: 'string',
      filesCreated: 'json', // Array of file paths
      filesModified: 'json', // Array of {path, beforeHash, afterHash}
      filesDeleted: 'json', // Array of file paths
      directoriesCreated: 'json',
      dependenciesAdded: 'json', // Package dependencies
      configChanges: 'json', // Config file modifications
      testsCovered: 'json', // Tests that validate this task
      rollbackComplexity: 'low|medium|high|critical',
      estimatedRollbackTime: 'number' // minutes
    }
  },

  gitIntegration: {
    keyPattern: 'git:{projectId}',
    fields: {
      projectId: 'string',
      repoUrl: 'string',
      mainBranch: 'string',
      currentBranch: 'string',
      lastSync: 'timestamp',
      branchStrategy: 'feature|gitflow|github_flow|custom',
      autoCommit: 'boolean',
      autoTag: 'boolean',
      commitMessageTemplate: 'string',
      protectedBranches: 'json'
    }
  },

  rollbackChain: {
    keyPattern: 'rollchain:{taskId}:{dependentTaskId}',
    fields: {
      taskId: 'string', // Task being rolled back
      dependentTaskId: 'string', // Task that depends on it
      impactType: 'breaks|degrades|requires_modification',
      autoRollback: 'boolean', // Should dependent task auto-rollback?
      manualSteps: 'json' // Required manual intervention
    }
  },

  // Additional Dependency Management entities
  dependencyGraph: {
    keyPattern: 'depgraph:{projectId}',
    fields: {
      projectId: 'string',
      graphData: 'json', // Full dependency tree
      circularDependencies: 'json',
      conflictingVersions: 'json',
      orphanedDependencies: 'json',
      lastAnalyzed: 'timestamp',
      totalDependencies: 'number',
      directCount: 'number',
      transitiveCount: 'number'
    }
  },

  updateImpact: {
    keyPattern: 'impact:{projectId}:{dependencyId}:{fromVersion}:{toVersion}',
    fields: {
      projectId: 'string',
      dependencyId: 'string',
      fromVersion: 'string',
      toVersion: 'string',
      changeType: 'patch|minor|major|breaking',
      breakingChanges: 'json',
      affectedFiles: 'json',
      affectedTasks: 'json',
      affectedTests: 'json',
      migrationSteps: 'json',
      estimatedEffort: 'number', // hours
      riskLevel: 'low|medium|high|critical',
      rollbackComplexity: 'simple|moderate|complex|dangerous'
    }
  },

  // Indexes for efficient queries
  indexes: {
    // Version Control indexes
    'file_versions': 'file:{projectId}:{filePath}:versions -> List[versionId]',
    'task_files': 'task:{taskId}:files -> Set[filePath]',
    'snapshot_timeline': 'project:{projectId}:snapshots -> SortedSet[timestamp:snapshotId]',
    'rollback_points': 'project:{projectId}:rollbacks -> SortedSet[timestamp:pointId]',
    'git_commits': 'project:{projectId}:commits -> Hash[commitHash:snapshotId]',
    
    // Dependency indexes
    'dependency_projects': 'dependency:{dependencyId}:projects -> Set[projectId]',
    'project_deps': 'project:{projectId}:dependencies -> Set[dependencyId]',
    'file_dependencies': 'file:{filePath}:dependencies -> Set[dependencyId]',
    'outdated_deps': 'outdated:dependencies -> Set[{projectId:dependencyId}]',
    'vulnerable_deps': 'vulnerable:dependencies -> Set[{projectId:dependencyId}]',
    'circular_deps': 'circular:dependencies -> Set[projectId]'
  },

  // Agent Queue Management
  queuedTasks: {
    keyPattern: 'queued_task:{taskId}',
    fields: {
      id: 'string',
      projectId: 'string',
      featureId: 'string',
      type: 'string',
      priority: 'low|medium|high|critical',
      requiredRole: 'string',
      requiredSkills: 'json',
      estimatedTime: 'number',
      dependencies: 'json',
      blockedBy: 'json',
      status: 'queued|checked_out|completed|failed',
      title: 'string',
      description: 'text',
      deliverables: 'json',
      acceptanceCriteria: 'json',
      testRequirements: 'json',
      assignedAgent: 'string',
      checkoutTime: 'timestamp',
      createdAt: 'timestamp'
    }
  },

  agentCheckouts: {
    keyPattern: 'checkout:{taskId}',
    fields: {
      taskId: 'string',
      agentId: 'string',
      agentRole: 'string',
      checkoutTime: 'timestamp',
      estimatedCompletion: 'timestamp'
    }
  },

  // Documentation and RAG
  documentation: {
    keyPattern: 'documentation:{docId}',
    fields: {
      id: 'string',
      dependencyId: 'string',
      packageName: 'string',
      version: 'string',
      type: 'library|framework|tool',
      readme: 'text',
      apiReference: 'json',
      examples: 'json',
      bestPractices: 'json',
      compatibleVersions: 'json',
      lastUpdated: 'timestamp',
      contentHash: 'string'
    },
    vectors: {
      content_embedding: 'vector[1536]'
    }
  },

  // Code Documentation
  todos: {
    keyPattern: 'todo:{todoId}',
    fields: {
      id: 'string',
      projectId: 'string',
      taskId: 'string',
      filePath: 'string',
      lineNumber: 'number',
      type: 'feature|bug|refactor|optimize|security',
      priority: 'low|medium|high|critical',
      description: 'text',
      assignedTo: 'string',
      createdBy: 'string',
      createdAt: 'timestamp',
      dueDate: 'timestamp',
      status: 'pending|in_progress|completed|cancelled'
    }
  },

  // Git Workflow
  gitBranches: {
    keyPattern: 'branch:{branchId}',
    fields: {
      id: 'string',
      projectId: 'string',
      featureId: 'string',
      name: 'string',
      type: 'feature|release|hotfix|develop|main',
      baseBranch: 'string',
      status: 'active|merged|deleted',
      createdAt: 'timestamp',
      createdBy: 'string',
      pullRequest: 'string'
    }
  },

  pullRequests: {
    keyPattern: 'pr:{prId}',
    fields: {
      id: 'string',
      projectId: 'string',
      branchId: 'string',
      sourceBranch: 'string',
      targetBranch: 'string',
      title: 'string',
      description: 'text',
      status: 'open|reviewing|merging|merged|closed',
      reviewers: 'json',
      checksRequired: 'json',
      checksPassed: 'json',
      createdAt: 'timestamp'
    }
  },

  // Workflows and Orchestration
  workflows: {
    keyPattern: 'workflow:{workflowId}',
    fields: {
      id: 'string',
      projectId: 'string',
      type: 'project_initialization|feature_development|bug_fix|maintenance',
      status: 'active|paused|completed|failed',
      phases: 'json',
      currentPhase: 'string',
      context: 'json',
      createdAt: 'timestamp'
    }
  },

  // Feedback and Reporting
  feedbackStreams: {
    keyPattern: 'feedback:{feedbackId}',
    fields: {
      id: 'string',
      projectId: 'string',
      type: 'status|error|warning|info|progress',
      severity: 'info|warning|error|critical',
      title: 'string',
      message: 'text',
      details: 'json',
      source: 'string',
      timestamp: 'timestamp'
    }
  },

  subscriptions: {
    keyPattern: 'subscription:{userId}',
    fields: {
      userId: 'string',
      type: 'on_demand|periodic|live_stream',
      frequency: 'immediate|hourly|daily|weekly',
      channels: 'json',
      filters: 'json',
      createdAt: 'timestamp',
      lastUpdate: 'timestamp'
    }
  },

  // Operations
  operations: {
    // Version Control operations
    createSnapshot: {
      input: ['projectId', 'type', 'name', 'gitCommitHash?'],
      output: 'snapshotId'
    },
    rollbackTask: {
      input: ['taskId', 'targetSnapshotId', 'cascadeDependent?'],
      output: 'rollbackOperationId'
    },
    compareSnapshots: {
      input: ['snapshotId1', 'snapshotId2'],
      output: 'diffSummary'
    },
    
    // Dependency operations
    scanDependencies: {
      input: ['projectId'],
      output: 'scanResultId'
    },
    analyzeUpdateImpact: {
      input: ['projectId', 'dependencyId', 'targetVersion'],
      output: 'impactAnalysisId'
    },
    updateDependency: {
      input: ['projectId', 'dependencyId', 'targetVersion', 'updateStrategy'],
      output: 'updateOperationId'
    },
    findUsages: {
      input: ['projectId', 'dependencyId'],
      output: 'usageReport'
    }
  }
};
