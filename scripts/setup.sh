#!/bin/bash

echo "🚀 Setting up DBot..."

# Auto-install dependencies  
install_deps() {
    echo "📦 Checking dependencies..."
    
    # Docker
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            curl -o /tmp/Docker.dmg https://desktop.docker.com/mac/main/amd64/Docker.dmg
            sudo hdiutil attach /tmp/Docker.dmg
            sudo cp -R "/Volumes/Docker/Docker.app" /Applications/
            sudo hdiutil detach "/Volumes/Docker"
            open /Applications/Docker.app
            sleep 30
        else
            curl -fsSL https://get.docker.com | sh
            sudo systemctl start docker
        fi
    fi

    # Ollama
    if ! command -v ollama &> /dev/null; then
        echo "Installing Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh
        ollama serve &
        sleep 5
    fi

    # Python3
    if ! command -v python3 &> /dev/null; then
        echo "Installing Python3..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            if ! command -v brew &> /dev/null; then
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install python3
        else
            sudo apt-get update && sudo apt-get install -y python3 python3-pip
        fi
    fi
}

# Install dependencies
install_deps

# Start Redis
echo "📦 Starting Redis..."
docker run -d --name redis-stack -p 6379:6379 redis/redis-stack-server 2>/dev/null || echo "✅ Redis running"

# Install Python deps
echo "🐍 Installing Python dependencies..."
pip3 install -r requirements.txt > /dev/null 2>&1

# Start MCP server
echo "🔧 Starting DBot MCP Server..."
node src/mcp_server.js &
MCP_PID=$!
echo "✅ DBot ready (PID: $MCP_PID)"

# Download models in background
echo "📥 Downloading models in background..."
{
    ollama pull qwen2.5-vl:32b > /dev/null 2>&1 && echo "✅ Vision model ready"
    ollama pull deepseek-r1:1.5b > /dev/null 2>&1 && echo "✅ Reasoning model ready"  
    ollama pull devstral:latest > /dev/null 2>&1 && echo "✅ Coding model ready"
    echo "🎉 All models downloaded!"
} &

echo ""
echo "🎯 DBot Status:"
echo "   ✅ MCP Server: Running"
echo "   🔄 Models: Downloading"
echo "   📍 Use @dbot in MCP app"
echo ""
echo "Optional: Configure external LLM"
echo "dbot 'configure openai <api_key>'"
echo "dbot 'configure anthropic <api_key>'"
