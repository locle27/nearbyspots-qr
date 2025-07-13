// Debug script to test Google Places API directly
const axios = require('axios');

// Your hotel coordinates
const latitude = 21.034087;
const longitude = 105.85114;
const radius = 1000;

// Test with basic place types
const testPlaceTypes = [
  ['restaurant'],
  ['tourist_attraction'], 
  ['cafe'],
  ['museum'],
  // Test broader types
  ['establishment'],
  ['point_of_interest'],
  ['food']
];

async function testGooglePlacesAPI() {
  const API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'your-api-key-here';
  
  console.log('🔍 Testing Google Places API (New) with different place types');
  console.log(`📍 Location: ${latitude}, ${longitude}`);
  console.log(`📏 Radius: ${radius}m`);
  console.log('');

  for (const types of testPlaceTypes) {
    console.log(`🧪 Testing types: ${types.join(', ')}`);
    
    try {
      const response = await axios.post(
        'https://places.googleapis.com/v1/places:searchNearby',
        {
          includedTypes: types,
          maxResultCount: 10,
          locationRestriction: {
            circle: {
              center: { latitude, longitude },
              radius: radius
            }
          },
          languageCode: 'en'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.types'
          },
          timeout: 10000
        }
      );

      const places = response.data.places || [];
      console.log(`   ✅ Found ${places.length} places`);
      
      if (places.length > 0) {
        console.log(`   📍 First result: ${places[0].displayName?.text || 'Unknown'}`);
        console.log(`   🏷️  Types: ${places[0].types?.join(', ') || 'None'}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.data?.error?.message || error.message}`);
      if (error.response?.status === 403) {
        console.log(`   🔑 API Key issue - check permissions and billing`);
      }
    }
    
    console.log('');
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Test with text search as fallback
async function testTextSearch() {
  const API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'your-api-key-here';
  
  console.log('🔍 Testing Text Search API as fallback');
  
  const queries = [
    'restaurants near Hang Bac Street Hanoi',
    'coffee shops Hanoi Old Quarter',
    'tourist attractions Hoan Kiem Hanoi'
  ];
  
  for (const query of queries) {
    console.log(`🧪 Testing query: "${query}"`);
    
    try {
      const response = await axios.post(
        'https://places.googleapis.com/v1/places:searchText',
        {
          textQuery: query,
          maxResultCount: 5,
          locationBias: {
            circle: {
              center: { latitude, longitude },
              radius: radius
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating'
          }
        }
      );

      const places = response.data.places || [];
      console.log(`   ✅ Found ${places.length} places`);
      
      if (places.length > 0) {
        places.slice(0, 2).forEach(place => {
          console.log(`   📍 ${place.displayName?.text || 'Unknown'} (${place.rating || 'No rating'}⭐)`);
        });
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.data?.error?.message || error.message}`);
    }
    
    console.log('');
  }
}

// Run tests
if (require.main === module) {
  testGooglePlacesAPI().then(() => {
    console.log('🔄 Testing fallback Text Search API...\n');
    return testTextSearch();
  }).then(() => {
    console.log('✅ Debug testing complete!');
  }).catch(error => {
    console.error('❌ Debug test failed:', error);
  });
}

module.exports = { testGooglePlacesAPI, testTextSearch };