import requests
import json
from typing import Dict, List

class OllamaClient:
    def __init__(self, base_url="http://localhost:11434"):
        self.base_url = base_url
    
    def generate(self, model: str, prompt: str, system: str = None) -> str:
        """Generate response from Ollama model"""
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        
        if system:
            payload["system"] = system
            
        response = requests.post(f"{self.base_url}/api/generate", json=payload)
        return response.json().get("response", "")
    
    def analyze_image(self, model: str, image_path: str, prompt: str) -> str:
        """Analyze image with vision model"""
        with open(image_path, "rb") as f:
            image_data = f.read()
        
        payload = {
            "model": model,
            "prompt": prompt,
            "images": [image_data.hex()]
        }
        
        response = requests.post(f"{self.base_url}/api/generate", json=payload)
        return response.json().get("response", "")

class AgentPool:
    def __init__(self):
        self.ollama = OllamaClient()
        self.models = {
            'reasoning': 'deepseek-r1:1.5b',
            'coding': 'devstral:latest',
            'vision': 'qwen2.5-vl:32b'
        }
    
    def create_test_agent(self, task: str, context: str) -> str:
        """Generate tests for task"""
        prompt = f"""
        Create comprehensive tests for: {task}
        
        Context: {context}
        
        Generate unit tests following TDD principles.
        """
        
        return self.ollama.generate(self.models['coding'], prompt)
    
    def create_code_agent(self, task: str, tests: str, context: str) -> str:
        """Generate code to pass tests"""
        prompt = f"""
        Implement code to pass these tests: {tests}
        
        Task: {task}
        Context: {context}
        
        Write clean, efficient code.
        """
        
        return self.ollama.generate(self.models['coding'], prompt)
    
    def create_qa_agent(self, code: str, task: str) -> str:
        """Review and improve code"""
        prompt = f"""
        Review this code for: {task}
        
        Code: {code}
        
        Add error handling, edge cases, and optimizations.
        """
        
        return self.ollama.generate(self.models['coding'], prompt)
