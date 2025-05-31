#!/bin/bash
set -e

echo "🚀 DBot Smart Installer Starting..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run from the dbot project directory"
    exit 1
fi

# Run the dependency installer
echo "📦 Installing dependencies..."
node -e "
import DependencyInstaller from './src/dependency_installer.js';
const installer = new DependencyInstaller();
installer.checkAndInstallAll()
    .then(() => console.log('✅ Installation complete'))
    .catch(err => { console.error('❌ Installation failed:', err); process.exit(1); });
"

echo "🎉 DBot installation complete!"
echo "Run 'npm start' to launch DBot"
