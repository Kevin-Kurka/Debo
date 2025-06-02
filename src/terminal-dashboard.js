import blessed from 'blessed';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

/**
 * Terminal Dashboard for Debo
 * 
 * PURPOSE:
 * Advanced terminal UI with real-time updates, split-screen layout,
 * and comprehensive monitoring for the autonomous development system.
 * 
 * FEATURES:
 * - Split-screen terminal interface
 * - Real-time log scrolling
 * - Agent status monitoring
 * - Command execution viewer
 * - Progress tracking
 * - Interactive controls
 * 
 * TODO:
 * - None
 */
export class TerminalDashboard {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.screen = null;
    this.widgets = {};
    this.logs = [];
    this.maxLogs = 1000;
    this.startTime = performance.now();
    
    this.initializeScreen();
    this.setupKeyHandlers();
  }
  
  initializeScreen() {
    // Create blessed screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Debo - Autonomous Development System'
    });
    
    // Create layout boxes
    this.createLayout();
    
    // Setup auto-refresh
    this.setupAutoRefresh();
  }
  
  createLayout() {
    // Header
    this.widgets.header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 5,
      content: this.getHeaderContent(),
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'cyan',
        border: {
          fg: 'cyan'
        }
      }
    });
    
    // Agent Status (left panel)
    this.widgets.agents = blessed.box({
      top: 5,
      left: 0,
      width: '30%',
      height: '50%',
      label: ' 🤖 Agent Status ',
      content: '',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'green'
        }
      },
      scrollable: true,
      alwaysScroll: true
    });
    
    // Command Execution (center panel)
    this.widgets.commands = blessed.box({
      top: 5,
      left: '30%',
      width: '40%',
      height: '50%',
      label: ' 🚀 Command Execution ',
      content: '',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'yellow'
        }
      },
      scrollable: true,
      alwaysScroll: true
    });
    
    // Project Status (right panel)
    this.widgets.project = blessed.box({
      top: 5,
      left: '70%',
      width: '30%',
      height: '50%',
      label: ' 📊 Project Status ',
      content: '',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'blue'
        }
      },
      scrollable: true,
      alwaysScroll: true
    });
    
    // Log Stream (bottom panel)
    this.widgets.logs = blessed.log({
      top: '55%',
      left: 0,
      width: '100%',
      height: '40%',
      label: ' 📝 Real-time Logs ',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'magenta'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true
    });
    
    // Status Bar (bottom)
    this.widgets.status = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: this.getStatusContent(),
      tags: true,
      style: {
        fg: 'black',
        bg: 'white'
      }
    });
    
    // Add all widgets to screen
    Object.values(this.widgets).forEach(widget => {
      this.screen.append(widget);
    });
    
    // Focus on logs by default
    this.widgets.logs.focus();
  }
  
  getHeaderContent() {
    const uptime = ((performance.now() - this.startTime) / 1000 / 60).toFixed(1);
    return [
      '{center}{bold}{cyan-fg}🤖 DEBO - Autonomous Development System{/}',
      '{center}{gray-fg}Fortune 500 Agent Architecture with Real-time Monitoring{/}',
      `{center}{yellow-fg}Uptime: ${uptime}m • Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB • PID: ${process.pid}{/}`
    ].join('\n');
  }
  
  getStatusContent() {
    const now = new Date().toLocaleTimeString();
    return ` ${now} | Press 'q' to quit | 'r' to refresh | 'c' to clear logs | 'h' for help `;
  }
  
  setupKeyHandlers() {
    // Quit on Escape, q, or C-c
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.shutdown();
    });
    
    // Refresh on 'r'
    this.screen.key(['r'], () => {
      this.refresh();
    });
    
    // Clear logs on 'c'
    this.screen.key(['c'], () => {
      this.clearLogs();
    });
    
    // Help on 'h'
    this.screen.key(['h'], () => {
      this.showHelp();
    });
    
    // Tab to cycle focus
    this.screen.key(['tab'], () => {
      this.cycleFocus();
    });
  }
  
  setupAutoRefresh() {
    // Refresh display every second
    setInterval(() => {
      this.updateDisplay();
    }, 1000);
    
    // Update status bar more frequently
    setInterval(() => {
      this.widgets.status.setContent(this.getStatusContent());
      this.widgets.header.setContent(this.getHeaderContent());
      this.screen.render();
    }, 500);
  }
  
  addLog(level, message, source = 'system') {
    const timestamp = new Date().toLocaleTimeString();
    const coloredMessage = this.formatLogMessage(level, message, source, timestamp);
    
    this.logs.push({
      timestamp,
      level,
      message,
      source,
      formatted: coloredMessage
    });
    
    // Keep log buffer manageable
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Add to log widget
    this.widgets.logs.log(coloredMessage);
    this.screen.render();
  }
  
  formatLogMessage(level, message, source, timestamp) {
    const icons = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      success: '✅',
      debug: '🔍',
      agent: '🤖',
      command: '🚀',
      llm: '🧠'
    };
    
    const colors = {
      error: 'red',
      warn: 'yellow',
      info: 'blue',
      success: 'green',
      debug: 'gray',
      agent: 'cyan',
      command: 'magenta',
      llm: 'purple'
    };
    
    const icon = icons[level] || 'ℹ️';
    const color = colors[level] || 'white';
    
    return `{${color}-fg}${icon} {gray-fg}[${timestamp}]{/} {bold}${source}:{/} ${message}{/}`;
  }
  
  updateAgentStatus(agents) {
    const content = agents.map(agent => {
      const statusIcon = agent.status === 'active' ? '{green-fg}🟢{/}' : '{red-fg}🔴{/}';
      const role = `{bold}{yellow-fg}${agent.role.padEnd(18)}{/}`;
      const task = agent.currentTask ? 
        `{gray-fg}${agent.currentTask.slice(0, 25)}...{/}` : 
        '{gray-fg}Idle{/}';
      
      const confidence = agent.lastConfidence ? 
        `{cyan-fg}${agent.lastConfidence}%{/}` : 
        '{gray-fg}--{/}';
      
      return `${statusIcon} ${role}\n    Task: ${task}\n    Confidence: ${confidence}\n`;
    }).join('\n');
    
    this.widgets.agents.setContent(content);
  }
  
  updateCommandExecution(commands) {
    const content = commands.map(cmd => {
      const statusIcon = cmd.status === 'running' ? 
        '{yellow-fg}⏳{/}' : 
        cmd.status === 'completed' ? '{green-fg}✅{/}' : '{red-fg}❌{/}';
      
      const duration = cmd.duration ? `{gray-fg}(${cmd.duration}s){/}` : '';
      const command = `{bold}${cmd.command.slice(0, 40)}...{/}`;
      
      return `${statusIcon} ${command} ${duration}`;
    }).slice(-10).join('\n'); // Show last 10 commands
    
    this.widgets.commands.setContent(content);
  }
  
  updateProjectStatus(projectData) {
    const progressBar = this.createProgressBar(projectData.progress || 0);
    
    const content = [
      `{bold}{yellow-fg}Project:{/} ${projectData.name || 'Unknown'}`,
      `{bold}Progress:{/} ${progressBar} ${projectData.progress || 0}%`,
      `{bold}Tasks:{/} {green-fg}${projectData.completed || 0}{/}/{cyan-fg}${projectData.total || 0}{/}`,
      `{bold}Active Agents:{/} {cyan-fg}${projectData.activeAgents || 0}{/}`,
      `{bold}ETA:{/} {gray-fg}${projectData.eta || 'Unknown'}{/}`,
      '',
      '{bold}Recent Activity:{/}',
      ...(projectData.recentActivity || []).map(activity => 
        `  {gray-fg}• ${activity}{/}`
      )
    ].join('\n');
    
    this.widgets.project.setContent(content);
  }
  
  createProgressBar(percentage, width = 20) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    return `{green-fg}${'█'.repeat(filled)}{/}{gray-fg}${'░'.repeat(empty)}{/}`;
  }
  
  showCommand(commandId, description, command) {
    this.addLog('command', `Starting: ${description}`, 'exec');
    this.addLog('debug', `Command: ${command}`, 'exec');
  }
  
  showCommandOutput(commandId, output, error = false) {
    const level = error ? 'error' : 'debug';
    const lines = output.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      this.addLog(level, line, 'output');
    });
  }
  
  showCommandComplete(commandId, success, duration) {
    const level = success ? 'success' : 'error';
    const message = success ? 
      `Command completed in ${duration}s` : 
      `Command failed after ${duration}s`;
    
    this.addLog(level, message, 'exec');
  }
  
  showAgentActivity(agentId, role, activity) {
    this.addLog('agent', `${role}: ${activity}`, agentId);
  }
  
  showLLMActivity(model, tokens, confidence) {
    this.addLog('llm', `${model} • ${tokens} tokens • ${confidence}% confidence`, 'llm');
  }
  
  showError(error, context) {
    this.addLog('error', `${context}: ${error.message}`, 'system');
    if (error.stack) {
      this.addLog('debug', error.stack, 'system');
    }
  }
  
  cycleFocus() {
    const focusableWidgets = [
      this.widgets.logs,
      this.widgets.agents,
      this.widgets.commands,
      this.widgets.project
    ];
    
    const currentIndex = focusableWidgets.findIndex(w => w === this.screen.focused);
    const nextIndex = (currentIndex + 1) % focusableWidgets.length;
    
    focusableWidgets[nextIndex].focus();
    this.screen.render();
  }
  
  clearLogs() {
    this.logs = [];
    this.widgets.logs.setContent('');
    this.addLog('info', 'Logs cleared', 'system');
  }
  
  showHelp() {
    const helpContent = [
      '{center}{bold}{cyan-fg}Debo Terminal Dashboard Help{/}',
      '',
      '{bold}Keyboard Shortcuts:{/}',
      '  {yellow-fg}q, ESC, Ctrl+C{/} - Quit application',
      '  {yellow-fg}r{/} - Refresh display',
      '  {yellow-fg}c{/} - Clear logs',
      '  {yellow-fg}h{/} - Show this help',
      '  {yellow-fg}Tab{/} - Cycle focus between panels',
      '',
      '{bold}Panels:{/}',
      '  {cyan-fg}Agent Status{/} - Real-time agent activity',
      '  {yellow-fg}Command Execution{/} - System commands and output',
      '  {blue-fg}Project Status{/} - Project progress and metrics',
      '  {magenta-fg}Real-time Logs{/} - All system activity logs',
      '',
      '{gray-fg}Press any key to close help...{/}'
    ].join('\n');
    
    const helpBox = blessed.box({
      top: 'center',
      left: 'center',
      width: 60,
      height: 20,
      content: helpContent,
      tags: true,
      border: {
        type: 'double'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      }
    });
    
    this.screen.append(helpBox);
    helpBox.focus();
    
    helpBox.key(['escape', 'enter', 'space'], () => {
      this.screen.remove(helpBox);
      this.widgets.logs.focus();
      this.screen.render();
    });
    
    this.screen.render();
  }
  
  updateDisplay() {
    // Update all panels with fresh data
    // In a real implementation, you'd fetch this data from your task manager
    this.screen.render();
  }
  
  refresh() {
    this.screen.realloc();
    this.updateDisplay();
    this.addLog('info', 'Display refreshed', 'system');
  }
  
  shutdown() {
    this.addLog('info', 'Shutting down dashboard...', 'system');
    this.screen.destroy();
    process.exit(0);
  }
  
  render() {
    this.screen.render();
  }
}

export default TerminalDashboard;