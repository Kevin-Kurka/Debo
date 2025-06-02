import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { portManager } from './utils/port-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

export const config = {
  server: {
    port: parseInt(process.env.PORT || '8000'), // Will be dynamically assigned
    host: process.env.HOST || 'localhost',
    name: process.env.SERVER_NAME || 'debo',
    version: process.env.SERVER_VERSION || '1.0.0'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000')
  },
  websocket: {
    port: parseInt(process.env.WEBSOCKET_PORT || '8100'), // Will be dynamically assigned
    host: process.env.WEBSOCKET_HOST || 'localhost'
  },
  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT || '8400'), // Will be dynamically assigned
    host: process.env.DASHBOARD_HOST || 'localhost'
  },
  paths: {
    logs: process.env.LOG_PATH || join(__dirname, '..', 'logs'),
    models: process.env.MODELS_PATH || '/tmp/models'
  },
  tray: {
    updateInterval: parseInt(process.env.TRAY_UPDATE_INTERVAL || '30000'),
    logCheckThreshold: parseInt(process.env.LOG_CHECK_THRESHOLD || '60000')
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    models: {
      thinking: process.env.OLLAMA_THINKING_MODEL || 'qwen2.5:14b',
      fast: process.env.OLLAMA_FAST_MODEL || 'qwen2.5:7b',
      coding: process.env.OLLAMA_CODING_MODEL || 'devstral',
      reasoning: process.env.OLLAMA_REASONING_MODEL || 'deepseek-r1:1.5b',
      vision: process.env.OLLAMA_VISION_MODEL || 'qwen2.5-vl:32b'
    }
  }
};

/**
 * Initialize dynamic port assignments
 */
export async function initializePorts() {
  try {
    // Assign dynamic ports for services
    config.server.port = await portManager.getPort('mcp-server', 'mcp', config.server.port);
    config.websocket.port = await portManager.getPort('websocket-server', 'websocket', config.websocket.port);
    config.dashboard.port = await portManager.getPort('dashboard-server', 'monitoring', config.dashboard.port);
    
    return {
      mcpServer: config.server.port,
      websocketServer: config.websocket.port,
      dashboardServer: config.dashboard.port
    };
  } catch (error) {
    console.error('Failed to initialize ports:', error.message);
    throw error;
  }
}

// Validate required configuration
export function validateConfig() {
  const required = {
    'SERVER_PORT': config.server.port,
    'REDIS_URL': config.redis.url
  };

  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing required configuration: ${key}`);
    }
  }
}
