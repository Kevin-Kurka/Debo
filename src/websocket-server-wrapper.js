/**
 * WebSocket Server Wrapper
 * Simple wrapper to provide WebSocketServer functionality
 */

import { WebSocketIntegration } from './websocket-integration.js';
import logger from './logger.js';

export class WebSocketServer {
  constructor(port = 0) { // Use 0 to let OS assign available port
    this.port = port;
    this.integration = new WebSocketIntegration(port);
    this.server = null;
  }

  async init() {
    this.server = await this.integration.init();
    // Get actual port from integration
    this.port = this.integration.port;
    logger.info(`WebSocket server initialized on port ${this.port}`);
    return this.server;
  }

  broadcast(data) {
    if (this.integration.websocketServer) {
      this.integration.websocketServer.broadcast(data);
    }
  }

  async close() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('WebSocket server closed');
          resolve();
        });
      });
    }
  }

  getConnectedClients() {
    return this.integration.websocketServer?.getConnectedClients() || 0;
  }
}

export default WebSocketServer;