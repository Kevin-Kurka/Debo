#!/usr/bin/env node

/**
 * Demo of the Fortune 500 AI System
 * Shows how to use the single 'debo' tool with natural language
 */

import { spawn } from 'child_process';

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           🏢 Debo Fortune 500 AI System Demo 🏢               ║
╠═══════════════════════════════════════════════════════════════╣
║  Watch as our AI corporation handles your request through:    ║
║  • Executive analysis and delegation                          ║
║  • Department coordination                                    ║
║  • Specialized agent execution                               ║
║  • Real-time progress tracking                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Suppress info logs by redirecting stderr
const child = spawn('node', ['src/mcp_server_generic.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, LOG_LEVEL: 'error' }
});

let buffer = '';
let initialized = false;

child.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // Process complete JSON messages
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim() && line.startsWith('{')) {
      try {
        const msg = JSON.parse(line);
        handleResponse(msg);
      } catch (e) {
        // Not JSON, ignore
      }
    }
  }
});

child.stderr.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('error:') && !msg.includes('info:')) {
    console.error('Server error:', msg);
  }
});

function handleResponse(msg) {
  if (msg.result) {
    if (msg.result.serverInfo) {
      console.log('✅ Server initialized successfully\n');
      initialized = true;
    } else if (msg.result.content) {
      console.log('📨 Response from Debo:\n');
      console.log(msg.result.content[0].text);
      console.log('\n' + '═'.repeat(60) + '\n');
    }
  } else if (msg.error) {
    console.error('❌ Error:', msg.error.message);
  }
}

// Demo sequence
async function runDemo() {
  // Wait for server startup
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Initialize
  console.log('🚀 Initializing connection...');
  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {} }
  }) + '\n');
  
  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (!initialized) {
    console.log('⚠️  Server initialization in progress...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Demo request
  console.log('📝 Sending request: "Build a task management web app with user authentication"\n');
  
  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'debo',
      arguments: {
        request: 'Build a task management web app with user authentication, project organization, and real-time updates'
      }
    }
  }) + '\n');
  
  // Wait for response
  console.log('⏳ AI Corporation processing your request...\n');
  await new Promise(resolve => setTimeout(resolve, 20000));
  
  console.log('\n✨ Demo completed!');
  console.log('💡 Try running with your own requests!\n');
  
  child.kill();
  process.exit(0);
}

child.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  child.kill();
  process.exit(0);
});

runDemo().catch(console.error);