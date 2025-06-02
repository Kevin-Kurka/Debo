#!/bin/bash

# Debo - Autonomous Development System
# Improved Installation Script with Real-time Progress Feedback

set -euo pipefail

# Script variables
SCRIPT_VERSION="3.0.0"
SCRIPT_URL="https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install.sh"
REPO_URL="https://github.com/Kevin-Kurka/Debo.git"
INSTALL_DIR="${DEBO_INSTALL_DIR:-$HOME/debo}"
TEMP_DIR="/tmp/debo-install-$$"
LOG_FILE="$TEMP_DIR/install.log"
PROGRESS_FILE="$TEMP_DIR/progress"
SCRIPT_MODE=""
DEBUG="${DEBO_DEBUG:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Display Debo banner
show_banner() {
    echo -e "${CYAN}"
    cat << 'EOF'
    ██████╗ ███████╗██████╗  ██████╗ 
    ██╔══██╗██╔════╝██╔══██╗██╔═══██╗
    ██║  ██║█████╗  ██████╔╝██║   ██║
    ██║  ██║██╔══╝  ██╔══██╗██║   ██║
    ██████╔╝███████╗██████╔╝╚██████╔╝
    ╚═════╝ ╚══════╝╚═════╝  ╚═════╝ 

    Fortune 500 Enterprise AI System v3.1.0
EOF
    echo -e "${NC}"
    echo -e "${BOLD}🤖 Installing your AI executive team...${NC}\n"
}

# Logging functions
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
    [[ "$DEBUG" == "true" ]] && echo -e "${PURPLE}[DEBUG]${NC} $*"
}

error_exit() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
    log "ERROR: $1"
    echo -e "\n${YELLOW}💡 Troubleshooting:${NC}"
    
    # Provide context-specific help
    case "$1" in
        *"source files"*)
            echo "   • The installer is downloading Debo from GitHub"
            echo "   • Check your internet connection"
            echo "   • Try manually cloning: git clone $REPO_URL"
            ;;
        *"permission"*)
            echo "   • You may need to run with different permissions"
            echo "   • Check directory ownership: ls -la $INSTALL_DIR"
            echo "   • Try a different install directory: export DEBO_INSTALL_DIR=/path/to/dir"
            ;;
        *"Node.js"*)
            echo "   • Node.js 18+ is required"
            echo "   • Install via https://nodejs.org or your package manager"
            echo "   • macOS: brew install node"
            echo "   • Ubuntu: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -"
            ;;
        *"Redis"*)
            echo "   • Redis is required for state management"
            echo "   • macOS: brew install redis && brew services start redis"
            echo "   • Ubuntu: sudo apt install redis-server && sudo systemctl start redis"
            ;;
    esac
    
    echo -e "\n${CYAN}📋 Installation log saved to: $LOG_FILE${NC}"
    echo -e "${CYAN}📞 Get help at: https://github.com/Kevin-Kurka/Debo/issues${NC}"
    
    # Cleanup on error
    cleanup
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
    log "SUCCESS: $1"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
    log "INFO: $1"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    log "WARNING: $1"
}

# Progress tracking with spinner
show_progress() {
    local pid=$1
    local task=$2
    local spin='-\|/'
    local i=0
    
    while kill -0 $pid 2>/dev/null; do
        i=$(( (i+1) %4 ))
        printf "\r${BLUE}[${spin:$i:1}]${NC} $task..."
        sleep 0.1
    done
    
    # Clear the line
    printf "\r"
}

