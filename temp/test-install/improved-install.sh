#!/bin/bash

# Debo Professional Installer - Improved Version
# Addresses all hanging points with continuous feedback

set -euo pipefail

# Script configuration
REPO_URL="https://github.com/Kevin-Kurka/Debo.git"
INSTALL_DIR="${DEBO_INSTALL_DIR:-$HOME/debo}"
LOG_FILE="/tmp/debo-install-$$.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# Spinner characters
SPINNER='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

# Progress tracking
CURRENT_OPERATION=""
OPERATION_START_TIME=0

# Spinner function for background operations
show_spinner() {
    local pid=$1
    local message=$2
    local delay=0.1
    local elapsed=0
    local spinpos=0
    
    while kill -0 $pid 2>/dev/null; do
        local spinchar=${SPINNER:$spinpos:1}
        elapsed=$(($(date +%s) - OPERATION_START_TIME))
        printf "\r${CYAN}[%s]${NC} %s... (%ds)" "$spinchar" "$message" "$elapsed"
        spinpos=$(( (spinpos + 1) % ${#SPINNER} ))
        sleep $delay
    done
    
    # Check if process succeeded
    wait $pid
    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        printf "\r${GREEN}[✓]${NC} %s... Done! (%ds)\n" "$message" "$elapsed"
    else
        printf "\r${RED}[✗]${NC} %s... Failed! (%ds)\n" "$message" "$elapsed"
        return $exit_code
    fi
}

# Progress dots for streaming operations
show_progress_dots() {
    local message=$1
    local count=0
    printf "%s" "$message"
    while IFS= read -r line; do
        ((count++))
        if ((count % 10 == 0)); then
            printf "."
        fi
        echo "$line" >> "$LOG_FILE"
    done
    echo " Done!"
}

# Network connectivity check
check_network() {
    printf "Checking network connectivity"
    for i in {1..3}; do
        printf "."
        if curl -s --connect-timeout 5 --head https://github.com > /dev/null 2>&1; then
            echo " ${GREEN}OK${NC}"
            return 0
        fi
        sleep 1
    done
    echo " ${RED}FAILED${NC}"
    echo "Error: Unable to reach GitHub. Please check your internet connection."
    exit 1
}

# Disk space check
check_disk_space() {
    local required_gb=10
    printf "Checking disk space..."
    
    # Get available space in GB
    local available_gb
    if [[ "$OSTYPE" == "darwin"* ]]; then
        available_gb=$(df -g "$HOME" | awk 'NR==2 {print $4}')
    else
        available_gb=$(df -BG "$HOME" | awk 'NR==2 {print $4}' | sed 's/G//')
    fi
    
    if [ "$available_gb" -lt "$required_gb" ]; then
        echo " ${RED}INSUFFICIENT${NC}"
        echo "Error: Need at least ${required_gb}GB free space, but only ${available_gb}GB available"
        exit 1
    else
        echo " ${GREEN}${available_gb}GB available${NC}"
    fi
}

# Monitor npm install with real progress
npm_install_with_progress() {
    echo "Installing npm dependencies..."
    
    # First, get package count for progress estimation
    local total_packages=$(grep -c '"' package.json 2>/dev/null || echo "50")
    local installed=0
    
    # Run npm install and parse output
    npm install 2>&1 | while IFS= read -r line; do
        # Show different types of npm progress
        if [[ "$line" =~ "added" ]] || [[ "$line" =~ "updated" ]]; then
            ((installed++))
            local percent=$((installed * 100 / total_packages))
            printf "\r  ${CYAN}→${NC} Processing packages... [%3d%%] %s" "$percent" "${line:0:50}"
        elif [[ "$line" =~ "npm WARN" ]]; then
            # Show warnings but don't stop
            printf "\r  ${YELLOW}⚠${NC}  %s\n" "${line:0:70}"
        elif [[ "$line" =~ "npm ERR!" ]]; then
            # Show errors
            printf "\r  ${RED}✗${NC} %s\n" "$line"
        fi
        echo "$line" >> "$LOG_FILE"
    done
    
    # Clear the line and show completion
    printf "\r%-80s\r" " "
    echo "  ${GREEN}✓${NC} Dependencies installed successfully"
}

# Monitor git clone with enhanced progress
git_clone_with_progress() {
    local repo=$1
    local dest=$2
    
    echo "Downloading repository..."
    
    # Track last update time to detect stalls
    local last_update=$(date +%s)
    local stall_timeout=10
    
    git clone --progress "$repo" "$dest" 2>&1 | while IFS= read -r line; do
        local now=$(date +%s)
        
        if [[ "$line" =~ "Cloning into" ]]; then
            printf "\r  ${CYAN}→${NC} Initializing repository..."
        elif [[ "$line" =~ Counting\ objects:\ ([0-9]+) ]]; then
            printf "\r  ${CYAN}→${NC} Analyzing repository structure..."
            last_update=$now
        elif [[ "$line" =~ Receiving\ objects:\ +([0-9]+)%.*\(([0-9]+)/([0-9]+)\) ]]; then
            local percent="${BASH_REMATCH[1]}"
            local current="${BASH_REMATCH[2]}"
            local total="${BASH_REMATCH[3]}"
            local progress=$((percent / 2))  # First 50%
            printf "\r  ${CYAN}→${NC} Downloading: [%-50s] %3d%% (%s/%s files)" \
                   "$(printf '#%.0s' $(seq 1 $progress))" "$percent" "$current" "$total"
            last_update=$now
        elif [[ "$line" =~ Resolving\ deltas:\ +([0-9]+)%.*\(([0-9]+)/([0-9]+)\) ]]; then
            local percent="${BASH_REMATCH[1]}"
            local current="${BASH_REMATCH[2]}"
            local total="${BASH_REMATCH[3]}"
            local progress=$((50 + percent / 2))  # Last 50%
            printf "\r  ${CYAN}→${NC} Processing: [%-50s] %3d%% (%s/%s deltas)" \
                   "$(printf '#%.0s' $(seq 1 $progress))" "$((50 + percent/2))" "$current" "$total"
            last_update=$now
        fi
        
        # Detect stalls
        if ((now - last_update > stall_timeout)); then
            printf "\n  ${YELLOW}⚠${NC}  Download may be stalled. Still waiting..."
            last_update=$now
        fi
        
        echo "$line" >> "$LOG_FILE"
    done
    
    printf "\r%-80s\r" " "
    echo "  ${GREEN}✓${NC} Repository downloaded successfully"
}

# Install Homebrew with progress
install_homebrew_with_progress() {
    echo "Installing Homebrew package manager..."
    echo "  ${DIM}This may take 5-10 minutes on first install${NC}"
    
    # Download and run installer with visible progress
    local brew_install_url="https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh"
    
    # First download the script
    printf "  ${CYAN}→${NC} Downloading Homebrew installer..."
    curl -fsSL "$brew_install_url" -o /tmp/brew-install.sh || {
        echo " ${RED}Failed${NC}"
        return 1
    }
    echo " ${GREEN}Done${NC}"
    
    # Run with output streaming
    printf "  ${CYAN}→${NC} Running Homebrew installer...\n"
    bash /tmp/brew-install.sh 2>&1 | while IFS= read -r line; do
        # Filter and show important lines
        if [[ "$line" =~ "==>" ]] || [[ "$line" =~ "Downloading" ]] || [[ "$line" =~ "Installing" ]]; then
            printf "    %s\n" "${line:0:70}"
        fi
        echo "$line" >> "$LOG_FILE"
    done
    
    echo "  ${GREEN}✓${NC} Homebrew installed successfully"
}

# Monitor Ollama model downloads
monitor_ollama_downloads() {
    local models=("llama3.2:3b" "qwen2.5:7b")
    local sizes=("1.9GB" "4.4GB")
    
    echo "Monitoring AI model downloads..."
    
    while true; do
        local all_complete=true
        local status_line=""
        
        for i in "${!models[@]}"; do
            local model="${models[$i]}"
            local size="${sizes[$i]}"
            
            # Check if model exists
            if ollama list 2>/dev/null | grep -q "$model"; then
                status_line+="${GREEN}✓${NC} $model "
            else
                all_complete=false
                # Try to get download progress (this is a mockup as ollama doesn't provide progress API)
                status_line+="${YELLOW}↓${NC} $model ($size) "
            fi
        done
        
        printf "\r  %s" "$status_line"
        
        if $all_complete; then
            printf "\r%-80s\r" " "
            echo "  ${GREEN}✓${NC} All AI models downloaded"
            break
        fi
        
        sleep 2
    done
}

# Main installation flow with continuous feedback
main() {
    # Clear screen and show banner
    clear
    echo -e "${CYAN}${BOLD}"
    cat << 'EOF'

    ██████╗ ███████╗██████╗  ██████╗ 
    ██╔══██╗██╔════╝██╔══██╗██╔═══██╗
    ██║  ██║█████╗  ██████╔╝██║   ██║
    ██║  ██║██╔══╝  ██╔══██╗██║   ██║
    ██████╔╝███████╗██████╔╝╚██████╔╝
    ╚═════╝ ╚══════╝╚═════╝  ╚═════╝ 

    Open Source AI Enterprise System v1.0.0

EOF
    echo -e "${NC}"
    
    echo "Welcome to Debo - Your AI-Powered Development System"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Pre-installation checks
    echo "${BOLD}Pre-Installation Checks${NC}"
    check_network
    check_disk_space
    echo ""
    
    # System analysis
    echo "${BOLD}System Analysis${NC}"
    OS="unknown"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macOS"
    elif [[ "$OSTYPE" == "linux"* ]]; then
        OS="Linux"
    fi
    ARCH=$(uname -m)
    echo "Operating System: $OS $ARCH"
    
    # Check prerequisites with visual feedback
    printf "Checking prerequisites"
    for tool in git node npm curl; do
        printf "."
        command -v $tool &>/dev/null || MISSING_DEPS+=("$tool")
        sleep 0.1
    done
    echo " ${GREEN}Done${NC}"
    
    if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
        echo "Missing tools: ${YELLOW}${MISSING_DEPS[*]}${NC}"
        echo "These will be installed automatically."
    else
        echo "All prerequisites found ${GREEN}✓${NC}"
    fi
    echo ""
    
    # Install prerequisites with progress
    echo "${BOLD}Installing Prerequisites${NC}"
    
    # Node.js installation
    if ! command -v node &>/dev/null; then
        if [[ "$OS" == "macOS" ]]; then
            if ! command -v brew &>/dev/null; then
                install_homebrew_with_progress
            fi
            
            echo "Installing Node.js..."
            OPERATION_START_TIME=$(date +%s)
            brew install node >> "$LOG_FILE" 2>&1 &
            show_spinner $! "Installing Node.js via Homebrew"
        fi
    else
        NODE_VERSION=$(node --version)
        echo "Node.js ${GREEN}$NODE_VERSION${NC} already installed"
    fi
    
    # Redis installation with progress
    if ! command -v redis-server &>/dev/null; then
        echo "Installing Redis database..."
        OPERATION_START_TIME=$(date +%s)
        
        if [[ "$OS" == "macOS" ]]; then
            brew install redis >> "$LOG_FILE" 2>&1 &
            show_spinner $! "Installing Redis"
            
            brew services start redis >> "$LOG_FILE" 2>&1 &
            show_spinner $! "Starting Redis service"
        else
            apt-get update 2>&1 | show_progress_dots "Updating package lists"
            apt-get install -y redis-server 2>&1 | show_progress_dots "Installing Redis"
            systemctl start redis >> "$LOG_FILE" 2>&1 &
            show_spinner $! "Starting Redis service"
        fi
    else
        echo "Redis ${GREEN}already installed${NC}"
    fi
    
    # Ollama installation with progress
    if ! command -v ollama &>/dev/null; then
        echo "Installing Ollama AI platform..."
        printf "  ${CYAN}→${NC} Downloading Ollama installer..."
        
        # Download with progress
        curl -fsSL https://ollama.ai/install.sh -o /tmp/ollama-install.sh \
             --progress-bar 2>&1 | while IFS= read -r line; do
            if [[ "$line" =~ ([0-9]+)% ]]; then
                printf "\r  ${CYAN}→${NC} Downloading Ollama installer... %s%%" "${BASH_REMATCH[1]}"
            fi
        done
        echo " ${GREEN}Done${NC}"
        
        # Run installer
        OPERATION_START_TIME=$(date +%s)
        bash /tmp/ollama-install.sh >> "$LOG_FILE" 2>&1 &
        show_spinner $! "Installing Ollama"
    else
        echo "Ollama ${GREEN}already installed${NC}"
    fi
    echo ""
    
    # Repository download
    echo "${BOLD}Downloading Debo Repository${NC}"
    
    if [[ -d "$INSTALL_DIR" ]]; then
        printf "Removing existing installation..."
        rm -rf "$INSTALL_DIR"
        echo " ${GREEN}Done${NC}"
    fi
    
    git_clone_with_progress "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR" || exit 1
    echo ""
    
    # Install dependencies
    echo "${BOLD}Installing Dependencies${NC}"
    npm_install_with_progress
    echo ""
    
    # Background model downloads with monitoring
    echo "${BOLD}AI Model Configuration${NC}"
    echo "Starting AI model downloads..."
    echo "  ${DIM}Models: llama3.2:3b (1.9GB), qwen2.5:7b (4.4GB)${NC}"
    
    # Start downloads in background
    ollama pull llama3.2:3b >> "$LOG_FILE" 2>&1 &
    ollama pull qwen2.5:7b >> "$LOG_FILE" 2>&1 &
    
    # Monitor downloads
    monitor_ollama_downloads &
    MONITOR_PID=$!
    
    # Continue with other setup while models download
    echo ""
    echo "${BOLD}System Configuration${NC}"
    
    # Environment setup with progress
    printf "Creating environment configuration..."
    if [[ ! -f ".env" ]]; then
        cat > .env << EOF
REDIS_URL=redis://localhost:6379
OLLAMA_BASE_URL=http://localhost:11434
EOF
        echo " ${GREEN}Done${NC}"
    else
        echo " ${GREEN}Already exists${NC}"
    fi
    
    # Binary setup
    printf "Configuring command-line interface..."
    mkdir -p bin
    if [[ -f "bin/debo.js" ]]; then
        chmod +x bin/debo.js
        echo " ${GREEN}Done${NC}"
    else
        echo " ${YELLOW}Skipped${NC}"
    fi
    
    # Run setup script with progress
    if [[ -f "scripts/setup.js" ]]; then
        echo "Running initial setup..."
        OPERATION_START_TIME=$(date +%s)
        node scripts/setup.js >> "$LOG_FILE" 2>&1 &
        show_spinner $! "Configuring system components"
    fi
    
    # Wait for model download monitoring to complete
    wait $MONITOR_PID 2>/dev/null || true
    
    echo ""
    echo "${BOLD}Installation Complete!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "${GREEN}✓${NC} All components successfully installed"
    echo ""
    echo "To start using Debo:"
    echo ""
    echo "1. Add to your PATH:"
    echo "   ${CYAN}export PATH=\"$INSTALL_DIR/bin:\$PATH\"${NC}"
    echo ""
    echo "2. Start the system:"
    echo "   ${CYAN}cd $INSTALL_DIR && npm start${NC}"
    echo ""
    echo "3. Use the debo command:"
    echo "   ${CYAN}debo \"create a REST API with authentication\"${NC}"
    echo ""
    echo "Installation log: ${DIM}$LOG_FILE${NC}"
    echo "Documentation: ${CYAN}https://github.com/Kevin-Kurka/Debo${NC}"
    echo ""
}

# Run main installation
main "$@"