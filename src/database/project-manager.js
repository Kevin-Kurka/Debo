import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

export class ProjectManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
  }

  async init() {
    logger.info('Project Manager initialized');
  }

  async createProject(projectId, projectData) {
    const project = {
      id: projectId,
      name: projectData.name,
      requirements: projectData.requirements,
      stack: projectData.stack,
      status: 'active',
      createdAt: projectData.createdAt,
      phases: {
        planning: { status: 'active', startedAt: new Date().toISOString() },
        development: { status: 'pending' },
        testing: { status: 'pending' },
        deployment: { status: 'pending' }
      },
      metrics: {
        completionPercentage: 0,
        qualityScore: 100,
        testsPass: 0,
        testsTotal: 0,
        filesModified: 0
      }
    };

    // Store project data
    await this.taskManager.redis.hSet(`project:${projectId}`, project);
    
    // Add to all projects set
    await this.taskManager.redis.sAdd('all_projects', projectId);

    logger.info(`Created project: ${projectData.name} (${projectId})`);
    return project;
  }

  async updateProjectStatus(projectId, status) {
    const projectData = await this.getProject(projectId);
    if (projectData) {
      projectData.status = status;
      projectData.lastUpdated = new Date().toISOString();
      
      await this.taskManager.redis.hSet(`project:${projectId}`, {
        data: JSON.stringify(projectData),
        lastUpdated: projectData.lastUpdated
      });
    }
  }

  async updateProjectPhase(projectId, phase, phaseStatus) {
    const projectData = await this.getProject(projectId);
    if (projectData && projectData.phases[phase]) {
      projectData.phases[phase].status = phaseStatus;
      
      if (phaseStatus === 'active') {
        projectData.phases[phase].startedAt = new Date().toISOString();
      } else if (phaseStatus === 'completed') {
        projectData.phases[phase].completedAt = new Date().toISOString();
      }
      
      await this.taskManager.redis.hSet(`project:${projectId}`, {
        data: JSON.stringify(projectData),
        lastUpdated: new Date().toISOString()
      });
    }
  }

  async getProject(projectId) {
    const result = await this.taskManager.redis.hGet(`project:${projectId}`, 'data');
    return result ? JSON.parse(result) : null;
  }

  async getAllProjects() {
    const keys = await this.taskManager.redis.keys('project:*');
    const projects = [];

    for (const key of keys) {
      const projectData = await this.taskManager.redis.hGet(key, 'data');
      if (projectData) {
        projects.push(JSON.parse(projectData));
      }
    }

    return projects;
  }

  async updateProjectMetrics(projectId, metrics) {
    const projectData = await this.getProject(projectId);
    if (projectData) {
      projectData.metrics = { ...projectData.metrics, ...metrics };
      projectData.lastUpdated = new Date().toISOString();
      
      await this.taskManager.redis.hSet(`project:${projectId}`, {
        data: JSON.stringify(projectData),
        lastUpdated: projectData.lastUpdated
      });
    }
  }
}