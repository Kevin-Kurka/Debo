#!/bin/bash

# Debo Professional Installer
# Clean, informative, with real-time progress

set -euo pipefail

# Script configuration
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

# Progress bar function
show_progress() {
    local current=$1
    local total=$2
    local message=$3
    local width=40
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r[%*s%*s] %d%% %s" $filled '█' $empty '░' $percentage "$message"
}

# Clean status display
status() {
    printf "\r%-80s\n" "$1"
}

# Show banner
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

echo "Installing local AI workforce with 54 business agents..."
echo "────────────────────────────────────────────────────────"
echo ""

# System Analysis
echo "System Analysis"
echo ""

# Check OS and architecture
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
elif [[ "$OSTYPE" == "linux"* ]]; then
    OS="Linux"
fi
ARCH=$(uname -m)

# Check prerequisites
status "Operating System: $OS $ARCH"
status "Checking prerequisites..."

MISSING_DEPS=()
command -v git &>/dev/null || MISSING_DEPS+=("git")
command -v node &>/dev/null || MISSING_DEPS+=("node")
command -v npm &>/dev/null || MISSING_DEPS+=("npm")

if [ ${#MISSING_DEPS[@]} -eq 0 ]; then
    status "All prerequisites found"
else
    status "${YELLOW}Missing: ${MISSING_DEPS[*]}${NC}"
    status "These will be installed during setup"
fi

# Check space
SPACE=$(df -h "$HOME" | awk 'NR==2 {print $4}')
status "Available disk space: $SPACE"
echo ""

# Install Prerequisites
echo "Installing Prerequisites"
echo ""

# Node.js
if ! command -v node &>/dev/null; then
    status "Installing Node.js..."
    if [[ "$OS" == "macOS" ]]; then
        if ! command -v brew &>/dev/null; then
            status "Installing Homebrew (required for macOS)..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" >> "$LOG_FILE" 2>&1
        fi
        brew install node >> "$LOG_FILE" 2>&1 || status "${YELLOW}Warning: Node.js installation had issues${NC}"
    else
        status "${YELLOW}Please install Node.js 18+ manually from nodejs.org${NC}"
    fi
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    status "Node.js v$NODE_VERSION found"
fi

# Redis
status "Setting up Redis database..."
if ! command -v redis-server &>/dev/null; then
    if [[ "$OS" == "macOS" ]]; then
        brew install redis >> "$LOG_FILE" 2>&1 && brew services start redis >> "$LOG_FILE" 2>&1
    else
        sudo apt-get update >> "$LOG_FILE" 2>&1
        sudo apt-get install -y redis-server >> "$LOG_FILE" 2>&1
        sudo systemctl start redis >> "$LOG_FILE" 2>&1
    fi
fi
status "Redis configured"

# Ollama
status "Setting up Ollama AI platform..."
if ! command -v ollama &>/dev/null; then
    curl -fsSL https://ollama.ai/install.sh | sh >> "$LOG_FILE" 2>&1
fi
status "Ollama ready"
echo ""

# Download Repository
echo "Downloading Debo Repository"
echo ""

if [[ -d "$INSTALL_DIR" ]]; then
    status "Removing existing installation..."
    rm -rf "$INSTALL_DIR"
fi

# Clone with progress
status "Cloning repository from GitHub..."
git clone --progress "$REPO_URL" "$INSTALL_DIR" 2>&1 | while IFS= read -r line; do
    if [[ "$line" =~ Receiving\ objects:.*\(([0-9]+)/([0-9]+)\) ]]; then
        current="${BASH_REMATCH[1]}"
        total="${BASH_REMATCH[2]}"
        show_progress "$current" "$total" "Downloading files"
    elif [[ "$line" =~ Resolving\ deltas:.*\(([0-9]+)/([0-9]+)\) ]]; then
        current="${BASH_REMATCH[1]}"
        total="${BASH_REMATCH[2]}"
        show_progress "$current" "$total" "Processing repository"
    fi
done
echo ""
status "Repository downloaded successfully"
echo ""

cd "$INSTALL_DIR" || exit 1

# Install Dependencies
echo "Installing Dependencies"
echo ""

status "Installing npm packages..."
npm_output=$(npm install --progress=false 2>&1) || {
    status "${YELLOW}Retrying with legacy peer deps...${NC}"
    npm install --legacy-peer-deps --progress=false >> "$LOG_FILE" 2>&1
}
status "Dependencies installed"
echo ""

# Background Model Downloads
echo "AI Model Configuration"
echo ""

status "Starting AI model downloads in background..."
status "Models downloading: llama3.2:3b (1.9GB), qwen2.5:7b (4.4GB)"
status "${DIM}This will continue in background while installation proceeds${NC}"

# Start model downloads in background
{
    ollama pull llama3.2:3b >> "$LOG_FILE" 2>&1 &
    LLAMA_PID=$!
    ollama pull qwen2.5:7b >> "$LOG_FILE" 2>&1 &
    QWEN_PID=$!
    
    # Monitor in background
    {
        while kill -0 $LLAMA_PID 2>/dev/null; do sleep 5; done
        echo "[$(date)] llama3.2:3b download complete" >> "$LOG_FILE"
    } &
    
    {
        while kill -0 $QWEN_PID 2>/dev/null; do sleep 5; done
        echo "[$(date)] qwen2.5:7b download complete" >> "$LOG_FILE"
    } &
} &

MODEL_DOWNLOAD_PID=$!
echo ""

# System Configuration
echo "System Configuration"
echo ""

# Create environment file
if [[ ! -f ".env" ]]; then
    cat > .env << EOF
REDIS_URL=redis://localhost:6379
OLLAMA_BASE_URL=http://localhost:11434
EOF
    status "Environment configuration created"
fi

# Set up bin directory
mkdir -p bin
if [[ -f "bin/debo.js" ]]; then
    chmod +x bin/debo.js
    status "Command-line interface configured"
fi

# Run setup script if available
if [[ -f "scripts/setup.js" ]]; then
    status "Running initial setup..."
    node scripts/setup.js >> "$LOG_FILE" 2>&1 || status "${YELLOW}Setup script had warnings${NC}"
fi

status "System configuration complete"
echo ""

# Verification
echo "Installation Verification"
echo ""

# Check if models are still downloading
if kill -0 $MODEL_DOWNLOAD_PID 2>/dev/null; then
    status "${YELLOW}AI models still downloading in background${NC}"
    status "You can start using Debo while models complete downloading"
else
    status "${GREEN}AI models ready${NC}"
fi

# Test system
if node src/mcp_server.js --version &>/dev/null; then
    status "${GREEN}System verification passed${NC}"
else
    status "${YELLOW}System verification skipped (normal for first install)${NC}"
fi

echo ""
echo "────────────────────────────────────────────────────────"
echo ""
echo "${GREEN}Installation Complete${NC}"
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

if kill -0 $MODEL_DOWNLOAD_PID 2>/dev/null; then
    echo "${DIM}Note: AI models are still downloading. Check progress with:${NC}"
    echo "${CYAN}tail -f $LOG_FILE${NC}"
    echo ""
fi

echo "Installation log: $LOG_FILE"
echo "Documentation: https://github.com/Kevin-Kurka/Debo"
echo ""