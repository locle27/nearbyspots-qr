# 🏨 Hotel Guest QR Setup Guide

## 🎯 Perfect for Hotel Guests

Your QR system is **ideal for hotel guests** who want to discover nearby places without asking front desk staff. Here's how to set it up:

## 📍 **Step 1: Generate Hotel-Specific QR Codes**

### **Option A: General Discovery QR** (Recommended)
```bash
# Test with your localhost first
curl -X POST http://localhost:3000/api/generate-qr \
  -H "Content-Type: application/json" \
  -d '{"baseUrl":"http://localhost:3000","label":"Discover Places Near Our Hotel"}'
```

### **Option B: Hotel Location-Specific QR**
```bash
# Replace with your hotel's exact coordinates
curl -X POST http://localhost:3000/api/generate-qr \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl":"http://localhost:3000",
    "latitude":21.0285,
    "longitude":105.8542,
    "label":"Hanoi Old Quarter Hotel - Explore Nearby"
  }'
```

## 🎨 **Step 2: Create Hotel Guest Materials**

### **QR Code Placement Ideas:**

**📋 Room Information Cards**
```
┌─────────────────────────────┐
│  🏨 Welcome to [Hotel Name] │
│                             │
│  📱 Discover nearby places  │
│  [QR CODE HERE]            │
│                             │
│  Scan to find:              │
│  🍽️ Restaurants             │
│  ☕ Coffee shops            │
│  🏛️ Landmarks              │
│  🎭 Cultural sites          │
└─────────────────────────────┘
```

**📱 Table Tents for Lobby/Restaurant**
```
Explore the Neighborhood!
═══════════════════════════════
🗺️ Find amazing places near our hotel

[QR CODE]

📍 Scan with your phone camera
🔍 Choose your search radius
🚶‍♂️ Get directions instantly
```

**📄 Welcome Packet Insert**
```
🌟 GUEST EXPERIENCE TIP 🌟

Skip the tourist traps! Our smart QR code 
helps you discover authentic local spots:

[QR CODE]

✨ Rated restaurants with photos
✨ Hidden coffee gems
✨ Cultural landmarks
✨ Direct Google Maps navigation
```

## 🏪 **Step 3: Guest Experience Flow**

### **What Guests Experience:**

1. **📱 Scan QR** → Opens mobile-friendly web app
2. **📍 Enable Location** → GPS finds their exact position
3. **📏 Choose Distance** → Select 0.5km - 10km radius
4. **🔍 Find Places** → See categorized results with:
   - **📸 Photos** of each place
   - **⭐ Ratings** and review counts
   - **📍 Walking distance** from hotel
   - **🗺️ Direct Google Maps** directions
   - **🌐 Website links** (if available)

### **Perfect for Different Guest Types:**

**🎒 Tourists**: "Find landmarks and cultural sites"
**☕ Coffee Lovers**: "Discover local coffee shops"
**🍽️ Foodies**: "Explore authentic restaurants"
**🚶‍♂️ Walkers**: "What's within walking distance?"

## 🔧 **Step 4: Deploy for Production**

### **For Live Hotel Use:**

1. **Deploy to Railway**:
   ```bash
   # Your domain will be something like:
   # https://nearbyspots-qr-production.railway.app
   ```

2. **Generate Production QR Codes**:
   ```bash
   curl -X POST https://your-app.railway.app/api/generate-qr \
     -H "Content-Type: application/json" \
     -d '{
       "baseUrl":"https://your-app.railway.app",
       "latitude":YOUR_HOTEL_LAT,
       "longitude":YOUR_HOTEL_LNG,
       "label":"[Your Hotel Name] - Discover Nearby"
     }'
   ```

3. **Print and Distribute**:
   - **Minimum size**: 2cm x 2cm (0.8 inches)
   - **High contrast**: Black QR on white background
   - **Clear instructions**: "Scan to discover nearby places"

## 💡 **Creative Placement Ideas**

### **In Guest Rooms:**
- 📺 TV stand card holders
- 🛏️ Bedside table tents
- 🚪 Door hangers
- 📖 Welcome binders

### **Common Areas:**
- 🏨 Front desk display
- ☕ Restaurant table tents
- 🛋️ Lobby seating areas
- 🚪 Elevator displays
- 🏃‍♂️ Fitness center walls

### **Digital Displays:**
- 📺 Room TV welcome screens
- 💻 Lobby digital displays
- 📱 Hotel app integration
- 📧 Email confirmations

## 🎯 **Guest Scenarios**

### **Scenario 1: Business Traveler**
*"I have 2 hours before my meeting. What's nearby?"*
- Scan QR → Choose 1km radius → Find coffee shops
- See "The Note Coffee" 300m away with 4.8⭐ rating
- Tap directions → Google Maps opens → 5-minute walk

### **Scenario 2: Tourist Family**
*"We want to see local landmarks after checking in"*
- Scan QR → Choose 2km radius → Browse landmarks
- Discover "Hoan Kiem Lake" with photos and directions
- Plan walking route to multiple cultural sites

### **Scenario 3: Food Explorer**
*"Where do locals actually eat?"*
- Scan QR → Choose 500m radius → Find restaurants
- See authentic "Bun Cha Dac Kim" with photos and ratings
- Avoid tourist traps, eat where locals do

## 📊 **Benefits for Your Hotel**

### **Guest Experience:**
- ✅ **Self-service discovery** - No need to ask staff
- ✅ **Authentic recommendations** - Real ratings and photos
- ✅ **Instant directions** - Direct Google Maps integration
- ✅ **Mobile optimized** - Works on any smartphone

### **Hotel Operations:**
- ✅ **Reduce front desk questions** about nearby places
- ✅ **Enhance guest satisfaction** with local discoveries
- ✅ **No maintenance required** - Auto-updates with new places
- ✅ **Professional appearance** - Modern, tech-savvy service

### **Cost Effective:**
- ✅ **One-time setup** - Print QR codes once
- ✅ **No app required** - Works in any mobile browser
- ✅ **Global coverage** - Works anywhere with Google Places data
- ✅ **Secure and reliable** - Protected against QR code attacks

## 🛡️ **Security Features**

Your QR codes are protected against common attacks:

- **🔒 Domain Validation**: Only your domains can generate QR codes
- **🔐 Digital Signatures**: QR codes are cryptographically signed
- **⏰ Time Limits**: Signatures expire after 24 hours
- **📝 Activity Logging**: All QR access is monitored
- **🚫 Tamper Detection**: Modified QR codes are rejected

## 🚀 **Ready to Launch?**

1. **Test locally** with `http://localhost:3000`
2. **Deploy to Railway** for live use
3. **Generate production QR codes** with your live domain
4. **Print and place** in guest areas
5. **Train staff** on how it works (optional - it's self-explanatory!)

Your guests will love the modern, helpful service! 🌟