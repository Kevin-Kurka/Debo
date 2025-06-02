#!/bin/bash

# Debo One-Liner Installer with Real-Time Feedback
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
NC='\033[0m'
BOLD='\033[1m'

# Show banner immediately
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

# Progress indicator
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    echo -n "⏳ $2 "
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf "[%c]" "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b"
    done
    echo -e "✅ Done!"
}

# Error handler with immediate feedback
handle_error() {
    echo ""
    echo -e "${RED}❌ Installation failed at step: $1${NC}"
    echo ""
    echo -e "${YELLOW}📋 Quick troubleshooting:${NC}"
    echo "• Check internet connection"
    echo "• Ensure you have git installed"
    echo "• Try running with: bash -x install-oneliner.sh"
    echo ""
    echo -e "${BLUE}🔗 Get help: https://github.com/Kevin-Kurka/Debo/issues${NC}"
    exit 1
}

# Immediate prerequisite check
echo "🔍 Checking system requirements..."
sleep 0.5

# Check git
if ! command -v git &>/dev/null; then
    echo -e "${RED}❌ Git not found${NC}"
    echo ""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Install git with: brew install git"
    elif [[ -f /etc/debian_version ]]; then
        echo "Install git with: sudo apt install git"
    else
        echo "Please install git and try again"
    fi
    exit 1
fi
echo "✅ Git found"

# Check Node.js
if ! command -v node &>/dev/null; then
    echo "⚠️  Node.js not found (will be installed later)"
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo "✅ Node.js $NODE_VERSION found"
    else
        echo "⚠️  Node.js version too old (will be updated)"
    fi
fi

echo ""

# Remove existing installation if found
if [[ -d "$INSTALL_DIR" ]]; then
    echo -e "${YELLOW}📂 Found existing Debo installation${NC}"
    echo "Removing old installation..."
    rm -rf "$INSTALL_DIR"
    echo "✅ Cleaned up"
    echo ""
fi

# Clone repository with immediate feedback
echo "📥 Downloading Debo from GitHub..."
if git clone --quiet "$REPO_URL" "$INSTALL_DIR" 2>/dev/null; then
    echo "✅ Repository downloaded"
else
    handle_error "Repository download"
fi

# Change to install directory
cd "$INSTALL_DIR" || handle_error "Directory access"

# Make installer executable
chmod +x install.sh

echo ""
echo -e "${GREEN}🚀 Starting Debo installation...${NC}"
echo ""

# Run the main installer with immediate execution
exec ./install.sh