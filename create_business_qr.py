#!/usr/bin/env python3
"""
Business QR Code Generator
Creates QR codes for your business that customers can scan to discover nearby places
"""

import qrcode
from PIL import Image
import io
import base64

def create_business_qr(base_url, business_name, latitude=None, longitude=None):
    """
    Create a QR code for your business
    
    Args:
        base_url: Your app URL (when you get it)
        business_name: Your business name
        latitude: Your business latitude (optional)
        longitude: Your business longitude (optional)
    """
    
    # Build URL with parameters
    url = base_url
    params = []
    
    if latitude and longitude:
        params.append(f"lat={latitude}")
        params.append(f"lng={longitude}")
    
    if business_name:
        params.append(f"label={business_name.replace(' ', '%20')}")
    
    if params:
        url += "?" + "&".join(params)
    
    print(f"🔗 QR Code URL: {url}")
    
    # Create QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save QR code
    filename = f"qr_{business_name.lower().replace(' ', '_')}.png"
    img.save(filename)
    print(f"💾 QR Code saved as: {filename}")
    
    return url, filename

def create_multiple_qr_codes():
    """Create QR codes for different business scenarios"""
    
    # YOU NEED TO REPLACE THIS WITH YOUR ACTUAL URL
    base_url = "https://YOUR-DOMAIN-HERE.vercel.app"  # or Railway URL when you get it
    
    # Example QR codes for different businesses
    businesses = [
        {
            "name": "My Restaurant",
            "lat": 21.0285,  # Replace with your coordinates
            "lng": 105.8542  # Replace with your coordinates
        },
        {
            "name": "Coffee Shop",
            "lat": 21.0285,
            "lng": 105.8542
        },
        {
            "name": "Hotel Lobby",
            "lat": 21.0285,
            "lng": 105.8542
        },
        {
            "name": "Tourist Information",
            "lat": None,  # Let users set their own location
            "lng": None
        }
    ]
    
    print("🎯 Creating Business QR Codes...")
    print("=" * 50)
    
    for business in businesses:
        url, filename = create_business_qr(
            base_url,
            business["name"],
            business["lat"],
            business["lng"]
        )
        print(f"✅ Created QR for: {business['name']}")
        print(f"   URL: {url}")
        print(f"   File: {filename}")
        print()

if __name__ == "__main__":
    print("🚀 Business QR Code Generator")
    print("=" * 50)
    
    # Check if required packages are installed
    try:
        import qrcode
        from PIL import Image
        print("✅ Required packages installed")
    except ImportError:
        print("❌ Please install required packages:")
        print("   pip install qrcode[pil]")
        exit(1)
    
    create_multiple_qr_codes()
    
    print("🎉 QR Codes Generated!")
    print("\n📋 Next Steps:")
    print("1. Get your app URL (Railway, Vercel, or Ngrok)")
    print("2. Update base_url in this script")
    print("3. Update latitude/longitude with your business location")
    print("4. Run script again to generate final QR codes")
    print("5. Print QR codes and place them for customers to scan")