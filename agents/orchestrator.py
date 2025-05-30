import asyncio
import json
import redis
import sys
import os
import subprocess
from datetime import datetime
from typing import Dict, List, Any

# Add current directory to path for imports
sys.path.append(os.path.dirname(__file__))

try:
    from embeddings import EmbeddingManager, DocumentationRAG
    from terminal_manager import TerminalManager
    from api_manager import ApiManager
except ImportError:
    # Fallback if modules not available
    class EmbeddingManager:
        def __init__(self): pass
    class DocumentationRAG:
        def __init__(self): pass
    class TerminalManager:
        def __init__(self): pass
        def execute_command(self, cmd, bg=False): return {"success": True}
    class ApiManager:
        def __init__(self, redis): pass
        def call_external_llm(self, provider, prompt, model=None): return "External LLM not available"

class Orchestrator:
    def __init__(self):
        try:
            self.redis = redis.Redis(host='localhost', port=6379, decode_responses=True)
            self.redis.ping()  # Test connection
        except Exception as e:
            print(f"Redis connection failed: {e}")
            sys.exit(1)
            
        self.active_projects = {}
        self.terminal = TerminalManager()
        self.api_manager = ApiManager(self.redis)

    async def conduct_stack_interview(self, project_id: str) -> Dict[str, str]:
        """Conduct tech stack selection interview"""
        questions = {
            'frontend': 'Frontend framework? (nextjs/react/vue/angular/svelte)',
            'backend': 'Backend framework? (fastapi/django/flask/express/nestjs)',
            'database': 'Database? (postgresql/mongodb/sqlite/prisma)',
            'mobile': 'Mobile app? (flutter/react-native/expo/none)'
        }
        
        self.redis.hset(f"project:{project_id}:interview", mapping=questions)
        return questions

    async def conduct_style_interview(self, project_id: str) -> Dict[str, str]:
        """Conduct style preferences interview"""
        style_questions = {
            'references': 'Upload screenshots or provide links to sites you like',
            'colors': 'Any specific color preferences or brand colors?',
            'animations': 'Animation style? (minimal/standard/rich)',
            'audience': 'Target audience? (professional/creative/technical)'
        }
        
        self.redis.hset(f"project:{project_id}:style", mapping=style_questions)
        return style_questions

    async def process_request(self, request_id: str) -> str:
        """Process request from MCP server"""
        try:
            request_data = self.redis.hgetall(f"request:{request_id}")
            if not request_data:
                return "Request not found"
            
            request = request_data.get('request', '')
            
            # Simple processing for now
            response = f"Processing: {request}"
            
            # Update status
            self.redis.hset(f"request:{request_id}", "status", "completed")
            
            return response
            
        except Exception as e:
            return f"Error processing request: {str(e)}"

def main():
    if len(sys.argv) < 2:
        print("Usage: python orchestrator.py <command> [args]")
        sys.exit(1)
    
    command = sys.argv[1]
    orchestrator = Orchestrator()
    
    if command == "process" and len(sys.argv) >= 3:
        request_id = sys.argv[2]
        result = asyncio.run(orchestrator.process_request(request_id))
        print(result)
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()
    async def check_project_status(self, project_path: str) -> Dict[str, Any]:
        """Check if project is initialized, initialize if needed"""
        if not project_path or not os.path.exists(project_path):
            return {"initialized": False, "action": "create_project"}
        
        # Check for common project indicators
        indicators = ['package.json', 'requirements.txt', 'pyproject.toml', 'Cargo.toml']
        has_project = any(os.path.exists(os.path.join(project_path, f)) for f in indicators)
        
        if not has_project:
            return {"initialized": False, "action": "initialize_existing"}
        
        return {"initialized": True, "action": "proceed"}

    async def initialize_project_flow(self, project_path: str) -> str:
        """Handle project initialization with user interviews"""
        # Conduct tech stack interview
        stack_questions = await self.conduct_stack_interview("temp")
        
        # Conduct style interview  
        style_questions = await self.conduct_style_interview("temp")
        
        return f"""Project initialization required. Please provide:

TECH STACK:
{chr(10).join([f"- {q}" for q in stack_questions.values()])}

STYLE PREFERENCES:
{chr(10).join([f"- {q}" for q in style_questions.values()])}

Once you provide this information, I'll set up your project structure."""

    def configure_external_llm(self, provider: str, api_key: str, model: str = None) -> str:
        """Configure external LLM provider"""
        self.api_manager.store_api_key(provider, api_key)
        return f"✅ {provider.title()} API configured successfully"
        
    def use_external_llm(self, prompt: str, provider: str = None, model: str = None) -> str:
        """Use external LLM if configured, fallback to local"""
        providers = self.api_manager.list_providers()
        
        if provider and provider in providers:
            return self.api_manager.call_external_llm(provider, prompt, model)
        elif providers:
            # Use first available provider
            return self.api_manager.call_external_llm(providers[0], prompt, model)
        else:
            return "Using local models (no external LLM configured)"