# Cleanup function
cleanup() {
    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Detect how the script is being run
detect_script_mode() {
    if [[ -t 0 ]]; then
        if [[ -f "./package.json" ]] && grep -q '"name": "debo"' ./package.json 2>/dev/null; then
            SCRIPT_MODE="local"
            log "Script running in local mode (from Debo directory)"
        else
            SCRIPT_MODE="download"
            log "Script running in download mode"
        fi
    else
        SCRIPT_MODE="curl"
        log "Script running via curl/pipe"
    fi
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error_exit "This script should not be run as root"
    fi
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        OS_NAME="macOS"
        PACKAGE_MANAGER="brew"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if [[ -f /etc/debian_version ]]; then
            OS_NAME="Debian/Ubuntu"
            PACKAGE_MANAGER="apt"
        elif [[ -f /etc/redhat-release ]]; then
            OS_NAME="RedHat/CentOS"
            PACKAGE_MANAGER="yum"
        else
            OS_NAME="Linux"
            PACKAGE_MANAGER="unknown"
        fi
    else
        error_exit "Unsupported operating system: $OSTYPE"
    fi
    
    info "Detected $OS_NAME"
    log "OS detected: $OS_NAME ($OS, $PACKAGE_MANAGER)"
}

# Check system requirements
check_system_requirements() {
    info "Checking system requirements..."
    
    # Check memory
    if [[ "$OS" == "macos" ]]; then
        TOTAL_MEM=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
    else
        TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
    fi
    
    if [[ $TOTAL_MEM -lt 8 ]]; then
        warning "System has ${TOTAL_MEM}GB RAM. Recommended: 8GB+"
    else
        success "Memory: ${TOTAL_MEM}GB available"
    fi
    
    # Check disk space
    AVAILABLE_SPACE=$(df -BG "$HOME" | awk 'NR==2 {print int($4)}')
    if [[ $AVAILABLE_SPACE -lt 10 ]]; then
        warning "Only ${AVAILABLE_SPACE}GB disk space available. Recommended: 10GB+"
    else
        success "Disk space: ${AVAILABLE_SPACE}GB available"
    fi
}

# Check for required commands
check_command() {
    if ! command -v "$1" &> /dev/null; then
        return 1
    fi
    return 0
}

# Install package based on OS
install_package() {
    local package=$1
    info "Installing $package..."
    
    case "$PACKAGE_MANAGER" in
        brew)
            brew install "$package" || error_exit "Failed to install $package"
            ;;
        apt)
            sudo apt-get update -qq
            sudo apt-get install -y "$package" || error_exit "Failed to install $package"
            ;;
        yum)
            sudo yum install -y "$package" || error_exit "Failed to install $package"
            ;;
        *)
            error_exit "Unknown package manager. Please install $package manually"
            ;;
    esac
}

# Install Node.js
install_nodejs() {
    if ! check_command node; then
        info "Installing Node.js..."
        
        if [[ "$OS" == "macos" ]]; then
            if check_command brew; then
                brew install node
            else
                error_exit "Please install Homebrew first: https://brew.sh"
            fi
        elif [[ "$PACKAGE_MANAGER" == "apt" ]]; then
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            error_exit "Please install Node.js 18+ manually: https://nodejs.org"
        fi
        
        success "Node.js installed"
    else
        local node_version=$(node --version | cut -d'v' -f2)
        local major_version=$(echo "$node_version" | cut -d'.' -f1)
        
        if [[ $major_version -lt 18 ]]; then
            error_exit "Node.js 18+ required. Current version: v$node_version"
        else
            success "Node.js already installed (v$node_version)"
        fi
    fi
}

# Install Redis
install_redis() {
    if ! check_command redis-server && ! check_command redis-cli; then
        info "Installing Redis..."
        
        case "$OS" in
            macos)
                brew install redis
                brew services start redis
                ;;
            linux)
                if [[ "$PACKAGE_MANAGER" == "apt" ]]; then
                    sudo apt-get update -qq
                    sudo apt-get install -y redis-server
                    sudo systemctl start redis-server
                    sudo systemctl enable redis-server
                else
                    install_package redis
                fi
                ;;
        esac
        
        success "Redis installed"
    else
        success "Redis already installed"
        
        # Ensure Redis is running
        if ! pgrep -x "redis-server" > /dev/null; then
            info "Starting Redis..."
            if [[ "$OS" == "macos" ]]; then
                brew services start redis
            else
                sudo systemctl start redis-server 2>/dev/null || sudo service redis-server start
            fi
        fi
    fi
    
    # Test Redis connection
    if redis-cli ping &>/dev/null; then
        success "Redis is running"
    else
        warning "Redis may not be running properly"
    fi
}

