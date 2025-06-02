#!/bin/bash

# Debo Fortune 500 Business System Startup Script
# "That's my company now, punk!"

echo "
██████╗ ███████╗██████╗  ██████╗     ██████╗  ██████╗ 
██╔══██╗██╔════╝██╔══██╗██╔═══██╗   ██╔════╝ ██╔═████╗
██║  ██║█████╗  ██████╔╝██║   ██║   █████╗   ██║██╔██║
██║  ██║██╔══╝  ██╔══██╗██║   ██║   ██╔══╝   ████╔╝██║
██████╔╝███████╗██████╔╝╚██████╔╝   ███████╗ ╚██████╔╝
╚═════╝ ╚══════╝╚═════╝  ╚═════╝    ╚══════╝  ╚═════╝ 

Fortune 500 Enterprise AI System - v3.0
\"I'm the CEO now. And the CFO. And the whole damn company!\"
"

# Check if Redis is running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "🚀 Starting Redis..."
    redis-server --daemonize yes
fi

# Check if Ollama is running
if ! pgrep -x "ollama" > /dev/null; then
    echo "🤖 Starting Ollama..."
    ollama serve > /dev/null 2>&1 &
    sleep 2
fi

echo "✅ Starting Debo Generic System..."
echo ""
echo "Available command:"
echo "  debo \"your request\"      - Natural language for EVERYTHING"
echo ""
echo "Business Examples:"
echo "  debo \"prepare Q4 financial forecast\""
echo "  debo \"create employee retention strategy\""
echo "  debo \"analyze competitive landscape\""
echo "  debo \"optimize supply chain costs\""
echo "  debo \"ensure GDPR compliance\""
echo ""
echo "📖 Business docs: ./BUSINESS-SYSTEM-README.md"
echo "📊 54 specialized agents across 8 departments"
echo "🏢 Complete Fortune 500 company structure"
echo ""

# Start the generic server
npm run start:generic