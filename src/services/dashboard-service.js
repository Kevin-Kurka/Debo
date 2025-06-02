/**
 * Dashboard Service with Dynamic Port Management
 * 
 * PURPOSE:
 * Provides a web-based dashboard for monitoring Debo system status.
 * Uses dynamic port assignment to avoid conflicts.
 * 
 * FEATURES:
 * - Dynamic port assignment
 * - Real-time system monitoring
 * - Agent status display
 * - Port management interface
 * 
 * TODO:
 * - None
 */

import express from 'express';
import { createServer } from 'http';
import { portManager } from '../utils/port-manager.js';
import { config } from '../config.js';
import logger from '../logger.js';

export default class DashboardService {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      // Get dynamic port assignment
      this.port = await portManager.getPort('dashboard-server', 'monitoring', config.dashboard.port);
      
      this.setupRoutes();
      this.setupMiddleware();
      
      // Create HTTP server
      this.server = createServer(this.app);
      
      // Start listening
      await this.startServer();
      
      logger.info(`Dashboard Service initialized on port ${this.port}`);
      
    } catch (error) {
      logger.error('Failed to initialize Dashboard Service:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // Basic middleware
    this.app.use(express.json());
    this.app.use(express.static('public'));
    
    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'dashboard',
        port: this.port,
        timestamp: new Date().toISOString()
      });
    });

    // Port information
    this.app.get('/api/ports', (req, res) => {
      res.json(portManager.getPortInfo());
    });

    // System status
    this.app.get('/api/status', (req, res) => {
      res.json({
        dashboard: {
          port: this.port,
          uptime: this.getUptime(),
          isRunning: this.isRunning
        },
        ports: portManager.getAllAssignments(),
        timestamp: new Date().toISOString()
      });
    });

    // Simple dashboard HTML
    this.app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Debo Dashboard</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; color: #333; margin-bottom: 30px; }
            .section { margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 5px; }
            .port-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
            .status-good { color: #28a745; }
            .status-info { color: #17a2b8; }
            .code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🤖 Debo Dashboard</h1>
              <p>Enterprise AI System - Port ${this.port}</p>
            </div>
            
            <div class="section">
              <h3>📡 Port Assignments</h3>
              <div id="ports">Loading...</div>
            </div>
            
            <div class="section">
              <h3>📊 System Status</h3>
              <div id="status">Loading...</div>
            </div>
            
            <div class="section">
              <h3>🔧 Commands</h3>
              <p>Use these commands to interact with Debo:</p>
              <div class="code">debo health</div> - Check system health<br><br>
              <div class="code">debo ports</div> - Show port assignments<br><br>
              <div class="code">debo status</div> - Show detailed status<br><br>
            </div>
          </div>
          
          <script>
            async function loadData() {
              try {
                const portsRes = await fetch('/api/ports');
                const ports = await portsRes.json();
                
                const statusRes = await fetch('/api/status');
                const status = await statusRes.json();
                
                // Display ports
                const portsDiv = document.getElementById('ports');
                portsDiv.innerHTML = Object.entries(ports.assigned)
                  .map(([service, port]) => 
                    '<div class="port-item"><span>' + service + '</span><span class="status-good">' + port + '</span></div>'
                  ).join('');
                
                // Display status
                const statusDiv = document.getElementById('status');
                statusDiv.innerHTML = 
                  '<div class="port-item"><span>Dashboard</span><span class="status-good">Running on port ' + status.dashboard.port + '</span></div>' +
                  '<div class="port-item"><span>Uptime</span><span class="status-info">' + Math.round(status.dashboard.uptime / 1000) + 's</span></div>' +
                  '<div class="port-item"><span>Last Updated</span><span class="status-info">' + new Date(status.timestamp).toLocaleTimeString() + '</span></div>';
                
              } catch (error) {
                console.error('Failed to load data:', error);
              }
            }
            
            loadData();
            setInterval(loadData, 5000); // Refresh every 5 seconds
          </script>
        </body>
        </html>
      `);
    });
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, config.dashboard.host, (error) => {
        if (error) {
          reject(error);
        } else {
          this.isRunning = true;
          this.startTime = Date.now();
          logger.info(`Dashboard server listening on ${config.dashboard.host}:${this.port}`);
          resolve();
        }
      });
    });
  }

  getUptime() {
    return this.isRunning ? Date.now() - this.startTime : 0;
  }

  getConnectionInfo() {
    return {
      url: `http://${config.dashboard.host}:${this.port}`,
      port: this.port,
      host: config.dashboard.host,
      isRunning: this.isRunning
    };
  }

  async shutdown() {
    try {
      logger.info('Shutting down Dashboard Service...');
      
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
      }
      
      // Release port
      portManager.releasePort('dashboard-server');
      
      this.isRunning = false;
      logger.info('Dashboard Service shutdown complete');
      
    } catch (error) {
      logger.error('Error during Dashboard Service shutdown:', error);
      throw error;
    }
  }
}

export { DashboardService };