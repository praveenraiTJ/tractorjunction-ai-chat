const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('Testing tractors API...');
    const response = await fetch('http://localhost:5000/api/tractors?limit=2');
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();
