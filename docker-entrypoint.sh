#!/bin/bash
set -e

echo "🚀 Railway Docker Entrypoint Starting..."
echo "Raw PORT value: '$PORT'"
echo "Environment variables:"
env | grep PORT || echo "No PORT environment variables found"

# Set default port if PORT is empty, null, or invalid
if [ -z "$PORT" ] || [ "$PORT" = "null" ] || [ "$PORT" = "" ]; then
    echo "⚠️ PORT is empty/null, setting to 3000"
    export PORT=3000
fi

# Validate PORT is numeric
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
    echo "❌ PORT '$PORT' is not numeric, setting to 3000"
    export PORT=3000
fi

echo "✅ Using PORT: $PORT"
echo "Starting Node.js server on 0.0.0.0:$PORT"

# Start Node.js application
exec node server.js