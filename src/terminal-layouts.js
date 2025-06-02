import blessed from 'blessed';
import chalk from 'chalk';
import logger from './logger.js';

/**
 * Terminal Layouts
 * 
 * Defines different layout modes for the terminal UI
 */
export default class TerminalLayouts {
  constructor() {
    this.screen = null;
    this.layouts = new Map();
    this.currentLayout = null;
    this.currentLayoutName = null;
  }

  /**
   * Initialize layouts with blessed screen
   */
  async init(screen) {
    this.screen = screen;
    
    // Create all layout configurations
    this.createParallelLayout();
    this.createSequentialLayout();
    this.createSummaryLayout();
    
    logger.info('Terminal layouts initialized');
  }

  /**
   * Create parallel view layout
   * Shows all active agents side by side
   */
  createParallelLayout() {
    const layout = {
      name: 'parallel',
      components: {}
    };

    // Header
    layout.components.header = blessed.box({
      parent: this.screen,
      label: ' Debo - Parallel Agent View ',
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
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

    // Agents container (main area)
    layout.components.agentsBox = blessed.box({
      parent: this.screen,
      label: ' Active Agents ',
      top: 3,
      left: 0,
      width: '70%',
      height: '60%',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray'
        },
        style: {
          inverse: true
        }
      },
      border: {
        type: 'line',
        fg: 'green'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'green'
        }
      }
    });

    // Database operations (right side)
    layout.components.databaseBox = blessed.box({
      parent: this.screen,
      label: ' Database Operations ',
      top: 3,
      left: '70%',
      width: '30%',
      height: '60%',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray'
        },
        style: {
          inverse: true
        }
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

    // Status bar
    layout.components.statusBar = blessed.box({
      parent: this.screen,
      bottom: 12,
      left: 0,
      width: '100%',
      height: 3,
      border: {
        type: 'line',
        fg: 'blue'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'blue'
        }
      }
    });

    // Set active box for scrolling
    layout.getActiveBox = () => layout.components.agentsBox;

