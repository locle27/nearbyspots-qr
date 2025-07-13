# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a QR code-powered web application that enables users to discover nearby restaurants, landmarks, coffee shops, and cultural sites. The system consists of a Node.js backend with Google Places API integration and a mobile-first vanilla JavaScript frontend with PWA capabilities.

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
- **Responsive design** with 44px minimum touch targets for accessibility
- **4 discovery categories**: restaurants, landmarks, coffee shops, culture

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
- `/api/search-nearby` - Main search with lat/lng and radius
- `/api/geocode-address` - Convert address to coordinates  
- `/api/generate-qr` - Create QR codes for business locations
- `/api/place-photo/:photoName` - Proxy for Google Photos API

## Environment Variables

Required:
```bash
GOOGLE_MAPS_API_KEY=your_api_key_here
```

Optional with defaults:
```bash
PORT=3000
RESULTS_PER_CATEGORY=20        # Places returned per category
DEFAULT_SEARCH_RADIUS=1000     # Default search radius in meters
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