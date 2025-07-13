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
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://places.googleapis.com", "https://maps.googleapis.com"],
      connectSrc: ["'self'", "https://places.googleapis.com", "https://maps.googleapis.com", "https://fonts.googleapis.com"],
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

// Serve static files with cache control
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Constants
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DEFAULT_SEARCH_RADIUS = parseInt(process.env.DEFAULT_SEARCH_RADIUS) || 1000;
const MAX_SEARCH_RADIUS = parseInt(process.env.MAX_SEARCH_RADIUS) || 10000;
const RESULTS_PER_CATEGORY = parseInt(process.env.RESULTS_PER_CATEGORY) || 20;

// Default Hotel Location - 118 Hang Bac, Hanoi Old Quarter
const DEFAULT_HOTEL = {
  name: "Old Quarter Hotel",
  address: "118 Hang Bac, Hoan Kiem, Hanoi, Vietnam",
  latitude: 21.034087,
  longitude: 105.85114,
  description: "Discover amazing places near our hotel in Hanoi's historic Old Quarter"
};

// Additional Hotel Locations (can be expanded)
const HOTEL_LOCATIONS = {
  'hanoi-old-quarter': DEFAULT_HOTEL,
  // Add more hotels here:
  // 'saigon-downtown': { name: "...", latitude: 10.7769, longitude: 106.7009, ... },
  // 'da-nang-beach': { name: "...", latitude: 16.0544, longitude: 108.2022, ... }
};

// Security Configuration
const ALLOWED_DOMAINS = [
  'localhost:3000',
  '127.0.0.1:3000',
  'nearbyspots-qr-production.up.railway.app', // Production Railway domain
  process.env.PRODUCTION_DOMAIN, // Your Railway domain
  process.env.CUSTOM_DOMAIN       // Your custom domain
].filter(Boolean);

const QR_SECRET_KEY = process.env.QR_SECRET_KEY || 'your-secret-key-change-in-production';
const crypto = require('crypto');

// Place types for different categories
const PLACE_TYPES = {
  restaurants: ['restaurant', 'meal_takeaway', 'meal_delivery', 'bar', 'night_club'],
  landmarks: ['tourist_attraction'],
  coffee: ['cafe', 'bakery'],
  culture: ['museum', 'art_gallery', 'library', 'cultural_center']
};

