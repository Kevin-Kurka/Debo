import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';
import GitAutomation from '../agents/git-automation.js';
import path from 'path';

export class GitWorkflowManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.redis = taskManager.redis;
    this.gitAutomation = null;
  }

  setFileSystemManager(fileSystemManager) {
    this.gitAutomation = new GitAutomation(fileSystemManager);
  }

  // Repository Initialization
  async initializeRepository(projectId, config = {}) {
    await this.taskManager.ensureConnection();
    
    const repoConfig = {
      id: uuidv4(),
      projectId,
      name: config.name || `project-${projectId}`,
      url: config.url || null,
      mainBranch: config.mainBranch || 'main',
      developBranch: config.developBranch || 'develop',
      strategy: config.strategy || 'gitflow',
      remote: config.remote || 'origin',
      credentials: config.credentials ? await this.encryptCredentials(config.credentials) : null,
      initialized: false,
      createdAt: new Date().toISOString()
    };
    
    // Store repository configuration
    await this.redis.hSet(`git:${projectId}`, repoConfig);
    
    // Initialize repository using git automation if available
    if (this.gitAutomation && config.projectPath) {
      try {
        await this.gitAutomation.initializeRepository(config.projectPath, {
          stack: config.stack
        });
        repoConfig.initialized = true;
        await this.redis.hSet(`git:${projectId}`, { initialized: 'true' });
      } catch (error) {
        logger.error('Git initialization failed:', error);
      }
    }
    
    // Create initialization tasks
    const initTasks = await this.createInitializationTasks(projectId, repoConfig);
    
    return { repoConfig, initTasks };
  }

  // Feature Branch Management
  async createFeatureBranch(projectId, featureId, featureName) {
    await this.taskManager.ensureConnection();
    
    const branchName = this.generateBranchName('feature', featureName);
    const branchId = uuidv4();
    
    const branch = {
      id: branchId,
      projectId,
      featureId,
      name: branchName,
      type: 'feature',
      baseBranch: 'develop',
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      commits: [],
      files: [],
      pullRequest: null
    };
    
    // Store branch information
    await this.redis.hSet(`branch:${branchId}`, branch);
    
    // Add to project branches
    await this.redis.sAdd(`project:${projectId}:branches`, branchId);
    
    // Create branch creation task
    const branchTask = {
      projectId,
      featureId,
      type: 'git_operation',
      requiredRole: 'devops_engineer',
      priority: 'high',
      title: `Create feature branch: ${branchName}`,
      description: `Create and checkout feature branch for ${featureName}`,
      deliverables: {
        branch: branchName,
        setup: 'Branch created and checked out'
      },
      gitCommands: [
        'git checkout develop',
        'git pull origin develop',
        `git checkout -b ${branchName}`,
        `git push -u origin ${branchName}`
      ]
    };
    
    await this.taskManager.agentQueue.enqueueTask(branchTask);
    
    return branch;
  }

  // Commit Management
  async createCommit(branchId, commitData) {
    await this.taskManager.ensureConnection();
    const commitId = uuidv4();
    
    const commit = {
      id: commitId,
      branchId,
      taskId: commitData.taskId,
      agentId: commitData.agentId,
      message: commitData.message,
      files: JSON.stringify(commitData.files || []),
      additions: commitData.additions || 0,
      deletions: commitData.deletions || 0,
      hash: null, // Will be set after actual commit
      createdAt: new Date().toISOString()
    };
    
    // Store commit information
    await this.redis.hSet(`commit:${commitId}`, commit);
    
    // Add to branch commits
    await this.redis.lPush(`branch:${branchId}:commits`, commitId);
    
    // Create commit task
    const commitTask = {
      type: 'git_commit',
      priority: 'high',
      branchId,
      commitId,
      files: commitData.files,
      message: this.formatCommitMessage(commitData),
      commands: this.generateCommitCommands(commitData)
    };
    
    return { commit, task: commitTask };
  }

  // Pull Request Management
  async createPullRequest(branchId, prData) {
    await this.taskManager.ensureConnection();
    const prId = uuidv4();
    
    const branch = await this.redis.hGetAll(`branch:${branchId}`);
    if (!branch) {
      throw new Error(`Branch ${branchId} not found`);
    }
    
    const pullRequest = {
      id: prId,
      projectId: branch.projectId,
      branchId,
      featureId: branch.featureId,
      sourceBranch: branch.name,
      targetBranch: branch.baseBranch,
      title: prData.title || `Merge ${branch.name} into ${branch.baseBranch}`,
      description: prData.description || '',
      status: 'open',
      reviewers: JSON.stringify(prData.reviewers || []),
      labels: JSON.stringify(prData.labels || []),
      createdAt: new Date().toISOString(),
      createdBy: prData.createdBy || 'system',
      checksRequired: JSON.stringify([
        'build_passing',
        'tests_passing',
        'code_review_approved',
        'no_conflicts'
      ]),
      checksPassed: JSON.stringify([])
    };
    
    // Store pull request
    await this.redis.hSet(`pr:${prId}`, pullRequest);
    
    // Update branch with PR reference
    await this.redis.hSet(`branch:${branchId}`, 'pullRequest', prId);
    
    // Create PR review tasks
    await this.createPRReviewTasks(pullRequest);
    
    return pullRequest;
  }

  // Merge Operations
  async mergePullRequest(prId, mergeStrategy = 'merge') {
    await this.taskManager.ensureConnection();
    
    const pr = await this.redis.hGetAll(`pr:${prId}`);
    if (!pr) {
      throw new Error(`Pull request ${prId} not found`);
    }
    
    // Check if all required checks have passed
    const checksRequired = JSON.parse(pr.checksRequired || '[]');
    const checksPassed = JSON.parse(pr.checksPassed || '[]');
    
    const failedChecks = checksRequired.filter(check => !checksPassed.includes(check));
    if (failedChecks.length > 0) {
      throw new Error(`Cannot merge: Failed checks: ${failedChecks.join(', ')}`);
    }
    
    const mergeOperation = {
      id: uuidv4(),
      prId,
      strategy: mergeStrategy,
      sourceBranch: pr.sourceBranch,
      targetBranch: pr.targetBranch,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    // Create merge task
    const mergeTask = {
      projectId: pr.projectId,
      type: 'git_merge',
      requiredRole: 'devops_engineer',
      priority: 'critical',
      title: `Merge ${pr.sourceBranch} into ${pr.targetBranch}`,
      description: `Execute merge operation for PR #${prId}`,
      deliverables: {
        merge: 'Completed merge',
        cleanup: 'Branch cleanup if needed'
      },
      gitCommands: this.generateMergeCommands(pr, mergeStrategy)
    };
    
    await this.taskManager.agentQueue.enqueueTask(mergeTask);
    
    // Update PR status
    await this.redis.hSet(`pr:${prId}`, {
      status: 'merging',
      mergeOperation: mergeOperation.id
    });
    
    return mergeOperation;
  }

  // Git Command Generation
  generateCommitCommands(commitData) {
    const commands = [];
    
    // Stage files
    if (commitData.files && commitData.files.length > 0) {
      for (const file of commitData.files) {
        commands.push(`git add "${file}"`);
      }
    } else {
      // Stage all changes
      commands.push('git add -A');
    }
    
    // Create commit
    commands.push(`git commit -m "${this.escapeCommitMessage(commitData.message)}"`);
    
    // Push to remote
    commands.push('git push');
    
    return commands;
  }

  generateMergeCommands(pr, strategy) {
    const commands = [];
    
    // Ensure we're on the target branch
    commands.push(`git checkout ${pr.targetBranch}`);
    commands.push(`git pull origin ${pr.targetBranch}`);
    
    // Perform merge based on strategy
    switch (strategy) {
      case 'merge':
        commands.push(`git merge ${pr.sourceBranch} --no-ff`);
        break;
      case 'squash':
        commands.push(`git merge --squash ${pr.sourceBranch}`);
        commands.push(`git commit -m "Merge PR #${pr.id}: ${pr.title}"`);
        break;
      case 'rebase':
        commands.push(`git checkout ${pr.sourceBranch}`);
        commands.push(`git rebase ${pr.targetBranch}`);
        commands.push(`git checkout ${pr.targetBranch}`);
        commands.push(`git merge ${pr.sourceBranch} --ff-only`);
        break;
    }
    
    // Push merged changes
    commands.push(`git push origin ${pr.targetBranch}`);
    
    // Clean up source branch
    commands.push(`git push origin --delete ${pr.sourceBranch}`);
    commands.push(`git branch -d ${pr.sourceBranch}`);
    
    return commands;
  }

  // Commit Message Formatting
  formatCommitMessage(commitData) {
    const type = this.getCommitType(commitData.type);
    const scope = commitData.scope || commitData.taskId || 'general';
    const subject = commitData.message;
    
    let message = `${type}(${scope}): ${subject}`;
    
    if (commitData.body) {
      message += `\n\n${commitData.body}`;
    }
    
    if (commitData.footer) {
      message += `\n\n${commitData.footer}`;
    }
    
    // Add metadata
    message += `\n\nTask-ID: ${commitData.taskId || 'none'}`;
    message += `\nAgent: ${commitData.agentId || 'unknown'}`;
    
    return message;
  }

  getCommitType(type) {
    const typeMap = {
      feature: 'feat',
      bugfix: 'fix',
      documentation: 'docs',
      style: 'style',
      refactor: 'refactor',
      test: 'test',
      build: 'build',
      ci: 'ci',
      performance: 'perf',
      other: 'chore'
    };
    
    return typeMap[type] || 'chore';
  }

  // Branch Naming
  generateBranchName(type, name) {
    const sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
    
    const timestamp = Date.now().toString(36);
    
    return `${type}/${sanitized}-${timestamp}`;
  }

  // PR Review Tasks
  async createPRReviewTasks(pullRequest) {
    const tasks = [];
    
    // Code review task
    tasks.push({
      projectId: pullRequest.projectId,
      type: 'code_review',
      requiredRole: 'qa_engineer',
      priority: 'high',
      title: `Review code for PR: ${pullRequest.title}`,
      description: 'Perform thorough code review and quality checks',
      deliverables: {
        review: 'Code review comments',
        approval: 'Approval status',
        suggestions: 'Improvement suggestions'
      },
      prId: pullRequest.id
    });
    
    // Test verification task
    tasks.push({
      projectId: pullRequest.projectId,
      type: 'test_verification',
      requiredRole: 'qa_engineer',
      priority: 'high',
      title: `Verify tests for PR: ${pullRequest.title}`,
      description: 'Ensure all tests pass and coverage is adequate',
      deliverables: {
        testResults: 'Test execution results',
        coverage: 'Code coverage report',
        newTests: 'Any additional tests needed'
      },
      prId: pullRequest.id
    });
    
    // Security review if needed
    if (this.requiresSecurityReview(pullRequest)) {
      tasks.push({
        projectId: pullRequest.projectId,
        type: 'security_review',
        requiredRole: 'security_engineer',
        priority: 'critical',
        title: `Security review for PR: ${pullRequest.title}`,
        description: 'Perform security audit of code changes',
        deliverables: {
          vulnerabilities: 'Identified vulnerabilities',
          recommendations: 'Security recommendations',
          approval: 'Security approval status'
        },
        prId: pullRequest.id
      });
    }
    
    // Enqueue all tasks
    for (const task of tasks) {
      await this.taskManager.agentQueue.enqueueTask(task);
    }
    
    return tasks;
  }

  requiresSecurityReview(pullRequest) {
    const securityKeywords = ['auth', 'password', 'token', 'key', 'secret', 'encrypt', 'security'];
    const description = pullRequest.description.toLowerCase();
    return securityKeywords.some(keyword => description.includes(keyword));
  }

  // Branch Protection Rules
  async setupBranchProtection(projectId, branch, rules) {
    const protection = {
      branch,
      requirePullRequest: rules.requirePullRequest !== false,
      requiredReviewers: rules.requiredReviewers || 1,
      dismissStaleReviews: rules.dismissStaleReviews !== false,
      requireUpToDate: rules.requireUpToDate !== false,
      requireStatusChecks: rules.requireStatusChecks || ['build', 'test'],
      restrictPushAccess: rules.restrictPushAccess || ['admin'],
      enforceAdmins: rules.enforceAdmins !== false
    };
    
    await this.redis.hSet(`branch_protection:${projectId}:${branch}`, protection);
    
    return protection;
  }

  // Conflict Resolution
  async detectConflicts(branchId) {
    const branch = await this.redis.hGetAll(`branch:${branchId}`);
    if (!branch) return { hasConflicts: false };
    
    // This would run actual git commands to detect conflicts
    // For now, return placeholder
    return {
      hasConflicts: false,
      conflictingFiles: [],
      resolutionStrategy: 'automatic'
    };
  }

  async resolveConflicts(branchId, strategy = 'manual') {
    const conflicts = await this.detectConflicts(branchId);
    
    if (!conflicts.hasConflicts) {
      return { resolved: true };
    }
    
    if (strategy === 'automatic') {
      // Create automatic conflict resolution task
      const resolutionTask = {
        type: 'conflict_resolution',
        requiredRole: 'backend_developer',
        priority: 'critical',
        branchId,
        conflicts: conflicts.conflictingFiles,
        strategy: 'automatic'
      };
      
      await this.taskManager.agentQueue.enqueueTask(resolutionTask);
    }
    
    return { resolved: false, taskCreated: true };
  }

  // Git History and Analytics
  async getBranchHistory(branchId) {
    await this.taskManager.ensureConnection();
    
    const commitIds = await this.redis.lRange(`branch:${branchId}:commits`, 0, -1);
    const commits = [];
    
    for (const commitId of commitIds) {
      const commit = await this.redis.hGetAll(`commit:${commitId}`);
      if (commit) {
        commits.push({
          ...commit,
          files: JSON.parse(commit.files || '[]')
        });
      }
    }
    
    return commits;
  }

  async getProjectGitStats(projectId) {
    const branchIds = await this.redis.sMembers(`project:${projectId}:branches`);
    const stats = {
      totalBranches: branchIds.length,
      activeBranches: 0,
      totalCommits: 0,
      openPullRequests: 0,
      mergedPullRequests: 0,
      averageCommitsPerBranch: 0
    };
    
    for (const branchId of branchIds) {
      const branch = await this.redis.hGetAll(`branch:${branchId}`);
      if (branch && branch.status === 'active') {
        stats.activeBranches++;
      }
      
      const commits = await this.redis.lLen(`branch:${branchId}:commits`);
      stats.totalCommits += commits;
    }
    
    stats.averageCommitsPerBranch = stats.totalBranches > 0 ? 
      stats.totalCommits / stats.totalBranches : 0;
    
    return stats;
  }

  // Helper Methods
  async encryptCredentials(credentials) {
    // Implement proper encryption
    // For now, return base64 encoded
    return Buffer.from(JSON.stringify(credentials)).toString('base64');
  }

  escapeCommitMessage(message) {
    return message.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  }

  async createInitializationTasks(projectId, repoConfig) {
    const tasks = [];
    
    if (!repoConfig.url) {
      // Need to create new repository
      tasks.push({
        projectId,
        type: 'create_repository',
        requiredRole: 'devops_engineer',
        priority: 'critical',
        title: 'Create Git repository',
        description: 'Initialize new Git repository for the project',
        deliverables: {
          repository: 'Initialized repository',
          remoteUrl: 'Remote repository URL'
        }
      });
    }
    
    // Setup initial structure
    tasks.push({
      projectId,
      type: 'setup_structure',
      requiredRole: 'devops_engineer',
      priority: 'critical',
      title: 'Setup repository structure',
      description: 'Create initial project structure and configuration files',
      deliverables: {
        structure: 'Project directory structure',
        config: 'Configuration files (.gitignore, README, etc.)'
      }
    });
    
    // Setup branches
    tasks.push({
      projectId,
      type: 'setup_branches',
      requiredRole: 'devops_engineer',
      priority: 'high',
      title: 'Setup Git branching strategy',
      description: `Setup ${repoConfig.strategy} branching strategy`,
      deliverables: {
        branches: 'Created main and develop branches',
        protection: 'Branch protection rules'
      }
    });
    
    return tasks;
  }

  // Automated Git Operations using GitAutomation
  async createAutomatedCommit(projectId, projectPath, message, options = {}) {
    if (!this.gitAutomation) {
      throw new Error('Git automation not initialized');
    }

    // Create commit
    const result = await this.gitAutomation.commitChanges(projectPath, message, options);

    if (result.committed) {
      // Log commit in database
      const commitRecord = {
        id: uuidv4(),
        projectId,
        hash: result.hash,
        message: result.message,
        branch: options.branch || 'main',
        author: 'Debo Automation',
        timestamp: new Date().toISOString()
      };

      await this.redis.hSet(`commit:${commitRecord.id}`, commitRecord);
      await this.redis.sAdd(`project_commits:${projectId}`, commitRecord.id);

      logger.info(`Created automated commit: ${result.hash}`);
    }

    return result;
  }

  async createAutomatedPR(projectId, projectPath, options = {}) {
    if (!this.gitAutomation) {
      throw new Error('Git automation not initialized');
    }

    // Create PR using automation
    const prResult = await this.gitAutomation.createPullRequest(projectPath, options);

    // Store PR in database
    const pr = {
      id: uuidv4(),
      projectId,
      title: prResult.title,
      sourceBranch: prResult.branch,
      targetBranch: options.targetBranch || 'main',
      status: 'open',
      provider: prResult.provider,
      url: prResult.url,
      createdAt: new Date().toISOString(),
      checksRequired: JSON.stringify(options.checks || ['tests', 'build']),
      checksPassed: JSON.stringify([])
    };

    await this.redis.hSet(`pr:${pr.id}`, pr);
    await this.redis.sAdd(`project_prs:${projectId}`, pr.id);

    logger.info(`Created automated PR: ${prResult.url}`);

    return { pr, result: prResult };
  }

  async setupProjectGitHooks(projectId, projectPath) {
    if (!this.gitAutomation) {
      throw new Error('Git automation not initialized');
    }

    await this.gitAutomation.setupGitHooks(projectPath);

    // Record hooks setup
    await this.redis.hSet(`git:${projectId}`, {
      hooksSetup: 'true',
      hooksSetupAt: new Date().toISOString()
    });

    logger.info(`Git hooks configured for project ${projectId}`);
  }

  async generateGitReport(projectId, projectPath) {
    if (!this.gitAutomation) {
      throw new Error('Git automation not initialized');
    }

    const report = await this.gitAutomation.createGitReport(projectPath);
    
    // Store report
    await this.redis.hSet(`git_report:${projectId}`, {
      report,
      generatedAt: new Date().toISOString()
    });

    return report;
  }

  async analyzeRepositoryStatus(projectId, projectPath) {
    if (!this.gitAutomation) {
      return { error: 'Git automation not initialized' };
    }

    const analysis = await this.gitAutomation.analyzeRepository(projectPath);
    
    // Store analysis
    await this.redis.hSet(`git_analysis:${projectId}`, {
      ...analysis,
      analyzedAt: new Date().toISOString()
    });

    return analysis;
  }
}