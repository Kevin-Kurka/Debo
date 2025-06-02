import blessed from 'blessed';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import logger from './logger.js';
import TerminalProgressManager from './terminal-progress-manager.js';
import TerminalLayouts from './terminal-layouts.js';
import TerminalEventFormatter from './terminal-event-formatter.js';

/**
 * Terminal Feedback System
 * 
 * Provides real-time, verbose visibility into all Debo operations
 * with support for parallel agent activities and detailed progress tracking
 */
export class TerminalFeedbackSystem extends EventEmitter {
  constructor() {
    super();
    this.screen = null;
    this.layouts = new TerminalLayouts();
    this.progressManager = new TerminalProgressManager();
    this.formatter = new TerminalEventFormatter();
    this.activeAgents = new Map();
    this.databaseOperations = [];
    this.currentLayout = 'parallel';
    this.logBuffer = [];
    this.maxLogLines = 1000;
    this.updateInterval = null;
    this.isActive = false;
  }

  /**
   * Initialize the terminal UI
   */
  async init() {
    if (this.isActive) return;

    try {
      // Create blessed screen
      this.screen = blessed.screen({
        smartCSR: true,
        fullUnicode: true,
        title: 'Debo Terminal Feedback System'
      });

      // Set up layouts
      await this.layouts.init(this.screen);
      
      // Initialize progress manager with screen
      await this.progressManager.init(this.screen);

      // Set up key bindings
      this.setupKeyBindings();

      // Set up update loop
      this.startUpdateLoop();

      // Set initial layout
      await this.setLayout(this.currentLayout);

      this.isActive = true;
      logger.info('Terminal feedback system initialized');

    } catch (error) {
      logger.error('Failed to initialize terminal feedback system:', error);
      throw error;
    }
  }

  /**
   * Set up keyboard shortcuts
   */
  setupKeyBindings() {
    // Switch between layouts
    this.screen.key(['1'], () => this.setLayout('parallel'));
    this.screen.key(['2'], () => this.setLayout('sequential'));
    this.screen.key(['3'], () => this.setLayout('summary'));
    
    // Navigation
    this.screen.key(['up', 'k'], () => this.scrollUp());
    this.screen.key(['down', 'j'], () => this.scrollDown());
    this.screen.key(['pageup'], () => this.pageUp());
    this.screen.key(['pagedown'], () => this.pageDown());
    
    // Clear logs
    this.screen.key(['c'], () => this.clearLogs());
    
    // Toggle verbose mode
    this.screen.key(['v'], () => this.toggleVerbose());
    
    // Help
    this.screen.key(['h', '?'], () => this.showHelp());
    
    // Quit
    this.screen.key(['q', 'C-c'], () => this.shutdown());
  }

  /**
   * Start the update loop for refreshing the display
   */
  startUpdateLoop() {
    this.updateInterval = setInterval(() => {
      this.updateDisplay();
    }, 100); // Update 10 times per second
  }

  /**
   * Stop the update loop
   */
  stopUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update the display with current state
   */
  updateDisplay() {
    if (!this.isActive || !this.screen) return;

    try {
      // Update active agents display
      this.updateAgentsDisplay();
      
      // Update database operations
      this.updateDatabaseDisplay();
      
      // Update progress bars
      this.progressManager.update();
      
      // Render screen
      this.screen.render();
    } catch (error) {
      logger.error('Error updating display:', error);
    }
  }

  /**
   * Update agent activity display
   */
  updateAgentsDisplay() {
    const layout = this.layouts.getCurrentLayout();
    if (!layout || !layout.agentsBox) return;

    const agents = Array.from(this.activeAgents.values());
    const content = this.formatter.formatAgentActivities(agents, this.currentLayout);
    
    layout.agentsBox.setContent(content);
  }

  /**
   * Update database operations display
   */
  updateDatabaseDisplay() {
    const layout = this.layouts.getCurrentLayout();
    if (!layout || !layout.databaseBox) return;

    // Keep only recent operations
    this.databaseOperations = this.databaseOperations.slice(-50);
    
    const content = this.formatter.formatDatabaseOperations(this.databaseOperations);
    layout.databaseBox.setContent(content);
  }

