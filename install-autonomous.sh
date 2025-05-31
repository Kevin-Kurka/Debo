#!/bin/bash

# Debo Autonomous Installation Script
# Grants full computer access and sets up natural language CLI

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Animated banner
show_banner() {
    clear
    echo -e "${CYAN}"
    cat << 'EOF'
    ██████╗ ███████╗██████╗  ██████╗ 
    ██╔══██╗██╔════╝██╔══██╗██╔═══██╗
    ██║  ██║█████╗  ██████╔╝██║   ██║
    ██║  ██║██╔══╝  ██╔══██╗██║   ██║
    ██████╔╝███████╗██████╔╝╚██████╔╝
    ╚═════╝ ╚══════╝╚═════╝  ╚═════╝ 

    Autonomous Development System v2.0
EOF
    echo -e "${NC}"
    echo -e "${PURPLE}🤖 Installing your AI development team...${NC}"
    echo ""
}

# Progress indicator
progress() {
    local current=$1
    local total=$2
    local desc=$3
    local percent=$((current * 100 / total))
    local filled=$((percent / 5))
    local empty=$((20 - filled))
    
    printf "\r${BLUE}["
    printf "%${filled}s" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '░'
    printf "] ${percent}%% - ${desc}${NC}"
}

# Error handling
error_exit() {
    echo -e "\n${RED}❌ Error: $1${NC}" >&2
    echo -e "${YELLOW}💡 Try running with sudo or check system requirements${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check system requirements
check_system() {
    info "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        success "macOS detected"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        success "Linux detected"
    else
        error_exit "Unsupported operating system: $OSTYPE"
    fi
    
    # Check architecture
    ARCH=$(uname -m)
    if [[ "$ARCH" != "x86_64" && "$ARCH" != "arm64" ]]; then
        warn "Unsupported architecture: $ARCH (proceeding anyway)"
    fi
    
    # Check available memory
    if [[ "$OS" == "macos" ]]; then
        TOTAL_MEM=$(sysctl -n hw.memsize)
        TOTAL_GB=$((TOTAL_MEM / 1024 / 1024 / 1024))
    else
        TOTAL_GB=$(free -g | awk '/^Mem:/{print $2}')
    fi
    
    if [[ $TOTAL_GB -lt 8 ]]; then
        warn "Low memory detected: ${TOTAL_GB}GB (8GB+ recommended)"
    else
        success "Memory: ${TOTAL_GB}GB available"
    fi
}

# Install prerequisites with autonomous permissions
install_prerequisites() {
    info "Installing prerequisites with autonomous access..."
    
    # Request permissions upfront
    echo -e "${YELLOW}🔐 Debo needs administrative access to install system dependencies${NC}"
    echo -e "${CYAN}   This enables autonomous development capabilities${NC}"
    sudo -v || error_exit "Administrator access required"
    
    # Keep sudo alive
    while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &
    
    if [[ "$OS" == "macos" ]]; then
        install_macos_deps
    else
        install_linux_deps
    fi
}

install_macos_deps() {
    # Install Homebrew if needed
    if ! command -v brew &> /dev/null; then
        progress 1 8 "Installing Homebrew..."
        NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)"
    fi
    
    progress 2 8 "Installing Node.js..."
    brew install node &>/dev/null || true
    
    progress 3 8 "Installing Redis..."
    brew install redis &>/dev/null || true
    brew services start redis &>/dev/null || true
    
    progress 4 8 "Installing Git..."
    brew install git &>/dev/null || true
    
    progress 5 8 "Installing Python..."
    brew install python@3.11 &>/dev/null || true
    
    progress 6 8 "Installing development tools..."
    brew install jq curl wget &>/dev/null || true
    
    progress 7 8 "Installing Ollama..."
    if ! command -v ollama &> /dev/null; then
        curl -fsSL https://ollama.ai/install.sh | sh
    fi
    
    progress 8 8 "Starting services..."
    # Start Ollama
    nohup ollama serve > /dev/null 2>&1 &
    sleep 2
}

