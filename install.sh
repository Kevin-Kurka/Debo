#!/bin/bash

# Debo - Autonomous Development System
# One-Command Installation Script

set -e

echo "🚀 Installing Debo - Autonomous Development System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Error handling
error_exit() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
    echo ""
    echo "📞 Need help? Check the troubleshooting guide:"
    echo "   https://github.com/Kevin-Kurka/Debo/blob/main/TROUBLESHOOTING.md"
    exit 1
}

# Success message
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Info message
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Warning message
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error_exit "This script should not be run as root"
fi

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    info "Detected macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    info "Detected Linux"
else
    error_exit "Unsupported operating system: $OSTYPE"
fi

# Check for required commands
check_command() {
    if ! command -v $1 &> /dev/null; then
        return 1
    fi
    return 0
}

# Install Homebrew on macOS
install_homebrew() {
    if [[ "$OS" == "macos" ]] && ! check_command brew; then
        info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || error_exit "Failed to install Homebrew"
        success "Homebrew installed"
    fi
}

# Install Node.js
install_nodejs() {
    if ! check_command node; then
        info "Installing Node.js..."
        if [[ "$OS" == "macos" ]]; then
            brew install node || error_exit "Failed to install Node.js"
        elif [[ "$OS" == "linux" ]]; then
            # Install via NodeSource repository
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - || error_exit "Failed to setup Node.js repository"
            sudo apt-get install -y nodejs || error_exit "Failed to install Node.js"
        fi
        success "Node.js installed"
    else
        success "Node.js already installed ($(node --version))"
    fi
}

# Install Redis
install_redis() {
    if ! check_command redis-server; then
        info "Installing Redis..."
        if [[ "$OS" == "macos" ]]; then
            brew install redis || error_exit "Failed to install Redis"
            brew services start redis || warning "Failed to start Redis service"
        elif [[ "$OS" == "linux" ]]; then
            sudo apt-get update
            sudo apt-get install -y redis-server || error_exit "Failed to install Redis"
            sudo systemctl start redis-server || warning "Failed to start Redis service"
            sudo systemctl enable redis-server || warning "Failed to enable Redis service"
        fi
        success "Redis installed"
    else
        success "Redis already installed"
        # Start Redis if not running
        if ! pgrep -x "redis-server" > /dev/null; then
            info "Starting Redis..."
            if [[ "$OS" == "macos" ]]; then
                brew services start redis
            elif [[ "$OS" == "linux" ]]; then
                sudo systemctl start redis-server
            fi
        fi
    fi
}

# Install Ollama
install_ollama() {
    if ! check_command ollama; then
        info "Installing Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh || error_exit "Failed to install Ollama"
        success "Ollama installed"
    else
        success "Ollama already installed"
    fi
    
    # Start Ollama service
    info "Starting Ollama service..."
    if [[ "$OS" == "macos" ]]; then
        ollama serve &
    elif [[ "$OS" == "linux" ]]; then
        nohup ollama serve > /dev/null 2>&1 &
    fi
    
    # Wait for service to start
    sleep 3
    
    # Verify Ollama is running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        success "Ollama service started"
    else
        warning "Ollama service may not be running properly"
    fi
}

# Install Python (for some scripts)
install_python() {
    if ! check_command python3; then
        info "Installing Python 3..."
        if [[ "$OS" == "macos" ]]; then
            brew install python@3.11 || error_exit "Failed to install Python"
        elif [[ "$OS" == "linux" ]]; then
            sudo apt-get install -y python3 python3-pip || error_exit "Failed to install Python"
        fi
        success "Python 3 installed"
    else
        success "Python 3 already installed ($(python3 --version))"
    fi
}

