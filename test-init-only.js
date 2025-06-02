#!/usr/bin/env node

import { spawn } from 'child_process';

const child = spawn('node', ['src/mcp_server_generic.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let gotResponse = false;

child.stdout.on('data', (data) => {
  const text = data.toString();
  if (text.includes('jsonrpc')) {
    console.log('Got JSON-RPC response:', text.trim());
    gotResponse = true;
    
    try {
      const response = JSON.parse(text.trim());
      if (response.result && response.result.serverInfo) {
        console.log('\n✅ Server initialized successfully!');
        console.log('Server:', response.result.serverInfo.name);
        console.log('Version:', response.result.serverInfo.version);
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
});

// Send initialize request after server starts
setTimeout(() => {
  console.log('Sending initialize request...\n');
  
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {}
    }
  };
  
  child.stdin.write(JSON.stringify(request) + '\n');
}, 3000);

// Check results
setTimeout(() => {
  if (!gotResponse) {
    console.log('❌ No response received from server');
  }
  child.kill();
  process.exit(gotResponse ? 0 : 1);
}, 8000);