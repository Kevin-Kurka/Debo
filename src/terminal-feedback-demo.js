#!/usr/bin/env node

import { getTerminalFeedbackSystem } from './terminal-feedback-system.js';
import EnhancedTaskManager from './database/task-manager.js';
import EnhancedAgentExecutor from './agents/enhanced-executor.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Demo script for the Terminal Feedback System
 * 
 * This demonstrates how the feedback system provides real-time visibility
 * into Debo's operations with parallel agent activities and database operations
 */

async function simulateAgentActivity(feedbackSystem, agentId, role, duration = 10000) {
  const steps = [
    { progress: 0, message: 'Initializing agent', nextSteps: ['Load context', 'Validate requirements'] },
    { progress: 20, message: 'Loading project context', nextSteps: ['Analyze requirements', 'Plan approach'] },
    { progress: 40, message: 'Analyzing requirements', nextSteps: ['Generate solution', 'Validate approach'] },
    { progress: 60, message: 'Implementing solution', nextSteps: ['Test implementation', 'Document code'] },
    { progress: 80, message: 'Running tests', nextSteps: ['Finalize deliverables', 'Update documentation'] },
    { progress: 100, message: 'Task completed', nextSteps: [] }
  ];

  const taskName = `${role.replace('_', ' ')} task ${Math.floor(Math.random() * 1000)}`;
  
  for (const step of steps) {
    feedbackSystem.reportAgentActivity(agentId, {
      role,
      task: taskName,
      objective: `Complete ${taskName} with high quality`,
      progress: step.progress,
      status: step.progress === 100 ? 'completed' : 'active',
      message: step.message,
      dataAvailable: [
        'Project specifications',
        'Previous deliverables',
        `${Math.floor(Math.random() * 10) + 1} related files`
      ],
      nextSteps: step.nextSteps
    });

    // Simulate some database operations
    if (Math.random() > 0.5) {
      feedbackSystem.reportDatabaseOperation({
        type: ['read', 'write', 'update'][Math.floor(Math.random() * 3)],
        table: ['project', 'task', 'deliverables', 'requirements'][Math.floor(Math.random() * 4)],
        key: uuidv4().substring(0, 8),
        operation: ['hSet', 'sAdd', 'hGetAll', 'sMembers'][Math.floor(Math.random() * 4)],
        agent: role,
        success: Math.random() > 0.1
      });
    }

    await new Promise(resolve => setTimeout(resolve, duration / steps.length));
  }
}

async function main() {
  console.log('Starting Debo Terminal Feedback System Demo...\n');
  
  // Initialize the feedback system
  const feedbackSystem = getTerminalFeedbackSystem();
  
  try {
    // Initialize the terminal UI
    await feedbackSystem.init();
    
    // Show welcome notification
    feedbackSystem.showNotification('Welcome to Debo Terminal Feedback System Demo', 3000);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start with parallel view
    feedbackSystem.setLayout('parallel');
    
    // Simulate multiple agents working in parallel
    const agents = [
      { id: 'agent-1', role: 'backend_developer' },
      { id: 'agent-2', role: 'frontend_developer' },
      { id: 'agent-3', role: 'qa_engineer' },
      { id: 'agent-4', role: 'devops_engineer' }
    ];
    
    // Start all agents
    const promises = agents.map(agent => 
      simulateAgentActivity(feedbackSystem, agent.id, agent.role, 15000)
    );
    
    // Show different layouts after delays
    setTimeout(() => {
      feedbackSystem.showNotification('Switching to Sequential View');
      feedbackSystem.setLayout('sequential');
    }, 5000);
    
    setTimeout(() => {
      feedbackSystem.showNotification('Switching to Summary View');
      feedbackSystem.setLayout('summary');
    }, 10000);
    
    setTimeout(() => {
      feedbackSystem.showNotification('Back to Parallel View');
      feedbackSystem.setLayout('parallel');
    }, 15000);
    
    // Wait for all agents to complete
    await Promise.all(promises);
    
    // Show completion
    feedbackSystem.showNotification('All agents completed their tasks!', 5000);
    
    // Keep running for a bit to show the UI
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('Demo error:', error);
  } finally {
    // Shutdown
    await feedbackSystem.shutdown();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  const feedbackSystem = getTerminalFeedbackSystem();
  await feedbackSystem.shutdown();
  process.exit(0);
});

// Run the demo
main().catch(console.error);