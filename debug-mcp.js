#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';

const logFile = fs.createWriteStream('/tmp/debo-debug.log');

const child = spawn('node', ['src/mcp_server_generic.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Log everything
child.stdout.on('data', (data) => {
  const text = data.toString();
  logFile.write(`STDOUT: ${text}`);
  console.log('STDOUT:', text);
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  logFile.write(`STDERR: ${text}`);
  if (!text.includes('info:')) {
    console.error('STDERR:', text);
  }
});

// Send initialize after 3 seconds
setTimeout(() => {
  console.log('\n--- Sending initialize ---');
  const req = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {} }
  };
  console.log('Request:', JSON.stringify(req));
  child.stdin.write(JSON.stringify(req) + '\n');
}, 3000);

// Kill after 10 seconds
setTimeout(() => {
  console.log('\n--- Stopping server ---');
  logFile.end();
  child.kill();
  process.exit(0);
}, 10000);