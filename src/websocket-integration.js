import { createServer } from 'http';
import { RealtimeProgressServer } from './websocket-server.js';
import express from 'express';
import logger from './logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class WebSocketIntegration {
  constructor(port = 3001) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.websocketServer = null;
  }

  async init() {
    // Setup Express app
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        websocket: {
          connected: this.websocketServer?.getConnectedClients() || 0
        }
      });
    });

    // Project status endpoint
    this.app.get('/api/project/:projectId/status', async (req, res) => {
      try {
        // This would query the task manager for project status
        res.json({
          projectId: req.params.projectId,
          status: 'active',
          message: 'Project status endpoint'
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Create HTTP server
    this.server = createServer(this.app);
    
    // Initialize WebSocket server
    this.websocketServer = new RealtimeProgressServer(this.server);
    
    // Start server
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (error) => {
        if (error) {
          logger.error('Failed to start WebSocket server', error);
          reject(error);
        } else {
          // Get actual port (in case 0 was used for dynamic allocation)
          const actualPort = this.server.address().port;
          this.port = actualPort;
          logger.info(`WebSocket server listening on port ${actualPort}`);
          resolve(this.websocketServer);
        }
      });
    });
  }

  getWebSocketServer() {
    return this.websocketServer;
  }

  async shutdown() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('WebSocket server shut down');
          resolve();
        });
      });
    }
  }
}

// Create simple HTML client for testing
export const createTestClient = () => {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Debo Real-time Monitor</title>
    <style>
        body {
            font-family: monospace;
            background: #1a1a1a;
            color: #0f0;
            padding: 20px;
        }
        #log {
            background: #000;
            padding: 20px;
            height: 400px;
            overflow-y: scroll;
            border: 1px solid #0f0;
            white-space: pre-wrap;
        }
        .error { color: #f00; }
        .complete { color: #0ff; }
        .start { color: #ff0; }
        button {
            background: #0f0;
            color: #000;
            border: none;
            padding: 10px 20px;
            margin: 5px;
            cursor: pointer;
            font-family: monospace;
            font-weight: bold;
        }
        button:hover {
            background: #0a0;
        }
        input {
            background: #000;
            color: #0f0;
            border: 1px solid #0f0;
            padding: 5px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <h1>Debo Real-time Monitor</h1>
    <div>
        <input type="text" id="projectId" placeholder="Project ID" />
        <button onclick="connect()">Connect</button>
        <button onclick="subscribe()">Subscribe to Project</button>
        <button onclick="disconnect()">Disconnect</button>
    </div>
    <div id="log"></div>
    
    <script>
        let ws = null;
        const log = document.getElementById('log');
        
        function addLog(message, type = '') {
            const timestamp = new Date().toLocaleTimeString();
            const div = document.createElement('div');
            div.className = type;
            div.textContent = \`[\${timestamp}] \${message}\`;
            log.appendChild(div);
            log.scrollTop = log.scrollHeight;
        }
        
        function connect() {
            if (ws) {
                addLog('Already connected', 'error');
                return;
            }
            
            ws = new WebSocket('ws://localhost:3001');
            
            ws.onopen = () => {
                addLog('Connected to Debo WebSocket server', 'complete');
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                switch(data.type) {
                    case 'taskStart':
                        addLog(\`Task Started: \${data.task.agentType} - \${data.task.action}\`, 'start');
                        break;
                    case 'taskComplete':
                        addLog(\`Task Completed: \${data.task.agentType} - \${data.task.action} (Files: \${data.task.result.filesCreated || 0})\`, 'complete');
                        break;
                    case 'taskError':
                        addLog(\`Task Failed: \${data.task.agentType} - \${data.task.error}\`, 'error');
                        break;
                    case 'projectUpdate':
                        addLog(\`Project Update: \${data.update.status}\`);
                        break;
                    case 'agentActivity':
                        addLog(\`Agent \${data.agentType}: \${data.activity.action} - \${data.activity.status}\`);
                        break;
                    default:
                        addLog(\`\${data.type}: \${JSON.stringify(data)}\`);
                }
            };
            
            ws.onerror = (error) => {
                addLog(\`WebSocket error: \${error.message}\`, 'error');
            };
            
            ws.onclose = () => {
                addLog('Disconnected from server');
                ws = null;
            };
        }
        
        function subscribe() {
            const projectId = document.getElementById('projectId').value;
            if (!ws || !projectId) {
                addLog('Not connected or no project ID', 'error');
                return;
            }
            
            ws.send(JSON.stringify({
                type: 'subscribe',
                projectId: projectId
            }));
            
            addLog(\`Subscribing to project: \${projectId}\`);
        }
        
        function disconnect() {
            if (ws) {
                ws.close();
            }
        }
        
        // Auto-connect on load
        window.onload = () => {
            setTimeout(connect, 1000);
        };
    </script>
</body>
</html>
  `;
  
  return html;
};

export default WebSocketIntegration;