# Clone or update Debo repository
setup_debo() {
    DEBO_DIR="$HOME/debo"
    
    if [[ -d "$DEBO_DIR" ]]; then
        info "Updating existing Debo installation..."
        cd "$DEBO_DIR"
        git pull origin main || warning "Failed to update repository"
    else
        info "Cloning Debo repository..."
        git clone https://github.com/Kevin-Kurka/Debo.git "$DEBO_DIR" || error_exit "Failed to clone repository"
        cd "$DEBO_DIR"
    fi
    
    success "Debo repository ready"
}

# Install Node.js dependencies
install_dependencies() {
    info "Installing Node.js dependencies..."
    cd "$HOME/debo"
    npm install || error_exit "Failed to install Node.js dependencies"
    success "Dependencies installed"
}

# Install Python dependencies
install_python_deps() {
    if [[ -f "$HOME/debo/requirements.txt" ]]; then
        info "Installing Python dependencies..."
        cd "$HOME/debo"
        python3 -m pip install -r requirements.txt || warning "Failed to install some Python dependencies"
        success "Python dependencies installed"
    fi
}

# Download AI models
download_models() {
    info "Downloading AI models (this may take a while)..."
    echo "📥 Downloading models in background..."
    
    # Create model download script
    cat > "$HOME/debo/download_models.sh" << 'EOF'
#!/bin/bash
echo "🔄 Downloading thinking model (qwen2.5:14b)..."
if ollama pull qwen2.5:14b 2>&1; then
    echo "✅ Thinking model ready"
else
    echo "❌ Failed to download thinking model"
fi

echo "🔄 Downloading fast model (qwen2.5:7b)..."
if ollama pull qwen2.5:7b 2>&1; then
    echo "✅ Fast model ready"
else
    echo "❌ Failed to download fast model"
fi

echo "🔄 Downloading vision model (qwen2.5-vl:32b)..."
if ollama pull qwen2.5-vl:32b 2>&1; then
    echo "✅ Vision model ready"
else
    echo "⚠️ Vision model failed, trying smaller version..."
    if ollama pull qwen2.5-vl:7b 2>&1; then
        echo "✅ Vision model (7B) ready"
    else
        echo "❌ Vision model download failed"
    fi
fi

echo "🔄 Downloading reasoning model (deepseek-r1:1.5b)..."
if ollama pull deepseek-r1:1.5b 2>&1; then
    echo "✅ Reasoning model ready"
else
    echo "❌ Failed to download reasoning model"
fi

echo "🎉 Model downloads complete!"

# Notify user
if command -v osascript &> /dev/null; then
    osascript -e 'display notification "Debo AI models are ready!" with title "Debo Setup"' 2>/dev/null || true
fi
EOF
    
    chmod +x "$HOME/debo/download_models.sh"
    nohup "$HOME/debo/download_models.sh" > "$HOME/debo/model_download.log" 2>&1 &
    
    success "Model download started in background"
    info "Monitor progress: tail -f ~/debo/model_download.log"
}

# Create configuration file
create_config() {
    info "Creating configuration file..."
    
    cat > "$HOME/debo/.debo-config.json" << EOF
{
  "redis": {
    "url": "redis://localhost:6379"
  },
  "ollama": {
    "url": "http://localhost:11434"
  },
  "models": {
    "thinking": "qwen2.5:14b",
    "fast": "qwen2.5:7b",
    "vision": "qwen2.5-vl:32b",
    "reasoning": "deepseek-r1:1.5b"
  },
  "features": {
    "contextOptimization": true,
    "confidenceScoring": true,
    "autoRevision": true,
    "gitWorkflow": true,
    "qualityGates": true
  },
  "quality": {
    "minConfidence": 80,
    "testCoverage": 80,
    "codeComplexity": 10,
    "securityScan": true
  },
  "directories": {
    "projects": "$HOME/debo/projects",
    "logs": "$HOME/debo/logs",
    "temp": "$HOME/debo/temp"
  }
}
EOF
    
    success "Configuration created"
}

# Create directories
create_directories() {
    info "Creating project directories..."
    
    mkdir -p "$HOME/debo/projects"
    mkdir -p "$HOME/debo/logs"
    mkdir -p "$HOME/debo/temp"
    
    success "Directories created"
}

