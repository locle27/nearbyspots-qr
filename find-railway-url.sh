#!/bin/bash

echo "🔍 Finding Your Railway URL"
echo "=========================="
echo ""

echo "Your Railway deployment is live, but we need to find the correct URL."
echo ""

echo "🎯 Possible URLs to try:"
echo ""

# Common Railway URL patterns
PROJECT_ID="0e5fd9d9-db6f-459d-a5f2-c4cfe5a32fd6"
SERVICE_ID="dd958631-75d5-41d9-8c9e-115ff26b1add"

# Try different URL patterns
URLS=(
    "https://nearbyspots-qr-production.railway.app"
    "https://nearbyspots-qr.railway.app"
    "https://web-production-${SERVICE_ID:0:8}.railway.app"
    "https://production-${SERVICE_ID:0:8}.railway.app"
    "https://${SERVICE_ID}.railway.app"
    "https://nearbyspots-qr-production-${SERVICE_ID:0:8}.railway.app"
)

echo "Testing these URLs:"
for url in "${URLS[@]}"; do
    echo "🌐 $url"
done

echo ""
echo "📱 Manual Check:"
echo "1. Go to your Railway dashboard"
echo "2. Click on your 'nearbyspots-qr' project"
echo "3. Look for 'Settings' → 'Domains' section"
echo "4. Or look for a 'View Live' or 'Open App' button"
echo ""

echo "🧪 Test each URL by opening in browser:"
echo "- Should show your hotel discovery app"
echo "- Should NOT show Railway ASCII art"
echo "- Should go straight to distance selection (no location permission)"
echo ""

echo "✅ Once you find the working URL, let me know and I'll:"
echo "- Generate your production QR code"
echo "- Create final testing commands"
echo "- Help you create printable QR materials"