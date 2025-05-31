#!/usr/bin/env node

import DependencyInstaller from '../src/dependency_installer.js';

const installer = new DependencyInstaller();

installer.checkAndInstallAll()
    .then((status) => {
        console.log('✅ Installation complete:', status);
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Installation failed:', error.message);
        process.exit(1);
    });
