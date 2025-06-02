/**
 * WebSocket Service with Dynamic Port Management
 * 
 * PURPOSE:
 * Provides real-time communication capabilities with automatic port allocation.
 * Manages WebSocket connections for dashboard and client communication.
 * 
 * FEATURES:
 * - Dynamic port assignment to avoid conflicts
 * - Real-time status updates and notifications
 * - Client connection management
 * - Health monitoring and metrics
 * 
 * TODO:
 * - None
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { portManager } from '../utils/port-manager.js';
import { config } from '../config.js';
import logger from '../logger.js';

export default class WebSocketService {
  constructor() {
    this.server = null;
    this.wss = null;
    this.clients = new Map();
    this.port = null;
    this.isRunning = false;
    this.metrics = {
      connections: 0,
      totalConnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0
    };
  }

  async initialize() {
    try {
      // Get dynamic port assignment
      this.port = await portManager.getPort('websocket-server', 'websocket', config.websocket.port);
      
      // Create HTTP server for WebSocket upgrade
      this.server = createServer();
      
      // Create WebSocket server
      this.wss = new WebSocketServer({ 
        server: this.server,
        path: '/ws'
      });
      
      this.setupWebSocketHandlers();
      
      // Start listening
      await this.startServer();
      
      logger.info(`WebSocket Service initialized on port ${this.port}`);
      
    } catch (error) {
      logger.error('Failed to initialize WebSocket Service:', error);
      throw error;
    }
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, config.websocket.host, (error) => {
        if (error) {
          reject(error);
        } else {
          this.isRunning = true;
          logger.info(`WebSocket server listening on ${config.websocket.host}:${this.port}`);
          resolve();
        }
      });
    });
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      const clientInfo = {
        id: clientId,
        socket: ws,
        connectedAt: new Date(),
        lastPing: new Date(),
        subscriptions: new Set()
      };
      
      this.clients.set(clientId, clientInfo);
      this.metrics.connections++;
      this.metrics.totalConnections++;
      
      logger.info(`WebSocket client connected: ${clientId} (${this.metrics.connections} active)`);
      
      // Send welcome message
      this.sendToClient(clientId, {
        type: 'welcome',
        clientId: clientId,
        server: 'debo-websocket',
        timestamp: new Date().toISOString()
      });
      
      // Handle messages
      ws.on('message', (data) => {
        try {
          this.handleClientMessage(clientId, data);
          this.metrics.messagesReceived++;
        } catch (error) {
          logger.error(`Error handling message from ${clientId}:`, error);
          this.metrics.errors++;
        }
      });
      
      // Handle client disconnect
      ws.on('close', () => {
        this.clients.delete(clientId);
        this.metrics.connections--;
        logger.info(`WebSocket client disconnected: ${clientId} (${this.metrics.connections} active)`);
      });
      
      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        this.metrics.errors++;
      });
      
      // Setup ping/pong for connection health
      ws.on('pong', () => {
        if (this.clients.has(clientId)) {
          this.clients.get(clientId).lastPing = new Date();
        }
      });
    });
    
    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
      this.metrics.errors++;
    });
    
    // Start health check interval
    this.startHealthCheck();
  }

  handleClientMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);
      
      if (!client) return;
      
      switch (message.type) {
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
          break;
          
        case 'subscribe':
          if (message.channel) {
            client.subscriptions.add(message.channel);
            this.sendToClient(clientId, { 
              type: 'subscribed', 
              channel: message.channel,
              timestamp: new Date().toISOString()
            });
            logger.debug(`Client ${clientId} subscribed to ${message.channel}`);
          }
          break;
          
        case 'unsubscribe':
          if (message.channel) {
            client.subscriptions.delete(message.channel);
            this.sendToClient(clientId, { 
              type: 'unsubscribed', 
              channel: message.channel,
              timestamp: new Date().toISOString()
            });
            logger.debug(`Client ${clientId} unsubscribed from ${message.channel}`);
          }
          break;
          
        case 'request_status':
          this.sendSystemStatus(clientId);
          break;
          
        default:
          logger.warn(`Unknown message type from ${clientId}:`, message.type);
      }
      
    } catch (error) {
      logger.error(`Failed to parse message from ${clientId}:`, error);
      this.sendToClient(clientId, { 
        type: 'error', 
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      });
    }
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === 1) { // OPEN
      try {
        client.socket.send(JSON.stringify(message));
        this.metrics.messagesSent++;
        return true;
      } catch (error) {
        logger.error(`Failed to send message to ${clientId}:`, error);
        this.metrics.errors++;
        return false;
      }
    }
    return false;
  }

  broadcast(message, channel = null) {
    let sent = 0;
    
    for (const [clientId, client] of this.clients) {
      // If channel specified, only send to subscribed clients
      if (channel && !client.subscriptions.has(channel)) {
        continue;
      }
      
      if (this.sendToClient(clientId, message)) {
        sent++;
      }
    }
    
    logger.debug(`Broadcast message to ${sent} clients${channel ? ` on channel ${channel}` : ''}`);
    return sent;
  }

  sendSystemStatus(clientId = null) {
    const status = {
      type: 'system_status',
      data: {
        websocket: {
          port: this.port,
          connections: this.metrics.connections,
          uptime: this.getUptime()
        },
        ports: portManager.getPortInfo(),
        timestamp: new Date().toISOString()
      }
    };
    
    if (clientId) {
      this.sendToClient(clientId, status);
    } else {
      this.broadcast(status, 'system');
    }
  }

  notifyAgentActivity(agentId, activity, data = {}) {
    const message = {
      type: 'agent_activity',
      agentId,
      activity,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.broadcast(message, 'agents');
  }

  notifyTaskUpdate(taskId, status, details = {}) {
    const message = {
      type: 'task_update',
      taskId,
      status,
      details,
      timestamp: new Date().toISOString()
    };
    
    this.broadcast(message, 'tasks');
  }

  notifySystemEvent(event, data = {}) {
    const message = {
      type: 'system_event',
      event,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.broadcast(message, 'system');
  }

  startHealthCheck() {
    setInterval(() => {
      // Send ping to all clients
      for (const [clientId, client] of this.clients) {
        if (client.socket.readyState === 1) { // OPEN
          client.socket.ping();
        }
      }
      
      // Clean up stale connections
      const now = new Date();
      const staleClients = [];
      
      for (const [clientId, client] of this.clients) {
        const timeSinceLastPing = now - client.lastPing;
        if (timeSinceLastPing > 60000) { // 60 seconds
          staleClients.push(clientId);
        }
      }
      
      staleClients.forEach(clientId => {
        logger.warn(`Removing stale WebSocket client: ${clientId}`);
        const client = this.clients.get(clientId);
        if (client) {
          client.socket.terminate();
          this.clients.delete(clientId);
          this.metrics.connections--;
        }
      });
      
    }, 30000); // Every 30 seconds
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getUptime() {
    return this.isRunning ? Date.now() - this.metrics.startTime : 0;
  }

  getMetrics() {
    return {
      ...this.metrics,
      port: this.port,
      isRunning: this.isRunning,
      activeConnections: this.clients.size
    };
  }

  getConnectionInfo() {
    return {
      url: `ws://${config.websocket.host}:${this.port}/ws`,
      port: this.port,
      host: config.websocket.host,
      activeConnections: this.clients.size,
      isRunning: this.isRunning
    };
  }

  async shutdown() {
    try {
      logger.info('Shutting down WebSocket Service...');
      
      // Notify all clients of shutdown
      this.broadcast({
        type: 'server_shutdown',
        message: 'Server is shutting down',
        timestamp: new Date().toISOString()
      });
      
      // Close all client connections
      for (const [clientId, client] of this.clients) {
        client.socket.close(1001, 'Server shutdown');
      }
      
      // Close WebSocket server
      if (this.wss) {
        this.wss.close();
      }
      
      // Close HTTP server
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
      }
      
      // Release port
      portManager.releasePort('websocket-server');
      
      this.isRunning = false;
      logger.info('WebSocket Service shutdown complete');
      
    } catch (error) {
      logger.error('Error during WebSocket Service shutdown:', error);
      throw error;
    }
  }
}

export { WebSocketService };