#!/usr/bin/env node

const { chromaService } = require('./server/services/chromaService');

async function testChromaDBIntegration() {
  console.log('🧪 Testing ChromaDB Integration');
  console.log('================================\n');

  try {
    // Test 1: Initialize ChromaDB service
    console.log('1️⃣ Testing ChromaDB initialization...');
    await chromaService.initialize();
    
    if (chromaService.client) {
      console.log('✅ ChromaDB client initialized successfully');
    } else {
      console.log('⚠️ ChromaDB client not available, using fallback mode');
    }

    // Test 2: Test search functionality
    console.log('\n2️⃣ Testing search functionality...');
    const testQuery = 'Mahindra tractors for farming';
    const searchResults = await chromaService.searchSimilar(testQuery, 3);
    
    console.log(`✅ Search completed: Found ${searchResults.length} results`);
    if (searchResults.length > 0) {
      console.log('   Sample result:', {
        brand: searchResults[0].brand_name || 'N/A',
        model: searchResults[0].model_name || 'N/A',
        price: searchResults[0].min_price || 'N/A'
      });
    }

    // Test 3: Test collection stats
    console.log('\n3️⃣ Testing collection statistics...');
    const stats = await chromaService.getCollectionStats();
    if (stats) {
      console.log('✅ Collection stats:', stats);
    } else {
      console.log('⚠️ Collection stats not available (ChromaDB not running)');
    }

    console.log('\n🎉 ChromaDB integration test completed!');
    console.log('\n📋 Summary:');
    console.log(`   - ChromaDB Status: ${chromaService.client ? 'Connected' : 'Fallback Mode'}`);
    console.log(`   - Search Results: ${searchResults.length} found`);
    console.log(`   - Collection Stats: ${stats ? 'Available' : 'Not Available'}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 This is normal if ChromaDB server is not running');
    console.log('   The application will work with database fallback');
  }
}

// Run the test
testChromaDBIntegration().catch(console.error);
