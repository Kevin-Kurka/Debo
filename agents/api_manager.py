class ApiManager:
    def __init__(self, redis_client):
        self.redis = redis_client
        
    def store_api_key(self, provider: str, api_key: str):
        """Store API key securely in Redis"""
        self.redis.hset("api_keys", provider, api_key)
    
    def get_api_key(self, provider: str) -> str:
        """Retrieve API key for provider"""
        return self.redis.hget("api_keys", provider) or ""
    
    def list_providers(self) -> List[str]:
        """List configured API providers"""
        return list(self.redis.hgetall("api_keys").keys())
    
    def call_external_llm(self, provider: str, prompt: str, model: str = None) -> str:
        """Call external LLM API"""
        api_key = self.get_api_key(provider)
        if not api_key:
            return f"No API key configured for {provider}"
            
        if provider == "openai":
            return self._call_openai(prompt, api_key, model or "gpt-4")
        elif provider == "anthropic":
            return self._call_anthropic(prompt, api_key, model or "claude-3-sonnet-20240229")
        elif provider == "google":
            return self._call_google(prompt, api_key, model or "gemini-pro")
        else:
            return f"Unsupported provider: {provider}"
    
    def _call_openai(self, prompt: str, api_key: str, model: str) -> str:
        import requests
        response = requests.post("https://api.openai.com/v1/chat/completions", 
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}]
            })
        return response.json()["choices"][0]["message"]["content"]
    
    def _call_anthropic(self, prompt: str, api_key: str, model: str) -> str:
        import requests
        response = requests.post("https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01"
            },
            json={
                "model": model,
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": prompt}]
            })
        return response.json()["content"][0]["text"]
    
    def _call_google(self, prompt: str, api_key: str, model: str) -> str:
        import requests
        response = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]})
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]
