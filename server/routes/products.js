const express = require('express');
const dbConnection = require('../config/database');
const chromaService = require('../services/chromaService').chromaService;
const { getCache, setCache } = require('../services/cacheService');

const router = express.Router();

// Helper function to check database connectivity
const checkDatabaseConnection = async () => {
  try {
    await dbConnection.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
};

// Get all tractors with pagination and filters
router.get('/', async (req, res) => {
  try {
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable',
        message: 'Please try again later or contact support'
      });
    }

    const {
      page = 1,
      limit = 20,
      brand,
      category,
      minPrice,
      maxPrice,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    const searchParams = {
      query: search,
      brand,
      category,
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // Check cache first
    const cacheKey = `products_${JSON.stringify(searchParams)}`;
    const cachedResults = getCache(cacheKey);
    
    if (cachedResults) {
      return res.json({
        success: true,
        ...cachedResults,
        cached: true
      });
    }

    // Search tractors
    const tractors = await dbConnection.searchTractors(searchParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM tractors_trans 
      WHERE status = 'active'
      ${search ? 'AND (brand LIKE ? OR model LIKE ? OR description LIKE ?)' : ''}
      ${brand ? 'AND brand = ?' : ''}
      ${category ? 'AND category = ?' : ''}
      ${minPrice ? 'AND price >= ?' : ''}
      ${maxPrice ? 'AND price <= ?' : ''}
    `;

    const countParams = [];
    if (search) {
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    if (brand) countParams.push(brand);
    if (category) countParams.push(category);
    if (minPrice) countParams.push(minPrice);
    if (maxPrice) countParams.push(maxPrice);

    const [countResult] = await dbConnection.query(countQuery, countParams);
    const total = countResult.total;

    const result = {
      success: true,
      tractors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        brand,
        category,
        minPrice,
        maxPrice,
        search
      }
    };

    // Cache results for 30 minutes
    setCache(cacheKey, result, 1800);

    res.json(result);
  } catch (error) {
    console.error('Products list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve products',
      message: error.message
    });
  }
});

// Get tractor by ID
router.get('/:tractorId', async (req, res) => {
  try {
    const { tractorId } = req.params;

    // Check cache first
    const cacheKey = `tractor_${tractorId}`;
    const cachedTractor = getCache(cacheKey);
    
    if (cachedTractor) {
      return res.json({
        success: true,
        tractor: cachedTractor,
        cached: true
      });
    }

    const tractor = await dbConnection.getTractorById(tractorId);

    if (!tractor) {
      return res.status(404).json({
        success: false,
        error: 'Tractor not found'
      });
    }

    // Cache for 2 hours
    setCache(cacheKey, tractor, 7200);

    res.json({
      success: true,
      tractor
    });
  } catch (error) {
    console.error('Tractor details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tractor details',
      message: error.message
    });
  }
});

// Search tractors using semantic search
router.post('/search', async (req, res) => {
  try {
    const { query, filters = {}, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Use ChromaDB for semantic search
    const results = await chromaService.searchSimilar(query, limit, filters);

    res.json({
      success: true,
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

// Get brands
router.get('/meta/brands', async (req, res) => {
  try {
    // Check cache
    const cacheKey = 'brands_list';
    const cachedBrands = getCache(cacheKey);
    
    if (cachedBrands) {
      return res.json({
        success: true,
        brands: cachedBrands,
        cached: true
      });
    }

    const brands = await dbConnection.getBrands();

    // Cache for 1 hour
    setCache(cacheKey, brands, 3600);

    res.json({
      success: true,
      brands
    });
  } catch (error) {
    console.error('Brands list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve brands',
      message: error.message
    });
  }
});

// Get categories
router.get('/meta/categories', async (req, res) => {
  try {
    // Check cache
    const cacheKey = 'categories_list';
    const cachedCategories = getCache(cacheKey);
    
    if (cachedCategories) {
      return res.json({
        success: true,
        categories: cachedCategories,
        cached: true
      });
    }

    const categories = await dbConnection.getCategories();

    // Cache for 1 hour
    setCache(cacheKey, categories, 3600);

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Categories list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve categories',
      message: error.message
    });
  }
});

// Get price range
router.get('/meta/price-range', async (req, res) => {
  try {
    // Check cache
    const cacheKey = 'price_range';
    const cachedPriceRange = getCache(cacheKey);
    
    if (cachedPriceRange) {
      return res.json({
        success: true,
        priceRange: cachedPriceRange,
        cached: true
      });
    }

    const [result] = await dbConnection.query(
      'SELECT MIN(price) as minPrice, MAX(price) as maxPrice FROM tractors_trans WHERE status = "active" AND price IS NOT NULL'
    );

    const priceRange = {
      min: result.minPrice || 0,
      max: result.maxPrice || 10000000
    };

    // Cache for 1 hour
    setCache(cacheKey, priceRange, 3600);

    res.json({
      success: true,
      priceRange
    });
  } catch (error) {
    console.error('Price range error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve price range',
      message: error.message
    });
  }
});

// Get similar tractors
router.get('/:tractorId/similar', async (req, res) => {
  try {
    const { tractorId } = req.params;
    const { limit = 5 } = req.query;

    // Get the tractor first
    const tractor = await dbConnection.getTractorById(tractorId);
    if (!tractor) {
      return res.status(404).json({
        success: false,
        error: 'Tractor not found'
      });
    }

    // Create search query from tractor details
    const searchQuery = `${tractor.brand} ${tractor.model} ${tractor.category}`;
    
    // Find similar tractors
    const similarTractors = await chromaService.searchSimilar(
      searchQuery, 
      parseInt(limit) + 1, // +1 to exclude the original
      { brand: tractor.brand }
    );

    // Filter out the original tractor
    const filteredResults = similarTractors.filter(t => t.tractor_id !== tractorId);

    res.json({
      success: true,
      similarTractors: filteredResults.slice(0, limit),
      count: filteredResults.length
    });
  } catch (error) {
    console.error('Similar tractors error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find similar tractors',
      message: error.message
    });
  }
});

// Get tractor recommendations based on user preferences
router.post('/recommendations', async (req, res) => {
  try {
    const { preferences, sessionId } = req.body;

    if (!preferences) {
      return res.status(400).json({
        success: false,
        error: 'Preferences are required'
      });
    }

    // Create search query from preferences
    const searchQuery = Object.entries(preferences)
      .filter(([key, value]) => value && value !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .join(' ');

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Valid preferences are required'
      });
    }

    // Search for recommendations
    const recommendations = await chromaService.searchSimilar(
      searchQuery,
      10,
      {
        brand: preferences.brand,
        category: preferences.category,
        minPrice: preferences.minPrice,
        maxPrice: preferences.maxPrice
      }
    );

    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
      preferences,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      message: error.message
    });
  }
});

module.exports = router;
