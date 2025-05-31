import activityStreamer from './activity-streamer.js';
import { config } from './config.js';
import chalk from 'chalk';

class NotificationManager {
  constructor() {
    this.isEnabled = true; // Always enabled for terminal notifications
    this.lastNotification = null;
    this.setupListeners();
  }

  setupListeners() {
    activityStreamer.on('status', (status) => {
      if (this.isEnabled && status.message) {
        this.showTerminalNotification(status.message);
      }
    });
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }

  showTerminalNotification(message) {
    if (!this.isEnabled) return;
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(chalk.blue(`[${timestamp}]`) + chalk.cyan(' 🔔 ') + chalk.white(message));
    
    this.lastNotification = { message, timestamp };
  }

  showNotification(message) {
    // Legacy method for backward compatibility
    this.showTerminalNotification(message);
  }

  getSettings() {
    return { enabled: this.isEnabled };
  }
}

export default new NotificationManager();
