import { WebSocketServer } from 'ws';
import logger from './logger.js';
import EventEmitter from 'events';

export class RealtimeProgressServer extends EventEmitter {
  constructor(server) {
    super();
    this.wss = new WebSocketServer({ server });
    this.clients = new Map();
    this.projectSubscriptions = new Map();
    
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      
      logger.info(`WebSocket client connected: ${clientId}`);
      
      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connection',
        clientId,
        timestamp: new Date().toISOString()
      }));
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(clientId, data);
        } catch (error) {
          logger.error('Invalid WebSocket message', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });
      
      ws.on('close', () => {
        this.handleClientDisconnect(clientId);
      });
      
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}`, error);
      });
    });
  }

  handleClientMessage(clientId, data) {
    const ws = this.clients.get(clientId);
    if (!ws) return;
    
    switch (data.type) {
      case 'subscribe':
        this.subscribeToProject(clientId, data.projectId);
        break;
        
      case 'unsubscribe':
        this.unsubscribeFromProject(clientId, data.projectId);
        break;
        
      case 'getStatus':
        this.sendProjectStatus(clientId, data.projectId);
        break;
        
      case 'getActiveTasks':
        this.sendActiveTasks(clientId, data.projectId);
        break;
        
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${data.type}`
        }));
    }
  }

  subscribeToProject(clientId, projectId) {
    if (!this.projectSubscriptions.has(projectId)) {
      this.projectSubscriptions.set(projectId, new Set());
    }
    
    this.projectSubscriptions.get(projectId).add(clientId);
    
    const ws = this.clients.get(clientId);
    ws.projectId = projectId;
    
    ws.send(JSON.stringify({
      type: 'subscribed',
      projectId,
      timestamp: new Date().toISOString()
    }));
    
    logger.info(`Client ${clientId} subscribed to project ${projectId}`);
  }

  unsubscribeFromProject(clientId, projectId) {
    if (this.projectSubscriptions.has(projectId)) {
      this.projectSubscriptions.get(projectId).delete(clientId);
    }
    
    const ws = this.clients.get(clientId);
    if (ws && ws.projectId === projectId) {
      delete ws.projectId;
    }
    
    ws.send(JSON.stringify({
      type: 'unsubscribed',
      projectId,
      timestamp: new Date().toISOString()
    }));
  }

  handleClientDisconnect(clientId) {
    // Remove from all project subscriptions
    for (const [projectId, subscribers] of this.projectSubscriptions) {
      subscribers.delete(clientId);
    }
    
    this.clients.delete(clientId);
    logger.info(`WebSocket client disconnected: ${clientId}`);
  }

  // Methods called by the orchestrator to broadcast updates
  broadcastTaskStart(projectId, task) {
    this.broadcast(projectId, {
      type: 'taskStart',
      projectId,
      task: {
        id: task.id,
        agentType: task.agentType,
        action: task.action,
        status: task.status,
        timestamp: new Date().toISOString()
      }
    });
  }

  broadcastTaskProgress(projectId, taskId, progress) {
    this.broadcast(projectId, {
      type: 'taskProgress',
      projectId,
      taskId,
      progress,
      timestamp: new Date().toISOString()
    });
  }

  broadcastTaskComplete(projectId, task, result) {
    this.broadcast(projectId, {
      type: 'taskComplete',
      projectId,
      task: {
        id: task.id,
        agentType: task.agentType,
        action: task.action,
        status: 'completed',
        result: {
          filesCreated: result.filesCreated || 0,
          summary: result.summary || 'Task completed'
        }
      },
      timestamp: new Date().toISOString()
    });
  }

  broadcastTaskError(projectId, task, error) {
    this.broadcast(projectId, {
      type: 'taskError',
      projectId,
      task: {
        id: task.id,
        agentType: task.agentType,
        action: task.action,
        status: 'failed',
        error: error.message
      },
      timestamp: new Date().toISOString()
    });
  }

  broadcastProjectUpdate(projectId, update) {
    this.broadcast(projectId, {
      type: 'projectUpdate',
      projectId,
      update,
      timestamp: new Date().toISOString()
    });
  }

  broadcastAgentActivity(projectId, agentType, activity) {
    this.broadcast(projectId, {
      type: 'agentActivity',
      projectId,
      agentType,
      activity,
      timestamp: new Date().toISOString()
    });
  }

  broadcast(projectId, message) {
    const subscribers = this.projectSubscriptions.get(projectId);
    if (!subscribers) return;
    
    const messageStr = JSON.stringify(message);
    
    for (const clientId of subscribers) {
      const ws = this.clients.get(clientId);
      if (ws && ws.readyState === ws.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  broadcastToAll(message) {
    const messageStr = JSON.stringify(message);
    
    for (const [clientId, ws] of this.clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  async sendProjectStatus(clientId, projectId) {
    const ws = this.clients.get(clientId);
    if (!ws) return;
    
    // This would be populated by querying the task manager
    // For now, send a placeholder
    ws.send(JSON.stringify({
      type: 'projectStatus',
      projectId,
      status: 'active',
      timestamp: new Date().toISOString()
    }));
  }

  async sendActiveTasks(clientId, projectId) {
    const ws = this.clients.get(clientId);
    if (!ws) return;
    
    // This would be populated by querying the task manager
    // For now, send a placeholder
    ws.send(JSON.stringify({
      type: 'activeTasks',
      projectId,
      tasks: [],
      timestamp: new Date().toISOString()
    }));
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getConnectedClients() {
    return this.clients.size;
  }

  getProjectSubscribers(projectId) {
    return this.projectSubscriptions.get(projectId)?.size || 0;
  }
}

export default RealtimeProgressServer;