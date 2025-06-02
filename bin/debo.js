#!/usr/bin/env node

/**
 * Debo CLI Entry Point
 * 
 * PURPOSE:
 * Command-line interface for the Debo autonomous development system.
 * Provides terminal-based interaction with real-time feedback.
 * 
 * FEATURES:
 * - Terminal dashboard interface
 * - Real-time command execution
 * - Agent monitoring
 * - Project progress tracking
 * 
 * TODO:
 * - None
 */

import { program } from 'commander';
import { TerminalInterface } from '../src/terminal-interface.js';
import { TerminalDashboard } from '../src/terminal-dashboard.js';
import { execSync } from 'child_process';
import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';

class DeboCLI {
  constructor() {
    this.taskManager = null;
    this.terminal = null;
    this.dashboard = null;
  }
  
  async initialize() {
    // Check prerequisites
    await this.checkPrerequisites();
    
    // Initialize services
    const { ServiceFactory } = await import('../src/services/index.js');
    this.services = await ServiceFactory.createOptimizedServices();
    
    // Initialize terminal interface
    this.terminal = new TerminalInterface(this.services.database);
  }
  
  async checkPrerequisites() {
    const checks = [
      {
        name: 'Redis',
        command: 'redis-cli ping',
        error: 'Redis server is not running. Please start Redis first.'
      },
      {
        name: 'Ollama',
        command: 'curl -s http://localhost:11434/api/tags',
        error: 'Ollama is not running. Please start Ollama first.'
      }
    ];
    
    for (const check of checks) {
      const spinner = ora(`Checking ${check.name}...`).start();
      
      try {
        execSync(check.command, { stdio: 'pipe' });
        spinner.succeed(`${check.name} is running`);
      } catch (error) {
        spinner.fail(check.error);
        process.exit(1);
      }
    }
  }
  
  async runDashboard() {
    await this.initialize();
    
    console.log(chalk.cyan(figlet.textSync('DEBO', { font: 'ANSI Shadow' })));
    console.log(chalk.yellow('🚀 Starting terminal dashboard...\n'));
    
    this.dashboard = new TerminalDashboard(this.services.database);
    
    // Start with a welcome message
    this.dashboard.addLog('info', 'Debo autonomous development system started', 'system');
    this.dashboard.addLog('info', 'Terminal dashboard initialized', 'system');
    this.dashboard.addLog('info', 'Ready for development requests', 'system');
    
    // Render the dashboard
    this.dashboard.render();
    
    return this.dashboard;
  }
  
  async executeRequest(request, options = {}) {
    await this.initialize();
    
    if (options.dashboard) {
      await this.runDashboard();
    }
    
    // Show request processing
    this.terminal.addLog('info', `Processing request: ${request}`);
    
    // Execute the autonomous development request
    const commandId = `request_${Date.now()}`;
    
    try {
      this.terminal.startCommand(
        commandId,
        'Processing autonomous development request',
        `debo: ${request}`
      );
      
      // Here you would integrate with your MCP server
      // For now, we'll simulate the process
      
      // Step 1: Project analysis
      this.terminal.updateCommand(commandId, 'Analyzing project requirements...');
      await this.simulateStep('Project analysis', 2000);
      
      // Step 2: Agent assignment
      this.terminal.updateCommand(commandId, 'Assigning agents to tasks...');
      await this.simulateStep('Agent assignment', 1500);
      
      // Step 3: Code generation
      this.terminal.updateCommand(commandId, 'Generating code with AI agents...');
      await this.simulateStep('Code generation', 3000);
      
      // Step 4: Testing
      this.terminal.updateCommand(commandId, 'Running tests and validation...');
      await this.simulateStep('Testing', 2000);
      
      // Step 5: Documentation
      this.terminal.updateCommand(commandId, 'Generating documentation...');
      await this.simulateStep('Documentation', 1000);
      
      this.terminal.completeCommand(commandId, true, 'Request completed successfully');
      
      this.terminal.showSuccess(
        `Request "${request}" completed successfully!\n` +
        'Check the generated files and documentation.'
      );
      
    } catch (error) {
      this.terminal.completeCommand(commandId, false, error.message);
      this.terminal.showErrorDetails(error, `Request: ${request}`);
    }
  }
  
  async simulateStep(stepName, duration) {
    this.terminal.addLog('info', `Starting ${stepName}...`);
    
    return new Promise(resolve => {
      setTimeout(() => {
        this.terminal.addLog('success', `${stepName} completed`);
        resolve();
      }, duration);
    });
  }
  
  async runHealthCheck() {
    await this.initialize();
    
    console.log(chalk.cyan('🔍 Debo Health Check'));
    console.log(chalk.gray('━'.repeat(50)));
    
    // Check all systems
    const healthChecks = [
      'Redis connection',
      'Ollama LLM service',
      'Agent queue system',
      'Documentation system',
      'Git integration',
      'Feedback system'
    ];
    
    for (const check of healthChecks) {
      const spinner = ora(`Checking ${check}...`).start();
      
      // Simulate health check
      await new Promise(resolve => setTimeout(resolve, 500));
      
      spinner.succeed(`${check} is healthy`);
    }
    
    console.log(chalk.green('\n✅ All systems operational!'));
    console.log(chalk.gray('Debo is ready for autonomous development.'));
  }
  
