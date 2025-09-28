const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tractorjunction'
    });

    console.log('✅ Connected to database successfully!');
    
    // Check if tractors_trans table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'tractors_trans'");
    if (tables.length === 0) {
      console.log('❌ tractors_trans table does not exist');
      return;
    }
    
    console.log('✅ tractors_trans table exists');
    
    // Get table structure
    const [columns] = await connection.execute("DESCRIBE tractors_trans");
    console.log('\n📋 Table Structure:');
    console.table(columns);
    
    // Get sample data
    const [rows] = await connection.execute("SELECT * FROM tractors_trans LIMIT 5");
    console.log('\n📊 Sample Data:');
    console.table(rows);
    
    await connection.end();
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

checkDatabase();
