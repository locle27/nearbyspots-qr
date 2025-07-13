# 🏨 Your Hotel QR System - Complete Setup

## ✅ **Your Hotel is Now Configured as Default!**

**📍 Your Location**: 118 Hang Bac, Hoan Kiem, Hanoi, Vietnam  
**🎯 Coordinates**: 21.034087, 105.85114  
**🏨 Hotel Name**: "Old Quarter Hotel"

## 🎯 **How It Works Now**

### **For Your Current Hotel (118 Hang Bac):**
1. **🔗 Direct access**: `http://localhost:3000` → Automatically uses your hotel location
2. **📱 No coordinates needed**: Guests skip location permission screen
3. **🎯 Instant discovery**: Goes straight to radius selection → find places
4. **🏨 Hotel branding**: Shows "Discover amazing places near our hotel"

### **For Additional Hotels (Future Expansion):**
Your system now supports multiple hotel locations easily!

## 🚀 **Generate QR Codes for Your Hotel**

### **Method 1: Default Hotel QR (Recommended)**
```bash
# This uses your 118 Hang Bac location automatically
curl -X POST http://localhost:3000/api/generate-hotel-qr \
  -H "Content-Type: application/json" \
  -d '{}'
```

### **Method 2: Custom Location QR (For Other Hotels)**
```bash
# For a different hotel location
curl -X POST http://localhost:3000/api/generate-hotel-qr \
  -H "Content-Type: application/json" \
  -d '{
    "customLocation": {
      "name": "Your Second Hotel Name",
      "latitude": 10.7769,
      "longitude": 106.7009,
      "address": "Ho Chi Minh City, Vietnam"
    }
  }'
```

## 📱 **Guest Experience at Your Hotel**

### **What Happens When Guests Scan Your QR:**

1. **📱 Scan QR Code** → Opens mobile web app
2. **🎯 Automatic Location** → Uses your hotel coordinates (21.034087, 105.85114)
3. **📏 Choose Distance** → Select search radius:
   - 🚶‍♂️ **0.5km**: Walking to nearby Old Quarter spots
   - 🚴‍♂️ **1km**: Short bike ride (default)
   - 🏃‍♂️ **2km**: Quick scooter trip  
   - 🚗 **5km**: Car/taxi distance
4. **🔍 Browse Results** → 4 categories with photos:
   - 🍽️ **Restaurants**: Hanoi street food, pho, local eateries
   - 🏛️ **Landmarks**: Hoan Kiem Lake, temples, historic sites
   - ☕ **Coffee**: Vietnamese coffee shops, cafes
   - 🎭 **Culture**: Museums, galleries, cultural centers
5. **🗺️ Get Directions** → Direct Google Maps navigation

### **Perfect for Old Quarter Guests:**
- **🏛️ Historical sites**: Ngoc Son Temple, Bach Ma Temple
- **🍜 Street food**: Bun cha, pho, banh mi vendors  
- **☕ Coffee culture**: Traditional Vietnamese coffee
- **🛍️ Shopping**: Night markets, silk street, souvenirs
- **🎭 Cultural**: Water puppet theater, museums

## 🎨 **Print Materials for Your Hotel**

### **QR Code Card for Guest Rooms:**
```
┌─────────────────────────────┐
│    🏨 OLD QUARTER HOTEL     │
│    118 Hang Bac, Hanoi      │
│                             │
│  📱 Discover Hanoi Like     │
│     A Local                 │
│                             │
│  [QR CODE HERE]            │
│                             │
│  Scan to find nearby:       │
│  🍜 Authentic street food   │
│  ☕ Traditional coffee      │
│  🏛️ Historical landmarks    │
│  🎭 Cultural experiences    │
│                             │
│  No app needed - works on   │
│  any smartphone!            │
└─────────────────────────────┘
```

### **Lobby Display:**
```
🌟 EXPLORE HANOI'S OLD QUARTER 🌟
═══════════════════════════════════════

Discover hidden gems near our hotel!
Our smart guide finds the best local spots.

[LARGE QR CODE]

📱 SCAN WITH YOUR PHONE CAMERA
• Authentic Vietnamese restaurants
• Traditional coffee shops  
• Historic temples & landmarks
• Cultural sites & museums

🚶‍♂️ Perfect for walking tours
🗺️ Direct Google Maps directions
📸 Photos & ratings included
```

