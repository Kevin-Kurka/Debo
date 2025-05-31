const fs = require('fs');
const path = require('path');
const os = require('os');

class MCPAutoInstaller {
    constructor(deboPath) {
        this.deboPath = deboPath;
    }

    findMCPConfigs() {
        const home = os.homedir();
        const platform = os.platform();
        const configs = {};

        // Claude Desktop
        const claudeConfig = platform === 'darwin' 
            ? path.join(home, 'Library/Application Support/Claude/claude_desktop_config.json')
            : path.join(home, '.config/claude/claude_desktop_config.json');
        
        if (fs.existsSync(path.dirname(claudeConfig))) {
            configs.claude = claudeConfig;
        }

        // VS Code Continue
        const vscodeConfig = path.join(home, '.continue/config.json');
        if (fs.existsSync(path.dirname(vscodeConfig))) {
            configs.vscode = vscodeConfig;
        }

        // Cursor
        const cursorConfig = platform === 'darwin'
            ? path.join(home, 'Library/Application Support/Cursor/User/settings.json')
            : path.join(home, '.config/Cursor/User/settings.json');
        
        if (fs.existsSync(path.dirname(cursorConfig))) {
            configs.cursor = cursorConfig;
        }

        return configs;
    }

    installToClaude(configPath) {
        try {
            let config = {};
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }

            if (!config.mcpServers) config.mcpServers = {};
            
            config.mcpServers.debo = {
                command: "node",
                args: [path.join(this.deboPath, "src/mcp_server.js")]
            };

            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            return true;
        } catch (e) {
            return false;
        }
    }

    autoInstallAll() {
        const configs = this.findMCPConfigs();
        const results = {};

        for (const [app, configPath] of Object.entries(configs)) {
            results[app] = this.installToClaude(configPath);
        }

        return results;
    }
}

// Run if called directly
if (require.main === module) {
    const deboPath = process.argv[2] || path.dirname(__dirname);
    const installer = new MCPAutoInstaller(deboPath);
    const results = installer.autoInstallAll();
    
    console.log("🔧 DBot MCP Installation Report:");
    for (const [app, success] of Object.entries(results)) {
        console.log(`   ${success ? '✅' : '❌'} ${app}`);
    }
    
    if (Object.values(results).some(Boolean)) {
        console.log("\n🎉 Restart applications to use @debo");
    }
}

module.exports = MCPAutoInstaller;
