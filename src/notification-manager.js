import { Notification } from 'electron';
import activityStreamer from './activity-streamer.js';
import { config } from './config.js';

class NotificationManager {
  constructor() {
    this.isEnabled = false;
    this.lastNotification = null;
    this.setupListeners();
  }

  setupListeners() {
    activityStreamer.on('status', (status) => {
      if (this.isEnabled && status.message) {
        this.showNotification(status.message);
      }
    });
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }

  showNotification(message) {
    if (!this.isEnabled) return;
    
    if (this.lastNotification) {
      this.lastNotification.close();
    }

    this.lastNotification = new Notification({
      title: 'DBot Activity',
      body: message,
      silent: true,
      timeoutType: 'default'
    });

    this.lastNotification.show();
  }

  getSettings() {
    return { enabled: this.isEnabled };
  }
}

export default new NotificationManager();
