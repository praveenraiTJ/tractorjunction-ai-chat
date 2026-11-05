import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Button,
  Chip,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Chat as ChatIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import { useLanguage } from '../contexts/LanguageContext';

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
  isActive: boolean;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentSessionId: string | null;
  onSessionChange: (sessionId: string) => void;
  onNewSession: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isOpen,
  onToggle,
  currentSessionId,
  onSessionChange,
  onNewSession,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const { socket } = useSocket();
  const { t } = useLanguage();

  // Load sessions from localStorage on component mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('chatSessions');
    if (savedSessions) {
      try {
        const parsedSessions = JSON.parse(savedSessions).map((session: any) => ({
          ...session,
          timestamp: new Date(session.timestamp),
        }));
        setSessions(parsedSessions);
      } catch (error) {
        console.error('Error loading sessions from localStorage:', error);
      }
    }
  }, []);

  // Save sessions to localStorage whenever sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('chatSessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  // Add new session
  const addSession = (sessionId: string, title: string = 'New Chat') => {
    const newSession: ChatSession = {
      id: sessionId,
      title,
      lastMessage: '',
      timestamp: new Date(),
      messageCount: 0,
      isActive: true,
    };

    setSessions(prevSessions => {
      // Mark all other sessions as inactive
      const updatedSessions = prevSessions.map(session => ({
        ...session,
        isActive: false,
      }));

      return [newSession, ...updatedSessions];
    });
  };

  // Update session with new message
  const updateSession = (sessionId: string, message: string, isUser: boolean = false) => {
    setSessions(prevSessions => {
      return prevSessions.map(session => {
        if (session.id === sessionId) {
          const updatedSession = {
            ...session,
            lastMessage: message,
            timestamp: new Date(),
            messageCount: session.messageCount + 1,
            isActive: true,
          };

          // Update title if it's the first user message
          if (isUser && session.title === 'New Chat') {
            updatedSession.title = message.length > 30
              ? message.substring(0, 30) + '...'
              : message;
          }

          return updatedSession;
        }
        return { ...session, isActive: false };
      });
    });
  };

  // Delete session
  const deleteSession = (sessionId: string) => {
    setSessions(prevSessions => {
      const updatedSessions = prevSessions.filter(session => session.id !== sessionId);
      if (updatedSessions.length > 0) {
        updatedSessions[0].isActive = true;
      }
      return updatedSessions;
    });
  };

  // Format timestamp
  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  // Get session title for display
  const getSessionTitle = (session: ChatSession) => {
    return session.title || `Chat ${session.id.slice(-6)}`;
  };

  return (
    <>
      {/* Toggle Button - Hidden since sidebar is always open */}
      {false && (
        <IconButton
          onClick={onToggle}
          sx={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 1300,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 1)',
            },
          }}
        >
          <MenuIcon />
        </IconButton>
      )}

      {/* Sidebar Drawer */}
      <Drawer
        anchor="left"
        open={isOpen}
        variant="persistent"
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
            backgroundColor: '#ffffff',
            color: '#212121',
            borderRight: '1px solid #e0e0e0',
            position: 'fixed',
            top: '64px', // Account for fixed header
            left: 0,
            height: 'calc(100vh - 64px)', // Account for fixed header
            zIndex: 1200,
            overflow: 'hidden',
            boxShadow: '0 0 20px rgba(0, 0, 0, 0.08)',
          },
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#212121' }}>
                Chat History
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onNewSession}
              sx={{
                mt: 2,
                width: '100%',
                backgroundColor: '#1976d2',
                borderRadius: 2,
                py: 1.5,
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: '#1565c0',
                },
              }}
            >
              New Chat
            </Button>
          </Box>

          {/* Sessions List */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {sessions.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <HistoryIcon sx={{ fontSize: 48, color: '#9e9e9e', mb: 2 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  No chat history yet
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Start a new conversation to see it here
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {sessions.map((session, index) => (
                  <React.Fragment key={session.id}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={() => onSessionChange(session.id)}
                        selected={session.id === currentSessionId}
                        sx={{
                          '&.Mui-selected': {
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2',
                            '&:hover': {
                              backgroundColor: '#bbdefb',
                            },
                          },
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <ChatIcon sx={{ color: session.isActive ? '#1976d2' : '#9e9e9e' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: session.isActive ? 600 : 400,
                                  color: session.isActive ? '#ffffff' : '#ccc',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {getSessionTitle(session)}
                              </Typography>
                              {session.messageCount > 0 && (
                                <Chip
                                  label={session.messageCount}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.75rem',
                                    backgroundColor: '#2e7d32',
                                    color: '#ffffff',
                                  }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#999',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  display: 'block',
                                }}
                              >
                                {session.lastMessage || 'No messages yet'}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: '#9e9e9e', fontSize: '0.7rem' }}
                              >
                                {formatTimestamp(session.timestamp)}
                              </Typography>
                            </Box>
                          }
                        />
                        <Tooltip title="Delete chat">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                            }}
                            sx={{ color: '#9e9e9e', '&:hover': { color: '#f44336' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemButton>
                    </ListItem>
                    {index < sessions.length - 1 && <Divider sx={{ backgroundColor: '#e0e0e0' }} />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>

          {/* Footer */}
          <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
              <Box
                component="img"
                src="https://static-asset.tractorjunction.com/tj/TJ_LOGO_en.svg"
                alt="Tractor Junction"
                sx={{
                  height: 20,
                  width: 'auto',
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
              Tractor Junction AI Assistant
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
              {sessions.length} conversation{sessions.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

export default ChatSidebar;
