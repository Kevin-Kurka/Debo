#!/usr/bin/env node

/**
 * Debo Smart Installer - Node.js version
 * Handles installation from any context (curl, local, npm)
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const os = require('os');
const https = require('https');
const readline = require('readline');

// Configuration
const CONFIG = {
  repoUrl: 'https://github.com/your-username/debo.git',
  installDir: process.env.DEBO_INSTALL_DIR || path.join(os.homedir(), 'debo'),
  models: {
    thinking: 'qwen2.5:14b',
    fast: 'qwen2.5:7b',
    vision: 'qwen2.5-vl:7b',
    reasoning: 'deepseek-r1:1.5b'
  },
  requiredNode: 18,
  requiredMemoryGB: 8,
  colors: {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
  }
};

// Utilities
const log = {
  info: (msg) => console.log(`${CONFIG.colors.blue}ℹ️  ${msg}${CONFIG.colors.reset}`),
  success: (msg) => console.log(`${CONFIG.colors.green}✅ ${msg}${CONFIG.colors.reset}`),
  warning: (msg) => console.log(`${CONFIG.colors.yellow}⚠️  ${msg}${CONFIG.colors.reset}`),
  error: (msg) => console.error(`${CONFIG.colors.red}❌ ${msg}${CONFIG.colors.reset}`),
  banner: () => {
    console.log(`${CONFIG.colors.cyan}${CONFIG.colors.bold}`);
    console.log('    ██████╗ ███████╗██████╗  ██████╗ ');
    console.log('    ██╔══██╗██╔════╝██╔══██╗██╔═══██╗');
    console.log('    ██║  ██║█████╗  ██████╔╝██║   ██║');
    console.log('    ██║  ██║██╔══╝  ██╔══██╗██║   ██║');
    console.log('    ██████╔╝███████╗██████╔╝╚██████╔╝');
    console.log('    ╚═════╝ ╚══════╝╚═════╝  ╚═════╝ ');
    console.log('');
    console.log('    Autonomous Development System v2.0');
    console.log(`${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.bold}🤖 Installing your AI development team...${CONFIG.colors.reset}\n`);
  }
};

// Progress bar
class ProgressBar {
  constructor() {
    this.total = 100;
    this.current = 0;
    this.barLength = 40;
  }

  update(percent, message) {
    this.current = percent;
    const filled = Math.floor(this.barLength * percent / 100);
    const empty = this.barLength - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    process.stdout.write(`\r[${bar}] ${percent}% - ${message}`);
    
    if (percent === 100) {
      console.log('');
    }
  }
}

// System checks
async function checkSystem() {
  log.info('Checking system requirements...');

  // Check OS
  const platform = os.platform();
  if (!['darwin', 'linux'].includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}. Debo requires macOS or Linux.`);
  }
  log.success(`Operating System: ${platform === 'darwin' ? 'macOS' : 'Linux'}`);

  // Check Node.js version
  const nodeVersion = process.version.slice(1).split('.').map(Number);
  if (nodeVersion[0] < CONFIG.requiredNode) {
    throw new Error(`Node.js ${CONFIG.requiredNode}+ required. Current: ${process.version}`);
  }
  log.success(`Node.js: ${process.version}`);

  // Check memory
  const totalMemGB = Math.floor(os.totalmem() / 1024 / 1024 / 1024);
  if (totalMemGB < CONFIG.requiredMemoryGB) {
    log.warning(`Memory: ${totalMemGB}GB (recommended: ${CONFIG.requiredMemoryGB}GB+)`);
  } else {
    log.success(`Memory: ${totalMemGB}GB`);
  }

  // Check disk space
  try {
    const df = execSync('df -BG ~', { encoding: 'utf8' });
    const match = df.match(/(\d+)G\s+\d+%/);
    const availableGB = match ? parseInt(match[1]) : 0;
    
    if (availableGB < 10) {
      log.warning(`Disk space: ${availableGB}GB available (recommended: 10GB+)`);
    } else {
      log.success(`Disk space: ${availableGB}GB available`);
    }
  } catch (e) {
    log.warning('Could not check disk space');
  }
}

// Check if command exists
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Install system dependencies
async function installDependencies() {
  const progress = new ProgressBar();
  progress.update(10, 'Installing system dependencies...');

  const platform = os.platform();
  const missing = [];

  // Check Git
  if (!commandExists('git')) {
    missing.push('git');
  }

  // Check Redis
  if (!commandExists('redis-cli')) {
    missing.push('redis');
  }

  // Check Ollama
  if (!commandExists('ollama')) {
    missing.push('ollama');
  }

  if (missing.length === 0) {
    progress.update(30, 'All dependencies installed');
    return;
  }

  log.info(`\nInstalling missing dependencies: ${missing.join(', ')}`);

  if (platform === 'darwin') {
    // macOS installation
    if (!commandExists('brew')) {
      log.info('Installing Homebrew...');
      const brewInstall = spawn('/bin/bash', ['-c', '$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)'], {
        stdio: 'inherit'
      });
      await new Promise((resolve) => brewInstall.on('close', resolve));
    }

    for (const dep of missing) {
      if (dep === 'ollama') {
        // Special handling for Ollama
        log.info('Installing Ollama...');
        execSync('curl -fsSL https://ollama.ai/install.sh | sh', { stdio: 'inherit' });
      } else {
        execSync(`brew install ${dep}`, { stdio: 'inherit' });
      }
    }

    // Start Redis
    if (missing.includes('redis')) {
      execSync('brew services start redis', { stdio: 'inherit' });
    }
  } else {
    // Linux installation
    const distro = fs.existsSync('/etc/debian_version') ? 'debian' : 'other';
    
    if (distro === 'debian') {
      execSync('sudo apt-get update', { stdio: 'inherit' });
      
      for (const dep of missing) {
        if (dep === 'ollama') {
          execSync('curl -fsSL https://ollama.ai/install.sh | sh', { stdio: 'inherit' });
        } else if (dep === 'redis') {
          execSync('sudo apt-get install -y redis-server', { stdio: 'inherit' });
          execSync('sudo systemctl start redis-server', { stdio: 'inherit' });
        } else {
          execSync(`sudo apt-get install -y ${dep}`, { stdio: 'inherit' });
        }
      }
    } else {
      throw new Error('Please install the following manually: ' + missing.join(', '));
    }
  }

  // Start Ollama
  if (missing.includes('ollama')) {
    log.info('Starting Ollama service...');
    spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    }).unref();
    
    // Wait for Ollama to start
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  progress.update(30, 'Dependencies installed');
}

// Clone or update repository
async function setupRepository(progress) {
  progress.update(40, 'Setting up Debo repository...');

  if (fs.existsSync(CONFIG.installDir)) {
    log.info(`\nFound existing installation at ${CONFIG.installDir}`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('Update existing installation? (y/N) ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() === 'y') {
      process.chdir(CONFIG.installDir);
      execSync('git pull origin main', { stdio: 'inherit' });
      log.success('Repository updated');
    } else {
      log.info('Using existing installation');
    }
  } else {
    log.info(`\nCloning Debo repository to ${CONFIG.installDir}...`);
    execSync(`git clone ${CONFIG.repoUrl} ${CONFIG.installDir}`, { stdio: 'inherit' });
    process.chdir(CONFIG.installDir);
    log.success('Repository cloned');
  }

  progress.update(50, 'Repository ready');
}

// Install Node.js dependencies
async function installNodeDependencies(progress) {
  progress.update(60, 'Installing Node.js dependencies...');

  // Clean install
  if (fs.existsSync('node_modules')) {
    fs.rmSync('node_modules', { recursive: true, force: true });
  }
  if (fs.existsSync('package-lock.json')) {
    fs.unlinkSync('package-lock.json');
  }

  execSync('npm install', { stdio: 'inherit' });
  
  progress.update(70, 'Dependencies installed');
}

// Setup configuration
async function setupConfiguration(progress) {
  progress.update(80, 'Setting up configuration...');

  // Create .env file
  if (!fs.existsSync('.env')) {
    const envContent = `# Debo Configuration
# Generated on ${new Date().toISOString()}

# Redis Configuration
REDIS_URL=redis://localhost:6379

# LLM Provider Configuration
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434

# Model Configuration
THINKING_MODEL=${CONFIG.models.thinking}
FAST_MODEL=${CONFIG.models.fast}
VISION_MODEL=${CONFIG.models.vision}
REASONING_MODEL=${CONFIG.models.reasoning}

# Server Configuration
WEBSOCKET_PORT=3001
NODE_ENV=production
LOG_LEVEL=info

# Feature Flags
ENABLE_QUALITY_GATES=true
ENABLE_AUTO_REVISION=true
ENABLE_GIT_WORKFLOW=true
ENABLE_CONFIDENCE_SCORING=true
`;
    fs.writeFileSync('.env', envContent);
    log.success('Configuration file created');
  }

  // Create directories
  const dirs = ['logs', 'projects', 'temp'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  progress.update(85, 'Configuration complete');
}

// Download AI models
async function downloadModels(progress) {
  progress.update(90, 'Downloading AI models...');

  const modelScript = `#!/bin/bash
echo "🤖 Downloading AI models for Debo..."
echo "This may take 10-30 minutes depending on your connection"
echo ""

models=(
  "${CONFIG.models.thinking}:Thinking model"
  "${CONFIG.models.fast}:Fast execution model"
  "${CONFIG.models.vision}:Vision model"
  "${CONFIG.models.reasoning}:Reasoning model"
)

for model_info in "\${models[@]}"; do
  IFS=':' read -r model desc <<< "$model_info"
  echo "📥 Downloading $desc ($model)..."
  if ollama pull "$model" 2>&1; then
    echo "✅ $desc ready"
  else
    echo "❌ Failed to download $desc"
  fi
  echo ""
done

echo "🎉 Model download complete!"
`;

  fs.writeFileSync('download_models.sh', modelScript, { mode: 0o755 });
  
  // Start download in background
  const modelDownload = spawn('bash', ['download_models.sh'], {
    detached: true,
    stdio: ['ignore', fs.openSync('model_download.log', 'a'), fs.openSync('model_download.log', 'a')]
  });
  modelDownload.unref();

  log.success('Model download started in background');
  log.info('Monitor progress: tail -f model_download.log');

  progress.update(95, 'Models downloading...');
}

// Setup shell integration
async function setupShellIntegration(progress) {
  progress.update(98, 'Setting up shell integration...');

  // Create bin directory
  const binDir = path.join(CONFIG.installDir, 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  // Create debo wrapper
  const deboScript = `#!/bin/bash
export DEBO_HOME="${CONFIG.installDir}"
cd "$DEBO_HOME"

# Ensure Redis is running
if ! redis-cli ping &>/dev/null; then
    echo "Starting Redis..."
    if [[ "$(uname)" == "Darwin" ]]; then
        brew services start redis 2>/dev/null || redis-server --daemonize yes
    else
        sudo systemctl start redis-server 2>/dev/null || redis-server --daemonize yes
    fi
fi

# Ensure Ollama is running
if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
    echo "Starting Ollama..."
    nohup ollama serve > /dev/null 2>&1 &
    sleep 2
fi

# Run Debo
exec node src/mcp_server.js "$@"
`;

  const deboPath = path.join(binDir, 'debo');
  fs.writeFileSync(deboPath, deboScript, { mode: 0o755 });

  // Add to PATH
  const shellRc = process.env.SHELL?.includes('zsh') ? '.zshrc' : '.bashrc';
  const rcPath = path.join(os.homedir(), shellRc);
  
  if (fs.existsSync(rcPath)) {
    const rcContent = fs.readFileSync(rcPath, 'utf8');
    if (!rcContent.includes('debo/bin')) {
      fs.appendFileSync(rcPath, `\n# Debo - Autonomous Development System\nexport PATH="${binDir}:$PATH"\n`);
      log.success(`Added debo to PATH in ~/${shellRc}`);
    }
  }

  progress.update(100, 'Installation complete!');
}

// Main installation
async function main() {
  try {
    log.banner();

    // System checks
    await checkSystem();

    // Install dependencies
    await installDependencies();

    const progress = new ProgressBar();

    // Setup repository
    await setupRepository(progress);

    // Install Node dependencies
    await installNodeDependencies(progress);

    // Setup configuration
    await setupConfiguration(progress);

    // Download models
    await downloadModels(progress);

    // Shell integration
    await setupShellIntegration(progress);

    // Success message
    console.log(`\n${CONFIG.colors.green}${CONFIG.colors.bold}🎉 Installation Complete!${CONFIG.colors.reset}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`${CONFIG.colors.bold}📍 Installation Details:${CONFIG.colors.reset}`);
    console.log(`   • Location: ${CONFIG.installDir}`);
    console.log(`   • Config: ${CONFIG.installDir}/.env`);
    console.log(`   • Logs: ${CONFIG.installDir}/logs/`);
    console.log('');
    console.log(`${CONFIG.colors.bold}🚀 Quick Start:${CONFIG.colors.reset}`);
    console.log('   1. Restart your terminal or run: source ~/.bashrc');
    console.log('   2. Test: debo --help');
    console.log('   3. Create project: debo create my-app "Build a todo app"');
    console.log('');
    console.log(`${CONFIG.colors.bold}📊 Web Monitor:${CONFIG.colors.reset}`);
    console.log('   • URL: http://localhost:3001');
    console.log('   • Start: debo monitor');
    console.log('');
    console.log(`${CONFIG.colors.bold}🔧 MCP Integration:${CONFIG.colors.reset}`);
    console.log('   {');
    console.log('     "debo": {');
    console.log('       "command": "node",');
    console.log(`       "args": ["${CONFIG.installDir}/src/mcp_server.js"]`);
    console.log('     }');
    console.log('   }');
    console.log('');

  } catch (error) {
    log.error(`Installation failed: ${error.message}`);
    console.log('');
    console.log(`${CONFIG.colors.yellow}💡 Troubleshooting:${CONFIG.colors.reset}`);
    console.log('   • Check the error message above');
    console.log('   • Ensure you have internet connection');
    console.log('   • Try running with: DEBO_DEBUG=true node install.js');
    console.log('   • Get help: https://github.com/your-username/debo/issues');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };