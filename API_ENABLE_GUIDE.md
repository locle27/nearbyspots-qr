# 🔧 Google API Enable Guide

## ❌ Current Issue:
```
Places API (New) has not been used in project 971755172938 before or it is disabled
```

## ✅ Quick Fix:

### **Step 1: Enable Places API (New)**
Click this direct link:
👉 **https://console.developers.google.com/apis/api/places.googleapis.com/overview?project=971755172938**

1. **Click "Enable API"**
2. **Wait 2-3 minutes** for activation

### **Step 2: Enable Additional APIs (Recommended)**
Also enable these for full functionality:

1. **Geocoding API**: https://console.developers.google.com/apis/api/geocoding-backend.googleapis.com/overview?project=971755172938
2. **Maps JavaScript API**: https://console.developers.google.com/apis/api/maps-backend.googleapis.com/overview?project=971755172938

### **Step 3: Verify APIs Enabled**
Go to: https://console.developers.google.com/apis/dashboard?project=971755172938

You should see:
- ✅ Places API (New)
- ✅ Geocoding API  
- ✅ Maps JavaScript API

## 🎯 **After Enabling:**

1. **Wait 2-3 minutes**
2. **Restart your server**: `Ctrl+C` then `npm start`
3. **Test address search**: "118 Hang Bac, Hanoi, Vietnam"
4. **You should see nearby places** in all 4 categories

## 💰 **Cost Impact:**
- **Geocoding**: $5 per 1,000 requests
- **Places API (New)**: $17 per 1,000 requests
- **Your usage**: Very low for testing

**Total cost for testing: Less than $1** 💸