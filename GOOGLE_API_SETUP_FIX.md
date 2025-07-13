# 🔧 Fix "No Places Found" - Google Maps API Setup

## 🚨 **ISSUE IDENTIFIED: API Key Problem**

Your Railway deployment is returning empty results because:
❌ **Google Maps API key is either missing or invalid**
❌ **API key may not have proper permissions**
❌ **Billing might not be enabled**

## 🔑 **Step 1: Get Your Google Maps API Key**

### **Create/Get API Key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable these APIs:
   - **Places API (New)** ✅ 
   - **Maps JavaScript API** ✅
   - **Geocoding API** ✅
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API key (starts with `AIza...`)

### **Enable Required APIs:**
```bash
# These APIs must be enabled in Google Cloud Console:
✅ Places API (New) - for finding restaurants, landmarks, etc.
✅ Maps JavaScript API - for map functionality  
✅ Geocoding API - for address to coordinates conversion
```

### **Enable Billing:**
⚠️ **CRITICAL**: Google Places API requires billing enabled
1. Go to **Billing** in Google Cloud Console
2. Link a credit card (Google gives $200 free credit monthly)
3. Enable billing for your project

## 🛡️ **Step 2: Secure Your API Key**

### **Restrict API Key (Important!):**
1. In Google Cloud Console → **Credentials**
2. Click your API key → **Edit**
3. **Application restrictions**: 
   - Select **HTTP referrers (web sites)**
   - Add: `https://nearbyspots-qr-production.up.railway.app/*`
   - Add: `https://*.railway.app/*` (for future deployments)
4. **API restrictions**:
   - Select **Restrict key**
   - Enable only: Places API (New), Maps JavaScript API, Geocoding API

## 🚀 **Step 3: Add API Key to Railway**

### **Set Environment Variable:**
1. Go to your Railway dashboard
2. Click your project → **Variables** tab
3. Add new variable:
   - **Name**: `GOOGLE_MAPS_API_KEY`
   - **Value**: `AIza...` (your API key)
4. Click **Deploy** to restart with new environment variable

## 🧪 **Step 4: Test Your API Key**

### **Quick Test (5 minutes):**
```bash
# Test API key directly (replace YOUR_API_KEY):
curl -X POST "https://places.googleapis.com/v1/places:searchNearby" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: YOUR_API_KEY" \
  -H "X-Goog-FieldMask: places.displayName,places.formattedAddress" \
  -d '{
    "includedTypes": ["restaurant"],
    "maxResultCount": 5,
    "locationRestriction": {
      "circle": {
        "center": {"latitude": 21.034087, "longitude": 105.85114},
        "radius": 1000
      }
    }
  }'
```

**Expected result**: Should return restaurants near your hotel
**If error**: Check API key, billing, and API restrictions

## 📱 **Step 5: Test Your App**

After adding the API key to Railway:

1. **Wait 2-3 minutes** for Railway to redeploy
2. **Scan your QR code** or visit: https://nearbyspots-qr-production.up.railway.app
3. **Choose distance** → **Find Places**
4. **Should now show**: Restaurants, landmarks, coffee shops, culture near your hotel

## 💰 **Cost Information**

### **Google Places API Pricing:**
- **Free tier**: $200 credit per month (covers ~40,000 searches)
- **Nearby Search**: $0.032 per search
- **Your typical usage**: ~100 searches/day = $3/month
- **Free credit covers**: 6,000+ searches per month

### **Cost Optimization:**
✅ API key restrictions prevent abuse
✅ Rate limiting prevents excessive usage
✅ Caching reduces redundant API calls
✅ Your hotel usage will be well within free limits

## 🔍 **Troubleshooting Guide**

### **If still getting "no places found":**

**Check Railway Logs:**
1. Railway dashboard → **Deployments** → **View Logs**
2. Look for error messages like:
   - `Google Places API error: API key not valid`
   - `PERMISSION_DENIED`
   - `BILLING_NOT_ENABLED`

**Common Issues:**
- ❌ **API key not set**: Add `GOOGLE_MAPS_API_KEY` to Railway
- ❌ **Billing not enabled**: Enable billing in Google Cloud
- ❌ **Wrong APIs enabled**: Enable Places API (New)
- ❌ **API restrictions too strict**: Allow your Railway domain

**Quick Verification:**
```bash
# Check if API key is available in Railway:
# Should show "Configured" in deployment logs

# Test specific endpoint:
curl https://nearbyspots-qr-production.up.railway.app/api/health
# Should show: "Google Maps API: Configured"
```

## ✅ **Success Checklist**

- [ ] Google Cloud project created
- [ ] Places API (New) enabled
- [ ] Billing enabled with credit card
- [ ] API key created and copied
- [ ] API key restrictions configured
- [ ] `GOOGLE_MAPS_API_KEY` added to Railway
- [ ] Railway redeployed (wait 2-3 minutes)
- [ ] App tested with QR code - shows places!

## 🎯 **Expected Results After Fix**

Your guests will see:
🍜 **Restaurants**: Pho shops, Vietnamese restaurants, street food
🏛️ **Landmarks**: Hoan Kiem Lake, temples, historic sites  
☕ **Coffee**: Traditional Vietnamese coffee shops
🎭 **Culture**: Museums, galleries, cultural centers

All within walking distance of your hotel at 118 Hang Bac!

## 📞 **Need Help?**

If you're still having issues:
1. Share your Railway deployment logs
2. Confirm billing is enabled in Google Cloud
3. Verify API key has correct permissions
4. Test API key with the curl command above

**Your QR system will work perfectly once the API key is properly configured! 🚀**