#!/bin/bash

# Your Railway URL - REPLACE THIS with your actual Railway URL from the dashboard
RAILWAY_URL="https://REPLACE-WITH-YOUR-RAILWAY-URL.railway.app"

echo "🚀 Testing Live Railway Deployment"
echo "=================================="
echo "URL: $RAILWAY_URL"
echo ""

echo "🔍 Test 1: Health Check"
echo "Running: curl $RAILWAY_URL/api/health"
curl -s "$RAILWAY_URL/api/health" | jq . || echo "❌ Health check failed"
echo ""

echo "🏨 Test 2: Test Hotel Default Location"  
echo "Running: curl -I $RAILWAY_URL/"
curl -I "$RAILWAY_URL/" 2>/dev/null | head -1 || echo "❌ Main page failed"
echo ""

echo "📱 Test 3: Generate Production QR Code"
echo "Running: curl -X POST $RAILWAY_URL/api/generate-hotel-qr"
curl -X POST "$RAILWAY_URL/api/generate-hotel-qr" \
  -H "Content-Type: application/json" \
  -d '{}' > production-qr.json 2>/dev/null

if [ -s production-qr.json ]; then
    echo "✅ QR code generated successfully!"
    echo "📄 Saved to: production-qr.json"
    
    # Check if it contains expected data
    if grep -q "qrCode" production-qr.json; then
        echo "✅ QR code contains image data"
    else
        echo "❌ QR code data missing"
    fi
    
    if grep -q "118 Hang Bac" production-qr.json; then
        echo "✅ Hotel address found in QR data"
    else
        echo "❌ Hotel address missing"
    fi
else
    echo "❌ QR code generation failed"
fi
echo ""

echo "🗺️ Test 4: Test Places Search Near Hotel"
echo "Running: Places search for 118 Hang Bac coordinates"
curl -X POST "$RAILWAY_URL/api/search-nearby" \
  -H "Content-Type: application/json" \
  -d '{"latitude":21.034087,"longitude":105.85114,"radius":1000}' \
  > places-test.json 2>/dev/null

if [ -s places-test.json ]; then
    echo "✅ Places search successful!"
    
    # Check for each category
    if grep -q "restaurants" places-test.json; then
        echo "✅ Found restaurants"
    else
        echo "❌ No restaurants found"
    fi
    
    if grep -q "landmarks" places-test.json; then
        echo "✅ Found landmarks"  
    else
        echo "❌ No landmarks found"
    fi
    
    if grep -q "coffee" places-test.json; then
        echo "✅ Found coffee shops"
    else
        echo "❌ No coffee shops found"
    fi
else
    echo "❌ Places search failed"
fi
echo ""

echo "📱 Test 5: Manual Browser Test"
echo "================================"
echo "1. Open this URL in your browser:"
echo "   $RAILWAY_URL"
echo ""
echo "2. Expected behavior:"
echo "   ✅ Should NOT ask for location permission"
echo "   ✅ Should show 'Discover amazing places near our hotel'"
echo "   ✅ Should go straight to distance selection"
echo "   ✅ Choose 1km → Find Places should show 4 categories"
echo "   ✅ All categories should have results with photos"
echo "   ✅ Directions should open Google Maps"
echo ""
echo "📱 Test 6: Mobile Test"
echo "====================="
echo "1. Open this URL on your PHONE:"
echo "   $RAILWAY_URL"
echo ""
echo "2. Test the user experience as a hotel guest would"
echo ""

echo "🎯 Final Step: Create Your Hotel QR Code"
echo "========================================"
echo "If all tests pass, extract the QR code image:"
echo ""
echo "cat production-qr.json | jq -r '.qrCode' | sed 's/data:image\/png;base64,//' | base64 -d > hotel-qr-final.png"
echo ""
echo "Then print hotel-qr-final.png and place it in guest rooms!"
echo ""

echo "🔗 Your Live URL: $RAILWAY_URL"