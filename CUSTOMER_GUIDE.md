# 📱 Customer QR Code Guide

## How Customers Use QR Codes

### 📲 **Step 1: Scan QR Code**
- Open phone camera or QR scanner app
- Point at QR code 
- Tap the notification/link that appears

### 🎯 **Step 2: Automatic Location Detection**
- App opens in mobile browser
- Click "📍 Enable Location" for best results
- Or click "📝 Enter Manually" to type address

### 📏 **Step 3: Choose Search Radius**
- Select distance: 0.5km to 10km
- 🚶‍♂️ 0.5km = Walking distance
- 🚗 5km = Short drive
- Click "🔍 Find Places"

### 🏪 **Step 4: Browse Results**
- See photos, ratings, and distances
- 4 categories: 🍽️ Restaurants, 🏛️ Landmarks, ☕ Coffee, 🎭 Culture
- Click "🗺️ Directions" to open Google Maps
- Click "🌐 Website" for business info

## 🏢 **For Business Owners**

### Generate Your QR Code:
1. **Visit**: http://localhost:3000 (your server URL)
2. **Scroll down** and click "Generate QR Code"
3. **Fill in**:
   - Location Label: "Your Business Name"
   - Latitude: Your GPS latitude (optional)
   - Longitude: Your GPS longitude (optional)
4. **Click "Generate QR Code"**
5. **Download and print** the QR code

### QR Code Types:

**🌍 General Discovery QR** (Recommended)
```
Base URL: http://localhost:3000
Label: "Discover Places Near [Your Business]"
```
- Customers scan → enter their location → find places nearby
- Works anywhere in the world

**📍 Location-Specific QR**
```
Base URL: http://localhost:3000  
Latitude: 21.0285
Longitude: 105.8542
Label: "Hanoi Old Quarter Discovery"
```
- Customers scan → automatically searches around your coordinates
- Perfect for hotels, events, tourist spots

### 📋 **QR Code Printing Tips**

**Size**: Minimum 2cm x 2cm (0.8 inches)
**Quality**: High contrast (black on white)
**Placement**: Easy to access, good lighting
**Text**: Add "Scan to discover nearby places"

### 📱 **Mobile Experience**

✅ Works on all smartphones (iPhone, Android)
✅ No app download required
✅ Optimized for mobile screens
✅ Fast loading with photos
✅ Direct Google Maps integration

## 🎯 **Use Cases**

**🏨 Hotels**: Place QR in lobby - guests discover nearby restaurants
**🍽️ Restaurants**: Table tents - customers find coffee shops after dinner  
**☕ Cafes**: Counter display - visitors discover local landmarks
**🎪 Events**: QR on tickets - attendees explore the area
**🏪 Retail**: Store entrance - shoppers find nearby restaurants

## 🔧 **Technical Notes**

- **Works offline**: Initial scan requires internet, then cached
- **Privacy**: No personal data collected
- **Speed**: Results load in 2-3 seconds
- **Accuracy**: GPS accurate to 10-50 meters
- **Coverage**: Worldwide (Google Places data)

---

**Ready to deploy? Replace `localhost:3000` with your Railway/live domain!**