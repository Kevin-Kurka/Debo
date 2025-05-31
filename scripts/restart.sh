#!/bin/bash
echo "Restarting DBot..."

# Kill existing processes
pkill -f "node.*mcp_server" 2>/dev/null
pkill -f "menubar" 2>/dev/null

# Wait for cleanup
sleep 2

# Start MCP server
cd $HOME/debo
node src/mcp_server.js &

# Start menubar
npm run menubar &

echo "DBot restarted"
