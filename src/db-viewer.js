import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import redis from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DBotViewer {
    constructor() {
        this.redis = redis.createClient({ url: 'redis://localhost:6379' });
        this.server = null;
    }

    async start() {
        await this.redis.connect();
        
        this.server = createServer(async (req, res) => {
            res.setHeader('Content-Type', 'text/html');
            
            const html = await this.generateHTML();
            res.end(html);
        });
        
        this.server.listen(3001, () => {
            console.log('🔍 DBot Database Viewer: http://localhost:3001');
        });
    }

    async generateHTML() {
        const keys = await this.redis.keys('*');
        const activityStatus = await this.getActivityStatus();
        const logs = await this.getRecentLogs();
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>DBot Database Viewer</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; background: #1a1a1a; color: #fff; }
        .container { max-width: 1200px; margin: 0 auto; }
        .section { background: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .key { background: #333; padding: 10px; margin: 5px 0; border-radius: 4px; font-family: monospace; }
        .value { background: #444; padding: 10px; margin: 5px 0; border-radius: 4px; white-space: pre-wrap; }
        .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .online { background: #4CAF50; }
        .offline { background: #f44336; }
        h1, h2 { color: #4CAF50; }
        .refresh { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    </style>
    <script>
        function refresh() { location.reload(); }
        setInterval(refresh, 5000); // Auto-refresh every 5 seconds
    </script>
</head>
<body>
    <div class="container">
        <h1>🤖 DBot Database Viewer</h1>
        <button class="refresh" onclick="refresh()">Refresh Now</button>
        
        <div class="section">
            <h2>System Status</h2>
            <div class="status ${activityStatus.online ? 'online' : 'offline'}">
                ${activityStatus.online ? 'ONLINE' : 'OFFLINE'}
            </div>
            <p>Activity: ${activityStatus.message || 'No current activity'}</p>
        </div>

        <div class="section">
            <h2>Redis Database (${keys.length} keys)</h2>
            ${keys.length === 0 ? '<p>No data stored yet</p>' : ''}
            ${await this.renderKeys(keys)}
        </div>

        <div class="section">
            <h2>Recent Activity Logs</h2>
            ${logs}
        </div>
    </div>
</body>
</html>`;
    }

    async renderKeys(keys) {
        let html = '';
        for (const key of keys) {
            const type = await this.redis.type(key);
            let value;
            
            switch (type) {
                case 'string':
                    value = await this.redis.get(key);
                    break;
                case 'list':
                    value = await this.redis.lrange(key, 0, -1);
                    break;
                case 'hash':
                    value = await this.redis.hgetall(key);
                    break;
                default:
                    value = `[${type}]`;
            }
            
            html += `
                <div class="key">${key} (${type})</div>
                <div class="value">${JSON.stringify(value, null, 2)}</div>
            `;
        }
        return html;
    }

    async getActivityStatus() {
        try {
            const statusFile = join(__dirname, '..', 'logs', 'activity-status.json');
            const data = await readFile(statusFile, 'utf8');
            const status = JSON.parse(data);
            return { online: true, message: status.message };
        } catch {
            return { online: false, message: null };
        }
    }

    async getRecentLogs() {
        try {
            const logFile = join(__dirname, '..', 'logs', 'combined.log');
            const data = await readFile(logFile, 'utf8');
            const lines = data.split('\n').slice(-10).reverse();
            return lines.map(line => `<div class="value">${line}</div>`).join('');
        } catch {
            return '<p>No logs available</p>';
        }
    }
}

const viewer = new DBotViewer();
viewer.start().catch(console.error);
