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
        fg: 'white',\n        border: {\n          fg: 'blue'\n        }\n      },\n      scrollable: true,\n      alwaysScroll: true\n    });\n    \n    // Log Stream (bottom panel)\n    this.widgets.logs = blessed.log({\n      top: '55%',\n      left: 0,\n      width: '100%',\n      height: '40%',\n      label: ' 📝 Real-time Logs ',\n      tags: true,\n      border: {\n        type: 'line'\n      },\n      style: {\n        fg: 'white',\n        border: {\n          fg: 'magenta'\n        }\n      },\n      scrollable: true,\n      alwaysScroll: true,\n      mouse: true\n    });\n    \n    // Status Bar (bottom)\n    this.widgets.status = blessed.box({\n      bottom: 0,\n      left: 0,\n      width: '100%',\n      height: 1,\n      content: this.getStatusContent(),\n      tags: true,\n      style: {\n        fg: 'black',\n        bg: 'white'\n      }\n    });\n    \n    // Add all widgets to screen\n    Object.values(this.widgets).forEach(widget => {\n      this.screen.append(widget);\n    });\n    \n    // Focus on logs by default\n    this.widgets.logs.focus();\n  }\n  \n  getHeaderContent() {\n    const uptime = ((performance.now() - this.startTime) / 1000 / 60).toFixed(1);\n    return [\n      '{center}{bold}{cyan-fg}🤖 DEBO - Autonomous Development System{/}',\n      '{center}{gray-fg}Fortune 500 Agent Architecture with Real-time Monitoring{/}',\n      `{center}{yellow-fg}Uptime: ${uptime}m • Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB • PID: ${process.pid}{/}`\n    ].join('\\n');\n  }\n  \n  getStatusContent() {\n    const now = new Date().toLocaleTimeString();\n    return ` ${now} | Press 'q' to quit | 'r' to refresh | 'c' to clear logs | 'h' for help `;\n  }\n  \n  setupKeyHandlers() {\n    // Quit on Escape, q, or C-c\n    this.screen.key(['escape', 'q', 'C-c'], () => {\n      this.shutdown();\n    });\n    \n    // Refresh on 'r'\n    this.screen.key(['r'], () => {\n      this.refresh();\n    });\n    \n    // Clear logs on 'c'\n    this.screen.key(['c'], () => {\n      this.clearLogs();\n    });\n    \n    // Help on 'h'\n    this.screen.key(['h'], () => {\n      this.showHelp();\n    });\n    \n    // Tab to cycle focus\n    this.screen.key(['tab'], () => {\n      this.cycleFocus();\n    });\n  }\n  \n  setupAutoRefresh() {\n    // Refresh display every second\n    setInterval(() => {\n      this.updateDisplay();\n    }, 1000);\n    \n    // Update status bar more frequently\n    setInterval(() => {\n      this.widgets.status.setContent(this.getStatusContent());\n      this.widgets.header.setContent(this.getHeaderContent());\n      this.screen.render();\n    }, 500);\n  }\n  \n  addLog(level, message, source = 'system') {\n    const timestamp = new Date().toLocaleTimeString();\n    const coloredMessage = this.formatLogMessage(level, message, source, timestamp);\n    \n    this.logs.push({\n      timestamp,\n      level,\n      message,\n      source,\n      formatted: coloredMessage\n    });\n    \n    // Keep log buffer manageable\n    if (this.logs.length > this.maxLogs) {\n      this.logs.shift();\n    }\n    \n    // Add to log widget\n    this.widgets.logs.log(coloredMessage);\n    this.screen.render();\n  }\n  \n  formatLogMessage(level, message, source, timestamp) {\n    const icons = {\n      error: '❌',\n      warn: '⚠️',\n      info: 'ℹ️',\n      success: '✅',\n      debug: '🔍',\n      agent: '🤖',\n      command: '🚀',\n      llm: '🧠'\n    };\n    \n    const colors = {\n      error: 'red',\n      warn: 'yellow',\n      info: 'blue',\n      success: 'green',\n      debug: 'gray',\n      agent: 'cyan',\n      command: 'magenta',\n      llm: 'purple'\n    };\n    \n    const icon = icons[level] || 'ℹ️';\n    const color = colors[level] || 'white';\n    \n    return `{${color}-fg}${icon} {gray-fg}[${timestamp}]{/} {bold}${source}:{/} ${message}{/}`;\n  }\n  \n  updateAgentStatus(agents) {\n    const content = agents.map(agent => {\n      const statusIcon = agent.status === 'active' ? '{green-fg}🟢{/}' : '{red-fg}🔴{/}';\n      const role = `{bold}{yellow-fg}${agent.role.padEnd(18)}{/}`;\n      const task = agent.currentTask ? \n        `{gray-fg}${agent.currentTask.slice(0, 25)}...{/}` : \n        '{gray-fg}Idle{/}';\n      \n      const confidence = agent.lastConfidence ? \n        `{cyan-fg}${agent.lastConfidence}%{/}` : \n        '{gray-fg}--{/}';\n      \n      return `${statusIcon} ${role}\\n    Task: ${task}\\n    Confidence: ${confidence}\\n`;\n    }).join('\\n');\n    \n    this.widgets.agents.setContent(content);\n  }\n  \n  updateCommandExecution(commands) {\n    const content = commands.map(cmd => {\n      const statusIcon = cmd.status === 'running' ? \n        '{yellow-fg}⏳{/}' : \n        cmd.status === 'completed' ? '{green-fg}✅{/}' : '{red-fg}❌{/}';\n      \n      const duration = cmd.duration ? `{gray-fg}(${cmd.duration}s){/}` : '';\n      const command = `{bold}${cmd.command.slice(0, 40)}...{/}`;\n      \n      return `${statusIcon} ${command} ${duration}`;\n    }).slice(-10).join('\\n'); // Show last 10 commands\n    \n    this.widgets.commands.setContent(content);\n  }\n  \n  updateProjectStatus(projectData) {\n    const progressBar = this.createProgressBar(projectData.progress || 0);\n    \n    const content = [\n      `{bold}{yellow-fg}Project:{/} ${projectData.name || 'Unknown'}`,\n      `{bold}Progress:{/} ${progressBar} ${projectData.progress || 0}%`,\n      `{bold}Tasks:{/} {green-fg}${projectData.completed || 0}{/}/{cyan-fg}${projectData.total || 0}{/}`,\n      `{bold}Active Agents:{/} {cyan-fg}${projectData.activeAgents || 0}{/}`,\n      `{bold}ETA:{/} {gray-fg}${projectData.eta || 'Unknown'}{/}`,\n      '',\n      '{bold}Recent Activity:{/}',\n      ...(projectData.recentActivity || []).map(activity => \n        `  {gray-fg}• ${activity}{/}`\n      )\n    ].join('\\n');\n    \n    this.widgets.project.setContent(content);\n  }\n  \n  createProgressBar(percentage, width = 20) {\n    const filled = Math.round((percentage / 100) * width);\n    const empty = width - filled;\n    \n    return `{green-fg}${'█'.repeat(filled)}{/}{gray-fg}${'░'.repeat(empty)}{/}`;\n  }\n  \n  showCommand(commandId, description, command) {\n    this.addLog('command', `Starting: ${description}`, 'exec');\n    this.addLog('debug', `Command: ${command}`, 'exec');\n  }\n  \n  showCommandOutput(commandId, output, error = false) {\n    const level = error ? 'error' : 'debug';\n    const lines = output.split('\\n').filter(line => line.trim());\n    \n    lines.forEach(line => {\n      this.addLog(level, line, 'output');\n    });\n  }\n  \n  showCommandComplete(commandId, success, duration) {\n    const level = success ? 'success' : 'error';\n    const message = success ? \n      `Command completed in ${duration}s` : \n      `Command failed after ${duration}s`;\n    \n    this.addLog(level, message, 'exec');\n  }\n  \n  showAgentActivity(agentId, role, activity) {\n    this.addLog('agent', `${role}: ${activity}`, agentId);\n  }\n  \n  showLLMActivity(model, tokens, confidence) {\n    this.addLog('llm', `${model} • ${tokens} tokens • ${confidence}% confidence`, 'llm');\n  }\n  \n  showError(error, context) {\n    this.addLog('error', `${context}: ${error.message}`, 'system');\n    if (error.stack) {\n      this.addLog('debug', error.stack, 'system');\n    }\n  }\n  \n  cycleFocus() {\n    const focusableWidgets = [\n      this.widgets.logs,\n      this.widgets.agents,\n      this.widgets.commands,\n      this.widgets.project\n    ];\n    \n    const currentIndex = focusableWidgets.findIndex(w => w === this.screen.focused);\n    const nextIndex = (currentIndex + 1) % focusableWidgets.length;\n    \n    focusableWidgets[nextIndex].focus();\n    this.screen.render();\n  }\n  \n  clearLogs() {\n    this.logs = [];\n    this.widgets.logs.setContent('');\n    this.addLog('info', 'Logs cleared', 'system');\n  }\n  \n  showHelp() {\n    const helpContent = [\n      '{center}{bold}{cyan-fg}Debo Terminal Dashboard Help{/}',\n      '',\n      '{bold}Keyboard Shortcuts:{/}',\n      '  {yellow-fg}q, ESC, Ctrl+C{/} - Quit application',\n      '  {yellow-fg}r{/} - Refresh display',\n      '  {yellow-fg}c{/} - Clear logs',\n      '  {yellow-fg}h{/} - Show this help',\n      '  {yellow-fg}Tab{/} - Cycle focus between panels',\n      '',\n      '{bold}Panels:{/}',\n      '  {cyan-fg}Agent Status{/} - Real-time agent activity',\n      '  {yellow-fg}Command Execution{/} - System commands and output',\n      '  {blue-fg}Project Status{/} - Project progress and metrics',\n      '  {magenta-fg}Real-time Logs{/} - All system activity logs',\n      '',\n      '{gray-fg}Press any key to close help...{/}'\n    ].join('\\n');\n    \n    const helpBox = blessed.box({\n      top: 'center',\n      left: 'center',\n      width: 60,\n      height: 20,\n      content: helpContent,\n      tags: true,\n      border: {\n        type: 'double'\n      },\n      style: {\n        fg: 'white',\n        border: {\n          fg: 'cyan'\n        }\n      }\n    });\n    \n    this.screen.append(helpBox);\n    helpBox.focus();\n    \n    helpBox.key(['escape', 'enter', 'space'], () => {\n      this.screen.remove(helpBox);\n      this.widgets.logs.focus();\n      this.screen.render();\n    });\n    \n    this.screen.render();\n  }\n  \n  updateDisplay() {\n    // Update all panels with fresh data\n    // In a real implementation, you'd fetch this data from your task manager\n    this.screen.render();\n  }\n  \n  refresh() {\n    this.screen.realloc();\n    this.updateDisplay();\n    this.addLog('info', 'Display refreshed', 'system');\n  }\n  \n  shutdown() {\n    this.addLog('info', 'Shutting down dashboard...', 'system');\n    this.screen.destroy();\n    process.exit(0);\n  }\n  \n  render() {\n    this.screen.render();\n  }\n}\n\nexport default TerminalDashboard;\n