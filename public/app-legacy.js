// Global state
let currentLocation = null;
let currentRadius = 1000;
let currentResults = {};
let currentCategory = 'restaurants';
let displayLimits = {}; // Track how many items are currently displayed per category
const INITIAL_DISPLAY_COUNT = 8; // Show first 8 items, then "See More"

// DOM elements
const elements = {
    permissionScreen: document.getElementById('permission-screen'),
    manualLocationScreen: document.getElementById('manual-location-screen'),
    distanceScreen: document.getElementById('distance-screen'),
    resultsScreen: document.getElementById('results-screen'),
    loadingScreen: document.getElementById('loading-screen'),
    errorScreen: document.getElementById('error-screen'),
    qrGenerator: document.getElementById('qr-generator'),
    
    enableLocationBtn: document.getElementById('enable-location-btn'),
    manualLocationBtn: document.getElementById('manual-location-btn'),
    searchAddressBtn: document.getElementById('search-address-btn'),
    addressInput: document.getElementById('address-input'),
    searchPlacesBtn: document.getElementById('search-places-btn'),
    changeLocationBtn: document.getElementById('change-location-btn'),
    retryBtn: document.getElementById('retry-btn'),
    
    errorMessage: document.getElementById('error-message'),
    resultsCount: document.getElementById('results-count'),
    resultsContainer: document.getElementById('results-container'),
    noResults: document.getElementById('no-results'),
    
    showQrGenerator: document.getElementById('show-qr-generator'),
    generateQrBtn: document.getElementById('generate-qr-btn'),
    downloadQrBtn: document.getElementById('download-qr-btn'),
    qrResult: document.getElementById('qr-result'),
    qrImage: document.getElementById('qr-image')
};

// Utility functions
function showScreen(screenElement) {
    document.querySelectorAll('[id$="-screen"], .qr-generator').forEach(screen => {
        screen.classList.add('hidden');
    });
    screenElement.classList.remove('hidden');
}

function showLoading(text = 'Loading...') {
    elements.loadingScreen.querySelector('.loading-text').textContent = text;
    showScreen(elements.loadingScreen);
}

function showError(message) {
    elements.errorMessage.textContent = message;
    showScreen(elements.errorScreen);
}

function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
}

function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 0; i < fullStars; i++) {
        stars += '⭐';
    }
    if (hasHalfStar) {
        stars += '⭐';
    }
    
    return stars || '⭐';
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Geolocation functions
async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                let errorMessage = 'Unable to get your location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied. Please enable location permissions.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable. Please check your GPS.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out. Please try again.';
                        break;
                }
                reject(new Error(errorMessage));
            },
            options
        );
    });
}

async function geocodeAddress(address) {
    try {
        const response = await fetch('/api/geocode-address', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ address })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to find location');
        }
        
        const data = await response.json();
        return {
            latitude: data.latitude,
            longitude: data.longitude
        };
    } catch (error) {
        console.error('Geocoding error:', error);
        throw new Error('Failed to find location. Please try a different address.');
    }
}

// API functions
async function searchNearbyPlaces(latitude, longitude, radius) {
    try {
        const response = await fetch('/api/search-nearby', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                latitude,
                longitude,
                radius
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to search nearby places');
        }

        return await response.json();
    } catch (error) {
        console.error('Search API error:', error);
        throw error;
    }
}

async function generateQRCode(baseUrl, latitude = null, longitude = null, label = null) {
    try {
        const response = await fetch('/api/generate-qr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                baseUrl,
                latitude,
                longitude,
                label
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate QR code');
        }

        return await response.json();
    } catch (error) {
        console.error('QR generation error:', error);
        throw error;
    }
}

// UI functions
function updateResultsDisplay() {
    const category = currentCategory;
    const places = currentResults[category] || [];
    
    elements.resultsContainer.innerHTML = '';
    
    if (places.length === 0) {
        elements.noResults.classList.remove('hidden');
        elements.resultsContainer.classList.add('hidden');
        return;
    }
    
    elements.noResults.classList.add('hidden');
    elements.resultsContainer.classList.remove('hidden');
    
    // Initialize display limit for this category if not set
    if (!displayLimits[category]) {
        displayLimits[category] = INITIAL_DISPLAY_COUNT;
    }
    
    const displayCount = Math.min(displayLimits[category], places.length);
    const hasMoreResults = places.length > displayCount;
    
    // Display places up to the current limit
    places.slice(0, displayCount).forEach(place => {
        const placeCard = createPlaceCard(place);
        elements.resultsContainer.appendChild(placeCard);
    });
    
    // Add "See More" button if there are more results
    if (hasMoreResults) {
        const seeMoreContainer = document.createElement('div');
        seeMoreContainer.className = 'see-more-container';
        seeMoreContainer.innerHTML = `
            <button class="see-more-btn" onclick="showMoreResults('${category}')">
                🔍 See More Places (${places.length - displayCount} more)
            </button>
        `;
        elements.resultsContainer.appendChild(seeMoreContainer);
    }
    
    // Update results count
    const totalPlaces = Object.values(currentResults).reduce((sum, categoryPlaces) => sum + categoryPlaces.length, 0);
    const avgRating = places.length > 0 ? (places.reduce((sum, place) => sum + (place.rating || 0), 0) / places.length).toFixed(1) : 0;
    elements.resultsCount.textContent = `${totalPlaces} places found (avg rating: ${avgRating}⭐)`;
}

