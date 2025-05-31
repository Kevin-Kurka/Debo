import { readFile } from 'fs/promises';
import { join } from 'path';
import { config } from './config.js';

class StatusMonitor {
  constructor() {
    this.statusFile = join(config.paths.logs, 'activity-status.json');
    this.callbacks = new Set();
    this.interval = null;
  }

  start(pollInterval = 1000) {
    if (this.interval) return;
    
    this.interval = setInterval(async () => {
      try {
        const status = await this.getStatus();
        this.callbacks.forEach(cb => cb(status));
      } catch (error) {
        // Silent fail for polling
      }
    }, pollInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async getStatus() {
    try {
      const data = await readFile(this.statusFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return { message: '', timestamp: null, activity: null };
    }
  }

  onChange(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
}

export default StatusMonitor;
