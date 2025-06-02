const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

/**
 * LangGraph-style Workflow Engine for Business Processes
 * Manages complex workflows with state persistence, conditional branching,
 * parallel execution, and human-in-the-loop approvals
 */
class WorkflowEngine extends EventEmitter {
  constructor(taskManager) {
    super();
    this.taskManager = taskManager;
    this.workflows = new Map();
    this.activeExecutions = new Map();
  }

  /**
   * Define a new workflow graph
   * @param {Object} definition - Workflow definition
   * @param {string} definition.id - Unique workflow identifier
   * @param {string} definition.name - Human-readable name
   * @param {string} definition.description - Workflow description
   * @param {Array} definition.nodes - Workflow nodes
   * @param {Array} definition.edges - Connections between nodes
   * @param {Object} definition.initialState - Initial workflow state
   * @param {Object} definition.config - Workflow configuration
   */
  async defineWorkflow(definition) {
    const workflow = {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      nodes: new Map(),
      edges: new Map(),
      initialState: definition.initialState || {},
      config: definition.config || {},
      createdAt: new Date().toISOString(),
      version: definition.version || '1.0.0'
    };

    // Process nodes
    for (const node of definition.nodes) {
      workflow.nodes.set(node.id, {
        id: node.id,
        name: node.name,
        type: node.type, // 'task', 'decision', 'parallel', 'approval', 'checkpoint'
        handler: node.handler,
        config: node.config || {},
        retryPolicy: node.retryPolicy || { maxRetries: 3, backoffMs: 1000 }
      });
    }

    // Process edges
    for (const edge of definition.edges) {
      if (!workflow.edges.has(edge.from)) {
        workflow.edges.set(edge.from, []);
      }
      workflow.edges.get(edge.from).push({
        to: edge.to,
        condition: edge.condition, // Function to evaluate state
        priority: edge.priority || 0
      });
    }

    // Store workflow definition in Redis
    await this.taskManager.db.setex(
      `workflow:definition:${workflow.id}`,
      86400 * 30, // 30 days TTL
      JSON.stringify({
        ...workflow,
        nodes: Array.from(workflow.nodes.entries()),
        edges: Array.from(workflow.edges.entries())
      })
    );

    this.workflows.set(workflow.id, workflow);
    logger.info(`Workflow defined: ${workflow.name} (${workflow.id})`);
    
    return workflow;
  }

  /**
   * Start a new workflow execution
   * @param {string} workflowId - ID of the workflow to execute
   * @param {Object} initialData - Initial data for the workflow
   * @param {Object} options - Execution options
   */
  async startWorkflow(workflowId, initialData = {}, options = {}) {
    const workflow = await this.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const executionId = uuidv4();
    const execution = {
      id: executionId,
      workflowId: workflowId,
      workflowName: workflow.name,
      state: {
        ...workflow.initialState,
        ...initialData,
        _workflowMeta: {
          executionId,
          startedAt: new Date().toISOString(),
          currentNode: 'start',
          visitedNodes: [],
          checkpoints: [],
          approvals: {},
          errors: []
        }
      },
      status: 'running',
      options,
      createdAt: new Date().toISOString()
    };

    // Store execution state
    await this.saveExecutionState(execution);
    this.activeExecutions.set(executionId, execution);

    // Start execution from the first node
    const startNode = this.findStartNode(workflow);
    if (startNode) {
      await this.executeNode(execution, workflow, startNode);
    }

    this.emit('workflow:started', { executionId, workflowId, initialData });
    return execution;
  }

  /**
   * Execute a workflow node
   * @param {Object} execution - Current execution context
   * @param {Object} workflow - Workflow definition
   * @param {Object} node - Node to execute
   */
  async executeNode(execution, workflow, node) {
    const { state } = execution;
    state._workflowMeta.currentNode = node.id;
    state._workflowMeta.visitedNodes.push({
      nodeId: node.id,
      timestamp: new Date().toISOString()
    });

    logger.info(`Executing node: ${node.name} (${node.id}) in workflow ${execution.id}`);

    try {
      switch (node.type) {
        case 'task':
          await this.executeTaskNode(execution, workflow, node);
          break;
        case 'decision':
          await this.executeDecisionNode(execution, workflow, node);
          break;
        case 'parallel':
          await this.executeParallelNode(execution, workflow, node);
          break;
        case 'approval':
          await this.executeApprovalNode(execution, workflow, node);
          break;
        case 'checkpoint':
          await this.executeCheckpointNode(execution, workflow, node);
          break;
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }
    } catch (error) {
      await this.handleNodeError(execution, node, error);
    }
  }

