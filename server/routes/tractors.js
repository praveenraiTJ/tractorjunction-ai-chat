const express = require('express');
const router = express.Router();
const dbConnection = require('../config/database');

// Get all tractors with pagination
router.get('/', async (req, res) => {
  try {
    // Check if database connection is available
    if (!dbConnection.pool) {
      console.error('Database connection not initialized');
      return res.status(500).json({
        success: false,
        message: 'Database connection not available'
      });
    }
    const { 
      page = 1, 
      limit = 12, 
      brand, 
      minPrice, 
      maxPrice, 
      category,
      search 
    } = req.query;

    const offset = (page - 1) * limit;
    
    const searchParams = {
      query: search,
      brand,
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      category,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const tractors = await dbConnection.searchTractors(searchParams);
    
    // Get total count for pagination
    const countParams = { ...searchParams, limit: null, offset: null };
    const totalTractors = await dbConnection.searchTractors(countParams);
    const totalCount = totalTractors.length;

    res.json({
      success: true,
      data: {
        tractors,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching tractors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tractors',
      error: error.message
    });
  }
});

// Get tractor by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tractor = await dbConnection.getTractorById(id);
    
    if (!tractor) {
      return res.status(404).json({
        success: false,
        message: 'Tractor not found'
      });
    }

    res.json({
      success: true,
      data: tractor
    });
  } catch (error) {
    console.error('Error fetching tractor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tractor',
      error: error.message
    });
  }
});

// Get available brands
router.get('/meta/brands', async (req, res) => {
  try {
    const brands = await dbConnection.getBrands();
    res.json({
      success: true,
      data: brands
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brands',
      error: error.message
    });
  }
});

// Get available categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await dbConnection.getCategories();
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

module.exports = router;
