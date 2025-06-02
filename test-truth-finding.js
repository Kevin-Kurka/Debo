#!/usr/bin/env node

/**
 * Test script for the Truth-Finding System
 * This script tests the truth investigation functionality
 */

import { EnhancedTaskManager } from './src/database/task-manager.js';
import { LLMProvider } from './src/infrastructure/llm-provider.js';
import { UnifiedOrchestrator } from './src/core/unified-orchestrator.js';
import logger from './src/logger.js';

async function testTruthFinding() {
  const taskManager = new EnhancedTaskManager();
  const llmProvider = new LLMProvider();
  
  try {
    console.log('🔍 Initializing Truth-Finding System Test...\n');
    
    // Connect to Redis
    await taskManager.connect();
    await llmProvider.init();
    
    // Create orchestrator
    const orchestrator = new UnifiedOrchestrator(taskManager, llmProvider);
    await orchestrator.init();
    
    console.log('✅ System initialized successfully\n');
    
    // Test cases
    const testCases = [
      {
        name: 'General Claim Test',
        claim: 'The Earth is round and orbits the sun',
        type: 'general'
      },
      {
        name: 'Political Statement Test',
        claim: 'The president said the economy is improving',
        type: 'political',
        sources: ['President Biden', 'State of the Union 2024']
      },
      {
        name: 'Scientific Claim Test',
        claim: 'Vaccines cause autism',
        type: 'scientific',
        sources: ['Wakefield et al. 1998', 'CDC Studies 2019']
      }
    ];
    
    // Run a single test (comment out to run all)
    const singleTest = testCases[0];
    
    console.log(`📋 Testing: ${singleTest.name}`);
    console.log(`📌 Claim: "${singleTest.claim}"`);
    console.log(`📂 Type: ${singleTest.type}`);
    if (singleTest.sources) {
      console.log(`📚 Sources: ${singleTest.sources.join(', ')}`);
    }
    console.log('\n🔄 Starting investigation...\n');
    
    // Start investigation
    const investigationId = await orchestrator.investigateClaim(
      singleTest.claim,
      {
        type: singleTest.type,
        sources: singleTest.sources || []
      }
    );
    
    console.log(`✅ Investigation started with ID: ${investigationId}\n`);
    
    // Poll for results
    let status = 'in_progress';
    let checkCount = 0;
    const maxChecks = 30; // 2.5 minutes max
    
    while (status === 'in_progress' && checkCount < maxChecks) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const results = await orchestrator.getInvestigationResults(investigationId);
      status = results.status;
      checkCount++;
      
      process.stdout.write(`\r⏳ Checking status... (${checkCount * 5}s elapsed)`);
      
      if (status === 'completed') {
        console.log('\n\n✅ Investigation completed!\n');
        
        // Display results
        const verdict = results.results?.finalVerdict;
        if (verdict) {
          console.log('📊 VERDICT:', verdict.conclusion);
          console.log('🎯 Confidence:', verdict.confidence);
          console.log('📈 Scores:');
          console.log(`   - Truth Score: ${verdict.scores.truth}/100`);
          console.log(`   - Argument Score: ${verdict.scores.argument}/100`);
          console.log(`   - Credibility Score: ${verdict.scores.credibility}/100`);
          console.log('\n💡 Reasoning:');
          verdict.reasoning.forEach(r => console.log(`   - ${r}`));
        }
        
        break;
      } else if (status === 'failed') {
        console.log('\n\n❌ Investigation failed:', results.error || 'Unknown error');
        break;
      }
    }
    
    if (status === 'in_progress') {
      console.log('\n\n⏱️ Investigation timed out - still in progress');
    }
    
    // Show recent investigations
    console.log('\n\n📜 Recent Investigations:');
    const recentInvestigations = await orchestrator.getAllInvestigations(5);
    recentInvestigations.forEach((inv, i) => {
      console.log(`${i + 1}. ${inv.claim} - ${inv.verdict} (${new Date(inv.timestamp).toLocaleString()})`);
    });
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Cleanup
    await taskManager.disconnect();
    process.exit(0);
  }
}

// Run the test
testTruthFinding().catch(console.error);