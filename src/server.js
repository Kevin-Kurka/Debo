const { MCPServer } = require('@modelcontextprotocol/sdk');
const redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();

class DBotServer {
    constructor() {
        this.redis = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        this.server = new MCPServer({ name: 'dbot', version: '1.0.0' });
        this.setupHandlers();
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
            // Store request in Redis
            await this.redis.lpush(`project:${project_id}:requests`, JSON.stringify({
                request,
                timestamp: new Date().toISOString(),
                status: 'pending'
            }));

            // Route to orchestrator
            const response = await this.processWithOrchestrator(request, project_id);
            return { success: true, response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async processWithOrchestrator(request, project_id) {
        // Placeholder for orchestrator integration
        return `Processing request: ${request} for project: ${project_id}`;
    }

    async start() {
        await this.redis.connect();
        await this.server.listen();
        console.log('DBot MCP Server running on http://localhost:3000');
    }
}

const server = new DBotServer();
server.start();
