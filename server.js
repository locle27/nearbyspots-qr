require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const QRCode = require('qrcode');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://places.googleapis.com", "https://maps.googleapis.com"],
      connectSrc: ["'self'", "https://places.googleapis.com", "https://api.openstreetmap.org"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Constants
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DEFAULT_SEARCH_RADIUS = parseInt(process.env.DEFAULT_SEARCH_RADIUS) || 1000;
const MAX_SEARCH_RADIUS = parseInt(process.env.MAX_SEARCH_RADIUS) || 10000;
const RESULTS_PER_CATEGORY = parseInt(process.env.RESULTS_PER_CATEGORY) || 10;

// Place types for different categories
const PLACE_TYPES = {
  restaurants: ['restaurant', 'meal_takeaway', 'food'],
  landmarks: ['tourist_attraction', 'point_of_interest', 'establishment'],
  coffee: ['cafe', 'bakery'],
  culture: ['museum', 'art_gallery', 'library', 'theater', 'cultural_center']
};

// Utility function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Google Places API integration
async function searchNearbyPlaces(latitude, longitude, radius, types) {
  try {
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        includedTypes: types,
        maxResultCount: RESULTS_PER_CATEGORY,
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: Math.min(radius, MAX_SEARCH_RADIUS)
          }
        },
        languageCode: 'en'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.types,places.websiteUri,places.id'
        },
        timeout: 10000
      }
    );

    return response.data.places || [];
  } catch (error) {
    console.error('Google Places API error:', error.response?.data || error.message);
    throw new Error('Failed to fetch nearby places');
  }
}

// Generate Google Maps URL for directions
function generateMapsUrl(destinationLat, destinationLng, placeName) {
  const baseUrl = 'https://www.google.com/maps/dir/';
  const destination = `${destinationLat},${destinationLng}`;
  return `${baseUrl}?api=1&destination=${encodeURIComponent(destination)}&destination_place_id=${encodeURIComponent(placeName)}`;
}

// Routes

// Main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// QR code generation endpoint
app.post('/api/generate-qr', async (req, res) => {
  try {
    const { baseUrl, latitude, longitude, label } = req.body;
    
    if (!baseUrl) {
      return res.status(400).json({ error: 'Base URL is required' });
    }

    // Create URL with optional location parameters
    let qrUrl = baseUrl;
    const params = new URLSearchParams();
    
    if (latitude && longitude) {
      params.append('lat', latitude);
      params.append('lng', longitude);
    }
    
    if (label) {
      params.append('label', label);
    }
    
    if (params.toString()) {
      qrUrl += '?' + params.toString();
    }

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.json({
      success: true,
      qrCode: qrCodeDataUrl,
      url: qrUrl
    });
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Search nearby places endpoint
app.post('/api/search-nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = DEFAULT_SEARCH_RADIUS } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const searchRadius = Math.min(parseInt(radius), MAX_SEARCH_RADIUS);
    const results = {};

    // Search for each category
    for (const [category, types] of Object.entries(PLACE_TYPES)) {
      try {
        const places = await searchNearbyPlaces(latitude, longitude, searchRadius, types);
        
        results[category] = places.map(place => {
          const distance = calculateDistance(
            latitude,
            longitude,
            place.location.latitude,
            place.location.longitude
          );

          return {
            id: place.id,
            name: place.displayName?.text || 'Unknown',
            address: place.formattedAddress || '',
            location: place.location,
            rating: place.rating || 0,
            userRatingCount: place.userRatingCount || 0,
            distance: Math.round(distance),
            photos: place.photos?.map(photo => ({
              name: photo.name,
              widthPx: photo.widthPx,
              heightPx: photo.heightPx
            })) || [],
            websiteUri: place.websiteUri || '',
            mapsUrl: generateMapsUrl(place.location.latitude, place.location.longitude, place.displayName?.text || ''),
            types: place.types || []
          };
        }).sort((a, b) => a.distance - b.distance);
      } catch (categoryError) {
        console.error(`Error searching ${category}:`, categoryError);
        results[category] = [];
      }
    }

    res.json({
      success: true,
      location: { latitude, longitude },
      radius: searchRadius,
      results
    });
  } catch (error) {
    console.error('Search nearby error:', error);
    res.status(500).json({ error: 'Failed to search nearby places' });
  }
});

// Geocode address endpoint
app.post('/api/geocode-address', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await axios.get(geocodeUrl, { timeout: 10000 });
    
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      res.json({
        success: true,
        latitude: location.lat,
        longitude: location.lng,
        address: response.data.results[0].formatted_address
      });
    } else {
      res.status(404).json({ error: 'Address not found. Please try a different address.' });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// Get place photo
app.get('/api/place-photo/:photoName', async (req, res) => {
  try {
    const { photoName } = req.params;
    const { maxHeightPx = 400, maxWidthPx = 400 } = req.query;

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeightPx}&maxWidthPx=${maxWidthPx}&key=${GOOGLE_MAPS_API_KEY}`;
    
    res.redirect(photoUrl);
  } catch (error) {
    console.error('Photo fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NearbySpots QR Discovery Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗺️  Google Maps API: ${GOOGLE_MAPS_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
});