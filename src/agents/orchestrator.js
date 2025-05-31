import { agentConfig } from './roles.js';
import { ToolManager } from '../tools/manager.js';
import { BrowserAutomation } from '../tools/browser.js';
import { RAGSystem } from '../tools/rag.js';
import { v4 as uuidv4 } from 'uuid';

export class EnhancedOrchestrator {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.toolManager = new ToolManager(taskManager);
    this.browserAutomation = new BrowserAutomation();
    this.ragSystem = new RAGSystem();
  }

  async init() {
    await this.toolManager.init();
    await this.browserAutomation.init();
  }

  async processUserRequest(request) {
    const ctoTaskId = await this.createAgentTask('cto', 'analyze_request', { request });
    return ctoTaskId;
  }

  async createAgentTask(agentType, action, data) {
    const taskId = uuidv4();
    const config = agentConfig[agentType];
    const tools = this.toolManager.getAgentTools(agentType);
    
    await this.taskManager.redis.hSet(`agent_task:${taskId}`, {
      id: taskId,
      agentType,
      action,
      data: JSON.stringify(data),
      llmType: config.llmType,
      instructions: config.instructions,
      availableTools: JSON.stringify(tools),
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    return taskId;
  }

  async handleToolRequest(agentType, toolName, justification) {
    // CTO evaluates and approves tool installations
    if (agentType === 'frontend_dev' && toolName === 'browser_testing') {
      return await this.toolManager.installTool('playwright', 'npm');
    }
    return false;
  }

  async executeBrowserTest(url, testSteps) {
    const pageId = await this.browserAutomation.launchSite(url);
    const results = [];
    
    for (const step of testSteps) {
      const result = await this.browserAutomation.interactWithElement(
        pageId, step.selector, step.action, step.value
      );
      results.push(result);
    }
    
    return results;
  }

  async searchProjectKnowledge(query, agentType) {
    if (agentType === 'business_analyst') {
      return await this.ragSystem.searchDocuments(query);
    } else if (['backend_dev', 'frontend_dev'].includes(agentType)) {
      return await this.ragSystem.searchCode(query);
    }
  }
}
  async handleDependencyRequest(packageName, version, projectId, agentType) {
    const triggers = new DependencyTriggers(this.taskManager);
    return await triggers.onPackageInstallRequest(packageName, version, projectId, agentType);
  }

  async searchDocumentation(query, packageName = null) {
    if (packageName) {
      // Search specific package documentation
      const docs = await this.taskManager.redis.hGetAll(`doc:${packageName}:*`);
      return this.ragSystem.searchDocuments(query, { package: packageName });
    }
    return this.ragSystem.searchDocuments(query);
  }

  async getCompatibilityReport(projectId) {
    const dependencies = await this.taskManager.redis.sMembers(`project:${projectId}:dependencies`);
    const report = { compatible: [], conflicts: [], deprecated: [] };
    
    for (const dep of dependencies) {
      const [name, version] = dep.split(':');
      const compat = await this.taskManager.redis.hGetAll(`compat:${projectId}:${name}`);
      const deprecation = await this.taskManager.redis.hGetAll(`deprecation:${name}`);
      
      if (compat.status === 'conflicts') report.conflicts.push(compat);
      else report.compatible.push(compat);
      
      if (deprecation.deprecatedSince) report.deprecated.push(deprecation);
    }
    
    return report;
  }
}
