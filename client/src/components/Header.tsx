import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  SmartToy as BotIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface HeaderProps {
  isConnected: boolean;
}

const Header: React.FC<HeaderProps> = ({ isConnected }) => {
  return (
    <AppBar
      position="fixed"
      elevation={1}
      sx={{
        background: 'linear-gradient(135deg, #d32f2f 0%, #f57c00 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(10px)',
        zIndex: 1300,
      }}
    >
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <Box
            component="img"
            src="https://static-asset.tractorjunction.com/tj/TJ_LOGO_en.svg"
            alt="Tractor Junction"
            sx={{
              height: 40,
              width: 'auto',
              filter: 'brightness(0) invert(1)', // Make logo white
            }}
          />
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              Tractor Junction AI Assistant
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Intelligent Chat Assistant
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={isConnected ? 'Connected to server' : 'Disconnected from server'}>
            <Chip
              icon={isConnected ? <WifiIcon /> : <WifiOffIcon />}
              label={isConnected ? 'Online' : 'Offline'}
              color={isConnected ? 'success' : 'error'}
              variant="outlined"
              size="small"
              sx={{
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                '& .MuiChip-icon': {
                  color: 'white',
                },
              }}
            />
          </Tooltip>

          {!isConnected && (
            <Tooltip title="Retry connection">
              <IconButton
                size="small"
                sx={{ color: 'white' }}
                onClick={() => window.location.reload()}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
