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
                },
                {
                    name: 'create_project',
                    description: 'Create new project',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Project name' },
                            template: { type: 'string', description: 'Project template' }
                        },
                        required: ['name']
                    }
                }
            ]
        }));

        this.server.setRequestHandler('tools/call', async (request) => {
            if (request.params.name === 'dbot') {
                return await this.dbot(request.params.arguments);
            } else if (request.params.name === 'create_project') {
                return await this.createProject(request.params.arguments);
            } else if (request.params.name === 'execute_command') {
                return await this.executeCommand(request.params.arguments);
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
                },
                {
                    name: 'execute_command',
                    description: 'Execute terminal command via DBot',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            command: { type: 'string', description: 'Terminal command to execute' },
                            background: { type: 'boolean', description: 'Run in background' }
                        },
                        required: ['command']
                    }
                }

    async executeCommand({ command, background = false }) {
        try {
            const result = await this.runCommand(command, background);
            return {
                content: [{
                    type: 'text',
                    text: `Command: ${command}\nResult: ${JSON.stringify(result, null, 2)}`
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: 'text',
                    text: `Command failed: ${error.message}`
                }]
            };
        }
    }

    async runCommand(command, background = false) {
        return new Promise((resolve, reject) => {
            const child = spawn('sh', ['-c', command]);
            
            if (background) {
                resolve({ status: 'running', pid: child.pid });
                return;
            }
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => stdout += data.toString());
            child.stderr.on('data', (data) => stderr += data.toString());
            
            child.on('close', (code) => {
                resolve({
                    success: code === 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: code
                });
            });
        });
    }
