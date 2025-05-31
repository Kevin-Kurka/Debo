import { toolConfig } from './config.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import FileSystemManager from './file-system-manager.js';

const execAsync = promisify(exec);

export class ToolManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.installedTools = new Set();
    this.ragSystems = {};
    this.fileSystemManager = new FileSystemManager();
  }

  async init() {
    await this.fileSystemManager.init();
    await this.installCoreTools();
    await this.initializeRAG();
    await this.setupBrowserAutomation();
    
    // Pass file system manager to task manager for git operations
    if (this.taskManager.setFileSystemManager) {
      this.taskManager.setFileSystemManager(this.fileSystemManager);
    }
  }

  async installCoreTools() {
    // Install Playwright for browser automation
    await execAsync('npm install playwright @playwright/test');
    await execAsync('npx playwright install');
    
    // Install RAG dependencies
    await execAsync('npm install langchain @langchain/community chromadb faiss-node');
    
    this.installedTools.add('playwright');
    this.installedTools.add('langchain');
  }

  async initializeRAG() {
    // Document search for requirements/docs
    this.ragSystems.documents = {
      type: 'chromadb',
      collection: 'project_documents',
      embeddings: 'openai'
    };

    // Code search for implementation
    this.ragSystems.code = {
      type: 'faiss',
      collection: 'codebase',
      embeddings: 'cohere'
    };
  }

  async setupBrowserAutomation() {
    // Playwright browser automation setup
    await this.taskManager.redis.hSet('tools:playwright', {
      status: 'ready',
      capabilities: JSON.stringify(['page_interaction', 'screenshot', 'performance']),
      agents: JSON.stringify(['frontend_dev', 'qa_engineer'])
    });
  }

  async requestTool(agentType, toolName, justification) {
    // Orchestrator evaluates tool requests
    const requestId = await this.taskManager.createAgentTask('cto', 'evaluate_tool_request', {
      agentType, toolName, justification
    });
    
    return requestId;
  }

  async installTool(toolName, toolType) {
    try {
      switch (toolType) {
        case 'npm':
          await execAsync(`npm install ${toolName}`);
          break;
        case 'pip':
          await execAsync(`pip install ${toolName}`);
          break;
        case 'mcp':
          await this.installMCPServer(toolName);
          break;
      }
      
      this.installedTools.add(toolName);
      await this.taskManager.redis.sAdd('installed_tools', toolName);
      return true;
    } catch (error) {
      console.error(`Tool installation failed: ${toolName}`, error);
      return false;
    }
  }

  async installMCPServer(serverName) {
    await execAsync(`npm install ${serverName}`);
    // Add to MCP server config
    const mcpConfig = {
      [serverName]: {
        command: 'node',
        args: [`node_modules/${serverName}/dist/index.js`],
        env: {}
      }
    };
    
    await this.taskManager.redis.hSet('mcp_servers', serverName, JSON.stringify(mcpConfig));
  }

  getAgentTools(agentType) {
    const tools = [];
    
    for (const [category, categoryTools] of Object.entries(toolConfig)) {
      for (const [toolName, tool] of Object.entries(categoryTools)) {
        if (tool.agents.includes(agentType) || tool.agents.includes('all')) {
          tools.push({ name: toolName, ...tool });
        }
      }
    }
    
    return tools;
  }
}
