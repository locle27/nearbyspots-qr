require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const QRCode = require('qrcode');
const axios = require('axios');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { initDatabase, db } = require('./database');
const { generateSecureQRURL, authenticateQRToken, getTokenStats, revokeQRToken } = require('./security');

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
      connectSrc: ["'self'", "https://places.googleapis.com", "https://maps.googleapis.com", "https://fonts.googleapis.com", "https://generativelanguage.googleapis.com"],
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
const RESULTS_PER_CATEGORY = Math.min(parseInt(process.env.RESULTS_PER_CATEGORY) || 20, 20); // Google Places API (New) max limit is 20

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

// Save recommendations to file with backup
function saveRecommendations() {
  try {
    // Create backup directory if it doesn't exist
    const backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Create backup file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `recommendations_backup_${timestamp}.json`);
    
    // If main file exists, create backup before saving
    if (fs.existsSync(RECOMMENDATIONS_FILE)) {
      fs.copyFileSync(RECOMMENDATIONS_FILE, backupFile);
      console.log(`📋 Created backup: ${backupFile}`);
    }
    
    // Save main file
    fs.writeFileSync(RECOMMENDATIONS_FILE, JSON.stringify(manualRecommendations, null, 2));
    console.log(`💾 Saved ${manualRecommendations.length} recommendations`);
    
    // Keep only last 10 backups to prevent storage overflow
    cleanupOldBackups(backupDir);
    
  } catch (error) {
    console.error('Error saving recommendations:', error);
  }
}

// Clean up old backup files (keep only last 10)
function cleanupOldBackups(backupDir) {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('recommendations_backup_'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        mtime: fs.statSync(path.join(backupDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first
    
    // Keep only the 10 most recent backups
    const filesToDelete = files.slice(10);
    filesToDelete.forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`🗑️ Deleted old backup: ${file.name}`);
    });
    
  } catch (error) {
    console.error('Error cleaning up backups:', error);
  }
}

