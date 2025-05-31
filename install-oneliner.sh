#!/bin/bash

# Debo One-Liner Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/your-username/debo/main/install-oneliner.sh | bash
# or: wget -qO- https://raw.githubusercontent.com/your-username/debo/main/install-oneliner.sh | bash

set -euo pipefail

# Script configuration
REPO_URL="https://github.com/your-username/debo.git"
INSTALL_SCRIPT_URL="https://raw.githubusercontent.com/your-username/debo/main/install.sh"
INSTALL_DIR="${DEBO_INSTALL_DIR:-$HOME/debo}"
TEMP_INSTALLER="/tmp/debo-installer-$$.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Show quick banner
echo -e "${CYAN}${BOLD}Debo Installer${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Error handler
handle_error() {
    echo -e "\n${RED}❌ Installation failed${NC}"
    echo -e "${YELLOW}💡 Try these alternatives:${NC}"
    echo ""
    echo "1. Clone and install manually:"
    echo "   git clone $REPO_URL"
    echo "   cd debo"
    echo "   ./install.sh"
    echo ""
    echo "2. Download installer directly:"
    echo "   curl -fsSL $INSTALL_SCRIPT_URL -o install.sh"
    echo "   chmod +x install.sh"
    echo "   ./install.sh"
    echo ""
    echo "3. Get help:"
    echo "   https://github.com/your-username/debo/issues"
    
    # Cleanup
    rm -f "$TEMP_INSTALLER"
    exit 1
}

# Set error trap
trap handle_error ERR

# Check prerequisites
check_prerequisites() {
    local missing=()
    
    # Check for curl or wget
    if ! command -v curl &>/dev/null && ! command -v wget &>/dev/null; then
        missing+=("curl or wget")
    fi
    
    # Check for git
    if ! command -v git &>/dev/null; then
        missing+=("git")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}Missing required tools: ${missing[*]}${NC}"
        echo ""
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "Install with Homebrew:"
            echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo "  brew install ${missing[*]}"
        elif [[ -f /etc/debian_version ]]; then
            echo "Install with apt:"
            echo "  sudo apt update && sudo apt install -y ${missing[*]}"
        elif [[ -f /etc/redhat-release ]]; then
            echo "Install with yum:"
            echo "  sudo yum install -y ${missing[*]}"
        fi
        
        exit 1
    fi
}

# Download installer
download_installer() {
    echo -e "${BLUE}📥 Downloading Debo installer...${NC}"
    
    if command -v curl &>/dev/null; then
        if curl -fsSL "$INSTALL_SCRIPT_URL" -o "$TEMP_INSTALLER"; then
            return 0
        fi
    fi
    
    if command -v wget &>/dev/null; then
        if wget -qO "$TEMP_INSTALLER" "$INSTALL_SCRIPT_URL"; then
            return 0
        fi
    fi
    
    return 1
}

# Main installation
main() {
    # Check prerequisites
    check_prerequisites
    
    # Try to detect if we should clone first
    if [[ -t 0 ]] && [[ ! -f "./install.sh" ]]; then
        # Running interactively and not in Debo directory
        echo -e "${BLUE}📦 Installing Debo...${NC}"
        echo ""
        
        # Option 1: Try to download and run the installer
        if download_installer; then
            chmod +x "$TEMP_INSTALLER"
            echo -e "${GREEN}✅ Installer downloaded${NC}"
            echo ""
            
            # Run the installer
            exec bash "$TEMP_INSTALLER"
        else
            # Option 2: Clone the repository
            echo -e "${YELLOW}⚠️  Direct download failed, cloning repository...${NC}"
            
            if [[ -d "$INSTALL_DIR" ]]; then
                echo -e "${YELLOW}Found existing installation at $INSTALL_DIR${NC}"
                read -p "Remove and reinstall? (y/N) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    rm -rf "$INSTALL_DIR"
                else
                    echo "Installation cancelled"
                    exit 0
                fi
            fi
            
            # Clone repository
            if git clone "$REPO_URL" "$INSTALL_DIR"; then
                echo -e "${GREEN}✅ Repository cloned${NC}"
                cd "$INSTALL_DIR"
                
                # Run installer from repository
                if [[ -f "./install.sh" ]]; then
                    chmod +x ./install.sh
                    exec ./install.sh
                else
                    echo -e "${RED}❌ Installer not found in repository${NC}"
                    exit 1
                fi
            else
                echo -e "${RED}❌ Failed to clone repository${NC}"
                exit 1
            fi
        fi
    else
        # Being piped or already in directory
        if download_installer; then
            chmod +x "$TEMP_INSTALLER"
            exec bash "$TEMP_INSTALLER"
        else
            echo -e "${RED}❌ Failed to download installer${NC}"
            exit 1
        fi
    fi
}

# Run main
main "$@"