# Install Ollama
install_ollama() {
    if ! check_command ollama; then
        info "Installing Ollama..."
        
        # Download and run Ollama installer
        if curl -fsSL https://ollama.ai/install.sh | sh; then
            success "Ollama installed"
        else
            error_exit "Failed to install Ollama"
        fi
    else
        success "Ollama already installed"
    fi
    
    # Start Ollama service
    info "Starting Ollama service..."
    if [[ "$OS" == "macos" ]]; then
        # On macOS, Ollama runs as an app
        if ! pgrep -x "ollama" > /dev/null; then
            nohup ollama serve > /dev/null 2>&1 &
            sleep 3
        fi
    else
        # On Linux, try systemd first
        if systemctl is-active --quiet ollama; then
            success "Ollama service is running"
        else
            nohup ollama serve > /dev/null 2>&1 &
            sleep 3
        fi
    fi
    
    # Verify Ollama is accessible
    if curl -s http://localhost:11434/api/tags &>/dev/null; then
        success "Ollama API is accessible"
    else
        warning "Ollama API may not be accessible"
    fi
}

# Download AI models with real progress
download_models() {
    info "Downloading AI models..."
    echo -e "${YELLOW}This may take 10-30 minutes depending on your connection${NC}\n"
    
    local models=(
        "qwen2.5:14b:Thinking model (14B parameters):8.4GB"
        "qwen2.5:7b:Fast execution model (7B parameters):4.2GB"
        "qwen2.5-vl:7b:Vision model (7B parameters):4.2GB"
        "deepseek-r1:1.5b:Reasoning model (1.5B parameters):0.9GB"
    )
    
    local total_models=${#models[@]}
    local current_model=0
    
    for model_info in "${models[@]}"; do
        IFS=':' read -r model_name model_size desc size <<< "$model_info"
        ((current_model++))
        
        echo -e "\n${BOLD}[$current_model/$total_models] Downloading: $desc${NC}"
        echo -e "${CYAN}Model: $model_name | Size: $size${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        # Check if model already exists
        if ollama list 2>/dev/null | grep -q "^$model_name"; then
            success "$desc already downloaded"
            continue
        fi
        
        # Download with progress shown
        if ollama pull "$model_name"; then
            success "$desc downloaded successfully"
        else
            warning "Failed to download $desc"
            echo -e "${YELLOW}You can retry later with: ollama pull $model_name${NC}"
        fi
    done
    
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    success "Model downloads complete!"
}

# Download or update Debo
setup_debo_repository() {
    info "Setting up Debo repository..."
    
    # Handle different installation modes
    case "$SCRIPT_MODE" in
        local)
            # Already in Debo directory
            INSTALL_DIR=$(pwd)
            success "Using existing Debo directory"
            ;;
        *)
            # Need to clone/download
            if [[ -d "$INSTALL_DIR" ]]; then
                info "Existing installation found at $INSTALL_DIR"
                read -p "Update existing installation? (y/N) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    cd "$INSTALL_DIR"
                    echo -e "${BLUE}Updating repository...${NC}"
                    git pull origin main --progress 2>&1 | while IFS= read -r line; do
                        echo -e "${CYAN}  $line${NC}"
                    done
                    success "Repository updated"
                else
                    error_exit "Installation cancelled"
                fi
            else
                info "Cloning Debo repository..."
                echo -e "${YELLOW}This will download the complete Debo system...${NC}"
                
                # Ensure parent directory exists
                mkdir -p "$(dirname "$INSTALL_DIR")"
                
                # Clone with progress
                git clone --progress "$REPO_URL" "$INSTALL_DIR" 2>&1 | while IFS= read -r line; do
                    echo -e "${CYAN}  $line${NC}"
                done
                
                if [[ -d "$INSTALL_DIR" ]]; then
                    success "Repository cloned"
                else
                    error_exit "Failed to clone repository. Check your internet connection"
                fi
            fi
            cd "$INSTALL_DIR"
            ;;
    esac
    
    # Verify we have the source files
    if [[ ! -f "package.json" ]]; then
        error_exit "Debo source files not found in $INSTALL_DIR"
    fi
}

# Install Node.js dependencies with progress
install_dependencies() {
    info "Installing Node.js dependencies..."
    echo -e "${YELLOW}This will download and install all required packages...${NC}\n"
    
    # Clean install to avoid conflicts
    rm -rf node_modules package-lock.json
    
    # Install with progress shown
    npm install --progress=true --loglevel=info
    
    if [[ $? -eq 0 ]]; then
        success "Dependencies installed"
    else
        error_exit "Failed to install Node.js dependencies"
    fi
}

