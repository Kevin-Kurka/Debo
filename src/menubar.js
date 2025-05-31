import { app, Menu, Tray, nativeImage, shell } from 'electron';
import { exec } from 'child_process';
import { config } from './config.js';
import { safeExec } from './validation.js';
import activityStreamer from './activity-streamer.js';

let tray = null;
let lastNotifications = [];

function createGorillaIcon(status = 'disabled') {
    const size = 22;
    const buffer = Buffer.alloc(size * size * 4);
    
    // Transparent background
    for (let i = 0; i < buffer.length; i += 4) {
        buffer[i + 3] = 0;
    }
    
    const isActive = status !== 'disabled';
    const bodyColor = isActive ? 255 : 120;
    const eyeColor = status === 'working' ? [50, 255, 50] : [30, 30, 30];
    
    const setPixel = (x, y, r, g, b, a = 255) => {
        if (x >= 0 && x < size && y >= 0 && y < size) {
            const offset = (y * size + x) * 4;
            buffer[offset] = r;
            buffer[offset + 1] = g;
            buffer[offset + 2] = b;
            buffer[offset + 3] = a;
        }
    };
    
    // Gorilla head outline - pixel perfect
    const headPixels = [
        // Top of head
        [9,4],[10,4],[11,4],[12,4],
        [8,5],[9,5],[10,5],[11,5],[12,5],[13,5],
        [7,6],[8,6],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
        // Ears
        [5,7],[6,7],[7,7], [14,7],[15,7],[16,7],
        [4,8],[5,8],[6,8],[7,8], [14,8],[15,8],[16,8],[17,8],
        [5,9],[6,9],[7,9], [14,9],[15,9],[16,9],
        // Main face
        [7,7],[8,7],[9,7],[10,7],[11,7],[12,7],[13,7],[14,7],
        [6,8],[7,8],[8,8],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[15,8],
        [6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],[14,9],[15,9],
        [6,10],[7,10],[8,10],[9,10],[10,10],[11,10],[12,10],[13,10],[14,10],[15,10],
        [7,11],[8,11],[9,11],[10,11],[11,11],[12,11],[13,11],[14,11],
        [8,12],[9,12],[10,12],[11,12],[12,12],[13,12],
        // Snout
        [9,13],[10,13],[11,13],[12,13],
        [9,14],[10,14],[11,14],[12,14],
        [10,15],[11,15],
        // Mouth
        [9,16],[10,16],[11,16],[12,16]
    ];
    
    // Draw head
    headPixels.forEach(([x, y]) => {
        setPixel(x, y, bodyColor, bodyColor, bodyColor, 255);
    });
    
    // Eyes
    setPixel(9, 9, eyeColor[0], eyeColor[1], eyeColor[2], 255);
    setPixel(12, 9, eyeColor[0], eyeColor[1], eyeColor[2], 255);
    
    // Nostrils
    setPixel(10, 14, 0, 0, 0, 255);
    setPixel(11, 14, 0, 0, 0, 255);
    
    const img = nativeImage.createFromBuffer(buffer, { width: size, height: size });
    img.setTemplateImage(true);
    return img;
}
async function checkDbotStatus() {
    try {
        const result = await safeExec('ps aux | grep mcp_server | grep -v grep');
        return result.success && result.stdout.includes('mcp_server');
    } catch {
        return false;
    }
}

async function getRecentNotifications() {
    try {
        const status = await activityStreamer.getStatus();
        if (status.message && status.timestamp) {
            const notification = {
                timestamp: status.timestamp,
                message: status.message,
                activity: status.activity?.description || 'System'
            };
            
            if (!lastNotifications.find(n => n.message === notification.message)) {
                lastNotifications = [notification, ...lastNotifications.slice(0, 2)];
            }
        }
        return lastNotifications;
    } catch {
        return lastNotifications;
    }
}

async function updateTrayMenu() {
    const isRunning = await checkDbotStatus();
    const notifications = await getRecentNotifications();
    const currentActivity = await activityStreamer.getStatus();
    
    let iconStatus = 'disabled';
    if (isRunning) {
        iconStatus = currentActivity.activity ? 'working' : 'active';
    }
    
    tray.setImage(createGorillaIcon(iconStatus));
    
    const menuItems = [
        {
            label: `DBot ${isRunning ? 'Online' : 'Offline'}`,
            enabled: false
        },
        { type: 'separator' }
    ];
    
    if (notifications.length > 0) {
        notifications.forEach(notif => {
            menuItems.push({
                label: `${notif.activity}: ${notif.message.substring(0, 35)}...`,
                enabled: false
            });
        });
    } else {
        menuItems.push({
            label: 'No recent activity',
            enabled: false
        });
    }
    
    menuItems.push(
        { type: 'separator' },
        {
            label: 'Restart DBot',
            click: () => {
                exec('cd $HOME/debo && ./scripts/restart.sh', (error) => {
                    if (error) console.error('Restart failed:', error);
                });
            }
        },
        { 
            label: 'Quit DBot', 
            click: () => {
                exec('pkill -f "node.*mcp_server"');
                app.quit();
            }
        }
    );
    
    tray.setContextMenu(Menu.buildFromTemplate(menuItems));
    tray.setToolTip(`DBot - ${isRunning ? 'Active' : 'Inactive'}`);
}

function createTray() {
    tray = new Tray(createGorillaIcon('disabled'));
    updateTrayMenu();
    setInterval(updateTrayMenu, 3000);
}

app.whenReady().then(() => createTray());
app.on('window-all-closed', (e) => e.preventDefault());
app.dock?.hide();
