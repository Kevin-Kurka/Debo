import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class DependencyManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.redis = taskManager.redis;
  }

  // Dependency Registration
  async registerDependency(dependency) {
    await this.taskManager.ensureConnection();
    const dependencyId = dependency.id || uuidv4();
    
    const dependencyData = {
      id: dependencyId,
      name: dependency.name,
      type: dependency.type || 'package',
      version: dependency.version,
      source: dependency.source || 'npm',
      repository: dependency.repository || '',
      description: dependency.description || '',
      license: dependency.license || '',
      maintainer: dependency.maintainer || '',
      lastUpdated: new Date().toISOString(),
      securityVulnerabilities: JSON.stringify(dependency.securityVulnerabilities || []),
      deprecationStatus: dependency.deprecationStatus || 'active',
      compatibilityMatrix: JSON.stringify(dependency.compatibilityMatrix || {})
    };

    await this.redis.hSet(`dependency:${dependencyId}`, dependencyData);
    
    logger.info(`Registered dependency: ${dependency.name}@${dependency.version}`);
    return dependencyId;
  }

  // Project Dependency Management
  async addProjectDependency(projectId, dependencyId, config = {}) {
    await this.taskManager.ensureConnection();
    
    const projDepData = {
      projectId,
      dependencyId,
      currentVersion: config.currentVersion || '',
      requiredVersion: config.requiredVersion || '',
      maxVersion: config.maxVersion || '',
      usageType: config.usageType || 'runtime',
      criticality: config.criticality || 'important',
      directDependency: config.directDependency !== false,
      installPath: config.installPath || '',
      configFiles: JSON.stringify(config.configFiles || []),
      lastVerified: new Date().toISOString(),
      updateAvailable: false,
      latestVersion: config.currentVersion || ''
    };

    await this.redis.hSet(`projdep:${projectId}:${dependencyId}`, projDepData);
    
    // Update indexes
    await this.redis.sAdd(`project:${projectId}:dependencies`, dependencyId);
    await this.redis.sAdd(`dependency:${dependencyId}:projects`, projectId);
    
    return { projectId, dependencyId };
  }

  // Dependency Usage Tracking
  async trackDependencyUsage(projectId, dependencyId, filePath, usage) {
    await this.taskManager.ensureConnection();
    
    const usageData = {
      projectId,
      dependencyId,
      filePath,
      taskId: usage.taskId || '',
      usageType: usage.usageType || 'import',
      lineNumbers: JSON.stringify(usage.lineNumbers || []),
      usageContext: JSON.stringify(usage.usageContext || {}),
      lastScanned: new Date().toISOString()
    };

    await this.redis.hSet(`depuse:${projectId}:${dependencyId}:${filePath}`, usageData);
    
    // Update file dependencies index
    await this.redis.sAdd(`file:${filePath}:dependencies`, dependencyId);
    
    return { projectId, dependencyId, filePath };
  }

  // Dependency Graph Management
  async updateDependencyGraph(projectId, graphData) {
    await this.taskManager.ensureConnection();
    
    const graph = {
      projectId,
      graphData: JSON.stringify(graphData.graph || {}),
      circularDependencies: JSON.stringify(graphData.circular || []),
      conflictingVersions: JSON.stringify(graphData.conflicts || {}),
      orphanedDependencies: JSON.stringify(graphData.orphaned || []),
      lastAnalyzed: new Date().toISOString(),
      totalDependencies: graphData.total || 0,
      directCount: graphData.direct || 0,
      transitiveCount: graphData.transitive || 0
    };

    await this.redis.hSet(`depgraph:${projectId}`, graph);
    
    // Update circular dependencies index if found
    if (graphData.circular && graphData.circular.length > 0) {
      await this.redis.sAdd('circular:dependencies', projectId);
    } else {
      await this.redis.sRem('circular:dependencies', projectId);
    }
    
    return projectId;
  }

  // Update Impact Analysis
  async analyzeUpdateImpact(projectId, dependencyId, fromVersion, toVersion, analysis) {
    await this.taskManager.ensureConnection();
    
    const impactData = {
      projectId,
      dependencyId,
      fromVersion,
      toVersion,
      changeType: analysis.changeType || 'minor',
      breakingChanges: JSON.stringify(analysis.breakingChanges || []),
      affectedFiles: JSON.stringify(analysis.affectedFiles || []),
      affectedTasks: JSON.stringify(analysis.affectedTasks || []),
      affectedTests: JSON.stringify(analysis.affectedTests || []),
      migrationSteps: JSON.stringify(analysis.migrationSteps || []),
      estimatedEffort: analysis.estimatedEffort || 0,
      riskLevel: analysis.riskLevel || 'medium',
      rollbackComplexity: analysis.rollbackComplexity || 'moderate'
    };

    const key = `impact:${projectId}:${dependencyId}:${fromVersion}:${toVersion}`;
    await this.redis.hSet(key, impactData);
    
    return key;
  }

  // Vulnerability and Update Tracking
  async markDependencyVulnerable(projectId, dependencyId, vulnerabilities) {
    await this.taskManager.ensureConnection();
    
    // Update dependency with vulnerabilities
    await this.redis.hSet(`dependency:${dependencyId}`, {
      securityVulnerabilities: JSON.stringify(vulnerabilities),
      lastUpdated: new Date().toISOString()
    });
    
    // Add to vulnerable dependencies index
    await this.redis.sAdd('vulnerable:dependencies', `${projectId}:${dependencyId}`);
    
    return { projectId, dependencyId };
  }

  async markDependencyOutdated(projectId, dependencyId, currentVersion, latestVersion) {
    await this.taskManager.ensureConnection();
    
    // Update project dependency
    await this.redis.hSet(`projdep:${projectId}:${dependencyId}`, {
      updateAvailable: true,
      latestVersion
    });
    
    // Add to outdated dependencies index
    await this.redis.sAdd('outdated:dependencies', `${projectId}:${dependencyId}`);
    
    return { projectId, dependencyId, currentVersion, latestVersion };
  }

  // Query Operations
  async getDependency(dependencyId) {
    await this.taskManager.ensureConnection();
    const dependency = await this.redis.hGetAll(`dependency:${dependencyId}`);
    
    if (dependency && dependency.id) {
      return {
        ...dependency,
        securityVulnerabilities: JSON.parse(dependency.securityVulnerabilities || '[]'),
        compatibilityMatrix: JSON.parse(dependency.compatibilityMatrix || '{}')
      };
    }
    
    return null;
  }

  async getProjectDependencies(projectId) {
    await this.taskManager.ensureConnection();
    const dependencyIds = await this.redis.sMembers(`project:${projectId}:dependencies`);
    const dependencies = [];
    
    for (const dependencyId of dependencyIds) {
      const projDep = await this.redis.hGetAll(`projdep:${projectId}:${dependencyId}`);
      const dependency = await this.getDependency(dependencyId);
      
      if (projDep && dependency) {
        dependencies.push({
          ...dependency,
          projectConfig: {
            ...projDep,
            configFiles: JSON.parse(projDep.configFiles || '[]'),
            updateAvailable: projDep.updateAvailable === 'true'
          }
        });
      }
    }
    
    return dependencies;
  }

  async getDependencyUsages(projectId, dependencyId) {
    await this.taskManager.ensureConnection();
    const keys = await this.redis.keys(`depuse:${projectId}:${dependencyId}:*`);
    const usages = [];
    
    for (const key of keys) {
      const usage = await this.redis.hGetAll(key);
      if (usage) {
        usages.push({
          ...usage,
          lineNumbers: JSON.parse(usage.lineNumbers || '[]'),
          usageContext: JSON.parse(usage.usageContext || '{}')
        });
      }
    }
    
    return usages;
  }

  async getDependencyGraph(projectId) {
    await this.taskManager.ensureConnection();
    const graph = await this.redis.hGetAll(`depgraph:${projectId}`);
    
    if (graph && graph.projectId) {
      return {
        ...graph,
        graphData: JSON.parse(graph.graphData || '{}'),
        circularDependencies: JSON.parse(graph.circularDependencies || '[]'),
        conflictingVersions: JSON.parse(graph.conflictingVersions || '{}'),
        orphanedDependencies: JSON.parse(graph.orphanedDependencies || '[]')
      };
    }
    
    return null;
  }

  async getVulnerableDependencies() {
    await this.taskManager.ensureConnection();
    const vulnerableKeys = await this.redis.sMembers('vulnerable:dependencies');
    const vulnerabilities = [];
    
    for (const key of vulnerableKeys) {
      const [projectId, dependencyId] = key.split(':');
      const dependency = await this.getDependency(dependencyId);
      
      if (dependency) {
        vulnerabilities.push({
          projectId,
          dependency
        });
      }
    }
    
    return vulnerabilities;
  }

  async getOutdatedDependencies(projectId = null) {
    await this.taskManager.ensureConnection();
    const outdatedKeys = await this.redis.sMembers('outdated:dependencies');
    const outdated = [];
    
    for (const key of outdatedKeys) {
      const [projId, dependencyId] = key.split(':');
      
      if (!projectId || projId === projectId) {
        const projDep = await this.redis.hGetAll(`projdep:${projId}:${dependencyId}`);
        const dependency = await this.getDependency(dependencyId);
        
        if (projDep && dependency) {
          outdated.push({
            projectId: projId,
            dependency,
            currentVersion: projDep.currentVersion,
            latestVersion: projDep.latestVersion
          });
        }
      }
    }
    
    return outdated;
  }

  // Dependency Operations
  async scanDependencies(projectId) {
    await this.taskManager.ensureConnection();
    const scanResultId = uuidv4();
    
    // Create scan operation record
    await this.redis.hSet(`scan_operation:${scanResultId}`, {
      id: scanResultId,
      projectId,
      type: 'dependency_scan',
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    // This would typically trigger an agent to perform the actual scan
    await this.taskManager.logActivity(
      'dependency_scan_requested',
      'system',
      scanResultId,
      projectId,
      { operationType: 'scan' }
    );
    
    return scanResultId;
  }

  async updateDependency(projectId, dependencyId, targetVersion, updateStrategy = 'safe') {
    await this.taskManager.ensureConnection();
    const updateOperationId = uuidv4();
    
    // Get current version
    const projDep = await this.redis.hGetAll(`projdep:${projectId}:${dependencyId}`);
    if (!projDep) {
      throw new Error(`Dependency ${dependencyId} not found in project ${projectId}`);
    }
    
    // Create update operation
    await this.redis.hSet(`update_operation:${updateOperationId}`, {
      id: updateOperationId,
      projectId,
      dependencyId,
      fromVersion: projDep.currentVersion,
      toVersion: targetVersion,
      updateStrategy,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    // This would trigger an agent to perform the update
    await this.taskManager.logActivity(
      'dependency_update_requested',
      'system',
      updateOperationId,
      projectId,
      { 
        dependencyId,
        fromVersion: projDep.currentVersion,
        toVersion: targetVersion
      }
    );
    
    return updateOperationId;
  }
}