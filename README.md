# Tractor Junction AI Chat System

A comprehensive AI-powered chat system for Tractor Junction built with React, Node.js, OpenAI, MySQL, and ChromaDB. This system provides intelligent tractor recommendations, multilingual support (English, Hindi, Tamil), and real-time chat functionality.

## 🚀 Features

### Core Functionality
- **AI-Powered Chat**: OpenAI GPT integration for intelligent responses
- **Multilingual Support**: English, Hindi, and Tamil language support
- **Real-time Communication**: Socket.io for instant messaging
- **Semantic Search**: ChromaDB for vector-based tractor search
- **Smart Caching**: Redis-like caching to minimize OpenAI API calls
- **Session Management**: User session tracking and history

### Technical Features
- **Database Integration**: MySQL with optimized queries
- **Vector Search**: ChromaDB for semantic similarity search
- **Response Caching**: Intelligent caching to reduce API costs
- **Real-time Updates**: WebSocket connections for live chat
- **Product Cards**: Rich UI components for tractor display
- **Analytics**: Comprehensive tracking and analytics

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │   Node.js API   │    │   MySQL DB      │
│                 │◄──►│                 │◄──►│                 │
│  - Chat UI      │    │  - Express      │    │  - tractors_trans│
│  - Socket.io    │    │  - Socket.io    │    │  - chat_sessions │
│  - Material-UI   │    │  - OpenAI      │    │  - chat_messages │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   ChromaDB      │
                       │                 │
                       │  - Vector Store │
                       │  - Similarity   │
                       └─────────────────┘
```

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- ChromaDB (v0.4.0 or higher)
- OpenAI API Key

## 🛠️ Installation

### 1. Clone and Setup
```bash
git clone <repository-url>
cd tractor-junction-ai-chat
npm run install-all
```

### 2. Environment Configuration
```bash
cp env.example .env
```

Edit `.env` file with your configuration:
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

### 3. Database Setup
```sql
-- Create database
CREATE DATABASE tractor_junction;

-- The application will automatically create tables on first run
```

### 4. ChromaDB Setup
```bash
# Install ChromaDB
pip install chromadb

# Start ChromaDB server
chroma run --host localhost --port 8000
```

### 5. Start the Application
```bash
# Development mode (both frontend and backend)
npm run dev

# Or start individually
npm run server  # Backend only
npm run client  # Frontend only
```

## 📊 Database Schema

### tractors_trans Table
```sql
CREATE TABLE tractors_trans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tractor_id VARCHAR(50) UNIQUE NOT NULL,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(200) NOT NULL,
  price DECIMAL(12,2),
  engine_power VARCHAR(50),
  fuel_type VARCHAR(50),
  transmission VARCHAR(50),
  category VARCHAR(100),
  description TEXT,
  specifications JSON,
  features JSON,
  images JSON,
  status ENUM('active', 'inactive', 'sold') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### chat_sessions Table
```sql
CREATE TABLE chat_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  user_id VARCHAR(100),
  language VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### chat_messages Table
```sql
CREATE TABLE chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  message_type ENUM('user', 'bot') NOT NULL,
  content TEXT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 API Endpoints

### Chat Endpoints
- `POST /api/chat/initialize` - Initialize chat session
- `POST /api/chat/message` - Send chat message
- `GET /api/chat/history/:sessionId` - Get chat history
- `POST /api/chat/search` - Search products

### Product Endpoints
- `GET /api/products` - Get tractors with filters
- `GET /api/products/:tractorId` - Get tractor details
- `POST /api/products/search` - Semantic search
- `GET /api/products/meta/brands` - Get available brands
- `GET /api/products/meta/categories` - Get categories

### Session Endpoints
- `POST /api/sessions` - Create session
- `GET /api/sessions/:sessionId` - Get session details
- `PUT /api/sessions/:sessionId` - Update session
- `DELETE /api/sessions/:sessionId` - Delete session

## 🎯 Usage Examples

### Basic Chat
```javascript
// Initialize session
const response = await fetch('/api/chat/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ language: 'en' })
});

// Send message
const chatResponse = await fetch('/api/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'session_123',
    message: 'Show me Mahindra tractors under 5 lakh'
  })
});
```

### Socket.io Usage
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

// Initialize session
socket.emit('initialize_session', {
  sessionId: 'session_123',
  language: 'en'
});

// Send message
socket.emit('chat_message', {
  message: 'What is the best tractor for farming?',
  messageId: 'msg_123'
});

// Listen for responses
socket.on('bot_response', (data) => {
  console.log('Bot response:', data.text);
});
```

## 🌐 Multilingual Support

The system supports three languages:
- **English (en)**: Default language
- **Hindi (hi)**: हिन्दी support
- **Tamil (ta)**: தமிழ் support

Language detection is automatic based on user input, and responses are generated in the same language.

## 📈 Performance Optimization

### Caching Strategy
- **Memory Cache**: Node-cache for fast access
- **Database Cache**: Query result caching
- **OpenAI Cache**: Response caching to minimize API calls
- **Session Cache**: User session data caching

### Database Optimization
- Indexed columns for fast queries
- Connection pooling
- Query optimization
- Pagination support

## 🔍 Monitoring and Analytics

### Built-in Analytics
- Query tracking
- Response time monitoring
- User satisfaction tracking
- Language usage statistics
- Popular queries analysis

### Health Monitoring
- `GET /api/health` - System health check
- Connection status monitoring
- Error tracking and logging

## 🚀 Deployment

### Production Setup
1. Set `NODE_ENV=production`
2. Configure production database
3. Set up ChromaDB cluster
4. Configure reverse proxy (nginx)
5. Set up SSL certificates
6. Configure monitoring

### Docker Deployment
```dockerfile
# Dockerfile example
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔮 Future Enhancements

- [ ] WhatsApp integration
- [ ] Voice chat support
- [ ] Advanced analytics dashboard
- [ ] Machine learning model training
- [ ] Mobile app development
- [ ] API rate limiting
- [ ] Advanced caching strategies
- [ ] Real-time collaboration features
