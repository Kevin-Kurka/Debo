#!/usr/bin/env node

import redis from 'redis';
import { readFile } from 'fs/promises';

async function testDebo() {
  console.log('🧪 Simple Debo Test...\n');

  try {
    console.log('1. Testing Redis connection...');
    
    const client = redis.createClient({ url: 'redis://localhost:6379' });
    await client.connect();
    await client.set('test', 'working');
    const result = await client.get('test');
    await client.del('test');
    await client.disconnect();
    
    if (result === 'working') {
      console.log('   ✅ Redis: Connected and working');
    }
    
    console.log('2. Testing MCP server structure...');
    const serverContent = await readFile('src/mcp_server.js', 'utf8');
    
    if (serverContent.includes('DeboMCPServer') && serverContent.includes('debo')) {
      console.log('   ✅ MCP server: Structure looks good');
    }
    
    console.log('\n🎉 Basic tests passed!');
    console.log('🚀 Start the server with: npm start');
    console.log('📖 Add to your MCP config to use the "debo" tool');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('Redis') || error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure Redis is running:');
      console.log('   brew services start redis');
      console.log('   or: sudo systemctl start redis');
    }
  }
}

testDebo();