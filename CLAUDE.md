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
RESULTS_PER_CATEGORY=20        # Google Places API (New) maximum limit is 20
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

### Google Places API (New) Limitations
- **Maximum Results**: Only 1-20 results per request (set `RESULTS_PER_CATEGORY=20`)
- **Unsupported Types**: Remove unsupported types from `PLACE_TYPES` object in `server.js`
- **Stricter Validation**: Google Places API (New) has stricter type validation than legacy API

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

## Current System Capabilities

### 🌍 Worldwide Hotel Support
- **Any Location**: Paste Google Maps URL of any hotel/accommodation worldwide
- **Smart Extraction**: Automatically extracts coordinates from various URL formats
- **Address Lookup**: Converts coordinates to readable addresses via reverse geocoding
- **Dynamic Updates**: Updates all interface elements with new location information

### 📱 Professional Mobile Experience  
- **Native Feel**: Bottom sheet modal that slides up from bottom on mobile
- **Touch Optimized**: Proper touch targets, smooth scrolling, intuitive gestures
- **Professional Design**: Modern typography, gradient badges, clean spacing
- **Cross-Platform**: Seamless experience on both mobile and desktop

### 🎯 Single Category Focus
- **Cleaner Viewing**: Select one category at a time for focused results
- **Better Performance**: Fewer API calls, faster loading, clearer map visualization
- **Easy Switching**: Quick category switching with immediate visual feedback

### ⚡ Optimized Performance
- **Smart Loading**: 300ms sequential photo loading prevents API rate limits
- **Adaptive Throttling**: Automatically adjusts based on API response success/failure
- **Fast Initial Display**: First 2 photos load in parallel for immediate visual feedback
- **Error Recovery**: Intelligent retry logic with exponential backoff

## Latest Enhancements (Commit: 135d063)

### 🎯 Professional Mobile-First Interface
- **Mobile Bottom Sheet Modal**: Native-feeling slide-up modal for place details
- **Professional Typography**: Enhanced readability with 1.5rem headers and proper spacing
- **Color-Coded Stats**: Gradient badges for rating (yellow), distance (blue), category (green)
- **Google Maps Style Selection**: Pulsing blue circle indicators replace arrow system
- **Smart Highlighting**: Selected markers enlarge, others dim for better focus
- **Native Mobile Sharing**: Share places with native APIs or clipboard fallback

### ⚡ Optimized Performance
- **Smart Photo Loading**: Sequential loading with 300ms delays prevents 429 errors
- **Parallel Initial Loading**: First 2 photos load simultaneously for instant feedback
- **Adaptive Rate Limiting**: Automatically adjusts delays based on API success/failure
- **Faster Retries**: Linear backoff (500ms, 1s) vs exponential for quicker recovery
- **2-3x Faster Galleries**: Optimized from 800ms to 300ms base delays

### 🎛️ Enhanced User Controls
- **Single Category Selection**: One category at a time for cleaner viewing
- **Hotel Location Input**: Paste any Google Maps URL to set custom location
- **Smart Coordinate Extraction**: Supports multiple Google Maps URL formats
- **Real-time Location Updates**: Automatic address lookup and interface updates
- **Worldwide Support**: Works with any hotel/accommodation globally

### 🔧 Critical API Fixes
- **Google Places API Limit Fix**: Corrected maxResultCount from 100 to 20 (API requirement)
- **Comprehensive Error Handling**: Detailed API debugging with success/failure tracking
- **Rate Limit Compliance**: Sequential loading prevents 429 "Too Many Requests" errors
- **Robust Place Names**: 4-tier extraction system eliminates "Unknown" locations
- **Enhanced Photo Loading**: Progressive loading with validation and fallbacks

### 🏨 Flexible Location System
**Default**: 118 Hang Bac, Hanoi Old Quarter (21.034087, 105.85114)
**Custom Locations**: Any Google Maps URL can set new hotel location
- **Multi-format URL Support**: @lat,lng, q=lat,lng, !3d!4d, ll=lat,lng formats
- **Automatic Geocoding**: Converts coordinates to readable addresses
- **Map Recentering**: Updates hotel marker and map center dynamically
- **Clear Workflow**: Location change → clear places → prompt to reload

## Memory Bank Setup

### Key Development Patterns
1. **Single Category Selection**: Use `activeCategories.clear()` then `activeCategories.add(category)` for single selection
2. **Sequential Photo Loading**: Implement 300ms delays with adaptive rate limiting for Google Photos API
3. **Mobile-First Modal Design**: Bottom sheet with slide-up animation on mobile, centered on desktop
4. **Google Maps URL Extraction**: Support multiple URL patterns (@lat,lng, q=lat,lng, !3d!4d, ll=lat,lng)
5. **Professional Typography**: Use 1.5rem headers, gradient stat badges, proper spacing (24px/16px)
6. **API Rate Limit Compliance**: Never exceed 20 results per Google Places API request
7. **Smart Selection Indicators**: Pulsing blue circles with marker dimming/highlighting effects

### Critical Code Locations
- **Single Category Selection**: `index.html:1655-1683` (event handlers)
- **Hotel Location Input**: `index.html:3507-3638` (coordinate extraction and update)
- **Sequential Photo Loading**: `index.html:3220-3358` (adaptive rate limiting)
- **Mobile Modal Design**: `index.html:715-856` (CSS) and `index.html:3183-3207` (JS)
- **Google Maps Selection**: `index.html:2667-2708` (pulsing circle indicators)
- **API Rate Limiting**: `server.js:292-349` (maxResultCount validation)
- **Place Name Extraction**: `server.js:1358-1400` (4-tier fallback system)

### Deployment Status
- **Repository**: `https://github.com/locle27/nearbyspots-qr.git`
- **Latest Commit**: `135d063` - Professional mobile interface with worldwide hotel support
- **Production Status**: ✅ **FULLY OPERATIONAL** - Professional mobile-first interface
- **Global Support**: ✅ Works worldwide with any hotel/accommodation location
- **QR Testing**: All functionality verified including new location input features

### Recent Major Updates
- **2024-01**: Mobile-first redesign with professional bottom sheet modal
- **2024-01**: Smart photo loading with 429 error prevention and 2-3x speed improvement  
- **2024-01**: Single category selection for cleaner viewing experience
- **2024-01**: Worldwide hotel location support via Google Maps URL input
- **2024-01**: Google Maps style selection indicators with smart highlighting
- **2024-01**: Critical API fixes for Google Places API rate limiting compliance