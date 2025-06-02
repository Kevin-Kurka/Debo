#!/usr/bin/env node

/**
 * Optimized Debo MCP Server
 * Uses the new optimized service architecture for better performance and maintainability
 */

import { ServiceFactory } from './services/index.js';
import { HelpSystem } from './help-system.js';
import logger from './logger.js';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';

class OptimizedDeboMCPServer {
  constructor() {
    this.services = null;
    this.helpSystem = new HelpSystem();
    this.activeProjects = new Map();
    this.activeWorkflows = new Map();
    this.userSubscriptions = new Map();
    
    // Performance monitoring
    this.startTime = Date.now();
    this.requestCount = 0;
    
    this.init();
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', this.handleData.bind(this));
    process.stdin.resume();
  }

  async init() {
    try {
      // Show the banner
      console.log('\x1b[36m\x1b[1m'); // Cyan and bold
      console.log(`
    ██████╗ ███████╗██████╗  ██████╗ 
    ██╔══██╗██╔════╝██╔══██╗██╔═══██╗
    ██║  ██║█████╗  ██████╔╝██║   ██║
    ██║  ██║██╔══╝  ██╔══██╗██║   ██║
    ██████╔╝███████╗██████╔╝╚██████╔╝
    ╚═════╝ ╚══════╝╚═════╝  ╚═════╝ 

    Enterprise AI System v1.0.0`);
      console.log('\x1b[0m'); // Reset colors
      
      logger.info('🚀 Initializing Optimized Debo MCP Server...');
      
      // Initialize optimized services
      this.services = await ServiceFactory.createOptimizedServices();
      logger.info('✅ Optimized services initialized');
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      // Log startup complete
      const initTime = Date.now() - this.startTime;
      logger.info(`🎉 Optimized Debo MCP Server ready in ${initTime}ms`);
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
    } catch (error) {
      logger.error('❌ Failed to initialize Optimized Debo MCP Server:', error);
      process.exit(1);
    }
  }

