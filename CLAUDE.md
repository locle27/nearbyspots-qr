# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a production-ready QR code-powered web application that enables users to discover nearby restaurants, landmarks, coffee shops, and cultural sites. The system consists of a Node.js backend with Google Places API integration and an enhanced hotel management interface with advanced UX features.

**Current Status**: ✅ **Production Ready** - Enhanced with improved gallery loading, persistent selection arrows, auto-zoom functionality, and robust place name extraction.

## Core Architecture

### Backend (`server.js`)
- **Express.js server** with comprehensive security middleware (Helmet, CORS, rate limiting)
- **Google Places API (New)** integration for nearby search with photos and ratings
- **Google Geocoding API** for address-to-coordinates conversion
- **QR code generation** using node-qrcode library
- **Server-side API calls** to protect API keys from frontend exposure

### Frontend (`public/`)
- **Vanilla JavaScript** mobile-first SPA with screen-based navigation
- **Progressive Web App** with manifest.json and service worker
- **Enhanced Hotel Management Interface** (`hotel-map.html`) with advanced UX features
- **Responsive design** with 44px minimum touch targets for accessibility
- **4 discovery categories**: restaurants, landmarks, coffee shops, culture

### Hotel Management Interface (`public/hotel-map.html`)
- **Enhanced Map Markers**: Large pin-shaped markers (40x50px) with category icons and shadows
- **Persistent Selection System**: "SELECTED" text arrows that stay visible until new selection
- **Auto-Zoom Functionality**: Automatically zooms to level 17 for detailed location view
- **Gallery Loading States**: Spinner animations, error handling, and progressive image loading
- **Cross-Tab Interaction**: List selection highlights corresponding map markers
- **Miles Conversion**: Distance shown in both meters and miles for international users

### Key Configuration Files
- `railway.toml` - Railway deployment with Dockerfile builder
- `Dockerfile` - Node.js 18 Alpine container with non-root user
- `manifest.json` - PWA configuration for mobile installation

## Development Commands

```bash
# Local development
npm start              # Start server on port 3000
npm run dev           # Same as start (development mode)

# Testing
curl http://localhost:3000/api/health    # Health check endpoint
```

## Google Places API Integration

### Place Type Mapping
- **Restaurants**: `['restaurant', 'meal_takeaway', 'bar', 'night_club']`
- **Landmarks**: `['tourist_attraction']` 
- **Coffee**: `['cafe', 'bakery']`
- **Culture**: `['museum', 'art_gallery', 'library', 'cultural_center']`

**Important**: Some place types like `'food'`, `'meal_service'`, `'establishment'`, `'point_of_interest'`, and `'theater'` are not supported by Google Places API (New) and will cause 400 errors.

### API Endpoints Architecture
- `/api/search-nearby` - Enhanced search with 4-tier place name extraction and multiple search strategies
- `/api/geocode-address` - Convert address to coordinates  
- `/api/generate-qr` - Create QR codes for business locations
- `/api/place-photo/:photoName` - Proxy for Google Photos API with error handling
- `/hotel-map` - Enhanced hotel management interface with advanced UX features

### Enhanced Place Name Extraction (server.js:1358-1400)
**4-Tier Fallback System** eliminates "Unknown" place names:
1. **Primary**: `place.displayName.text` with proper trimming
2. **Secondary**: `place.name` field validation
3. **Tertiary**: Intelligent address parsing (skips street numbers, excludes "Vietnam"/"Hanoi")
4. **Quaternary**: Type-based descriptive names with coordinates when all else fails

## Environment Variables

Required:
```bash
GOOGLE_MAPS_API_KEY=your_api_key_here
```

Optional with defaults:
```bash
PORT=3000
RESULTS_PER_CATEGORY=100       # Increased to 100 for better landmark coverage
DEFAULT_SEARCH_RADIUS=2000     # Increased from 1000m to 2000m for better coverage
MAX_SEARCH_RADIUS=10000        # Maximum allowed search radius
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes rate limit window
RATE_LIMIT_MAX_REQUESTS=100    # Max requests per window per IP
CORS_ORIGIN=*                  # CORS origin policy
```

## Security Architecture

- **API key protection**: All Google API calls made server-side only
- **Rate limiting**: 100 requests per 15 minutes per IP address
- **CORS configuration**: Configurable origin restrictions
- **Content Security Policy**: Restrictive CSP headers via Helmet
- **Input validation**: Coordinate bounds and radius limits enforced

## Mobile-First Frontend Architecture

### Screen Flow System
1. **Permission Screen** - Location access request
2. **Manual Location Screen** - Address input fallback
3. **Distance Screen** - Search radius selection (0.5km-10km)
4. **Results Screen** - Categorized place display with tabs
5. **QR Generator** - Business owner tool for location QR codes

