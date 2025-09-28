import React from 'react';
import { Box, Typography } from '@mui/material';
import { SmartToy as BotIcon } from '@mui/icons-material';

const TypingIndicator: React.FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 2,
        ml: 5,
      }}
    >
      <BotIcon color="primary" />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          p: 1,
          bgcolor: 'grey.100',
          borderRadius: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
          Bot is typing
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[0, 1, 2].map((index) => (
            <Box
              key={index}
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                animation: 'typing 1.4s infinite ease-in-out',
                animationDelay: `${index * 0.16}s`,
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default TypingIndicator;
