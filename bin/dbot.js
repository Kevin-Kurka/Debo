#!/usr/bin/env node

const { program } = require('commander');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

program
  .name('dbot')
  .description('Development Bot MCP Server')
  .version('1.0.0');

program
  .command('create-project <name>')
  .description('Create new DBot project')
  .action(async (name) => {
    console.log(`Creating DBot project: ${name}`);
    
    // Create project directory
    fs.mkdirSync(name, { recursive: true });
    process.chdir(name);
    
    // Initialize package.json
    execSync('npm init -y');
    
    // Install dependencies
    console.log('Installing dependencies...');
    execSync('npm install @modelcontextprotocol/sdk redis langchain dotenv commander');
    
    // Setup project structure
    const dirs = ['src', 'agents', 'docs', 'scripts'];
    dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));
    
    console.log(`Project ${name} created successfully!`);
    console.log('Run: npm run setup');
  });

program
  .command('setup')
  .description('Setup DBot environment')
  .action(() => {
    console.log('Setting up DBot environment...');
    
    // Start Redis Stack
    execSync('docker run -d --name redis-stack -p 6379:6379 redis/redis-stack-server');
    
    // Download Ollama models
    execSync('ollama pull qwen2.5-vl:32b');
    execSync('ollama pull deepseek-r1:1.5b');
    execSync('ollama pull devstral:latest');
    
    console.log('Setup complete! Run: npm start');
  });

program.parse();