// Generate unique ID for recommendations
function generateRecommendationId() {
  return `rec_${uuidv4()}`;
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
    console.log(`🔍 Searching for ${types.join(', ')} within ${radius}m of ${latitude}, ${longitude}`);
    
    // Ensure maxResultCount is within Google Places API (New) limits
    const maxResults = Math.min(Math.max(RESULTS_PER_CATEGORY, 1), 20);
    
    const requestBody = {
      includedTypes: types,
      maxResultCount: maxResults,
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: Math.min(radius, MAX_SEARCH_RADIUS)
        }
      },
      languageCode: 'en'
    };
    
    console.log('📤 API Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('🔑 API Key (first 10 chars):', GOOGLE_MAPS_API_KEY ? `${GOOGLE_MAPS_API_KEY.substring(0, 10)}...` : 'MISSING');
    
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchNearby',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.id'
        },
        timeout: 10000
      }
    );

    console.log(`📥 API Response Status: ${response.status}`);
    console.log(`📥 API Response Headers:`, response.headers);
    console.log(`📥 API Response Data:`, JSON.stringify(response.data, null, 2));
    
    const places = response.data.places || [];
    console.log(`✅ Found ${places.length} places for types: ${types.join(', ')}`);
    
    // Enhanced debugging for empty results
    if (places.length === 0) {
      console.warn('⚠️ No places found - potential issues:');
      console.warn('1. Check Google Cloud Console:');
      console.warn('   - Places API (New) is enabled');
      console.warn('   - Billing account is active');
      console.warn('   - API key has Places API (New) permissions');
      console.warn('2. Check API quota limits');
      console.warn('3. Verify location and radius are reasonable');
      console.warn('4. Check if place types are valid for Places API (New)');
      console.warn('🔍 Debug Details:', {
        apiKeyLength: GOOGLE_MAPS_API_KEY?.length,
        requestTypes: types,
        location: { latitude, longitude },
        radius: Math.min(radius, MAX_SEARCH_RADIUS),
        maxResults
      });
    }
    
    return places;
  } catch (error) {
    console.error('❌ Google Places API error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    
    // Enhanced error handling with specific suggestions
    if (error.response?.status === 403) {
      const errorMessage = 'API key permission denied. Please check:\n' +
        '- Places API (New) is enabled in Google Cloud Console\n' +
        '- API key has correct permissions for Places API (New)\n' +
        '- Billing is enabled and active\n' +
        '- API key restrictions allow your domain';
      console.error('🚨 403 Error Details:', errorMessage);
      throw new Error(errorMessage);
    } else if (error.response?.status === 400) {
      const errorMessage = 'Invalid API request. Please check:\n' +
        '- includedTypes are valid for Places API (New)\n' +
        '- Request format is correct\n' +
        '- Location coordinates are valid\n' +
        '- Radius is within allowed limits';
      console.error('🚨 400 Error Details:', errorMessage);
      throw new Error(errorMessage);
    } else if (error.response?.status === 429) {
      const errorMessage = 'API quota exceeded. Please check:\n' +
        '- Daily quota limits in Google Cloud Console\n' +
        '- Requests per minute limits\n' +
        '- Consider increasing quotas or implementing caching';
      console.error('🚨 429 Error Details:', errorMessage);
      throw new Error(errorMessage);
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      const errorMessage = 'Network connection error. Please check:\n' +
        '- Internet connection is stable\n' +
        '- Firewall settings allow HTTPS requests\n' +
        '- Google APIs are accessible from your location';
      console.error('🚨 Network Error Details:', errorMessage);
      throw new Error(errorMessage);
    }
    
    throw new Error(`Failed to fetch nearby places: ${error.message}`);
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

// QR Admin page - for generating secure QR codes (no authentication required for admin access)
app.get('/qr-admin', (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'qr-admin.html');
  res.sendFile(htmlPath);
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
app.get('/', authenticateQRToken, (req, res) => {
  // Log secure access information
  const clientIp = req.ip || req.connection.remoteAddress;
  const qrInfo = req.qrAuth;
  
  console.log(`🔐 Secure QR access verified for ${clientIp}`);
  console.log(`📱 QR ID: ${qrInfo.qrId}, Uses: ${qrInfo.usage.uses}/${qrInfo.usage.maxUses}`);
  
  // Add security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Serve the enhanced index interface with Gemini AI address extraction
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(htmlPath);
});

// Secure QR code generation endpoint - PROTECTED
app.post('/api/generate-secure-qr', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  try {
    const { hotelName, customMessage } = req.body;
    console.log('🔍 QR generation request:', { hotelName, customMessage });
    
    // Get base URL from request or environment
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
    console.log('🔍 Base URL for QR:', baseUrl);
    
    // Generate secure QR with metadata
    console.log('🔍 Generating secure QR URL...');
    const qrData = generateSecureQRURL(baseUrl, {
      hotelName: hotelName || 'Hotel Guest Access',
      customMessage: customMessage || 'Secure access to hotel recommendations',
      generatedBy: clientIp,
      userAgent: userAgent
    });
    console.log('🔍 QR data generated:', { qrId: qrData.qrId, url: qrData.url.substring(0, 100) + '...' });
    
    // Generate QR code image
    const qrCodeDataURL = await QRCode.toDataURL(qrData.url, {
      errorCorrectionLevel: 'H', // High error correction for better reliability
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 512 // High resolution
    });
    
    console.log(`🔐 Generated secure QR code: ${qrData.qrId} for ${clientIp}`);
    
    res.json({
      success: true,
      qrCode: qrCodeDataURL,
      qrId: qrData.qrId,
      secureUrl: qrData.url,
      expiresAt: qrData.expiresAt,
      securityInfo: qrData.securityInfo,
      instructions: {
        usage: 'This QR code provides secure access to your hotel recommendations app',
        maxUses: qrData.securityInfo.maxUses,
        validFor: qrData.securityInfo.validFor,
        security: 'Each scan is tracked and limited for maximum security'
      }
    });
    
  } catch (error) {
    console.error('❌ Error generating secure QR:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate secure QR code',
      details: error.message,
      debug: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// Legacy QR endpoint for compatibility
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
app.post('/api/recommendations', async (req, res) => {
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
      featured = false,
      images = [],
      parsedData = null
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
      images: Array.isArray(images) ? images.map(img => ({
        id: sanitizeInput(img.id, 'string'),
        name: sanitizeInput(img.name, 'string'),
        dataUrl: img.dataUrl // Store base64 data URL for uploaded images
      })) : [],
      websiteUri: sanitizeInput(websiteUri, 'string'),
      addedBy: 'manual_entry',
      addedDate: new Date().toISOString(),
      featured: Boolean(featured),
      parsedData: parsedData ? {
        prices: sanitizeInput(parsedData.prices || '', 'string'),
        hours: sanitizeInput(parsedData.hours || '', 'string'),
        foodItems: sanitizeInput(parsedData.foodItems || '', 'string'),
        googleMapsUrl: sanitizeInput(parsedData.googleMapsUrl || '', 'string')
      } : null
    };
    
    // Add to recommendations (database or file)
    if (useDatabase) {
      const dbResult = await db.addRecommendation(newRecommendation);
      if (dbResult) {
        // Refresh in-memory cache from database
        const dbRecommendations = await db.getAllRecommendations();
        if (dbRecommendations) {
          manualRecommendations = dbRecommendations;
        }
        console.log(`➕ Added new recommendation to database: ${newRecommendation.name}`);
      } else {
        throw new Error('Failed to save to database');
      }
    } else {
      manualRecommendations.push(newRecommendation);
      saveRecommendations();
      console.log(`➕ Added new recommendation to file: ${newRecommendation.name}`);
    }
    
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
app.delete('/api/recommendations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find recommendation first
    const recIndex = manualRecommendations.findIndex(rec => rec.id === id);
    if (recIndex === -1) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    
    const deletedRec = manualRecommendations[recIndex];
    
    // Delete from database or file
    if (useDatabase) {
      const dbResult = await db.deleteRecommendation(id);
      if (dbResult) {
        // Refresh in-memory cache from database
        const dbRecommendations = await db.getAllRecommendations();
        if (dbRecommendations) {
          manualRecommendations = dbRecommendations;
        }
        console.log(`🗑️ Deleted recommendation from database: ${deletedRec.name}`);
      } else {
        throw new Error('Failed to delete from database');
      }
    } else {
      manualRecommendations.splice(recIndex, 1);
      saveRecommendations();
      console.log(`🗑️ Deleted recommendation from file: ${deletedRec.name}`);
    }
    
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

// Backup management endpoints
app.get('/api/backups', (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'data', 'backups');
    
    if (!fs.existsSync(backupDir)) {
      return res.json({ success: true, backups: [] });
    }
    
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('recommendations_backup_'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        return {
          id: file,
          filename: file,
          created: stats.mtime,
          size: stats.size,
          count: data.length,
          path: filePath
        };
      })
      .sort((a, b) => b.created - a.created); // Sort by creation time, newest first
    
    res.json({ success: true, backups: files });
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.post('/api/backups/restore/:backupId', (req, res) => {
  try {
    const { backupId } = req.params;
    const backupDir = path.join(__dirname, 'data', 'backups');
    const backupFile = path.join(backupDir, backupId);
    
    if (!fs.existsSync(backupFile)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    // Create backup of current state before restoring
    const currentBackupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const currentBackupFile = path.join(backupDir, `recommendations_backup_pre_restore_${currentBackupTimestamp}.json`);
    
    if (fs.existsSync(RECOMMENDATIONS_FILE)) {
      fs.copyFileSync(RECOMMENDATIONS_FILE, currentBackupFile);
      console.log(`📋 Created pre-restore backup: ${currentBackupFile}`);
    }
    
    // Restore from backup
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    manualRecommendations = backupData;
    
    // Save restored data
    fs.writeFileSync(RECOMMENDATIONS_FILE, JSON.stringify(manualRecommendations, null, 2));
    
    console.log(`🔄 Restored ${manualRecommendations.length} recommendations from backup: ${backupId}`);
    
    res.json({
      success: true,
      message: 'Backup restored successfully',
      restored: manualRecommendations.length,
      backupId: backupId
    });
    
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

app.get('/api/backups/:backupId', (req, res) => {
  try {
    const { backupId } = req.params;
    const backupDir = path.join(__dirname, 'data', 'backups');
    const backupFile = path.join(backupDir, backupId);
    
    if (!fs.existsSync(backupFile)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    const stats = fs.statSync(backupFile);
    const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    res.json({
      success: true,
      backup: {
        id: backupId,
        filename: backupId,
        created: stats.mtime,
        size: stats.size,
        count: data.length,
        recommendations: data
      }
    });
    
  } catch (error) {
    console.error('Error getting backup details:', error);
    res.status(500).json({ error: 'Failed to get backup details' });
  }
});

// Gemini OCR endpoint for address extraction
app.post('/api/extract-address', async (req, res) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    
    console.log('🔍 Starting Gemini OCR extraction...');
    
    // Remove data URL prefix if present
    const base64Image = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Prepare the request to Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [
          {
            text: `Analyze this image and extract the following information in JSON format:
            
            {
              "businessName": "extracted business name",
              "address": "extracted address",
              "phone": "extracted phone number if any",
              "website": "extracted website if any",
              "description": "brief description of what you see",
              "allText": "all text found in the image"
            }
            
            Rules:
            - Extract the business name (usually the largest text or at the top)
            - Extract the complete address with street number, street name, district, city
            - Be very careful with Vietnamese addresses and names
            - If no clear business name is found, return null
            - Return only valid JSON, no additional text
            - If address is not found, return null for address`
          },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 512,
      }
    };
    
    console.log('📤 Sending request to Gemini API...');
    
    const response = await axios.post(geminiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000 // 30 seconds timeout
    });
    
    console.log('📥 Received response from Gemini API');
    
    if (response.data && response.data.candidates && response.data.candidates[0]) {
      const generatedText = response.data.candidates[0].content.parts[0].text;
      console.log('📝 Gemini response:', generatedText);
      
      try {
        // Clean the response by removing markdown code blocks if present
        let cleanedText = generatedText.trim();
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Parse the JSON response
        const extractedData = JSON.parse(cleanedText);
        
        console.log('✅ Extracted data:', extractedData);
        
        res.json({
          success: true,
          data: extractedData,
          rawResponse: generatedText
        });
        
      } catch (parseError) {
        console.error('❌ Error parsing Gemini response:', parseError);
        res.status(500).json({ 
          error: 'Failed to parse Gemini response',
          rawResponse: generatedText
        });
      }
    } else {
      console.error('❌ Invalid Gemini API response structure');
      res.status(500).json({ error: 'Invalid response from Gemini API' });
    }
    
  } catch (error) {
    console.error('❌ Error in Gemini OCR extraction:', error);
    res.status(500).json({ 
      error: 'Failed to extract address using Gemini',
      details: error.message
    });
  }
});

// Gemini AI content parsing endpoint for recommendation extraction
app.post('/api/parse-content', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    console.log('🤖 Starting Gemini content parsing...');
    
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [
          {
            text: `Analyze this content and extract information for a restaurant/place recommendation. Extract the following information in JSON format:

{
  "placeName": "extracted place/business name",
  "address": "extracted full address",
  "description": "extracted description or summary",
  "priceRange": "extracted price information",
  "hours": "extracted opening hours if any",
  "menuItems": "extracted food items or menu if any",
  "rating": "extracted rating if any (0-5 scale)",
  "phone": "extracted phone number if any",
  "website": "extracted website if any",
  "category": "restaurant, cafe, bar, or other category",
  "keywords": ["extracted", "relevant", "keywords"]
}

Rules:
- Focus on place/business name and address as the most important fields
- If address is incomplete, try to infer or note what's missing
- Extract price range as text (e.g., "30k-50k VND", "$10-20", "Budget friendly")
- If no clear place name, use the most prominent business identifier
- Return ONLY valid JSON without any markdown formatting, code blocks, or additional text
- Do NOT wrap the JSON in code blocks (triple backticks)
- If information is not found, use null for that field
- Be very careful with Vietnamese names and addresses

Content to analyze:
${content}`
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 512,
      }
    };
    
    console.log('📤 Sending content parsing request to Gemini...');
    
    const response = await axios.post(geminiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000
    });
    
    console.log('📥 Received content parsing response from Gemini');
    
    if (response.data && response.data.candidates && response.data.candidates[0]) {
      const generatedText = response.data.candidates[0].content.parts[0].text;
      console.log('📝 Gemini parsing response:', generatedText);
      
      try {
        // Clean the response by removing markdown code blocks if present
        let cleanedText = generatedText.trim();
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const parsedData = JSON.parse(cleanedText);
        console.log('✅ Parsed recommendation data:', parsedData);
        
        res.json({
          success: true,
          data: parsedData,
          rawResponse: generatedText
        });
        
      } catch (parseError) {
        console.error('❌ Error parsing Gemini response:', parseError);
        res.status(500).json({ 
          error: 'Failed to parse Gemini response',
          rawResponse: generatedText
        });
      }
    } else {
      console.error('❌ Invalid Gemini API response structure');
      res.status(500).json({ error: 'Invalid response from Gemini API' });
    }
    
  } catch (error) {
    console.error('❌ Error in Gemini content parsing:', error);
    res.status(500).json({ 
      error: 'Failed to parse content using Gemini',
      details: error.message
    });
  }
});

// Search nearby places endpoint
app.post('/api/search-nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = DEFAULT_SEARCH_RADIUS } = req.body;

    console.log(`🚀 Starting search-nearby request:`, { latitude, longitude, radius });

    if (!latitude || !longitude) {
      console.error('❌ Missing coordinates:', { latitude, longitude });
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('❌ Missing Google Maps API key');
      return res.status(500).json({ 
        error: 'Google Maps API key not configured',
        debug: 'Please set GOOGLE_MAPS_API_KEY environment variable'
      });
    }

    console.log(`🔑 API Key present: ${GOOGLE_MAPS_API_KEY ? 'Yes' : 'No'} (length: ${GOOGLE_MAPS_API_KEY?.length || 0})`);
    console.log(`📏 Search radius: ${radius} -> ${Math.min(parseInt(radius), MAX_SEARCH_RADIUS)}m`);
    console.log(`🎯 Location: ${latitude}, ${longitude}`);

    const searchRadius = Math.min(parseInt(radius), MAX_SEARCH_RADIUS);
    const results = {};
    let totalPlacesFound = 0;

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
                maxResultCount: Math.min(RESULTS_PER_CATEGORY, 20),
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
                maxResultCount: Math.min(RESULTS_PER_CATEGORY, 20),
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
                maxResultCount: Math.min(RESULTS_PER_CATEGORY, 20),
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
                maxResultCount: Math.min(RESULTS_PER_CATEGORY, 20),
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
                maxResultCount: Math.min(RESULTS_PER_CATEGORY, 20),
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
                maxResultCount: Math.min(RESULTS_PER_CATEGORY, 20),
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
                maxResultCount: Math.min(RESULTS_PER_CATEGORY, 20),
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
        
        console.log(`✅ Final ${category} results: ${results[category].length} places`);
        totalPlacesFound += results[category].length;
      } catch (categoryError) {
        console.error(`❌ Error searching ${category}:`, categoryError);
        results[category] = [];
      }
    }

    console.log(`🏁 Search completed. Total places found: ${totalPlacesFound}`);
    console.log(`📊 Results summary:`, Object.keys(results).map(cat => `${cat}: ${results[cat]?.length || 0}`).join(', '));

    // Check if no results found and provide debugging info
    if (totalPlacesFound === 0) {
      console.warn('⚠️ No places found in any category!');
      console.warn('🔍 Debug info:', {
        apiKey: GOOGLE_MAPS_API_KEY ? `${GOOGLE_MAPS_API_KEY.substring(0, 10)}...` : 'MISSING',
        location: { latitude, longitude },
        radius: searchRadius,
        categories: Object.keys(PLACE_TYPES),
        placeTypes: PLACE_TYPES
      });
      
      // Test a simple API call to diagnose the issue
      console.warn('🧪 Testing API connectivity...');
      try {
        const testResponse = await axios.get(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
        );
        console.warn('✅ Geocoding API test successful:', testResponse.status);
        console.warn('🔍 API appears to be working. Issue may be with Places API (New) specifically.');
      } catch (testError) {
        console.warn('❌ Geocoding API test failed:', testError.message);
        console.warn('🔍 This suggests an API key or network issue.');
      }
    }

    const responseData = {
      success: true,
      location: { latitude, longitude },
      radius: searchRadius,
      results,
      debug: {
        totalPlacesFound,
        apiKeyPresent: !!GOOGLE_MAPS_API_KEY,
        timestamp: new Date().toISOString()
      }
    };

    res.json(responseData);
  } catch (error) {
    console.error('❌ Search nearby critical error:', error);
    res.status(500).json({ 
      error: 'Failed to search nearby places',
      message: error.message,
      debug: {
        apiKeyPresent: !!GOOGLE_MAPS_API_KEY,
        timestamp: new Date().toISOString()
      }
    });
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

// API configuration test endpoint
app.get('/api/test-config', async (req, res) => {
  try {
    const configTest = {
      apiKeyPresent: !!GOOGLE_MAPS_API_KEY,
      apiKeyLength: GOOGLE_MAPS_API_KEY?.length || 0,
      placesApiEnabled: false,
      geocodingApiEnabled: false,
      timestamp: new Date().toISOString()
    };

    // Test Geocoding API
    try {
      const geocodeResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=21.034087,105.85114&key=${GOOGLE_MAPS_API_KEY}`
      );
      configTest.geocodingApiEnabled = geocodeResponse.status === 200;
      configTest.geocodingStatus = geocodeResponse.status;
    } catch (geocodeError) {
      configTest.geocodingError = geocodeError.message;
      configTest.geocodingStatus = geocodeError.response?.status || 'ERROR';
    }

    // Test Places API (New)
    try {
      const placesResponse = await axios.post(
        'https://places.googleapis.com/v1/places:searchNearby',
        {
          includedTypes: ['restaurant'],
          maxResultCount: 1,
          locationRestriction: {
            circle: {
              center: { latitude: 21.034087, longitude: 105.85114 },
              radius: 1000
            }
          },
          languageCode: 'en'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location'
          },
          timeout: 10000
        }
      );
      configTest.placesApiEnabled = placesResponse.status === 200;
      configTest.placesStatus = placesResponse.status;
      configTest.placesResultCount = placesResponse.data.places?.length || 0;
    } catch (placesError) {
      configTest.placesError = placesError.message;
      configTest.placesStatus = placesError.response?.status || 'ERROR';
      configTest.placesErrorData = placesError.response?.data;
    }

    // Overall assessment
    configTest.overallStatus = configTest.apiKeyPresent && configTest.placesApiEnabled ? 'HEALTHY' : 'ISSUES_DETECTED';
    
    res.json({
      success: true,
      config: configTest,
      recommendations: !configTest.placesApiEnabled ? [
        'Enable Places API (New) in Google Cloud Console',
        'Check API key permissions',
        'Verify billing is enabled',
        'Ensure quota limits are not exceeded'
      ] : []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Configuration test failed',
      message: error.message
    });
  }
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

// Database and app initialization
let useDatabase = false;

async function initializeApp() {
  try {
    // Try to connect to database first
    useDatabase = await initDatabase();
    
    if (useDatabase) {
      console.log('🗄️ Using PostgreSQL database for storage');
      // Load existing recommendations from database
      const dbRecommendations = await db.getAllRecommendations();
      if (dbRecommendations) {
        manualRecommendations = dbRecommendations;
        console.log(`📋 Loaded ${manualRecommendations.length} recommendations from database`);
      }
    } else {
      console.log('📁 Using file storage as fallback');
      loadRecommendations();
    }
    
    // Start server after initialization
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 NearbySpots QR Discovery Server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗺️  Google Maps API: ${GOOGLE_MAPS_API_KEY ? 'Configured' : 'Missing'}`);
      console.log(`⭐ Manual Recommendations: ${manualRecommendations.length} loaded`);
      console.log(`🗄️ Storage: ${useDatabase ? 'PostgreSQL Database' : 'File System'}`);
      console.log(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    process.exit(1);
  }
}

// Initialize the application
initializeApp();