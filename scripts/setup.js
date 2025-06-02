#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setupDebo() {
  console.log('🚀 Setting up Debo Autonomous Development System...\n');

  try {
    // 1. Check Redis
    console.log('📊 Checking Redis...');
    try {
      const { stdout } = await execAsync('redis-cli ping');
      if (stdout.trim() === 'PONG') {
        console.log('✅ Redis is running');
      } else {
        throw new Error('Redis not responding');
      }
    } catch (error) {
      console.log('❌ Redis not available. Starting Redis...');
      try {
        await execAsync('redis-server --daemonize yes');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await execAsync('redis-cli ping');
        console.log('✅ Redis started successfully');
      } catch (redisError) {
        console.log('❌ Could not start Redis. Please install and start Redis manually:');
        console.log('   brew install redis && brew services start redis');
        console.log('   or: sudo apt-get install redis-server');
      }
    }

    // 2. Check Ollama
    console.log('\n🤖 Checking Ollama...');
    try {
      await execAsync('ollama --version');
      console.log('✅ Ollama is installed');
      
      // Pull required models
      console.log('📥 Pulling required models (this may take a while)...');
      const models = ['qwen2.5:7b', 'qwen2.5:14b'];
      
      for (const model of models) {
        try {
          console.log(`   Pulling ${model}...`);
          await execAsync(`ollama pull ${model}`);
          console.log(`   ✅ ${model} ready`);
        } catch (pullError) {
          console.log(`   ⚠️  Failed to pull ${model}, will try later`);
        }
      }
      
    } catch (error) {
      console.log('❌ Ollama not found');
      console.log('   Please install Ollama from: https://ollama.ai');
      console.log('   Then run: ollama pull qwen2.5:7b && ollama pull qwen2.5:14b');
    }

    // 3. Create necessary directories
    console.log('\n📁 Creating project directories...');
    const projectsDir = path.join(process.cwd(), 'projects');
    const logsDir = path.join(process.cwd(), 'logs');
    
    await fs.ensureDir(projectsDir);
    await fs.ensureDir(logsDir);
    console.log('✅ Directories created');

    // 4. Create configuration file
    console.log('\n⚙️  Creating configuration...');
    const configPath = path.join(process.cwd(), '.debo-config.json');
    const config = {
      redis: {
        url: 'redis://localhost:6379'
      },
      ollama: {
        url: 'http://localhost:11434'
      },
      models: {
        thinking: 'qwen2.5:14b',
        fast: 'qwen2.5:7b'
      },
      ports: {
        dynamic: true,
        ranges: {
          mcp: '8000-8099',
          websocket: '8100-8199',
          api: '8200-8299',
          monitoring: '8400-8499'
        }
      },
      directories: {
        projects: projectsDir,
        logs: logsDir
      }
    };
    
    await fs.writeJson(configPath, config, { spaces: 2 });
    console.log('✅ Configuration saved');

    // 5. Test the system
    console.log('\n🧪 Testing system components...');
    
    try {
      // Test Redis connection
      const { EnhancedTaskManager } = await import('../src/database/task-manager.js');
      const taskManager = new EnhancedTaskManager();
      await taskManager.connect();
      await taskManager.disconnect();
      console.log('✅ Database connection: OK');
    } catch (dbError) {
      console.log('⚠️  Database connection: Failed');
    }

    console.log('\n🎉 Debo setup complete!');
    console.log('\n📖 Next steps:');
    console.log('1. Add Debo to your MCP configuration:');
    console.log(`   {
     "debo": {
       "command": "node",
       "args": ["${path.join(process.cwd(), 'src', 'mcp_server.js')}"]
     }
   }`);
    console.log('\n2. Start using Debo with commands like:');
    console.log('   • debo create my-app "Build a task management app with React"');
    console.log('   • debo develop my-app "Add user authentication"');
    console.log('   • debo status my-app');
    console.log('\n📡 Port Management:');
    console.log('   • Ports are automatically assigned to avoid conflicts');
    console.log('   • Use "debo ports" to see current assignments');
    console.log('   • Set environment variables to override (e.g., MCP_SERVER_PORT=8000)');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupDebo();