import React from 'react';
import { Box, Paper, Container } from '@mui/material';
import ChatInterface from './ChatInterface';
import './TractorCard.css';

const MainPage: React.FC = () => {
  return (
    <Box sx={{ 
      flex: 1, 
      display: 'flex', 
      height: 'calc(100vh - 64px)', // Account for fixed header height
      overflow: 'hidden',
      marginTop: '64px', // Account for fixed header
      paddingTop: '0px', // Ensure no additional padding
    }}>
      <Paper
        elevation={8}
        sx={{
          flex: 1,
          borderRadius: 0,
          overflow: 'hidden',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          margin: 0,
          display: 'flex',
          flexDirection: 'row',
          height: '100%',
        }}
      >
        <ChatInterface />
      </Paper>
    </Box>
  );
};

export default MainPage;
