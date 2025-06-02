#!/usr/bin/env node

/**
 * Debo MCP Server - Single Tool Interface
 * 
 * PURPOSE:
 * Simplified MCP server with a single 'debo' tool that handles all requests
 * through natural language, backed by a comprehensive Fortune 500-style agent system.
 * 
 * FEATURES:
 * - Single natural language interface
 * - Fortune 500 company structure with specialized departments
 * - Redis-based state management for all agents
 * - LangGraph-style workflow orchestration
 * - Real-time progress monitoring via WebSocket
 * 
 * AGENT HIERARCHY:
 * - Executive: CEO, CTO, CFO, COO
 * - Management: Department heads and managers
 * - Specialists: Domain experts and execution agents
 * - Support: Administrative and operational roles
 */

import { EnhancedTaskManager } from './database/task-manager.js';
import { Fortune500Orchestrator } from './core/fortune500-orchestrator.js';
import { LLMProvider } from './infrastructure/llm-provider.js';
import { WebSocketServer } from './websocket-server-wrapper.js';
import logger from './logger.js';
import { v4 as uuidv4 } from 'uuid';

class DeboMCPServer {
  constructor() {
    this.taskManager = null;
    this.orchestrator = null;
    this.llmProvider = null;
    this.websocketServer = null;
    this.sessionContext = new Map();
    this.initialized = false;
    
    // Setup stdin/stdout handling
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', this.handleRequest.bind(this));
    process.stdin.resume();
  }

