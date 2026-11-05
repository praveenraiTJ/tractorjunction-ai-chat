import React, { useState } from 'react';
import { Avatar, Box, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import TranslateIcon from '@mui/icons-material/Translate';
import { Strings } from '../strings';
import { isEmbedded, requestClose } from '../parentBridge';

interface Props {
  s: Strings;
  isConnected: boolean;
  onNewChat: () => void;
  onHistory: () => void;
  onToggleTheme: () => void;
  onToggleLang: () => void;
}

const WidgetHeader: React.FC<Props> = ({ s, isConnected, onNewChat, onHistory, onToggleTheme, onToggleLang }) => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
      background: 'linear-gradient(135deg, #cd454e, #d84f57)', color: '#fff', flexShrink: 0
    }}>
      <Avatar sx={{ bgcolor: '#fff', width: 36, height: 36, fontSize: 20 }}>🌾</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2} noWrap>{s.title}</Typography>
        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.9 }}>
          <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: isConnected ? '#9ff0b5' : '#ffe08a' }} />
          {isConnected ? s.online : s.offline}
        </Typography>
      </Box>
      <Tooltip title={s.history}><IconButton color="inherit" size="small" onClick={onHistory}><HistoryIcon /></IconButton></Tooltip>
      <Tooltip title={s.newChat}><IconButton color="inherit" size="small" onClick={onNewChat}><AddCommentOutlinedIcon /></IconButton></Tooltip>
      <IconButton color="inherit" size="small" onClick={e => setMenuAnchor(e.currentTarget)}><MoreVertIcon /></IconButton>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { onToggleLang(); setMenuAnchor(null); }}>
          <ListItemIcon><TranslateIcon fontSize="small" /></ListItemIcon>{s.language}
        </MenuItem>
        <MenuItem onClick={() => { onToggleTheme(); setMenuAnchor(null); }}>
          <ListItemIcon><DarkModeOutlinedIcon fontSize="small" /></ListItemIcon>{s.theme}
        </MenuItem>
      </Menu>
      {isEmbedded && (
        <Tooltip title={s.close}><IconButton color="inherit" size="small" onClick={requestClose}><CloseIcon /></IconButton></Tooltip>
      )}
    </Box>
  );
};

export default WidgetHeader;
