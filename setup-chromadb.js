#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 ChromaDB Setup Script');
console.log('========================\n');

// Check if ChromaDB is already running
async function checkChromaDB() {
  return new Promise((resolve) => {
    const curl = spawn('curl', ['-s', 'http://localhost:8000/api/v1/heartbeat'], { stdio: 'pipe' });
    curl.on('close', (code) => {
      resolve(code === 0);
    });
    curl.on('error', () => {
      resolve(false);
    });
  });
}

// Start ChromaDB with Python
async function startChromaDBPython() {
  console.log('🐍 Starting ChromaDB with Python...');
  return new Promise((resolve, reject) => {
    const chroma = spawn('python', ['-m', 'chromadb', 'run', '--host', 'localhost', '--port', '8000'], {
      stdio: 'inherit',
      shell: true
    });
    
    chroma.on('error', (error) => {
      console.error('❌ Failed to start ChromaDB with Python:', error.message);
      reject(error);
    });
    
    // Give it some time to start
    setTimeout(() => {
      resolve(true);
    }, 3000);
  });
}

// Start ChromaDB with Docker
async function startChromaDBDocker() {
  console.log('🐳 Starting ChromaDB with Docker...');
  return new Promise((resolve, reject) => {
    const docker = spawn('docker', ['run', '-d', '--name', 'tractor-chromadb', '-p', '8000:8000', 'chromadb/chroma:latest'], {
      stdio: 'inherit',
      shell: true
    });
    
    docker.on('error', (error) => {
      console.error('❌ Failed to start ChromaDB with Docker:', error.message);
      reject(error);
    });
    
    docker.on('close', (code) => {
      if (code === 0) {
        console.log('✅ ChromaDB started with Docker');
        resolve(true);
      } else {
        reject(new Error('Docker command failed'));
      }
    });
  });
}

// Main setup function
async function setupChromaDB() {
  try {
    // Check if ChromaDB is already running
    console.log('🔍 Checking if ChromaDB is already running...');
    const isRunning = await checkChromaDB();
    
    if (isRunning) {
      console.log('✅ ChromaDB is already running!');
      return true;
    }
    
    console.log('⚠️ ChromaDB is not running. Attempting to start...\n');
    
    // Try Docker first
    try {
      await startChromaDBDocker();
      console.log('✅ ChromaDB started successfully with Docker');
      return true;
    } catch (dockerError) {
      console.log('⚠️ Docker method failed, trying Python...');
      
      // Try Python as fallback
      try {
        await startChromaDBPython();
        console.log('✅ ChromaDB started successfully with Python');
        return true;
      } catch (pythonError) {
        console.error('❌ Both Docker and Python methods failed');
        console.log('\n📋 Manual setup instructions:');
        console.log('1. Start Docker Desktop');
        console.log('2. Run: docker run -d --name tractor-chromadb -p 8000:8000 chromadb/chroma:latest');
        console.log('3. Or run: python -m chromadb run --host localhost --port 8000');
        console.log('\n💡 The application will work without ChromaDB using database fallback');
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    return false;
  }
}

// Test ChromaDB connection
async function testChromaDB() {
  console.log('\n🧪 Testing ChromaDB connection...');
  
  try {
    const response = await fetch('http://localhost:8000/api/v1/heartbeat');
    if (response.ok) {
      console.log('✅ ChromaDB is responding correctly');
      return true;
    } else {
      console.log('⚠️ ChromaDB responded but with error status');
      return false;
    }
  } catch (error) {
    console.log('❌ ChromaDB connection test failed:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  const success = await setupChromaDB();
  
  if (success) {
    console.log('\n🎉 ChromaDB setup completed successfully!');
    console.log('   ChromaDB is available at: http://localhost:8000');
    console.log('   You can now start your application with: npm run dev');
  } else {
    console.log('\n⚠️ ChromaDB setup failed, but the application will work with database fallback');
    console.log('   Start your application with: npm run dev');
  }
  
  console.log('\n📚 For more information, see the README.md file');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { setupChromaDB, testChromaDB };
