# 🔍 Google API Quota & Billing Troubleshooting

## 🚨 **If You've Run Out of API Credits**

### **Check Your Status:**

**1. Google Cloud Console → Billing**
- Look for: "Your free trial has ended" or "Billing account suspended"
- Check current month usage vs. $200 free credit

**2. Google Cloud Console → APIs & Services → Quotas**
- Search: "Places API (New)"
- Look for: "Requests per day" and "Requests per 100 seconds"
- Red = Over quota, Yellow = Near limit

**3. Google Cloud Console → APIs & Services → Enabled APIs**
- Verify "Places API (New)" is still enabled
- Check for any error messages

## 💰 **Google Places API Pricing (2025)**

### **Free Tier:**
- 🎁 **$200 credit per month** (renews monthly)
- 🔄 **Never expires** (as long as you have valid billing)

### **Places API (New) Costs:**
- **Nearby Search**: $0.032 per request
- **Text Search**: $0.032 per request  
- **Place Details**: $0.017 per request
- **Photos**: $0.007 per request

### **Your Hotel Usage Estimate:**
```
📊 Conservative Estimate:
- 50 guests per day × 2 searches = 100 API calls/day
- 100 calls × $0.032 = $3.20/day
- Monthly cost: ~$96/month

📊 Realistic Estimate:  
- 20 guests per day × 1.5 searches = 30 API calls/day
- 30 calls × $0.032 = $0.96/day
- Monthly cost: ~$29/month

✅ Both are well within $200 free credit!
```

## 🔧 **Quick Diagnostic Steps**

### **Step 1: Test API Key Directly**
```bash
# Test your actual API key (replace YOUR_API_KEY):
curl -X GET "https://maps.googleapis.com/maps/api/geocode/json?address=Hanoi&key=YOUR_API_KEY"
```

**Expected Results:**
- ✅ **Working**: Returns JSON with Hanoi coordinates  
- ❌ **Quota exceeded**: `"error_message": "You have exceeded your daily request quota"`
- ❌ **Billing disabled**: `"error_message": "This API project is not authorized"`
- ❌ **Invalid key**: `"error_message": "The provided API key is invalid"`

### **Step 2: Check Specific Quota Limits**
Go to: https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas

Look for these limits:
- **Daily requests**: Usually 1000/day (free tier)
- **Requests per 100 seconds**: Usually 100 (free tier)
- **Requests per 100 seconds per user**: Usually 100

### **Step 3: Check Error Messages in Railway**
Railway logs might show specific quota errors:
```
Google Places API error: OVER_QUERY_LIMIT
Google Places API error: REQUEST_DENIED  
Google Places API error: BILLING_NOT_ENABLED
```

## 🚨 **Common Issues & Solutions**

### **Issue 1: Free Trial Ended**
**Problem**: "Your free trial has ended, please enable billing"
**Solution**: 
- Add valid credit card to billing account
- You'll still get $200 free credit monthly
- No charges until you exceed $200/month

### **Issue 2: Daily Quota Exceeded**
**Problem**: Hit 1000 requests/day limit
**Solution**:
- Wait until tomorrow (quota resets daily)
- Request quota increase in Cloud Console
- Implement caching to reduce API calls

### **Issue 3: Per-Second Rate Limit**
**Problem**: Too many requests per second
**Solution**:
- Add rate limiting to your app (already implemented)
- Reduce concurrent API calls
- Add retry logic with exponential backoff

### **Issue 4: Billing Account Suspended**
**Problem**: Credit card expired or payment failed
**Solution**:
- Update payment method in Google Cloud Billing
- Wait for billing reactivation (can take 24 hours)

## 🛠️ **Emergency Fixes**

### **If You've Exceeded Quota:**

**Option 1: Wait (Free)**
- Quotas reset at midnight Pacific Time
- Daily limits reset every 24 hours
- Per-second limits reset every 100 seconds

**Option 2: Increase Quotas (Immediate)**
1. Go to: Google Cloud Console → APIs & Services → Quotas  
2. Find "Places API (New)" quotas
3. Click "Edit Quotas" → Request increase
4. Justify: "Hotel guest service application"
5. Usually approved within hours

**Option 3: Enable Billing (Recommended)**
1. Add credit card to Google Cloud Billing
2. Keep benefiting from $200 monthly free credit
3. Only pay if you exceed $200/month (unlikely)

### **If Billing Is Disabled:**

**Immediate Steps:**
1. Google Cloud Console → Billing
2. **"Link a Billing Account"** or **"Enable Billing"**
3. Add valid credit card
4. Wait 5-10 minutes for activation
5. Test your QR code again

## 📊 **Quota Monitoring Setup**

### **Set Up Alerts:**
1. Google Cloud Console → Monitoring → Alerting
2. Create alert for "API usage > 80% of quota"
3. Get email/SMS when approaching limits

### **Track Usage:**
1. Google Cloud Console → APIs & Services → Dashboard
2. View daily/monthly usage graphs
3. Monitor which APIs use most quota

## ✅ **Success Checklist**

After fixing quota/billing issues:

- [ ] API key test returns valid results
- [ ] Google Cloud Billing shows "Active"
- [ ] Quotas show available capacity
- [ ] Railway app returns places when tested
- [ ] QR code works on mobile phone
- [ ] Hotel guests can discover nearby places

## 🎯 **Expected Fix Time**

- **Quota reset**: Wait until tomorrow (free)
- **Quota increase**: 2-24 hours (request needed)
- **Billing reactivation**: 5 minutes - 24 hours
- **New credit card**: 5-10 minutes

## 📞 **If Still Not Working**

Share these details:
1. Error message from API key test above
2. Google Cloud Billing status (Active/Suspended/Trial Ended)
3. Current quota usage percentages
4. Any error messages in Railway deployment logs

**Your QR system will work perfectly once quota/billing is resolved! 🚀**