install_linux_deps() {
    progress 1 8 "Updating package lists..."
    sudo apt-get update &>/dev/null
    
    progress 2 8 "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - &>/dev/null
    sudo apt-get install -y nodejs &>/dev/null
    
    progress 3 8 "Installing Redis..."
    sudo apt-get install -y redis-server &>/dev/null
    sudo systemctl start redis-server &>/dev/null
    sudo systemctl enable redis-server &>/dev/null
    
    progress 4 8 "Installing Git and tools..."
    sudo apt-get install -y git curl wget jq python3 python3-pip &>/dev/null
    
    progress 5 8 "Installing build tools..."
    sudo apt-get install -y build-essential &>/dev/null
    
    progress 6 8 "Installing Ollama..."
    if ! command -v ollama &> /dev/null; then
        curl -fsSL https://ollama.ai/install.sh | sh
    fi
    
    progress 7 8 "Starting services..."
    sudo systemctl start ollama &>/dev/null || nohup ollama serve > /dev/null 2>&1 &
    sleep 2
    
    progress 8 8 "Configuring permissions..."
    # Add user to necessary groups
    sudo usermod -aG redis $USER &>/dev/null || true
}

# Setup Debo
setup_debo() {
    echo ""
    info "Setting up Debo autonomous system..."
    
    # Installation directory
    DEBO_DIR="$HOME/.debo"
    
    progress 1 6 "Creating Debo directory..."
    rm -rf "$DEBO_DIR" &>/dev/null || true
    mkdir -p "$DEBO_DIR"
    cd "$DEBO_DIR"
    
    progress 2 6 "Copying Debo system..."
    # Copy from current directory (assumes running from debo source)
    if [[ -f "$(dirname "$0")/package.json" ]]; then
        cp -r "$(dirname "$0")"/* . 2>/dev/null || true
        cp -r "$(dirname "$0")"/.[^.]* . 2>/dev/null || true
    else
        error_exit "Debo source files not found"
    fi
    
    progress 3 6 "Installing dependencies..."
    npm install --silent &>/dev/null || error_exit "npm install failed"
    
    progress 4 6 "Configuring environment..."
    create_autonomous_config
    
    progress 5 6 "Setting up global access..."
    setup_global_command
    
    progress 6 6 "Testing installation..."
    test_installation
}

create_autonomous_config() {
    # Create comprehensive configuration
    cat > .env << EOF
# Debo Autonomous Configuration
REDIS_URL=redis://localhost:6379
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
WEBSOCKET_PORT=3001
NODE_ENV=production
LOG_LEVEL=info

# Autonomous permissions
AUTONOMOUS_MODE=true
ALLOW_SYSTEM_COMMANDS=true
ALLOW_FILE_OPERATIONS=true
ALLOW_NETWORK_ACCESS=true
ALLOW_PACKAGE_INSTALLATION=true

# Default models
THINKING_MODEL=qwen2.5:14b
FAST_MODEL=qwen2.5:7b
REASONING_MODEL=deepseek-r1:1.5b
VISION_MODEL=qwen2.5-vl:32b

# Auto-upgrade settings
AUTO_MODEL_UPGRADE=true
MODEL_CHECK_INTERVAL=86400
CONFIDENCE_THRESHOLD=0.8
EOF

    # Create Debo config
    cat > .debo-config.json << EOF
{
  "version": "2.0.0",
  "autonomous": true,
  "capabilities": {
    "fileSystem": true,
    "systemCommands": true,
    "networkAccess": true,
    "packageManagement": true,
    "modelManagement": true,
    "mcpServers": true
  },
  "models": {
    "thinking": "qwen2.5:14b",
    "fast": "qwen2.5:7b",
    "reasoning": "deepseek-r1:1.5b",
    "vision": "qwen2.5-vl:32b"
  },
  "features": {
    "realTimeMonitoring": true,
    "autoModelUpgrade": true,
    "contextOptimization": true,
    "qualityGates": true,
    "errorRecovery": true
  },
  "directories": {
    "projects": "$HOME/debo-projects",
    "logs": "$HOME/.debo/logs",
    "cache": "$HOME/.debo/cache"
  }
}
EOF

    # Create project directories
    mkdir -p "$HOME/debo-projects"
    mkdir -p logs cache temp
}

setup_global_command() {
    # Create the main debo command
    cat > bin/debo << 'EOF'
#!/bin/bash
cd "$HOME/.debo"
node bin/debo-natural "$@"
EOF
    chmod +x bin/debo
    
    # Add to PATH
    SHELL_RC=""
    if [[ -n "$ZSH_VERSION" ]] || [[ "$SHELL" == *"zsh"* ]]; then
        SHELL_RC="$HOME/.zshrc"
    elif [[ -n "$BASH_VERSION" ]] || [[ "$SHELL" == *"bash"* ]]; then
        SHELL_RC="$HOME/.bashrc"
        [[ ! -f "$SHELL_RC" ]] && SHELL_RC="$HOME/.bash_profile"
    fi
    
    if [[ -n "$SHELL_RC" ]]; then
        # Remove old entries
        grep -v "debo" "$SHELL_RC" > "${SHELL_RC}.tmp" 2>/dev/null || touch "${SHELL_RC}.tmp"
        mv "${SHELL_RC}.tmp" "$SHELL_RC"
        
        # Add new entry
        echo 'export PATH="$HOME/.debo/bin:$PATH"' >> "$SHELL_RC"
    fi
    
    # Create symlink for immediate access
    sudo ln -sf "$HOME/.debo/bin/debo" /usr/local/bin/debo 2>/dev/null || true
}

# Download AI models
download_models() {
    echo ""
    info "Downloading AI models (this may take a while)..."
    
    models=("qwen2.5:7b" "qwen2.5:14b" "deepseek-r1:1.5b")
    total=${#models[@]}
    
    for i in "${!models[@]}"; do
        model=${models[$i]}
        progress $((i+1)) $total "Downloading $model..."
        
        if ! ollama list | grep -q "$model"; then
            ollama pull "$model" &>/dev/null || warn "Failed to download $model"
        fi
    done
    
    echo ""
    success "Core models downloaded"
}

test_installation() {
    # Test Redis
    if redis-cli ping &>/dev/null; then
        success "Redis connection OK"
    else
        warn "Redis connection failed"
    fi
    
    # Test Ollama
    if curl -s http://localhost:11434/api/tags &>/dev/null; then
        success "Ollama connection OK"
    else
        warn "Ollama connection failed"
    fi
    
    # Test Node.js
    if node -v &>/dev/null; then
        success "Node.js OK"
    else
        error_exit "Node.js not working"
    fi
}

show_completion() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${GREEN}🎉 Debo Installation Complete! 🎉${NC}      ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "${YELLOW}🚀 Quick Start:${NC}"
    echo -e "   ${BLUE}debo${NC} \"Create a React todo app\""
    echo -e "   ${BLUE}debo${NC} \"Add user authentication\""
    echo -e "   ${BLUE}debo${NC} \"Deploy to production\""
    echo ""
    
    echo -e "${YELLOW}💡 Natural Language Examples:${NC}"
    echo -e "   • \"Setup GitHub MCP server\""
    echo -e "   • \"Check for model upgrades\""
    echo -e "   • \"Show project status\""
    echo -e "   • \"Connect to OpenAI API\""
    echo ""
    
    echo -e "${YELLOW}📊 Real-time Monitoring:${NC}"
    echo -e "   ${BLUE}debo${NC} monitor"
    echo ""
    
    echo -e "${YELLOW}🔧 Configuration:${NC}"
    echo -e "   Location: ${CYAN}$HOME/.debo${NC}"
    echo -e "   Projects: ${CYAN}$HOME/debo-projects${NC}"
    echo -e "   Logs: ${CYAN}$HOME/.debo/logs${NC}"
    echo ""
    
    echo -e "${GREEN}🤖 Debo is ready for autonomous development!${NC}"
    echo -e "${GRAY}Restart your terminal or run: source ~/.zshrc${NC}"
}

# Main installation flow
main() {
    show_banner
    
    check_system
    echo ""
    
    install_prerequisites
    echo ""
    
    setup_debo
    echo ""
    
    download_models
    
    show_completion
}

# Run installation
main "$@"