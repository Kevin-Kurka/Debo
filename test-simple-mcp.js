#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('Starting MCP server test...\n');

const child = spawn('node', ['src/mcp_server_generic.js'], {
  stdio: ['pipe', 'pipe', 'inherit'] // Inherit stderr to see errors directly
});

// Capture stdout
let responses = [];
child.stdout.on('data', (data) => {
  const text = data.toString();
  console.log('Received:', text);
  responses.push(text);
});

// Send test sequence
async function runTest() {
  // Wait for server startup
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 1: Initialize
  console.log('\n--- Sending initialize request ---');
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
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: List tools
  console.log('\n--- Sending tools/list request ---');
  const listRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  };
  child.stdin.write(JSON.stringify(listRequest) + '\n');
  
  // Wait and check
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n--- Test Results ---');
  console.log('Total responses:', responses.length);
  console.log('Responses received:', responses.map(r => r.trim()).filter(r => r));
  
  // Cleanup
  child.kill();
  process.exit(0);
}

child.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

runTest().catch(console.error);