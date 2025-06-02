#!/bin/bash

# Debo One-Liner Installer
# Professional, clean, with real-time feedback

set -euo pipefail

# Configuration
REPO_URL="https://github.com/Kevin-Kurka/Debo.git"
INSTALL_DIR="${DEBO_INSTALL_DIR:-$HOME/debo}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# Progress bar
show_progress() {
    local current=$1
    local total=$2
    local message=$3
    local width=50
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r[%*s%*s] %d%% %s" $filled '█' $empty '░' $percentage "$message"
}

# Clear status line
clear_line() {
    printf "\r%-80s\r" " "
}

# Print status
status() {
    clear_line
    echo "$1"
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

# System check
echo "System Analysis"
echo ""

# Quick prerequisite check
echo -n "Checking system requirements"
MISSING=()

printf "."
command -v git &>/dev/null || MISSING+=("git")

printf "."
command -v curl &>/dev/null || command -v wget &>/dev/null || MISSING+=("curl/wget")

printf "."
command -v node &>/dev/null || echo " (Node.js will be installed)"

echo " OK"

if [ ${#MISSING[@]} -gt 0 ]; then
    status "${RED}Error: Missing required tools: ${MISSING[*]}${NC}"
    echo ""
    echo "Please install missing tools and try again."
    exit 1
fi

status "System requirements verified"

# Check for existing installation
if [[ -d "$INSTALL_DIR" ]]; then
    echo ""
    echo "Existing Installation Found"
    echo ""
    status "Removing previous installation at $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR"
    status "Previous installation removed"
fi

# Download repository
echo ""
echo "Downloading Debo Repository"
echo ""

status "Connecting to GitHub..."

# Clone with real progress
git clone --progress "$REPO_URL" "$INSTALL_DIR" 2>&1 | {
    while IFS= read -r line; do
        if [[ "$line" =~ Counting\ objects:\ ([0-9]+) ]]; then
            status "Counting repository objects..."
        elif [[ "$line" =~ Receiving\ objects:\ +([0-9]+)%.*\(([0-9]+)/([0-9]+)\) ]]; then
            percent="${BASH_REMATCH[1]}"
            current="${BASH_REMATCH[2]}"
            total="${BASH_REMATCH[3]}"
            show_progress "$current" "$total" "Downloading files"
        elif [[ "$line" =~ Resolving\ deltas:\ +([0-9]+)%.*\(([0-9]+)/([0-9]+)\) ]]; then
            percent="${BASH_REMATCH[1]}"
            current="${BASH_REMATCH[2]}"
            total="${BASH_REMATCH[3]}"
            show_progress "$current" "$total" "Processing repository"
        elif [[ "$line" =~ "Cloning into" ]]; then
            status "Initializing repository..."
        fi
    done
    echo ""
}

if [ ! -d "$INSTALL_DIR" ]; then
    status "${RED}Error: Failed to download repository${NC}"
    exit 1
fi

status "Repository downloaded successfully"

# Change to install directory
cd "$INSTALL_DIR" || exit 1

# Setup
echo ""
echo "Initial Setup"
echo ""

# Make scripts executable
chmod +x install.sh scripts/*.sh scripts/*.js 2>/dev/null || true
status "Scripts configured"

# Verify structure
if [[ ! -f "package.json" ]]; then
    status "${RED}Error: Invalid repository structure${NC}"
    exit 1
fi

status "Repository structure verified"

# Launch main installer
echo ""
echo "Launching Full Installation"
echo ""
echo "The installer will:"
echo "  • Install Node.js and npm (if needed)"
echo "  • Set up Redis database"
echo "  • Install Ollama AI platform"
echo "  • Download AI models in background"
echo "  • Configure 54 business agents"
echo ""
echo "${DIM}Installation typically takes 5-10 minutes${NC}"
echo ""

# Execute main installer
exec ./install.sh