  /**
   * Execute a task node
   */
  async executeTaskNode(execution, workflow, node) {
    const { state } = execution;
    
    // Create task for the agent system
    const task = await this.taskManager.createTask({
      type: node.config.taskType || 'generic',
      description: this.interpolateTemplate(node.config.description, state),
      priority: node.config.priority || 'medium',
      projectId: execution.workflowId,
      metadata: {
        workflowExecutionId: execution.id,
        nodeId: node.id,
        nodeName: node.name,
        ...node.config.metadata
      }
    });

    // If handler is specified, execute it
    if (node.handler) {
      const handler = this.resolveHandler(node.handler);
      const result = await handler(state, { task, node, workflow });
      
      // Update state with result
      if (result) {
        Object.assign(state, result);
      }
    }

    // Wait for task completion if synchronous
    if (!node.config.async) {
      await this.waitForTaskCompletion(task.id);
    }

    await this.saveExecutionState(execution);
    await this.moveToNextNode(execution, workflow, node);
  }

  /**
   * Execute a decision node (conditional branching)
   */
  async executeDecisionNode(execution, workflow, node) {
    const { state } = execution;
    const edges = workflow.edges.get(node.id) || [];
    
    // Sort edges by priority
    const sortedEdges = edges.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // Find the first edge whose condition is met
    for (const edge of sortedEdges) {
      if (!edge.condition || this.evaluateCondition(edge.condition, state)) {
        const nextNode = workflow.nodes.get(edge.to);
        if (nextNode) {
          await this.executeNode(execution, workflow, nextNode);
          return;
        }
      }
    }

    // No condition met - workflow might be complete
    await this.completeWorkflow(execution);
  }

