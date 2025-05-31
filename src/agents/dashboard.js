export class ProjectManagerDashboard {
  constructor(taskManager) {
    this.taskManager = taskManager;
  }

  async getWorkflowStatus() {
    const status = {
      thinking_agents: {},
      execution_agents: {},
      deliverable_pipeline: {},
      bottlenecks: []
    };

    // Check thinking LLM queues
    for (const agent of ['cto', 'engineering_manager', 'product_manager', 'business_analyst', 'solution_architect', 'technical_writer']) {
      const queueLength = await this.taskManager.redis.lLen(`queue:thinking:${agent}`);
      const tracking = await this.taskManager.redis.hGetAll(`deliverable_tracking:${agent}`);
      status.thinking_agents[agent] = { queueLength, tracking };
    }

    // Check fast execution queues  
    for (const agent of ['backend_dev', 'frontend_dev', 'qa_engineer', 'devops', 'security', 'ux_designer']) {
      const queueLength = await this.taskManager.redis.lLen(`queue:fast:${agent}`);
      const tracking = await this.taskManager.redis.hGetAll(`deliverable_tracking:${agent}`);
      status.execution_agents[agent] = { queueLength, tracking };
    }

    return status;
  }

  async getDeliverableStatus() {
    const deliverables = {};
    const keys = await this.taskManager.redis.keys('*deliverable_tracking*');
    
    for (const key of keys) {
      const data = await this.taskManager.redis.hGetAll(key);
      deliverables[key] = data;
    }
    
    return deliverables;
  }
}
