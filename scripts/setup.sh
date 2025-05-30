#!/bin/bash

echo "Setting up DBot..."

# Check requirements
command -v docker >/dev/null 2>&1 || { echo "Docker required"; exit 1; }
command -v ollama >/dev/null 2>&1 || { echo "Ollama required"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python3 required"; exit 1; }

# Start Redis
docker run -d --name redis-stack -p 6379:6379 redis/redis-stack-server 2>/dev/null || echo "Redis running"

# Install Python deps
pip install -r requirements.txt

# Download models
ollama pull qwen2.5-vl:32b &
ollama pull deepseek-r1:1.5b &
ollama pull devstral:latest &
wait

echo "Setup complete! Run 'npm start'"