  async handleRequest(data) {
    try {
      const trimmed = data.trim();
      if (!trimmed) return; // Ignore empty input
      
      const request = JSON.parse(trimmed);
      logger.debug(`Received request: ${request.method}`);
      let response = null;
      
      switch (request.method) {
        case 'initialize':
          response = await this.handleInitialize(request);
          break;
        case 'tools/list':
          response = await this.handleToolsList(request);
          break;
        case 'tools/call':
          response = await this.handleToolsCall(request);
          break;
        default:
          response = this.errorResponse(request.id, `Unknown method: ${request.method}`);
      }
      
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (error) {
      logger.error('Request handling error:', error);
      const errorResponse = this.errorResponse(null, 'Parse error: ' + error.message);
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }

  async handleInitialize(request) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'debo',
          version: '3.0.0',
          description: 'Enterprise AI System with Fortune 500 Structure'
        }
      }
    };
  }

  async handleToolsList(request) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: [
          {
            name: 'debo',
            description: `Debo - Enterprise AI System with Fortune 500 Structure

I manage a complete corporate hierarchy of AI agents:

🏢 EXECUTIVE LEVEL:
• CEO: Strategic vision and company direction
• CTO: Technology strategy and innovation
• CFO: Financial planning and analysis
• COO: Operations and efficiency

👔 DEPARTMENT HEADS:
• Engineering, Product, Sales, Marketing, HR, Legal, Finance
• Customer Success, R&D, Business Development, IT

👥 SPECIALIZED TEAMS:
• Software Development (Frontend, Backend, Mobile, DevOps)
• Data & Analytics (Scientists, Engineers, Analysts)
• Creative (Designers, Writers, Video, Audio)
• Operations (Project Management, QA, Security)

🤖 CAPABILITIES:
• Build complete software applications
• Analyze business strategies
• Create marketing campaigns
• Handle legal and compliance
• Manage financial planning
• Conduct market research
• And much more!

Just tell me what you need in natural language!`,
            inputSchema: {
              type: 'object',
              properties: {
                request: {
                  type: 'string',
                  description: 'What would you like Debo to do? Examples: "Build a SaaS application", "Analyze market opportunities", "Create a marketing strategy", "Review this contract", "Plan company expansion"'
                }
              },
              required: ['request']
            }
          }
        ]
      }
    };
  }

  async handleToolsCall(request) {
    const { name, arguments: args } = request.params;
    
    if (name !== 'debo') {
      return this.errorResponse(request.id, `Unknown tool: ${name}`);
    }
    
    try {
      const result = await this.handleDeboRequest(args);
      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };
    } catch (error) {
      logger.error('Tool execution error:', error);
      return this.errorResponse(request.id, error.message);
    }
  }

  errorResponse(id, message) {
    return {
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32603,
        message: message
      }
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize enhanced task manager with Redis
      this.taskManager = new EnhancedTaskManager();
      await this.taskManager.connect();

      // Initialize LLM provider
      this.llmProvider = new LLMProvider();
      await this.llmProvider.init();

      // Initialize WebSocket server for real-time updates
      // Use dynamic port allocation to avoid conflicts
      const wsPort = process.env.WS_PORT || 0; // 0 = let OS assign available port
      this.websocketServer = new WebSocketServer(parseInt(wsPort));
      await this.websocketServer.init();
      const actualWsPort = this.websocketServer.port;

      // Initialize Fortune 500 orchestrator
      this.orchestrator = new Fortune500Orchestrator(
        this.taskManager,
        this.llmProvider,
        this.websocketServer
      );
      await this.orchestrator.init();

      this.initialized = true;
      
      logger.info('🏢 Debo Fortune 500 AI System initialized');
      logger.info('📊 Departments online: Executive, Engineering, Product, Sales, Marketing, Legal, Finance, HR, Operations');
      logger.info('🤖 Total agents available: 50+ specialized roles');
      logger.info('🔗 Redis state management: Connected');
      logger.info(`📡 Real-time monitoring: http://localhost:${actualWsPort}`);
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      throw error;
    }
  }

  async handleDeboRequest(args) {
    const { request } = args;
    const sessionId = uuidv4();
    
    logger.info(`\n🎯 New request received: "${request.substring(0, 100)}${request.length > 100 ? '...' : ''}"`);
    logger.info(`📋 Session ID: ${sessionId}`);
    
    try {
      // Store session context
      this.sessionContext.set(sessionId, {
        request,
        startTime: Date.now(),
        status: 'processing'
      });

      // CEO analyzes request and delegates to appropriate departments
      const executiveAnalysis = await this.orchestrator.executiveAnalysis(request, sessionId);
      
      // Process through appropriate department workflow
      const result = await this.orchestrator.processThroughDepartments(
        executiveAnalysis,
        sessionId
      );
      
      // Update session status
      const session = this.sessionContext.get(sessionId);
      session.status = 'completed';
      session.duration = Date.now() - session.startTime;
      
      // Format response with corporate structure
      return this.formatCorporateResponse(result, session);
      
    } catch (error) {
      logger.error(`❌ Request processing error: ${error.message}`);
      
      // Update session with error
      const session = this.sessionContext.get(sessionId);
      if (session) {
        session.status = 'failed';
        session.error = error.message;
      }
      
      throw error;
    }
  }

  formatCorporateResponse(result, session) {
    const { departments, workflow, deliverables, summary } = result;
    
    let response = `✅ **Request Completed Successfully**\n`;
    response += `⏱️ Processing Time: ${(session.duration / 1000).toFixed(1)}s\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Executive Summary
    response += `📊 **Executive Summary**\n`;
    response += `${summary}\n\n`;
    
    // Departments Involved
    response += `🏢 **Departments Engaged**\n`;
    departments.forEach(dept => {
      response += `• **${dept.name}**: ${dept.role}\n`;
      if (dept.agents?.length > 0) {
        response += `  Agents: ${dept.agents.join(', ')}\n`;
      }
    });
    response += `\n`;
    
    // Workflow Executed
    if (workflow?.stages?.length > 0) {
      response += `📋 **Workflow Stages**\n`;
      workflow.stages.forEach((stage, index) => {
        const status = stage.status === 'completed' ? '✅' : '🔄';
        response += `${index + 1}. ${status} ${stage.name}\n`;
        if (stage.deliverables?.length > 0) {
          response += `   Deliverables: ${stage.deliverables.join(', ')}\n`;
        }
      });
      response += `\n`;
    }
    
    // Key Deliverables
    if (deliverables && Object.keys(deliverables).length > 0) {
      response += `📦 **Deliverables**\n`;
      for (const [type, items] of Object.entries(deliverables)) {
        response += `\n**${type}**:\n`;
        if (Array.isArray(items)) {
          items.forEach(item => {
            response += `• ${item}\n`;
          });
        } else if (typeof items === 'object') {
          response += `\`\`\`json\n${JSON.stringify(items, null, 2)}\n\`\`\`\n`;
        } else {
          response += `${items}\n`;
        }
      }
    }
    
    // Real-time monitoring
    const wsPort = this.websocketServer?.port || 'N/A';
    response += `\n📡 **Live Monitoring**: http://localhost:${wsPort}\n`;
    response += `🔍 **Session ID**: ${sessionId}\n`;
    
    return {
      content: [{
        type: 'text',
        text: response
      }]
    };
  }

  async cleanup() {
    logger.info('🔄 Cleaning up server resources...');
    
    try {
      // Clear session contexts
      this.sessionContext.clear();
      
      // Close connections
      if (this.taskManager?.redis) {
        await this.taskManager.redis.quit();
      }
      await this.websocketServer?.close();
      await this.orchestrator?.cleanup();
      
      logger.info('✅ Cleanup completed');
    } catch (error) {
      logger.error('❌ Cleanup error:', error);
    }
  }

  async start() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    logger.info('\n🚀 Debo MCP Server Started!');
    logger.info('🏢 Fortune 500 AI Corporation Ready');
    logger.info('💼 All departments standing by...');
    logger.info('📡 Monitoring: http://localhost:3001\n');
    
    // Cleanup on exit
    process.on('SIGINT', async () => {
      logger.info('\n📴 Shutting down Debo server...');
      await this.cleanup();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }
}

// Start server
const server = new DeboMCPServer();
server.start().catch(error => {
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
});