### State Management
Global state in `app.js`:
- `currentLocation` - User coordinates
- `currentRadius` - Selected search radius
- `currentResults` - API response data by category
- `currentCategory` - Active display category

## Deployment

### Railway Platform
- Uses Dockerfile builder (configured in `railway.toml`)
- Binds to `0.0.0.0:PORT` for Railway compatibility
- Health check endpoint at `/api/health`
- Supports custom domain configuration

### Docker Configuration
- Node.js 18 Alpine base image
- Non-root user (`nextjs:nodejs`) for security
- Working directory: `/app`
- Exposed port: 8080 (Railway requirement)

## Google Cloud Setup Requirements

### APIs to Enable
1. **Places API (New)** - Primary search functionality
2. **Geocoding API** - Address conversion
3. **Maps JavaScript API** - Map integration (optional)

### API Key Restrictions
```
Application Restrictions:
- HTTP referrers: yourdomain.railway.app/*

API Restrictions:  
- Places API (New)
- Geocoding API
```

## Common Issues & Solutions

### Place Type Errors
If you see "Unsupported types" errors, remove unsupported types from `PLACE_TYPES` object in `server.js`. Google Places API (New) has stricter type validation than the legacy API.

### Railway Deployment
- Ensure `railway.toml` uses `builder = "dockerfile"`
- Server must bind to `0.0.0.0` not `localhost`
- Set `PORT` environment variable to 8080 for Railway

### API Key Issues
- Enable "Places API (New)" specifically (not legacy Places API)
- Wait 2-3 minutes after enabling APIs
- Check billing is enabled in Google Cloud Console

## Business QR Code Generation

The system supports two QR code types:
1. **General discovery** - User location detected automatically
2. **Business-specific** - Pre-set coordinates for business locations

QR codes encode the base URL with optional lat/lng parameters for immediate location-based discovery.

## Latest Enhancements (Commit: 2bdf4fd)

### 🎯 Production-Ready Features
- **Gallery Image Loading**: Proper loading spinners, error states, and progressive image loading
- **Enhanced Map Markers**: Pin-shaped markers (40x50px) with category icons and drop shadows
- **Persistent Selection**: "SELECTED" text arrows that stay visible until new selection
- **Auto-Zoom**: Automatically zooms to level 17 when selecting locations
- **Robust Place Names**: 4-tier extraction system eliminates "Unknown" locations
- **International Support**: Miles conversion alongside meters for foreign visitors

### 🛠️ Technical Improvements
- **Fixed JavaScript Errors**: Resolved `defaultImages` undefined errors
- **Enhanced Error Handling**: Gallery images show clear error states when loading fails  
- **Improved Performance**: Staggered image loading (200ms intervals) prevents server overload
- **Better UX**: Bounce animations on marker selection with visual feedback
- **Cross-Platform**: Works seamlessly on mobile and desktop devices

### 🏨 Hotel Management Interface
**URL**: `/hotel-map` - Complete hotel nearby places management system
- **Default Location**: 118 Hang Bac, Hanoi Old Quarter (21.034087, 105.85114)
- **Enhanced Discovery**: 20+ locations per category with intelligent search strategies
- **Visual Excellence**: Professional map interface with advanced selection indicators
- **QR Ready**: Perfect for hotel guest QR code generation and testing

### 📱 Mobile Optimization
- **PWA Support**: Installable as mobile app with manifest.json
- **Touch-Friendly**: 44px minimum touch targets for accessibility
- **Responsive Design**: Optimized for all screen sizes
- **Fast Loading**: Optimized assets and progressive enhancement

## Memory Bank Setup

### Key Development Patterns
1. **Always use 4-tier place name extraction** when working with Google Places API
2. **Implement loading states** for all image galleries with spinners and error handling
3. **Use pin-shaped markers** with category icons for better map visibility  
4. **Add persistent selection indicators** that stay visible until new selection
5. **Include auto-zoom functionality** (level 17) for detailed location views
6. **Convert distances to miles** alongside meters for international users

### Critical Code Locations
- **Place Name Extraction**: `server.js:1358-1400`
- **Gallery Loading Logic**: `hotel-map.html:2852-2905` 
- **Map Marker Creation**: `hotel-map.html:2349-2378`
- **Selection Arrow System**: `hotel-map.html:2590-2653`
- **Enhanced Hotel Marker**: `hotel-map.html:1395-1430`

### Deployment Status
- **Repository**: `https://github.com/locle27/nearbyspots-qr.git`
- **Latest Commit**: `2bdf4fd` - Production ready with all enhancements
- **Hosting**: Ready for Railway, Vercel, or any Node.js hosting platform
- **QR Testing**: All functionality verified and ready for production QR codes