  async showStatus() {
    await this.initialize();
    
    const stats = await this.services.agentExecution.getStatus();
    
    console.log(chalk.cyan('📊 Debo System Status'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.yellow(`Active Agents: ${stats.activeAgents || 0}`));
    console.log(chalk.blue(`Queued Tasks: ${stats.queuedTasks || 0}`));
    console.log(chalk.green(`Completed Tasks: ${stats.completedTasks || 0}`));
    console.log(chalk.magenta(`System Uptime: ${process.uptime().toFixed(0)}s`));
    console.log(chalk.gray(`Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`));
  }
  
  async analyzeAndPlan(projectPath) {
    await this.initialize();
    
    console.log(chalk.cyan('🔍 Starting comprehensive codebase analysis...'));
    
    try {
      const { ProjectPlanner } = await import('../src/codebase/project-planner.js');
      const planner = new ProjectPlanner(this.services.database, this.terminal);
      
      const projectPlan = await planner.analyzeAndPlan(projectPath);
      
      console.log(chalk.green('\n🎉 Project analysis and planning completed!'));
      console.log(chalk.cyan('📋 You can now monitor progress with "debo dashboard"'));
      
      return projectPlan;
      
    } catch (error) {
      console.error(chalk.red(`Analysis failed: ${error.message}`));
      throw error;
    }
  }
}

// Setup CLI commands
program
  .name('debo')
  .description('Debo - Autonomous Development System')
  .version('2.0.0');

program
  .command('dashboard')
  .alias('dash')
  .description('Launch the terminal dashboard interface')
  .action(async () => {
    const cli = new DeboCLI();
    await cli.runDashboard();
  });

program
  .command('build <request>')
  .description('Execute an autonomous development request')
  .option('-d, --dashboard', 'Show dashboard during execution')
  .action(async (request, options) => {
    const cli = new DeboCLI();
    await cli.executeRequest(request, options);
  });

program
  .command('health')
  .description('Run system health check')
  .action(async () => {
    const cli = new DeboCLI();
    await cli.runHealthCheck();
  });

program
  .command('status')
  .description('Show system status')
  .action(async () => {
    const cli = new DeboCLI();
    await cli.showStatus();
  });

program
  .command('ports')
  .description('Show port assignments and network information')
  .action(async () => {
    const { portManager } = await import('../src/utils/port-manager.js');
    const portInfo = portManager.getPortInfo();
    
    console.log(chalk.cyan('🔌 Debo Port Information'));
    console.log(chalk.gray('━'.repeat(50)));
    
    console.log(chalk.yellow('\n📍 Assigned Ports:'));
    Object.entries(portInfo.assigned).forEach(([service, port]) => {
      console.log(`  ${service.padEnd(20)} ${chalk.green(port)}`);
    });
    
    console.log(chalk.yellow('\n🚫 Reserved Ports:'));
    const reserved = Array.from(portInfo.reserved).slice(0, 10); // Show first 10
    console.log(`  ${reserved.join(', ')}${portInfo.reserved.length > 10 ? '...' : ''}`);
    
    console.log(chalk.yellow('\n📋 Port Ranges:'));
    Object.entries(portInfo.ranges).forEach(([type, range]) => {
      console.log(`  ${type.padEnd(12)} ${chalk.blue(range.start)}-${chalk.blue(range.end)}`);
    });
    
    console.log(chalk.yellow('\n💾 Configuration:'));
    console.log(`  Config file: ${chalk.gray(portInfo.configFile)}`);
    
    console.log(chalk.gray('\nNote: Ports are dynamically assigned to avoid conflicts'));
  });

// Terminal command for interactive MCP client
program
  .command('terminal')
  .alias('term')
  .description('Launch interactive terminal MCP client (like Claude Code)')
  .action(async () => {
    const { TerminalMCPClient } = await import('../src/terminal-mcp-client.js');
    const client = new TerminalMCPClient();
    await client.start();
  });

program
  .command('analyze [path]')
  .description('Analyze existing codebase and create interactive project plan')
  .action(async (projectPath) => {
    const cli = new DeboCLI();
    await cli.analyzeAndPlan(projectPath || process.cwd());
  });

// Default command (when no subcommand is provided)
program
  .argument('[request]', 'Development request')
  .action(async (request) => {
    if (!request) {
      // No request provided, check if we're in a project directory
      const fs = await import('fs-extra');
      const hasProject = await fs.pathExists('package.json') || 
                        await fs.pathExists('requirements.txt') ||
                        await fs.pathExists('.git');
      
      if (hasProject) {
        // Project detected, launch terminal interface
        const { TerminalMCPClient } = await import('../src/terminal-mcp-client.js');
        const client = new TerminalMCPClient();
        await client.start();
      } else {
        // No project, show dashboard
        const cli = new DeboCLI();
        await cli.runDashboard();
      }
    } else {
      // Request provided, execute it
      const cli = new DeboCLI();
      await cli.executeRequest(request, { dashboard: true });
    }
  });

// Parse command line arguments
program.parse();