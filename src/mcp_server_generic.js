#!/usr/bin/env node

/**
 * Generic MCP Server for Debo
 * 
 * PURPOSE:
 * Enhanced MCP server that supports dynamic agent creation and
 * handles any type of request, not just software development.
 * 
 * FEATURES:
 * - Natural language understanding for any domain
 * - Dynamic agent creation through dialogue
 * - Custom data schema support
 * - Knowledge management with RAG
 * - Conversational clarification
 * 
 * TECHNICAL DETAILS:
 * - Uses GenericOrchestrator instead of UnifiedOrchestrator
 * - Supports dialogue-based interactions
 * - Maintains conversation context
 * - Enables domain-agnostic processing
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TaskManager } from './database/task-manager.js';
import { GenericOrchestrator } from './core/generic-orchestrator.js';
import { LLMProvider } from './infrastructure/llm-provider.js';
import { WebSocketServer } from './websocket-server.js';
import logger from './logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GenericDeboServer {
  constructor() {
    this.server = new Server({
      name: 'debo-generic',
      version: '2.0.0',
    }, {
      capabilities: {
        tools: {},
        resources: {}
      }
    });
    
    this.taskManager = null;
    this.orchestrator = null;
    this.llmProvider = null;
    this.websocketServer = null;
    this.activeDialogues = new Map();
    
    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'debo',
          description: `Debo - Your universal AI orchestrator. I can:
• Create custom AI agents for any domain (legal, medical, scientific, etc.)
• Build software applications from natural language descriptions
• Answer questions and manage knowledge across domains
• Handle complex workflows and data management
• Learn and adapt to your specific needs

Just describe what you want in natural language!`,
          inputSchema: {
            type: 'object',
            properties: {
              request: {
                type: 'string',
                description: 'Your request in natural language'
              },
              context: {
                type: 'object',
                description: 'Optional context (projectId, domain, etc.)',
                properties: {
                  projectId: { type: 'string' },
                  domain: { type: 'string' },
                  dialogueId: { type: 'string' }
                }
              }
            },
            required: ['request']
          }
        },
        {
          name: 'debo_dialogue',
          description: 'Continue an active dialogue with Debo (for agent creation or clarifications)',
          inputSchema: {
            type: 'object',
            properties: {
              dialogueId: {
                type: 'string',
                description: 'The dialogue ID from previous response'
              },
              response: {
                type: 'string',
                description: 'Your response to Debo\'s questions'
              }
            },
            required: ['dialogueId', 'response']
          }
        },
        {
          name: 'debo_query',
          description: 'Query Debo\'s knowledge base or stored data',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Your query'
              },
              domain: {
                type: 'string',
                description: 'Optional: specific domain to search'
              },
              agentId: {
                type: 'string',
                description: 'Optional: specific agent\'s data to query'
              }
            },
            required: ['query']
          }
        }
      ]
    }));

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'debo':
            return await this.handleDeboRequest(args);
            
          case 'debo_dialogue':
            return await this.handleDialogue(args);
            
          case 'debo_query':
            return await this.handleQuery(args);
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error('Tool execution error:', error);
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}\n\nTry rephrasing your request or providing more context.`
          }]
        };
      }
    });
  }

  async initialize() {
    try {
      // Initialize task manager
      this.taskManager = new TaskManager();
      await this.taskManager.init();

      // Initialize LLM provider
      this.llmProvider = new LLMProvider(this.taskManager);
      await this.llmProvider.init();

      // Initialize WebSocket server for real-time updates
      this.websocketServer = new WebSocketServer(3001);
      await this.websocketServer.init();

      // Initialize generic orchestrator
      this.orchestrator = new GenericOrchestrator(
        this.taskManager,
        this.llmProvider,
        this.websocketServer
      );
      await this.orchestrator.init();

      logger.info('Generic Debo MCP Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      throw error;
    }
  }

  async handleDeboRequest(args) {
    const { request, context = {} } = args;
    
    logger.info(`Processing request: ${request.substring(0, 100)}...`);
    
    try {
      const result = await this.orchestrator.processGenericRequest(request, context);
      
      // Format response based on result type
      return this.formatResponse(result);
      
    } catch (error) {
      logger.error('Request processing error:', error);
      throw error;
    }
  }

  async handleDialogue(args) {
    const { dialogueId, response } = args;
    
    logger.info(`Continuing dialogue: ${dialogueId}`);
    
    try {
      const result = await this.orchestrator.continueDialogue(dialogueId, response);
      
      return this.formatResponse(result);
      
    } catch (error) {
      logger.error('Dialogue error:', error);
      throw error;
    }
  }

  async handleQuery(args) {
    const { query, domain, agentId } = args;
    
    logger.info(`Processing query: ${query}`);
    
    try {
      let result;
      
      if (agentId) {
        // Query specific agent's data
        const data = await this.orchestrator.dynamicAgentManager.queryAgentData(
          agentId,
          'all',
          { query }
        );
        
        result = {
          type: 'query_result',
          data,
          count: data.length,
          agentId
        };
      } else {
        // General knowledge query
        result = await this.orchestrator.handleKnowledgeQuery(
          { query, domain },
          {}
        );
      }
      
      return this.formatResponse(result);
      
    } catch (error) {
      logger.error('Query error:', error);
      throw error;
    }
  }

  formatResponse(result) {
    let content = [];
    
    switch (result.type) {
      case 'dialogue':
      case 'clarification':
        content.push({
          type: 'text',
          text: `${result.message}\n\n${result.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n**Dialogue ID:** ${result.dialogueId}\n\nUse the \`debo_dialogue\` tool to respond.`
        });
        break;
        
      case 'agent_needed':
        content.push({
          type: 'text',
          text: `${result.message}\n\nSuggested agent:\n- **Domain:** ${result.suggestedAgent.domain}\n- **Name:** ${result.suggestedAgent.name}\n- **Capabilities:** ${result.suggestedAgent.capabilities.join(', ')}\n\nRespond with "yes" to create this agent or describe what you need differently.`
        });
        break;
        
      case 'task_result':
        content.push({
          type: 'text',
          text: `✅ Task completed successfully!\n\n**Agent Used:** ${result.agentUsed}\n**Task ID:** ${result.taskId}\n**Confidence:** ${(result.confidence * 100).toFixed(0)}%\n\n**Result:**\n${result.result}`
        });
        
        if (result.storedEntities?.length > 0) {
          content.push({
            type: 'text',
            text: `\n**Stored Data:** ${result.storedEntities.join(', ')}`
          });
        }
        break;
        
      case 'knowledge_response':
        content.push({
          type: 'text',
          text: `**Answer:** ${result.response}\n\n**Confidence:** ${(result.confidence * 100).toFixed(0)}%\n**Sources:** ${result.sources.map(s => s.title).join(', ')}`
        });
        
        if (result.relatedTopics?.length > 0) {
          content.push({
            type: 'text',
            text: `\n**Related Topics:** ${result.relatedTopics.join(', ')}`
          });
        }
        break;
        
      case 'project_created':
        content.push({
          type: 'text',
          text: `🚀 Project "${result.projectName}" created!\n\n**Project ID:** ${result.projectId}\n**Requirements:** ${result.requirements}\n\n✨ Development has started! Monitor progress at http://localhost:3001\n\nThe AI team is now working on your project. You'll see real-time updates as each agent completes their tasks.`
        });
        break;
        
      case 'direct_response':
        content.push({
          type: 'text',
          text: result.response
        });
        break;
        
      case 'task_complete':
        content.push({
          type: 'text',
          text: `✅ Task completed!\n\n**Summary:** ${result.summary}\n\n**Details:**\n${result.results.map(r => `- ${r.subtask}: ✓`).join('\n')}`
        });
        break;
        
      default:
        // Generic response formatting
        content.push({
          type: 'text',
          text: JSON.stringify(result, null, 2)
        });
    }
    
    return { content };
  }

  async start() {
    await this.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    logger.info('Generic Debo MCP Server started - ready for any request!');
    
    // Cleanup on exit
    process.on('SIGINT', async () => {
      logger.info('Shutting down server...');
      await this.taskManager?.cleanup();
      await this.websocketServer?.close();
      process.exit(0);
    });
  }
}

// Start server
const server = new GenericDeboServer();
server.start().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});