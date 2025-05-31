import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class CompatibilityManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.redis = taskManager.redis;
    this.dependencies = taskManager.dependencies;
    this.documentation = taskManager.documentation;
  }

  // Pre-Installation Compatibility Check
  async checkCompatibility(projectId, newDependency) {
    await this.taskManager.ensureConnection();
    const checkId = uuidv4();
    
    logger.info(`Starting compatibility check for ${newDependency.name}@${newDependency.version}`);
    
    // Get existing project dependencies
    const existingDeps = await this.dependencies.getProjectDependencies(projectId);
    
    // Initialize compatibility report
    const report = {
      id: checkId,
      projectId,
      dependency: newDependency,
      status: 'compatible',
      score: 100,
      compatible: [],
      incompatible: [],
      conditional: [],
      issues: [],
      resolutions: [],
      workarounds: [],
      constraints: {},
      recommended: {},
      migrationRequired: false,
      migrationSteps: [],
      migrationEffort: 0,
      analyzedAt: new Date().toISOString(),
      analyzedBy: 'compatibility_manager'
    };
    
    // Check version compatibility
    await this.checkVersionCompatibility(newDependency, existingDeps, report);
    
    // Check peer dependencies
    await this.checkPeerDependencies(newDependency, existingDeps, report);
    
    // Check known conflicts
    await this.checkKnownConflicts(newDependency, existingDeps, report);
    
    // Check license compatibility
    await this.checkLicenseCompatibility(newDependency, existingDeps, report);
    
    // Check platform compatibility
    await this.checkPlatformCompatibility(projectId, newDependency, report);
    
    // Check security vulnerabilities
    await this.checkSecurityVulnerabilities(newDependency, report);
    
    // Calculate final compatibility score
    report.score = this.calculateCompatibilityScore(report);
    report.status = this.determineCompatibilityStatus(report);
    
    // Store compatibility check result
    await this.storeCompatibilityCheck(checkId, report);
    
    // If incompatible, suggest alternatives
    if (report.status === 'incompatible') {
      report.alternatives = await this.suggestAlternatives(newDependency, report);
    }
    
    return report;
  }

  // Version Compatibility Checking
  async checkVersionCompatibility(newDep, existingDeps, report) {
    for (const existingDep of existingDeps) {
      // Check if same package with different version
      if (existingDep.name === newDep.name) {
        const versionConflict = this.compareVersions(
          existingDep.projectConfig.currentVersion,
          newDep.version
        );
        
        if (versionConflict.hasConflict) {
          report.issues.push({
            type: 'version_conflict',
            severity: 'high',
            dependency: existingDep.name,
            existing: existingDep.projectConfig.currentVersion,
            requested: newDep.version,
            description: versionConflict.description
          });
          
          report.incompatible.push({
            name: existingDep.name,
            reason: 'version_conflict'
          });
        }
      }
      
      // Check compatibility matrix
      const compatMatrix = JSON.parse(existingDep.compatibilityMatrix || '{}');
      if (compatMatrix[newDep.name]) {
        const compatVersions = compatMatrix[newDep.name];
        if (!this.isVersionCompatible(newDep.version, compatVersions)) {
          report.issues.push({
            type: 'incompatible_version',
            severity: 'medium',
            dependency: existingDep.name,
            withDependency: newDep.name,
            requiredVersions: compatVersions
          });
          
          report.conditional.push({
            name: existingDep.name,
            condition: `Requires ${newDep.name} version ${compatVersions}`
          });
        }
      }
    }
  }

  // Peer Dependency Checking
  async checkPeerDependencies(newDep, existingDeps, report) {
    const peerDeps = newDep.peerDependencies || {};
    
    for (const [peerName, peerVersion] of Object.entries(peerDeps)) {
      const existingPeer = existingDeps.find(d => d.name === peerName);
      
      if (!existingPeer) {
        report.issues.push({
          type: 'missing_peer_dependency',
          severity: 'high',
          dependency: newDep.name,
          requires: peerName,
          version: peerVersion
        });
        
        report.resolutions.push({
          type: 'install_peer',
          action: `Install ${peerName}@${peerVersion}`,
          package: peerName,
          version: peerVersion
        });
      } else if (!this.isVersionCompatible(existingPeer.projectConfig.currentVersion, peerVersion)) {
        report.issues.push({
          type: 'incompatible_peer_version',
          severity: 'medium',
          dependency: newDep.name,
          peerDependency: peerName,
          required: peerVersion,
          current: existingPeer.projectConfig.currentVersion
        });
        
        report.resolutions.push({
          type: 'update_peer',
          action: `Update ${peerName} to version ${peerVersion}`,
          package: peerName,
          fromVersion: existingPeer.projectConfig.currentVersion,
          toVersion: peerVersion
        });
      }
    }
  }

  // Known Conflicts Database
  async checkKnownConflicts(newDep, existingDeps, report) {
    // Check conflict database
    const conflicts = await this.getKnownConflicts(newDep.name, newDep.version);
    
    for (const conflict of conflicts) {
      const conflictingDep = existingDeps.find(d => d.name === conflict.package);
      
      if (conflictingDep) {
        report.issues.push({
          type: 'known_conflict',
          severity: conflict.severity || 'high',
          dependency: newDep.name,
          conflictsWith: conflict.package,
          reason: conflict.reason,
          documented: true
        });
        
        if (conflict.workaround) {
          report.workarounds.push({
            issue: `Conflict with ${conflict.package}`,
            solution: conflict.workaround,
            effort: conflict.effort || 'medium'
          });
        }
        
        if (conflict.resolution) {
          report.resolutions.push({
            type: 'known_resolution',
            action: conflict.resolution,
            automated: conflict.automated || false
          });
        }
      }
    }
  }

  // License Compatibility
  async checkLicenseCompatibility(newDep, existingDeps, report) {
    const projectLicense = await this.getProjectLicense(report.projectId);
    const depLicense = newDep.license;
    
    if (!this.areLicensesCompatible(projectLicense, depLicense)) {
      report.issues.push({
        type: 'license_incompatibility',
        severity: 'high',
        projectLicense,
        dependencyLicense: depLicense,
        dependency: newDep.name
      });
      
      report.incompatible.push({
        name: newDep.name,
        reason: 'license_incompatibility'
      });
    }
    
    // Check transitive license issues
    for (const existingDep of existingDeps) {
      if (!this.areLicensesCompatible(existingDep.license, depLicense)) {
        report.issues.push({
          type: 'transitive_license_conflict',
          severity: 'medium',
          dependency: newDep.name,
          conflictsWith: existingDep.name,
          licenses: [existingDep.license, depLicense]
        });
      }
    }
  }

  // Platform Compatibility
  async checkPlatformCompatibility(projectId, newDep, report) {
    const projectPlatform = await this.getProjectPlatform(projectId);
    
    if (newDep.platforms && !newDep.platforms.includes(projectPlatform)) {
      report.issues.push({
        type: 'platform_incompatibility',
        severity: 'critical',
        dependency: newDep.name,
        supportedPlatforms: newDep.platforms,
        projectPlatform
      });
      
      report.incompatible.push({
        name: newDep.name,
        reason: 'platform_incompatibility'
      });
    }
    
    // Check Node.js version requirements
    if (newDep.engines && newDep.engines.node) {
      const projectNodeVersion = await this.getProjectNodeVersion(projectId);
      if (!this.isVersionCompatible(projectNodeVersion, newDep.engines.node)) {
        report.issues.push({
          type: 'node_version_incompatibility',
          severity: 'high',
          dependency: newDep.name,
          requiredNode: newDep.engines.node,
          currentNode: projectNodeVersion
        });
      }
    }
  }

  // Security Vulnerability Checking
  async checkSecurityVulnerabilities(newDep, report) {
    const vulnerabilities = await this.getVulnerabilities(newDep.name, newDep.version);
    
    if (vulnerabilities.length > 0) {
      for (const vuln of vulnerabilities) {
        report.issues.push({
          type: 'security_vulnerability',
          severity: vuln.severity,
          dependency: newDep.name,
          vulnerability: vuln.id,
          description: vuln.description,
          cve: vuln.cve
        });
        
        if (vuln.fixedIn) {
          report.resolutions.push({
            type: 'security_update',
            action: `Update to version ${vuln.fixedIn} or higher`,
            package: newDep.name,
            toVersion: vuln.fixedIn,
            reason: 'security_fix'
          });
        }
      }
      
      // Don't mark as incompatible for low severity vulnerabilities
      const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high');
      if (criticalVulns.length > 0) {
        report.incompatible.push({
          name: newDep.name,
          reason: 'critical_security_vulnerabilities'
        });
      }
    }
  }

  // Compatibility Scoring
  calculateCompatibilityScore(report) {
    let score = 100;
    
    // Deduct points for issues
    for (const issue of report.issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 50;
          break;
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }
    
    // Bonus points for available resolutions
    score += report.resolutions.length * 2;
    
    // Bonus points for workarounds
    score += report.workarounds.length * 1;
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  determineCompatibilityStatus(report) {
    if (report.incompatible.length > 0) {
      return 'incompatible';
    }
    
    if (report.score >= 80) {
      return 'compatible';
    }
    
    if (report.score >= 50) {
      return 'conditional';
    }
    
    return 'incompatible';
  }

  // Alternative Suggestions
  async suggestAlternatives(dependency, report) {
    const alternatives = [];
    
    // Get similar packages
    const similar = await this.findSimilarPackages(dependency);
    
    for (const alt of similar) {
      // Check if alternative is compatible
      const altReport = await this.checkCompatibility(report.projectId, alt);
      
      if (altReport.status === 'compatible' || altReport.status === 'conditional') {
        alternatives.push({
          name: alt.name,
          version: alt.version,
          compatibilityScore: altReport.score,
          description: alt.description,
          popularity: alt.popularity || 0,
          maintained: alt.maintained || true
        });
      }
    }
    
    // Sort by compatibility score and popularity
    alternatives.sort((a, b) => {
      const scoreA = a.compatibilityScore + (a.popularity * 0.1);
      const scoreB = b.compatibilityScore + (b.popularity * 0.1);
      return scoreB - scoreA;
    });
    
    return alternatives.slice(0, 5);
  }

  // Helper Methods
  compareVersions(v1, v2) {
    // Simple version comparison logic
    if (v1 === v2) {
      return { hasConflict: false };
    }
    
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    if (parts1[0] !== parts2[0]) {
      return {
        hasConflict: true,
        description: `Major version mismatch: ${v1} vs ${v2}`
      };
    }
    
    if (parts1[1] !== parts2[1]) {
      return {
        hasConflict: true,
        description: `Minor version mismatch: ${v1} vs ${v2}`
      };
    }
    
    return { hasConflict: false };
  }

  isVersionCompatible(version, constraint) {
    // Simplified semver checking
    if (constraint.startsWith('^')) {
      // Compatible with same major version
      const constraintMajor = constraint.slice(1).split('.')[0];
      const versionMajor = version.split('.')[0];
      return constraintMajor === versionMajor;
    }
    
    if (constraint.startsWith('~')) {
      // Compatible with same minor version
      const constraintParts = constraint.slice(1).split('.');
      const versionParts = version.split('.');
      return constraintParts[0] === versionParts[0] && 
             constraintParts[1] === versionParts[1];
    }
    
    // Exact match
    return version === constraint;
  }

  areLicensesCompatible(license1, license2) {
    const compatibilityMatrix = {
      'MIT': ['MIT', 'BSD', 'ISC', 'Apache-2.0'],
      'Apache-2.0': ['MIT', 'BSD', 'ISC', 'Apache-2.0'],
      'GPL-3.0': ['GPL-3.0', 'AGPL-3.0'],
      'BSD': ['MIT', 'BSD', 'ISC', 'Apache-2.0'],
      'ISC': ['MIT', 'BSD', 'ISC', 'Apache-2.0']
    };
    
    const compatible1 = compatibilityMatrix[license1] || [license1];
    return compatible1.includes(license2);
  }

  async getKnownConflicts(packageName, version) {
    await this.taskManager.ensureConnection();
    
    // Check conflict database
    const conflicts = await this.redis.hGet(`known_conflicts:${packageName}`, version);
    return conflicts ? JSON.parse(conflicts) : [];
  }

  async getVulnerabilities(packageName, version) {
    await this.taskManager.ensureConnection();
    
    // Check vulnerability database
    const vulns = await this.redis.hGet(`vulnerabilities:${packageName}`, version);
    return vulns ? JSON.parse(vulns) : [];
  }

  async getProjectLicense(projectId) {
    const project = await this.redis.hGet(`project:${projectId}`, 'license');
    return project || 'MIT';
  }

  async getProjectPlatform(projectId) {
    const project = await this.redis.hGet(`project:${projectId}`, 'platform');
    return project || 'node';
  }

  async getProjectNodeVersion(projectId) {
    const project = await this.redis.hGet(`project:${projectId}`, 'nodeVersion');
    return project || process.version;
  }

  async findSimilarPackages(dependency) {
    // Placeholder for finding similar packages
    // Would typically query a package registry or database
    return [];
  }

  async storeCompatibilityCheck(checkId, report) {
    await this.redis.hSet(`compat_check:${checkId}`, {
      id: checkId,
      projectId: report.projectId,
      dependency: JSON.stringify(report.dependency),
      status: report.status,
      score: report.score,
      report: JSON.stringify(report),
      createdAt: new Date().toISOString()
    });
    
    // Index by project
    await this.redis.lPush(`project:${report.projectId}:compat_checks`, checkId);
    
    // Store in documentation system
    await this.documentation.documentCompatibility(
      report.projectId,
      report.dependency,
      report
    );
    
    return checkId;
  }

  // Upgrade Path Analysis
  async analyzeUpgradePath(projectId, dependencies) {
    await this.taskManager.ensureConnection();
    const analysisId = uuidv4();
    
    const upgradePlan = {
      id: analysisId,
      projectId,
      dependencies: [],
      totalEffort: 0,
      riskLevel: 'low',
      steps: []
    };
    
    for (const dep of dependencies) {
      const currentVersion = dep.currentVersion;
      const targetVersion = dep.targetVersion;
      
      // Analyze breaking changes
      const breakingChanges = await this.getBreakingChanges(
        dep.name,
        currentVersion,
        targetVersion
      );
      
      // Estimate effort
      const effort = this.estimateUpgradeEffort(breakingChanges);
      
      upgradePlan.dependencies.push({
        name: dep.name,
        from: currentVersion,
        to: targetVersion,
        breakingChanges,
        effort,
        automated: breakingChanges.length === 0
      });
      
      upgradePlan.totalEffort += effort;
    }
    
    // Generate upgrade steps
    upgradePlan.steps = this.generateUpgradeSteps(upgradePlan.dependencies);
    upgradePlan.riskLevel = this.calculateUpgradeRisk(upgradePlan);
    
    // Store upgrade plan
    await this.redis.hSet(`upgrade_plan:${analysisId}`, {
      id: analysisId,
      projectId,
      plan: JSON.stringify(upgradePlan),
      createdAt: new Date().toISOString()
    });
    
    return upgradePlan;
  }

  async getBreakingChanges(packageName, fromVersion, toVersion) {
    // Check breaking changes database
    const key = `breaking_changes:${packageName}:${fromVersion}:${toVersion}`;
    const changes = await this.redis.hGet('breaking_changes_db', key);
    return changes ? JSON.parse(changes) : [];
  }

  estimateUpgradeEffort(breakingChanges) {
    let effort = 0;
    
    for (const change of breakingChanges) {
      switch (change.severity) {
        case 'major':
          effort += 8;
          break;
        case 'minor':
          effort += 3;
          break;
        case 'patch':
          effort += 1;
          break;
      }
    }
    
    return effort;
  }

  generateUpgradeSteps(dependencies) {
    const steps = [];
    
    // Sort dependencies by risk and effort
    const sorted = [...dependencies].sort((a, b) => {
      // Upgrade low-risk dependencies first
      if (a.automated && !b.automated) return -1;
      if (!a.automated && b.automated) return 1;
      return a.effort - b.effort;
    });
    
    for (const dep of sorted) {
      steps.push({
        order: steps.length + 1,
        action: `Upgrade ${dep.name} from ${dep.from} to ${dep.to}`,
        automated: dep.automated,
        effort: dep.effort,
        commands: [
          `npm update ${dep.name}@${dep.to}`,
          'npm test',
          'npm run lint'
        ],
        validation: [
          'Run unit tests',
          'Check integration tests',
          'Verify functionality'
        ]
      });
    }
    
    return steps;
  }

  calculateUpgradeRisk(upgradePlan) {
    const totalBreakingChanges = upgradePlan.dependencies.reduce(
      (sum, dep) => sum + dep.breakingChanges.length,
      0
    );
    
    if (totalBreakingChanges === 0) return 'low';
    if (totalBreakingChanges <= 5) return 'medium';
    if (totalBreakingChanges <= 10) return 'high';
    return 'critical';
  }
}