// Security Functions
function validateDomain(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.host;
    
    // Check if domain is in allowed list
    const isAllowed = ALLOWED_DOMAINS.some(allowedDomain => {
      return domain === allowedDomain || domain.endsWith('.' + allowedDomain);
    });
    
    if (!isAllowed) {
      console.warn(`🚨 Security Alert: Rejected domain ${domain}. Allowed: ${ALLOWED_DOMAINS.join(', ')}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('🚨 Security Alert: Invalid URL format:', url);
    return false;
  }
}

function sanitizeInput(input, type = 'string') {
  if (!input) return '';
  
  switch (type) {
    case 'number':
      const num = parseFloat(input);
      return isNaN(num) ? 0 : num;
    case 'coordinates':
      const coord = parseFloat(input);
      if (isNaN(coord) || coord < -180 || coord > 180) return null;
      return coord;
    case 'string':
    default:
      return input.toString().trim().substring(0, 200); // Limit length
  }
}

function generateQRSignature(url) {
  const timestamp = Date.now();
  const data = `${url}:${timestamp}`;
  const signature = crypto.createHmac('sha256', QR_SECRET_KEY).update(data).digest('hex');
  return { signature, timestamp };
}

function verifyQRSignature(url, signature, timestamp) {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  // Check if signature is not too old
  if (now - timestamp > maxAge) {
    console.warn('🚨 Security Alert: QR code signature expired');
    return false;
  }
  
  const expectedData = `${url}:${timestamp}`;
  const expectedSignature = crypto.createHmac('sha256', QR_SECRET_KEY).update(expectedData).digest('hex');
  
  const isValid = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
  
  if (!isValid) {
    console.warn('🚨 Security Alert: Invalid QR code signature');
  }
  
  return isValid;
}

function logQRGeneration(ip, userAgent, baseUrl, label, coordinates, success, reason = '') {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip,
    userAgent,
    baseUrl,
    label: sanitizeInput(label),
    coordinates,
    success,
    reason
  };
  
  console.log(`🔒 QR Generation Log:`, JSON.stringify(logEntry));
  
  // In production, save to database or log file
  // await saveSecurityLog(logEntry);
}

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

// Security middleware for QR verification
function verifyQRAccess(req, res, next) {
  const { sig, ts } = req.query;
  
  // If no signature, allow normal access (direct URL visit)
  if (!sig || !ts) {
    next();
    return;
  }
  
  try {
    const timestamp = parseInt(ts);
    const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;
    
    if (!verifyQRSignature(baseUrl, sig, timestamp)) {
      console.warn(`🚨 Security Alert: Invalid QR access from ${req.ip}`);
      return res.status(403).send(`
        <html>
          <head><title>Security Alert</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>🚨 Security Alert</h1>
            <p>This QR code appears to be invalid or tampered with.</p>
            <p>For your security, access has been blocked.</p>
            <a href="/" style="color: #1976D2;">Go to main site</a>
          </body>
        </html>
      `);
    }
    
    // Add security info to request for frontend
    req.qrVerified = true;
    req.qrTimestamp = timestamp;
    
    console.log(`✅ Verified QR access from ${req.ip} at ${new Date(timestamp).toISOString()}`);
    next();
  } catch (error) {
    console.error('QR verification error:', error);
    next(); // Allow access on verification error
  }
}

// Main page with QR security verification
app.get('/', verifyQRAccess, (req, res) => {
  // Check for hotel parameter
  const hotelId = req.query.hotel || 'hanoi-old-quarter';
  const hotel = HOTEL_LOCATIONS[hotelId] || DEFAULT_HOTEL;
  
  // Check for direct coordinates from QR
  const lat = req.query.lat;
  const lng = req.query.lng;
  const label = req.query.label;
  
  let locationData = null;
  
  if (lat && lng) {
    // Use coordinates from QR code
    locationData = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      source: 'qr_coordinates',
      label: label || 'QR Location'
    };
  } else {
    // Use default hotel location
    locationData = {
      latitude: hotel.latitude,
      longitude: hotel.longitude,
      source: 'hotel_default',
      label: hotel.name,
      address: hotel.address,
      description: hotel.description
    };
  }
  
  // Log access information
  if (req.qrVerified) {
    console.log(`📱 Secure QR access verified for ${req.ip} - ${locationData.label}`);
  } else {
    console.log(`🌐 Direct web access from ${req.ip} - Using ${hotel.name}`);
  }
  
  // Read HTML file and inject location data
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  const html = require('fs').readFileSync(htmlPath, 'utf8');
  
  // Inject location data into HTML
  const injectedHtml = html.replace(
    '<script src="app.js?v=4"></script>',
    `<script>
      window.DEFAULT_LOCATION = ${JSON.stringify(locationData)};
    </script>
    <script src="app.js?v=4"></script>`
  );
  
  res.send(injectedHtml);
});

// Secure QR code generation endpoint
app.post('/api/generate-qr', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  try {
    const { baseUrl, latitude, longitude, label } = req.body;
    
    // Input validation
    if (!baseUrl) {
      logQRGeneration(clientIp, userAgent, '', '', null, false, 'Missing base URL');
      return res.status(400).json({ error: 'Base URL is required' });
    }

    // Validate domain security
    if (!validateDomain(baseUrl)) {
      logQRGeneration(clientIp, userAgent, baseUrl, label, null, false, 'Domain not allowed');
      return res.status(403).json({ 
        error: 'Domain not allowed for security reasons',
        allowedDomains: ALLOWED_DOMAINS 
      });
    }

    // Sanitize inputs
    const cleanLabel = sanitizeInput(label, 'string');
    const cleanLat = latitude ? sanitizeInput(latitude, 'coordinates') : null;
    const cleanLng = longitude ? sanitizeInput(longitude, 'coordinates') : null;
    
    // Validate coordinates if provided
    if ((latitude && cleanLat === null) || (longitude && cleanLng === null)) {
      logQRGeneration(clientIp, userAgent, baseUrl, cleanLabel, { lat: latitude, lng: longitude }, false, 'Invalid coordinates');
      return res.status(400).json({ error: 'Invalid coordinates. Must be between -180 and 180' });
    }

    // Create secure URL with validated parameters
    let qrUrl = baseUrl;
    const params = new URLSearchParams();
    
    if (cleanLat !== null && cleanLng !== null) {
      params.append('lat', cleanLat.toString());
      params.append('lng', cleanLng.toString());
    }
    
    if (cleanLabel) {
      params.append('label', cleanLabel);
    }

    // Add security signature
    const { signature, timestamp } = generateQRSignature(qrUrl);
    params.append('sig', signature);
    params.append('ts', timestamp.toString());
    
    if (params.toString()) {
      qrUrl += '?' + params.toString();
    }

    // Generate QR code with security features
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 3,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H' // High error correction for security
    });

    // Log successful generation
    logQRGeneration(clientIp, userAgent, baseUrl, cleanLabel, { lat: cleanLat, lng: cleanLng }, true, 'Success');

    res.json({
      success: true,
      qrCode: qrCodeDataUrl,
      url: qrUrl,
      security: {
        signed: true,
        timestamp,
        domain: new URL(baseUrl).host,
        expiresIn: '24 hours'
      }
    });
  } catch (error) {
    console.error('🚨 QR generation error:', error);
    logQRGeneration(clientIp, userAgent, req.body.baseUrl || '', req.body.label || '', null, false, error.message);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Hotel-specific QR code generation endpoint
app.post('/api/generate-hotel-qr', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  try {
    const { hotelId, customLocation } = req.body;
    
    // Determine hotel data
    let hotel;
    if (customLocation && customLocation.latitude && customLocation.longitude) {
      // Custom hotel location
      hotel = {
        name: customLocation.name || 'Custom Hotel',
        latitude: parseFloat(customLocation.latitude),
        longitude: parseFloat(customLocation.longitude),
        address: customLocation.address || 'Custom Location'
      };
    } else {
      // Use predefined hotel
      const selectedHotelId = hotelId || 'hanoi-old-quarter';
      hotel = HOTEL_LOCATIONS[selectedHotelId] || DEFAULT_HOTEL;
    }
    
    // Validate coordinates
    if (!hotel.latitude || !hotel.longitude) {
      logQRGeneration(clientIp, userAgent, '', hotel.name, null, false, 'Invalid hotel coordinates');
      return res.status(400).json({ error: 'Invalid hotel coordinates' });
    }
    
    // Create base URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // Validate domain security
    if (!validateDomain(baseUrl)) {
      logQRGeneration(clientIp, userAgent, baseUrl, hotel.name, null, false, 'Domain not allowed');
      return res.status(403).json({ 
        error: 'Domain not allowed for security reasons',
        allowedDomains: ALLOWED_DOMAINS 
      });
    }

    // Create secure URL with hotel location
    let qrUrl = baseUrl;
    const params = new URLSearchParams();
    
    // Add hotel coordinates
    params.append('lat', hotel.latitude.toString());
    params.append('lng', hotel.longitude.toString());
    params.append('label', hotel.name);
    
    if (hotelId && hotelId !== 'hanoi-old-quarter') {
      params.append('hotel', hotelId);
    }

    // Add security signature
    const { signature, timestamp } = generateQRSignature(qrUrl);
    params.append('sig', signature);
    params.append('ts', timestamp.toString());
    
    qrUrl += '?' + params.toString();

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 3,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    });

    // Log successful generation
    logQRGeneration(clientIp, userAgent, baseUrl, hotel.name, { lat: hotel.latitude, lng: hotel.longitude }, true, 'Hotel QR Success');

    res.json({
      success: true,
      qrCode: qrCodeDataUrl,
      url: qrUrl,
      hotel: {
        name: hotel.name,
        address: hotel.address,
        latitude: hotel.latitude,
        longitude: hotel.longitude
      },
      security: {
        signed: true,
        timestamp,
        domain: new URL(baseUrl).host,
        expiresIn: '24 hours'
      }
    });
  } catch (error) {
    console.error('🚨 Hotel QR generation error:', error);
    logQRGeneration(clientIp, userAgent, req.body.baseUrl || '', req.body.hotelId || '', null, false, error.message);
    res.status(500).json({ error: 'Failed to generate hotel QR code' });
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
        console.log(`Searching ${category} with types: ${types.join(', ')}`);
        const places = await searchNearbyPlaces(latitude, longitude, searchRadius, types);
        console.log(`Found ${places.length} ${category} places`);
        
        results[category] = places.map(place => {
          const distance = calculateDistance(
            latitude,
            longitude,
            place.location.latitude,
            place.location.longitude
          );

          console.log(`Place: ${place.displayName?.text}, Photos: ${place.photos?.length || 0}`);
          if (place.photos && place.photos.length > 0) {
            console.log(`First photo name: ${place.photos[0].name}`);
          }

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

    console.log(`Fetching photo: ${photoName}`);
    const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeightPx}&maxWidthPx=${maxWidthPx}&key=${GOOGLE_MAPS_API_KEY}`;
    
    try {
      const photoResponse = await axios.get(photoUrl, {
        responseType: 'stream',
        timeout: 10000
      });
      
      // Set proper headers
      res.setHeader('Content-Type', photoResponse.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Pipe the image data
      photoResponse.data.pipe(res);
    } catch (photoError) {
      console.error('Failed to fetch photo from Google:', photoError.message);
      res.status(404).json({ error: 'Photo not found' });
    }
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