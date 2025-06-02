import chalk from 'chalk';
import boxen from 'boxen';

/**
 * Terminal Event Formatter
 * 
 * Formats events for display with color coding and icons
 */
export default class TerminalEventFormatter {
  constructor() {
    // Agent role colors
    this.roleColors = {
      'cto': 'cyan',
      'engineering_manager': 'blue',
      'product_manager': 'green',
      'business_analyst': 'yellow',
      'solution_architect': 'magenta',
      'technical_writer': 'gray',
      'backend_developer': 'red',
      'frontend_developer': 'blue',
      'qa_engineer': 'yellow',
      'devops_engineer': 'magenta',
      'security_engineer': 'red',
      'ux_designer': 'green'
    };

    // Operation icons
    this.icons = {
      read: '📖',
      write: '✏️',
      delete: '🗑️',
      update: '🔄',
      create: '✨',
      error: '❌',
      success: '✅',
      warning: '⚠️',
      info: 'ℹ️',
      database: '🗄️',
      agent: '🤖',
      task: '📋',
      code: '💻',
      test: '🧪',
      deploy: '🚀',
      security: '🔒',
      design: '🎨'
    };
  }

  /**
   * Format agent activities for parallel view
   */
  formatAgentActivities(agents, layout = 'parallel') {
    if (agents.length === 0) {
      return chalk.gray('No active agents');
    }

    switch (layout) {
      case 'parallel':
        return this.formatParallelAgents(agents);
      case 'sequential':
        return this.formatSequentialAgent(agents[0]); // Show first agent
      case 'summary':
        return this.formatAgentSummary(agents);
      default:
        return this.formatParallelAgents(agents);
    }
  }

  /**
   * Format agents for parallel view
   */
  formatParallelAgents(agents) {
    const columns = 2;
    const columnWidth = 45;
    const rows = [];
    
    for (let i = 0; i < agents.length; i += columns) {
      const row = [];
      
      for (let j = 0; j < columns && i + j < agents.length; j++) {
        const agent = agents[i + j];
        const box = this.formatAgentBox(agent, columnWidth);
        row.push(box);
      }
      
      // Combine columns side by side
      const combinedRow = this.combineBoxes(row, columnWidth);
      rows.push(combinedRow);
    }
    
    return rows.join('\n\n');
  }

  /**
   * Format a single agent box
   */
  formatAgentBox(agent, width) {
    const color = this.roleColors[agent.role] || 'white';
    const statusIcon = this.getStatusIcon(agent.status);
    const roleIcon = this.getRoleIcon(agent.role);
    
    // Header
    const header = chalk[color].bold(`${roleIcon} ${agent.role.toUpperCase()}`);
    const status = `${statusIcon} ${agent.status}`;
    
    // Content sections
    const sections = [];
    
    // Current task
    if (agent.currentTask) {
      sections.push(chalk.white('Task: ') + chalk.yellow(this.truncate(agent.currentTask, width - 10)));
    }
    
    // Objective
    if (agent.objective) {
      sections.push(chalk.white('Objective: ') + chalk.cyan(this.truncate(agent.objective, width - 15)));
    }
    
    // Progress
    if (agent.progress !== undefined) {
      const progressBar = this.createMiniProgressBar(agent.progress, 20);
      sections.push(chalk.white('Progress: ') + progressBar + chalk.gray(` ${agent.progress}%`));
    }
    
    // Available data
    if (agent.dataAvailable && agent.dataAvailable.length > 0) {
      const dataList = agent.dataAvailable.slice(0, 3).map(d => `  • ${d}`).join('\n');
      sections.push(chalk.white('Data Available:\n') + chalk.green(dataList));
    }
    
    // Next steps
    if (agent.nextSteps && agent.nextSteps.length > 0) {
      const stepsList = agent.nextSteps.slice(0, 2).map(s => `  → ${s}`).join('\n');
      sections.push(chalk.white('Next Steps:\n') + chalk.blue(stepsList));
    }
    
    // Recent activity
    if (agent.activities && agent.activities.length > 0) {
      const recent = agent.activities[agent.activities.length - 1];
      const timeAgo = this.formatTimeAgo(recent.timestamp);
      sections.push(chalk.gray(`Last: ${recent.message} (${timeAgo})`));
    }
    
    // Build box content
    const content = [
      `${header} ${status}`,
      chalk.gray('─'.repeat(width - 4)),
      ...sections
    ].join('\n');
    
    return content;
  }

