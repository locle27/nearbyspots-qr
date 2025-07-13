# 🚀 Railway Deployment Guide

## Your Project Details:
- **GitHub Repository**: https://github.com/locle27/nearbyspots-qr
- **Google Maps API Key**: `AIzaSyAVdAZdO0tjOSoNImELNfi5HtZVzitN3Y4`

## Step-by-Step Railway Deployment:

### 1. Deploy to Railway

1. **Go to Railway**: https://railway.app
2. **Sign up/Login** with GitHub account
3. **Click "Deploy from GitHub repo"**
4. **Select repository**: `locle27/nearbyspots-qr`
5. **Railway will auto-detect Node.js** and start deployment

### 2. Configure Environment Variables

After deployment, go to your Railway project dashboard:

1. **Click on your project**
2. **Go to "Variables" tab**
3. **Add these variables**:

```env
GOOGLE_MAPS_API_KEY=AIzaSyAVdAZdO0tjOSoNImELNfi5HtZVzitN3Y4
NODE_ENV=production
CORS_ORIGIN=https://YOUR_RAILWAY_DOMAIN.railway.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
DEFAULT_SEARCH_RADIUS=1000
MAX_SEARCH_RADIUS=10000
RESULTS_PER_CATEGORY=10
```

**Note**: Replace `YOUR_RAILWAY_DOMAIN` with your actual Railway domain (you'll see it after deployment)

### 3. Update CORS_ORIGIN

1. **After first deployment**, Railway will give you a domain like:
   `https://nearbyspots-qr-production-xxxx.up.railway.app`

2. **Copy this domain** and update the `CORS_ORIGIN` variable:
   ```
   CORS_ORIGIN=https://nearbyspots-qr-production-xxxx.up.railway.app
   ```

3. **Save** and Railway will auto-redeploy

### 4. Secure Your Google API Key

**Important Security Steps**:

1. **Go to Google Cloud Console**: https://console.cloud.google.com
2. **Navigate to**: APIs & Services → Credentials
3. **Click on your API key**: `AIzaSyAVdAZdO0tjOSoNImELNfi5HtZVzitN3Y4`
4. **Add Application Restrictions**:
   - Select "HTTP referrers (web sites)"
   - Add: `https://YOUR_RAILWAY_DOMAIN.railway.app/*`
   - Add: `https://YOUR_CUSTOM_DOMAIN.com/*` (if you have one)

5. **Add API Restrictions**:
   - Select "Restrict key"
   - Choose: "Places API (New)"

### 5. Test Your Deployment

1. **Visit your Railway domain**
2. **Test the flow**:
   - Allow location access
   - Select search radius
   - Verify nearby places appear
   - Test "Open in Google Maps" buttons
   - Try QR code generation

### 6. Custom Domain (Optional)

If you want a custom domain:

1. **In Railway Dashboard**: Settings → Domains
2. **Add Domain**: yourdomain.com
3. **Update DNS records** as instructed by Railway
4. **Update CORS_ORIGIN** to your custom domain

## 🔧 Troubleshooting

### Common Issues:

1. **"API key not configured"**:
   - Verify `GOOGLE_MAPS_API_KEY` is set in Railway variables
   - Check API key is correct

2. **"CORS error"**:
   - Update `CORS_ORIGIN` with correct Railway domain
   - Remove any trailing slashes

3. **"No places found"**:
   - Verify Google Places API (New) is enabled
   - Check API key restrictions allow your domain

4. **Deployment fails**:
   - Check Railway build logs
   - Verify package.json is correct

### Test Commands:

```bash
# Test health endpoint
curl https://YOUR_DOMAIN.railway.app/api/health

# Test QR generation
curl -X POST https://YOUR_DOMAIN.railway.app/api/generate-qr \
  -H "Content-Type: application/json" \
  -d '{"baseUrl":"https://YOUR_DOMAIN.railway.app"}'
```

## 📱 QR Code Usage

Once deployed, you can:

1. **Generate QR codes** at your app URL
2. **Share QR codes** for specific locations
3. **Users scan** with phone camera
4. **Instant discovery** of nearby places

## 💰 Cost Monitoring

- **Railway**: $5/month
- **Google Maps API**: Monitor usage in Google Cloud Console
- **Set billing alerts** to avoid surprises

---

**🎉 Your app is ready to discover amazing places!**