const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dbConnection = require('../config/database');
const { getCache, setCache, clearSessionData } = require('../services/cacheService');

const router = express.Router();

// Admin endpoints require the ADMIN_TOKEN header; disabled entirely when no token is configured
router.use('/admin', (req, res, next) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.get('x-admin-token') !== token) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
});

// Create new session
router.post('/', async (req, res) => {
  try {
    const { userId, language = 'en', metadata = {} } = req.body;
    const sessionId = uuidv4();

    // Create session in database
    await dbConnection.query(
      'INSERT INTO chat_sessions (session_id, user_id, language) VALUES (?, ?, ?)',
      [sessionId, userId, language]
    );

    // Store in cache
    setCache(`session_${sessionId}`, {
      userId,
      language,
      metadata,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    }, 1800); // 30 minutes

    res.json({
      success: true,
      session: {
        sessionId,
        userId,
        language,
        metadata,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session',
      message: error.message
    });
  }
});

// Get session details
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check cache first
    const cachedSession = getCache(`session_${sessionId}`);
    if (cachedSession) {
      return res.json({
        success: true,
        session: {
          sessionId,
          ...cachedSession
        },
        cached: true
      });
    }

    // Get from database
    const [session] = await dbConnection.query(
      'SELECT * FROM chat_sessions WHERE session_id = ?',
      [sessionId]
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Cache the session
    setCache(`session_${sessionId}`, {
      userId: session.user_id,
      language: session.language,
      createdAt: session.created_at,
      lastActivity: session.updated_at
    }, 1800);

    res.json({
      success: true,
      session: {
        sessionId: session.session_id,
        userId: session.user_id,
        language: session.language,
        createdAt: session.created_at,
        updatedAt: session.updated_at
      }
    });
  } catch (error) {
    console.error('Session retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session',
      message: error.message
    });
  }
});

// Update session
router.put('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { language, metadata } = req.body;

    // Update in database
    const updateFields = [];
    const updateValues = [];

    if (language) {
      updateFields.push('language = ?');
      updateValues.push(language);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(sessionId);

    await dbConnection.query(
      `UPDATE chat_sessions SET ${updateFields.join(', ')} WHERE session_id = ?`,
      updateValues
    );

    // Update cache
    const cachedSession = getCache(`session_${sessionId}`);
    if (cachedSession) {
      if (language) cachedSession.language = language;
      if (metadata) cachedSession.metadata = { ...cachedSession.metadata, ...metadata };
      cachedSession.lastActivity = new Date().toISOString();
      
      setCache(`session_${sessionId}`, cachedSession, 1800);
    }

    res.json({
      success: true,
      message: 'Session updated successfully'
    });
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session',
      message: error.message
    });
  }
});

// Delete session
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Delete from database (cascade will delete messages)
    await dbConnection.query(
      'DELETE FROM chat_sessions WHERE session_id = ?',
      [sessionId]
    );

    // Clear from cache
    clearSessionData(sessionId);

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Session deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session',
      message: error.message
    });
  }
});

// List a user's chat sessions (widget history panel), newest first, titled by the first question
router.get('/user/:userId', async (req, res) => {
  try {
    const sessions = await dbConnection.query(
      `SELECT cs.session_id, cs.updated_at,
        (SELECT content FROM chat_messages m WHERE m.session_id = cs.session_id AND m.message_type = 'user'
         ORDER BY m.id ASC LIMIT 1) AS title,
        (SELECT MAX(created_at) FROM chat_messages m WHERE m.session_id = cs.session_id) AS last_message_at
      FROM chat_sessions cs
      WHERE cs.user_id = ?
      HAVING title IS NOT NULL
      ORDER BY last_message_at DESC
      LIMIT 30`,
      [req.params.userId]
    );
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('User sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve sessions' });
  }
});

// Get session messages
router.get('/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, offset = 0, messageType } = req.query;

    let query = `
      SELECT message_type, content, metadata, created_at 
      FROM chat_messages 
      WHERE session_id = ?
    `;
    const params = [sessionId];

    if (messageType) {
      query += ' AND message_type = ?';
      params.push(messageType);
    }

    // LIMIT placeholders fail with mysql2 prepared statements on MySQL 8, so inline validated integers
    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);
    query += ` ORDER BY created_at ASC, id ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`;

    const messages = await dbConnection.query(query, params);

    res.json({
      success: true,
      messages: messages.map(msg => ({
        type: msg.message_type,
        content: msg.content,
        // mysql2 already parses JSON columns
        metadata: typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata,
        timestamp: msg.created_at
      })),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: messages.length
      }
    });
  } catch (error) {
    console.error('Session messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session messages',
      message: error.message
    });
  }
});

// Get session analytics
router.get('/:sessionId/analytics', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { days = 30 } = req.query;

    const analytics = await dbConnection.query(
      `SELECT 
        intent,
        response_type,
        COUNT(*) as count,
        AVG(response_time_ms) as avg_response_time,
        DATE(created_at) as date
      FROM chat_analytics 
      WHERE session_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY intent, response_type, DATE(created_at)
      ORDER BY date DESC`,
      [sessionId, parseInt(days)]
    );

    // Get summary stats
    const summary = await dbConnection.query(
      `SELECT 
        COUNT(*) as total_queries,
        COUNT(DISTINCT intent) as unique_intents,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN user_satisfaction = 'positive' THEN 1 END) as positive_feedback,
        COUNT(CASE WHEN user_satisfaction = 'negative' THEN 1 END) as negative_feedback
      FROM chat_analytics 
      WHERE session_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [sessionId, parseInt(days)]
    );

    res.json({
      success: true,
      analytics,
      summary: summary[0] || {
        total_queries: 0,
        unique_intents: 0,
        avg_response_time: 0,
        positive_feedback: 0,
        negative_feedback: 0
      },
      period: `${days} days`
    });
  } catch (error) {
    console.error('Session analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session analytics',
      message: error.message
    });
  }
});

// Get active sessions
router.get('/admin/active', async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const sessions = await dbConnection.query(
      `SELECT 
        session_id,
        user_id,
        language,
        created_at,
        updated_at,
        TIMESTAMPDIFF(MINUTE, updated_at, NOW()) as minutes_since_activity
      FROM chat_sessions 
      WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      ORDER BY updated_at DESC
      LIMIT ${Math.min(Math.max(parseInt(limit) || 100, 1), 500)}`
    );

    res.json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Active sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active sessions',
      message: error.message
    });
  }
});

// Get session statistics
router.get('/admin/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const stats = await dbConnection.query(
      `SELECT 
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(*) as total_messages,
        COUNT(CASE WHEN message_type = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN message_type = 'bot' THEN 1 END) as bot_messages,
        AVG(CASE WHEN message_type = 'bot' THEN JSON_EXTRACT(metadata, '$.usage.total_tokens') END) as avg_tokens_per_response
      FROM chat_sessions cs
      LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
      WHERE cs.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [parseInt(days)]
    );

    const languageStats = await dbConnection.query(
      `SELECT 
        language,
        COUNT(*) as session_count
      FROM chat_sessions 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY language
      ORDER BY session_count DESC`,
      [parseInt(days)]
    );

    res.json({
      success: true,
      stats: stats[0] || {
        total_sessions: 0,
        total_messages: 0,
        user_messages: 0,
        bot_messages: 0,
        avg_tokens_per_response: 0
      },
      languageStats,
      period: `${days} days`
    });
  } catch (error) {
    console.error('Session stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session statistics',
      message: error.message
    });
  }
});

module.exports = router;
