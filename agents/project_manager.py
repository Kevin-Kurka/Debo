import asyncio
import json
import redis
import sys
import os
from datetime import datetime
from typing import Dict, List, Any

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

try:
    from embeddings import EmbeddingManager, DocumentationRAG
except ImportError:
    class EmbeddingManager:
        def __init__(self): pass
    class DocumentationRAG:
        def __init__(self): pass

class ProjectManager:
    def __init__(self):
        self.redis = redis.Redis(host='localhost', port=6379, decode_responses=True)
        self.embeddings = EmbeddingManager()
        self.rag = DocumentationRAG()

    def create_project(self, name: str, template: str = None) -> str:
        """Create new project with Redis namespace"""
        project_id = f"project:{name}"
        
        # Initialize project metadata
        self.redis.hset(f"{project_id}:metadata", mapping={
            "name": name,
            "created": datetime.now().isoformat(),
            "template": template or "default",
            "status": "active"
        })
        
        # Add to global project list
        self.redis.sadd("projects:list", project_id)
        self.redis.set("projects:active", project_id)
        
        return project_id

    def switch_project(self, name: str):
        """Switch active project"""
        project_id = f"project:{name}"
        if self.redis.sismember("projects:list", project_id):
            self.redis.set("projects:active", project_id)
            return True
        return False

    def get_active_project(self) -> str:
        """Get currently active project"""
        return self.redis.get("projects:active") or ""

    def list_projects(self) -> List[str]:
        """List all projects"""
        projects = self.redis.smembers("projects:list")
        return [p.replace("project:", "") for p in projects]

class TechStackAnalyzer:
    def detect_stack(self, project_path: str) -> Dict[str, str]:
        """Auto-detect tech stack from project files"""
        import os
        import json as json_lib
        
        stack = {}
        
        # Frontend detection
        package_json = os.path.join(project_path, "package.json")
        if os.path.exists(package_json):
            with open(package_json) as f:
                pkg = json_lib.load(f)
                deps = pkg.get('dependencies', {})
                
                if 'react' in deps:
                    stack['frontend'] = 'react'
                elif 'vue' in deps:
                    stack['frontend'] = 'vue'
                elif 'next' in deps:
                    stack['frontend'] = 'nextjs'
        
        # Backend detection
        requirements = os.path.join(project_path, "requirements.txt")
        if os.path.exists(requirements):
            with open(requirements) as f:
                reqs = f.read()
                if 'fastapi' in reqs:
                    stack['backend'] = 'fastapi'
                elif 'django' in reqs:
                    stack['backend'] = 'django'
        
        return stack

class FeatureAnalyzer:
    def __init__(self, redis_client):
        self.redis = redis_client
        
    def analyze_feature_request(self, request: str, project_id: str) -> Dict[str, Any]:
        """Analyze feature for integration with existing features"""
        existing_features = self.redis.smembers(f"{project_id}:features")
        
        return {
            'feature_type': self._classify_feature(request),
            'is_extension': self._check_extension(request, existing_features),
            'dependencies': self._find_dependencies(request, existing_features),
            'conflicts': []
        }
    
    def _classify_feature(self, request: str) -> str:
        """Classify feature type"""
        keywords = {
            'auth': ['authentication', 'login', 'user', 'signup'],
            'dashboard': ['dashboard', 'charts', 'analytics'],
            'api': ['api', 'endpoint', 'rest'],
            'ui': ['component', 'page', 'interface']
        }
        
        for feature_type, words in keywords.items():
            if any(word in request.lower() for word in words):
                return feature_type
        return 'general'
    
    def _check_extension(self, request: str, existing_features: set) -> bool:
        """Check if request extends existing feature"""
        return len(existing_features) > 0
    
    def _find_dependencies(self, request: str, existing_features: set) -> List[str]:
        """Find feature dependencies"""
        return list(existing_features)
def main():
    if len(sys.argv) < 2:
        print("Usage: python project_manager.py <command> [args]")
        sys.exit(1)
    
    command = sys.argv[1]
    pm = ProjectManager()
    
    if command == "create" and len(sys.argv) >= 3:
        name = sys.argv[2]
        template = sys.argv[3] if len(sys.argv) > 3 else "default"
        project_id = pm.create_project(name, template)
        print(f"Created project: {project_id}")
    elif command == "list":
        projects = pm.list_projects()
        print(json.dumps(projects))
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()
