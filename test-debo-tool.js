#!/usr/bin/env node

import { spawn } from 'child_process';

const child = spawn('node', ['src/mcp_server_generic.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';
let responseCount = 0;

child.stdout.on('data', (data) => {
  output += data.toString();
  const lines = data.toString().split('\n').filter(l => l.trim());
  for (const line of lines) {
    if (line.startsWith('{') && line.includes('jsonrpc')) {
      responseCount++;
      console.log('\n=== Response', responseCount, '===');
      
      // Parse and show the actual response content
      try {
        const response = JSON.parse(line);
        if (response.result) {
          if (response.result.serverInfo) {
            console.log('Server initialized:', response.result.serverInfo.name, response.result.serverInfo.version);
          } else if (response.result.content) {
            console.log('Response Content:');
            console.log(response.result.content[0].text);
            console.log('=================\n');
          }
        }
      } catch (e) {
        console.log('Raw response:', line.substring(0, 200) + '...');
      }
    }
  }
});

child.stderr.on('data', (data) => {
  // Only log actual errors, not info messages
  const msg = data.toString();
  if (!msg.includes('info:')) {
    errorOutput += msg;
  }
});

// Wait for server to start
setTimeout(() => {
  console.log('Sending initialization request...');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {}
    }
  };
  
  child.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // Wait for response then send tool call
  setTimeout(() => {
    console.log('\nSending tool call request...');
    const toolRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'debo',
        arguments: {
          request: 'Create a simple todo list web application with React'
        }
      }
    };
    
    child.stdin.write(JSON.stringify(toolRequest) + '\n');
    
    // Wait for response
    setTimeout(() => {
      console.log('\nTotal responses received:', responseCount);
      if (errorOutput) {
        console.log('\nErrors:', errorOutput);
      }
      if (!output.includes('jsonrpc')) {
        console.log('\nNo JSON-RPC responses received. Raw output:', output.substring(0, 500));
      }
      console.log('\nTest completed. Shutting down server...');
      child.kill();
      process.exit(0);
    }, 15000); // Give more time for processing
  }, 2000);
}, 3000);

child.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});