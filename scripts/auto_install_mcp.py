import os
import json
import platform
from pathlib import Path

class MCPAutoInstaller:
    def __init__(self, dbot_path):
        self.dbot_path = dbot_path
        self.configs = self.find_mcp_configs()
    
    def find_mcp_configs(self):
        """Find MCP configuration files for common applications"""
        home = Path.home()
        system = platform.system()
        
        configs = {}
        
        # Claude Desktop
        if system == "Darwin":  # macOS
            claude_config = home / "Library/Application Support/Claude/claude_desktop_config.json"
        else:  # Windows/Linux
            claude_config = home / ".config/claude/claude_desktop_config.json"
        
        if claude_config.parent.exists():
            configs['claude'] = claude_config
        
        # VS Code with Continue extension
        vscode_config = home / ".continue/config.json"
        if vscode_config.parent.exists():
            configs['vscode'] = vscode_config
        
        # Cursor
        if system == "Darwin":
            cursor_config = home / "Library/Application Support/Cursor/User/globalStorage/state.vscdb"
        else:
            cursor_config = home / ".config/Cursor/User/settings.json"
        
        if cursor_config.parent.exists():
            configs['cursor'] = cursor_config
        
        # Windsurf
        windsurf_config = home / ".windsurf/config.json"
        if windsurf_config.parent.exists():
            configs['windsurf'] = windsurf_config
        
        return configs
    
    def install_to_claude(self, config_path):
        """Add DBot to Claude Desktop config"""
        try:
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config = json.load(f)
            else:
                config = {}
            
            if 'mcpServers' not in config:
                config['mcpServers'] = {}
            
            config['mcpServers']['dbot'] = {
                "command": "node",
                "args": [str(self.dbot_path / "src/mcp_server.js")]
            }
            
            config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
            
            return True
        except Exception as e:
            print(f"Failed to install to Claude: {e}")
            return False
    
    def install_to_vscode(self, config_path):
        """Add DBot to VS Code Continue config"""
        try:
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config = json.load(f)
            else:
                config = {}
            
            if 'tools' not in config:
                config['tools'] = []
            
            dbot_tool = {
                "name": "dbot",
                "command": ["node", str(self.dbot_path / "src/mcp_server.js")]
            }
            
            # Remove existing dbot if present
            config['tools'] = [t for t in config['tools'] if t.get('name') != 'dbot']
            config['tools'].append(dbot_tool)
            
            config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
            
            return True
        except Exception as e:
            print(f"Failed to install to VS Code: {e}")
            return False
    
    def auto_install_all(self):
        """Install DBot to all detected MCP applications"""
        results = {}
        
        for app, config_path in self.configs.items():
            if app == 'claude':
                results[app] = self.install_to_claude(config_path)
            elif app == 'vscode':
                results[app] = self.install_to_vscode(config_path)
            else:
                # Generic MCP installation for other apps
                results[app] = self.install_to_claude(config_path)
        
        return results
    
    def print_installation_report(self, results):
        """Print installation results"""
        print("🔧 DBot MCP Installation Report:")
        for app, success in results.items():
            status = "✅" if success else "❌"
            print(f"   {status} {app.title()}")
        
        if any(results.values()):
            print("\n🎉 Restart your applications to use @dbot")
        else:
            print("\n⚠️ No compatible MCP applications found")

def main():
    if len(sys.argv) > 1:
        dbot_path = Path(sys.argv[1])
    else:
        dbot_path = Path(__file__).parent.parent
    
    installer = MCPAutoInstaller(dbot_path)
    results = installer.auto_install_all()
    installer.print_installation_report(results)

if __name__ == "__main__":
    import sys
    main()