  /**
   * Execute parallel nodes
   */
  async executeParallelNode(execution, workflow, node) {
    const { state } = execution;
    const edges = workflow.edges.get(node.id) || [];
    
    // Execute all outgoing edges in parallel
    const parallelPromises = edges.map(edge => {
      const nextNode = workflow.nodes.get(edge.to);
      if (nextNode) {
        // Create a sub-execution for each parallel branch
        const subExecution = {
          ...execution,
          id: `${execution.id}-${edge.to}`,
          state: { ...state } // Clone state for isolation
        };
        return this.executeNode(subExecution, workflow, nextNode);
      }
    });

    // Wait for all parallel executions to complete
    const results = await Promise.allSettled(parallelPromises);
    
    // Merge results back into main state
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        Object.assign(state, result.value);
      }
    }

    await this.saveExecutionState(execution);
    
    // Find convergence node if specified
    const convergenceNode = workflow.nodes.get(node.config.convergenceNode);
    if (convergenceNode) {
      await this.executeNode(execution, workflow, convergenceNode);
    }
  }

  /**
   * Execute approval node (human-in-the-loop)
   */
  async executeApprovalNode(execution, workflow, node) {
    const { state } = execution;
    const approvalId = uuidv4();
    
    const approval = {
      id: approvalId,
      nodeId: node.id,
      nodeName: node.name,
      executionId: execution.id,
      workflowId: workflow.id,
      requiredApprovers: node.config.approvers || [],
      approvalType: node.config.approvalType || 'any', // 'any', 'all', 'majority'
      deadline: node.config.deadline ? 
        new Date(Date.now() + node.config.deadline).toISOString() : null,
      status: 'pending',
      approvals: [],
      createdAt: new Date().toISOString()
    };

    // Store approval request
    await this.taskManager.db.setex(
      `workflow:approval:${approvalId}`,
      86400 * 7, // 7 days TTL
      JSON.stringify(approval)
    );

    state._workflowMeta.approvals[node.id] = approvalId;
    execution.status = 'waiting_approval';
    await this.saveExecutionState(execution);

    this.emit('approval:required', {
      executionId: execution.id,
      workflowId: workflow.id,
      approval
    });

    // For now, mark as paused - actual approval will resume execution
    logger.info(`Workflow ${execution.id} waiting for approval at node ${node.name}`);
  }

  /**
   * Execute checkpoint node
   */
  async executeCheckpointNode(execution, workflow, node) {
    const { state } = execution;
    
    const checkpoint = {
      id: uuidv4(),
      nodeId: node.id,
      nodeName: node.name,
      executionId: execution.id,
      state: JSON.parse(JSON.stringify(state)), // Deep clone
      timestamp: new Date().toISOString()
    };

    // Store checkpoint
    await this.taskManager.db.setex(
      `workflow:checkpoint:${checkpoint.id}`,
      86400 * 30, // 30 days TTL
      JSON.stringify(checkpoint)
    );

    state._workflowMeta.checkpoints.push({
      id: checkpoint.id,
      nodeId: node.id,
      timestamp: checkpoint.timestamp
    });

    await this.saveExecutionState(execution);
    await this.moveToNextNode(execution, workflow, node);
  }

  /**
   * Handle approval submission
   */
  async submitApproval(approvalId, approver, decision, comments = '') {
    const approvalData = await this.taskManager.db.get(`workflow:approval:${approvalId}`);
    if (!approvalData) {
      throw new Error(`Approval not found: ${approvalId}`);
    }

    const approval = JSON.parse(approvalData);
    if (approval.status !== 'pending') {
      throw new Error(`Approval already processed: ${approvalId}`);
    }

    // Record the approval
    approval.approvals.push({
      approver,
      decision,
      comments,
      timestamp: new Date().toISOString()
    });

    // Check if approval requirements are met
    const approved = this.checkApprovalRequirements(approval);
    approval.status = approved ? 'approved' : 'rejected';

    // Update approval record
    await this.taskManager.db.setex(
      `workflow:approval:${approvalId}`,
      86400 * 7,
      JSON.stringify(approval)
    );

    // Resume workflow execution if approved
    if (approved) {
      const execution = await this.loadExecution(approval.executionId);
      const workflow = await this.loadWorkflow(approval.workflowId);
      const node = workflow.nodes.get(approval.nodeId);
      
      execution.status = 'running';
      await this.saveExecutionState(execution);
      await this.moveToNextNode(execution, workflow, node);
    }

    this.emit('approval:submitted', { approvalId, approved, approver });
    return approval;
  }

  /**
   * Restore workflow from checkpoint
   */
  async restoreFromCheckpoint(checkpointId) {
    const checkpointData = await this.taskManager.db.get(`workflow:checkpoint:${checkpointId}`);
    if (!checkpointData) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const checkpoint = JSON.parse(checkpointData);
    const workflow = await this.loadWorkflow(checkpoint.state._workflowMeta.workflowId);
    
    // Create new execution from checkpoint
    const execution = {
      id: uuidv4(),
      workflowId: workflow.id,
      workflowName: workflow.name,
      state: checkpoint.state,
      status: 'running',
      restoredFrom: checkpointId,
      createdAt: new Date().toISOString()
    };

    execution.state._workflowMeta.executionId = execution.id;
    execution.state._workflowMeta.restoredAt = new Date().toISOString();

    await this.saveExecutionState(execution);
    this.activeExecutions.set(execution.id, execution);

    // Resume from the checkpoint node
    const node = workflow.nodes.get(checkpoint.nodeId);
    if (node) {
      await this.moveToNextNode(execution, workflow, node);
    }

    this.emit('workflow:restored', { executionId: execution.id, checkpointId });
    return execution;
  }

  /**
   * Move to next node(s) in the workflow
   */
  async moveToNextNode(execution, workflow, currentNode) {
    const edges = workflow.edges.get(currentNode.id) || [];
    
    if (edges.length === 0) {
      // No outgoing edges - workflow complete
      await this.completeWorkflow(execution);
      return;
    }

    // For non-decision nodes, execute the first valid edge
    const nextEdge = edges[0];
    const nextNode = workflow.nodes.get(nextEdge.to);
    
    if (nextNode) {
      await this.executeNode(execution, workflow, nextNode);
    }
  }

  /**
   * Complete workflow execution
   */
  async completeWorkflow(execution) {
    execution.status = 'completed';
    execution.state._workflowMeta.completedAt = new Date().toISOString();
    
    await this.saveExecutionState(execution);
    this.activeExecutions.delete(execution.id);
    
    this.emit('workflow:completed', {
      executionId: execution.id,
      workflowId: execution.workflowId,
      state: execution.state
    });
    
    logger.info(`Workflow completed: ${execution.id}`);
  }

  /**
   * Handle node execution errors
   */
  async handleNodeError(execution, node, error) {
    const { state } = execution;
    const errorInfo = {
      nodeId: node.id,
      nodeName: node.name,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      retryCount: (state._workflowMeta.retries?.[node.id] || 0)
    };

    state._workflowMeta.errors.push(errorInfo);
    
    // Check retry policy
    if (node.retryPolicy && errorInfo.retryCount < node.retryPolicy.maxRetries) {
      // Increment retry count
      if (!state._workflowMeta.retries) {
        state._workflowMeta.retries = {};
      }
      state._workflowMeta.retries[node.id] = errorInfo.retryCount + 1;
      
      // Wait before retry
      await new Promise(resolve => 
        setTimeout(resolve, node.retryPolicy.backoffMs * Math.pow(2, errorInfo.retryCount))
      );
      
      // Retry node execution
      await this.executeNode(execution, workflow, node);
    } else {
      // Max retries exceeded or no retry policy
      execution.status = 'failed';
      execution.state._workflowMeta.failedAt = new Date().toISOString();
      
      await this.saveExecutionState(execution);
      this.activeExecutions.delete(execution.id);
      
      this.emit('workflow:failed', {
        executionId: execution.id,
        workflowId: execution.workflowId,
        error: errorInfo
      });
      
      logger.error(`Workflow failed: ${execution.id}`, error);
    }
  }

  /**
   * Save execution state to Redis
   */
  async saveExecutionState(execution) {
    await this.taskManager.db.setex(
      `workflow:execution:${execution.id}`,
      86400 * 7, // 7 days TTL
      JSON.stringify(execution)
    );
  }

  /**
   * Load workflow definition
   */
  async loadWorkflow(workflowId) {
    // Check cache first
    if (this.workflows.has(workflowId)) {
      return this.workflows.get(workflowId);
    }

    // Load from Redis
    const data = await this.taskManager.db.get(`workflow:definition:${workflowId}`);
    if (!data) {
      return null;
    }

    const stored = JSON.parse(data);
    const workflow = {
      ...stored,
      nodes: new Map(stored.nodes),
      edges: new Map(stored.edges)
    };

    this.workflows.set(workflowId, workflow);
    return workflow;
  }

  /**
   * Load execution state
   */
  async loadExecution(executionId) {
    const data = await this.taskManager.db.get(`workflow:execution:${executionId}`);
    if (!data) {
      throw new Error(`Execution not found: ${executionId}`);
    }
    return JSON.parse(data);
  }

  /**
   * List active workflow executions
   */
  async listActiveExecutions(workflowId = null) {
    const keys = await this.taskManager.db.keys('workflow:execution:*');
    const executions = [];

    for (const key of keys) {
      const data = await this.taskManager.db.get(key);
      if (data) {
        const execution = JSON.parse(data);
        if (!workflowId || execution.workflowId === workflowId) {
          if (execution.status === 'running' || execution.status === 'waiting_approval') {
            executions.push(execution);
          }
        }
      }
    }

    return executions;
  }

  /**
   * Get workflow execution history
   */
  async getExecutionHistory(workflowId, limit = 10) {
    const keys = await this.taskManager.db.keys('workflow:execution:*');
    const executions = [];

    for (const key of keys) {
      const data = await this.taskManager.db.get(key);
      if (data) {
        const execution = JSON.parse(data);
        if (execution.workflowId === workflowId) {
          executions.push(execution);
        }
      }
    }

    // Sort by creation date and limit
    return executions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  /**
   * Helper: Find start node
   */
  findStartNode(workflow) {
    // Find nodes with no incoming edges
    const nodesWithIncoming = new Set();
    for (const edges of workflow.edges.values()) {
      for (const edge of edges) {
        nodesWithIncoming.add(edge.to);
      }
    }

    for (const [nodeId, node] of workflow.nodes) {
      if (!nodesWithIncoming.has(nodeId)) {
        return node;
      }
    }

    // If no clear start, return first node
    return workflow.nodes.values().next().value;
  }

  /**
   * Helper: Evaluate condition
   */
  evaluateCondition(condition, state) {
    if (typeof condition === 'function') {
      return condition(state);
    }
    
    // Support string-based conditions
    if (typeof condition === 'string') {
      try {
        // Simple expression evaluation (be careful with security!)
        return new Function('state', `return ${condition}`)(state);
      } catch (error) {
        logger.error('Error evaluating condition:', error);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Helper: Check approval requirements
   */
  checkApprovalRequirements(approval) {
    const approvedCount = approval.approvals.filter(a => a.decision === 'approve').length;
    const rejectedCount = approval.approvals.filter(a => a.decision === 'reject').length;
    const totalRequired = approval.requiredApprovers.length || 1;

    switch (approval.approvalType) {
      case 'all':
        return approvedCount === totalRequired && rejectedCount === 0;
      case 'majority':
        return approvedCount > totalRequired / 2;
      case 'any':
      default:
        return approvedCount > 0 && rejectedCount === 0;
    }
  }

  /**
   * Helper: Interpolate template strings
   */
  interpolateTemplate(template, state) {
    if (!template) return '';
    
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return state[key] || match;
    });
  }

  /**
   * Helper: Resolve handler function
   */
  resolveHandler(handler) {
    if (typeof handler === 'function') {
      return handler;
    }
    
    // Could extend to support string-based handler resolution
    return async () => {};
  }

  /**
   * Helper: Wait for task completion
   */
  async waitForTaskCompletion(taskId, timeoutMs = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const task = await this.taskManager.getTask(taskId);
      if (task && (task.status === 'completed' || task.status === 'failed')) {
        return task;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Task ${taskId} did not complete within timeout`);
  }

  /**
   * Create predefined business workflow templates
   */
  static createBusinessWorkflows() {
    return {
      // Financial Approval Workflow
      financialApproval: {
        id: 'financial-approval',
        name: 'Financial Approval Process',
        description: 'Multi-level approval for financial transactions',
        nodes: [
          {
            id: 'submit',
            name: 'Submit Request',
            type: 'task',
            config: {
              taskType: 'data_entry',
              description: 'Submit financial request for amount {{amount}}'
            }
          },
          {
            id: 'check-amount',
            name: 'Check Amount',
            type: 'decision',
            config: {}
          },
          {
            id: 'manager-approval',
            name: 'Manager Approval',
            type: 'approval',
            config: {
              approvers: ['manager'],
              approvalType: 'any',
              deadline: 86400000 // 24 hours
            }
          },
          {
            id: 'director-approval',
            name: 'Director Approval',
            type: 'approval',
            config: {
              approvers: ['director'],
              approvalType: 'any',
              deadline: 172800000 // 48 hours
            }
          },
          {
            id: 'cfo-approval',
            name: 'CFO Approval',
            type: 'approval',
            config: {
              approvers: ['cfo'],
              approvalType: 'any',
              deadline: 259200000 // 72 hours
            }
          },
          {
            id: 'process-payment',
            name: 'Process Payment',
            type: 'task',
            config: {
              taskType: 'payment_processing',
              description: 'Process approved payment of {{amount}}'
            }
          }
        ],
        edges: [
          { from: 'submit', to: 'check-amount' },
          { from: 'check-amount', to: 'manager-approval', condition: 'state.amount <= 10000' },
          { from: 'check-amount', to: 'director-approval', condition: 'state.amount > 10000 && state.amount <= 50000' },
          { from: 'check-amount', to: 'cfo-approval', condition: 'state.amount > 50000' },
          { from: 'manager-approval', to: 'process-payment' },
          { from: 'director-approval', to: 'process-payment' },
          { from: 'cfo-approval', to: 'process-payment' }
        ]
      },

      // Product Development Lifecycle
      productDevelopment: {
        id: 'product-development',
        name: 'Product Development Lifecycle',
        description: 'End-to-end product development process',
        nodes: [
          {
            id: 'ideation',
            name: 'Product Ideation',
            type: 'task',
            config: {
              taskType: 'brainstorming',
              description: 'Generate and refine product ideas'
            }
          },
          {
            id: 'market-research',
            name: 'Market Research',
            type: 'task',
            config: {
              taskType: 'research',
              description: 'Conduct market analysis and competitor research'
            }
          },
          {
            id: 'feasibility',
            name: 'Feasibility Study',
            type: 'parallel',
            config: {
              convergenceNode: 'review-board'
            }
          },
          {
            id: 'technical-feasibility',
            name: 'Technical Feasibility',
            type: 'task',
            config: {
              taskType: 'technical_analysis',
              description: 'Assess technical requirements and constraints'
            }
          },
          {
            id: 'financial-feasibility',
            name: 'Financial Feasibility',
            type: 'task',
            config: {
              taskType: 'financial_analysis',
              description: 'Analyze costs and revenue projections'
            }
          },
          {
            id: 'review-board',
            name: 'Review Board',
            type: 'approval',
            config: {
              approvers: ['product_manager', 'tech_lead', 'finance_lead'],
              approvalType: 'majority'
            }
          },
          {
            id: 'checkpoint-mvp',
            name: 'MVP Checkpoint',
            type: 'checkpoint',
            config: {}
          },
          {
            id: 'development',
            name: 'Product Development',
            type: 'task',
            config: {
              taskType: 'development',
              description: 'Build minimum viable product'
            }
          },
          {
            id: 'testing',
            name: 'Quality Assurance',
            type: 'task',
            config: {
              taskType: 'testing',
              description: 'Comprehensive testing and bug fixes'
            }
          },
          {
            id: 'launch-approval',
            name: 'Launch Approval',
            type: 'approval',
            config: {
              approvers: ['ceo', 'cto', 'cmo'],
              approvalType: 'all'
            }
          },
          {
            id: 'launch',
            name: 'Product Launch',
            type: 'task',
            config: {
              taskType: 'deployment',
              description: 'Deploy product to production'
            }
          }
        ],
        edges: [
          { from: 'ideation', to: 'market-research' },
          { from: 'market-research', to: 'feasibility' },
          { from: 'feasibility', to: 'technical-feasibility' },
          { from: 'feasibility', to: 'financial-feasibility' },
          { from: 'technical-feasibility', to: 'review-board' },
          { from: 'financial-feasibility', to: 'review-board' },
          { from: 'review-board', to: 'checkpoint-mvp' },
          { from: 'checkpoint-mvp', to: 'development' },
          { from: 'development', to: 'testing' },
          { from: 'testing', to: 'launch-approval' },
          { from: 'launch-approval', to: 'launch' }
        ]
      },

      // Hiring Process
      hiringProcess: {
        id: 'hiring-process',
        name: 'Employee Hiring Process',
        description: 'End-to-end hiring and onboarding workflow',
        nodes: [
          {
            id: 'job-posting',
            name: 'Create Job Posting',
            type: 'task',
            config: {
              taskType: 'content_creation',
              description: 'Create job description for {{position}}'
            }
          },
          {
            id: 'sourcing',
            name: 'Candidate Sourcing',
            type: 'task',
            config: {
              taskType: 'recruitment',
              description: 'Source and screen candidates'
            }
          },
          {
            id: 'initial-screening',
            name: 'Initial Screening',
            type: 'task',
            config: {
              taskType: 'screening',
              description: 'Phone/video screening of candidates'
            }
          },
          {
            id: 'technical-interview',
            name: 'Technical Interview',
            type: 'task',
            config: {
              taskType: 'interview',
              description: 'Technical assessment of candidate'
            }
          },
          {
            id: 'cultural-interview',
            name: 'Cultural Fit Interview',
            type: 'task',
            config: {
              taskType: 'interview',
              description: 'Assess cultural fit and soft skills'
            }
          },
          {
            id: 'reference-check',
            name: 'Reference Check',
            type: 'task',
            config: {
              taskType: 'verification',
              description: 'Verify references and background'
            }
          },
          {
            id: 'hiring-decision',
            name: 'Hiring Decision',
            type: 'approval',
            config: {
              approvers: ['hiring_manager', 'hr_manager'],
              approvalType: 'all'
            }
          },
          {
            id: 'offer-preparation',
            name: 'Prepare Offer',
            type: 'task',
            config: {
              taskType: 'documentation',
              description: 'Prepare employment offer'
            }
          },
          {
            id: 'offer-approval',
            name: 'Offer Approval',
            type: 'approval',
            config: {
              approvers: ['department_head', 'hr_director'],
              approvalType: 'all'
            }
          },
          {
            id: 'send-offer',
            name: 'Send Offer',
            type: 'task',
            config: {
              taskType: 'communication',
              description: 'Send offer to candidate'
            }
          },
          {
            id: 'onboarding',
            name: 'Employee Onboarding',
            type: 'task',
            config: {
              taskType: 'onboarding',
              description: 'Complete onboarding process'
            }
          }
        ],
        edges: [
          { from: 'job-posting', to: 'sourcing' },
          { from: 'sourcing', to: 'initial-screening' },
          { from: 'initial-screening', to: 'technical-interview' },
          { from: 'technical-interview', to: 'cultural-interview' },
          { from: 'cultural-interview', to: 'reference-check' },
          { from: 'reference-check', to: 'hiring-decision' },
          { from: 'hiring-decision', to: 'offer-preparation' },
          { from: 'offer-preparation', to: 'offer-approval' },
          { from: 'offer-approval', to: 'send-offer' },
          { from: 'send-offer', to: 'onboarding' }
        ]
      }
    };
  }
}

module.exports = WorkflowEngine;