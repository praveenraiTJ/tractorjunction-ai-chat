# ChromaDB Setup Guide for Tractor Junction AI Chat

## Overview
This guide provides multiple solutions for setting up ChromaDB with the Tractor Junction AI Chat application, including fallback mechanisms when ChromaDB is unavailable.

## Current Status
✅ **ChromaDB Service**: Enhanced with robust fallback mechanism  
✅ **Database Fallback**: Configured to work without ChromaDB  
✅ **Error Handling**: Improved connection timeout and error handling  
✅ **Setup Scripts**: Created automated setup scripts  

## Solutions

### Solution 1: Docker Setup (Recommended)
```bash
# Start Docker Desktop first, then run:
docker run -d --name tractor-chromadb -p 8000:8000 chromadb/chroma:latest

# Verify ChromaDB is running:
curl http://localhost:8000/api/v1/heartbeat
```

### Solution 2: Python Setup
```bash
# Install ChromaDB (if not already installed):
pip install chromadb

# Start ChromaDB server:
python -c "import chromadb; chromadb.HttpClient()"
```

### Solution 3: Disable ChromaDB (Fallback Mode)
```bash
# Set environment variable to disable ChromaDB:
echo DISABLE_CHROMADB=true >> .env

# Or modify .env file:
DISABLE_CHROMADB=true
```

## Testing ChromaDB Integration

### 1. Test ChromaDB Connection
```bash
# Run the setup script:
node setup-chromadb.js

# Test ChromaDB directly:
curl http://localhost:8000/api/v1/heartbeat
```

### 2. Test Application with ChromaDB
```bash
# Start the application:
npm run dev

# Check server logs for ChromaDB status:
# Look for: "✅ ChromaDB service initialized" or "⚠️ ChromaDB not available"
```

### 3. Test Fallback Mechanism
```bash
# With ChromaDB disabled, test that the application still works:
# 1. Set DISABLE_CHROMADB=true in .env
# 2. Start the application
# 3. Test API endpoints - they should work with database fallback
```

## API Endpoints for Testing

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Products (with ChromaDB fallback)
```bash
curl http://localhost:5000/api/products
```

### Chat (with semantic search)
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me Mahindra tractors", "sessionId": "test123"}'
```

## Troubleshooting

### ChromaDB Connection Issues
1. **Docker not running**: Start Docker Desktop
2. **Port 8000 in use**: Check with `netstat -ano | findstr :8000`
3. **Python module issues**: Reinstall with `pip install --upgrade chromadb`

### Database Connection Issues
1. **Connection timeout**: Check database credentials in .env
2. **Network issues**: Verify database server is accessible
3. **MySQL warnings**: These are non-critical and can be ignored

### Application Issues
1. **Port 5000 in use**: Kill existing processes with `taskkill /PID <process_id> /F`
2. **ChromaDB errors**: Application will automatically fall back to database search
3. **Startup failures**: Check logs for specific error messages

## Configuration Options

### Environment Variables
```env
# ChromaDB Configuration
CHROMA_HOST=localhost
CHROMA_PORT=8000
DISABLE_CHROMADB=false  # Set to true to disable ChromaDB

# Database Configuration (for fallback)
DB_HOST=your_database_host
DB_PORT=3306
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
```

### ChromaDB Service Features
- ✅ **Automatic Fallback**: Falls back to database search when ChromaDB is unavailable
- ✅ **Connection Timeout**: 5-second timeout to prevent hanging
- ✅ **Error Handling**: Graceful error handling with detailed logging
- ✅ **Collection Management**: Automatic collection creation and population
- ✅ **Search Optimization**: Enhanced search with similarity scoring

## Performance Notes

### With ChromaDB
- **Semantic Search**: More accurate results using vector similarity
- **Faster Queries**: Optimized for complex search queries
- **Better Relevance**: Results ranked by semantic similarity

### Without ChromaDB (Fallback)
- **Database Search**: Uses MySQL LIKE queries
- **Good Performance**: Still provides relevant results
- **Reliable**: Always works when database is available

## Next Steps

1. **Choose your setup method** (Docker recommended)
2. **Test the integration** using the provided scripts
3. **Monitor logs** for any issues
4. **Configure as needed** using environment variables

## Support

If you encounter issues:
1. Check the application logs for specific error messages
2. Verify all services are running (database, ChromaDB, application)
3. Test individual components using the provided test scripts
4. Use the fallback mode if ChromaDB setup is problematic

The application is designed to work reliably with or without ChromaDB!
