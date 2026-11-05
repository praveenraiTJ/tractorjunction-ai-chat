import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, IconButton, List, ListItemButton, ListItemText, Slide, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Strings } from '../strings';
import { SessionSummary } from '../useChat';

interface Props {
  s: Strings;
  open: boolean;
  currentSessionId: string;
  loadSessions: () => Promise<SessionSummary[]>;
  onSelect: (sessionId: string) => void;
  onClose: () => void;
}

const HistoryPanel: React.FC<Props> = ({ s, open, currentSessionId, loadSessions, onSelect, onClose }) => {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setSessions(null);
    loadSessions().then(setSessions);
  }, [open, loadSessions]);

  return (
    <Slide direction="right" in={open} mountOnEnter unmountOnExit>
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 5, bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderBottom: 1, borderColor: 'divider' }}>
          <IconButton size="small" onClick={onClose}><ArrowBackIcon /></IconButton>
          <Typography variant="subtitle1" fontWeight={700}>{s.history}</Typography>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {!sessions && <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>}
          {sessions?.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>{s.noHistory}</Typography>}
          <List dense>
            {sessions?.map(session => (
              <ListItemButton
                key={session.session_id}
                selected={session.session_id === currentSessionId}
                onClick={() => onSelect(session.session_id)}
              >
                <ListItemText
                  primary={session.title}
                  secondary={new Date(session.last_message_at).toLocaleString('hi-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  primaryTypographyProps={{ noWrap: true, fontWeight: 600 }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Box>
    </Slide>
  );
};

export default HistoryPanel;
