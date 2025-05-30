#!/bin/bash

echo "🚀 Setting up DBot..."

# Check requirements
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required"; exit 1; }
command -v ollama >/dev/null 2>&1 || { echo "❌ Ollama required"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python3 required"; exit 1; }

# Start Redis
echo "📦 Starting Redis Stack..."
docker run -d --name redis-stack -p 6379:6379 redis/redis-stack-server 2>/dev/null || echo "✅ Redis already running"

# Install Python deps
echo "🐍 Installing Python dependencies..."
pip install -r requirements.txt > /dev/null 2>&1

# Start MCP server in background
echo "🔧 Starting DBot MCP Server..."
node src/mcp_server.js &
MCP_PID=$!
echo "✅ DBot MCP Server running (PID: $MCP_PID)"

# Download models with progress feedback
echo "📥 Downloading LLM models (this will take a while)..."
echo "   - Downloading qwen2.5-vl:32b (vision model)..."
ollama pull qwen2.5-vl:32b > /dev/null 2>&1 &
QWEN_PID=$!

echo "   - Downloading deepseek-r1:1.5b (reasoning model)..."
ollama pull deepseek-r1:1.5b > /dev/null 2>&1 &
DEEPSEEK_PID=$!

echo "   - Downloading devstral:latest (coding model)..."
ollama pull devstral:latest > /dev/null 2>&1 &
DEVSTRAL_PID=$!

# Wait for models with progress
wait $QWEN_PID && echo "✅ Vision model downloaded"
wait $DEEPSEEK_PID && echo "✅ Reasoning model downloaded"  
wait $DEVSTRAL_PID && echo "✅ Coding model downloaded"

echo ""
echo "🎉 DBot setup complete!"
echo "📍 MCP Server: Ready for @dbot commands"
echo "🔧 Use: Add DBot to your MCP-capable application"
echo ""
echo "Kill MCP server with: kill $MCP_PID"
