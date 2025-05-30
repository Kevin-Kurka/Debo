const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const redis = require('redis');
const { spawn } = require('child_process');
const path = require('path');
const DependencyInstaller = require('./dependency_installer');

class DBotMCPServer {
    constructor() {
        this.server = new Server({
            name: 'dbot',
            version: '1.0.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
        
        this.dependencyInstaller = new DependencyInstaller();
        this.setupRedis();
        this.setupTools();
        this.ensureDependencies();
    }

    async ensureDependencies() {
        try {
            await this.dependencyInstaller.checkAndInstallAll();
            console.error('✅ All dependencies ready');
        } catch (error) {
            console.error('⚠️ Dependency installation issues:', error.message);
        }
    }

    async setupRedis() {
        try {
            this.redis = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
            await this.redis.connect();
        } catch (error) {
            console.error('Redis connection failed:', error.message);
        }
    }

    setupTools() {
        this.server.setRequestHandler('tools/list', async () => ({
            tools: [
                {
                    name: 'dbot',
                    description: 'Development Bot - AI-powered development assistant',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            request: { type: 'string', description: 'Development request or feature' },
                            project_path: { type: 'string', description: 'Project directory path' },
                            context: { type: 'string', description: 'Additional context' }
                        },
                        required: ['request']
                    }
                }
            ]
        }));

        this.server.setRequestHandler('tools/call', async (request) => {
            if (request.params.name === 'dbot') {
                return await this.dbot(request.params.arguments);
            }
            throw new Error(`Unknown tool: ${request.params.name}`);
        });
    }

    async dbot({ request, project_path = '', context = '' }) {
        try {
            if (!this.redis) {
                return { content: [{ type: 'text', text: 'Redis not connected. Run setup first.' }] };
            }

            const requestId = Date.now().toString();
            await this.redis.hSet(`request:${requestId}`, {
                request,
                project_path,
                context,
                status: 'pending',
                timestamp: new Date().toISOString()
            });

            const result = await this.triggerOrchestrator(requestId);
            
            return {
                content: [{
                    type: 'text',
                    text: `Request ID: ${requestId}\nResponse: ${result}`
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: 'text',
                    text: `Error: ${error.message}`
                }]
            };
        }
    }

    async createProject({ name, template = 'nextjs' }) {
        try {
            const result = await this.runPython('project_manager.py', ['create', name, template]);
            return {
                content: [{
                    type: 'text',
                    text: result
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: 'text',
                    text: `Error creating project: ${error.message}`
                }]
            };
        }
    }

    async triggerOrchestrator(requestId) {
        return await this.runPython('orchestrator.py', ['process', requestId]);
    }

    async runPython(script, args) {
        return new Promise((resolve, reject) => {
            const python = spawn('python3', [
                path.join(__dirname, '../agents', script),
                ...args
            ]);

            let output = '';
            let error = '';
            
            python.stdout.on('data', (data) => output += data.toString());
            python.stderr.on('data', (data) => error += data.toString());
            
            python.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(error || `Process exited with code ${code}`));
                }
            });
        });
    }

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('DBot MCP Server started');
    }
}

const server = new DBotMCPServer();
server.start().catch(console.error);
