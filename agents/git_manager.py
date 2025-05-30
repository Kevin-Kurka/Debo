import subprocess
import json
from typing import Dict, List

class GitManager:
    def __init__(self, project_path: str):
        self.project_path = project_path

    def create_feature_branch(self, feature_name: str) -> str:
        """Create and checkout feature branch"""
        branch_name = f"feature/{feature_name.lower().replace(' ', '-')}"
        subprocess.run(['git', 'checkout', '-b', branch_name], cwd=self.project_path)
        return branch_name

    def commit_changes(self, message: str):
        """Auto-commit changes"""
        subprocess.run(['git', 'add', '.'], cwd=self.project_path)
        subprocess.run(['git', 'commit', '-m', message], cwd=self.project_path)

    def check_conflicts(self, target_branch: str, source_branch: str) -> bool:
        """Check for merge conflicts"""
        result = subprocess.run(['git', 'merge-tree', target_branch, source_branch], 
                              capture_output=True, cwd=self.project_path)
        return result.returncode != 0

    def safe_merge(self, feature_branch: str) -> bool:
        """Merge if no conflicts"""
        if not self.check_conflicts('main', feature_branch):
            subprocess.run(['git', 'checkout', 'main'], cwd=self.project_path)
            subprocess.run(['git', 'merge', feature_branch], cwd=self.project_path)
            subprocess.run(['git', 'branch', '-d', feature_branch], cwd=self.project_path)
            return True
        return False

class ModelRegistry:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    def register_model(self, name: str, schema: Dict):
        """Store model definition with translations"""
        translations = {
            'typescript': self.generate_typescript(schema),
            'pydantic': self.generate_pydantic(schema),
            'prisma': self.generate_prisma(schema)
        }
        
        self.redis.hset(f"models:{name}", mapping={
            'schema': json.dumps(schema),
            **translations
        })
    
    def generate_typescript(self, schema: Dict) -> str:
        """Generate TypeScript interface"""
        fields = []
        for field, config in schema.get('fields', {}).items():
            field_type = config.get('type', 'string')
            fields.append(f"  {field}: {field_type};")
        
        return f"interface {schema['name']} {{\n" + "\n".join(fields) + "\n}"
    
    def generate_pydantic(self, schema: Dict) -> str:
        """Generate Pydantic model"""
        fields = []
        for field, config in schema.get('fields', {}).items():
            field_type = config.get('type', 'str')
            fields.append(f"    {field}: {field_type}")
        
        return f"class {schema['name']}(BaseModel):\n" + "\n".join(fields)
    
    def generate_prisma(self, schema: Dict) -> str:
        """Generate Prisma schema"""
        fields = []
        for field, config in schema.get('fields', {}).items():
            field_type = config.get('type', 'String')
            fields.append(f"  {field} {field_type}")
        
        return f"model {schema['name']} {{\n" + "\n".join(fields) + "\n}"