# Setup configuration
setup_configuration() {
    info "Setting up configuration..."
    
    # Create .env file if it doesn't exist
    if [[ ! -f .env ]]; then
        cat > .env << EOF
# Debo Configuration
# Generated on $(date)

# Redis Configuration
REDIS_URL=redis://localhost:6379

# LLM Provider Configuration
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434

# Model Configuration
THINKING_MODEL=qwen2.5:14b
FAST_MODEL=qwen2.5:7b
VISION_MODEL=qwen2.5-vl:7b
REASONING_MODEL=deepseek-r1:1.5b

# Server Configuration
WEBSOCKET_PORT=3001
NODE_ENV=production
LOG_LEVEL=info

# Feature Flags
ENABLE_QUALITY_GATES=true
ENABLE_AUTO_REVISION=true
ENABLE_GIT_WORKFLOW=true
ENABLE_CONFIDENCE_SCORING=true
ENABLE_BUSINESS_MODE=true
WORKFLOW_ENGINE=langgraph
EOF
        success "Configuration file created"
    else
        success "Configuration file already exists"
    fi
    
    # Create necessary directories
    mkdir -p logs projects temp
    success "Project directories created"
}

# Setup shell integration
setup_shell_integration() {
    info "Setting up shell integration..."
    
    # Create bin directory if needed
    mkdir -p "$INSTALL_DIR/bin"
    
    # Create debo command wrapper for generic system
    cat > "$INSTALL_DIR/bin/debo" << EOF
#!/bin/bash
# Debo command wrapper

export DEBO_HOME="$INSTALL_DIR"
cd "\$DEBO_HOME"

# Ensure Redis is running
if ! redis-cli ping &>/dev/null; then
    echo "Starting Redis..."
    if [[ "\$(uname)" == "Darwin" ]]; then
        brew services start redis 2>/dev/null || redis-server --daemonize yes
    else
        sudo systemctl start redis-server 2>/dev/null || redis-server --daemonize yes
    fi
fi

# Ensure Ollama is running
if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
    echo "Starting Ollama..."
    nohup ollama serve > /dev/null 2>&1 &
    sleep 2
fi

# Run Debo Fortune 500 system
exec node "src/mcp_server_generic.js" "\$@"
EOF
    
    chmod +x "$INSTALL_DIR/bin/debo"
    
    # Add to PATH
    local shell_rc=""
    if [[ -n "$ZSH_VERSION" ]] || [[ -f "$HOME/.zshrc" ]]; then
        shell_rc="$HOME/.zshrc"
    elif [[ -n "$BASH_VERSION" ]] || [[ -f "$HOME/.bashrc" ]]; then
        shell_rc="$HOME/.bashrc"
    elif [[ -f "$HOME/.bash_profile" ]]; then
        shell_rc="$HOME/.bash_profile"
    fi
    
    if [[ -n "$shell_rc" ]]; then
        # Remove old PATH entries
        sed -i.bak '/debo\/bin/d' "$shell_rc" 2>/dev/null || true
        
        # Add new PATH entry
        echo "" >> "$shell_rc"
        echo "# Debo - Fortune 500 Enterprise AI System" >> "$shell_rc"
        echo "export PATH=\"$INSTALL_DIR/bin:\$PATH\"" >> "$shell_rc"
        
        success "Added debo to PATH in $shell_rc"
    else
        warning "Could not determine shell configuration file"
        info "Add this to your shell configuration: export PATH=\"$INSTALL_DIR/bin:\$PATH\""
    fi
}

# Run initial setup
run_initial_setup() {
    info "Running initial setup..."
    
    if [[ -f "scripts/setup.js" ]]; then
        echo -e "${BLUE}Setting up Redis, testing connections...${NC}"
        if npm run setup; then
            success "Initial setup completed"
        else
            warning "Initial setup had some issues"
        fi
    else
        warning "Setup script not found, skipping"
    fi
}

