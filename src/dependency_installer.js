const { spawn } = require('child_process');
const path = require('path');

class DependencyInstaller {
    constructor() {
        this.installationStatus = {
            docker: false,
            ollama: false,
            python: false,
            redis: false
        };
    }

    async checkAndInstallAll() {
        console.log("🔍 Checking dependencies...");
        
        // Check each dependency and install if missing
        await this.ensureDocker();
        await this.ensureOllama();  
        await this.ensurePython();
        await this.ensureRedis();
        
        return this.installationStatus;
    }

    async ensureDocker() {
        if (await this.commandExists('docker')) {
            this.installationStatus.docker = true;
            return;
        }

        console.log("📦 Installing Docker...");
        const platform = process.platform;
        
        if (platform === 'darwin') {
            await this.runCommand('curl -o /tmp/Docker.dmg https://desktop.docker.com/mac/main/amd64/Docker.dmg');
            await this.runCommand('sudo hdiutil attach /tmp/Docker.dmg');
            await this.runCommand('sudo cp -R "/Volumes/Docker/Docker.app" /Applications/');
            await this.runCommand('open /Applications/Docker.app');
        } else {
            await this.runCommand('curl -fsSL https://get.docker.com | sh');
            await this.runCommand('sudo systemctl start docker');
        }
        
        this.installationStatus.docker = true;
    }

    async ensureOllama() {
        if (await this.commandExists('ollama')) {
            this.installationStatus.ollama = true;
            return;
        }

        console.log("🧠 Installing Ollama...");
        await this.runCommand('curl -fsSL https://ollama.com/install.sh | sh');
        
        // Start Ollama service
        this.runCommand('ollama serve', true); // background
        this.installationStatus.ollama = true;
    }

    async ensurePython() {
        if (await this.commandExists('python3')) {
            this.installationStatus.python = true;
            return;
        }

        console.log("🐍 Installing Python3...");
        if (process.platform === 'darwin') {
            await this.runCommand('brew install python3');
        } else {
            await this.runCommand('sudo apt-get update && sudo apt-get install -y python3 python3-pip');
        }
        
        this.installationStatus.python = true;
    }

    async ensureRedis() {
        console.log("📦 Starting Redis...");
        await this.runCommand('docker run -d --name redis-stack -p 6379:6379 redis/redis-stack-server');
        this.installationStatus.redis = true;
    }

    commandExists(command) {
        return new Promise((resolve) => {
            const child = spawn('which', [command]);
            child.on('close', (code) => resolve(code === 0));
        });
    }

    runCommand(command, background = false) {
        return new Promise((resolve, reject) => {
            const child = spawn('sh', ['-c', command]);
            
            if (background) {
                resolve();
                return;
            }
            
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Command failed: ${command}`));
            });
        });
    }
}

module.exports = DependencyInstaller;