## 🔧 **Technical Configuration**

### **Your Current Setup:**
- **✅ Default hotel configured**: 118 Hang Bac, Hanoi
- **✅ Automatic location detection**: No guest input needed
- **✅ Security enabled**: QR codes are cryptographically signed
- **✅ Multiple hotel support**: Ready for expansion
- **✅ Photo display working**: All places show images
- **✅ Directions functional**: Google Maps integration active

### **Server Configuration:**
```javascript
// Your hotel is set as default
const DEFAULT_HOTEL = {
  name: "Old Quarter Hotel",
  address: "118 Hang Bac, Hoan Kiem, Hanoi, Vietnam", 
  latitude: 21.034087,
  longitude: 105.85114,
  description: "Discover amazing places near our hotel in Hanoi's historic Old Quarter"
};
```

### **URL Structure:**
- **Default**: `http://localhost:3000` → Uses your hotel location
- **Custom**: `http://localhost:3000?hotel=other-location` → For other hotels
- **Direct coords**: `http://localhost:3000?lat=21.034087&lng=105.85114` → Legacy support

## 🏪 **Adding More Hotels (Future)**

### **Step 1: Add to Hotel Database**
Edit `server.js` and add your new location:
```javascript
const HOTEL_LOCATIONS = {
  'hanoi-old-quarter': DEFAULT_HOTEL,
  'saigon-downtown': {
    name: "Saigon Central Hotel",
    address: "District 1, Ho Chi Minh City, Vietnam",
    latitude: 10.7769,
    longitude: 106.7009,
    description: "Explore vibrant Saigon from our downtown location"
  },
  'da-nang-beach': {
    name: "Da Nang Beach Resort", 
    address: "My Khe Beach, Da Nang, Vietnam",
    latitude: 16.0544,
    longitude: 108.2022,
    description: "Discover Da Nang's beaches and attractions"
  }
};
```

### **Step 2: Generate Hotel-Specific QR Codes**
```bash
# For Saigon hotel
curl -X POST https://your-domain.com/api/generate-hotel-qr \
  -d '{"hotelId": "saigon-downtown"}'

# For Da Nang hotel  
curl -X POST https://your-domain.com/api/generate-hotel-qr \
  -d '{"hotelId": "da-nang-beach"}'
```

## 🚀 **Deployment for Live Use**

### **Step 1: Deploy to Railway**
```bash
git add .
git commit -m "Configure Old Quarter Hotel as default location"
git push origin main
```

### **Step 2: Update Domain Settings**
In production, update your environment variables:
```bash
PRODUCTION_DOMAIN=your-app.railway.app
CUSTOM_DOMAIN=your-custom-domain.com  # Optional
```

### **Step 3: Generate Production QR Codes**
```bash
# Replace with your Railway domain
curl -X POST https://your-app.railway.app/api/generate-hotel-qr \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 📊 **Guest Usage Analytics**

Monitor your server logs to see:
- **🌐 Direct web access**: Guests visiting directly
- **📱 QR access**: Guests scanning your QR codes
- **🗺️ Location usage**: Which search radii guests prefer
- **🔍 Category popularity**: Restaurant vs landmark searches

Example log output:
```
🌐 Direct web access from 192.168.1.100 - Using Old Quarter Hotel
📱 Secure QR access verified for 10.0.0.50 - Old Quarter Hotel
🔒 QR Generation Log: {"success":true,"hotel":"Old Quarter Hotel"}
```

## ✅ **Next Steps**

1. **📱 Test with your phone**: Visit `http://localhost:3000`
2. **🖨️ Print QR codes**: Use the API to generate and download
3. **🏨 Place in hotel**: Rooms, lobby, restaurant areas
4. **🚀 Deploy live**: Push to Railway for production use
5. **📊 Monitor usage**: Watch server logs for guest activity

Your hotel guests will love this modern way to discover Hanoi's Old Quarter! 🇻🇳