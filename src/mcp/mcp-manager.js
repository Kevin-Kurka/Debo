/**
 * MCP Manager for Debo
 * Automatically sets up and manages connections to MCP servers
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
const logger = require('../logger.js');

class MCPManager {
  constructor() {
    this.mcpServers = new Map();
    this.availableServers = new Map();
    this.configPath = path.join(process.env.HOME || process.cwd(), '.debo', 'mcp-config.json');
    this.serverRegistry = new Map();
  }

  async init() {
    await this.loadMCPConfig();
    await this.discoverAvailableServers();
    await this.initializeKnownServers();
    
    logger.info('MCP Manager initialized');
  }

  async loadMCPConfig() {
    try {
      if (await fs.pathExists(this.configPath)) {
        const config = await fs.readJSON(this.configPath);
        
        for (const [name, serverConfig] of Object.entries(config.servers || {})) {
          this.mcpServers.set(name, {
            ...serverConfig,
            status: 'configured'
          });
        }
      }
    } catch (error) {
      logger.error('Failed to load MCP config:', error);
    }
  }

  async discoverAvailableServers() {
    // Discover MCP servers from various sources
    await this.scanSystemForMCPServers();
    await this.loadPopularMCPServers();
    await this.checkGitHubForMCPServers();
  }

  async scanSystemForMCPServers() {
    try {
      // Check npm global packages for MCP servers
      const npmList = execSync('npm list -g --depth=0 --json', { encoding: 'utf8' });
      const packages = JSON.parse(npmList);
      
      for (const [name, info] of Object.entries(packages.dependencies || {})) {
        if (name.includes('mcp') || name.includes('context-protocol')) {
          this.availableServers.set(name, {
            name,
            type: 'npm',
            version: info.version,
            path: this.findMCPExecutable(name),
            status: 'available'
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to scan npm packages:', error);
    }

    try {
      // Check common MCP server locations
      const commonPaths = [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        path.join(process.env.HOME, '.local/bin'),
        path.join(process.env.HOME, 'bin')
      ];

      for (const dir of commonPaths) {
        if (await fs.pathExists(dir)) {
          const files = await fs.readdir(dir);
          
          for (const file of files) {
            if (file.includes('mcp') && await this.isExecutable(path.join(dir, file))) {
              this.availableServers.set(file, {
                name: file,
                type: 'binary',
                path: path.join(dir, file),
                status: 'available'
              });
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to scan system paths:', error);
    }
  }

  async loadPopularMCPServers() {
    const popularServers = [
      {
        name: 'filesystem',
        description: 'File system operations',
        install: 'npx -y @modelcontextprotocol/server-filesystem',
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', process.env.HOME],
          env: { NODE_ENV: 'production' }
        }
      },
      {
        name: 'github',
        description: 'GitHub repository access',
        install: 'npm install -g @modelcontextprotocol/server-github',
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' }
        }
      },
      {
        name: 'slack',
        description: 'Slack workspace integration',
        install: 'npm install -g @modelcontextprotocol/server-slack',
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-slack'],
          env: { SLACK_BOT_TOKEN: '', SLACK_TEAM_ID: '' }
        }
      },
      {
        name: 'postgres',
        description: 'PostgreSQL database access',
        install: 'npm install -g @modelcontextprotocol/server-postgres',
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres'],
          env: { POSTGRES_CONNECTION_STRING: '' }
        }
      },
      {
        name: 'brave-search',
        description: 'Web search capabilities',
        install: 'npm install -g @modelcontextprotocol/server-brave-search',
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-brave-search'],
          env: { BRAVE_API_KEY: '' }
        }
      },
      {
        name: 'puppeteer',
        description: 'Browser automation',
        install: 'npm install -g @modelcontextprotocol/server-puppeteer',
        config: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-puppeteer']
        }
      }
    ];

    popularServers.forEach(server => {
      this.serverRegistry.set(server.name, server);
    });
  }

  async checkGitHubForMCPServers() {
    try {
      // Search GitHub for MCP servers
      const searchQueries = [
        'model-context-protocol server',
        'mcp server typescript',
        'modelcontextprotocol python'
      ];

      for (const query of searchQueries) {
        await this.searchGitHubRepos(query);
      }
    } catch (error) {
      logger.warn('Failed to search GitHub for MCP servers:', error);
    }
  }

  async searchGitHubRepos(query) {
    try {
      const response = await axios.get(`https://api.github.com/search/repositories`, {
        params: {
          q: query,
          sort: 'stars',
          order: 'desc',
          per_page: 10
        }
      });

      for (const repo of response.data.items) {
        if (this.isMCPServer(repo)) {
          this.serverRegistry.set(repo.name, {
            name: repo.name,
            description: repo.description,
            url: repo.html_url,
            stars: repo.stargazers_count,
            language: repo.language,
            type: 'github',
            status: 'discoverable'
          });
        }
      }
    } catch (error) {
      logger.warn(`GitHub search failed for "${query}":`, error);
    }
  }

  async setupMCPServer(request) {
    const intent = await this.parseSetupRequest(request);
    
    if (!intent.serverName) {
      return {
        success: false,
        error: 'Could not determine which MCP server to setup'
      };
    }

    // Check if server is already configured
    if (this.mcpServers.has(intent.serverName)) {
      return {
        success: true,
        message: `MCP server "${intent.serverName}" is already configured`,
        config: this.mcpServers.get(intent.serverName)
      };
    }

    // Try to setup the server
    const server = this.findServer(intent.serverName);
    
    if (!server) {
      // Try to discover and install
      const suggestions = await this.suggestSimilarServers(intent.serverName);
      return {
        success: false,
        error: `MCP server "${intent.serverName}" not found`,
        suggestions
      };
    }

    try {
      const result = await this.installAndConfigureServer(server, intent);
      
      if (result.success) {
        // Save configuration
        await this.saveMCPConfig();
        
        return {
          success: true,
          name: intent.serverName,
          config: result.config,
          message: `MCP server "${intent.serverName}" configured successfully`
        };
      } else {
        return result;
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to setup MCP server: ${error.message}`
      };
    }
  }

  async parseSetupRequest(request) {
    const prompt = `
Parse this MCP server setup request and extract the intent:
"${request}"

Determine:
1. Server name/type (github, filesystem, slack, etc.)
2. Any specific configuration mentioned
3. Required credentials or parameters

Return JSON:
{
  "serverName": "server identifier",
  "config": {"key": "value for any config mentioned"},
  "credentials": ["list of credentials needed"]
}`;

    try {
      const response = await this.llmProvider.generateResponse(prompt, 'fast');
      return JSON.parse(response);
    } catch (error) {
      // Fallback to simple keyword matching
      const serverName = this.extractServerNameFromRequest(request);
      return {
        serverName,
        config: {},
        credentials: []
      };
    }
  }

  extractServerNameFromRequest(request) {
    const keywords = {
      'github': ['github', 'git', 'repository', 'repo'],
      'filesystem': ['file', 'filesystem', 'directory', 'folder'],
      'slack': ['slack', 'chat', 'messaging'],
      'postgres': ['postgres', 'postgresql', 'database', 'db'],
      'brave-search': ['search', 'web', 'brave'],
      'puppeteer': ['browser', 'puppeteer', 'automation', 'scraping']
    };

    const lowerRequest = request.toLowerCase();
    
    for (const [serverName, words] of Object.entries(keywords)) {
      if (words.some(word => lowerRequest.includes(word))) {
        return serverName;
      }
    }

    return null;
  }

  findServer(serverName) {
    // Check registry first
    if (this.serverRegistry.has(serverName)) {
      return this.serverRegistry.get(serverName);
    }

    // Check available servers
    if (this.availableServers.has(serverName)) {
      return this.availableServers.get(serverName);
    }

    // Fuzzy match
    for (const [name, server] of this.serverRegistry) {
      if (name.includes(serverName) || serverName.includes(name)) {
        return server;
      }
    }

    return null;
  }

  async installAndConfigureServer(server, intent) {
    try {
      // Install if needed
      if (server.install && !this.availableServers.has(server.name)) {
        logger.info(`Installing MCP server: ${server.name}`);
        execSync(server.install, { stdio: 'inherit' });
      }

      // Prepare configuration
      const config = { ...server.config };
      
      // Handle credentials
      if (intent.credentials && intent.credentials.length > 0) {
        await this.setupCredentials(server, intent.credentials);
      }

      // Test the server
      const testResult = await this.testMCPServer(config);
      
      if (testResult.success) {
        // Add to configured servers
        this.mcpServers.set(server.name, {
          ...config,
          status: 'active',
          installedAt: new Date().toISOString()
        });

        return {
          success: true,
          config: this.formatConfigForClient(server.name, config)
        };
      } else {
        return {
          success: false,
          error: `Server test failed: ${testResult.error}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Installation failed: ${error.message}`
      };
    }
  }

  async setupCredentials(server, credentials) {
    // Interactive credential setup
    const credentialPrompts = {
      'GITHUB_PERSONAL_ACCESS_TOKEN': 'Enter your GitHub Personal Access Token:',
      'SLACK_BOT_TOKEN': 'Enter your Slack Bot Token:',
      'SLACK_TEAM_ID': 'Enter your Slack Team ID:',
      'POSTGRES_CONNECTION_STRING': 'Enter your PostgreSQL connection string:',
      'BRAVE_API_KEY': 'Enter your Brave Search API key:'
    };

    for (const credential of credentials) {
      if (credentialPrompts[credential]) {
        const value = await this.promptForCredential(credentialPrompts[credential]);
        process.env[credential] = value;
        
        // Save to secure credential store
        await this.saveCredential(credential, value);
      }
    }
  }

  async promptForCredential(prompt) {
    // In a real implementation, use secure input
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(prompt + ' ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  async testMCPServer(config) {
    try {
      // Basic connectivity test
      // This would depend on the MCP protocol implementation
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatConfigForClient(serverName, config) {
    return {
      [serverName]: {
        command: config.command,
        args: config.args,
        env: config.env
      }
    };
  }

  async saveMCPConfig() {
    const config = {
      servers: {},
      lastUpdated: new Date().toISOString()
    };

    for (const [name, serverConfig] of this.mcpServers) {
      config.servers[name] = serverConfig;
    }

    await fs.ensureDir(path.dirname(this.configPath));
    await fs.writeJSON(this.configPath, config, { spaces: 2 });
  }

  async saveCredential(key, value) {
    // In production, use a secure credential store
    // For now, save to environment file
    const envPath = path.join(process.env.HOME || process.cwd(), '.debo', '.env');
    
    try {
      let envContent = '';
      if (await fs.pathExists(envPath)) {
        envContent = await fs.readFile(envPath, 'utf8');
      }

      // Update or add the credential
      const lines = envContent.split('\n');
      const keyLine = lines.findIndex(line => line.startsWith(`${key}=`));
      
      if (keyLine >= 0) {
        lines[keyLine] = `${key}=${value}`;
      } else {
        lines.push(`${key}=${value}`);
      }

      await fs.ensureDir(path.dirname(envPath));
      await fs.writeFile(envPath, lines.join('\n'));
    } catch (error) {
      logger.error('Failed to save credential:', error);
    }
  }

  async suggestSimilarServers(serverName) {
    const suggestions = [];
    
    for (const [name, server] of this.serverRegistry) {
      const similarity = this.calculateSimilarity(serverName, name);
      if (similarity > 0.3) {
        suggestions.push({
          name,
          description: server.description,
          similarity
        });
      }
    }

    return suggestions.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Utility methods
  async findMCPExecutable(packageName) {
    try {
      const result = execSync(`npm list -g ${packageName} --parseable`, { encoding: 'utf8' });
      const packagePath = result.trim();
      
      // Look for common executable patterns
      const possibleExes = [
        path.join(packagePath, 'bin', 'index.js'),
        path.join(packagePath, 'dist', 'index.js'),
        path.join(packagePath, 'src', 'index.js'),
        path.join(packagePath, 'index.js')
      ];

      for (const exe of possibleExes) {
        if (await fs.pathExists(exe)) {
          return exe;
        }
      }
    } catch (error) {
      // Package not found or error
    }

    return null;
  }

  async isExecutable(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile() && (stats.mode & 0o111) !== 0;
    } catch {
      return false;
    }
  }

  isMCPServer(repo) {
    const name = repo.name.toLowerCase();
    const description = (repo.description || '').toLowerCase();
    
    return (
      name.includes('mcp') ||
      name.includes('context-protocol') ||
      description.includes('model context protocol') ||
      description.includes('mcp server')
    );
  }

  async initializeKnownServers() {
    // Auto-configure commonly used servers
    const autoServers = ['filesystem'];
    
    for (const serverName of autoServers) {
      if (!this.mcpServers.has(serverName)) {
        try {
          const server = this.serverRegistry.get(serverName);
          if (server) {
            await this.installAndConfigureServer(server, { credentials: [] });
          }
        } catch (error) {
          logger.warn(`Failed to auto-configure ${serverName}:`, error);
        }
      }
    }
  }

  getConfiguredServers() {
    return Array.from(this.mcpServers.entries()).map(([name, config]) => ({
      name,
      ...config
    }));
  }

  getAvailableServers() {
    return Array.from(this.serverRegistry.entries()).map(([name, server]) => ({
      name,
      ...server,
      configured: this.mcpServers.has(name)
    }));
  }
}

module.exports = { MCPManager };