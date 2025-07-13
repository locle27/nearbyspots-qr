# 🚀 Instant Local Testing + Public URL

## **Method 1: Local Server + Ngrok (5 minutes)**

### Step 1: Run Local Server
```bash
cd /mnt/c/Users/T14/Desktop/old-quarter-guide/nearbyspots-qr
npm install
npm start
```

### Step 2: Get Public URL with Ngrok
```bash
# Download ngrok: https://ngrok.com/download
# Or if you have it installed:
ngrok http 3000
```

**You'll get instant URL like:** `https://abc123.ngrok.io`

## **Method 2: Deploy to Vercel (2 minutes)**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (from your project folder)
vercel --prod

# Vercel gives you instant URL like: https://nearbyspots-qr-abc123.vercel.app
```

## **Method 3: Test Locally First**

```bash
# Set environment variables
export GOOGLE_MAPS_API_KEY="AIzaSyAVdAZdO0tjOSoNImELNfi5HtZVzitN3Y4"
export NODE_ENV="development"
export CORS_ORIGIN="http://localhost:3000"

# Run server
npm start

# Open browser: http://localhost:3000
```

## **For Business QR Codes:**

Once you have ANY public URL, you can create QR codes that point to:

```
https://your-domain.com/?lat=YOUR_LATITUDE&lng=YOUR_LONGITUDE&label=YOUR_BUSINESS_NAME
```

**Example for a restaurant:**
```
https://your-domain.com/?lat=21.0285&lng=105.8542&label=Hanoi%20Restaurant
```

This QR code will:
1. Take customers directly to your location
2. Show nearby restaurants, landmarks, coffee, culture
3. Provide Google Maps navigation