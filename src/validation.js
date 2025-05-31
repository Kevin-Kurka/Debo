import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger.js';

const execAsync = promisify(exec);

export const schemas = {
  mcpRequest: z.object({
    request: z.string().min(1).max(1000),
    project_id: z.string().optional()
  }),
  
  systemCommand: z.object({
    command: z.string().regex(/^[a-zA-Z0-9\s\-._/]+$/),
    timeout: z.number().min(1000).max(30000).optional()
  })
};

export function sanitizeCommand(command) {
  const allowedCommands = ['ollama', 'docker', 'ls', 'cat', 'echo', 'launchctl'];
  const cmdParts = command.trim().split(' ');
  const baseCommand = cmdParts[0];
  
  if (!allowedCommands.includes(baseCommand)) {
    throw new Error(`Command not allowed: ${baseCommand}`);
  }
  
  return command.replace(/[;&|`$(){}[\]\\]/g, '');
}

export async function safeExec(command, options = {}) {
  const { timeout = 10000 } = options;
  
  try {
    const sanitized = sanitizeCommand(command);
    logger.info('Executing command', { command: sanitized });
    
    const { stdout, stderr } = await execAsync(sanitized, { 
      timeout,
      maxBuffer: 1024 * 1024
    });
    
    return { success: true, stdout, stderr };
  } catch (error) {
    logger.error('Command execution failed', error, { command });
    return { success: false, error: error.message };
  }
}
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.requests = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  check(identifier) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    const validRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }
}

export const rateLimiter = new RateLimiter();
