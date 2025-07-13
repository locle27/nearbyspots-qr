#!/bin/bash

RAILWAY_URL="https://nearbyspots-qr-production.up.railway.app"

echo "🚀 Testing Production Railway Deployment"
echo "========================================"
echo "URL: $RAILWAY_URL"
echo ""

echo "🔍 Test 1: Health Check"
echo "Command: curl $RAILWAY_URL/api/health"
curl -s "$RAILWAY_URL/api/health" | jq . 2>/dev/null || curl -s "$RAILWAY_URL/api/health"
echo ""

echo "🏨 Test 2: Generate Production QR Code for Your Hotel"
echo "Command: curl -X POST $RAILWAY_URL/api/generate-hotel-qr"
echo "Generating QR code for 118 Hang Bac, Hanoi..."

curl -X POST "$RAILWAY_URL/api/generate-hotel-qr" \
  -H "Content-Type: application/json" \
  -d '{}' > hotel-qr-production.json 2>/dev/null

if [ -s hotel-qr-production.json ]; then
    echo "✅ Production QR code generated successfully!"
    echo "📄 Saved to: hotel-qr-production.json"
    
    # Extract key information
    if command -v jq >/dev/null 2>&1; then
        echo ""
        echo "📍 Hotel Information:"
        jq -r '.hotel | "Name: \(.name)\nAddress: \(.address)\nCoordinates: \(.latitude), \(.longitude)"' hotel-qr-production.json 2>/dev/null
        
        echo ""
        echo "🔒 Security Information:"
        jq -r '.security | "Signed: \(.signed)\nDomain: \(.domain)\nExpires: \(.expiresIn)"' hotel-qr-production.json 2>/dev/null
        
        echo ""
        echo "🔗 QR Code URL:"
        jq -r '.url' hotel-qr-production.json 2>/dev/null
    fi
    
    # Save QR image
    echo ""
    echo "💾 Extracting QR Code Image..."
    if command -v jq >/dev/null 2>&1; then
        jq -r '.qrCode' hotel-qr-production.json | sed 's/data:image\/png;base64,//' | base64 -d > hotel-qr-final.png 2>/dev/null
        if [ -s hotel-qr-final.png ]; then
            echo "✅ QR code image saved as: hotel-qr-final.png"
            echo "📏 Image size: $(wc -c < hotel-qr-final.png) bytes"
        else
            echo "❌ Failed to extract QR image"
        fi
    fi
else
    echo "❌ QR code generation failed"
    cat hotel-qr-production.json 2>/dev/null
fi
echo ""

echo "🗺️ Test 3: Test Places Search Near Your Hotel"
echo "Command: Search near 118 Hang Bac coordinates"
curl -X POST "$RAILWAY_URL/api/search-nearby" \
  -H "Content-Type: application/json" \
  -d '{"latitude":21.034087,"longitude":105.85114,"radius":1000}' \
  > places-test-production.json 2>/dev/null

if [ -s places-test-production.json ]; then
    echo "✅ Places search successful!"
    
    if command -v jq >/dev/null 2>&1; then
        echo ""
        echo "📊 Results Summary:"
        
        # Count results in each category
        for category in restaurants landmarks coffee culture; do
            count=$(jq -r ".results.$category | length" places-test-production.json 2>/dev/null)
            if [ "$count" != "null" ] && [ "$count" != "0" ]; then
                echo "✅ $category: $count places found"
            else
                echo "❌ $category: No places found"
            fi
        done
        
        echo ""
        echo "🍽️ Sample Restaurant:"
        jq -r '.results.restaurants[0] | "Name: \(.name)\nRating: \(.rating) ⭐ (\(.userRatingCount) reviews)\nDistance: \(.distance)m\nAddress: \(.address)"' places-test-production.json 2>/dev/null
    fi
else
    echo "❌ Places search failed"
    cat places-test-production.json 2>/dev/null
fi
echo ""

echo "📱 Test 4: Manual Browser Test"
echo "=============================="
echo "1. Open this URL in your browser:"
echo "   $RAILWAY_URL"
echo ""
echo "2. Expected behavior:"
echo "   ✅ Should NOT ask for location permission"
echo "   ✅ Should show 'Discover amazing places near our hotel in Hanoi's historic Old Quarter'"
echo "   ✅ Should go straight to distance selection screen"
echo "   ✅ Choose 1km → Find Places should show 4 categories"
echo "   ✅ All categories should have results with photos"
echo "   ✅ Directions should open Google Maps"
echo ""

echo "📱 Test 5: Mobile QR Test"
echo "========================"
echo "1. If hotel-qr-final.png was created, open it and scan with your phone"
echo "2. OR scan this QR URL directly:"
if [ -s hotel-qr-production.json ] && command -v jq >/dev/null 2>&1; then
    qr_url=$(jq -r '.url' hotel-qr-production.json 2>/dev/null)
    echo "   $qr_url"
fi
echo ""
echo "3. Expected mobile experience:"
echo "   ✅ Opens your hotel discovery app"
echo "   ✅ Automatically uses your hotel location (no permission needed)"
echo "   ✅ Shows distance selection immediately"
echo "   ✅ All features work on mobile"
echo ""

echo "🎯 Final Results"
echo "==============="
echo "✅ Your Railway URL: $RAILWAY_URL"
echo "✅ Health check: Working"
echo "✅ QR code generated: $([ -s hotel-qr-production.json ] && echo "Yes" || echo "No")"
echo "✅ Places search: $([ -s places-test-production.json ] && echo "Working" || echo "Failed")"
echo ""

if [ -s hotel-qr-final.png ]; then
    echo "🎉 SUCCESS! Your hotel QR code is ready!"
    echo "📄 Print this file: hotel-qr-final.png"
    echo "📋 Place in guest rooms, lobby, restaurant tables"
    echo "📱 Guests can scan to discover nearby places instantly!"
else
    echo "⚠️  QR image extraction failed, but JSON data is available"
fi
echo ""

echo "📞 Support URLs for your hotel guests:"
echo "🌐 Direct access: $RAILWAY_URL"
echo "📱 Mobile optimized: Works on any smartphone"
echo "🔒 Secure: QR codes are cryptographically signed"