#!/usr/bin/env node

import { config, validateConfig } from './config.js';
import logger from './logger.js';
import { rateLimiter } from './validation.js';

class MCPServer {
  constructor() {
    this.initialized = false;
    process.stdin.setEncoding('utf8');
    this.setupHandlers();
  }

  async init() {
    try {
      validateConfig();
      await logger.info('MCP Server starting');
      this.initialized = true;
    } catch (error) {
      await logger.error('Init failed', error);
      process.exit(1);
    }
  }

  setupHandlers() {
    process.stdin.on('data', async (data) => {
      const response = await this.handleRequest(data);
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    });
    
    process.stdin.resume();
  }

  async handleRequest(data) {
    if (!this.initialized) await this.init();

    try {
      const request = JSON.parse(data.trim());
      
      if (!rateLimiter.check(request.id || 'default')) {
        return this.errorResponse(request.id, 'Rate limit exceeded');
      }

      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        case 'tools/list':
          return this.handleToolsList(request);
        case 'tools/call':
          return await this.handleToolsCall(request);
        default:
          return this.errorResponse(request.id, 'Unknown method');
      }
    } catch (error) {
      await logger.error('Request failed', error);
      return this.errorResponse(null, 'Parse error');
    }
  }