  /**
   * Report agent activity
   */
  reportAgentActivity(agentId, activity) {
    const agentData = this.activeAgents.get(agentId) || {
      id: agentId,
      role: activity.role,
      startTime: Date.now(),
      activities: []
    };

    // Update agent data
    agentData.currentTask = activity.task;
    agentData.objective = activity.objective;
    agentData.progress = activity.progress || 0;
    agentData.status = activity.status || 'active';
    agentData.dataAvailable = activity.dataAvailable || [];
    agentData.nextSteps = activity.nextSteps || [];
    agentData.lastUpdate = Date.now();

    // Add to activity log
    agentData.activities.push({
      timestamp: Date.now(),
      message: activity.message,
      type: activity.type || 'info'
    });

    // Keep only recent activities
    agentData.activities = agentData.activities.slice(-20);

    this.activeAgents.set(agentId, agentData);

    // Update progress if provided
    if (activity.progress !== undefined) {
      this.progressManager.updateProgress(agentId, {
        label: `${activity.role}: ${activity.task}`,
        progress: activity.progress,
        status: activity.status
      });
    }

    // Emit event for other components
    this.emit('agent:activity', { agentId, activity });
  }

  /**
   * Report database operation
   */
  reportDatabaseOperation(operation) {
    const dbOp = {
      timestamp: Date.now(),
      type: operation.type,
      table: operation.table,
      key: operation.key,
      operation: operation.operation,
      data: operation.data,
      agent: operation.agent,
      success: operation.success !== false
    };

    this.databaseOperations.push(dbOp);

    // Log verbose database operation
    const message = this.formatter.formatDatabaseOperation(dbOp);
    this.addLog('database', message);

    // Emit event
    this.emit('database:operation', dbOp);
  }

  /**
   * Report task status update
   */
  reportTaskStatus(taskId, status) {
    const taskUpdate = {
      timestamp: Date.now(),
      taskId,
      status: status.status,
      progress: status.progress,
      agent: status.agent,
      message: status.message,
      deliverables: status.deliverables
    };

    // Update agent if provided
    if (status.agent) {
      this.reportAgentActivity(status.agent, {
        role: status.agentRole,
        task: taskId,
        objective: status.objective,
        progress: status.progress,
        status: status.status,
        message: status.message,
        dataAvailable: status.dataAvailable,
        nextSteps: status.nextSteps
      });
    }

    // Emit event
    this.emit('task:status', taskUpdate);
  }

  /**
   * Add a log message
   */
  addLog(type, message) {
    const log = {
      timestamp: Date.now(),
      type,
      message
    };

    this.logBuffer.push(log);
    
    // Keep buffer size limited
    if (this.logBuffer.length > this.maxLogLines) {
      this.logBuffer = this.logBuffer.slice(-this.maxLogLines);
    }

    // Update log display if in sequential mode
    if (this.currentLayout === 'sequential') {
      this.updateLogDisplay();
    }
  }

  /**
   * Update log display
   */
  updateLogDisplay() {
    const layout = this.layouts.getCurrentLayout();
    if (!layout || !layout.logsBox) return;

    const logs = this.logBuffer.slice(-30); // Show last 30 logs
    const content = this.formatter.formatLogs(logs);
    
    layout.logsBox.setContent(content);
  }

  /**
   * Switch layout
   */
  async setLayout(layoutName) {
    if (!this.layouts.hasLayout(layoutName)) {
      logger.warn(`Unknown layout: ${layoutName}`);
      return;
    }

    this.currentLayout = layoutName;
    await this.layouts.setLayout(layoutName);
    
    // Update display with new layout
    this.updateDisplay();
    
    // Show layout notification
    this.showNotification(`Switched to ${layoutName} view`);
  }

