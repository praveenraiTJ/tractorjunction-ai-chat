const dbConnection = require('./server/config/database');

async function testServerDB() {
  try {
    console.log('Testing server database connection...');
    await dbConnection.initialize();
    console.log('✅ Database initialized successfully');
    
    // Test a simple query
    const tractors = await dbConnection.searchTractors('', {}, 2, 0);
    console.log('✅ Query successful! Found tractors:', tractors.length);
    console.log('First tractor:', tractors[0]?.brand, tractors[0]?.model);
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

testServerDB();
