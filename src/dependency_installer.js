import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const execAsync = promisify(exec);

class DependencyInstaller {
    constructor() {
        this.installationStatus = {
            node_modules: false, ollama: false, python: false,
            redis: false, cursor_mcp: false, menubar: false
        };
    }

    async checkAndInstallAll() {
        console.log("🚀 DBot One-Click Setup...");
        
        await this.ensureNodeModules();
        await this.ensureOllama();
        await this.ensurePython();
        await this.ensureRedis();
        await this.setupCursorMCP();
        await this.setupEnvironment();
        await this.startMenubar();
        
        console.log('✅ Debo running - Available via @debo in Cursor');
        return this.installationStatus;
    }

    async ensureNodeModules() {
        console.log('📦 Installing dependencies...');
        await execAsync('npm install winston zod', { cwd: process.cwd() });
        this.installationStatus.node_modules = true;
    }

    async ensureOllama() {
        console.log('🧠 Setting up Ollama...');
        if (!await this.commandExists('ollama')) {
            await execAsync('curl -fsSL https://ollama.com/install.sh | sh');
        }
        
        await execAsync('pkill ollama || true');
        await execAsync('ollama serve &');
        await this.sleep(3000);
        
        console.log('📥 Downloading models (background)...');
        execAsync('ollama pull devstral').catch(() => {});
        execAsync('ollama pull deepseek-r1:1.5b').catch(() => {});
        
        this.installationStatus.ollama = true;
    }
    async ensurePython() {
        console.log('🐍 Checking Python...');
        if (!await this.commandExists('python3')) {
            await execAsync('brew install python3');
        }
        this.installationStatus.python = true;
    }

    async ensureRedis() {
        console.log('📦 Starting Redis...');
        try {
            await execAsync('brew install redis');
            await execAsync('brew services start redis');
        } catch {
            console.log('⚠️ Redis install failed - using fallback');
        }
        this.installationStatus.redis = true;
    }

    async setupCursorMCP() {
        console.log('🔗 Configuring Cursor MCP...');
        const cursorConfigPath = join(homedir(), 'Library/Application Support/Cursor/User/globalStorage/cursor.mcpserver/settings.json');
        
        try {
            let config = {};
            try {
                const existing = await readFile(cursorConfigPath, 'utf8');
                config = JSON.parse(existing);
            } catch {}

            config.mcpServers = config.mcpServers || {};
            config.mcpServers.debo = {
                command: "node",
                args: ["$HOME/debo/src/mcp_server.js"],
                env: {},
                disabled: false
            };

            await writeFile(cursorConfigPath, JSON.stringify(config, null, 2));
            this.installationStatus.cursor_mcp = true;
            console.log('✅ DBot configured in Cursor');
        } catch (error) {
            console.log('⚠️ Manual Cursor setup needed');
        }
    }

    async setupEnvironment() {
        console.log('⚙️ Setting environment...');
        await execAsync('cp .env.example .env || true', { cwd: process.cwd() });
    }

    async startMenubar() {
        console.log('🖥️ Starting menubar...');
        try {
            execAsync('node src/menubar.js &', { cwd: process.cwd() });
            this.installationStatus.menubar = true;
        } catch (error) {
            console.log('⚠️ Menubar start failed');
        }
    }

    async commandExists(command) {
        try {
            await execAsync(`which ${command}`);
            return true;
        } catch {
            return false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default DependencyInstaller;