  /**
   * Show a temporary notification
   */
  showNotification(message, duration = 2000) {
    const notification = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 3,
      content: ` ${message} `,
      align: 'center',
      valign: 'middle',
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: 'cyan'
        }
      }
    });

    this.screen.render();

    setTimeout(() => {
      notification.destroy();
      this.screen.render();
    }, duration);
  }

  /**
   * Show help dialog
   */
  showHelp() {
    const helpText = `
${chalk.bold('Debo Terminal Feedback System - Help')}

${chalk.yellow('Layout Controls:')}
  1 - Parallel view (shows all agents side by side)
  2 - Sequential view (shows one agent with detailed logs)
  3 - Summary view (high-level overview)

${chalk.yellow('Navigation:')}
  ↑/k     - Scroll up
  ↓/j     - Scroll down
  PgUp    - Page up
  PgDown  - Page down

${chalk.yellow('Actions:')}
  c - Clear logs
  v - Toggle verbose mode
  h/? - Show this help
  q/Ctrl+C - Quit

${chalk.yellow('Status Colors:')}
  ${chalk.green('●')} Active/Success
  ${chalk.yellow('●')} In Progress
  ${chalk.red('●')} Failed/Error
  ${chalk.blue('●')} Information
  ${chalk.gray('●')} Inactive

Press any key to close this help...
`;

    const helpBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      content: helpText,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        inverse: true
      },
      border: {
        type: 'line',
        fg: 'yellow'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'yellow'
        }
      }
    });

    helpBox.focus();
    
    helpBox.key(['escape', 'q', 'enter', 'space'], () => {
      helpBox.destroy();
      this.screen.render();
    });

    this.screen.render();
  }

  /**
   * Scroll operations
   */
  scrollUp() {
    const layout = this.layouts.getCurrentLayout();
    const activeBox = layout.getActiveBox();
    if (activeBox && activeBox.scroll) {
      activeBox.scroll(-1);
      this.screen.render();
    }
  }

  scrollDown() {
    const layout = this.layouts.getCurrentLayout();
    const activeBox = layout.getActiveBox();
    if (activeBox && activeBox.scroll) {
      activeBox.scroll(1);
      this.screen.render();
    }
  }

  pageUp() {
    const layout = this.layouts.getCurrentLayout();
    const activeBox = layout.getActiveBox();
    if (activeBox && activeBox.scroll) {
      activeBox.scroll(-10);
      this.screen.render();
    }
  }

  pageDown() {
    const layout = this.layouts.getCurrentLayout();
    const activeBox = layout.getActiveBox();
    if (activeBox && activeBox.scroll) {
      activeBox.scroll(10);
      this.screen.render();
    }
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logBuffer = [];
    this.databaseOperations = [];
    this.updateDisplay();
    this.showNotification('Logs cleared');
  }

  /**
   * Toggle verbose mode
   */
  toggleVerbose() {
    this.verbose = !this.verbose;
    this.showNotification(`Verbose mode: ${this.verbose ? 'ON' : 'OFF'}`);
  }

  /**
   * Mark agent as completed
   */
  completeAgent(agentId) {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      agent.status = 'completed';
      agent.endTime = Date.now();
      agent.progress = 100;
      
      // Remove from progress manager after a delay
      setTimeout(() => {
        this.progressManager.removeProgress(agentId);
        this.activeAgents.delete(agentId);
      }, 5000);
    }
  }

  /**
   * Shutdown the feedback system
   */
  async shutdown() {
    this.isActive = false;
    
    // Stop update loop
    this.stopUpdateLoop();
    
    // Clear screen
    if (this.screen) {
      this.screen.destroy();
      this.screen = null;
    }
    
    // Emit shutdown event
    this.emit('shutdown');
    
    logger.info('Terminal feedback system shut down');
    
    // Exit process if this was the main UI
    if (process.env.DEBO_TERMINAL_MODE === 'true') {
      process.exit(0);
    }
  }
}

// Singleton instance
let instance = null;

export function getTerminalFeedbackSystem() {
  if (!instance) {
    instance = new TerminalFeedbackSystem();
  }
  return instance;
}

export default TerminalFeedbackSystem;