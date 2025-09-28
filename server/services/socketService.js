const { v4: uuidv4 } = require('uuid');
const dbConnection = require('../config/database');
const openaiService = require('./openaiService');
const chromaService = require('./chromaService').chromaService;
const { getSessionData, setSessionData, clearSessionData } = require('./cacheService');
const intentAnalysisService = require('./intentAnalysisService');

class SocketService {
  constructor() {
    this.activeSessions = new Map();
    this.typingUsers = new Map();
  }

  // Helper function to check database connectivity
  async checkDatabaseConnection() {
    try {
      await dbConnection.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Helper function to store session in ChromaDB
  async storeSessionInChromaDB(sessionId, userId, language) {
    try {
      if (!chromaService.client) {
        console.log('⚠️ ChromaDB not available, skipping session storage');
        return;
      }

      const sessionData = {
        sessionId,
        userId: userId || 'anonymous',
        language,
        createdAt: new Date().toISOString(),
        type: 'session'
      };

      // Store session in ChromaDB
      await chromaService.client.getOrCreateCollection({
        name: 'chat_sessions'
      });

      await chromaService.client.add({
        collection: 'chat_sessions',
        documents: [JSON.stringify(sessionData)],
        ids: [sessionId],
        metadatas: [{
          type: 'session',
          userId: userId || 'anonymous',
          language,
          createdAt: new Date().toISOString()
        }]
      });

      console.log(`✅ Session stored in ChromaDB: ${sessionId}`);
    } catch (error) {
      console.error('ChromaDB session storage error:', error);
    }
  }

  // Helper function to store message in ChromaDB
  async storeMessageInChromaDB(sessionId, messageType, content, metadata = {}) {
    try {
      if (!chromaService.client) {
        console.log('⚠️ ChromaDB not available, skipping message storage');
        return;
      }

      const messageData = {
        sessionId,
        messageType,
        content,
        metadata,
        timestamp: new Date().toISOString(),
        type: 'message'
      };

      // Store message in ChromaDB
      await chromaService.client.getOrCreateCollection({
        name: 'chat_messages'
      });

      const messageId = `${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await chromaService.client.add({
        collection: 'chat_messages',
        documents: [JSON.stringify(messageData)],
        ids: [messageId],
        metadatas: [{
          type: 'message',
          sessionId,
          messageType,
          timestamp: new Date().toISOString()
        }]
      });

      console.log(`✅ Message stored in ChromaDB: ${messageId}`);
    } catch (error) {
      console.error('ChromaDB message storage error:', error);
    }
  }

  // Helper function to update session in ChromaDB
  async updateSessionInChromaDB(sessionId, updateData) {
    try {
      if (!chromaService.client) {
        console.log('⚠️ ChromaDB not available, skipping session update');
        return;
      }

      // Update session metadata in ChromaDB
      await chromaService.client.update({
        collection: 'chat_sessions',
        id: sessionId,
        metadatas: [{
          ...updateData,
          updatedAt: new Date().toISOString()
        }]
      });

      console.log(`✅ Session updated in ChromaDB: ${sessionId}`);
    } catch (error) {
      console.error('ChromaDB session update error:', error);
    }
  }

  setupHandlers(io) {
    io.on('connection', (socket) => {
      console.log(`🔌 User connected: ${socket.id}`);

      // Handle session initialization
      socket.on('initialize_session', async (data) => {
        try {
          const sessionId = data.sessionId || uuidv4();
          const userId = data.userId || null;
          const language = data.language || 'en';

          // Store session data
          this.activeSessions.set(socket.id, {
            sessionId,
            userId,
            language,
            connectedAt: new Date(),
            lastActivity: new Date()
          });

          // Store session in ChromaDB instead of remote database
          await this.storeSessionInChromaDB(sessionId, userId, language);

          // Store in cache (always available)
          setSessionData(sessionId, 'socketId', socket.id);
          setSessionData(sessionId, 'language', language);
          setSessionData(sessionId, 'userId', userId);

          socket.emit('session_initialized', {
            sessionId,
            language,
            status: 'success',
            storageType: 'chromadb'
          });

          console.log(`✅ Session initialized: ${sessionId}`);
        } catch (error) {
          console.error('Session initialization error:', error);
          socket.emit('session_error', {
            error: 'Failed to initialize session',
            message: error.message
          });
        }
      });

      // Handle chat messages
      socket.on('chat_message', async (data) => {
        try {
          const session = this.activeSessions.get(socket.id);
          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }

          const { message, messageId } = data;
          const sessionId = session.sessionId;

          // Update last activity
          session.lastActivity = new Date();

          // Store user message in ChromaDB
          await this.storeMessageInChromaDB(sessionId, 'user', message, { messageId });

          // Emit typing indicator
          socket.emit('bot_typing', { isTyping: true });

          // Process message and generate response
          const response = await this.processMessage(message, session);

          // Store bot response in ChromaDB
          await this.storeMessageInChromaDB(sessionId, 'bot', response.text, {
            messageId: uuidv4(),
            model: response.model || 'gpt-4o-mini',
            usage: response.usage || null,
            language: response.language || 'en'
          });

          // Emit response
          socket.emit('bot_response', {
            messageId: uuidv4(),
            text: response.text,
            language: response.language,
            timestamp: new Date().toISOString(),
            metadata: {
              model: response.model,
              usage: response.usage
            },
            tractors: response.tractors || [],
            hasTractors: response.hasTractors || false,
            searchIntent: response.searchIntent || 'general'
          });

          // Stop typing indicator
          socket.emit('bot_typing', { isTyping: false });

        } catch (error) {
          console.error('Chat message error:', error);
          socket.emit('bot_typing', { isTyping: false });
          socket.emit('error', {
            message: 'Failed to process message',
            error: error.message
          });
        }
      });

      // Handle typing indicators
      socket.on('user_typing', (data) => {
        const session = this.activeSessions.get(socket.id);
        if (session) {
          this.typingUsers.set(socket.id, {
            sessionId: session.sessionId,
            isTyping: data.isTyping,
            timestamp: new Date()
          });

          // Broadcast to other users in the same session (if needed)
          socket.broadcast.emit('user_typing', {
            sessionId: session.sessionId,
            isTyping: data.isTyping
          });
        }
      });

      // Handle language change
      socket.on('change_language', async (data) => {
        try {
          const session = this.activeSessions.get(socket.id);
          if (session) {
            session.language = data.language;
            setSessionData(session.sessionId, 'language', data.language);

            // Update session in database
            await dbConnection.query(
              'UPDATE chat_sessions SET language = ? WHERE session_id = ?',
              [data.language, session.sessionId]
            );

            socket.emit('language_changed', {
              language: data.language,
              status: 'success'
            });
          }
        } catch (error) {
          console.error('Language change error:', error);
          socket.emit('error', {
            message: 'Failed to change language',
            error: error.message
          });
        }
      });

      // Handle product search
      socket.on('search_products', async (data) => {
        try {
          const session = this.activeSessions.get(socket.id);
          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }

          const { query, filters = {} } = data;
          
          // Search using ChromaDB
          const results = await chromaService.searchSimilar(query, 10, filters);

          socket.emit('search_results', {
            query,
            results,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          console.error('Product search error:', error);
          socket.emit('error', {
            message: 'Search failed',
            error: error.message
          });
        }
      });

      // Handle session analytics
      socket.on('track_interaction', async (data) => {
        try {
          const session = this.activeSessions.get(socket.id);
          if (session) {
            await this.trackInteraction(session.sessionId, data);
          }
        } catch (error) {
          console.error('Analytics tracking error:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        try {
          const session = this.activeSessions.get(socket.id);
          if (session) {
            console.log(`🔌 User disconnected: ${socket.id}, Session: ${session.sessionId}`);
            
            // Clean up session data
            this.activeSessions.delete(socket.id);
            this.typingUsers.delete(socket.id);
            
            // Update session end time in ChromaDB
            await this.updateSessionInChromaDB(session.sessionId, {
              disconnectedAt: new Date().toISOString(),
              status: 'disconnected'
            });
          }
        } catch (error) {
          console.error('Disconnect cleanup error:', error);
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    });

    // Periodic cleanup of inactive sessions
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 300000); // 5 minutes

    console.log('✅ Socket.IO handlers setup complete');
  }

  async createOrUpdateSession(sessionId, userId, language) {
    try {
      // Check database connection first
      const dbConnected = await this.checkDatabaseConnection();
      
      if (!dbConnected) {
        console.log('⚠️ Database not available, skipping session creation/update');
        return;
      }

      // Check if session exists
      const existingSession = await dbConnection.query(
        'SELECT * FROM chat_sessions WHERE session_id = ?',
        [sessionId]
      );

      if (existingSession.length > 0) {
        // Update existing session
        await dbConnection.query(
          'UPDATE chat_sessions SET user_id = ?, language = ?, updated_at = NOW() WHERE session_id = ?',
          [userId, language, sessionId]
        );
      } else {
        // Create new session
        await dbConnection.query(
          'INSERT INTO chat_sessions (session_id, user_id, language) VALUES (?, ?, ?)',
          [sessionId, userId, language]
        );
      }
    } catch (error) {
      console.error('Session creation/update error:', error);
      throw error;
    }
  }

  async storeMessage(sessionId, messageType, content, metadata = {}) {
    try {
      // Check database connection first
      const dbConnected = await this.checkDatabaseConnection();
      
      if (!dbConnected) {
        console.log('⚠️ Database not available, skipping message storage');
        return;
      }

      await dbConnection.query(
        'INSERT INTO chat_messages (session_id, message_type, content, metadata) VALUES (?, ?, ?, ?)',
        [sessionId, messageType, content, JSON.stringify(metadata)]
      );
    } catch (error) {
      console.error('Message storage error:', error);
      throw error;
    }
  }

  async processMessage(message, session) {
    try {
      // Get session context
      const context = await this.getSessionContext(session.sessionId);
      
      // Analyze user intent
      console.log('🔍 Analyzing user intent...');
      const intentData = await intentAnalysisService.analyzeIntent(message);
      console.log('📊 Intent analysis result:', intentData);
      
      let tractorsData = [];
      let enhancedPrompt = null;
      
      // If tractor-related query, search database
      if (intentData.isTractorRelated && intentData.confidence > 0.3) {
        console.log('🚜 Tractor-related query detected, searching database...');
        
        // Generate SQL query based on intent
        const sqlQuery = intentAnalysisService.generateSQLQuery(intentData);
        
        if (sqlQuery) {
          try {
            console.log('🔍 SQL Query Generated:');
            console.log('   SQL:', sqlQuery.sql);
            console.log('   Params:', sqlQuery.params);
            
            // Execute database search
            tractorsData = await dbConnection.query(sqlQuery.sql, sqlQuery.params);
            console.log(`✅ Found ${tractorsData.length} tractors in database`);
            
            // Log sample data if found
            if (tractorsData.length > 0) {
              console.log('📊 Sample tractor data:');
              tractorsData.slice(0, 2).forEach((tractor, index) => {
                console.log(`   ${index + 1}. ${tractor.brand_name} ${tractor.model_name} - ₹${tractor.price}`);
              });
            }
            
            // Create enhanced prompt with tractor data
            if (tractorsData.length > 0) {
              enhancedPrompt = intentAnalysisService.createEnhancedPrompt(message, intentData, tractorsData);
              console.log('📝 Enhanced Prompt Created:');
              console.log('   Length:', enhancedPrompt.length, 'characters');
              console.log('   Preview:', enhancedPrompt.substring(0, 200) + '...');
            }
          } catch (dbError) {
            console.error('❌ Database search error:', dbError);
            // Fallback to ChromaDB search
            tractorsData = await chromaService.searchSimilar(message, 5);
          }
        }
      } else {
        // For non-tractor queries, use ChromaDB search
        tractorsData = await chromaService.searchSimilar(message, 5);
      }
      
      // Generate response using OpenAI
      const response = await openaiService.generateResponse(
        message,
        context,
        tractorsData,
        enhancedPrompt
      );

      // Track analytics
      await this.trackAnalytics(session.sessionId, message, response);

      return response;
    } catch (error) {
      console.error('Message processing error:', error);
      throw error;
    }
  }

  async getSessionContext(sessionId) {
    try {
      // Get recent messages for context
      const recentMessages = await dbConnection.query(
        'SELECT message_type, content FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 5',
        [sessionId]
      );

      return recentMessages.reverse().map(msg => ({
        role: msg.message_type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
    } catch (error) {
      console.error('Context retrieval error:', error);
      return [];
    }
  }

  async trackAnalytics(sessionId, query, response) {
    try {
      // Check database connection first
      const dbConnected = await this.checkDatabaseConnection();
      
      if (!dbConnected) {
        console.log('⚠️ Database not available, skipping analytics tracking');
        return;
      }

      const intent = await openaiService.extractIntent(query);
      
      await dbConnection.query(
        'INSERT INTO chat_analytics (session_id, query_text, intent, response_type, response_time_ms) VALUES (?, ?, ?, ?, ?)',
        [
          sessionId,
          query,
          intent,
          response.error ? 'error' : 'success',
          response.usage?.total_tokens || 0
        ]
      );
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  async trackInteraction(sessionId, data) {
    try {
      // Check database connection first
      const dbConnected = await this.checkDatabaseConnection();
      
      if (!dbConnected) {
        console.log('⚠️ Database not available, skipping interaction tracking');
        return;
      }

      await dbConnection.query(
        'INSERT INTO chat_analytics (session_id, query_text, intent, response_type, user_satisfaction) VALUES (?, ?, ?, ?, ?)',
        [
          sessionId,
          data.action || 'interaction',
          data.type || 'user_action',
          'interaction',
          data.satisfaction || null
        ]
      );
    } catch (error) {
      console.error('Interaction tracking error:', error);
    }
  }

  cleanupInactiveSessions() {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [socketId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > inactiveThreshold) {
        console.log(`🧹 Cleaning up inactive session: ${session.sessionId}`);
        this.activeSessions.delete(socketId);
        this.typingUsers.delete(socketId);
      }
    }
  }

  getActiveSessionsCount() {
    return this.activeSessions.size;
  }

  getSessionStats() {
    return {
      activeSessions: this.activeSessions.size,
      typingUsers: this.typingUsers.size,
      uptime: process.uptime()
    };
  }
}

const socketService = new SocketService();

function setupSocketHandlers(io) {
  socketService.setupHandlers(io);
}

module.exports = {
  socketService,
  setupSocketHandlers
};
