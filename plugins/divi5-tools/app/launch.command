#!/bin/bash
# Divi 5 Generator — double-click this file to start

cd "$(dirname "$0")"

# Kill any existing instance on port 3747
lsof -ti:3747 | xargs kill -9 2>/dev/null
sleep 1

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies (first run only)..."
  npm install --silent
fi

# Start server in background
node server.js &
SERVER_PID=$!

# Wait for server to be ready
echo "Starting Divi 5 Generator..."
for i in {1..10}; do
  sleep 1
  if curl -s http://localhost:3747/prereqs > /dev/null 2>&1; then
    break
  fi
done

# Open browser
open http://localhost:3747

echo ""
echo "Divi 5 Generator is running at http://localhost:3747"
echo "Close this window to stop the server."
echo ""

# Keep terminal open and server alive until window is closed
wait $SERVER_PID
