#!/bin/bash

# Script to generate production QR code for your hotel
# Replace YOUR_RAILWAY_URL with your actual Railway deployment URL

echo "🏨 Generating Production QR Code for Old Quarter Hotel"
echo "📍 Location: 118 Hang Bac, Hanoi (21.034087, 105.85114)"
echo ""

# Replace this URL with your actual Railway deployment URL
RAILWAY_URL="https://nearbyspots-qr-production-XXXX.railway.app"

echo "⚠️  IMPORTANT: Replace YOUR_RAILWAY_URL in this script with your actual Railway URL!"
echo "   Example: https://nearbyspots-qr-production-a1b2.railway.app"
echo ""
echo "Once you have your Railway URL, run:"
echo ""
echo "curl -X POST $RAILWAY_URL/api/generate-hotel-qr \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{}' \\"
echo "  | jq '.qrCode' -r \\"
echo "  | sed 's/data:image\/png;base64,//' \\"
echo "  | base64 -d > hotel-qr-production.png"
echo ""
echo "This will save your production QR code as 'hotel-qr-production.png'"
echo ""
echo "📱 Test the QR code by scanning it with your phone!"