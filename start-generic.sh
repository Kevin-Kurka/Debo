#!/bin/bash

# Debo Generic System Startup Script
# "That's my AI system, punk!"

echo "
██████╗ ███████╗██████╗  ██████╗     ██████╗  ██████╗ 
██╔══██╗██╔════╝██╔══██╗██╔═══██╗   ██╔════╝ ██╔═████╗
██║  ██║█████╗  ██████╔╝██║   ██║   █████╗   ██║██╔██║
██║  ██║██╔══╝  ██╔══██╗██║   ██║   ██╔══╝   ████╔╝██║
██████╔╝███████╗██████╔╝╚██████╔╝   ███████╗ ╚██████╔╝
╚═════╝ ╚══════╝╚═════╝  ╚═════╝    ╚══════╝  ╚═════╝ 

Generic AI System - v3.0
\"What domain? ANY DOMAIN, PUNK!\"
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
echo "Available commands:"
echo "  debo \"your request\"        - Main tool for any task"
echo "  debo_dialogue             - Continue conversations"
echo "  debo_query               - Query knowledge/data"
echo ""
echo "Examples:"
echo "  debo \"create a legal discovery agent\""
echo "  debo \"design a scientific experiment\""
echo "  debo \"automate business workflow\""
echo ""
echo "📖 Full docs: ./GENERIC-SYSTEM-README.md"
echo ""

# Start the generic server
npm run start:generic