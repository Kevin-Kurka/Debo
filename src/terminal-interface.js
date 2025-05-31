import readline from 'readline';
import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';
import boxen from 'boxen';
import { execSync, spawn } from 'child_process';
import logger from './logger.js';
import { performance } from 'perf_hooks';

/**
 * Terminal Interface for Debo
 * 
 * PURPOSE:
 * Provides a modern CLI interface with real-time logs, command execution display,
 * and visual feedback for the autonomous development system.
 * 
 * FEATURES:
 * - Real-time log streaming
 * - Command execution visualization
 * - Agent activity monitoring
 * - Progress tracking with spinners
 * - Colorized output with boxes and formatting
 * 
 * TODO:
 * - None
 */
export class TerminalInterface {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.spinners = new Map();
    this.activeCommands = new Map();
    this.logBuffer = [];
    this.maxLogLines = 50;
    this.startTime = performance.now();
    
    // Initialize readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Setup terminal
    this.setupTerminal();
  }
  
  setupTerminal() {
    // Clear screen and show header
    console.clear();
    this.showHeader();
    
    // Setup graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    
    // Setup log streaming
    this.setupLogStreaming();
  }
  
  showHeader() {
    const header = figlet.textSync('DEBO', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    });
    
    console.log(chalk.cyan(header));
    console.log(chalk.gray('━'.repeat(80)));
    console.log(chalk.yellow.bold('🤖 Autonomous Development System'));
    console.log(chalk.gray(`Started: ${new Date().toLocaleTimeString()}`));
    console.log(chalk.gray('━'.repeat(80)));
    console.log('');
  }
  
  setupLogStreaming() {
    // Override console methods to capture logs
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.log = (...args) => {
      this.addLog('info', args.join(' '));
      originalLog(...args);
    };
    
    console.warn = (...args) => {
      this.addLog('warn', args.join(' '));
      originalWarn(...args);
    };
    
    console.error = (...args) => {
      this.addLog('error', args.join(' '));
      originalError(...args);
    };
    
    // Setup custom logger hook
    if (logger && logger.stream) {
      logger.stream.on('log', (entry) => {
        this.addLog(entry.level, entry.message);
      });
    }
  }
  
  addLog(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const coloredMessage = this.colorizeLog(level, message);
    
    this.logBuffer.push({
      timestamp,
      level,
      message: coloredMessage
    });
    
    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxLogLines) {
      this.logBuffer.shift();
    }
    
    this.updateDisplay();
  }
  
  colorizeLog(level, message) {
    switch (level) {
      case 'error':
        return chalk.red(`❌ ${message}`);
      case 'warn':
        return chalk.yellow(`⚠️  ${message}`);
      case 'info':
        return chalk.blue(`ℹ️  ${message}`);
      case 'success':
        return chalk.green(`✅ ${message}`);
      case 'debug':
        return chalk.gray(`🔍 ${message}`);
      default:
        return message;
    }
  }
  
  startCommand(commandId, description, command) {
    const spinner = ora({
      text: description,
      color: 'cyan',
      spinner: 'dots12'
    }).start();
    
    this.spinners.set(commandId, spinner);
    this.activeCommands.set(commandId, {
      description,
      command,
      startTime: performance.now()
    });
    
    this.logCommand('start', commandId, command);
  }
  
  updateCommand(commandId, text) {
    const spinner = this.spinners.get(commandId);
    if (spinner) {
      spinner.text = text;
    }
  }
  
  completeCommand(commandId, success = true, result = null) {
    const spinner = this.spinners.get(commandId);
    const commandInfo = this.activeCommands.get(commandId);
    
    if (spinner) {
      const duration = ((performance.now() - commandInfo.startTime) / 1000).toFixed(2);
      
      if (success) {
        spinner.succeed(chalk.green(`${commandInfo.description} (${duration}s)`));
      } else {
        spinner.fail(chalk.red(`${commandInfo.description} (${duration}s)`));
      }
    }
    
    this.logCommand(success ? 'complete' : 'fail', commandId, commandInfo.command, result);
    
    this.spinners.delete(commandId);
    this.activeCommands.delete(commandId);
  }
  
  logCommand(type, commandId, command, result = null) {
    const timestamp = new Date().toLocaleTimeString();
    
    switch (type) {
      case 'start':
        this.addLog('info', `🚀 Executing: ${command}`);
        break;
      case 'complete':
        this.addLog('success', `✅ Completed: ${command}`);
        if (result) {
          this.addLog('debug', `   Output: ${result.toString().slice(0, 100)}...`);
        }
        break;
      case 'fail':
        this.addLog('error', `❌ Failed: ${command}`);
        if (result) {
          this.addLog('error', `   Error: ${result.toString()}`);
        }
        break;
    }
  }
  
  async executeCommand(command, description, options = {}) {
    const commandId = `cmd_${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      this.startCommand(commandId, description, command);
      
      try {
        if (options.sync) {
          // Synchronous execution
          const result = execSync(command, {
            encoding: 'utf8',
            ...options
          });
          
          this.completeCommand(commandId, true, result);
          resolve(result);
        } else {
          // Asynchronous execution with streaming
          const child = spawn('sh', ['-c', command], {
            stdio: ['inherit', 'pipe', 'pipe'],
            ...options
          });
          
          let output = '';
          let error = '';
          
          child.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            this.addLog('debug', `📤 ${text.trim()}`);
          });
          
          child.stderr.on('data', (data) => {
            const text = data.toString();
            error += text;
            this.addLog('warn', `📥 ${text.trim()}`);
          });
          
          child.on('close', (code) => {
            if (code === 0) {
              this.completeCommand(commandId, true, output);
              resolve(output);
            } else {
              this.completeCommand(commandId, false, error);
              reject(new Error(error || `Command failed with code ${code}`));
            }
          });
        }
      } catch (err) {
        this.completeCommand(commandId, false, err.message);
        reject(err);
      }
    });
  }
  
  showAgentActivity(agents) {
    const agentBox = boxen(
      agents.map(agent => {
        const status = agent.status === 'active' ? '🟢' : '🔴';
        const role = chalk.yellow(agent.role.padEnd(20));
        const task = chalk.gray(agent.currentTask || 'Idle');
        return `${status} ${role} ${task}`;
      }).join('\n'),
      {
        title: chalk.bold('🤖 Agent Status'),
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    );
    
    console.log(agentBox);
  }
  
  showProjectProgress(projectId, progress) {
    const progressBar = this.createProgressBar(progress.percentage);
    
    const statsBox = boxen(
      `Project: ${chalk.yellow(projectId)}\n` +
      `Progress: ${progressBar} ${progress.percentage}%\n` +
      `Tasks: ${chalk.green(progress.completed)}/${progress.total}\n` +
      `Active Agents: ${chalk.cyan(progress.activeAgents)}\n` +
      `Estimated Completion: ${chalk.gray(progress.eta || 'Unknown')}`,
      {
        title: chalk.bold('📊 Project Status'),
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    );
    
    console.log(statsBox);
  }
  
  createProgressBar(percentage, width = 20) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const filledBar = chalk.green('█'.repeat(filled));
    const emptyBar = chalk.gray('░'.repeat(empty));
    
    return `[${filledBar}${emptyBar}]`;
  }
  
  showLLMActivity(model, tokens, confidence) {
    const llmInfo = [
      `Model: ${chalk.yellow(model)}`,
      `Tokens: ${chalk.cyan(tokens.toLocaleString())}`,
      `Confidence: ${this.colorizeConfidence(confidence)}%`,
      `Temperature: ${chalk.blue('0.0 (deterministic)')}`
    ].join('\n');
    
    const llmBox = boxen(llmInfo, {
      title: chalk.bold('🧠 LLM Activity'),
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'magenta'
    });
    
    console.log(llmBox);
  }
  
  colorizeConfidence(confidence) {
    if (confidence >= 90) return chalk.green(confidence);
    if (confidence >= 70) return chalk.yellow(confidence);
    return chalk.red(confidence);
  }
  
  showCodeOutput(filePath, content, lineCount) {
    const codePreview = content.split('\n').slice(0, 10).join('\n');
    const hasMore = lineCount > 10;
    
    const codeBox = boxen(
      `${chalk.gray(filePath)}\n\n` +
      chalk.white(codePreview) +
      (hasMore ? chalk.gray(`\n\n... and ${lineCount - 10} more lines`) : ''),
      {
        title: chalk.bold('📝 Code Generated'),
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      }
    );
    
    console.log(codeBox);
  }
  
  showErrorDetails(error, context) {
    const errorBox = boxen(
      `${chalk.red.bold('Error:')} ${error.message}\n\n` +
      `${chalk.yellow('Context:')} ${context}\n\n` +
      `${chalk.gray('Stack:')}\n${error.stack}`,
      {
        title: chalk.bold('🚨 Error Details'),
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'red'
      }
    );
    
    console.log(errorBox);
  }
  
  updateDisplay() {
    // In a real implementation, you might want to use a library like
    // blessed or ink for more sophisticated terminal UI management
    // For now, we'll keep it simple with scrolling logs
  }
  
  promptUser(question) {
    return new Promise((resolve) => {
      this.rl.question(chalk.cyan(`❓ ${question}: `), (answer) => {
        resolve(answer.trim());
      });
    });
  }
  
  showSuccess(message) {
    const successBox = boxen(
      chalk.green.bold(message),
      {
        title: chalk.bold('🎉 Success'),
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'green'
      }
    );
    
    console.log(successBox);
  }
  
  showWarning(message) {
    const warningBox = boxen(
      chalk.yellow.bold(message),
      {
        title: chalk.bold('⚠️ Warning'),
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      }
    );
    
    console.log(warningBox);
  }
  
  showSystemStats() {
    const uptime = ((performance.now() - this.startTime) / 1000 / 60).toFixed(1);
    const memUsage = process.memoryUsage();
    
    const statsBox = boxen(
      `Uptime: ${chalk.cyan(uptime)} minutes\n` +
      `Memory: ${chalk.yellow((memUsage.heapUsed / 1024 / 1024).toFixed(1))}MB\n` +
      `Active Spinners: ${chalk.green(this.spinners.size)}\n` +
      `Log Buffer: ${chalk.blue(this.logBuffer.length)}/${this.maxLogLines}`,
      {
        title: chalk.bold('📈 System Stats'),
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'blue'
      }
    );
    
    console.log(statsBox);
  }
  
  async shutdown() {
    console.log('\n');
    this.addLog('info', 'Shutting down Debo...');
    
    // Stop all spinners
    for (const [id, spinner] of this.spinners) {
      spinner.stop();
    }
    
    // Show final stats
    this.showSystemStats();
    
    // Close readline
    this.rl.close();
    
    console.log(chalk.gray('\nGoodbye! 👋'));
    process.exit(0);
  }
}

export default TerminalInterface;
