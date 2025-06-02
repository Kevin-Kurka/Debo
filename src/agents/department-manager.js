/**
 * Department Manager
 * 
 * Manages a specific department's agents and coordinates their work
 * Implements Redis-based state management and LangGraph-style workflows
 */

import { EnhancedAgentExecutor } from './enhanced-executor.js';
import { fortune500Agents } from './fortune500-roles.js';
import logger from '../logger.js';
import { v4 as uuidv4 } from 'uuid';

export class DepartmentManager {
  constructor(departmentName, agentRoles, taskManager, llmProvider) {
    this.departmentName = departmentName;
    this.agentRoles = agentRoles;
    this.taskManager = taskManager;
    this.llmProvider = llmProvider;
    this.redis = taskManager.redis;
    
    // Initialize agent executor for this department
    this.agentExecutor = new EnhancedAgentExecutor(taskManager);
    
    // Department state management
    this.departmentId = `dept_${departmentName}_${uuidv4()}`;
    this.activeAgents = new Map();
    this.taskQueue = [];
    this.workflowState = new Map();
  }

  async init() {
    await this.agentExecutor.init();
    
    // Initialize department in Redis
    await this.redis.hSet(`department:${this.departmentId}`, {
      name: this.departmentName,
      status: 'active',
      agentCount: this.agentRoles.length,
      createdAt: new Date().toISOString()
    });
    
    logger.info(`Department Manager initialized: ${this.departmentName}`);
  }

  /**
   * Execute tasks within the department
   */
  async executeTasks(tasks) {
    const results = [];
    const departmentSession = uuidv4();
    
    // Create department workflow state
    await this.initializeWorkflowState(departmentSession, tasks);
    
    try {
      // Group tasks by dependency level
      const taskLevels = this.groupTasksByDependency(tasks);
      
      // Execute each level in sequence, tasks within level in parallel
      for (const level of taskLevels) {
        const levelResults = await this.executeLevelTasks(level, departmentSession);
        results.push(...levelResults);
        
        // Update workflow state
        await this.updateWorkflowState(departmentSession, level, levelResults);
      }
      
      // Department head review if needed
      if (this.requiresReview(results)) {
        const review = await this.departmentHeadReview(tasks, results, departmentSession);
        results.push(review);
      }
      
      return results;
      
    } catch (error) {
      logger.error(`Department execution failed: ${error.message}`);
      await this.handleDepartmentError(departmentSession, error);
      throw error;
    }
  }

  /**
   * Initialize workflow state in Redis
   */
  async initializeWorkflowState(sessionId, tasks) {
    const workflowState = {
      sessionId,
      department: this.departmentName,
      totalTasks: tasks.length,
      completedTasks: 0,
      status: 'in_progress',
      startTime: Date.now(),
      tasks: tasks.map(t => ({
        id: t.id,
        agent: t.agent,
        action: t.action,
        status: 'pending'
      }))
    };
    
    await this.redis.hSet(`workflow:${sessionId}`, {
      state: JSON.stringify(workflowState),
      department: this.departmentName,
      timestamp: new Date().toISOString()
    });
    
    this.workflowState.set(sessionId, workflowState);
  }

  /**
   * Group tasks by dependency level for parallel execution
   */
  groupTasksByDependency(tasks) {
    const levels = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const completed = new Set();
    
    while (completed.size < tasks.length) {
      const currentLevel = [];
      
      for (const task of tasks) {
        if (completed.has(task.id)) continue;
        
        // Check if all dependencies are completed
        const deps = task.dependencies || [];
        if (deps.every(dep => completed.has(dep))) {
          currentLevel.push(task);
          completed.add(task.id);
        }
      }
      
      if (currentLevel.length > 0) {
        levels.push(currentLevel);
      } else if (completed.size < tasks.length) {
        // Circular dependency or missing dependency
        logger.warn('Circular or missing dependencies detected');
        // Add remaining tasks as final level
        const remaining = tasks.filter(t => !completed.has(t.id));
        levels.push(remaining);
        break;
      }
    }
    
    return levels;
  }

  /**
   * Execute tasks at the same dependency level in parallel
   */
  async executeLevelTasks(levelTasks, sessionId) {
    const promises = levelTasks.map(task => 
      this.executeAgentTask(task, sessionId)
    );
    
    return await Promise.all(promises);
  }