function createPlaceCard(place) {
    const card = document.createElement('div');
    card.className = 'place-card';
    
    const rating = place.rating || 0;
    const ratingCount = place.userRatingCount || 0;
    const stars = generateStars(rating);
    
    // Get first photo if available
    const photoUrl = place.photos && place.photos.length > 0 
        ? `/api/place-photo/${encodeURIComponent(place.photos[0].name)}?maxHeightPx=300&maxWidthPx=400`
        : null;
    
    // Highlight highly rated places with 4+ stars
    const isHighRated = rating >= 4.0;
    if (isHighRated) {
        card.classList.add('high-rated');
    }
    
    card.innerHTML = `
        ${photoUrl ? `
            <div class="place-photo">
                <img src="${photoUrl}" alt="${place.name}" loading="lazy">
            </div>
        ` : ''}
        <div class="place-content">
            <div class="place-header">
                <h3 class="place-name">${place.name}</h3>
                <span class="place-distance">${formatDistance(place.distance)}</span>
            </div>
            <p class="place-address">${place.address}</p>
            <div class="place-rating">
                ${rating > 0 ? `
                    <span class="rating-stars">${stars}</span>
                    <span class="rating-score ${isHighRated ? 'high-rating' : ''}">${rating.toFixed(1)}</span>
                    <span class="rating-text">(${ratingCount} reviews)</span>
                ` : `
                    <span class="rating-text no-rating">No rating available</span>
                `}
            </div>
            <div class="place-actions">
                <button class="action-btn directions-btn" data-lat="${place.location.latitude}" data-lng="${place.location.longitude}" data-name="${place.name}">
                    🗺️ Directions
                </button>
                ${place.websiteUri ? `
                    <button class="action-btn secondary website-btn" data-url="${place.websiteUri}">
                        🌐 Website
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    // Add event listeners to buttons
    const directionsBtn = card.querySelector('.directions-btn');
    if (directionsBtn) {
        directionsBtn.addEventListener('click', () => {
            openDirections(place.location.latitude, place.location.longitude, place.name);
        });
    }
    
    const websiteBtn = card.querySelector('.website-btn');
    if (websiteBtn) {
        websiteBtn.addEventListener('click', () => {
            openWebsite(place.websiteUri);
        });
    }
    
    // Handle photo error
    const photoImg = card.querySelector('.place-photo img');
    if (photoImg) {
        photoImg.addEventListener('error', (e) => {
            console.log('Photo failed to load:', e.target.src);
            photoImg.parentElement.style.display = 'none';
        });
        photoImg.addEventListener('load', () => {
            console.log('Photo loaded successfully:', photoImg.src);
        });
    }
    
    return card;
}

function openDirections(lat, lng, placeName) {
    const destination = `${lat},${lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&destination_place_id=${encodeURIComponent(placeName)}`;
    window.open(url, '_blank');
}

function openInMaps(mapsUrl) {
    window.open(mapsUrl, '_blank');
}

function openWebsite(websiteUrl) {
    window.open(websiteUrl, '_blank');
}

// Event handlers
async function handleEnableLocation() {
    try {
        showLoading('Getting your location...');
        currentLocation = await getCurrentLocation();
        showScreen(elements.distanceScreen);
    } catch (error) {
        showError(error.message);
    }
}

async function handleManualLocation() {
    showScreen(elements.manualLocationScreen);
}

async function handleSearchAddress() {
    const address = elements.addressInput.value.trim();
    if (!address) {
        alert('Please enter an address');
        return;
    }
    
    try {
        showLoading('Finding location...');
        currentLocation = await geocodeAddress(address);
        showScreen(elements.distanceScreen);
    } catch (error) {
        showError(error.message);
    }
}

async function handleSearchPlaces() {
    if (!currentLocation) {
        showError('Location not available. Please try again.');
        return;
    }
    
    try {
        showLoading('Finding nearby places...');
        const response = await searchNearbyPlaces(
            currentLocation.latitude,
            currentLocation.longitude,
            currentRadius
        );
        
        currentResults = response.results;
        updateResultsDisplay();
        showScreen(elements.resultsScreen);
    } catch (error) {
        showError(error.message);
    }
}

