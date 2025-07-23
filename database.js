const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection pool
let pool = null;

// Initialize database connection
async function initDatabase() {
  try {
    // Database connection configuration
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    
    if (!databaseUrl) {
      console.log('📋 No database URL found, using file storage as fallback');
      return false;
    }

    // Create connection pool
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10, // Maximum number of clients in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');

    // Create tables if they don't exist
    await createTables();
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('📋 Falling back to file storage');
    return false;
  }
}

// Create database tables
async function createTables() {
  const createRecommendationsTable = `
    CREATE TABLE IF NOT EXISTS recommendations (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      address TEXT NOT NULL,
      latitude DECIMAL(10, 8) NOT NULL,
      longitude DECIMAL(11, 8) NOT NULL,
      rating DECIMAL(3, 2) DEFAULT 0,
      user_rating_count INTEGER DEFAULT 0,
      description TEXT,
      category VARCHAR(50) DEFAULT 'recommend',
      website_uri TEXT,
      featured BOOLEAN DEFAULT false,
      added_by VARCHAR(100) DEFAULT 'manual_entry',
      added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      images JSONB DEFAULT '[]'::jsonb,
      parsed_data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_recommendations_location ON recommendations (latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_recommendations_category ON recommendations (category);
    CREATE INDEX IF NOT EXISTS idx_recommendations_featured ON recommendations (featured);
    CREATE INDEX IF NOT EXISTS idx_recommendations_added_date ON recommendations (added_date);
  `;

  try {
    await pool.query(createRecommendationsTable);
    await pool.query(createIndexes);
    console.log('✅ Database tables created/verified');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  }
}

// Database operations
const db = {
  // Get all recommendations
  async getAllRecommendations() {
    if (!pool) return null;
    
    try {
      const result = await pool.query(`
        SELECT 
          id,
          name,
          address,
          latitude,
          longitude,
          rating,
          user_rating_count,
          description,
          category,
          website_uri,
          featured,
          added_by,
          added_date,
          images,
          parsed_data
        FROM recommendations 
        ORDER BY added_date DESC
      `);
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        address: row.address,
        location: {
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude)
        },
        rating: parseFloat(row.rating) || 0,
        userRatingCount: row.user_rating_count || 0,
        description: row.description || '',
        category: row.category || 'recommend',
        websiteUri: row.website_uri || '',
        featured: row.featured || false,
        addedBy: row.added_by || 'manual_entry',
        addedDate: row.added_date,
        images: row.images || [],
        parsedData: row.parsed_data,
        photos: [] // For compatibility with existing code
      }));
    } catch (error) {
      console.error('❌ Error getting recommendations:', error);
      return null;
    }
  },

  // Add new recommendation
  async addRecommendation(recommendation) {
    if (!pool) return null;
    
    try {
      const query = `
        INSERT INTO recommendations (
          id, name, address, latitude, longitude, rating, user_rating_count,
          description, category, website_uri, featured, added_by, images, parsed_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;
      
      const values = [
        recommendation.id,
        recommendation.name,
        recommendation.address,
        recommendation.location.latitude,
        recommendation.location.longitude,
        recommendation.rating || 0,
        recommendation.userRatingCount || 0,
        recommendation.description || '',
        recommendation.category || 'recommend',
        recommendation.websiteUri || '',
        recommendation.featured || false,
        recommendation.addedBy || 'manual_entry',
        JSON.stringify(recommendation.images || []),
        JSON.stringify(recommendation.parsedData || null)
      ];
      
      const result = await pool.query(query, values);
      console.log(`✅ Added recommendation to database: ${recommendation.name}`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error adding recommendation:', error);
      return null;
    }
  },

  // Update recommendation
  async updateRecommendation(id, updates) {
    if (!pool) return null;
    
    try {
      const query = `
        UPDATE recommendations 
        SET 
          name = COALESCE($2, name),
          address = COALESCE($3, address),
          latitude = COALESCE($4, latitude),
          longitude = COALESCE($5, longitude),
          rating = COALESCE($6, rating),
          description = COALESCE($7, description),
          website_uri = COALESCE($8, website_uri),
          featured = COALESCE($9, featured),
          images = COALESCE($10, images),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      
      // Handle both direct coordinate properties and nested location object
      const latitude = updates.location ? updates.location.latitude : updates.latitude;
      const longitude = updates.location ? updates.location.longitude : updates.longitude;
      
      const values = [
        id,
        updates.name,
        updates.address,
        latitude,
        longitude,
        updates.rating,
        updates.description,
        updates.websiteUri,
        updates.featured,
        updates.images ? JSON.stringify(updates.images) : null
      ];
      
      console.log('🔧 Database update values:', {
        id,
        name: updates.name,
        coordinates: { latitude, longitude },
        hasLocation: !!updates.location
      });
      
      const result = await pool.query(query, values);
      
      if (result.rows.length > 0) {
        console.log('✅ Database update successful:', {
          id: result.rows[0].id,
          name: result.rows[0].name,
          updated_coordinates: {
            latitude: result.rows[0].latitude,
            longitude: result.rows[0].longitude
          }
        });
        return result.rows[0];
      } else {
        console.error('⚠️ No rows returned from database update - place not found?');
        return null;
      }
    } catch (error) {
      console.error('❌ Error updating recommendation:', error);
      console.error('📋 Query values that failed:', values);
      return null;
    }
  },

  // Delete recommendation
  async deleteRecommendation(id) {
    if (!pool) return null;
    
    try {
      const result = await pool.query('DELETE FROM recommendations WHERE id = $1 RETURNING *', [id]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error deleting recommendation:', error);
      return null;
    }
  },

  // Get recommendation by ID
  async getRecommendationById(id) {
    if (!pool) return null;
    
    try {
      const result = await pool.query('SELECT * FROM recommendations WHERE id = $1', [id]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting recommendation by ID:', error);
      return null;
    }
  },

  // Health check
  async healthCheck() {
    if (!pool) return false;
    
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return false;
    }
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  if (pool) {
    await pool.end();
    console.log('📋 Database connection closed');
  }
});

module.exports = {
  initDatabase,
  db
};