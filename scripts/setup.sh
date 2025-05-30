#!/bin/bash

echo "🚀 Setting up DBot with auto-dependency installation..."

# Function to install missing dependencies
install_missing_deps() {
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo "📦 Installing Docker..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS - Download Docker Desktop
            curl -o /tmp/Docker.dmg https://desktop.docker.com/mac/main/amd64/Docker.dmg
            sudo hdiutil attach /tmp/Docker.dmg
            sudo cp -R "/Volumes/Docker/Docker.app" /Applications/
            sudo hdiutil detach "/Volumes/Docker"
            open /Applications/Docker.app
            echo "✅ Docker Desktop installed - waiting for startup..."
            sleep 30
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -aG docker $USER
        fi
    fi

    # Check Ollama
    if ! command -v ollama &> /dev/null; then
        echo "🧠 Installing Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh
        
        # Start Ollama service
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew services start ollama 2>/dev/null || ollama serve &
        else
            systemctl start ollama 2>/dev/null || ollama serve &
        fi
        sleep 5
    fi

    # Check Python3
    if ! command -v python3 &> /dev/null; then
        echo "🐍 Installing Python3..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # Install Homebrew if needed
            if ! command -v brew &> /dev/null; then
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install python3
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo apt-get update && sudo apt-get install -y python3 python3-pip
        fi
    fi
}

# Install missing dependencies
install_missing_deps

# Start Redis
echo "📦 Starting Redis Stack..."
docker run -d --name redis-stack -p 6379:6379 redis/redis-stack-server 2>/dev/null || echo "✅ Redis already running"

# Install Python deps
echo "🐍 Installing Python dependencies..."
pip3 install -r requirements.txt > /dev/null 2>&1

# Start MCP server immediately
echo "🔧 Starting DBot MCP Server..."
node src/mcp_server.js &
MCP_PID=$!
echo "✅ DBot MCP Server ready (PID: $MCP_PID)"

# Download models in background
echo "📥 Downloading LLM models in background..."
{
    echo "   - Downloading vision model (qwen2.5-vl:32b)..."
    ollama pull qwen2.5-vl:32b > /dev/null 2>&1
    echo "✅ Vision model ready"
    
    echo "   - Downloading reasoning model (deepseek-r1:1.5b)..."
    ollama pull deepseek-r1:1.5b > /dev/null 2>&1
    echo "✅ Reasoning model ready"
    
    echo "   - Downloading coding model (devstral:latest)..."
    ollama pull devstral:latest > /dev/null 2>&1
    echo "✅ Coding model ready"
    
    echo "🎉 All models downloaded! DBot fully operational."
} &

echo ""
echo "🎯 DBot Status:"
echo "   ✅ MCP Server: Running"
echo "   🔄 Models: Downloading in background"
echo "   📍 Add to MCP app and use @dbot"
echo ""
echo "💡 Kill server: kill $MCP_PID"
