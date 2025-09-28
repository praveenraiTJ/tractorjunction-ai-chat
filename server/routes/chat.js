const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dbConnection = require('../config/database');
const openaiService = require('../services/openaiService');
const chromaService = require('../services/chromaService').chromaService;
const { getCache, setCache } = require('../services/cacheService');

const router = express.Router();

// Helper function to check database connectivity
const checkDatabaseConnection = async () => {
  try {
    await dbConnection.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
};

// Helper function to store session in ChromaDB
const storeSessionInChromaDB = async (sessionId, userId, language) => {
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
};

// Helper function to store message in ChromaDB
const storeMessageInChromaDB = async (sessionId, messageType, content, metadata = {}) => {
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
};

// Initialize chat session
router.post('/initialize', async (req, res) => {
  try {
    const { userId, language = 'en' } = req.body;
    const sessionId = uuidv4();

    // Store session in ChromaDB
    await storeSessionInChromaDB(sessionId, userId, language);

    // Store in cache (always available)
    setCache(`session_${sessionId}`, {
      userId,
      language,
      createdAt: new Date().toISOString()
    }, 1800); // 30 minutes

    res.json({
      success: true,
      sessionId,
      language,
      message: 'Session initialized successfully',
      storageType: 'chromadb'
    });
  } catch (error) {
    console.error('Session initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize session',
      message: error.message
    });
  }
});

// Send chat message
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message, language } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and message are required'
      });
    }

    // Get session data
    const sessionData = getCache(`session_${sessionId}`);
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Store user message in ChromaDB
    await storeMessageInChromaDB(sessionId, 'user', message);

    // Get recent context (using cache)
    const context = [];

    // Search for relevant tractors (with fallback)
    let tractorsData = [];
    try {
      tractorsData = await chromaService.searchSimilar(message, 5);
    } catch (error) {
      console.log('ChromaDB search failed, continuing without vector search');
    }

    // Generate AI response
    const response = await openaiService.generateResponse(
      message,
      context,
      tractorsData
    );

    // Store bot response in ChromaDB
    await storeMessageInChromaDB(sessionId, 'bot', response.text, {
      model: response.model,
      usage: response.usage,
      language: response.language
    });

    // Track analytics
    await trackAnalytics(sessionId, message, response);

    res.json({
      success: true,
      response: {
        text: response.text,
        language: response.language,
        timestamp: new Date().toISOString(),
        metadata: {
          model: response.model,
          usage: response.usage
        }
      },
      tractors: tractorsData.slice(0, 3), // Return top 3 relevant tractors
      storageType: 'chromadb'
    });
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      message: error.message
    });
  }
});

// Get chat history
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const messages = await dbConnection.query(
      `SELECT message_type, content, metadata, created_at 
       FROM chat_messages 
       WHERE session_id = ? 
       ORDER BY created_at ASC 
       LIMIT ? OFFSET ?`,
      [sessionId, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      messages: messages.map(msg => ({
        type: msg.message_type,
        content: msg.content,
        metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
        timestamp: msg.created_at
      }))
    });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chat history',
      message: error.message
    });
  }
});

// Search products
router.post('/search', async (req, res) => {
  try {
    const { query, filters = {}, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Search using ChromaDB
    const results = await chromaService.searchSimilar(query, limit, filters);

    res.json({
      success: true,
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

// Get session analytics
router.get('/analytics/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const analytics = await dbConnection.query(
      `SELECT intent, response_type, COUNT(*) as count, 
              AVG(response_time_ms) as avg_response_time
       FROM chat_analytics 
       WHERE session_id = ? 
       GROUP BY intent, response_type`,
      [sessionId]
    );

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics',
      message: error.message
    });
  }
});

// Update session language
router.put('/language', async (req, res) => {
  try {
    const { sessionId, language } = req.body;

    if (!sessionId || !language) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and language are required'
      });
    }

    // Update in database
    await dbConnection.query(
      'UPDATE chat_sessions SET language = ?, updated_at = NOW() WHERE session_id = ?',
      [language, sessionId]
    );

    // Update in cache
    const sessionData = getCache(`session_${sessionId}`);
    if (sessionData) {
      sessionData.language = language;
      setCache(`session_${sessionId}`, sessionData, 1800);
    }

    res.json({
      success: true,
      message: 'Language updated successfully',
      language
    });
  } catch (error) {
    console.error('Language update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update language',
      message: error.message
    });
  }
});

// Helper functions
async function getSessionContext(sessionId) {
  try {
    const messages = await dbConnection.query(
      'SELECT message_type, content FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 5',
      [sessionId]
    );

    return messages.reverse().map(msg => ({
      role: msg.message_type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  } catch (error) {
    console.error('Context retrieval error:', error);
    return [];
  }
}

async function trackAnalytics(sessionId, query, response) {
  try {
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

module.exports = router;
