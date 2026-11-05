import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, CssBaseline, ThemeProvider, Typography, createTheme, useMediaQuery } from '@mui/material';
import { SocketProvider } from '../contexts/SocketContext';
import { useChat } from './useChat';
import { getStrings } from './strings';
import { notifyReady, notifyUnread, onParentMessage } from './parentBridge';
import { PageContext, UiLang } from './types';
import WidgetHeader from './components/WidgetHeader';
import WelcomeScreen from './components/WelcomeScreen';
import MessageView from './components/MessageView';
import Composer from './components/Composer';
import HistoryPanel from './components/HistoryPanel';
import './widget.css';

function readPref<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key) as T;
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // preference only lasts for this page view
  }
}

const TypingDots = () => (
  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', pl: 4.5 }}>
    <Box className="tjk-dots"><span /><span /><span /></Box>
  </Box>
);

const ChatWindow: React.FC<{ uiLang: UiLang; onToggleLang: () => void; onToggleTheme: () => void }> = ({ uiLang, onToggleLang, onToggleTheme }) => {
  const s = getStrings(uiLang);
  const chat = useChat(uiLang);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const panelOpen = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { setPageContext: sendPageContext } = chat;

  // Host page handshake: receive page context and open/closed state
  useEffect(() => {
    const off = onParentMessage(msg => {
      if (msg.type === 'context' && msg.context) {
        setPageContext(msg.context);
        sendPageContext(msg.context);
      }
      if (msg.type === 'visibility') panelOpen.current = !!msg.open;
    });
    notifyReady();
    return off;
  }, [sendPageContext]);

  // Badge on the launcher when an answer lands while the panel is closed
  const lastMessage = chat.messages[chat.messages.length - 1];
  useEffect(() => {
    if (lastMessage?.role === 'bot' && !lastMessage.streaming && !panelOpen.current) notifyUnread(1);
  }, [lastMessage?.role, lastMessage?.streaming]);

  // Keep the newest content in view while streaming, unless the user scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom || lastMessage?.role === 'user') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [chat.messages, chat.isTyping, lastMessage?.role]);

  const awaitingFirstToken = chat.isTyping && lastMessage?.role === 'user';
  const busy = chat.isTyping || !!lastMessage?.streaming;

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', position: 'relative', overflow: 'hidden' }}>
      <WidgetHeader
        s={s}
        isConnected={chat.isConnected}
        onNewChat={() => chat.switchSession(null)}
        onHistory={() => setHistoryOpen(true)}
        onToggleLang={onToggleLang}
        onToggleTheme={onToggleTheme}
      />

      <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {chat.messages.length === 0 ? (
          <WelcomeScreen s={s} pageContext={pageContext} onPrompt={chat.send} />
        ) : (
          <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {chat.messages.map((m, i) => (
              <MessageView
                key={m.id}
                message={m}
                s={s}
                isLast={i === chat.messages.length - 1}
                onSuggestion={chat.send}
                onFeedback={chat.sendFeedback}
              />
            ))}
            {awaitingFirstToken && <TypingDots />}
            {chat.error && <Alert severity="error" sx={{ py: 0 }}>{s.error}</Alert>}
          </Box>
        )}
      </Box>

      <Composer
        s={s}
        uiLang={uiLang}
        busy={busy}
        disabled={!chat.isConnected}
        onSend={chat.send}
        onStop={chat.stop}
        onLocation={chat.shareLocation}
      />
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontSize: 10.5, pb: 0.75, px: 1 }}>
        {s.disclaimer}
      </Typography>

      <HistoryPanel
        s={s}
        open={historyOpen}
        currentSessionId={chat.sessionId}
        loadSessions={chat.listSessions}
        onSelect={id => { chat.switchSession(id); setHistoryOpen(false); }}
        onClose={() => setHistoryOpen(false)}
      />
    </Box>
  );
};

const WidgetApp: React.FC = () => {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  const [uiLang, setUiLang] = useState<UiLang>(() =>
    readPref('tjk_lang', ['hi', 'en'], urlLang === 'en' ? 'en' : 'hi'));
  const [mode, setMode] = useState<'light' | 'dark' | null>(() => {
    const saved = readPref<'light' | 'dark' | ''>('tjk_theme', ['light', 'dark'], '');
    return saved || null;
  });
  const paletteMode = mode || (prefersDark ? 'dark' : 'light');

  const theme = useMemo(() => createTheme({
    palette: {
      mode: paletteMode,
      // Tractor Junction brand: navy .fillBtn (#0d3b66) for actions, TJ red (#d84f57 theme-color, #cd454e accent)
      primary: paletteMode === 'dark'
        ? { main: '#5b8fc7', light: '#9ec1e6', dark: '#0d3b66', contrastText: '#fff' }
        : { main: '#0d3b66', light: '#e3ebf3', dark: '#082743', contrastText: '#fff' },
      secondary: { main: '#d84f57', dark: '#cd454e', contrastText: '#fff' },
      text: paletteMode === 'dark' ? { primary: '#f1f1f1', secondary: '#a8adb3' } : { primary: '#333333', secondary: '#6b6f75' },
      background: paletteMode === 'dark'
        ? { default: '#15181c', paper: '#1e2227' }
        : { default: '#f2f2f2', paper: '#ffffff' }
    },
    shape: { borderRadius: 10 },
    typography: {
      // TJ uses Mulish ("tj-regular") and Noto Sans Devanagari for Hindi
      fontFamily: '"Mulish", "Noto Sans Devanagari", Arial, Helvetica, sans-serif',
      button: { textTransform: 'none', fontWeight: 600 }
    }
  }), [paletteMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SocketProvider>
        <ChatWindow
          uiLang={uiLang}
          onToggleLang={() => setUiLang(prev => {
            const next = prev === 'hi' ? 'en' : 'hi';
            savePref('tjk_lang', next);
            return next;
          })}
          onToggleTheme={() => {
            const next = paletteMode === 'dark' ? 'light' : 'dark';
            savePref('tjk_theme', next);
            setMode(next);
          }}
        />
      </SocketProvider>
    </ThemeProvider>
  );
};

export default WidgetApp;
