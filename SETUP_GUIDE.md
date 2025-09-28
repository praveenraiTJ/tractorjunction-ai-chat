# 🚀 Tractor Junction AI Chat - Setup Guide

This guide will help you set up the complete Tractor Junction AI Chat System on your local machine or production server.

## 📋 Prerequisites

### Required Software
- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **MySQL** (v8.0 or higher) - [Download](https://dev.mysql.com/downloads/)
- **Python** (v3.8 or higher) - [Download](https://python.org/)
- **Git** - [Download](https://git-scm.com/)

### Required Accounts
- **OpenAI API Key** - [Get from OpenAI](https://platform.openai.com/api-keys)
- **MySQL Database** - Local or cloud instance

## 🛠️ Installation Steps

### Step 1: Clone and Setup
```bash
# Clone the repository
git clone <repository-url>
cd tractor-junction-ai-chat

# Run setup script
node setup.js
```

### Step 2: Configure Environment
```bash
# Copy environment template
cp env.example .env

# Edit .env file with your settings
nano .env
```

**Required .env configuration:**
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=tractor_junction
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# ChromaDB Configuration
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Session Configuration
SESSION_SECRET=your_session_secret_here
```

### Step 3: Database Setup

#### Option A: Local MySQL
```bash
# Start MySQL service
sudo systemctl start mysql

# Create database
mysql -u root -p
CREATE DATABASE tractor_junction;
CREATE USER 'tractor_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON tractor_junction.* TO 'tractor_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Option B: Docker MySQL
```bash
# Start MySQL with Docker
docker run --name tractor-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=tractor_junction \
  -e MYSQL_USER=tractor_user \
  -e MYSQL_PASSWORD=tractor_password \
  -p 3306:3306 \
  -d mysql:8.0
```

### Step 4: ChromaDB Setup

#### Option A: Local Installation
```bash
# Install ChromaDB
pip install chromadb

# Start ChromaDB server
chroma run --host localhost --port 8000
```

#### Option B: Docker ChromaDB
```bash
# Start ChromaDB with Docker
docker run --name tractor-chromadb \
  -p 8000:8000 \
  -d chromadb/chroma:latest
```

### Step 5: Install Dependencies
```bash
# Install all dependencies
npm run install-all

# Or install separately
npm install
cd client && npm install
```

### Step 6: Initialize Database Schema
```bash
# Start the server once to create tables
npm run server

# The application will automatically create the required tables
```

### Step 7: Insert Sample Data
```bash
# Insert sample tractor data
node server/scripts/sampleData.js
```

### Step 8: Start the Application
```bash
# Development mode (both frontend and backend)
npm run dev

# Or start individually
npm run server  # Backend only
npm run client  # Frontend only
```

## 🌐 Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health**: http://localhost:5000/api/health
- **ChromaDB**: http://localhost:8000

## 🐳 Docker Setup (Alternative)

### Quick Start with Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Individual Docker Services
```bash
# MySQL
docker run --name tractor-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=tractor_junction \
  -p 3306:3306 \
  -d mysql:8.0

# ChromaDB
docker run --name tractor-chromadb \
  -p 8000:8000 \
  -d chromadb/chroma:latest

# Redis (Optional)
docker run --name tractor-redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

## 🔧 Configuration

### Database Configuration
Update your `.env` file with correct database credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=tractor_junction
DB_USER=your_username
DB_PASSWORD=your_password
```

### OpenAI Configuration
Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys):
```env
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-3.5-turbo
```

### ChromaDB Configuration
```env
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

## 🧪 Testing the Setup

### 1. Health Check
```bash
curl http://localhost:5000/api/health
```

### 2. Database Connection
```bash
# Check if tables are created
mysql -u your_username -p tractor_junction -e "SHOW TABLES;"
```

### 3. ChromaDB Connection
```bash
curl http://localhost:8000/api/v1/heartbeat
```

### 4. Frontend Access
Open http://localhost:3000 in your browser

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check MySQL service
sudo systemctl status mysql

# Check connection
mysql -u your_username -p -h localhost
```

#### 2. ChromaDB Connection Failed
```bash
# Check ChromaDB service
curl http://localhost:8000/api/v1/heartbeat

# Restart ChromaDB
chroma run --host localhost --port 8000
```

#### 3. OpenAI API Errors
- Verify your API key is correct
- Check your OpenAI account has credits
- Ensure the model is available

#### 4. Port Conflicts
```bash
# Check if ports are in use
netstat -tulpn | grep :5000
netstat -tulpn | grep :3000
netstat -tulpn | grep :8000
```

### Logs and Debugging
```bash
# View server logs
npm run server

# View client logs
cd client && npm start

# Check database logs
tail -f /var/log/mysql/error.log
```

## 📊 Verification Checklist

- [ ] Node.js installed (v16+)
- [ ] MySQL running and accessible
- [ ] ChromaDB running on port 8000
- [ ] OpenAI API key configured
- [ ] Environment variables set
- [ ] Dependencies installed
- [ ] Database tables created
- [ ] Sample data inserted
- [ ] Frontend accessible at localhost:3000
- [ ] Backend API accessible at localhost:5000
- [ ] Chat interface working
- [ ] Multilingual support working
- [ ] Product search working

## 🚀 Production Deployment

### Environment Setup
```env
NODE_ENV=production
PORT=5000
DB_HOST=your-production-db-host
CHROMA_HOST=your-production-chromadb-host
```

### Security Considerations
- Use strong passwords
- Enable SSL/TLS
- Configure firewall rules
- Set up monitoring
- Regular backups

### Performance Optimization
- Enable database connection pooling
- Configure caching
- Set up load balancing
- Monitor resource usage

## 📞 Support

If you encounter issues:
1. Check the logs for error messages
2. Verify all prerequisites are installed
3. Ensure all services are running
4. Check network connectivity
5. Review configuration files

For additional help, create an issue in the repository or contact the development team.

## 🎉 Success!

Once everything is set up, you should have:
- A fully functional AI chat system
- Multilingual support (English, Hindi, Tamil)
- Real-time chat with Socket.io
- Intelligent tractor recommendations
- Semantic search capabilities
- Beautiful, responsive UI

Happy coding! 🚀