function handleDistanceSelection(radius) {
    currentRadius = parseInt(radius);
    
    // Update UI
    document.querySelectorAll('.distance-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.querySelector(`[data-radius="${radius}"]`).classList.add('selected');
}

function handleCategoryChange(category) {
    currentCategory = category;
    
    // Update UI
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    updateResultsDisplay();
}

function showMoreResults(category) {
    // Increase display limit for this category
    displayLimits[category] = (displayLimits[category] || INITIAL_DISPLAY_COUNT) + INITIAL_DISPLAY_COUNT;
    
    // If this is the current category, refresh the display
    if (category === currentCategory) {
        updateResultsDisplay();
    }
}

async function handleGenerateQR() {
    const label = document.getElementById('qr-label').value.trim();
    const lat = document.getElementById('qr-lat').value.trim();
    const lng = document.getElementById('qr-lng').value.trim();
    
    try {
        showLoading('Generating QR code...');
        
        const baseUrl = window.location.origin;
        const latitude = lat ? parseFloat(lat) : null;
        const longitude = lng ? parseFloat(lng) : null;
        
        const result = await generateQRCode(baseUrl, latitude, longitude, label);
        
        elements.qrImage.src = result.qrCode;
        elements.qrResult.classList.remove('hidden');
        
        showScreen(elements.qrGenerator);
    } catch (error) {
        showError(error.message);
    }
}

function handleDownloadQR() {
    const link = document.createElement('a');
    link.download = 'nearby-places-qr-code.png';
    link.href = elements.qrImage.src;
    link.click();
}

// Initialize app
function initApp() {
    // Check for injected default location (your hotel)
    if (window.DEFAULT_LOCATION) {
        currentLocation = {
            latitude: window.DEFAULT_LOCATION.latitude,
            longitude: window.DEFAULT_LOCATION.longitude
        };
        
        // Show hotel info if available
        if (window.DEFAULT_LOCATION.source === 'hotel_default') {
            console.log(`🏨 Using default hotel location: ${window.DEFAULT_LOCATION.label}`);
            console.log(`📍 Address: ${window.DEFAULT_LOCATION.address}`);
            
            // Update header to show hotel context
            const headerSubtitle = document.querySelector('.header-subtitle');
            if (headerSubtitle && window.DEFAULT_LOCATION.description) {
                headerSubtitle.textContent = window.DEFAULT_LOCATION.description;
            }
        }
        
        // Skip to distance selection since we have your hotel location
        showScreen(elements.distanceScreen);
        return;
    }
    
    // Fallback: Check for URL parameters (legacy support)
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lng = urlParams.get('lng');
    
    if (lat && lng) {
        currentLocation = {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng)
        };
        showScreen(elements.distanceScreen);
    } else {
        // No location data available, ask for permission
        showScreen(elements.permissionScreen);
    }
    
    // Event listeners
    elements.enableLocationBtn.addEventListener('click', handleEnableLocation);
    elements.manualLocationBtn.addEventListener('click', handleManualLocation);
    elements.searchAddressBtn.addEventListener('click', handleSearchAddress);
    elements.searchPlacesBtn.addEventListener('click', handleSearchPlaces);
    elements.changeLocationBtn.addEventListener('click', () => showScreen(elements.permissionScreen));
    elements.retryBtn.addEventListener('click', () => showScreen(elements.permissionScreen));
    
    // Distance selection
    document.querySelectorAll('.distance-option').forEach(option => {
        option.addEventListener('click', () => {
            handleDistanceSelection(option.dataset.radius);
        });
    });
    
    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            handleCategoryChange(tab.dataset.category);
        });
    });
    
    // QR Generator
    elements.showQrGenerator.addEventListener('click', () => {
        showScreen(elements.qrGenerator);
    });
    elements.generateQrBtn.addEventListener('click', handleGenerateQR);
    elements.downloadQrBtn.addEventListener('click', handleDownloadQR);
    
    // Address input enter key
    elements.addressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearchAddress();
        }
    });
    
    // Debounced address search
    const debouncedSearch = debounce(handleSearchAddress, 300);
    elements.addressInput.addEventListener('input', () => {
        if (elements.addressInput.value.trim().length > 3) {
            // Could implement autocomplete here
        }
    });
}

// Service Worker disabled for debugging
// Uncomment to enable service worker
/*
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
*/

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Handle browser back button
window.addEventListener('popstate', (event) => {
    // Reset to initial state
    showScreen(elements.permissionScreen);
});

// Handle online/offline status
window.addEventListener('online', () => {
    console.log('App is online');
});

window.addEventListener('offline', () => {
    console.log('App is offline');
    if (!elements.errorScreen.classList.contains('hidden')) {
        showError('You appear to be offline. Please check your internet connection.');
    }
});

// Export functions for global access
window.openDirections = openDirections;
window.openInMaps = openInMaps;
window.openWebsite = openWebsite;
window.showMoreResults = showMoreResults;