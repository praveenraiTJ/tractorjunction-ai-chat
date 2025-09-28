import React from 'react';
import { Box, Paper, Typography, Avatar, Chip, Grid } from '@mui/material';
import { Person as PersonIcon, SmartToy as BotIcon } from '@mui/icons-material';
import { Fade } from '@mui/material';
import TractorCard from './TractorCard';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';

interface MessageListProps {
  messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) {
      return 'Just now';
    }
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'Just now';
    }
  };

  const renderMessageContent = (content: string) => {
    // Handle undefined or null content
    if (!content) {
      return (
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', color: 'text.secondary' }}>
          No content available
        </Typography>
      );
    }

    // Check if content contains markdown-like formatting
    if (content.includes('**') || content.includes('*') || content.includes('`')) {
      return (
        <ReactMarkdown
          components={{
            p: ({ children }) => <Typography variant="body1" sx={{ mb: 1 }}>{children}</Typography>,
            strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
            em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
            code: ({ children }) => (
              <code
                style={{
                  background: '#f5f5f5',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '0.9em',
                }}
              >
                {children}
              </code>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      );
    }

    return (
      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
        {content}
      </Typography>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {messages && messages.length > 0 ? messages.map((message, index) => (
        <Fade key={message.id || `message-${index}`} in timeout={300}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
              alignItems: 'flex-start',
              gap: 1,
            }}
          >
            {message.type === 'bot' && (
              <Avatar
                sx={{
                  bgcolor: 'primary.main',
                  width: 32,
                  height: 32,
                  mt: 0.5,
                }}
              >
                <BotIcon fontSize="small" />
              </Avatar>
            )}

            <Paper
              elevation={1}
              sx={{
                maxWidth: '70%',
                p: 2.5,
                borderRadius: message.type === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                bgcolor: message.type === 'user' ? 'primary.main' : '#f8f9fa',
                color: message.type === 'user' ? 'white' : 'text.primary',
                position: 'relative',
                border: message.type === 'bot' ? '1px solid #e0e0e0' : 'none',
                boxShadow: message.type === 'user' 
                  ? '0 2px 8px rgba(25, 118, 210, 0.2)' 
                  : '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              {renderMessageContent(message.content || '')}

              {/* Render Tractor Cards */}
              {message.hasTractors && message.tractors && message.tractors.length > 0 && (
                <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                    🚜 Relevant Tractors Found
                  </Typography>
                  <Grid container spacing={2}>
                    {message.tractors.slice(0, 3).map((tractor) => (
                      <Grid item xs={12} sm={6} md={4} key={tractor.id}>
                        <TractorCard 
                          tractor={tractor}
                          onViewDetails={(tractor) => {
                            console.log('Tractor details requested:', tractor);
                            // You can add modal or navigation logic here
                          }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                  {message.tractors.length > 3 && (
                    <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary', textAlign: 'center' }}>
                      Showing 3 of {message.tractors.length} tractors found
                    </Typography>
                  )}
                </Box>
              )}

              {message.metadata && (
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {message.metadata.model && (
                    <Chip
                      label={message.metadata.model}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  )}
                  {message.metadata.usage && (
                    <Chip
                      label={`${message.metadata.usage.total_tokens} tokens`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  )}
                </Box>
              )}

              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 1,
                  opacity: 0.7,
                  fontSize: '0.75rem',
                }}
              >
                {formatTimestamp(message.timestamp)}
              </Typography>
            </Paper>

            {message.type === 'user' && (
              <Avatar
                sx={{
                  bgcolor: 'secondary.main',
                  width: 32,
                  height: 32,
                  mt: 0.5,
                }}
              >
                <PersonIcon fontSize="small" />
              </Avatar>
            )}
          </Box>
        </Fade>
      )) : (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
          <Typography variant="body2">No messages yet</Typography>
        </Box>
      )}

    </Box>
  );
};

export default MessageList;
