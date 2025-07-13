# 🔧 Railway Service Type Fix

## 🚨 Current Problem:
Railway is starting/stopping your container repeatedly because it's not detecting this as a web service that needs a public URL.

## ✅ **Quick Fix Options:**

### **Option 1: Railway Dashboard Fix (Recommended)**
1. **Go to Railway Dashboard**
2. **Click your project**
3. **Go to Settings → Service**
4. **Change Service Type from "Worker" to "Web"**
5. **Save and redeploy**

### **Option 2: Force Web Service Recognition**
In Railway Dashboard:
1. **Settings → Domains**
2. **Click "Generate Domain"**
3. **This forces Railway to treat it as web service**

### **Option 3: Add PORT Environment Variable**
1. **Variables tab**
2. **Add: `PORT=8080`**
3. **This tells Railway it's a web service on port 8080**

## 🎯 **Expected Result:**
After fixing service type:
- ✅ Container stays running (no more SIGTERM)
- ✅ Public URL appears in Railway dashboard
- ✅ App accessible at https://your-domain.railway.app

## 🚀 **Why This Happens:**
Railway auto-detects service types, but sometimes:
- **Worker services** = No public URL, runs in background
- **Web services** = Public URL, handles HTTP requests

Your app is a web service but Railway might have initially detected it as a worker.

## 📱 **Test After Fix:**
Once URL appears, test:
- `/api/health` - Should return JSON
- `/` - Should show QR discovery interface
- QR code generation and location detection should work

The app code is perfect - just needs Railway to recognize it as a web service! 🎯