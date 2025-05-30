import redis
import json
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any

class EmbeddingManager:
    def __init__(self):
        self.redis = redis.Redis(host='localhost', port=6379, decode_responses=True)
        # Use local embedding model - no API calls needed
        self.model = SentenceTransformer('all-MiniLM-L6-v2')  # 80MB model
        
    def embed_text(self, text: str) -> List[float]:
        """Generate embeddings for text"""
        embedding = self.model.encode(text)
        return embedding.tolist()
    
    def store_embedding(self, key: str, text: str, metadata: Dict = None):
        """Store text with embedding in Redis"""
        embedding = self.embed_text(text)
        
        data = {
            'text': text,
            'embedding': json.dumps(embedding),
            'metadata': json.dumps(metadata or {})
        }
        
        self.redis.hset(f"embeddings:{key}", mapping=data)
        
    def similarity_search(self, query: str, namespace: str, top_k: int = 5) -> List[Dict]:
        """Find similar embeddings"""
        query_embedding = self.embed_text(query)
        
        # Get all embeddings in namespace
        keys = self.redis.keys(f"embeddings:{namespace}:*")
        results = []
        
        for key in keys:
            data = self.redis.hgetall(key)
            stored_embedding = json.loads(data['embedding'])
            
            # Calculate cosine similarity
            similarity = np.dot(query_embedding, stored_embedding) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(stored_embedding)
            )
            
            results.append({
                'key': key,
                'text': data['text'],
                'similarity': similarity,
                'metadata': json.loads(data['metadata'])
            })
        
        # Sort by similarity and return top_k
        results.sort(key=lambda x: x['similarity'], reverse=True)
        return results[:top_k]

# Usage in orchestrator
class DocumentationRAG:
    def __init__(self):
        self.embeddings = EmbeddingManager()
    
    def store_documentation(self, tech_stack: str, content: str):
        """Store tech stack documentation"""
        self.embeddings.store_embedding(
            f"docs:{tech_stack}", 
            content,
            {'type': 'documentation', 'stack': tech_stack}
        )
    
    def get_relevant_docs(self, query: str, project_id: str) -> str:
        """Get relevant documentation for feature request"""
        results = self.embeddings.similarity_search(query, f"docs:{project_id}")
        
        context = "\n".join([r['text'] for r in results])
        return context
