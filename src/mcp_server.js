const { MCPServer } = require('@modelcontextprotocol/sdk');
const redis = require('redis');
const { spawn } = require('child_process');
const path = require('path');

class DBotMCPServer {
    constructor() {
        this.redis = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        this.server = new MCPServer({ name: 'dbot', version: '1.0.0' });
        this.orchestratorProcess = null;
        this.setupTools();
    }

    setupTools() {
        // Main DBot tool for any MCP-capable application
        this.server.tool('dbot', 'Development Bot - AI-powered development assistant', {
            type: 'object',
            properties: {
                request: { type: 'string', description: 'Development request or feature' },
                project_path: { type: 'string', description: 'Project directory path' },
                context: { type: 'string', description: 'Additional context' }
            },
            required: ['request']
        }, this.dbot.bind(this));

        // Project management tools
        this.server.tool('create_project', 'Create new project', {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Project name' },
                template: { type: 'string', description: 'Project template' }
            },
            required: ['name']
        }, this.createProject.bind(this));

        this.server.tool('list_projects', 'List all projects', {}, this.listProjects.bind(this));
    }

    async dbot({ request, project_path = '', context = '' }) {
        try {
            // Store request in Redis for orchestrator
            const requestId = Date.now().toString();
            await this.redis.hset(`request:${requestId}`, {
                request,
                project_path,
                context,
                status: 'pending',
                timestamp: new Date().toISOString()
            });

            // Trigger orchestrator processing
            const result = await this.triggerOrchestrator(requestId);
            
            return {
                success: true,
                request_id: requestId,
                response: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async createProject({ name, template = 'nextjs' }) {
        try {
            const python = spawn('python3', [
                path.join(__dirname, '../agents/project_manager.py'),
                'create',
                name,
                template
            ]);

            return new Promise((resolve) => {
                let output = '';
                python.stdout.on('data', (data) => output += data);
                python.on('close', () => {
                    resolve({ success: true, output });
                });
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async listProjects() {
        const projects = await this.redis.smembers('projects:list');
        return { projects: projects.map(p => p.replace('project:', '')) };
    }

    async triggerOrchestrator(requestId) {
        // Launch Python orchestrator for processing
        const python = spawn('python3', [
            path.join(__dirname, '../agents/orchestrator.py'),
            'process',
            requestId
        ]);

        return new Promise((resolve, reject) => {
            let output = '';
            let error = '';
            
            python.stdout.on('data', (data) => output += data);
            python.stderr.on('data', (data) => error += data);
            
            python.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(error));
                }
            });
        });
    }

    async start() {
        await this.redis.connect();
        const port = process.env.MCP_PORT || 3000;
        
        this.server.listen(port, () => {
            console.log(`DBot MCP Server running on port ${port}`);
            console.log('Ready for @dbot integration in any MCP-capable application');
        });
    }
}

// Start server
const server = new DBotMCPServer();
server.start().catch(console.error);

module.exports = DBotMCPServer;
