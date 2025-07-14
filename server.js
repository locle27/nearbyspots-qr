require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const QRCode = require('qrcode');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://maps.googleapis.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://places.googleapis.com", "https://maps.googleapis.com", "https://lh3.googleusercontent.com", "https://maps.gstatic.com"],
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
const DEFAULT_SEARCH_RADIUS = parseInt(process.env.DEFAULT_SEARCH_RADIUS) || 2000; // Increased from 1000m to 2000m for better coverage
const MAX_SEARCH_RADIUS = parseInt(process.env.MAX_SEARCH_RADIUS) || 10000;
const RESULTS_PER_CATEGORY = parseInt(process.env.RESULTS_PER_CATEGORY) || 100; // Increased to 100 for better landmark coverage

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

// Place types for different categories - expanded for better coverage
const PLACE_TYPES = {
  restaurants: ['restaurant'],
  landmarks: ['tourist_attraction'], // Will make enhanced searches for landmarks
  coffee: ['cafe'], // Will make multiple calls for coffee shops
  culture: ['museum']
};

// Manual Recommendations Storage
const RECOMMENDATIONS_FILE = path.join(__dirname, 'data', 'recommendations.json');
let manualRecommendations = [];

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load existing recommendations on startup
function loadRecommendations() {
  try {
    if (fs.existsSync(RECOMMENDATIONS_FILE)) {
      const data = fs.readFileSync(RECOMMENDATIONS_FILE, 'utf8');
      manualRecommendations = JSON.parse(data);
      console.log(`📋 Loaded ${manualRecommendations.length} manual recommendations`);
    } else {
      // Create default recommendations for demo
      manualRecommendations = [
        {
          id: 'rec_001',
          name: 'Hanoi Old Quarter Walking Tour',
          address: '36 Streets, Hoan Kiem, Hanoi, Vietnam',
          location: {
            latitude: 21.033333,
            longitude: 105.85
          },
          rating: 4.8,
          userRatingCount: 127,
          distance: 150,
          description: 'Explore the historic heart of Hanoi with narrow streets, traditional shops, and colonial architecture.',
          category: 'recommend',
          photos: [],
          websiteUri: '',
          addedBy: 'hotel_management',
          addedDate: new Date().toISOString(),
          featured: true
        },
        {
          id: 'rec_002', 
          name: 'Hoan Kiem Lake & Ngoc Son Temple',
          address: 'Hoan Kiem Lake, Hanoi, Vietnam',
          location: {
            latitude: 21.028511,
            longitude: 105.852245
          },
          rating: 4.6,
          userRatingCount: 89,
          distance: 300,
          description: 'Peaceful lake in the city center with a beautiful temple on a small island.',
          category: 'recommend',
          photos: [],
          websiteUri: '',
          addedBy: 'hotel_management',
          addedDate: new Date().toISOString(),
          featured: true
        }
      ];
      saveRecommendations();
    }
  } catch (error) {
    console.error('Error loading recommendations:', error);
    manualRecommendations = [];
  }
}

// Save recommendations to file
function saveRecommendations() {
  try {
    fs.writeFileSync(RECOMMENDATIONS_FILE, JSON.stringify(manualRecommendations, null, 2));
    console.log(`💾 Saved ${manualRecommendations.length} recommendations`);
  } catch (error) {
    console.error('Error saving recommendations:', error);
  }
}

// Generate unique ID for recommendations
function generateRecommendationId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `rec_${timestamp}_${random}`;
}

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
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.id'
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

// Hotel-map route now redirects to main interface (they're the same)
app.get('/hotel-map', (req, res) => {
  res.redirect('/');
});

// Legacy mobile interface (if needed for specific use cases)
app.get('/mobile', verifyQRAccess, (req, res) => {
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
  
  // Legacy interface no longer available - redirect to main interface
  console.log(`Legacy mobile interface requested, redirecting to main interface`);
  res.redirect('/');
});

