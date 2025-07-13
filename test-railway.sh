#!/bin/bash

echo "🚀 Testing Railway Deployment"
echo "================================"

# You need to replace this with your actual Railway URL
# Look in your Railway dashboard for the exact URL
RAILWAY_URL="https://your-actual-railway-url.railway.app"

echo "📡 Testing Railway URL: $RAILWAY_URL"
echo ""

echo "⚠️  REPLACE THE URL ABOVE WITH YOUR ACTUAL RAILWAY URL!"
echo "   Go to railway.app dashboard → your project → copy the domain"
echo ""

echo "🔍 Test 1: Health Check"
echo "Command: curl $RAILWAY_URL/api/health"
echo ""

echo "🏨 Test 2: Hotel Default Location"
echo "Command: curl -I $RAILWAY_URL/"
echo ""

echo "📱 Test 3: Generate Hotel QR Code"
echo "Command:"
echo "curl -X POST $RAILWAY_URL/api/generate-hotel-qr \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{}' \\"
echo "  > hotel-qr-production.json"
echo ""

echo "🗺️ Test 4: Test Places Search"
echo "Command:"
echo "curl -X POST $RAILWAY_URL/api/search-nearby \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"latitude\":21.034087,\"longitude\":105.85114,\"radius\":1000}'"
echo ""

echo "📱 Test 5: Manual Test"
echo "1. Open: $RAILWAY_URL in your browser"
echo "2. Should automatically use your hotel location (118 Hang Bac)"
echo "3. Select distance → Search places → Check photos and directions work"
echo ""

echo "🎯 Expected Results:"
echo "✅ Health check returns success: true"
echo "✅ Main page loads without asking for location"
echo "✅ QR generation returns base64 image data"
echo "✅ Places search returns restaurants, landmarks, coffee, culture"
echo "✅ Photos display correctly"
echo "✅ Directions open Google Maps"