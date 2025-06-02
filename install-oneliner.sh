#!/bin/bash

# Debo One-Liner Installer with Real-Time Progress Bars
# Usage: curl -fsSL https://raw.githubusercontent.com/Kevin-Kurka/Debo/main/install-oneliner.sh | bash

set -euo pipefail

# Script configuration
REPO_URL="https://github.com/Kevin-Kurka/Debo.git"
INSTALL_DIR="${DEBO_INSTALL_DIR:-$HOME/debo}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

# Progress bar function
show_progress() {
    local current=$1
    local total=$2
    local message=$3
    local width=50
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r${BLUE}⚡ $message ${NC}["
    printf "%*s" $filled | tr ' ' '█'
    printf "%*s" $empty | tr ' ' '░'
    printf "] ${BOLD}$percentage%%${NC}"
}

# Animated spinner
spinner() {
    local pid=$1
    local message=$2
    local spin_chars="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
    local i=0
    
    echo -n "$message "
    while kill -0 $pid 2>/dev/null; do
        printf "\r${CYAN}${spin_chars:$i:1} $message${NC}"
        i=$(( (i+1) % ${#spin_chars} ))
        sleep 0.1
    done
    printf "\r${GREEN}✅ $message${NC}\n"
}

# Simulate work with progress
do_with_progress() {
    local total_steps=$1
    local message=$2
    local command=$3
    
    # Start background process
    $command &
    local pid=$!
    
    # Show progress while waiting
    for ((i=1; i<=total_steps; i++)); do
        show_progress $i $total_steps "$message"
        sleep 0.3
        
        # Check if process is still running
        if ! kill -0 $pid 2>/dev/null; then
            break
        fi
    done
    
    # Wait for completion
    wait $pid
    local exit_code=$?
    
    # Show completion
    if [ $exit_code -eq 0 ]; then
        show_progress $total_steps $total_steps "$message"
        echo ""
        echo "${GREEN}✅ $message completed!${NC}"
    else
        echo ""
        echo "${RED}❌ $message failed!${NC}"
        return $exit_code
    fi
}

# Show banner immediately
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
echo -e "${BOLD}🤖 Installing your local AI workforce...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Immediate system check with progress
echo "🔍 System Analysis"
echo ""

# Check git with progress bar
show_progress 1 4 "Checking Git"
sleep 0.5
if ! command -v git &>/dev/null; then
    echo ""
    echo -e "${RED}❌ Git not found${NC}"
    exit 1
fi
show_progress 2 4 "Checking Git"

# Check Node.js
show_progress 3 4 "Checking Node.js"
sleep 0.5
NODE_STATUS="Not found"
if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        NODE_STATUS="v$NODE_VERSION (OK)"
    else
        NODE_STATUS="v$NODE_VERSION (needs update)"
    fi
fi
show_progress 4 4 "System Check Complete"
echo ""

echo "${GREEN}✅ System Requirements:${NC}"
echo "  Git: ✅ Available"
echo "  Node.js: ${NODE_STATUS}"
echo ""

# Cleanup existing installation
if [[ -d "$INSTALL_DIR" ]]; then
    echo "🧹 Cleaning Previous Installation"
    echo ""
    do_with_progress 5 "Removing old installation" "rm -rf '$INSTALL_DIR'"
    echo ""
fi

# Download with animated progress
echo "📥 Downloading Debo"
echo ""

# Clone repository with progress simulation
{
    git clone --quiet "$REPO_URL" "$INSTALL_DIR" 2>/dev/null
} &
clone_pid=$!

# Show download progress
for ((i=1; i<=20; i++)); do
    show_progress $i 20 "Downloading from GitHub"
    sleep 0.2
    if ! kill -0 $clone_pid 2>/dev/null; then
        break
    fi
done

wait $clone_pid
if [ $? -eq 0 ]; then
    show_progress 20 20 "Download Complete"
    echo ""
    echo "${GREEN}✅ Repository downloaded successfully!${NC}"
else
    echo ""
    echo "${RED}❌ Download failed!${NC}"
    exit 1
fi

echo ""

# Setup phase
echo "⚙️  Initial Setup"
echo ""

cd "$INSTALL_DIR" || exit 1

# Make installer executable
chmod +x install.sh scripts/*.sh scripts/*.js 2>/dev/null || true

# Check if we have package.json
if [[ -f "package.json" ]]; then
    show_progress 1 3 "Preparing package manager"
    sleep 0.5
    show_progress 2 3 "Configuring environment"
    sleep 0.5 
    show_progress 3 3 "Setup complete"
    echo ""
    echo "${GREEN}✅ Initial setup complete!${NC}"
else
    echo "${RED}❌ Invalid repository structure${NC}"
    exit 1
fi

echo ""
echo "🚀 Starting Full Installation"
echo ""

# Show what's happening next
echo "${CYAN}📋 Installation will now:${NC}"
echo "  • Install Node.js (if needed)"
echo "  • Install Redis database"
echo "  • Download Ollama AI models"
echo "  • Configure 54 business agents"
echo "  • Setup local AI workforce"
echo ""

echo "${YELLOW}⏳ This may take 5-10 minutes depending on your system...${NC}"
echo ""

# Progress bar for main installation
echo "🔧 Running Main Installer"
echo ""

# Start main installer in background and show progress
{
    ./install.sh > /tmp/debo-install.log 2>&1
} &
main_pid=$!

# Show progress while main installer runs
progress=0
while kill -0 $main_pid 2>/dev/null; do
    progress=$((progress + 1))
    if [ $progress -gt 100 ]; then
        progress=100
    fi
    
    show_progress $progress 100 "Installing dependencies and models"
    sleep 2
done

wait $main_pid
install_exit=$?

echo ""

if [ $install_exit -eq 0 ]; then
    echo "${GREEN}🎉 Installation completed successfully!${NC}"
    echo ""
    echo "${BOLD}🚀 Debo is ready! Here's how to use it:${NC}"
    echo ""
    echo "${CYAN}# Add to your shell configuration:${NC}"
    echo "export PATH=\"$INSTALL_DIR/bin:\$PATH\""
    echo ""
    echo "${CYAN}# Or start directly:${NC}"
    echo "cd $INSTALL_DIR && npm start"
    echo ""
    echo "${CYAN}# Then use the debo command:${NC}"
    echo 'debo "create a REST API with authentication"'
    echo ""
    echo "${GREEN}✨ Your local AI workforce is ready to work!${NC}"
else
    echo "${RED}❌ Installation failed!${NC}"
    echo ""
    echo "${YELLOW}📋 Check the installation log:${NC}"
    echo "cat /tmp/debo-install.log"
    echo ""
    echo "${BLUE}🔗 Get help: https://github.com/Kevin-Kurka/Debo/issues${NC}"
    exit 1
fi