  async handleData(data) {
    try {
      this.requestCount++;
      const trimmed = data.trim();
      
      if (!trimmed) return;

      const message = JSON.parse(trimmed);
      const response = await this.processMessage(message);
      
      if (response) {
        console.log(JSON.stringify(response, null, 2));
      }
      
    } catch (error) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
          data: error.message
        }
      };
      console.log(JSON.stringify(errorResponse, null, 2));
    }
  }

  async processMessage(message) {
    const { method, params, id } = message;

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(id);
          
        case 'tools/list':
          return this.handleToolsList(id);
          
        case 'tools/call':
          return await this.handleToolCall(params, id);
          
        case 'ping':
          return this.handlePing(id);
          
        default:
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: "Method not found"
            }
          };
      }
    } catch (error) {
      logger.error(`Error processing ${method}:`, error);
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: "Internal error",
          data: error.message
        }
      };
    }
  }

  handleInitialize(id) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          logging: {}
        },
        serverInfo: {
          name: "debo-optimized",
          version: "3.1.0"
        }
      }
    };
  }

  handleToolsList(id) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "debo",
            description: "Optimized Debo autonomous development system with enterprise-grade performance",
            inputSchema: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  description: "Action to perform: create, develop, status, deploy, maintain, analyze, monitor, help"
                },
                project: {
                  type: "string",
                  description: "Project name or identifier"
                },
                description: {
                  type: "string", 
                  description: "Detailed description of what you want to accomplish"
                },
                options: {
                  type: "object",
                  description: "Additional options and configuration"
                }
              },
              required: ["action", "description"]
            }
          }
        ]
      }
    };
  }

  async handleToolCall(params, id) {
    const { name, arguments: args } = params;
    
    if (name !== "debo") {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: "Unknown tool"
        }
      };
    }

    try {
      const startTime = Date.now();
      
      // Use optimized orchestrator
      const result = await this.services.orchestrator.orchestrate(
        args.description,
        {
          action: args.action,
          project: args.project,
          options: args.options || {},
          requestId: id
        }
      );
      
      const executionTime = Date.now() - startTime;
      
      // Add performance metrics to response
      const enhancedResult = {
        ...result,
        performance: {
          executionTime,
          memoryUsage: this.services.memory.getMemoryStatus(),
          agentMetrics: this.services.agentExecution.getMetrics(),
          llmMetrics: this.services.llmRequest.getMetrics()
        }
      };

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: this.formatDeboResponse(enhancedResult)
            }
          ]
        }
      };

    } catch (error) {
      logger.error('Debo tool execution failed:', error);
      
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: "Debo execution failed",
          data: {
            error: error.message,
            stack: error.stack
          }
        }
      };
    }
  }

  handlePing(id) {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        status: "healthy",
        uptime: Date.now() - this.startTime,
        requestCount: this.requestCount,
        services: {
          database: this.services.database.isConnected,
          memory: this.services.memory.getMemoryStatus(),
          orchestrator: this.services.orchestrator.getMetrics(),
          agentExecution: this.services.agentExecution.getStatus()
        }
      }
    };
  }

  formatDeboResponse(result) {
    let output = `🤖 Debo Optimized Response\n`;
    output += `═══════════════════════════\n\n`;
    
    if (result.strategy) {
      output += `📋 Strategy: ${result.strategy}\n`;
    }
    
    if (result.analysis) {
      output += `🔍 Analysis:\n${result.analysis.raw || JSON.stringify(result.analysis, null, 2)}\n\n`;
    }
    
    if (result.results) {
      output += `✅ Results:\n`;
      if (result.results.deliverables) {
        output += `📦 Deliverables: ${result.results.deliverables.length} items\n`;
      }
      if (result.results.taskResults) {
        output += `⚡ Tasks Completed: ${result.results.taskResults.length}\n`;
      }
    }
    
    if (result.performance) {
      output += `\n📊 Performance Metrics:\n`;
      output += `⏱️  Execution Time: ${result.performance.executionTime}ms\n`;
      output += `💾 Memory Usage: ${result.performance.memoryUsage.current}\n`;
      output += `🤖 Active Agents: ${result.performance.agentMetrics.activeExecutions}\n`;
      output += `🧠 LLM Cache Hit Rate: ${Math.round(result.performance.llmMetrics.cacheHitRate)}%\n`;
    }
    
    output += `\n⏰ Completed: ${new Date().toLocaleString()}`;
    
    return output;
  }


  startPerformanceMonitoring() {
    setInterval(() => {
      const metrics = {
        uptime: Date.now() - this.startTime,
        requestCount: this.requestCount,
        memoryUsage: process.memoryUsage(),
        services: this.services.orchestrator.getMetrics()
      };
      
      logger.debug('Performance metrics:', metrics);
      
      // Store metrics in database for analysis
      this.services.database.system.recordMetrics('mcp_server', metrics);
      
    }, 60000); // Every minute
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`🛑 Received ${signal}, starting graceful shutdown...`);
      
      try {
        // Stop accepting new requests
        process.stdin.pause();
        
        // Shutdown services in reverse order
        if (this.services.orchestrator) {
          await this.services.orchestrator.shutdown();
        }
        
        if (this.services.agentExecution) {
          await this.services.agentExecution.shutdown();
        }
        
        if (this.services.memory) {
          await this.services.memory.shutdown();
        }
        
        if (this.services.llmRequest) {
          await this.services.llmRequest.shutdown();
        }
        
        if (this.services.database) {
          await this.services.database.disconnect();
        }
        
        
        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
        
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  }

  // Legacy compatibility methods
  async getSystemStatus() {
    return {
      status: 'running',
      uptime: Date.now() - this.startTime,
      services: this.services.orchestrator.getMetrics()
    };
  }

  async getActiveProjects() {
    return Array.from(this.activeProjects.values());
  }

  async getActiveWorkflows() {
    return this.services.orchestrator.getActiveWorkflows();
  }
}

// Start the optimized server
const server = new OptimizedDeboMCPServer();

export default OptimizedDeboMCPServer;