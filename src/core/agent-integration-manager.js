import { DynamicAgentFactory } from './dynamic-agent-factory.js';
import { MemorySummarizer } from '../database/memory-summarizer.js';
import { DiffLogger } from '../database/diff-logger.js';
import { agentConfig } from '../agents/roles.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class AgentIntegrationManager {
  constructor(taskManager, llmProvider, orchestrator) {
    this.taskManager = taskManager;
    this.llmProvider = llmProvider;
    this.orchestrator = orchestrator;
    
    // Initialize sub-managers
    this.agentFactory = new DynamicAgentFactory(taskManager, null);
    this.memorySummarizer = new MemorySummarizer(taskManager, llmProvider);
    this.diffLogger = new DiffLogger(taskManager, llmProvider);
    
    // Agent lifecycle tracking
    this.activeAgents = new Map();
    this.agentPerformance = new Map();
    this.agentDependencies = new Map();
    this.agentVersions = new Map();
    
    // Integration state
    this.integrationRules = new Map();
    this.communicationChannels = new Map();
    this.resourcePools = new Map();
    
    this.config = {
      maxConcurrentAgents: 50,
      healthCheckInterval: 30000, // 30 seconds
      performanceWindow: 3600000, // 1 hour
      autoScaleThreshold: 0.8,
      retentionDays: 30
    };
  }

  async init() {
    // Initialize sub-managers
    await this.agentFactory.init();
    await this.memorySummarizer.init();
    await this.diffLogger.init();
    
    // Load existing agents and configurations
    await this.loadActiveAgents();
    await this.loadIntegrationRules();
    await this.loadPerformanceMetrics();
    
    // Start monitoring
    this.startHealthMonitoring();
    
    logger.info('Agent Integration Manager initialized');
  }

  /**
   * Register a new agent with the system
   */
  async registerAgent(agentConfig, options = {}) {
    try {
      const agentId = uuidv4();
      const timestamp = new Date().toISOString();
      
      // Validate agent configuration
      const validationResult = await this.validateAgentIntegration(agentConfig);
      if (!validationResult.valid) {
        throw new Error(`Agent validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Check resource availability
      await this.checkResourceAvailability(agentConfig);
      
      // Create agent instance
      const agentInstance = {
        id: agentId,
        config: agentConfig,
        status: 'initializing',
        created: timestamp,
        lastActive: timestamp,
        metrics: {
          tasksCompleted: 0,
          tasksSuccessful: 0,
          tasksFailed: 0,
          averageExecutionTime: 0,
          totalExecutionTime: 0,
          memoryUsage: 0,
          resourceScore: 1.0
        },
        dependencies: await this.resolveDependencies(agentConfig),
        version: agentConfig.version || '1.0.0'
      };
      
      // Register with orchestrator
      await this.orchestrator.registerDynamicAgent(agentId, agentConfig);
      
      // Store agent instance
      this.activeAgents.set(agentId, agentInstance);
      await this.persistAgentState(agentId, agentInstance);
      
      // Log creation
      await this.diffLogger.logChange('agent', agentId, agentInstance, {
        operation: 'create',
        user: options.user || 'system',
        reason: 'Agent registration'
      });
      
      // Set up monitoring
      await this.setupAgentMonitoring(agentId);
      
      // Update status
      agentInstance.status = 'active';
      await this.updateAgentStatus(agentId, 'active');
      
      logger.info(`Agent registered successfully: ${agentConfig.name} (${agentId})`);
      
      return {
        agentId,
        status: 'registered',
        capabilities: agentInstance.dependencies.capabilities,
        resourcesAllocated: await this.getAgentResources(agentId)
      };
      
    } catch (error) {
      logger.error('Failed to register agent:', error);
      throw error;
    }
  }

  /**
   * Unregister an agent from the system
   */
  async unregisterAgent(agentId, options = {}) {
    try {
      const agent = this.activeAgents.get(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }
      
      // Check for active tasks
      const activeTasks = await this.getAgentActiveTasks(agentId);
      if (activeTasks.length > 0 && !options.force) {
        throw new Error(`Agent has ${activeTasks.length} active tasks. Use force=true to override.`);
      }
      
      // Graceful shutdown
      await this.shutdownAgent(agentId, options.force);
      
      // Clean up dependencies
      await this.cleanupAgentDependencies(agentId);
      
      // Release resources
      await this.releaseAgentResources(agentId);
      
      // Log removal
      await this.diffLogger.logChange('agent', agentId, { status: 'removed' }, {
        operation: 'delete',
        user: options.user || 'system',
        reason: options.reason || 'Agent unregistration'
      });
      
      // Remove from active agents
      this.activeAgents.delete(agentId);
      await this.taskManager.del(`agent_state:${agentId}`);
      
      // Unregister from orchestrator
      await this.orchestrator.unregisterDynamicAgent(agentId);
      
      logger.info(`Agent unregistered: ${agentId}`);
      
      return { agentId, status: 'unregistered' };
      
    } catch (error) {
      logger.error('Failed to unregister agent:', error);
      throw error;
    }
  }

  /**
   * Update an existing agent
   */
  async updateAgent(agentId, updates, options = {}) {
    try {
      const agent = this.activeAgents.get(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }
      
      // Create new version
      const newVersion = this.incrementVersion(agent.version);
      const updatedConfig = { ...agent.config, ...updates, version: newVersion };
      
      // Validate updated configuration
      const validationResult = await this.validateAgentIntegration(updatedConfig);
      if (!validationResult.valid) {
        throw new Error(`Update validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Hot reload or restart based on changes
      const requiresRestart = this.analyzeUpdateImpact(agent.config, updates);
      
      if (requiresRestart) {
        await this.restartAgentWithUpdates(agentId, updatedConfig);
      } else {
        await this.hotReloadAgent(agentId, updates);
      }
      
      // Update agent instance
      const oldConfig = { ...agent.config };
      agent.config = updatedConfig;
      agent.version = newVersion;
      agent.updated = new Date().toISOString();
      
      // Log update
      await this.diffLogger.logChange('agent', agentId, updatedConfig, {
        operation: 'update',
        user: options.user || 'system',
        reason: options.reason || 'Agent configuration update',
        previousVersion: oldConfig.version
      });
      
      // Persist changes
      await this.persistAgentState(agentId, agent);
      
      logger.info(`Agent updated: ${agentId}`, { 
        version: newVersion,
        requiresRestart 
      });
      
      return {
        agentId,
        version: newVersion,
        status: 'updated',
        requiresRestart
      };
      
    } catch (error) {
      logger.error('Failed to update agent:', error);
      throw error;
    }
  }

  /**
   * Monitor agent performance and health
   */
  async monitorAgentHealth(agentId) {
    try {
      const agent = this.activeAgents.get(agentId);
      if (!agent) return null;
      
      const healthData = {
        agentId,
        timestamp: new Date().toISOString(),
        status: agent.status,
        metrics: { ...agent.metrics },
        resourceUsage: await this.getAgentResourceUsage(agentId),
        taskQueue: await this.getAgentTaskQueueSize(agentId),
        dependencies: await this.checkAgentDependencies(agentId)
      };
      
      // Calculate health score
      healthData.healthScore = this.calculateHealthScore(healthData);
      
      // Update performance tracking
      this.updatePerformanceMetrics(agentId, healthData);
      
      // Check for issues
      const issues = this.detectHealthIssues(healthData);
      if (issues.length > 0) {
        await this.handleHealthIssues(agentId, issues);
      }
      
      return healthData;
      
    } catch (error) {
      logger.error(`Health monitoring failed for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Handle agent communication and coordination
   */
  async facilitateAgentCommunication(sourceAgentId, targetAgentId, message, options = {}) {
    try {
      // Validate agents exist
      const sourceAgent = this.activeAgents.get(sourceAgentId);
      const targetAgent = this.activeAgents.get(targetAgentId);
      
      if (!sourceAgent || !targetAgent) {
        throw new Error('One or both agents not found');
      }
      
      // Check communication permissions
      await this.checkCommunicationPermissions(sourceAgentId, targetAgentId);
      
      // Create communication record
      const communicationId = uuidv4();
      const communication = {
        id: communicationId,
        source: sourceAgentId,
        target: targetAgentId,
        message,
        timestamp: new Date().toISOString(),
        type: options.type || 'message',
        priority: options.priority || 'normal',
        status: 'pending'
      };
      
      // Store communication
      await this.storeCommunication(communication);
      
      // Route message based on agent capabilities
      const result = await this.routeMessage(communication);
      
      // Update communication status
      communication.status = result.success ? 'delivered' : 'failed';
      communication.response = result.response;
      communication.deliveredAt = new Date().toISOString();
      
      await this.updateCommunication(communication);
      
      return {
        communicationId,
        status: communication.status,
        response: result.response
      };
      
    } catch (error) {
      logger.error('Agent communication failed:', error);
      throw error;
    }
  }

  /**
   * Scale agents based on workload
   */
  async autoScaleAgents() {
    try {
      const workloadMetrics = await this.analyzeSystemWorkload();
      const scaleDecisions = this.makeScaleDecisions(workloadMetrics);
      
      for (const decision of scaleDecisions) {
        if (decision.action === 'scale_up') {
          await this.scaleUpAgent(decision.agentType, decision.instances);
        } else if (decision.action === 'scale_down') {
          await this.scaleDownAgent(decision.agentType, decision.instances);
        }
      }
      
      return scaleDecisions;
      
    } catch (error) {
      logger.error('Auto-scaling failed:', error);
      return [];
    }
  }

  /**
   * Get comprehensive agent statistics
   */
  async getAgentStatistics(timeRange = null) {
    try {
      const stats = {
        totalAgents: this.activeAgents.size,
        agentsByStatus: {},
        agentsByType: {},
        performanceMetrics: {},
        resourceUtilization: {},
        communicationMetrics: {},
        timeRange: timeRange || { start: Date.now() - 86400000, end: Date.now() }
      };
      
      // Count agents by status and type
      for (const agent of this.activeAgents.values()) {
        const status = agent.status;
        const type = agent.config.llmType;
        
        stats.agentsByStatus[status] = (stats.agentsByStatus[status] || 0) + 1;
        stats.agentsByType[type] = (stats.agentsByType[type] || 0) + 1;
      }
      
      // Calculate performance metrics
      stats.performanceMetrics = await this.calculateSystemPerformanceMetrics(timeRange);
      
      // Calculate resource utilization
      stats.resourceUtilization = await this.calculateResourceUtilization();
      
      // Calculate communication metrics
      stats.communicationMetrics = await this.calculateCommunicationMetrics(timeRange);
      
      return stats;
      
    } catch (error) {
      logger.error('Failed to get agent statistics:', error);
      throw error;
    }
  }

  // Validation and dependency management
  async validateAgentIntegration(agentConfig) {
    const errors = [];
    
    // Check required fields
    if (!agentConfig.name) errors.push('Agent name is required');
    if (!agentConfig.llmType) errors.push('LLM type is required');
    if (!agentConfig.deliverables) errors.push('Deliverables specification is required');
    
    // Check naming conflicts
    const existingAgent = Array.from(this.activeAgents.values())
      .find(agent => agent.config.name === agentConfig.name);
    if (existingAgent) {
      errors.push(`Agent name '${agentConfig.name}' already exists`);
    }
    
    // Validate LLM type
    if (!['thinking', 'fast'].includes(agentConfig.llmType)) {
      errors.push('LLM type must be either "thinking" or "fast"');
    }
    
    // Check resource requirements
    if (agentConfig.resources) {
      const resourceCheck = await this.validateResourceRequirements(agentConfig.resources);
      if (!resourceCheck.valid) {
        errors.push(...resourceCheck.errors);
      }
    }
    
    // Check dependency compatibility
    if (agentConfig.dependencies) {
      const depCheck = await this.validateDependencies(agentConfig.dependencies);
      if (!depCheck.valid) {
        errors.push(...depCheck.errors);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async resolveDependencies(agentConfig) {
    const dependencies = {
      agents: [],
      services: [],
      resources: [],
      capabilities: agentConfig.capabilities || []
    };
    
    // Resolve agent dependencies
    if (agentConfig.dependencies) {
      for (const dep of agentConfig.dependencies) {
        if (dep.type === 'agent') {
          const depAgent = Array.from(this.activeAgents.values())
            .find(agent => agent.config.name === dep.name);
          if (depAgent) {
            dependencies.agents.push({
              agentId: depAgent.id,
              name: dep.name,
              relationship: dep.relationship || 'uses'
            });
          }
        }
      }
    }
    
    return dependencies;
  }

  async checkResourceAvailability(agentConfig) {
    const resources = agentConfig.resources || {};
    
    // Check memory limits
    if (resources.memory) {
      const availableMemory = await this.getAvailableMemory();
      const requiredMemory = this.parseMemorySize(resources.memory);
      
      if (requiredMemory > availableMemory) {
        throw new Error(`Insufficient memory: requires ${resources.memory}, available ${this.formatMemorySize(availableMemory)}`);
      }
    }
    
    // Check concurrency limits
    if (this.activeAgents.size >= this.config.maxConcurrentAgents) {
      throw new Error(`Maximum concurrent agents limit reached: ${this.config.maxConcurrentAgents}`);
    }
  }

  // Agent lifecycle management
  async shutdownAgent(agentId, force = false) {
    const agent = this.activeAgents.get(agentId);
    if (!agent) return;
    
    agent.status = 'shutting_down';
    await this.updateAgentStatus(agentId, 'shutting_down');
    
    if (!force) {
      // Wait for tasks to complete
      await this.waitForTaskCompletion(agentId, 30000); // 30 second timeout
    }
    
    // Clean up resources
    await this.cleanupAgentResources(agentId);
    
    agent.status = 'stopped';
    await this.updateAgentStatus(agentId, 'stopped');
  }

  async restartAgentWithUpdates(agentId, newConfig) {
    await this.shutdownAgent(agentId);
    
    const agent = this.activeAgents.get(agentId);
    agent.config = newConfig;
    agent.status = 'starting';
    
    await this.startAgent(agentId);
  }

  async hotReloadAgent(agentId, updates) {
    const agent = this.activeAgents.get(agentId);
    
    // Update configuration without restart
    Object.assign(agent.config, updates);
    agent.updated = new Date().toISOString();
    
    // Notify orchestrator of changes
    await this.orchestrator.updateDynamicAgent(agentId, agent.config);
  }

  // Performance and monitoring
  calculateHealthScore(healthData) {
    let score = 100;
    
    // Resource usage penalty
    if (healthData.resourceUsage.cpu > 80) score -= 20;
    if (healthData.resourceUsage.memory > 80) score -= 20;
    
    // Task queue penalty
    if (healthData.taskQueue > 100) score -= 15;
    
    // Failure rate penalty
    const failureRate = healthData.metrics.tasksFailed / Math.max(1, healthData.metrics.tasksCompleted);
    score -= failureRate * 30;
    
    // Dependency health
    const unhealthyDeps = healthData.dependencies.filter(dep => !dep.healthy).length;
    score -= unhealthyDeps * 10;
    
    return Math.max(0, score);
  }

  updatePerformanceMetrics(agentId, healthData) {
    if (!this.agentPerformance.has(agentId)) {
      this.agentPerformance.set(agentId, {
        healthHistory: [],
        performanceHistory: [],
        issues: []
      });
    }
    
    const metrics = this.agentPerformance.get(agentId);
    metrics.healthHistory.push({
      timestamp: healthData.timestamp,
      score: healthData.healthScore,
      resourceUsage: healthData.resourceUsage
    });
    
    // Keep only recent history
    const cutoff = Date.now() - this.config.performanceWindow;
    metrics.healthHistory = metrics.healthHistory.filter(
      h => new Date(h.timestamp).getTime() > cutoff
    );
  }

  // Communication and coordination
  async routeMessage(communication) {
    try {
      // Get target agent
      const targetAgent = this.activeAgents.get(communication.target);
      
      // Send message based on agent type
      if (targetAgent.config.capabilities?.includes('real_time_communication')) {
        return await this.sendRealTimeMessage(communication);
      } else {
        return await this.sendAsyncMessage(communication);
      }
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendRealTimeMessage(communication) {
    // Implementation for real-time messaging
    return { success: true, response: 'Message delivered' };
  }

  async sendAsyncMessage(communication) {
    // Queue message for later processing
    const queueKey = `agent_messages:${communication.target}`;
    await this.taskManager.lpush(queueKey, JSON.stringify(communication));
    return { success: true, response: 'Message queued' };
  }

  // Helper methods
  incrementVersion(version) {
    const parts = version.split('.');
    parts[2] = (parseInt(parts[2]) + 1).toString();
    return parts.join('.');
  }

  analyzeUpdateImpact(oldConfig, updates) {
    const criticalFields = ['llmType', 'deliverables', 'instructions'];
    return criticalFields.some(field => field in updates);
  }

  parseMemorySize(sizeStr) {
    const units = { 'KB': 1024, 'MB': 1024 * 1024, 'GB': 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+)([KMGT]?B)$/);
    if (match) {
      return parseInt(match[1]) * (units[match[2]] || 1);
    }
    return 0;
  }

  formatMemorySize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(size)}${units[unitIndex]}`;
  }

  // Persistence methods
  async persistAgentState(agentId, agentInstance) {
    const key = `agent_state:${agentId}`;
    await this.taskManager.setData(key, JSON.stringify(agentInstance));
  }

  async updateAgentStatus(agentId, status) {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastActive = new Date().toISOString();
      await this.persistAgentState(agentId, agent);
    }
  }

  // Initialization helpers
  async loadActiveAgents() {
    try {
      const agentKeys = await this.taskManager.keys('agent_state:*');
      for (const key of agentKeys) {
        const agentData = await this.taskManager.getData(key);
        if (agentData) {
          const agent = JSON.parse(agentData);
          this.activeAgents.set(agent.id, agent);
        }
      }
      logger.info(`Loaded ${this.activeAgents.size} active agents`);
    } catch (error) {
      logger.error('Failed to load active agents:', error);
    }
  }

  async loadIntegrationRules() {
    // Load integration rules from database
  }

  async loadPerformanceMetrics() {
    // Load historical performance metrics
  }

  startHealthMonitoring() {
    setInterval(async () => {
      for (const agentId of this.activeAgents.keys()) {
        await this.monitorAgentHealth(agentId);
      }
    }, this.config.healthCheckInterval);
  }

  // Placeholder methods for implementation
  async setupAgentMonitoring(agentId) { /* TODO */ }
  async getAgentResources(agentId) { return {}; }
  async getAgentActiveTasks(agentId) { return []; }
  async cleanupAgentDependencies(agentId) { /* TODO */ }
  async releaseAgentResources(agentId) { /* TODO */ }
  async getAgentResourceUsage(agentId) { return { cpu: 0, memory: 0 }; }
  async getAgentTaskQueueSize(agentId) { return 0; }
  async checkAgentDependencies(agentId) { return []; }
  async detectHealthIssues(healthData) { return []; }
  async handleHealthIssues(agentId, issues) { /* TODO */ }
  async checkCommunicationPermissions(sourceId, targetId) { return true; }
  async storeCommunication(communication) { /* TODO */ }
  async updateCommunication(communication) { /* TODO */ }
  async analyzeSystemWorkload() { return {}; }
  async makeScaleDecisions(workloadMetrics) { return []; }
  async scaleUpAgent(agentType, instances) { /* TODO */ }
  async scaleDownAgent(agentType, instances) { /* TODO */ }
  async calculateSystemPerformanceMetrics(timeRange) { return {}; }
  async calculateResourceUtilization() { return {}; }
  async calculateCommunicationMetrics(timeRange) { return {}; }
  async validateResourceRequirements(resources) { return { valid: true, errors: [] }; }
  async validateDependencies(dependencies) { return { valid: true, errors: [] }; }
  async getAvailableMemory() { return 1024 * 1024 * 1024; } // 1GB default
  async waitForTaskCompletion(agentId, timeout) { /* TODO */ }
  async cleanupAgentResources(agentId) { /* TODO */ }
  async startAgent(agentId) { /* TODO */ }

  /**
   * Cleanup resources
   */
  destroy() {
    this.agentFactory.destroy?.();
    this.memorySummarizer.destroy();
    this.diffLogger.destroy();
    
    this.activeAgents.clear();
    this.agentPerformance.clear();
    this.agentDependencies.clear();
  }
}