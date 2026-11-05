const { v4: uuidv4 } = require('uuid');
const dbConnection = require('../config/database');
const chromaService = require('./chromaService').chromaService;
const { setSessionData } = require('./cacheService');
const { runChatTurn } = require('./agent/orchestrator');

const HISTORY_MESSAGES = 10;

// Old UI (TractorCard) shape, kept until the widget UI renders `blocks`
function legacyTractors(blocks) {
  const block = blocks.find(b => b.type === 'tractors');
  return (block?.data || []).map(t => ({
    id: t.id,
    model_name: t.model,
    brand_name: t.brand,
    price: t.price_lakh,
    hp: t.hp,
    images: t.image,
    url: t.url
  }));
}

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
            profile: data.profile || {},
            pageContext: data.pageContext || null,
            abortController: null,
            connectedAt: new Date(),
            lastActivity: new Date()
          });

          try {
            await this.createOrUpdateSession(sessionId, userId, language);
          } catch (error) {
            // Chat still works without persistence
          }

          // Store in cache (always available)
          setSessionData(sessionId, 'socketId', socket.id);
          setSessionData(sessionId, 'language', language);
          setSessionData(sessionId, 'userId', userId);

          socket.emit('session_initialized', {
            sessionId,
            language,
            status: 'success',
            storageType: 'mysql'
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

          const { message } = data;
          if (!message || !String(message).trim()) return;
          const sessionId = session.sessionId;
          const botMessageId = uuidv4();

          // Update last activity
          session.lastActivity = new Date();

          // A new question cancels any answer still streaming
          session.abortController?.abort();
          const abortController = new AbortController();
          session.abortController = abortController;

          socket.emit('bot_typing', { isTyping: true });

          const history = await this.getSessionContext(sessionId);
          this.storeMessage(sessionId, 'user', message, { messageId: data.messageId }).catch(() => {});

          const startedAt = Date.now();
          let response;
          try {
            response = await runChatTurn({
              message,
              history,
              profile: session.profile,
              pageContext: session.pageContext,
              signal: abortController.signal,
              onDelta: (delta) => socket.emit('bot_stream', { messageId: botMessageId, delta }),
              onBlock: (block) => socket.emit('bot_block', { messageId: botMessageId, block })
            });
          } catch (error) {
            if (abortController.signal.aborted) {
              socket.emit('bot_typing', { isTyping: false });
              socket.emit('bot_stopped', { messageId: botMessageId });
              return;
            }
            throw error;
          } finally {
            if (session.abortController === abortController) session.abortController = null;
          }

          this.storeMessage(sessionId, 'bot', response.text, {
            messageId: botMessageId,
            model: response.model,
            usage: response.usage,
            blocks: response.blocks,
            suggestions: response.suggestions,
            tools: response.toolsUsed
          }).catch(() => {});
          this.trackAnalytics(sessionId, message, response, Date.now() - startedAt);

          const tractors = legacyTractors(response.blocks);
          socket.emit('bot_response', {
            messageId: botMessageId,
            text: response.text,
            language: response.language,
            timestamp: new Date().toISOString(),
            metadata: {
              model: response.model,
              usage: response.usage
            },
            blocks: response.blocks,
            suggestions: response.suggestions,
            tractors,
            hasTractors: tractors.length > 0,
            searchIntent: response.toolsUsed.map(t => t.name).join(',') || 'general'
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

      // "Stop generating" button
      socket.on('stop_generation', () => {
        this.activeSessions.get(socket.id)?.abortController?.abort();
      });

      // Location / page context from the widget (browser geolocation, parent TJ page)
      socket.on('update_profile', (data = {}) => {
        const session = this.activeSessions.get(socket.id);
        if (!session) return;
        const { state, district, latitude, longitude, pageContext } = data;
        Object.assign(session.profile, Object.fromEntries(
          Object.entries({ state, district, latitude, longitude }).filter(([, v]) => v != null)
        ));
        if (pageContext !== undefined) session.pageContext = pageContext;
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
            session.abortController?.abort();
            this.activeSessions.delete(socket.id);
            this.typingUsers.delete(socket.id);
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

  async getSessionContext(sessionId) {
    try {
      // Recent turns for multi-turn memory (oldest first)
      const recentMessages = await dbConnection.query(
        `SELECT message_type, content FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC, id DESC LIMIT ${HISTORY_MESSAGES}`,
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

  async trackAnalytics(sessionId, query, response, responseTimeMs) {
    try {
      await dbConnection.query(
        'INSERT INTO chat_analytics (session_id, query_text, intent, response_type, response_time_ms) VALUES (?, ?, ?, ?, ?)',
        [
          sessionId,
          query,
          response.toolsUsed.map(t => t.name).join(',').slice(0, 100) || 'general',
          'success',
          responseTimeMs
        ]
      );
    } catch (error) {
      console.error('Analytics tracking error:', error.message);
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
