#!/usr/bin/env node

/**
 * Data Recovery Script for Lost Recommendations
 * This script helps recover lost restaurant data
 */

const fs = require('fs');
const path = require('path');

// Load current recommendations
const dataFile = path.join(__dirname, 'data', 'recommendations.json');
let recommendations = [];

try {
  if (fs.existsSync(dataFile)) {
    recommendations = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    console.log(`📋 Current recommendations: ${recommendations.length}`);
  }
} catch (error) {
  console.error('❌ Error loading recommendations:', error);
}

// Function to add a new restaurant
function addRestaurant(name, address, latitude, longitude, description = '') {
  const newRestaurant = {
    id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name: name,
    address: address,
    location: {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    },
    rating: 0,
    userRatingCount: 0,
    distance: 0,
    description: description,
    category: "recommend",
    photos: [],
    images: [],
    websiteUri: "",
    addedBy: "data_recovery",
    addedDate: new Date().toISOString(),
    featured: false
  };

  recommendations.push(newRestaurant);
  console.log(`✅ Added: ${name} at ${address}`);
  return newRestaurant;
}

// Function to save recommendations
function saveRecommendations() {
  try {
    // Create backup first
    const backupFile = `${dataFile}.backup_${Date.now()}`;
    if (fs.existsSync(dataFile)) {
      fs.copyFileSync(dataFile, backupFile);
      console.log(`💾 Backup created: ${backupFile}`);
    }

    // Save updated recommendations
    fs.writeFileSync(dataFile, JSON.stringify(recommendations, null, 2));
    console.log(`💾 Saved ${recommendations.length} recommendations to ${dataFile}`);
  } catch (error) {
    console.error('❌ Error saving recommendations:', error);
  }
}

// Add some example restaurants (replace with your actual restaurants)
console.log('🔄 Starting data recovery...');
console.log('📍 Add your restaurants below by calling addRestaurant()');

// Example usage (uncomment and modify these lines with your actual restaurant data):
/*
addRestaurant(
  "Restaurant Name 1", 
  "Address 1, Hanoi", 
  21.0331, 
  105.8519, 
  "Description of restaurant 1"
);

addRestaurant(
  "Restaurant Name 2", 
  "Address 2, Hanoi", 
  21.0341, 
  105.8529, 
  "Description of restaurant 2"
);

addRestaurant(
  "Restaurant Name 3", 
  "Address 3, Hanoi", 
  21.0351, 
  105.8539, 
  "Description of restaurant 3"
);
*/

console.log('\n📝 To add your restaurants:');
console.log('1. Edit this file (recover-data.js)');
console.log('2. Uncomment and modify the addRestaurant() calls above');
console.log('3. Replace with your actual restaurant names, addresses, and coordinates');
console.log('4. Run: node recover-data.js');
console.log('5. Call saveRecommendations() at the end');

// Uncomment this line after adding your restaurants:
// saveRecommendations();

module.exports = { addRestaurant, saveRecommendations };