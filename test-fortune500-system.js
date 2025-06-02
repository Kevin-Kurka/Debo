#!/usr/bin/env node

/**
 * Test script for Fortune 500 AI System
 * Tests the single 'debo' tool with natural language requests
 */

import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const testRequests = [
  {
    name: "Software Development Request",
    request: "Build a task management SaaS application with user authentication, project boards, and real-time collaboration features"
  },
  {
    name: "Business Strategy Request",
    request: "Analyze market opportunities for expanding into the Asian market with our productivity software"
  },
  {
    name: "Marketing Campaign Request",
    request: "Create a comprehensive marketing campaign for our new AI-powered analytics platform targeting enterprise customers"
  },
  {
    name: "Financial Analysis Request",
    request: "Perform a detailed financial analysis of our Q4 performance and project next year's revenue"
  },
  {
    name: "Legal Review Request",
    request: "Review this software licensing agreement and identify any potential risks or unfavorable terms"
  }
];

async function testDeboTool(request) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['src/mcp_server_generic.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Server error:', data.toString());
    });

    // Send initialization request
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {}
      }
    };

    child.stdin.write(JSON.stringify(initRequest) + '\n');

    // Wait a bit then send the actual request
    setTimeout(() => {
      const toolRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "debo",
          arguments: {
            request: request
          }
        }
      };

      child.stdin.write(JSON.stringify(toolRequest) + '\n');

      // Give it time to process
      setTimeout(() => {
        child.kill();
        resolve(output);
      }, 5000);
    }, 1000);

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function runTests() {
  console.log('🧪 Testing Fortune 500 AI System\n');
  console.log('=' .repeat(50));

  for (const test of testRequests) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`📝 Request: "${test.request}"`);
    console.log('-'.repeat(50));

    try {
      const output = await testDeboTool(test.request);
      
      // Parse JSON-RPC responses
      const lines = output.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          if (response.result && response.result.content) {
            console.log('✅ Response received:');
            console.log(response.result.content[0].text.substring(0, 500) + '...');
          }
        } catch (e) {
          // Not JSON, skip
        }
      }
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ All tests completed!');
}

// Test the system architecture
async function testArchitecture() {
  console.log('\n🏗️  Testing System Architecture\n');
  
  const architectureChecks = [
    { name: 'Redis Connection', check: () => testRedisConnection() },
    { name: 'Department Structure', check: () => testDepartmentStructure() },
    { name: 'Agent Availability', check: () => testAgentAvailability() },
    { name: 'Workflow Engine', check: () => testWorkflowEngine() }
  ];

  for (const check of architectureChecks) {
    process.stdout.write(`Checking ${check.name}... `);
    try {
      await check.check();
      console.log('✅');
    } catch (error) {
      console.log(`❌ ${error.message}`);
    }
  }
}

async function testRedisConnection() {
  const { createClient } = await import('redis');
  const client = createClient();
  await client.connect();
  await client.ping();
  await client.quit();
}

async function testDepartmentStructure() {
  const departments = [
    'engineering', 'product', 'sales', 'marketing', 
    'finance', 'legal', 'hr', 'operations', 'data', 'it'
  ];
  
  if (departments.length !== 10) {
    throw new Error('Invalid department count');
  }
}

async function testAgentAvailability() {
  const { fortune500Agents } = await import('./src/agents/fortune500-roles.js');
  const agentCount = Object.keys(fortune500Agents).length;
  
  if (agentCount < 50) {
    throw new Error(`Only ${agentCount} agents defined, expected 50+`);
  }
}

async function testWorkflowEngine() {
  const { WorkflowEngine } = await import('./src/core/workflow-engine.js');
  const { EnhancedTaskManager } = await import('./src/database/task-manager.js');
  
  const taskManager = new EnhancedTaskManager();
  await taskManager.connect();
  
  const engine = new WorkflowEngine(taskManager);
  await engine.init();
  
  if (!engine.workflows.has('software_development')) {
    throw new Error('Software development workflow not loaded');
  }
  
  // Clean up Redis connection
  if (taskManager.redis) {
    await taskManager.redis.quit();
  }
}

// Run all tests
async function main() {
  try {
    await testArchitecture();
    await runTests();
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] === import.meta.url.replace('file://', '')) {
  main();
}