# Setup shell integration
setup_shell_integration() {
    info "Setting up shell integration..."
    
    # Create debo command script
    cat > "$HOME/debo/bin/debo" << 'EOF'
#!/bin/bash
cd "$HOME/debo"
node src/mcp_server_v2.js "$@"
EOF
    
    chmod +x "$HOME/debo/bin/debo"
    
    # Add to PATH
    SHELL_RC=""
    if [[ -f "$HOME/.zshrc" ]]; then
        SHELL_RC="$HOME/.zshrc"
    elif [[ -f "$HOME/.bashrc" ]]; then
        SHELL_RC="$HOME/.bashrc"
    elif [[ -f "$HOME/.bash_profile" ]]; then
        SHELL_RC="$HOME/.bash_profile"
    fi
    
    if [[ -n "$SHELL_RC" ]]; then
        if ! grep -q "debo/bin" "$SHELL_RC"; then
            echo 'export PATH="$HOME/debo/bin:$PATH"' >> "$SHELL_RC"
            success "Added debo to PATH in $SHELL_RC"
        fi
    fi
    
    success "Shell integration setup"
}

# Test installation
test_installation() {
    info "Testing installation..."
    
    cd "$HOME/debo"
    
    # Test Redis connection
    if redis-cli ping | grep -q "PONG"; then
        success "Redis connection test passed"
    else
        warning "Redis connection test failed"
    fi
    
    # Test Ollama connection
    if curl -s http://localhost:11434/api/tags > /dev/null; then
        success "Ollama connection test passed"
    else
        warning "Ollama connection test failed"
    fi
    
    # Test Node.js dependencies
    if node -e "require('./src/mcp_server_v2.js')" 2>/dev/null; then
        success "Node.js dependencies test passed"
    else
        warning "Node.js dependencies test failed"
    fi
}

# Main installation flow
main() {
    echo "🔧 Starting installation process..."
    echo ""
    
    # Install prerequisites
    install_homebrew
    install_nodejs
    install_redis
    install_ollama
    install_python
    
    echo ""
    info "Prerequisites installed successfully"
    echo ""
    
    # Setup Debo
    setup_debo
    install_dependencies
    install_python_deps
    create_config
    create_directories
    setup_shell_integration
    
    echo ""
    info "Debo core system installed"
    echo ""
    
    # Download models and test
    download_models
    test_installation
    
    echo ""
    echo "🎉 Installation Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    success "Debo Autonomous Development System is ready!"
    echo ""
    echo "📖 Quick Start:"
    echo "   1. Restart your terminal (to load PATH changes)"
    echo "   2. Add Debo to your MCP client configuration:"
    echo ""
    echo "   {"
    echo "     \"debo\": {"
    echo "       \"command\": \"node\","
    echo "       \"args\": [\"$HOME/debo/src/mcp_server_v2.js\"]"
    echo "     }"
    echo "   }"
    echo ""
    echo "💡 Example usage:"
    echo "   debo \"Build a task management app with React\""
    echo "   debo \"Add user authentication to my project\""
    echo "   debo \"Deploy my app to production\""
    echo ""
    echo "📊 System Status:"
    echo "   • Location: $HOME/debo"
    echo "   • Config: $HOME/debo/.debo-config.json"
    echo "   • Logs: $HOME/debo/logs"
    echo "   • Models: Downloading in background"
    echo ""
    echo "🔧 Commands:"
    echo "   • Check status: cd ~/debo && npm run health"
    echo "   • View logs: tail -f ~/debo/logs/debo.log"
    echo "   • Model download progress: tail -f ~/debo/model_download.log"
    echo ""
    echo "📚 Documentation:"
    echo "   • README: $HOME/debo/README.md"
    echo "   • Troubleshooting: $HOME/debo/TROUBLESHOOTING.md"
    echo ""
    echo "🚀 Debo is now building software autonomously!"
}

# Run main installation
main