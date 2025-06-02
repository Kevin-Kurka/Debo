import { getTerminalFeedbackSystem } from './terminal-feedback-system.js';
import logger from './logger.js';

/**
 * Terminal Integration Module
 * 
 * Provides integration between the MCP server and the terminal feedback system
 */

class TerminalIntegration {
  constructor() {
    this.feedbackSystem = null;
    this.enabled = process.env.DEBO_TERMINAL_UI === 'true';
    this.initialized = false;
  }

  /**
   * Initialize the terminal feedback system if enabled
   */
  async init() {
    if (!this.enabled || this.initialized) return;

    try {
      this.feedbackSystem = getTerminalFeedbackSystem();
      await this.feedbackSystem.init();
      this.initialized = true;
      
      logger.info('Terminal feedback system integrated successfully');
      
      // Show welcome message
      this.feedbackSystem.showNotification('Debo Terminal UI Active - Press h for help', 3000);
      
    } catch (error) {
      logger.error('Failed to initialize terminal feedback system:', error);
      this.enabled = false;
    }
  }

  /**
   * Check if terminal UI is available
   */
  isAvailable() {
    return this.enabled && this.initialized && this.feedbackSystem;
  }

  /**
   * Get the feedback system instance
   */
  getFeedbackSystem() {
    return this.feedbackSystem;
  }

  /**
   * Report a command execution
   */
  reportCommand(command, args) {
    if (!this.isAvailable()) return;
    
    this.feedbackSystem.addLog('info', `Executing command: ${command} ${args.join(' ')}`);
    this.feedbackSystem.showNotification(`Running: ${command}`, 2000);
  }

  /**
   * Report project creation
   */
  reportProjectCreation(projectName, projectId) {
    if (!this.isAvailable()) return;
    
    this.feedbackSystem.addLog('success', `Created project: ${projectName} (${projectId})`);
    this.feedbackSystem.reportDatabaseOperation({
      type: 'create',
      table: 'project',
      key: projectId,
      operation: 'hSet',
      agent: 'system',
      success: true
    });
  }

  /**
   * Report task creation
   */
  reportTaskCreation(task) {
    if (!this.isAvailable()) return;
    
    this.feedbackSystem.addLog('info', `Created task: ${task.title || task.id}`);
    this.feedbackSystem.reportTaskStatus(task.id, {
      status: 'pending',
      progress: 0,
      agent: task.requiredRole,
      agentRole: task.requiredRole,
      message: 'Task queued for execution',
      objective: task.description
    });
  }

  /**
   * Report error
   */
  reportError(error, context) {
    if (!this.isAvailable()) return;
    
    this.feedbackSystem.addLog('error', `Error in ${context}: ${error.message}`);
    this.feedbackSystem.showNotification(`Error: ${error.message}`, 5000);
  }

  /**
   * Shutdown the terminal UI
   */
  async shutdown() {
    if (this.feedbackSystem) {
      await this.feedbackSystem.shutdown();
      this.feedbackSystem = null;
      this.initialized = false;
    }
  }
}

// Singleton instance
let instance = null;

export function getTerminalIntegration() {
  if (!instance) {
    instance = new TerminalIntegration();
  }
  return instance;
}

export default TerminalIntegration;