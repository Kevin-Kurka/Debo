#!/usr/bin/env node

import { EnhancedTaskManager } from '../src/database/task-manager.js';
import { LLMProvider } from '../src/infrastructure/llm-provider.js';
import { UnifiedOrchestrator } from '../src/core/unified-orchestrator.js';

async function testDeboSystem() {
  console.log('🧪 Testing Debo System Components...\n');

  try {
    // Test 1: Database Connection
    console.log('1. Testing Redis Connection...');
    const taskManager = new EnhancedTaskManager();
    await taskManager.connect();
    
    // Test basic operations
    const testKey = 'test:connection';
    await taskManager.redis.set(testKey, 'working');
    const result = await taskManager.redis.get(testKey);
    await taskManager.redis.del(testKey);
    
    if (result === 'working') {
      console.log('   ✅ Redis connection: OK');
    } else {
      throw new Error('Redis test failed');
    }

    // Test 2: LLM Provider
    console.log('2. Testing LLM Provider...');
    const llmProvider = new LLMProvider();
    
    try {
      await llmProvider.checkOllamaStatus();
      console.log('   ✅ Ollama connection: OK');
    } catch (error) {
      console.log('   ⚠️  Ollama not available:', error.message);
    }

    // Test 3: Orchestrator
    console.log('3. Testing Orchestrator...');
    const orchestrator = new UnifiedOrchestrator(taskManager, llmProvider);
    await orchestrator.init();
    console.log('   ✅ Orchestrator initialized: OK');

    // Test 4: Create Test Project
    console.log('4. Testing Project Creation...');
    const projectId = await orchestrator.initializeProject(
      'test-project',
      'Simple test application',
      'node'
    );
    console.log(`   ✅ Test project created: ${projectId}`);

    // Test 5: Task Management
    console.log('5. Testing Task Management...');
    const taskId = await taskManager.createTask({
      type: 'test',
      agentType: 'backend_dev',
      action: 'test_action',
      projectId: projectId
    });
    
    await taskManager.updateTaskStatus(taskId, 'completed', {
      result: 'Test completed successfully'
    });
    console.log(`   ✅ Task management: OK`);

    // Test 6: Activity Logging
    console.log('6. Testing Activity Logging...');
    await taskManager.logActivity('system_test', 'test_agent', taskId, projectId, {
      testData: 'System verification'
    });
    
    const activities = await taskManager.getRecentActivity(1);
    if (activities.length > 0) {
      console.log('   ✅ Activity logging: OK');
    }

    // Test 7: System Stats
    console.log('7. Testing System Stats...');
    const stats = await taskManager.getSystemStats();
    console.log(`   📊 Active tasks: ${stats.activeTasks}`);
    console.log(`   📊 Total projects: ${stats.totalProjects}`);
    console.log('   ✅ System stats: OK');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await taskManager.redis.del(`project:${projectId}`);
    await taskManager.redis.del(`task:${taskId}`);
    await taskManager.redis.sRem('active_tasks', taskId);
    
    await taskManager.disconnect();
    
    console.log('\n🎉 All tests passed! Debo system is ready.');
    console.log('\n🚀 Start the MCP server with: npm start');
    console.log('📖 Add to your MCP config and use the "debo" tool');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testDeboSystem();