// Main page with QR security verification - now serves hotel-map directly
app.get('/', verifyQRAccess, (req, res) => {
  // Log access information
  const clientIp = req.ip || req.connection.remoteAddress;
  if (req.qrVerified) {
    console.log(`📱 Secure QR access verified for ${clientIp} - Loading hotel-map interface`);
  } else {
    console.log(`🌐 Direct web access from ${clientIp} - Loading hotel-map interface`);
  }
  
  // Serve the enhanced hotel-map interface directly (now copied to index.html)
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(htmlPath);
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

// Get manual recommendations endpoint
app.get('/api/recommendations', (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    
    let recommendations = [...manualRecommendations];
    
    // If coordinates provided, calculate distances and sort by distance
    if (latitude && longitude) {
      const userLat = parseFloat(latitude);
      const userLng = parseFloat(longitude);
      
      if (!isNaN(userLat) && !isNaN(userLng)) {
        recommendations = recommendations.map(rec => ({
          ...rec,
          distance: Math.round(calculateDistance(
            userLat, userLng,
            rec.location.latitude, rec.location.longitude
          ))
        })).sort((a, b) => a.distance - b.distance);
      }
    }
    
    console.log(`📋 Returning ${recommendations.length} manual recommendations`);
    
    res.json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Add new recommendation endpoint
app.post('/api/recommendations', (req, res) => {
  try {
    const {
      name,
      address,
      latitude,
      longitude,
      rating = 0,
      userRatingCount = 0,
      description = '',
      websiteUri = '',
      featured = false
    } = req.body;
    
    // Validation
    if (!name || !address || !latitude || !longitude) {
      return res.status(400).json({
        error: 'Missing required fields: name, address, latitude, longitude'
      });
    }
    
    // Validate coordinates
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        error: 'Invalid coordinates. Latitude must be -90 to 90, longitude must be -180 to 180'
      });
    }
    
    // Create new recommendation
    const newRecommendation = {
      id: generateRecommendationId(),
      name: sanitizeInput(name, 'string'),
      address: sanitizeInput(address, 'string'),
      location: {
        latitude: lat,
        longitude: lng
      },
      rating: Math.max(0, Math.min(5, parseFloat(rating) || 0)),
      userRatingCount: Math.max(0, parseInt(userRatingCount) || 0),
      distance: 0, // Will be calculated when requested with coordinates
      description: sanitizeInput(description, 'string'),
      category: 'recommend',
      photos: [],
      websiteUri: sanitizeInput(websiteUri, 'string'),
      addedBy: 'manual_entry',
      addedDate: new Date().toISOString(),
      featured: Boolean(featured)
    };
    
    // Add to recommendations
    manualRecommendations.push(newRecommendation);
    saveRecommendations();
    
    console.log(`➕ Added new recommendation: ${newRecommendation.name}`);
    
    res.status(201).json({
      success: true,
      message: 'Recommendation added successfully',
      recommendation: newRecommendation
    });
  } catch (error) {
    console.error('Error adding recommendation:', error);
    res.status(500).json({ error: 'Failed to add recommendation' });
  }
});

// Update recommendation endpoint
app.put('/api/recommendations/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Find recommendation
    const recIndex = manualRecommendations.findIndex(rec => rec.id === id);
    if (recIndex === -1) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    
    // Validate and sanitize update data
    const allowedUpdates = [
      'name', 'address', 'latitude', 'longitude', 'rating', 
      'userRatingCount', 'description', 'websiteUri', 'featured'
    ];
    
    const updates = {};
    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key)) {
        if (key === 'latitude' || key === 'longitude') {
          const coord = parseFloat(updateData[key]);
          if (!isNaN(coord) && coord >= -180 && coord <= 180) {
            if (key === 'latitude' && (coord < -90 || coord > 90)) return;
            if (!updates.location) updates.location = { ...manualRecommendations[recIndex].location };
            updates.location[key] = coord;
          }
        } else if (key === 'rating') {
          updates[key] = Math.max(0, Math.min(5, parseFloat(updateData[key]) || 0));
        } else if (key === 'userRatingCount') {
          updates[key] = Math.max(0, parseInt(updateData[key]) || 0);
        } else if (key === 'featured') {
          updates[key] = Boolean(updateData[key]);
        } else {
          updates[key] = sanitizeInput(updateData[key], 'string');
        }
      }
    });
    
    // Apply updates
    Object.assign(manualRecommendations[recIndex], updates);
    manualRecommendations[recIndex].updatedDate = new Date().toISOString();
    
    saveRecommendations();
    
    console.log(`✏️ Updated recommendation: ${manualRecommendations[recIndex].name}`);
    
    res.json({
      success: true,
      message: 'Recommendation updated successfully',
      recommendation: manualRecommendations[recIndex]
    });
  } catch (error) {
    console.error('Error updating recommendation:', error);
    res.status(500).json({ error: 'Failed to update recommendation' });
  }
});

