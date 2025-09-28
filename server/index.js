const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import services
const dbConnection = require('./config/database');
const { socketService, setupSocketHandlers } = require('./services/socketService');
const { initializeCache } = require('./services/cacheService');
const { initializeChromaDB } = require('./services/chromaService');

// Import routes
const chatRoutes = require('./routes/chat');
const productRoutes = require('./routes/products');
const sessionRoutes = require('./routes/sessions');
const tractorRoutes = require('./routes/tractors');

const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://www.tractorjunction.com', 'https://tractorjunction.com']
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://www.tractorjunction.com', 'https://tractorjunction.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/chat', chatRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/tractors', tractorRoutes);

// Socket.IO connection handling
setupSocketHandlers(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body'
    });
  }
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🚀 Starting Tractor Junction AI Chat Server...');
    
    // Initialize cache service
    initializeCache();
    console.log('✅ Cache service initialized');
    
    // Initialize database connection (with fallback)
    try {
      await dbConnection.initialize();
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.log('⚠️ Database connection failed, continuing without database');
      console.log('   Database features will be limited until connection is restored');
      console.log('   Error:', error.message);
    }
    
    // Initialize ChromaDB service
    try {
      await initializeChromaDB();
      console.log('✅ ChromaDB service initialized');
    } catch (error) {
      console.log('⚠️ ChromaDB initialization failed, continuing without vector search');
      console.log('   To enable ChromaDB, start the ChromaDB server: docker run -p 8000:8000 chromadb/chroma');
    }
    
    // Start server
    server.listen(PORT, () => {
      console.log(`🎯 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('\n📋 Available endpoints:');
        console.log('   GET  /api/health - Health check');
        console.log('   POST /api/chat/initialize - Initialize chat session');
        console.log('   POST /api/chat/message - Send chat message');
        console.log('   GET  /api/chat/history/:sessionId - Get chat history');
        console.log('   POST /api/chat/search - Search products');
        console.log('   GET  /api/products - Get products');
        console.log('   GET  /api/sessions - Get sessions');
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await dbConnection.close();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  await dbConnection.close();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
