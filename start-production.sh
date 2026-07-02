#!/bin/bash
# SwiftSite Production Server
# Builds the editor with /editor/ base path and starts the unified server on port 3000

set -e

cd "$(dirname "$0")"

echo "=== Building editor with /editor/ base path ==="
npx vite build --base=/editor/

echo "=== Starting production server on port 3000 ==="
echo "Stopping any existing server..."
kill $(lsof -t -i :3000) 2>/dev/null || true
sleep 1

exec node server/production-server.cjs