// Delete recommendation endpoint
app.delete('/api/recommendations/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Find and remove recommendation
    const recIndex = manualRecommendations.findIndex(rec => rec.id === id);
    if (recIndex === -1) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    
    const deletedRec = manualRecommendations.splice(recIndex, 1)[0];
    saveRecommendations();
    
    console.log(`🗑️ Deleted recommendation: ${deletedRec.name}`);
    
    res.json({
      success: true,
      message: 'Recommendation deleted successfully',
      deletedRecommendation: deletedRec
    });
  } catch (error) {
    console.error('Error deleting recommendation:', error);
    res.status(500).json({ error: 'Failed to delete recommendation' });
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

    // Add manual recommendations to results if they exist
    if (manualRecommendations.length > 0) {
      const recommendationsWithDistance = manualRecommendations.map(rec => ({
        ...rec,
        distance: Math.round(calculateDistance(
          latitude, longitude,
          rec.location.latitude, rec.location.longitude
        ))
      })).filter(rec => rec.distance <= searchRadius)
        .sort((a, b) => a.distance - b.distance);
      
      if (recommendationsWithDistance.length > 0) {
        results.recommend = recommendationsWithDistance;
        console.log(`Added ${recommendationsWithDistance.length} manual recommendations within ${searchRadius}m`);
      }
    }

    // Search for each category with special handling for coffee
    for (const [category, types] of Object.entries(PLACE_TYPES)) {
      try {
        let allPlacesForCategory = [];
        
        if (category === 'landmarks') {
          // For landmarks, make multiple searches to get more comprehensive results
          console.log(`Searching landmarks with multiple strategies`);
          
          // Search 1: Tourist attractions
          const touristAttractions = await searchNearbyPlaces(latitude, longitude, searchRadius, ['tourist_attraction']);
          console.log(`Found ${touristAttractions.length} tourist attraction places`);
          allPlacesForCategory.push(...touristAttractions);
          
          // Search 2: Historical landmarks (using text search)
          try {
            const landmarkResponse = await axios.post(
              'https://places.googleapis.com/v1/places:searchText',
              {
                textQuery: 'historical landmark monument temple pagoda',
                locationBias: {
                  circle: {
                    center: { latitude, longitude },
                    radius: Math.min(searchRadius, MAX_SEARCH_RADIUS)
                  }
                },
                maxResultCount: RESULTS_PER_CATEGORY,
                languageCode: 'en'
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                  'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.id'
                },
                timeout: 10000
              }
            );

            if (landmarkResponse.data.places) {
              const textLandmarks = landmarkResponse.data.places.map(place => {
                // Better name extraction
                let placeName = 'Unknown Landmark';
                if (place.displayName?.text) {
                  placeName = place.displayName.text;
                } else if (place.name) {
                  placeName = place.name;
                } else if (place.formattedAddress) {
                  const addressParts = place.formattedAddress.split(',');
                  if (addressParts.length > 0 && addressParts[0].trim().length > 0) {
                    placeName = addressParts[0].trim();
                  }
                }
                
                return {
                  id: place.id,
                  name: placeName,
                  address: place.formattedAddress || 'Address not available',
                  location: place.location || { latitude: 0, longitude: 0 },
                  rating: place.rating || 0,
                  userRatingCount: place.userRatingCount || 0,
                  photos: (place.photos && place.photos.length > 0) ? place.photos : [],
                  websiteUri: place.websiteUri || '',
                  distance: calculateDistance(
                    latitude,
                    longitude,
                    place.location?.latitude || 0,
                    place.location?.longitude || 0
                  )
                };
              }).filter(place => place.distance <= searchRadius && place.name !== 'Unknown Landmark');

              console.log(`Found ${textLandmarks.length} text search landmarks`);
              allPlacesForCategory.push(...textLandmarks);
            }
          } catch (textSearchError) {
            console.error('Text search for landmarks failed:', textSearchError.message);
          }
          
          // Search 3: Religious sites (using text search)
          try {
            const religiousResponse = await axios.post(
              'https://places.googleapis.com/v1/places:searchText',
              {
                textQuery: 'temple pagoda church cathedral mosque shrine',
                locationBias: {
                  circle: {
                    center: { latitude, longitude },
                    radius: Math.min(searchRadius, MAX_SEARCH_RADIUS)
                  }
                },
                maxResultCount: RESULTS_PER_CATEGORY,
                languageCode: 'en'
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                  'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.id'
                },
                timeout: 10000
              }
            );

            if (religiousResponse.data.places) {
              const religiousLandmarks = religiousResponse.data.places.map(place => {
                // Better name extraction
                let placeName = 'Unknown Religious Site';
                if (place.displayName?.text) {
                  placeName = place.displayName.text;
                } else if (place.name) {
                  placeName = place.name;
                } else if (place.formattedAddress) {
                  const addressParts = place.formattedAddress.split(',');
                  if (addressParts.length > 0 && addressParts[0].trim().length > 0) {
                    placeName = addressParts[0].trim();
                  }
                }
                
                return {
                  id: place.id,
                  name: placeName,
                  address: place.formattedAddress || 'Address not available',
                  location: place.location || { latitude: 0, longitude: 0 },
                  rating: place.rating || 0,
                  userRatingCount: place.userRatingCount || 0,
                  photos: (place.photos && place.photos.length > 0) ? place.photos : [],
                  websiteUri: place.websiteUri || '',
                  distance: calculateDistance(
                    latitude,
                    longitude,
                    place.location?.latitude || 0,
                    place.location?.longitude || 0
                  )
                };
              }).filter(place => place.distance <= searchRadius && place.name !== 'Unknown Religious Site');

              console.log(`Found ${religiousLandmarks.length} religious landmarks`);
              allPlacesForCategory.push(...religiousLandmarks);
            }
          } catch (religiousSearchError) {
            console.error('Religious landmarks search failed:', religiousSearchError.message);
          }
        } else if (category === 'restaurants') {
          // For restaurants, make multiple searches to get more comprehensive results
          console.log(`Searching restaurants with multiple strategies`);
          
          // Search 1: Standard restaurants
          const restaurantPlaces = await searchNearbyPlaces(latitude, longitude, searchRadius, ['restaurant']);
          console.log(`Found ${restaurantPlaces.length} restaurant places`);
          allPlacesForCategory.push(...restaurantPlaces);
          
          // Search 2: Food establishments (using text search)
          try {
            const foodResponse = await axios.post(
              'https://places.googleapis.com/v1/places:searchText',
              {
                textQuery: 'restaurant dining food eat meal',
                locationBias: {
                  circle: {
                    center: { latitude, longitude },
                    radius: Math.min(searchRadius, MAX_SEARCH_RADIUS)
                  }
                },
                maxResultCount: RESULTS_PER_CATEGORY,
                languageCode: 'en'
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                  'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.id'
                },
                timeout: 10000
              }
            );

            if (foodResponse.data.places) {
              const textRestaurants = foodResponse.data.places.map(place => {
                // Better name extraction
                let placeName = 'Unknown Restaurant';
                if (place.displayName?.text) {
                  placeName = place.displayName.text;
                } else if (place.name) {
                  placeName = place.name;
                } else if (place.formattedAddress) {
                  // Extract name from address if needed
                  const addressParts = place.formattedAddress.split(',');
                  if (addressParts.length > 0 && addressParts[0].trim().length > 0) {
                    placeName = addressParts[0].trim();
                  }
                }
                
                return {
                  id: place.id,
                  name: placeName,
                  address: place.formattedAddress || 'Address not available',
                  location: place.location || { latitude: 0, longitude: 0 },
                  rating: place.rating || 0,
                  userRatingCount: place.userRatingCount || 0,
                  photos: (place.photos && place.photos.length > 0) ? place.photos : [],
                  websiteUri: place.websiteUri || '',
                  distance: calculateDistance(
                    latitude,
                    longitude,
                    place.location?.latitude || 0,
                    place.location?.longitude || 0
                  )
                };
              }).filter(place => place.distance <= searchRadius && place.name !== 'Unknown Restaurant');

              console.log(`Found ${textRestaurants.length} text search restaurants`);
              allPlacesForCategory.push(...textRestaurants);
            }
          } catch (textSearchError) {
            console.error('Text search for restaurants failed:', textSearchError.message);
          }
          
          // Search 3: Specific cuisine types (using text search)
          try {
            const cuisineResponse = await axios.post(
              'https://places.googleapis.com/v1/places:searchText',
              {
                textQuery: 'pho banh mi vietnamese asian italian french cafe bistro',
                locationBias: {
                  circle: {
                    center: { latitude, longitude },
                    radius: Math.min(searchRadius, MAX_SEARCH_RADIUS)
                  }
                },
                maxResultCount: RESULTS_PER_CATEGORY,
                languageCode: 'en'
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                  'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.id'
                },
                timeout: 10000
              }
            );

            if (cuisineResponse.data.places) {
              const cuisineRestaurants = cuisineResponse.data.places.map(place => {
                // Better name extraction
                let placeName = 'Unknown Restaurant';
                if (place.displayName?.text) {
                  placeName = place.displayName.text;
                } else if (place.name) {
                  placeName = place.name;
                } else if (place.formattedAddress) {
                  const addressParts = place.formattedAddress.split(',');
                  if (addressParts.length > 0 && addressParts[0].trim().length > 0) {
                    placeName = addressParts[0].trim();
                  }
                }
                
                return {
                  id: place.id,
                  name: placeName,
                  address: place.formattedAddress || 'Address not available',
                  location: place.location || { latitude: 0, longitude: 0 },
                  rating: place.rating || 0,
                  userRatingCount: place.userRatingCount || 0,
                  photos: (place.photos && place.photos.length > 0) ? place.photos : [],
                  websiteUri: place.websiteUri || '',
                  distance: calculateDistance(
                    latitude,
                    longitude,
                    place.location?.latitude || 0,
                    place.location?.longitude || 0
                  )
                };
              }).filter(place => place.distance <= searchRadius && place.name !== 'Unknown Restaurant');

              console.log(`Found ${cuisineRestaurants.length} cuisine-specific restaurants`);
              allPlacesForCategory.push(...cuisineRestaurants);
            }
          } catch (cuisineSearchError) {
            console.error('Cuisine search for restaurants failed:', cuisineSearchError.message);
          }
        } else if (category === 'culture') {
          // For culture, make multiple searches to get more comprehensive results
          console.log(`Searching cultural sites with multiple strategies`);
          
          // Search 1: Museums
          const museumPlaces = await searchNearbyPlaces(latitude, longitude, searchRadius, ['museum']);
          console.log(`Found ${museumPlaces.length} museum places`);
          allPlacesForCategory.push(...museumPlaces);
          
          // Search 2: Cultural sites (using text search)
          try {
            const cultureResponse = await axios.post(
              'https://places.googleapis.com/v1/places:searchText',
              {
                textQuery: 'museum gallery cultural center art exhibition heritage',
                locationBias: {
                  circle: {
                    center: { latitude, longitude },
                    radius: Math.min(searchRadius, MAX_SEARCH_RADIUS)
                  }
                },
                maxResultCount: RESULTS_PER_CATEGORY,
                languageCode: 'en'
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                  'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.id'
                },
                timeout: 10000
              }
            );

            if (cultureResponse.data.places) {
              const textCulturalSites = cultureResponse.data.places.map(place => {
                // Better name extraction
                let placeName = 'Unknown Cultural Site';
                if (place.displayName?.text) {
                  placeName = place.displayName.text;
                } else if (place.name) {
                  placeName = place.name;
                } else if (place.formattedAddress) {
                  const addressParts = place.formattedAddress.split(',');
                  if (addressParts.length > 0 && addressParts[0].trim().length > 0) {
                    placeName = addressParts[0].trim();
                  }
                }
                
                return {
                  id: place.id,
                  name: placeName,
                  address: place.formattedAddress || 'Address not available',
                  location: place.location || { latitude: 0, longitude: 0 },
                  rating: place.rating || 0,
                  userRatingCount: place.userRatingCount || 0,
                  photos: (place.photos && place.photos.length > 0) ? place.photos : [],
                  websiteUri: place.websiteUri || '',
                  distance: calculateDistance(
                    latitude,
                    longitude,
                    place.location?.latitude || 0,
                    place.location?.longitude || 0
                  )
                };
              }).filter(place => place.distance <= searchRadius && place.name !== 'Unknown Cultural Site');

              console.log(`Found ${textCulturalSites.length} text search cultural sites`);
              allPlacesForCategory.push(...textCulturalSites);
            }
          } catch (textSearchError) {
            console.error('Text search for cultural sites failed:', textSearchError.message);
          }
          
          // Search 3: Performance venues (using text search)
          try {
            const performanceResponse = await axios.post(
              'https://places.googleapis.com/v1/places:searchText',
              {
                textQuery: 'theater opera house concert hall performance venue',
                locationBias: {
                  circle: {
                    center: { latitude, longitude },
                    radius: Math.min(searchRadius, MAX_SEARCH_RADIUS)
                  }
                },
                maxResultCount: RESULTS_PER_CATEGORY,
                languageCode: 'en'
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                  'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.id'
                },
                timeout: 10000
              }
            );

            if (performanceResponse.data.places) {
              const performanceVenues = performanceResponse.data.places.map(place => {
                // Better name extraction
                let placeName = 'Unknown Venue';
                if (place.displayName?.text) {
                  placeName = place.displayName.text;
                } else if (place.name) {
                  placeName = place.name;
                } else if (place.formattedAddress) {
                  const addressParts = place.formattedAddress.split(',');
                  if (addressParts.length > 0 && addressParts[0].trim().length > 0) {
                    placeName = addressParts[0].trim();
                  }
                }
                
                return {
                  id: place.id,
                  name: placeName,
                  address: place.formattedAddress || 'Address not available',
                  location: place.location || { latitude: 0, longitude: 0 },
                  rating: place.rating || 0,
                  userRatingCount: place.userRatingCount || 0,
                  photos: (place.photos && place.photos.length > 0) ? place.photos : [],
                  websiteUri: place.websiteUri || '',
                  distance: calculateDistance(
                    latitude,
                    longitude,
                    place.location?.latitude || 0,
                    place.location?.longitude || 0
                  )
                };
              }).filter(place => place.distance <= searchRadius && place.name !== 'Unknown Venue');

              console.log(`Found ${performanceVenues.length} performance venues`);
              allPlacesForCategory.push(...performanceVenues);
            }
          } catch (performanceSearchError) {
            console.error('Performance venue search failed:', performanceSearchError.message);
          }
        } else if (category === 'coffee') {
          // For coffee, make multiple searches to get more comprehensive results
          console.log(`Searching coffee shops with multiple strategies`);
          
          // Search 1: Cafe
          const cafePlaces = await searchNearbyPlaces(latitude, longitude, searchRadius, ['cafe']);
          console.log(`Found ${cafePlaces.length} cafe places`);
          allPlacesForCategory.push(...cafePlaces);
          
          // Search 2: Coffee shops (using text search approach)
          try {
            const coffeeResponse = await axios.post(
              'https://places.googleapis.com/v1/places:searchText',
              {
                textQuery: 'coffee shop',
                locationBias: {
                  circle: {
                    center: { latitude, longitude },
                    radius: Math.min(searchRadius, MAX_SEARCH_RADIUS)
                  }
                },
                maxResultCount: RESULTS_PER_CATEGORY,
                languageCode: 'en'
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                  'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.id'
                },
                timeout: 10000
              }
            );
            
            if (coffeeResponse.data.places) {
              const textCoffeeShops = coffeeResponse.data.places.map(place => {
                // Better name extraction
                let placeName = 'Unknown Coffee Shop';
                if (place.displayName?.text) {
                  placeName = place.displayName.text;
                } else if (place.name) {
                  placeName = place.name;
                } else if (place.formattedAddress) {
                  const addressParts = place.formattedAddress.split(',');
                  if (addressParts.length > 0 && addressParts[0].trim().length > 0) {
                    placeName = addressParts[0].trim();
                  }
                }
                
                return {
                  id: place.id,
                  name: placeName,
                  address: place.formattedAddress || 'Address not available',
                  location: place.location || { latitude: 0, longitude: 0 },
                  rating: place.rating || 0,
                  userRatingCount: place.userRatingCount || 0,
                  photos: (place.photos && place.photos.length > 0) ? place.photos : [],
                  websiteUri: place.websiteUri || '',
                  distance: calculateDistance(
                    latitude,
                    longitude,
                    place.location?.latitude || 0,
                    place.location?.longitude || 0
                  )
                };
              }).filter(place => place.distance <= searchRadius && place.name !== 'Unknown Coffee Shop');
              
              console.log(`Found ${textCoffeeShops.length} coffee shop places via text search`);
              allPlacesForCategory.push(...textCoffeeShops);
            }
          } catch (textSearchError) {
            console.warn('Text search for coffee failed:', textSearchError.message);
          }
          
        } else {
          // Regular search for other categories
          console.log(`Searching ${category} with types: ${types.join(', ')}`);
          const places = await searchNearbyPlaces(latitude, longitude, searchRadius, types);
          console.log(`Found ${places.length} ${category} places`);
          allPlacesForCategory = places;
        }
        
        results[category] = allPlacesForCategory.map(place => {
          const distance = calculateDistance(
            latitude,
            longitude,
            place.location.latitude,
            place.location.longitude
          );

          // Enhanced name extraction for all places with robust fallbacks
          let placeName = 'Unknown Place';
          
          // Primary: use displayName.text
          if (place.displayName?.text && place.displayName.text.trim().length > 0) {
            placeName = place.displayName.text.trim();
          } 
          // Secondary: use name field
          else if (place.name && place.name.trim().length > 0) {
            placeName = place.name.trim();
          } 
          // Tertiary: extract from formatted address
          else if (place.formattedAddress && place.formattedAddress.trim().length > 0) {
            const addressParts = place.formattedAddress.split(',');
            for (const part of addressParts) {
              const trimmedPart = part.trim();
              if (trimmedPart.length > 0 && !trimmedPart.match(/^\d+/) && !trimmedPart.includes('Vietnam') && !trimmedPart.includes('Hanoi')) {
                placeName = trimmedPart;
                break;
              }
            }
          }
          // Quaternary: generate descriptive name based on types
          else if (place.types && place.types.length > 0) {
            const typeMap = {
              'restaurant': 'Restaurant',
              'tourist_attraction': 'Landmark',
              'cafe': 'Coffee Shop',
              'museum': 'Museum',
              'art_gallery': 'Art Gallery',
              'library': 'Library',
              'cultural_center': 'Cultural Center',
              'establishment': 'Establishment',
              'point_of_interest': 'Point of Interest'
            };
            
            for (const type of place.types) {
              if (typeMap[type]) {
                placeName = `${typeMap[type]} at ${place.location?.latitude?.toFixed(4) || 'Unknown'},${place.location?.longitude?.toFixed(4) || 'Unknown'}`;
                break;
              }
            }
          }

          console.log(`Place: ${placeName}, Photos: ${place.photos?.length || 0}`);
          if (place.photos && place.photos.length > 0) {
            console.log(`First photo name: ${place.photos[0].name}`);
          }

          return {
            id: place.id,
            name: placeName,
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
            mapsUrl: generateMapsUrl(place.location.latitude, place.location.longitude, placeName),
            types: place.types || []
          };
        }).filter(place => place.name !== 'Unknown Place'); // Filter out places with no valid names
        
        // Remove duplicates for all categories (since we made multiple searches)
        if (['landmarks', 'restaurants', 'culture', 'coffee'].includes(category)) {
          const uniquePlaces = new Map();
          results[category].forEach(place => {
            if (!uniquePlaces.has(place.id)) {
              uniquePlaces.set(place.id, place);
            }
          });
          results[category] = Array.from(uniquePlaces.values());
          console.log(`After deduplication: ${results[category].length} unique ${category} places`);
        }
        
        // Sort all places
        results[category].sort((a, b) => {
          // Simple sorting: places with higher ratings first, then by distance
          if (a.rating !== b.rating) {
            return b.rating - a.rating; // Higher rating first
          }
          return a.distance - b.distance; // Then by distance
        });
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

