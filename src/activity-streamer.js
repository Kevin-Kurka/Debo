import { EventEmitter } from 'events';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { config } from './config.js';

class ActivityStreamer extends EventEmitter {
  constructor() {
    super();
    this.isEnabled = false;
    this.currentActivity = null;
    this.settingsFile = join(config.paths.logs, 'activity-settings.json');
    this.statusFile = join(config.paths.logs, 'activity-status.json');
    this.init();
  }

  async init() {
    await mkdir(config.paths.logs, { recursive: true });
    await this.loadSettings();
  }

  async loadSettings() {
    try {
      const data = await readFile(this.settingsFile, 'utf8');
      this.isEnabled = JSON.parse(data).enabled || false;
    } catch {
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await writeFile(this.settingsFile, JSON.stringify({ enabled: this.isEnabled }));
  }

  async toggle() {
    this.isEnabled = !this.isEnabled;
    await this.saveSettings();
    await this.updateStatus(this.isEnabled ? '🟢 Enabled' : '🔴 Disabled');
    return this.isEnabled;
  }

  async startActivity(description, steps = 1) {
    if (!this.isEnabled) return;
    this.currentActivity = { description, startTime: Date.now(), steps, completed: 0 };
    await this.updateStatus(`🔄 ${description}`);
  }

  async updateProgress(step, details = '') {
    if (!this.isEnabled || !this.currentActivity) return;
    this.currentActivity.completed = step;
    const pct = Math.round((step / this.currentActivity.steps) * 100);
    await this.updateStatus(`🔄 ${this.currentActivity.description} (${pct}%)${details ? ': ' + details : ''}`);
  }
  async completeActivity(result = 'completed') {
    if (!this.isEnabled || !this.currentActivity) return;
    await this.updateStatus(`✅ ${this.currentActivity.description} - ${result}`);
    setTimeout(() => this.clearStatus(), 3000);
    this.currentActivity = null;
  }

  async failActivity(error) {
    if (!this.isEnabled || !this.currentActivity) return;
    await this.updateStatus(`❌ ${this.currentActivity.description} - ${error.message}`);
    setTimeout(() => this.clearStatus(), 5000);
    this.currentActivity = null;
  }

  async updateStatus(message) {
    if (!this.isEnabled) return;
    const status = { message, timestamp: new Date().toISOString(), activity: this.currentActivity };
    await writeFile(this.statusFile, JSON.stringify(status));
    this.emit('status', status);
  }

  async clearStatus() {
    await writeFile(this.statusFile, JSON.stringify({ message: '', timestamp: null, activity: null }));
  }

  async getStatus() {
    try {
      return JSON.parse(await readFile(this.statusFile, 'utf8'));
    } catch {
      return { message: '', timestamp: null, activity: null };
    }
  }

  getSettings() {
    return { enabled: this.isEnabled };
  }
}

export default new ActivityStreamer();
