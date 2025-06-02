import blessed from 'blessed';
import chalk from 'chalk';
import logger from './logger.js';

/**
 * Terminal Progress Manager
 * 
 * Manages multiple progress bars for parallel operations
 * Provides real-time updates without screen flicker
 */
export default class TerminalProgressManager {
  constructor() {
    this.progressBars = new Map();
    this.screen = null;
    this.container = null;
    this.maxProgressBars = 10;
    this.barHeight = 3;
    this.updateQueue = [];
    this.isUpdating = false;
  }

  /**
   * Initialize the progress manager with a blessed screen
   */
  async init(screen) {
    this.screen = screen;
    
    // Create container for progress bars
    this.container = blessed.box({
      parent: screen,
      label: ' Progress ',
      bottom: 0,
      left: 0,
      width: '100%',
      height: this.maxProgressBars * this.barHeight + 2,
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan'
        }
      }
    });

    logger.info('Terminal progress manager initialized');
  }

  /**
   * Update or create a progress bar
   */
  updateProgress(id, options = {}) {
    const {
      label = '',
      progress = 0,
      status = 'active',
      total = 100,
      showPercentage = true,
      showETA = true,
      color = this.getColorForStatus(status)
    } = options;

    // Queue update to prevent flicker
    this.updateQueue.push({
      id,
      label,
      progress: Math.min(Math.max(0, progress), total),
      total,
      status,
      showPercentage,
      showETA,
      color,
      timestamp: Date.now()
    });

    // Process queue if not already updating
    if (!this.isUpdating) {
      this.processUpdateQueue();
    }
  }

  /**
   * Process queued updates
   */
  async processUpdateQueue() {
    if (this.updateQueue.length === 0 || this.isUpdating) return;

    this.isUpdating = true;

    try {
      // Process all queued updates
      while (this.updateQueue.length > 0) {
        const update = this.updateQueue.shift();
        this.applyProgressUpdate(update);
      }

      // Render once after all updates
      this.render();
    } catch (error) {
      logger.error('Error processing progress updates:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Apply a single progress update
   */
  applyProgressUpdate(update) {
    let progressBar = this.progressBars.get(update.id);

    if (!progressBar) {
      // Create new progress bar
      progressBar = this.createProgressBar(update.id);
      this.progressBars.set(update.id, progressBar);
    }

    // Update progress bar data
    Object.assign(progressBar, update);

    // Calculate ETA if requested
    if (update.showETA && progressBar.startTime) {
      const elapsed = Date.now() - progressBar.startTime;
      const rate = update.progress / elapsed;
      const remaining = (update.total - update.progress) / rate;
      progressBar.eta = this.formatTime(remaining);
    }

    // Clean up old progress bars
    this.cleanupOldProgressBars();
  }

  /**
   * Create a new progress bar
   */
  createProgressBar(id) {
    return {
      id,
      label: '',
      progress: 0,
      total: 100,
      status: 'active',
      showPercentage: true,
      showETA: true,
      color: 'green',
      startTime: Date.now(),
      lastUpdate: Date.now()
    };
  }

  /**
   * Render all progress bars
   */
  render() {
    if (!this.container || !this.screen) return;

    const content = this.generateProgressContent();
    this.container.setContent(content);
    
    // Update container height based on number of progress bars
    const newHeight = Math.min(
      this.progressBars.size * this.barHeight + 2,
      this.maxProgressBars * this.barHeight + 2
    );
    
    if (this.container.height !== newHeight) {
      this.container.height = newHeight;
    }
  }

  /**
   * Generate content for all progress bars
   */
  generateProgressContent() {
    const bars = Array.from(this.progressBars.values());
    
    // Sort by most recently updated
    bars.sort((a, b) => b.lastUpdate - a.lastUpdate);
    
    // Take only the most recent bars that fit
    const visibleBars = bars.slice(0, this.maxProgressBars);
    
    return visibleBars.map(bar => this.renderProgressBar(bar)).join('\n');
  }

  /**
   * Render a single progress bar
   */
  renderProgressBar(bar) {
    const percentage = (bar.progress / bar.total) * 100;
    const barWidth = this.container.width - 4; // Account for borders
    const labelWidth = Math.floor(barWidth * 0.4);
    const progressWidth = barWidth - labelWidth - 15; // Space for percentage and ETA
    
    // Format label
    const label = this.truncateLabel(bar.label, labelWidth);
    
    // Calculate filled and empty portions
    const filled = Math.floor((percentage / 100) * progressWidth);
    const empty = progressWidth - filled;
    
    // Build progress bar
    const progressChar = this.getProgressChar(bar.status);
    const emptyChar = '░';
    
    let progressBar = chalk[bar.color](progressChar.repeat(filled)) + 
                     chalk.gray(emptyChar.repeat(empty));
    
    // Add percentage
    const percentageStr = bar.showPercentage ? 
      chalk.white(` ${percentage.toFixed(1)}%`.padStart(6)) : '';
    
    // Add ETA
    const etaStr = bar.showETA && bar.eta ? 
      chalk.gray(` ETA: ${bar.eta}`.padEnd(12)) : '';
    
    // Add status indicator
    const statusIndicator = this.getStatusIndicator(bar.status);
    
    // Combine all parts
    return `${statusIndicator} ${label.padEnd(labelWidth)} ${progressBar}${percentageStr}${etaStr}`;
  }

  /**
   * Get progress character based on status
   */
  getProgressChar(status) {
    switch (status) {
      case 'active':
      case 'running':
        return '█';
      case 'completed':
        return '█';
      case 'error':
      case 'failed':
        return '▓';
      case 'paused':
        return '▒';
      default:
        return '█';
    }
  }

  /**
   * Get status indicator
   */
  getStatusIndicator(status) {
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
      default:
        return chalk.gray('○');
    }
  }

  /**
   * Get color for status
   */
  getColorForStatus(status) {
    switch (status) {
      case 'active':
      case 'running':
        return 'cyan';
      case 'completed':
        return 'green';
      case 'error':
      case 'failed':
        return 'red';
      case 'paused':
        return 'yellow';
      default:
        return 'white';
    }
  }

  /**
   * Truncate label to fit width
   */
  truncateLabel(label, maxWidth) {
    if (label.length <= maxWidth) {
      return label;
    }
    return label.substring(0, maxWidth - 3) + '...';
  }

  /**
   * Format time in human-readable format
   */
  formatTime(milliseconds) {
    if (!milliseconds || milliseconds < 0) return '';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Remove a progress bar
   */
  removeProgress(id) {
    this.progressBars.delete(id);
    this.render();
  }

  /**
   * Clean up old completed progress bars
   */
  cleanupOldProgressBars() {
    const now = Date.now();
    const maxAge = 30000; // 30 seconds
    
    for (const [id, bar] of this.progressBars.entries()) {
      if (bar.status === 'completed' && now - bar.lastUpdate > maxAge) {
        this.progressBars.delete(id);
      }
    }
  }

  /**
   * Update method called by the feedback system
   */
  update() {
    // Process any pending updates
    this.processUpdateQueue();
    
    // Update ETAs for active progress bars
    for (const bar of this.progressBars.values()) {
      if (bar.status === 'active' && bar.showETA) {
        // Trigger re-render to update ETAs
        this.updateQueue.push({
          ...bar,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Clear all progress bars
   */
  clear() {
    this.progressBars.clear();
    this.updateQueue = [];
    this.render();
  }

  /**
   * Set container visibility
   */
  setVisible(visible) {
    if (this.container) {
      this.container.visible = visible;
      if (this.screen) {
        this.screen.render();
      }
    }
  }

  /**
   * Get current progress summary
   */
  getSummary() {
    const bars = Array.from(this.progressBars.values());
    const active = bars.filter(b => b.status === 'active').length;
    const completed = bars.filter(b => b.status === 'completed').length;
    const failed = bars.filter(b => b.status === 'error' || b.status === 'failed').length;
    
    return {
      total: bars.length,
      active,
      completed,
      failed,
      bars: bars.map(b => ({
        id: b.id,
        label: b.label,
        progress: b.progress,
        total: b.total,
        percentage: (b.progress / b.total) * 100,
        status: b.status
      }))
    };
  }
}