import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Fade,
} from '@mui/material';
import {
  Send as SendIcon,
  Language as LanguageIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import { useLanguage } from '../contexts/LanguageContext';
import MessageList from './MessageList';
import LanguageSelector from './LanguageSelector';
import TypingIndicator from './TypingIndicator';
import ChatSidebar from './ChatSidebar';
import { Message } from '../types';

interface ChatInterfaceProps {}

const ChatInterface: React.FC<ChatInterfaceProps> = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [chatSessions, setChatSessions] = useState<Map<string, Message[]>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { socket, isConnected } = useSocket();
  const { language, setLanguage } = useLanguage();

  // Initialize session
  useEffect(() => {
    if (socket && !sessionId) {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      
      socket.emit('initialize_session', {
        sessionId: newSessionId,
        language: language,
      });
    }
  }, [socket, sessionId, language]);

  // Load session messages when session changes
  useEffect(() => {
    if (sessionId && chatSessions.has(sessionId)) {
      const sessionMessages = chatSessions.get(sessionId);
      if (sessionMessages && Array.isArray(sessionMessages)) {
        // Filter out any malformed messages
        const validMessages = sessionMessages.filter(msg => 
          msg && 
          typeof msg === 'object' && 
          msg.id && 
          msg.type && 
          msg.content !== undefined && 
          msg.timestamp
        );
        setMessages(validMessages);
      } else {
        setMessages([]);
      }
    } else if (sessionId) {
      setMessages([]);
    }
  }, [sessionId, chatSessions]);

  // Save messages to session
  const saveMessagesToSession = (sessionId: string, messages: Message[]) => {
    setChatSessions(prev => {
      const newSessions = new Map(prev);
      newSessions.set(sessionId, messages);
      return newSessions;
    });
  };

  // Handle new session
  const handleNewSession = () => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    setMessages([]);
    setError(null);
    
    if (socket) {
      socket.emit('initialize_session', {
        sessionId: newSessionId,
        language: language,
      });
    }
  };

  // Handle session change
  const handleSessionChange = (newSessionId: string) => {
    setSessionId(newSessionId);
    setError(null);
    
    if (socket) {
      socket.emit('initialize_session', {
        sessionId: newSessionId,
        language: language,
      });
    }
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleSessionInitialized = (data: any) => {
      console.log('Session initialized:', data);
      setError(null);
    };

    const handleBotResponse = (data: any) => {
      const newMessage: Message = {
        id: data.messageId || `bot-${Date.now()}`,
        type: 'bot',
        content: data.text || 'No response received',
        timestamp: data.timestamp || new Date().toISOString(),
        metadata: data.metadata,
        tractors: data.tractors || [],
        hasTractors: data.hasTractors || false,
        searchIntent: data.searchIntent || 'general',
      };
      
      setMessages(prev => {
        const updatedMessages = [...prev, newMessage];
        if (sessionId) {
          saveMessagesToSession(sessionId, updatedMessages);
        }
        return updatedMessages;
      });
      setIsLoading(false);
      setIsTyping(false);
    };

    const handleBotTyping = (data: any) => {
      setIsTyping(data.isTyping);
    };

    const handleError = (data: any) => {
      setError(data.message || 'An error occurred');
      setIsLoading(false);
      setIsTyping(false);
    };

    const handleSearchResults = (data: any) => {
      // Update the last message with tractor results
      setMessages(prev => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage && lastMessage.type === 'bot') {
          lastMessage.tractors = data.results || [];
          lastMessage.hasTractors = (data.results && data.results.length > 0) || false;
        }
        return updated;
      });
    };

    socket.on('session_initialized', handleSessionInitialized);
    socket.on('bot_response', handleBotResponse);
    socket.on('bot_typing', handleBotTyping);
    socket.on('error', handleError);
    socket.on('search_results', handleSearchResults);

    return () => {
      socket.off('session_initialized', handleSessionInitialized);
      socket.off('bot_response', handleBotResponse);
      socket.off('bot_typing', handleBotTyping);
      socket.off('error', handleError);
      socket.off('search_results', handleSearchResults);
    };
  }, [socket]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = () => {
    if (!inputValue.trim() || !socket || !sessionId || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => {
      const updatedMessages = [...prev, userMessage];
      if (sessionId) {
        saveMessagesToSession(sessionId, updatedMessages);
      }
      return updatedMessages;
    });
    setInputValue('');
    setIsLoading(true);
    setError(null);

    // Send message via socket
    socket.emit('chat_message', {
      message: inputValue.trim(),
      messageId: userMessage.id,
    });

    // Also trigger tractor search
    socket.emit('search_tractors', {
      query: inputValue.trim(),
      filters: {},
    });
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    if (socket && sessionId) {
      socket.emit('change_language', { language: newLanguage });
    }
  };

  const handleRetry = () => {
    if (socket && sessionId) {
      socket.emit('initialize_session', {
        sessionId,
        language,
      });
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Chat Sidebar */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        currentSessionId={sessionId}
        onSessionChange={handleSessionChange}
        onNewSession={handleNewSession}
      />

      {/* Main Chat Area */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        marginLeft: isSidebarOpen ? '280px' : '0px',
        transition: 'margin-left 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: '0px', // Ensure no padding that could cause overlap
      }}>
        {/* Header with controls - Fixed */}
        <Box
          sx={{
            p: 3,
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <LanguageIcon color="primary" />
            <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600 }}>
              Chat Assistant
            </Typography>
            {isConnected && (
              <Chip
                label="Online"
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LanguageSelector
              value={language}
              onChange={handleLanguageChange}
            />
            <IconButton
              onClick={handleClearChat}
              size="small"
              title="Clear chat"
              sx={{ color: 'text.secondary' }}
            >
              <ClearIcon />
            </IconButton>
            <IconButton
              onClick={handleRetry}
              size="small"
              title="Retry connection"
              disabled={isConnected}
              sx={{ color: 'text.secondary' }}
            >
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Messages area - Scrollable */}
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
                borderRadius: '3px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#c1c1c1',
                borderRadius: '3px',
                '&:hover': {
                  background: '#a8a8a8',
                },
              },
            }}
          >
          {error && (
            <Fade in={!!error}>
              <Alert
                severity="error"
                onClose={() => setError(null)}
                sx={{ mb: 2 }}
              >
                {error}
              </Alert>
            </Fade>
          )}

          {messages.length === 0 && !isLoading && (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                p: 4,
              }}
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Welcome to Tractor Junction AI Chat
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Ask me anything about tractors! I can help you find the perfect tractor,
                compare models, check prices, and more.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                {[
                  'Show me Mahindra tractors',
                  'What is the price of John Deere 5050D?',
                  'Best tractor for farming',
                  'Compare tractors under 5 lakh',
                ].map((suggestion) => (
                  <Chip
                    key={suggestion}
                    label={suggestion}
                    onClick={() => setInputValue(suggestion)}
                    variant="outlined"
                    size="small"
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <MessageList messages={messages} />

          {isTyping && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </Box>

        {/* Input area - Fixed at bottom */}
        <Box
          sx={{
            p: 3,
            borderTop: '1px solid #e0e0e0',
            backgroundColor: '#ffffff',
            boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.1)',
            flexShrink: 0,
            position: 'sticky',
            bottom: 0,
            zIndex: 1000,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              ref={inputRef}
              fullWidth
              multiline
              maxRows={4}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about tractors..."
              disabled={!isConnected || isLoading}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                  backgroundColor: '#f8f9fa',
                  '&:hover': {
                    backgroundColor: '#ffffff',
                  },
                  '&.Mui-focused': {
                    backgroundColor: '#ffffff',
                  },
                },
                '& .MuiInputBase-input': {
                  fontSize: '0.95rem',
                },
              }}
            />
            <IconButton
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || !isConnected || isLoading}
              color="primary"
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                borderRadius: 2,
                width: 48,
                height: 48,
                '&:hover': {
                  bgcolor: 'primary.dark',
                  transform: 'scale(1.05)',
                },
                '&:disabled': {
                  bgcolor: 'grey.300',
                  color: 'grey.500',
                  transform: 'none',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              {isLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SendIcon />
              )}
            </IconButton>
          </Box>
        </Box>
      </Box>
      </Box>
    </Box>
  );
};

export default ChatInterface;
