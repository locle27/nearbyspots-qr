#!/usr/bin/env python3
"""
Create simple PWA icons for the app
"""

from PIL import Image, ImageDraw
import os

def create_icon(size, filename):
    """Create a simple icon with specified size"""
    # Create a new image with blue background
    img = Image.new('RGB', (size, size), color='#1976D2')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple QR-like pattern
    margin = size // 8
    block_size = (size - 2 * margin) // 8
    
    # Draw some blocks to simulate QR code
    blocks = [
        (1, 1), (1, 2), (1, 3), (1, 5), (1, 6),
        (2, 1), (2, 3), (2, 5), (2, 6),
        (3, 1), (3, 2), (3, 3), (3, 5),
        (5, 1), (5, 3), (5, 5), (5, 6),
        (6, 1), (6, 2), (6, 3), (6, 5), (6, 6)
    ]
    
    for x, y in blocks:
        x1 = margin + x * block_size
        y1 = margin + y * block_size
        x2 = x1 + block_size - 1
        y2 = y1 + block_size - 1
        draw.rectangle([x1, y1, x2, y2], fill='white')
    
    # Save the image
    img.save(f'public/{filename}')
    print(f"Created {filename} ({size}x{size})")

def main():
    """Create all required icons"""
    print("Creating PWA icons...")
    
    # Create icons for different sizes
    icons = [
        (192, 'icon-192.png'),
        (512, 'icon-512.png'),
        (32, 'favicon-32x32.png'),
        (16, 'favicon-16x16.png')
    ]
    
    for size, filename in icons:
        try:
            create_icon(size, filename)
        except Exception as e:
            print(f"Error creating {filename}: {e}")
    
    print("✅ Icons created successfully!")

if __name__ == "__main__":
    try:
        from PIL import Image, ImageDraw
        main()
    except ImportError:
        print("❌ PIL not installed. Install with: pip install Pillow")
        print("Or use online icon generator at: https://favicon.io/")
        
        # Create empty placeholder files
        placeholder_content = "placeholder"
        for filename in ['icon-192.png', 'icon-512.png']:
            with open(f'public/{filename}', 'w') as f:
                f.write(placeholder_content)
        print("Created placeholder files")