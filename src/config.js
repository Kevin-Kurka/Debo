import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || 'localhost',
    name: process.env.SERVER_NAME || 'debo',
    version: process.env.SERVER_VERSION || '1.0.0'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000')
  },
  paths: {
    logs: process.env.LOG_PATH || join(__dirname, '..', 'logs'),
    models: process.env.MODELS_PATH || '/tmp/models'
  },
  ollama: {
    models: {
      coding: process.env.OLLAMA_CODING_MODEL || 'devstral',
      reasoning: process.env.OLLAMA_REASONING_MODEL || 'deepseek-r1:1.5b',
      vision: process.env.OLLAMA_VISION_MODEL || 'qwen2.5-vl'
    }
  }
};

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
