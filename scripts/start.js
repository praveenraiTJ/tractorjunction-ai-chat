#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Tractor Junction AI Chat System...\n');

// Check if .env file exists
if (!fs.existsSync('.env')) {
  console.log('⚠️  .env file not found. Please copy env.example to .env and configure your settings.');
  console.log('   cp env.example .env');
  process.exit(1);
}

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
  console.log('📦 Installing dependencies...');
  const npmInstall = spawn('npm', ['install'], { stdio: 'inherit' });
  
  npmInstall.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Failed to install dependencies');
      process.exit(1);
    }
    startClient();
  });
} else {
  startClient();
}

function startClient() {
  // Check if client node_modules exists
  if (!fs.existsSync('client/node_modules')) {
    console.log('📦 Installing client dependencies...');
    const clientInstall = spawn('npm', ['install'], { 
      cwd: path.join(__dirname, 'client'),
      stdio: 'inherit' 
    });
    
    clientInstall.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Failed to install client dependencies');
        process.exit(1);
      }
      startApplication();
    });
  } else {
    startApplication();
  }
}

function startApplication() {
  console.log('\n🎯 Starting application in development mode...');
  console.log('   - Backend: http://localhost:5000');
  console.log('   - Frontend: http://localhost:3000');
  console.log('   - Press Ctrl+C to stop\n');

  // Start both server and client
  const server = spawn('npm', ['run', 'server'], { 
    stdio: 'inherit',
    shell: true 
  });
  
  const client = spawn('npm', ['start'], { 
    cwd: path.join(__dirname, 'client'),
    stdio: 'inherit',
    shell: true 
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.kill('SIGINT');
    client.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    server.kill('SIGTERM');
    client.kill('SIGTERM');
    process.exit(0);
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ Server error:', error);
  });

  client.on('error', (error) => {
    console.error('❌ Client error:', error);
  });
}
