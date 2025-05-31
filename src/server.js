import { MCPServer } from '@modelcontextprotocol/sdk';
import redis from 'redis';
import { config, validateConfig } from './config.js';
import logger from './logger.js';
import { schemas } from './validation.js';

class DBotServer {
    constructor() {
        this.redis = null;
        this.server = null;
        this.initialized = false;
    }

    async init() {
        try {
            validateConfig();
            
            this.redis = redis.createClient({ 
                url: config.redis.url,
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        return new Error('Redis server refused connection');
                    }
                    if (options.times_connected > config.redis.maxRetries) {
                        return undefined;
                    }
                    return Math.min(options.attempt * config.redis.retryDelay, 3000);
                }
            });

            this.server = new MCPServer({ 
                name: config.server.name, 
                version: config.server.version 
            });
            
            this.setupHandlers();
            this.initialized = true;
            
            await logger.info('DBotServer initialized successfully');
        } catch (error) {
            await logger.error('Failed to initialize DBotServer', error);
            throw error;
        }
    }

    setupHandlers() {
        this.server.tool('route_request', 'Route development requests to orchestrator', {
            type: 'object',
            properties: {
                request: { type: 'string', description: 'Development request' },
                project_id: { type: 'string', description: 'Project identifier' }
            }
        }, this.routeRequest.bind(this));
    }

    async routeRequest({ request, project_id }) {
        try {
            // Validate input
            const validated = schemas.mcpRequest.parse({ request, project_id });
            
            // Store request in Redis
            await this.redis.lpush(`project:${validated.project_id}:requests`, JSON.stringify({
                request: validated.request,
                timestamp: new Date().toISOString(),
                status: 'pending'
            }));

            const response = await this.processWithOrchestrator(validated.request, validated.project_id);
            
            await logger.info('Request processed successfully', { 
                project_id: validated.project_id,
                request_preview: validated.request.substring(0, 100)
            });
            
            return { success: true, response };
        } catch (error) {
            await logger.error('Failed to route request', error, { request, project_id });
            return { success: false, error: error.message };
        }
    }

    async processWithOrchestrator(request, project_id) {
        // Enhanced orchestrator integration placeholder
        await logger.info('Processing with orchestrator', { project_id, request });
        return `Processing request: ${request} for project: ${project_id}`;
    }

    async start() {
        if (!this.initialized) await this.init();
        
        try {
            await this.redis.connect();
            await this.server.listen();
            
            await logger.info('DBot MCP Server started', { 
                host: config.server.host,
                port: config.server.port 
            });
            
            console.log(`DBot MCP Server running on http://${config.server.host}:${config.server.port}`);
        } catch (error) {
            await logger.error('Failed to start server', error);
            throw error;
        }
    }

    async stop() {
        try {
            if (this.redis) await this.redis.disconnect();
            if (this.server) await this.server.close();
            await logger.info('DBot MCP Server stopped');
        } catch (error) {
            await logger.error('Error during server shutdown', error);
        }
    }
}

const server = new DBotServer();

// Graceful shutdown
process.on('SIGINT', async () => {
    await logger.info('Received SIGINT, shutting down gracefully');
    await server.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await logger.info('Received SIGTERM, shutting down gracefully');
    await server.stop();
    process.exit(0);
});

// Start server
server.start().catch(async (error) => {
    await logger.error('Failed to start server', error);
    process.exit(1);
});
