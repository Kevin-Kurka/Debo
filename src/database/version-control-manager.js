import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger from '../logger.js';

export class VersionControlManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.redis = taskManager.redis;
  }

  // Snapshot Management
  async createSnapshot(projectId, type, name, metadata = {}) {
    await this.taskManager.ensureConnection();
    const snapshotId = uuidv4();
    
    const snapshot = {
      id: snapshotId,
      projectId,
      type,
      name,
      description: metadata.description || '',
      gitCommitHash: metadata.gitCommitHash || '',
      gitBranch: metadata.gitBranch || '',
      gitTag: metadata.gitTag || '',
      createdAt: new Date().toISOString(),
      createdBy: metadata.createdBy || 'system',
      fileStates: JSON.stringify(metadata.fileStates || {}),
      taskIds: JSON.stringify(metadata.taskIds || []),
      featureIds: JSON.stringify(metadata.featureIds || []),
      testResults: JSON.stringify(metadata.testResults || {}),
      metadata: JSON.stringify(metadata.extra || {})
    };

    await this.redis.hSet(`snapshot:${snapshotId}`, snapshot);
    
    // Add to timeline index
    await this.redis.zAdd(`project:${projectId}:snapshots`, {
      score: Date.now(),
      value: snapshotId
    });

    // Index by git commit if provided
    if (metadata.gitCommitHash) {
      await this.redis.hSet(`project:${projectId}:commits`, 
        metadata.gitCommitHash, snapshotId);
    }

    logger.info(`Created snapshot: ${snapshotId} for project: ${projectId}`);
    return snapshotId;
  }

  // File Version Management
  async createFileVersion(projectId, filePath, content, metadata = {}) {
    await this.taskManager.ensureConnection();
    const versionId = uuidv4();
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    
    const fileVersion = {
      id: versionId,
      projectId,
      filePath,
      versionId,
      content,
      contentHash,
      size: Buffer.byteLength(content, 'utf8'),
      taskId: metadata.taskId || '',
      snapshotId: metadata.snapshotId || '',
      gitCommitHash: metadata.gitCommitHash || '',
      createdAt: new Date().toISOString(),
      createdBy: metadata.createdBy || 'system',
      changeType: metadata.changeType || 'modified',
      previousVersionId: metadata.previousVersionId || '',
      nextVersionId: ''
    };

    const key = `fileversion:${projectId}:${filePath}:${versionId}`;
    await this.redis.hSet(key, fileVersion);
    
    // Update version chain
    if (metadata.previousVersionId) {
      const prevKey = `fileversion:${projectId}:${filePath}:${metadata.previousVersionId}`;
      await this.redis.hSet(prevKey, 'nextVersionId', versionId);
    }
    
    // Add to file versions index
    await this.redis.lPush(`file:${projectId}:${filePath}:versions`, versionId);

    return versionId;
  }

  // Rollback Point Management
  async createRollbackPoint(projectId, name, type, snapshotId, metadata = {}) {
    await this.taskManager.ensureConnection();
    const pointId = uuidv4();
    
    const rollbackPoint = {
      id: pointId,
      projectId,
      name,
      description: metadata.description || '',
      type,
      snapshotId,
      gitCommitHash: metadata.gitCommitHash || '',
      gitBranch: metadata.gitBranch || '',
      allTestsPassing: metadata.allTestsPassing || false,
      criticalTestsPassing: metadata.criticalTestsPassing || false,
      createdAt: new Date().toISOString(),
      isProtected: metadata.isProtected || false,
      retentionDays: metadata.retentionDays || 30
    };

    await this.redis.hSet(`rollback:${projectId}:${pointId}`, rollbackPoint);
    
    // Add to rollback points index
    await this.redis.zAdd(`project:${projectId}:rollbacks`, {
      score: Date.now(),
      value: pointId
    });

    logger.info(`Created rollback point: ${pointId} for project: ${projectId}`);
    return pointId;
  }

  // Task Impact Tracking
  async recordTaskImpact(taskId, projectId, impact) {
    await this.taskManager.ensureConnection();
    
    const taskImpact = {
      taskId,
      projectId,
      filesCreated: JSON.stringify(impact.filesCreated || []),
      filesModified: JSON.stringify(impact.filesModified || []),
      filesDeleted: JSON.stringify(impact.filesDeleted || []),
      directoriesCreated: JSON.stringify(impact.directoriesCreated || []),
      dependenciesAdded: JSON.stringify(impact.dependenciesAdded || []),
      configChanges: JSON.stringify(impact.configChanges || []),
      testsCovered: JSON.stringify(impact.testsCovered || []),
      rollbackComplexity: impact.rollbackComplexity || 'medium',
      estimatedRollbackTime: impact.estimatedRollbackTime || 30
    };

    await this.redis.hSet(`impact:${taskId}`, taskImpact);
    
    // Index files by task
    const allFiles = [
      ...(impact.filesCreated || []),
      ...(impact.filesModified || []).map(f => f.path),
      ...(impact.filesDeleted || [])
    ];
    
    for (const filePath of allFiles) {
      await this.redis.sAdd(`task:${taskId}:files`, filePath);
    }

    return taskId;
  }

  // Git Integration
  async updateGitIntegration(projectId, gitConfig) {
    await this.taskManager.ensureConnection();
    
    const gitIntegration = {
      projectId,
      repoUrl: gitConfig.repoUrl || '',
      mainBranch: gitConfig.mainBranch || 'main',
      currentBranch: gitConfig.currentBranch || 'main',
      lastSync: new Date().toISOString(),
      branchStrategy: gitConfig.branchStrategy || 'feature',
      autoCommit: gitConfig.autoCommit || false,
      autoTag: gitConfig.autoTag || false,
      commitMessageTemplate: gitConfig.commitMessageTemplate || '',
      protectedBranches: JSON.stringify(gitConfig.protectedBranches || ['main', 'master'])
    };

    await this.redis.hSet(`git:${projectId}`, gitIntegration);
    return projectId;
  }

  // Rollback Chain Management
  async addRollbackChain(taskId, dependentTaskId, impactType, autoRollback = false, manualSteps = []) {
    await this.taskManager.ensureConnection();
    
    const rollbackChain = {
      taskId,
      dependentTaskId,
      impactType,
      autoRollback,
      manualSteps: JSON.stringify(manualSteps)
    };

    await this.redis.hSet(`rollchain:${taskId}:${dependentTaskId}`, rollbackChain);
    return { taskId, dependentTaskId };
  }

  // Query Operations
  async getSnapshot(snapshotId) {
    await this.taskManager.ensureConnection();
    const snapshot = await this.redis.hGetAll(`snapshot:${snapshotId}`);
    
    if (snapshot && snapshot.id) {
      return {
        ...snapshot,
        fileStates: JSON.parse(snapshot.fileStates || '{}'),
        taskIds: JSON.parse(snapshot.taskIds || '[]'),
        featureIds: JSON.parse(snapshot.featureIds || '[]'),
        testResults: JSON.parse(snapshot.testResults || '{}'),
        metadata: JSON.parse(snapshot.metadata || '{}')
      };
    }
    
    return null;
  }

  async getProjectSnapshots(projectId, limit = 10) {
    await this.taskManager.ensureConnection();
    
    const snapshotIds = await this.redis.zRange(
      `project:${projectId}:snapshots`,
      -limit,
      -1,
      { REV: true }
    );
    
    const snapshots = [];
    for (const snapshotId of snapshotIds) {
      const snapshot = await this.getSnapshot(snapshotId);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }
    
    return snapshots;
  }

  async getFileVersions(projectId, filePath, limit = 10) {
    await this.taskManager.ensureConnection();
    
    const versionIds = await this.redis.lRange(
      `file:${projectId}:${filePath}:versions`,
      0,
      limit - 1
    );
    
    const versions = [];
    for (const versionId of versionIds) {
      const version = await this.redis.hGetAll(
        `fileversion:${projectId}:${filePath}:${versionId}`
      );
      if (version && version.id) {
        versions.push(version);
      }
    }
    
    return versions;
  }

  async compareSnapshots(snapshotId1, snapshotId2) {
    await this.taskManager.ensureConnection();
    
    const [snapshot1, snapshot2] = await Promise.all([
      this.getSnapshot(snapshotId1),
      this.getSnapshot(snapshotId2)
    ]);
    
    if (!snapshot1 || !snapshot2) {
      throw new Error('One or both snapshots not found');
    }
    
    const diff = {
      files: {
        added: [],
        modified: [],
        deleted: []
      },
      tasks: {
        added: [],
        completed: []
      },
      features: {
        added: [],
        completed: []
      }
    };
    
    // Compare file states
    const files1 = snapshot1.fileStates;
    const files2 = snapshot2.fileStates;
    
    for (const [path, state] of Object.entries(files2)) {
      if (!files1[path]) {
        diff.files.added.push(path);
      } else if (files1[path].hash !== state.hash) {
        diff.files.modified.push(path);
      }
    }
    
    for (const path of Object.keys(files1)) {
      if (!files2[path]) {
        diff.files.deleted.push(path);
      }
    }
    
    // Compare tasks and features
    diff.tasks.added = snapshot2.taskIds.filter(id => !snapshot1.taskIds.includes(id));
    diff.features.added = snapshot2.featureIds.filter(id => !snapshot1.featureIds.includes(id));
    
    return diff;
  }

  async performRollback(taskId, targetSnapshotId, cascadeDependent = false) {
    await this.taskManager.ensureConnection();
    const rollbackOperationId = uuidv4();
    
    // Get task impact
    const impact = await this.redis.hGetAll(`impact:${taskId}`);
    if (!impact) {
      throw new Error(`No impact data found for task ${taskId}`);
    }
    
    // Get target snapshot
    const targetSnapshot = await this.getSnapshot(targetSnapshotId);
    if (!targetSnapshot) {
      throw new Error(`Target snapshot ${targetSnapshotId} not found`);
    }
    
    const rollbackPlan = {
      operationId: rollbackOperationId,
      taskId,
      targetSnapshotId,
      filesCreated: JSON.parse(impact.filesCreated || '[]'),
      filesModified: JSON.parse(impact.filesModified || '[]'),
      filesDeleted: JSON.parse(impact.filesDeleted || '[]'),
      cascadeTasks: []
    };
    
    // Find dependent tasks if cascading
    if (cascadeDependent) {
      const chainKeys = await this.redis.keys(`rollchain:${taskId}:*`);
      for (const key of chainKeys) {
        const chain = await this.redis.hGetAll(key);
        if (chain.autoRollback === 'true') {
          rollbackPlan.cascadeTasks.push(chain.dependentTaskId);
        }
      }
    }
    
    // Store rollback operation
    await this.redis.hSet(`rollback_operation:${rollbackOperationId}`, {
      id: rollbackOperationId,
      plan: JSON.stringify(rollbackPlan),
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    return rollbackOperationId;
  }
}