  /**
   * Execute a single agent task
   */
  async executeAgentTask(task, sessionId) {
    const { id, agent, action, data = {} } = task;
    
    logger.info(`${this.departmentName}: Agent ${agent} executing ${action}`);
    
    try {
      // Get agent configuration
      const agentConfig = fortune500Agents[agent];
      if (!agentConfig) {
        throw new Error(`Unknown agent: ${agent}`);
      }
      
      // Create agent context with department info
      const agentContext = {
        ...data,
        department: this.departmentName,
        sessionId,
        taskId: id,
        agentRole: agent,
        deliverables: agentConfig.deliverables
      };
      
      // Execute through agent executor
      const result = await this.agentExecutor.executeAgent(agent, {
        id,
        action,
        data: agentContext,
        metadata: {
          department: this.departmentName,
          sessionId,
          llmType: agentConfig.llmType
        }
      });
      
      // Store agent output in Redis
      await this.storeAgentOutput(id, agent, result);
      
      return {
        taskId: id,
        agent,
        action,
        status: 'completed',
        output: result.output,
        deliverable: result.deliverable || action,
        outputType: this.determineOutputType(action, agent)
      };
      
    } catch (error) {
      logger.error(`Agent task failed: ${agent} - ${error.message}`);
      
      return {
        taskId: id,
        agent,
        action,
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Store agent output in Redis with proper structure
   */
  async storeAgentOutput(taskId, agent, result) {
    const outputKey = `agent_output:${taskId}`;
    
    await this.redis.hSet(outputKey, {
      agent,
      department: this.departmentName,
      timestamp: new Date().toISOString(),
      output: JSON.stringify(result.output || {}),
      metadata: JSON.stringify(result.metadata || {})
    });
    
    // Set expiration (7 days)
    await this.redis.expire(outputKey, 604800);
    
    // Update task status
    await this.taskManager.updateTaskStatus(taskId, 'completed', {
      completedBy: agent,
      completedAt: new Date().toISOString(),
      outputKey
    });
  }

  /**
   * Update workflow state after level completion
   */
  async updateWorkflowState(sessionId, completedTasks, results) {
    const state = this.workflowState.get(sessionId);
    if (!state) return;
    
    // Update task statuses
    for (const result of results) {
      const task = state.tasks.find(t => t.id === result.taskId);
      if (task) {
        task.status = result.status;
        task.completedAt = new Date().toISOString();
        if (result.error) {
          task.error = result.error;
        }
      }
    }
    
    state.completedTasks += results.filter(r => r.status === 'completed').length;
    
    // Check if workflow is complete
    if (state.completedTasks === state.totalTasks) {
      state.status = 'completed';
      state.endTime = Date.now();
      state.duration = state.endTime - state.startTime;
    }
    
    // Update in Redis
    await this.redis.hSet(`workflow:${sessionId}`, {
      state: JSON.stringify(state),
      lastUpdate: new Date().toISOString()
    });
  }

  /**
   * Determine if department head review is needed
   */
  requiresReview(results) {
    // Review needed if:
    // 1. Any tasks failed
    // 2. High-value deliverables produced
    // 3. Cross-department dependencies identified
    
    const hasFailures = results.some(r => r.status === 'failed');
    const hasHighValue = results.some(r => 
      ['strategic_plan', 'financial_model', 'legal_opinion', 'architecture_design']
        .includes(r.deliverable)
    );
    
    return hasFailures || hasHighValue;
  }

  /**
   * Department head reviews and approves work
   */
  async departmentHeadReview(tasks, results, sessionId) {
    const headRole = this.getDepartmentHead();
    if (!headRole) return null;
    
    const reviewPrompt = `As ${headRole.title}, review the work completed by your department:

Tasks Completed:
${results.map(r => `- ${r.agent}: ${r.action} (${r.status})`).join('\n')}

Key Deliverables:
${results.filter(r => r.output).map(r => `- ${r.deliverable}`).join('\n')}

Provide your assessment and any additional guidance needed.`;

    const review = await this.llmProvider.generateResponse(
      headRole.systemPrompt,
      reviewPrompt,
      { temperature: 0.2, model: headRole.llmType }
    );

    return {
      taskId: `review_${sessionId}`,
      agent: this.getDepartmentHeadName(),
      action: 'department_review',
      status: 'completed',
      output: review,
      deliverable: 'department_approval',
      outputType: 'review'
    };
  }

  /**
   * Get department head configuration
   */
  getDepartmentHead() {
    const headRoles = {
      engineering: 'vp_engineering',
      product: 'vp_product',
      sales: 'vp_sales',
      marketing: 'vp_marketing',
      finance: 'vp_finance',
      legal: 'general_counsel',
      hr: 'vp_hr',
      operations: 'vp_operations',
      data: 'chief_data_officer',
      it: 'cio'
    };
    
    const headName = headRoles[this.departmentName];
    return headName ? fortune500Agents[headName] : null;
  }

  getDepartmentHeadName() {
    const headRoles = {
      engineering: 'vp_engineering',
      product: 'vp_product',
      sales: 'vp_sales',
      marketing: 'vp_marketing',
      finance: 'vp_finance',
      legal: 'general_counsel',
      hr: 'vp_hr',
      operations: 'vp_operations',
      data: 'chief_data_officer',
      it: 'cio'
    };
    
    return headRoles[this.departmentName] || 'department_head';
  }

  /**
   * Determine output type based on action and agent
   */
  determineOutputType(action, agent) {
    const actionTypes = {
      // Engineering
      'implement_api': 'code',
      'build_ui': 'code',
      'create_mobile_app': 'code',
      'design_architecture': 'architecture',
      'deploy_application': 'deployment',
      
      // Product
      'define_requirements': 'requirements',
      'document_specifications': 'documentation',
      'design_mockups': 'design',
      
      // Marketing
      'campaign_strategy': 'strategy',
      'content_planning': 'content',
      'seo_optimization': 'optimization',
      
      // Finance
      'financial_analysis': 'analysis',
      'revenue_projections': 'projections',
      'budget_planning': 'budget',
      
      // Legal
      'legal_review': 'legal_opinion',
      'contract_review': 'contract',
      'compliance_audit': 'compliance',
      
      // Data
      'analyze_market_data': 'analysis',
      'performance_analysis': 'metrics',
      'ml_model': 'model'
    };
    
    return actionTypes[action] || 'general';
  }

  /**
   * Handle department-level errors
   */
  async handleDepartmentError(sessionId, error) {
    await this.redis.hSet(`workflow:${sessionId}`, {
      status: 'failed',
      error: error.message,
      failedAt: new Date().toISOString()
    });
    
    // Notify department head
    const errorReport = {
      department: this.departmentName,
      sessionId,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    await this.redis.lPush(
      `department_errors:${this.departmentName}`,
      JSON.stringify(errorReport)
    );
  }

  /**
   * Get department metrics
   */
  async getDepartmentMetrics() {
    const metrics = {
      department: this.departmentName,
      totalAgents: this.agentRoles.length,
      activeWorkflows: this.workflowState.size,
      tasksCompleted: 0,
      tasksFailed: 0,
      averageTaskDuration: 0
    };
    
    // Aggregate from recent workflows
    const recentWorkflows = await this.redis.keys(`workflow:*`);
    let totalDuration = 0;
    let workflowCount = 0;
    
    for (const key of recentWorkflows) {
      const data = await this.redis.hGet(key, 'state');
      if (!data) continue;
      
      const state = JSON.parse(data);
      if (state.department === this.departmentName) {
        metrics.tasksCompleted += state.completedTasks || 0;
        if (state.duration) {
          totalDuration += state.duration;
          workflowCount++;
        }
      }
    }
    
    if (workflowCount > 0) {
      metrics.averageTaskDuration = totalDuration / workflowCount;
    }
    
    return metrics;
  }

  /**
   * Cleanup department resources
   */
  async cleanup() {
    logger.info(`Cleaning up department: ${this.departmentName}`);
    
    // Clear workflow states
    this.workflowState.clear();
    
    // Update department status
    await this.redis.hSet(`department:${this.departmentId}`, {
      status: 'inactive',
      closedAt: new Date().toISOString()
    });
  }
}

export default DepartmentManager;