# Test installation
test_installation() {
    info "Testing installation..."
    
    local tests_passed=0
    local tests_total=0
    
    # Test Node.js
    ((tests_total++))
    if node --version &>/dev/null; then
        success "Node.js test passed"
        ((tests_passed++))
    else
        warning "Node.js test failed"
    fi
    
    # Test Redis
    ((tests_total++))
    if redis-cli ping 2>/dev/null | grep -q PONG; then
        success "Redis test passed"
        ((tests_passed++))
    else
        warning "Redis test failed"
    fi
    
    # Test Ollama
    ((tests_total++))
    if curl -s http://localhost:11434/api/tags &>/dev/null; then
        success "Ollama test passed"
        ((tests_passed++))
    else
        warning "Ollama test failed"
    fi
    
    # Test Debo module loading
    ((tests_total++))
    if node -e "require('./package.json')" 2>/dev/null; then
        success "Debo module test passed"
        ((tests_passed++))
    else
        warning "Debo module test failed"
    fi
    
    info "Tests passed: $tests_passed/$tests_total"
}

# Generate MCP configuration
generate_mcp_config() {
    info "Generating MCP configuration..."
    
    local config_file="$HOME/.debo-mcp-config.json"
    
    cat > "$config_file" << EOF
{
  "mcpServers": {
    "debo": {
      "command": "node",
      "args": ["$INSTALL_DIR/src/mcp_server_generic.js"],
      "env": {
        "DEBO_HOME": "$INSTALL_DIR"
      }
    }
  }
}
EOF
    
    success "MCP configuration saved to $config_file"
}

# Main installation flow
main() {
    # Create temp directory for logs
    mkdir -p "$TEMP_DIR"
    
    # Initialize log
    log "Debo installation started at $(date)"
    log "Script version: $SCRIPT_VERSION"
    
    # Show banner
    show_banner
    
    # Detect environment
    detect_script_mode
    check_root
    detect_os
    check_system_requirements
    
    echo -e "\n${BOLD}📦 Installing Prerequisites${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [[ "$OS" == "macos" ]] && ! check_command brew; then
        info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    install_nodejs
    install_redis
    install_ollama
    
    echo -e "\n${BOLD}🚀 Setting Up Debo${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    setup_debo_repository
    install_dependencies
    setup_configuration
    setup_shell_integration
    run_initial_setup
    
    echo -e "\n${BOLD}🤖 Downloading AI Models${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    download_models
    
    echo -e "\n${BOLD}✔️  Final Checks${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    test_installation
    generate_mcp_config
    
    # Show completion message
    echo
    echo -e "${GREEN}🎉 Installation Complete!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    success "Debo Fortune 500 Enterprise AI System is ready!"
    echo
    echo -e "${BOLD}📍 Installation Details:${NC}"
    echo "   • Location: $INSTALL_DIR"
    echo "   • Config: $INSTALL_DIR/.env"
    echo "   • Logs: $INSTALL_DIR/logs/"
    echo "   • 54 Business Agents: Finance, HR, Legal, Sales, Marketing, etc."
    echo
    echo -e "${BOLD}🚀 Quick Start:${NC}"
    echo "   1. Restart your terminal or run: source ${shell_rc:-~/.bashrc}"
    echo "   2. Start Debo: ./start-generic.sh"
    echo "   3. Or directly: debo \"prepare Q4 financial forecast\""
    echo
    echo -e "${BOLD}💼 Business Examples:${NC}"
    echo "   • debo \"create our annual budget with 15% growth target\""
    echo "   • debo \"analyze employee retention in engineering department\""
    echo "   • debo \"develop go-to-market strategy for new product\""
    echo "   • debo \"ensure GDPR compliance across all systems\""
    echo
    echo -e "${BOLD}📊 Web Monitor:${NC}"
    echo "   • URL: http://localhost:3001"
    echo "   • Real-time agent collaboration view"
    echo
    echo -e "${BOLD}🔧 MCP Integration:${NC}"
    echo "   Configuration saved to: $HOME/.debo-mcp-config.json"
    echo
    echo -e "${BOLD}📚 Resources:${NC}"
    echo "   • Business Guide: $INSTALL_DIR/BUSINESS-SYSTEM-README.md"
    echo "   • Documentation: $INSTALL_DIR/README.md"
    echo "   • Get help: https://github.com/Kevin-Kurka/Debo"
    echo
    
    log "Installation completed successfully"
}

# Run main installation
main "$@"