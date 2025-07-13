# 🔐 QR Code Security Guide

## 🚨 Security Threats Prevented

### **1. QR Code Hijacking**
- **Attack**: Malicious actors replace your QR codes with fake ones
- **Prevention**: Digital signatures ensure QR code authenticity

### **2. URL Redirection Attacks**
- **Attack**: QR codes redirect to phishing/malware sites
- **Prevention**: Domain whitelisting only allows trusted domains

### **3. Parameter Injection**
- **Attack**: Malicious URLs with harmful parameters
- **Prevention**: Input sanitization and validation

### **4. QR Code Tampering**
- **Attack**: Modified QR codes with malicious content
- **Prevention**: HMAC signatures detect tampering

## 🛡️ Security Features Implemented

### **🔒 1. Domain Whitelisting**
```javascript
// Only these domains are allowed in QR codes
ALLOWED_DOMAINS = [
  'localhost:3000',           // Development
  'your-app.railway.app',     // Production
  'your-custom-domain.com'    // Custom domain
]
```

**Protection**: Prevents QR codes from redirecting to malicious sites

### **🔐 2. Digital Signatures**
```
QR URL Format:
https://your-app.com/?lat=21.0285&lng=105.8542&sig=abc123&ts=1699123456

sig = HMAC-SHA256(URL + timestamp)
ts = Generation timestamp
```

**Protection**: 
- Detects if QR content was modified
- Signatures expire after 24 hours
- Uses cryptographic verification

### **🧹 3. Input Sanitization**
```javascript
// All inputs are cleaned and validated
- Coordinates: Must be valid GPS (-180 to 180)
- Labels: Limited to 200 characters, no HTML
- URLs: Must match allowed domain patterns
```

**Protection**: Prevents injection attacks and malformed data

### **📊 4. Security Logging**
```json
{
  "timestamp": "2025-01-13T16:00:00Z",
  "ip": "192.168.1.100",
  "userAgent": "Mobile Safari",
  "baseUrl": "https://your-app.com",
  "success": true,
  "reason": "Valid generation"
}
```

**Protection**: Tracks all QR generation attempts for monitoring

### **⚡ 5. Rate Limiting**
```
100 requests per 15 minutes per IP address
```

**Protection**: Prevents spam and abuse

## 🔍 How to Verify QR Code Security

### **✅ For Business Owners**

1. **Check Domain**: Ensure QR codes only contain your domain
2. **Monitor Logs**: Review security logs for suspicious activity
3. **Verify Signatures**: All legitimate QRs have `sig` and `ts` parameters
4. **Physical Security**: Protect printed QR codes from replacement

### **✅ For Customers**

1. **Check URL**: Before scanning, verify the domain looks correct
2. **Security Indicators**: Look for HTTPS and familiar domain names
3. **Be Cautious**: Don't scan QR codes from unknown sources
4. **Report Suspicious**: Contact business if QR seems suspicious

## 🚀 Production Security Setup

### **Environment Variables**
```bash
# Required for production
QR_SECRET_KEY=your-256-bit-secret-key
PRODUCTION_DOMAIN=your-app.railway.app
CUSTOM_DOMAIN=your-custom-domain.com

# Optional security settings
RATE_LIMIT_MAX_REQUESTS=50
RATE_LIMIT_WINDOW_MS=900000
```

### **Generate Secure Secret Key**
```bash
# Generate a strong secret key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### **Domain Configuration**
```javascript
// Update allowed domains for production
const ALLOWED_DOMAINS = [
  process.env.PRODUCTION_DOMAIN,
  process.env.CUSTOM_DOMAIN,
  // Remove localhost for production
].filter(Boolean);
```

## 🔧 Security Best Practices

### **🏢 For Business Deployment**

1. **Use HTTPS**: Always use SSL certificates
2. **Regular Updates**: Keep dependencies updated
3. **Monitor Logs**: Set up alerts for security events
4. **Backup Strategy**: Secure backup of QR generation logs
5. **Access Control**: Limit who can generate QR codes

### **📱 For QR Code Distribution**

1. **Physical Security**: 
   - Laminate QR codes to prevent tampering
   - Place in secure, visible locations
   - Regular inspection for replacement

2. **Digital Security**:
   - Use official channels to share QR codes
   - Include business branding around QR codes
   - Educate customers about QR safety

3. **Monitoring**:
   - Track QR usage analytics
   - Monitor for unusual access patterns
   - Set up alerts for failed verifications

## 🚨 Security Incident Response

### **If QR Code Compromise Detected**

1. **Immediate Actions**:
   ```bash
   # Rotate secret key
   export QR_SECRET_KEY=new-secret-key
   
   # Check security logs
   grep "Security Alert" server.logs
   
   # Block suspicious IPs if needed
   ```

2. **Investigation Steps**:
   - Review security logs for timeline
   - Check physical QR code locations
   - Verify all printed QR codes
   - Contact affected customers

3. **Recovery**:
   - Generate new QR codes with new signatures
   - Replace all physical QR codes
   - Update security monitoring
   - Notify stakeholders

## 📊 Security Monitoring

### **Key Metrics to Track**

- Failed QR verifications per hour
- Unusual geographic access patterns  
- High-volume QR generation attempts
- Domain validation failures
- Signature verification failures

### **Alert Thresholds**

```javascript
// Set up alerts for:
- > 10 failed verifications per hour
- QR generation from new countries
- > 50 QR codes generated per IP per day
- Any domain validation failures
```

## 🔐 Advanced Security (Optional)

### **Additional Measures for High-Security Environments**

1. **Geographic Restrictions**
   - Block QR access from unexpected countries
   - Geo-fence QR code usage areas

2. **Device Fingerprinting**
   - Track device characteristics
   - Detect suspicious device patterns

3. **AI Monitoring**
   - Machine learning for anomaly detection
   - Automated threat response

4. **Blockchain Verification**
   - Immutable QR generation logs
   - Distributed verification system

---

## ✅ Security Checklist

- [ ] Strong secret key generated and secured
- [ ] Production domains configured
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Security logging implemented
- [ ] Rate limiting configured
- [ ] Physical QR code security measures in place
- [ ] Staff trained on QR security best practices
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented
- [ ] Regular security audits scheduled

**Your QR code system is now protected against the most common security threats!** 🛡️