// Reverse geocode coordinates to address endpoint
app.post('/api/geocode-coordinates', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await axios.get(geocodeUrl, { timeout: 10000 });
    
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const address = response.data.results[0].formatted_address;
      res.json({
        success: true,
        address: address,
        latitude: latitude,
        longitude: longitude
      });
    } else {
      res.status(404).json({ error: 'Address not found for these coordinates.' });
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({ error: 'Failed to reverse geocode coordinates' });
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

// Resolve shortened Google Maps URLs
app.post('/api/resolve-maps-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    console.log('Resolving shortened URL:', url);
    
    // For shortened URLs like goo.gl, we need to follow redirects
    if (url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
      try {
        const response = await axios.get(url, {
          maxRedirects: 5,
          timeout: 10000,
          validateStatus: function (status) {
            return status < 400; // Accept redirects
          }
        });
        
        // Get the final URL after redirects
        const finalUrl = response.request.res.responseUrl || url;
        console.log('Resolved URL:', finalUrl);
        
        res.json({
          success: true,
          originalUrl: url,
          resolvedUrl: finalUrl
        });
      } catch (error) {
        console.error('Error resolving URL:', error.message);
        res.status(500).json({ 
          error: 'Could not resolve shortened URL',
          originalUrl: url 
        });
      }
    } else {
      // Not a shortened URL, return as-is
      res.json({
        success: true,
        originalUrl: url,
        resolvedUrl: url
      });
    }
  } catch (error) {
    console.error('URL resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve URL' });
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

// Load recommendations on startup
loadRecommendations();

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NearbySpots QR Discovery Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗺️  Google Maps API: ${GOOGLE_MAPS_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`⭐ Manual Recommendations: ${manualRecommendations.length} loaded`);
  console.log(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
});