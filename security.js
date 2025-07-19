const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Security configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const QR_SECRET = process.env.QR_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY = '24h'; // QR codes expire after 24 hours
const MAX_USES_PER_TOKEN = 100; // Maximum uses per QR code

// In-memory store for token usage tracking (in production, use Redis or database)
const tokenUsage = new Map();
const blacklistedTokens = new Set();

// Generate secure QR token
function generateSecureQRToken(metadata = {}) {
  try {
    const payload = {
      type: 'qr_access',
      iat: Math.floor(Date.now() / 1000),
      qrId: crypto.randomUUID(),
      clientType: 'customer',
      maxUses: MAX_USES_PER_TOKEN,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0',
        ...metadata
      }
    };
    
    console.log('🔍 Generating JWT with payload:', { qrId: payload.qrId, type: payload.type });

    // Sign with QR-specific secret
    const token = jwt.sign(payload, JWT_SECRET, { 
      algorithm: 'HS256',
      expiresIn: TOKEN_EXPIRY 
    });
    
    // Get expiration time for response
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    // Initialize usage tracking
    tokenUsage.set(payload.qrId, {
      uses: 0,
      firstUsed: null,
      lastUsed: null,
      ipAddresses: new Set(),
      userAgents: new Set()
    });

    console.log(`🔐 Generated secure QR token: ${payload.qrId}`);
    return { token, qrId: payload.qrId, expiresAt };
  } catch (error) {
    console.error('❌ Error generating QR token:', error);
    throw error;
  }
}

// Verify QR token
function verifyQRToken(token, req) {
  try {
    // Check if token is blacklisted
    if (blacklistedTokens.has(token)) {
      throw new Error('Token has been revoked');
    }

    // Verify JWT signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Validate token type
    if (decoded.type !== 'qr_access') {
      throw new Error('Invalid token type');
    }

    // Check usage limits
    const usage = tokenUsage.get(decoded.qrId);
    if (!usage) {
      throw new Error('Token usage data not found');
    }

    if (usage.uses >= MAX_USES_PER_TOKEN) {
      throw new Error('Token usage limit exceeded');
    }

    // Track usage
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    usage.uses++;
    usage.lastUsed = new Date();
    if (!usage.firstUsed) {
      usage.firstUsed = new Date();
    }
    usage.ipAddresses.add(clientIp);
    usage.userAgents.add(userAgent);

    console.log(`✅ QR token verified: ${decoded.qrId} (use ${usage.uses}/${MAX_USES_PER_TOKEN})`);
    
    return {
      valid: true,
      decoded,
      usage: {
        uses: usage.uses,
        maxUses: MAX_USES_PER_TOKEN,
        remaining: MAX_USES_PER_TOKEN - usage.uses
      }
    };
  } catch (error) {
    console.log(`❌ QR token verification failed: ${error.message}`);
    return { valid: false, error: error.message };
  }
}

// Generate secure QR code URL
function generateSecureQRURL(baseUrl, metadata = {}) {
  const { token, qrId, expiresAt } = generateSecureQRToken(metadata);
  
  // Create URL with token and additional security parameters
  const url = new URL(baseUrl);
  url.searchParams.set('qr_token', token);
  url.searchParams.set('v', '1.0'); // Version
  url.searchParams.set('t', Date.now()); // Timestamp
  
  return {
    url: url.toString(),
    qrId,
    token,
    expiresAt,
    securityInfo: {
      maxUses: MAX_USES_PER_TOKEN,
      validFor: TOKEN_EXPIRY,
      securityLevel: 'HIGH'
    }
  };
}

// Middleware for QR token authentication
function authenticateQRToken(req, res, next) {
  const token = req.query.qr_token || req.headers['x-qr-token'];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied. Valid QR code required.',
      code: 'QR_TOKEN_MISSING'
    });
  }

  const verification = verifyQRToken(token, req);
  
  if (!verification.valid) {
    return res.status(401).json({ 
      error: `Access denied: ${verification.error}`,
      code: 'QR_TOKEN_INVALID'
    });
  }

  // Add token info to request
  req.qrAuth = {
    verified: true,
    qrId: verification.decoded.qrId,
    usage: verification.usage,
    clientType: verification.decoded.clientType,
    metadata: verification.decoded.metadata
  };

  next();
}

// Revoke QR token
function revokeQRToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    blacklistedTokens.add(token);
    
    if (tokenUsage.has(decoded.qrId)) {
      tokenUsage.delete(decoded.qrId);
    }
    
    console.log(`🚫 Revoked QR token: ${decoded.qrId}`);
    return true;
  } catch (error) {
    console.error('Error revoking token:', error);
    return false;
  }
}

// Get token statistics
function getTokenStats(qrId) {
  const usage = tokenUsage.get(qrId);
  if (!usage) return null;
  
  return {
    qrId,
    uses: usage.uses,
    maxUses: MAX_USES_PER_TOKEN,
    remaining: MAX_USES_PER_TOKEN - usage.uses,
    firstUsed: usage.firstUsed,
    lastUsed: usage.lastUsed,
    uniqueIPs: usage.ipAddresses.size,
    uniqueUserAgents: usage.userAgents.size
  };
}

// Cleanup expired tokens (run periodically)
function cleanupExpiredTokens() {
  const now = Date.now() / 1000;
  let cleaned = 0;
  
  for (const [qrId, usage] of tokenUsage.entries()) {
    try {
      // Try to decode token to check expiration
      const fakeToken = jwt.sign({ qrId, type: 'qr_access' }, JWT_SECRET, { expiresIn: '1s' });
      jwt.verify(fakeToken, JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        tokenUsage.delete(qrId);
        cleaned++;
      }
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired QR tokens`);
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

module.exports = {
  generateSecureQRToken,
  verifyQRToken,
  generateSecureQRURL,
  authenticateQRToken,
  revokeQRToken,
  getTokenStats,
  cleanupExpiredTokens
};