  /**
   * Format agent for sequential view (detailed)
   */
  formatSequentialAgent(agent) {
    if (!agent) return chalk.gray('No agent selected');
    
    const color = this.roleColors[agent.role] || 'white';
    const roleIcon = this.getRoleIcon(agent.role);
    const statusIcon = this.getStatusIcon(agent.status);
    
    const sections = [];
    
    // Header section
    sections.push(chalk[color].bold(`${roleIcon} ${agent.role.toUpperCase()}`));
    sections.push(chalk.gray('═'.repeat(50)));
    
    // Status section
    sections.push(chalk.white.bold('Status:') + ` ${statusIcon} ${agent.status}`);
    sections.push(chalk.white.bold('Agent ID:') + ` ${agent.id}`);
    
    if (agent.startTime) {
      const duration = this.formatDuration(Date.now() - agent.startTime);
      sections.push(chalk.white.bold('Duration:') + ` ${duration}`);
    }
    
    sections.push('');
    
    // Task information
    if (agent.currentTask) {
      sections.push(chalk.yellow.bold('Current Task:'));
      sections.push(this.wrapText(agent.currentTask, 60));
      sections.push('');
    }
    
    // Objective
    if (agent.objective) {
      sections.push(chalk.cyan.bold('Objective:'));
      sections.push(this.wrapText(agent.objective, 60));
      sections.push('');
    }
    
    // Progress
    if (agent.progress !== undefined) {
      sections.push(chalk.white.bold('Progress:'));
      const progressBar = this.createProgressBar(agent.progress, 40);
      sections.push(progressBar);
      sections.push('');
    }
    
    // Available data
    if (agent.dataAvailable && agent.dataAvailable.length > 0) {
      sections.push(chalk.green.bold('Available Data:'));
      agent.dataAvailable.forEach(data => {
        sections.push(`  ${this.icons.database} ${data}`);
      });
      sections.push('');
    }
    
    // Next steps
    if (agent.nextSteps && agent.nextSteps.length > 0) {
      sections.push(chalk.blue.bold('Next Steps:'));
      agent.nextSteps.forEach((step, i) => {
        sections.push(`  ${i + 1}. ${step}`);
      });
      sections.push('');
    }
    
    // Recent activities
    if (agent.activities && agent.activities.length > 0) {
      sections.push(chalk.magenta.bold('Recent Activities:'));
      agent.activities.slice(-5).reverse().forEach(activity => {
        const time = this.formatTime(activity.timestamp);
        const icon = this.getActivityIcon(activity.type);
        sections.push(`  ${time} ${icon} ${activity.message}`);
      });
    }
    
    return sections.join('\n');
  }

  /**
   * Format agent summary
   */
  formatAgentSummary(agents) {
    const summary = {
      total: agents.length,
      active: agents.filter(a => a.status === 'active').length,
      completed: agents.filter(a => a.status === 'completed').length,
      failed: agents.filter(a => a.status === 'failed' || a.status === 'error').length,
      idle: agents.filter(a => a.status === 'idle').length
    };
    
    const sections = [];
    
    // Overview
    sections.push(chalk.white.bold('Agent Overview'));
    sections.push(chalk.gray('─'.repeat(40)));
    sections.push(`Total Agents: ${chalk.cyan(summary.total)}`);
    sections.push(`Active: ${chalk.green(summary.active)}`);
    sections.push(`Completed: ${chalk.blue(summary.completed)}`);
    sections.push(`Failed: ${chalk.red(summary.failed)}`);
    sections.push(`Idle: ${chalk.gray(summary.idle)}`);
    sections.push('');
    
    // Active agents list
    if (summary.active > 0) {
      sections.push(chalk.green.bold('Active Agents:'));
      agents.filter(a => a.status === 'active').forEach(agent => {
        const progress = agent.progress ? ` (${agent.progress}%)` : '';
        sections.push(`  ${this.getRoleIcon(agent.role)} ${agent.role}: ${agent.currentTask || 'Working...'}${progress}`);
      });
    }
    
    return sections.join('\n');
  }

  /**
   * Format database operations
   */
  formatDatabaseOperations(operations) {
    if (operations.length === 0) {
      return chalk.gray('No recent database operations');
    }
    
    const formatted = operations.slice(-20).reverse().map(op => {
      const time = this.formatTime(op.timestamp);
      const icon = this.getDatabaseIcon(op.type);
      const color = op.success ? 'green' : 'red';
      
      let message = `${chalk.gray(time)} ${icon} `;
      message += chalk[color](`${op.operation.toUpperCase()}`);
      message += chalk.white(` ${op.table}`);
      
      if (op.key) {
        message += chalk.gray(`:${op.key}`);
      }
      
      if (op.agent) {
        message += chalk.blue(` [${op.agent}]`);
      }
      
      return message;
    });
    
    return formatted.join('\n');
  }

