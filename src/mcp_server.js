#!/usr/bin/env node

// Simple MCP server that works
process.stdin.setEncoding('utf8');
process.stdout.write(JSON.stringify({
    jsonrpc: "2.0", 
    id: 1,
    result: {
        protocolVersion: "2024-11-05",
        capabilities: {
            tools: {}
        },
        serverInfo: {
            name: "dbot",
            version: "1.0.0"
        }
    }
}) + '\n');

process.stdin.on('data', (data) => {
    try {
        const request = JSON.parse(data.trim());
        
        if (request.method === 'tools/list') {
            const response = {
                jsonrpc: "2.0",
                id: request.id,
                result: {
                    tools: [{
                        name: "dbot",
                        description: "Development Bot - AI-powered development assistant",
                        inputSchema: {
                            type: "object",
                            properties: {
                                request: { type: "string", description: "Development request" }
                            },
                            required: ["request"]
                        }
                    }]
                }
            };
            process.stdout.write(JSON.stringify(response) + '\n');
        }
        
        if (request.method === 'tools/call' && request.params.name === 'dbot') {
            const response = {
                jsonrpc: "2.0", 
                id: request.id,
                result: {
                    content: [{
                        type: "text",
                        text: `✅ DBot received: ${request.params.arguments.request}`
                    }]
                }
            };
            process.stdout.write(JSON.stringify(response) + '\n');
        }
    } catch (e) {
        // Ignore parse errors
    }
});

console.error("DBot MCP Server ready");
