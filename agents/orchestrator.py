import asyncio
import json
import redis
import sys
import os
from datetime import datetime
from typing import Dict, List, Any

# Add current directory to path for imports
sys.path.append(os.path.dirname(__file__))

try:
    from embeddings import EmbeddingManager, DocumentationRAG
except ImportError:
    # Fallback if embeddings not available
    class EmbeddingManager:
        def __init__(self): pass
    class DocumentationRAG:
        def __init__(self): pass

class Orchestrator:
    def __init__(self):
        try:
            self.redis = redis.Redis(host='localhost', port=6379, decode_responses=True)
            self.redis.ping()  # Test connection
        except Exception as e:
            print(f"Redis connection failed: {e}")
            sys.exit(1)
            
        self.active_projects = {}

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