  /**
   * Format a single database operation (verbose)
   */
  formatDatabaseOperation(op) {
    const icon = this.getDatabaseIcon(op.type);
    const parts = [
      icon,
      chalk.yellow(op.operation.toUpperCase()),
      chalk.cyan(op.table),
      op.key ? chalk.gray(`:${op.key}`) : '',
      op.agent ? chalk.blue(`[${op.agent}]`) : ''
    ];
    
    return parts.filter(p => p).join(' ');
  }

  /**
   * Format logs
   */
  formatLogs(logs) {
    if (logs.length === 0) {
      return chalk.gray('No logs');
    }
    
    return logs.map(log => {
      const time = this.formatTime(log.timestamp);
      const icon = this.getLogIcon(log.type);
      const color = this.getLogColor(log.type);
      
      return `${chalk.gray(time)} ${icon} ${chalk[color](log.message)}`;
    }).join('\n');
  }

  /**
   * Helper: Create progress bar
   */
  createProgressBar(progress, width = 30) {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const percentage = chalk.white(` ${progress}%`);
    
    return `[${bar}]${percentage}`;
  }

  /**
   * Helper: Create mini progress bar
   */
  createMiniProgressBar(progress, width = 10) {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    
    return chalk.green('▰'.repeat(filled)) + chalk.gray('▱'.repeat(empty));
  }

  /**
   * Helper: Combine boxes side by side
   */
  combineBoxes(boxes, width) {
    if (boxes.length === 0) return '';
    if (boxes.length === 1) return boxes[0];
    
    const lines = boxes.map(box => box.split('\n'));
    const maxLines = Math.max(...lines.map(l => l.length));
    const combined = [];
    
    for (let i = 0; i < maxLines; i++) {
      const row = boxes.map((box, j) => {
        const line = lines[j][i] || '';
        return line.padEnd(width);
      }).join(' │ ');
      combined.push(row);
    }
    
    return combined.join('\n');
  }

  /**
   * Helper: Get status icon
   */
  getStatusIcon(status) {
    switch (status) {
      case 'active':
      case 'running':
        return chalk.green('●');
      case 'completed':
        return chalk.green('✓');
      case 'error':
      case 'failed':
        return chalk.red('✗');
      case 'paused':
        return chalk.yellow('⏸');
      case 'idle':
        return chalk.gray('○');
      default:
        return chalk.blue('?');
    }
  }

  /**
   * Helper: Get role icon
   */
  getRoleIcon(role) {
    const icons = {
      'cto': '👔',
      'engineering_manager': '👨‍💼',
      'product_manager': '📊',
      'business_analyst': '📈',
      'solution_architect': '🏗️',
      'technical_writer': '📝',
      'backend_developer': '⚙️',
      'frontend_developer': '🎨',
      'qa_engineer': '🧪',
      'devops_engineer': '🚀',
      'security_engineer': '🔒',
      'ux_designer': '✨'
    };
    
    return icons[role] || '🤖';
  }

  /**
   * Helper: Get database icon
   */
  getDatabaseIcon(type) {
    switch (type) {
      case 'read':
        return '📖';
      case 'write':
        return '✏️';
      case 'update':
        return '🔄';
      case 'delete':
        return '🗑️';
      case 'create':
        return '✨';
      default:
        return '🗄️';
    }
  }

  /**
   * Helper: Get activity icon
   */
  getActivityIcon(type) {
    return this.icons[type] || '•';
  }

  /**
   * Helper: Get log icon
   */
  getLogIcon(type) {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      case 'info':
        return 'ℹ️';
      case 'database':
        return '🗄️';
      default:
        return '•';
    }
  }

  /**
   * Helper: Get log color
   */
  getLogColor(type) {
    switch (type) {
      case 'error':
        return 'red';
      case 'warning':
        return 'yellow';
      case 'success':
        return 'green';
      case 'info':
        return 'blue';
      case 'database':
        return 'magenta';
      default:
        return 'white';
    }
  }

  /**
   * Helper: Format time
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Helper: Format time ago
   */
  formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /**
   * Helper: Format duration
   */
  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Helper: Truncate text
   */
  truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Helper: Wrap text
   */
  wrapText(text, width) {
    if (!text || text.length <= width) return text;
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
  }
}