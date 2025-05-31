import { DependencyAnalyst } from './dependency-analyst.js';

export class DependencyTriggers {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.analyst = new DependencyAnalyst(taskManager);
    this.setupTriggers();
  }

  setupTriggers() {
    // Monitor package.json changes
    setInterval(() => this.checkPackageUpdates(), 10000);
    
    // Monitor npm install commands
    this.interceptNpmCommands();
  }

  async onPackageInstallRequest(packageName, version, projectId, requestingAgent) {
    // Automatic dependency review before installation
    const review = await this.analyst.reviewDependency(packageName, version, projectId);
    
    if (!review.approved) {
      // Reject and notify
      await this.taskManager.redis.hSet(`dependency_rejection:${projectId}:${packageName}`, {
        packageName, version, reason: review.reason, 
        requestingAgent, rejectedAt: new Date().toISOString()
      });
      
      // Create task for agent to find alternatives
      const taskId = await this.taskManager.createAgentTask(requestingAgent, 'find_dependency_alternative', {
        rejected: packageName, reason: review.reason, alternatives: review.alternatives
      });
      
      return { approved: false, taskId };
    }

    // Approved - proceed with installation
    await this.performSecureInstall(packageName, version, projectId);
    return { approved: true };
  }

  async performSecureInstall(packageName, version, projectId) {
    // Install with security audit
    await execAsync(`npm install ${packageName}@${version} --audit`);
    
    // Update project dependency tracking
    await this.taskManager.redis.sAdd(`project:${projectId}:dependencies`, `${packageName}:${version}`);
    
    // Trigger post-install compatibility check
    await this.runPostInstallChecks(packageName, version, projectId);
  }

  async runPostInstallChecks(packageName, version, projectId) {
    // Check for peer dependency warnings
    const { stdout } = await execAsync('npm ls --depth=0');
    const warnings = this.parsePeerDependencyWarnings(stdout);
    
    if (warnings.length > 0) {
      // Create task for dependency analyst to resolve
      await this.taskManager.createAgentTask('dependency_analyst', 'resolve_peer_dependencies', {
        package: packageName, warnings, projectId
      });
    }
  }

  parsePeerDependencyWarnings(npmOutput) {
    const warnings = [];
    const lines = npmOutput.split('\n');
    
    lines.forEach(line => {
      if (line.includes('WARN') && line.includes('peer dep')) {
        warnings.push(line.trim());
      }
    });
    
    return warnings;
  }

  interceptNpmCommands() {
    // Hook into npm install commands to trigger reviews
    // This would integrate with shell command monitoring
  }
}
