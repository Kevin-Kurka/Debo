#!/bin/bash
echo "Restarting DBot..."

# Kill existing processes
pkill -f "node.*mcp_server" 2>/dev/null
# No menubar to kill

# Wait for cleanup
sleep 2

# Start MCP server
cd $HOME/debo
node src/mcp_server.js &

# Terminal-only interface - no menubar

echo "DBot restarted"