    this.layouts.set('parallel', layout);
  }

  /**
   * Create sequential view layout
   * Shows one agent at a time with detailed info
   */
  createSequentialLayout() {
    const layout = {
      name: 'sequential',
      components: {}
    };

    // Header
    layout.components.header = blessed.box({
      parent: this.screen,
      label: ' Debo - Sequential Agent View ',
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
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

    // Agent selector (left side)
    layout.components.agentList = blessed.list({
      parent: this.screen,
      label: ' Agents ',
      top: 3,
      left: 0,
      width: '20%',
      height: '70%',
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      style: {
        fg: 'white',
        bg: 'black',
        selected: {
          fg: 'black',
          bg: 'cyan'
        }
      },
      border: {
        type: 'line',
        fg: 'blue'
      }
    });

    // Agent detail view (center)
    layout.components.agentDetail = blessed.box({
      parent: this.screen,
      label: ' Agent Details ',
      top: 3,
      left: '20%',
      width: '50%',
      height: '40%',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray'
        },
        style: {
          inverse: true
        }
      },
      border: {
        type: 'line',
        fg: 'green'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'green'
        }
      }
    });

    // Agent logs (bottom center)
    layout.components.logsBox = blessed.box({
      parent: this.screen,
      label: ' Agent Logs ',
      top: '43%',
      left: '20%',
      width: '50%',
      height: '30%',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray'
        },
        style: {
          inverse: true
        }
      },
      border: {
        type: 'line',
        fg: 'magenta'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'magenta'
        }
      }
    });

    // Database operations (right side)
    layout.components.databaseBox = blessed.box({
      parent: this.screen,
      label: ' Database Operations ',
      top: 3,
      left: '70%',
      width: '30%',
      height: '70%',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray'
        },
        style: {
          inverse: true
        }
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

    // Status bar
    layout.components.statusBar = blessed.box({
      parent: this.screen,
      bottom: 12,
      left: 0,
      width: '100%',
      height: 3,
      border: {
        type: 'line',
        fg: 'blue'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'blue'
        }
      }
    });

    // Set active box for scrolling
    layout.getActiveBox = () => layout.components.agentDetail;

    this.layouts.set('sequential', layout);
  }

  /**
   * Create summary view layout
   * High-level overview of all operations
   */
  createSummaryLayout() {
    const layout = {
      name: 'summary',
      components: {}
    };

    // Header
    layout.components.header = blessed.box({
      parent: this.screen,
      label: ' Debo - Summary View ',
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
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

    // Project overview (top left)
    layout.components.projectBox = blessed.box({
      parent: this.screen,
      label: ' Project Status ',
      top: 3,
      left: 0,
      width: '50%',
      height: '30%',
      border: {
        type: 'line',
        fg: 'green'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'green'
        }
      }
    });

    // Agent summary (top right)
    layout.components.agentsBox = blessed.box({
      parent: this.screen,
      label: ' Agent Summary ',
      top: 3,
      left: '50%',
      width: '50%',
      height: '30%',
      border: {
        type: 'line',
        fg: 'blue'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'blue'
        }
      }
    });

    // Task statistics (middle left)
    layout.components.tasksBox = blessed.box({
      parent: this.screen,
      label: ' Task Statistics ',
      top: '33%',
      left: 0,
      width: '50%',
      height: '25%',
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

    // Database statistics (middle right)
    layout.components.databaseBox = blessed.box({
      parent: this.screen,
      label: ' Database Statistics ',
      top: '33%',
      left: '50%',
      width: '50%',
      height: '25%',
      border: {
        type: 'line',
        fg: 'magenta'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'magenta'
        }
      }
    });

    // Recent activity (bottom)
    layout.components.activityBox = blessed.box({
      parent: this.screen,
      label: ' Recent Activity ',
      top: '58%',
      left: 0,
      width: '100%',
      height: '15%',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray'
        },
        style: {
          inverse: true
        }
      },
      border: {
        type: 'line',
        fg: 'red'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'red'
        }
      }
    });

    // Status bar
    layout.components.statusBar = blessed.box({
      parent: this.screen,
      bottom: 12,
      left: 0,
      width: '100%',
      height: 3,
      border: {
        type: 'line',
        fg: 'blue'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'blue'
        }
      }
    });

    // Set active box for scrolling
    layout.getActiveBox = () => layout.components.activityBox;

    this.layouts.set('summary', layout);
  }

  /**
   * Switch to a specific layout
   */
  async setLayout(layoutName) {
    if (!this.layouts.has(layoutName)) {
      throw new Error(`Unknown layout: ${layoutName}`);
    }

    // Hide current layout
    if (this.currentLayout) {
      this.hideLayout(this.currentLayout);
    }

    // Show new layout
    this.currentLayoutName = layoutName;
    this.currentLayout = this.layouts.get(layoutName);
    this.showLayout(this.currentLayout);

    // Update status bar
    this.updateStatusBar();

    // Render screen
    if (this.screen) {
      this.screen.render();
    }
  }

  /**
   * Hide all components of a layout
   */
  hideLayout(layout) {
    Object.values(layout.components).forEach(component => {
      if (component && component.hide) {
        component.hide();
      }
    });
  }

  /**
   * Show all components of a layout
   */
  showLayout(layout) {
    Object.values(layout.components).forEach(component => {
      if (component && component.show) {
        component.show();
      }
    });
  }

  /**
   * Update the status bar with current info
   */
  updateStatusBar() {
    if (!this.currentLayout || !this.currentLayout.components.statusBar) return;

    const statusBar = this.currentLayout.components.statusBar;
    const time = new Date().toLocaleTimeString();
    const layout = this.currentLayoutName;
    
    const content = chalk.gray(' View: ') + chalk.cyan(layout) +
                   chalk.gray(' | Press ') + chalk.yellow('h') + 
                   chalk.gray(' for help | ') + chalk.white(time);
    
    statusBar.setContent(content);
  }

  /**
   * Get current layout
   */
  getCurrentLayout() {
    return this.currentLayout;
  }

  /**
   * Check if layout exists
   */
  hasLayout(layoutName) {
    return this.layouts.has(layoutName);
  }

  /**
   * Get specific component from current layout
   */
  getComponent(componentName) {
    if (!this.currentLayout || !this.currentLayout.components[componentName]) {
      return null;
    }
    return this.currentLayout.components[componentName];
  }

  /**
   * Update agent list in sequential view
   */
  updateAgentList(agents) {
    const agentList = this.getComponent('agentList');
    if (!agentList || this.currentLayoutName !== 'sequential') return;

    const items = agents.map(agent => {
      const status = this.getAgentStatusIcon(agent.status);
      return `${status} ${agent.role} - ${agent.currentTask || 'Idle'}`;
    });

    agentList.setItems(items);
  }

  /**
   * Get status icon for agent
   */
  getAgentStatusIcon(status) {
    switch (status) {
      case 'active':
      case 'running':
        return chalk.green('●');
      case 'completed':
        return chalk.green('✓');
      case 'error':
      case 'failed':
        return chalk.red('✗');
      case 'idle':
        return chalk.gray('○');
      default:
        return chalk.yellow('?');
    }
  }
}