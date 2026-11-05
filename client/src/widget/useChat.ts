import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { Block, ChatMessage, PageContext, UiLang } from './types';

const API_BASE = process.env.REACT_APP_SERVER_URL || '';
const SESSION_KEY = 'tjk_session';
const USER_KEY = 'tjk_user';

const newId = () =>
  (window.crypto && 'randomUUID' in window.crypto)
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function stored(key: string, create: () => string) {
  try {
    const value = localStorage.getItem(key) || create();
    localStorage.setItem(key, value);
    return value;
  } catch {
    return create();
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked (private mode / partitioned): session lives for this page only
  }
}

export interface SessionSummary {
  session_id: string;
  title: string;
  last_message_at: string;
}

export function useChat(uiLang: UiLang) {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(() => stored(SESSION_KEY, newId));
  const userId = useRef(stored(USER_KEY, newId)).current;
  const pageContext = useRef<PageContext | null>(null);

  // Load a session's saved messages from the server
  const loadMessages = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(id)}/messages?limit=100`);
      const data = await res.json();
      if (!data.success) return;
      setMessages(data.messages.map((m: any, i: number) => ({
        id: m.metadata?.messageId || `${id}-${i}`,
        role: m.type === 'user' ? 'user' : 'bot',
        text: m.content,
        blocks: m.metadata?.blocks || [],
        suggestions: m.metadata?.suggestions || []
      })));
    } catch {
      // history is best-effort
    }
  }, []);

  useEffect(() => {
    loadMessages(sessionId);
    // only on first mount: later session switches load explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re)initialize the server session on every (re)connect
  useEffect(() => {
    if (!socket || !isConnected) return;
    socket.emit('initialize_session', { sessionId, userId, language: uiLang, pageContext: pageContext.current });
  }, [socket, isConnected, sessionId, userId, uiLang]);

  useEffect(() => {
    if (!socket) return;

    // Update the bot message `id`, creating it on the first streamed event
    const upsertBot = (id: string, update: (m: ChatMessage) => ChatMessage) =>
      setMessages(prev => {
        const index = prev.findIndex(m => m.id === id);
        if (index === -1) {
          return [...prev, update({ id, role: 'bot', text: '', blocks: [], suggestions: [], streaming: true })];
        }
        const next = [...prev];
        next[index] = update(next[index]);
        return next;
      });

    const onStream = ({ messageId, delta }: { messageId: string; delta: string }) =>
      upsertBot(messageId, m => ({ ...m, text: m.text + delta }));
    const onBlock = ({ messageId, block }: { messageId: string; block: Block }) =>
      upsertBot(messageId, m => ({ ...m, blocks: [...m.blocks, block] }));
    const onResponse = (r: { messageId: string; text: string; blocks?: Block[]; suggestions?: string[] }) => {
      upsertBot(r.messageId, m => ({ ...m, text: r.text, blocks: r.blocks || m.blocks, suggestions: r.suggestions || [], streaming: false }));
      setIsTyping(false);
    };
    const onStopped = ({ messageId }: { messageId: string }) => {
      upsertBot(messageId, m => ({ ...m, streaming: false }));
      setIsTyping(false);
    };
    const onTyping = ({ isTyping: typing }: { isTyping: boolean }) => setIsTyping(typing);
    const onError = () => {
      setIsTyping(false);
      setError('error');
    };
    const onSession = ({ sessionId: id }: { sessionId: string }) => remember(SESSION_KEY, id);

    socket.on('bot_stream', onStream);
    socket.on('bot_block', onBlock);
    socket.on('bot_response', onResponse);
    socket.on('bot_stopped', onStopped);
    socket.on('bot_typing', onTyping);
    socket.on('error', onError);
    socket.on('session_initialized', onSession);
    return () => {
      socket.off('bot_stream', onStream);
      socket.off('bot_block', onBlock);
      socket.off('bot_response', onResponse);
      socket.off('bot_stopped', onStopped);
      socket.off('bot_typing', onTyping);
      socket.off('error', onError);
      socket.off('session_initialized', onSession);
    };
  }, [socket]);

  const send = useCallback((text: string) => {
    const message = text.trim();
    if (!message || !socket) return;
    setError(null);
    const id = newId();
    // Earlier suggestion chips no longer apply once the user moves on
    setMessages(prev => [
      ...prev.map(m => (m.suggestions.length ? { ...m, suggestions: [] } : m)),
      { id, role: 'user', text: message, blocks: [], suggestions: [] }
    ]);
    setIsTyping(true);
    socket.emit('chat_message', { message, messageId: id });
  }, [socket]);

  const stop = useCallback(() => {
    socket?.emit('stop_generation');
    setMessages(prev => prev.map(m => (m.streaming ? { ...m, streaming: false } : m)));
    setIsTyping(false);
  }, [socket]);

  const switchSession = useCallback((id: string | null) => {
    const next = id || newId();
    remember(SESSION_KEY, next);
    setSessionId(next);
    setMessages([]);
    setError(null);
    setIsTyping(false);
    if (id) loadMessages(id);
  }, [loadMessages]);

  const listSessions = useCallback(async (): Promise<SessionSummary[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions/user/${encodeURIComponent(userId)}`);
      const data = await res.json();
      return data.success ? data.sessions : [];
    } catch {
      return [];
    }
  }, [userId]);

  const setPageContext = useCallback((context: PageContext | null) => {
    pageContext.current = context;
    socket?.emit('update_profile', { pageContext: context });
  }, [socket]);

  const shareLocation = useCallback((latitude: number, longitude: number) => {
    socket?.emit('update_profile', { latitude, longitude });
  }, [socket]);

  const sendFeedback = useCallback((messageId: string, value: 'positive' | 'negative') => {
    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, feedback: value } : m)));
    socket?.emit('track_interaction', { action: `feedback:${messageId}`, type: 'feedback', satisfaction: value });
  }, [socket]);

  return {
    messages, isTyping, error, isConnected, sessionId,
    send, stop, switchSession, listSessions, setPageContext, shareLocation, sendFeedback
  };
}
