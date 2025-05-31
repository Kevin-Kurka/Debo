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
if ! pgrep redis-server > /dev/null; then
    if command -v redis-server &> /dev/null; then
        redis-server &
    else
        echo "Installing Redis..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew install redis
            brew services start redis
        else
            sudo apt-get install -y redis-server
            sudo systemctl start redis-server
            sudo systemctl enable redis-server
        fi
    fi
fi
echo "✅ Redis running"

# Install Python deps
echo "🐍 Installing Python dependencies..."
pip3 install -r requirements.txt > /dev/null 2>&1

# Start MCP server
echo "🔧 Starting DBot MCP Server..."
node src/mcp_server.js &
MCP_PID=$!
echo "✅ DBot ready (PID: $MCP_PID)"

# Auto-install to MCP apps
echo "🔗 Installing to MCP applications..."
node scripts/auto_install_mcp.cjs

# Download models in background with error handling
echo "📥 Downloading models in background..."
{
    echo "🔄 Downloading vision model..."
    if ollama pull qwen2.5-vl:32b 2>&1; then
        echo "✅ Vision model ready"
    else
        echo "❌ Vision model failed - trying smaller alternative"
        ollama pull qwen2.5-vl:7b 2>&1 && echo "✅ Vision model (7B) ready"
    fi
    
    echo "🔄 Downloading reasoning model..."
    if ollama pull deepseek-r1:1.5b 2>&1; then
        echo "✅ Reasoning model ready"
    else
        echo "❌ Reasoning model failed"
    fi
    
    echo "🔄 Downloading coding model..."
    if ollama pull devstral:latest 2>&1; then
        echo "✅ Coding model ready"
    else
        echo "❌ Coding model failed"
    fi
    
    echo "🎉 Model downloads complete!"
    # Notify menu bar app
    osascript -e 'display notification "DBot models ready" with title "DBot"' 2>/dev/null || true
} &

echo ""
echo "🎯 DBot Status:"
echo "   ✅ MCP Server: Running"
echo "   🔄 Models: Downloading"
echo "   📍 Use @debo in MCP app"
echo ""
echo "Optional: Configure external LLM"
echo "debo 'configure openai <api_key>'"
echo "debo 'configure anthropic <api_key>'"
