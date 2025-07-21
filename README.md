# Nearby Places QR Discovery System

A professional QR code-powered web application that allows users to instantly discover nearby restaurants, landmarks, coffee shops, and cultural sites with photos, ratings, and direct Google Maps integration.

## 🚀 Features

- **QR Code Scanning**: Instantly access location-based discoveries
- **Smart Location Detection**: GPS + manual address input fallbacks
- **4 Categories**: Restaurants, Landmarks, Coffee Shops, Cultural Sites
- **Mobile-First Design**: Optimized for all devices with 44px touch targets
- **Google Maps Integration**: Direct navigation links
- **Customizable Search Radius**: 0.5km to 10km range
- **Professional Security**: API key restrictions, rate limiting, CORS
- **PWA Capabilities**: Installable as mobile app

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript (mobile-optimized)
- **APIs**: Google Places API (New), OpenStreetMap Geocoding
- **QR Generation**: node-qrcode
- **Deployment**: Railway Platform
- **Security**: Helmet, CORS, Rate Limiting

## 📱 User Flow

1. **QR Scan** → Camera opens web app URL
2. **Location Permission** → GPS detection or manual input
3. **Distance Selection** → Choose search radius (0.5-10km)
4. **Results Display** → Browse categorized places with photos
5. **Google Maps** → Direct navigation to selected places

## 🔧 Setup Instructions

### Prerequisites

1. **Google Cloud Console Setup**:
   - Create new project
   - Enable Places API (New)
   - Generate API key with domain restrictions
   - Set up billing (pay-per-use)

2. **Railway Account**:
   - Sign up at railway.app
   - Connect GitHub repository

### Local Development

```bash
# Clone and install
git clone <repository-url>
cd nearby-places-qr
npm install

# Environment setup
cp .env.example .env
# Edit .env with your Google Maps API key

# Run locally
npm run dev
# App runs on http://localhost:3000
```

### Environment Variables

```bash
# Required
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Optional (with defaults)
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
DEFAULT_SEARCH_RADIUS=1000
MAX_SEARCH_RADIUS=10000
RESULTS_PER_CATEGORY=10
```

## 🚀 Deployment to Railway

### Method 1: GitHub Integration (Recommended)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Railway Deployment**:
   - Go to [railway.app](https://railway.app)
   - Click "Deploy from GitHub repo"
   - Select your repository
   - Railway auto-detects Node.js and deploys

3. **Set Environment Variables**:
   - Go to your Railway project dashboard
   - Click "Variables" tab
   - Add all required environment variables:
     - `GOOGLE_MAPS_API_KEY`
     - `CORS_ORIGIN` (use your Railway domain)
     - Other optional variables

4. **Custom Domain** (Optional):
   - Go to "Settings" → "Domains"
   - Add your custom domain
   - Update DNS records as instructed

### Method 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

## 📊 API Costs (Google Maps)

**Per 1,000 Requests**:
- Nearby Search: $17
- Place Details: $17
- Photos: $7

**Monthly Estimates**:
- **1K QR scans**: ~$113/month
- **10K QR scans**: ~$1,130/month
- **100K QR scans**: ~$11,300/month

## 🔒 Security Features

- **API Key Restrictions**: Domain + IP restrictions
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Cross-origin request control
- **Helmet Security**: HTTP headers protection
- **Server-Side API Calls**: No exposed API keys to frontend

## 📱 QR Code Generation

### For Business Owners

Access the QR generator at `/` → "Generate QR Code":

```javascript
// Basic QR (detects user location)
baseUrl: "https://yourapp.railway.app"

// Pre-set location QR
baseUrl: "https://yourapp.railway.app"
latitude: 40.7128
longitude: -74.0060
label: "Times Square"
```

### QR Code Best Practices

- **Size**: Minimum 2cm × 2cm for scanning
- **Contrast**: High contrast (black on white)
- **Placement**: Easy access, good lighting
- **Instructions**: "Scan to discover nearby places"

## 🛡️ API Key Security Setup

### Google Cloud Console

1. **Create Restrictions**:
   ```
   Application Restrictions:
   - HTTP referrers: yourdomain.railway.app/*
   
   API Restrictions:
   - Places API (New)
   ```

2. **Monitor Usage**:
   - Set up billing alerts
   - Review daily quotas
   - Monitor for unusual activity

## 📈 Performance Optimization

- **Image Lazy Loading**: Photos load on demand
- **API Caching**: Reduces redundant requests
- **Mobile-First**: Optimized for mobile devices
- **CDN Ready**: Static assets served efficiently

## 🧪 Testing

```bash
# Test health endpoint
curl https://yourapp.railway.app/api/health

# Test QR generation
curl -X POST https://yourapp.railway.app/api/generate-qr \
  -H "Content-Type: application/json" \
  -d '{"baseUrl":"https://yourapp.railway.app"}'
```

## 📞 Support

For issues or questions:
- Check Railway logs for deployment issues
- Verify Google Maps API key restrictions
- Test with different browsers/devices
- Monitor API quotas and billing

## 🔄 Updates & Maintenance

- **Dependencies**: Regular npm updates
- **Security**: Monitor for vulnerabilities
- **API Changes**: Stay updated with Google Maps API changes
- **Performance**: Monitor Railway metrics

---

**Built with ❤️ for seamless location discovery**