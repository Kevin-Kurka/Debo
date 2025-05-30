import subprocess
import os
import time
from typing import Dict

class TerminalManager:
    """Handle terminal commands from MCP server"""
    
    def __init__(self):
        self.running_processes = {}
    
    def execute_command(self, command: str, background=False) -> Dict:
        """Execute terminal command with error handling"""
        try:
            if background:
                process = subprocess.Popen(command, shell=True, 
                                         stdout=subprocess.PIPE, 
                                         stderr=subprocess.PIPE)
                self.running_processes[process.pid] = process
                return {"success": True, "pid": process.pid, "message": "Command running in background"}
            else:
                result = subprocess.run(command, shell=True, capture_output=True, text=True)
                return {
                    "success": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "returncode": result.returncode
                }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def install_docker(self) -> bool:
        """Auto-install Docker"""
        if os.system("which docker") == 0:
            return True
            
        if "darwin" in os.uname().sysname.lower():
            # macOS
            commands = [
                "curl -o /tmp/Docker.dmg https://desktop.docker.com/mac/main/amd64/Docker.dmg",
                "sudo hdiutil attach /tmp/Docker.dmg",
                "sudo cp -R '/Volumes/Docker/Docker.app' /Applications/",
                "sudo hdiutil detach '/Volumes/Docker'",
                "open /Applications/Docker.app"
            ]
        else:
            # Linux
            commands = [
                "curl -fsSL https://get.docker.com -o get-docker.sh",
                "sudo sh get-docker.sh",
                "sudo systemctl start docker",
                "sudo systemctl enable docker"
            ]
        
        for cmd in commands:
            if self.execute_command(cmd)["success"]:
                continue
            return False
        return True
    
    def install_ollama(self) -> bool:
        """Auto-install Ollama"""
        if os.system("which ollama") == 0:
            return True
            
        result = self.execute_command("curl -fsSL https://ollama.com/install.sh | sh")
        if result["success"]:
            # Start Ollama service
            self.execute_command("ollama serve", background=True)
            time.sleep(5)
            return True
        return False
