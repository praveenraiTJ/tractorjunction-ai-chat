import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Avatar, Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import { ChatMessage } from '../types';
import { Strings } from '../strings';
import { openUrl } from '../parentBridge';
import MessageBlocks from '../blocks/MessageBlocks';

const plain = (md: string) => md.replace(/[*_#>`|]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(plain(text));
  utterance.lang = /[ऀ-ॿ]/.test(text) ? 'hi-IN' : 'en-IN';
  window.speechSynthesis.speak(utterance);
}

const markdownSx = {
  fontSize: 14.5, lineHeight: 1.6, wordBreak: 'break-word',
  '& p': { my: 0.75 }, '& p:first-of-type': { mt: 0 }, '& p:last-child': { mb: 0 },
  '& ul, & ol': { pl: 2.5, my: 0.75 }, '& li': { my: 0.25 },
  '& a': { color: '#0080e2', fontWeight: 600 },
  '& table': { borderCollapse: 'collapse', fontSize: 13, display: 'block', overflowX: 'auto' },
  '& th, & td': { border: 1, borderColor: 'divider', px: 1, py: 0.5 },
  '& h1, & h2, & h3': { fontSize: 15.5, my: 1 }
};

interface Props {
  message: ChatMessage;
  s: Strings;
  isLast: boolean;
  onSuggestion: (text: string) => void;
  onFeedback: (id: string, value: 'positive' | 'negative') => void;
}

const MessageView: React.FC<Props> = ({ message, s, isLast, onSuggestion, onFeedback }) => {
  const [copied, setCopied] = useState(false);

  if (message.role === 'user') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Box sx={{ maxWidth: '85%', px: 1.75, py: 1, borderRadius: '18px 18px 4px 18px', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: 14.5 }}>{message.text}</Typography>
        </Box>
      </Box>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain(message.text));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked in this frame
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <Avatar sx={{ width: 28, height: 28, fontSize: 16, bgcolor: '#fdecec', mt: 0.25 }}>🌾</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={markdownSx} className={message.streaming ? 'tjk-streaming' : undefined}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a href={href} onClick={e => { e.preventDefault(); if (href) openUrl(href); }}>{children}</a>
              )
            }}
          >
            {message.text}
          </ReactMarkdown>
        </Box>

        <MessageBlocks blocks={message.blocks} viewLabel={s.view} />

        {!message.streaming && message.text && (
          <Box sx={{ display: 'flex', gap: 0.25, mt: 0.5, color: 'text.secondary' }}>
            <Tooltip title={copied ? s.copied : s.copy}><IconButton size="small" onClick={copy}><ContentCopyIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
            <Tooltip title={s.speak}><IconButton size="small" onClick={() => speak(message.text)}><VolumeUpOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
            <IconButton size="small" onClick={() => onFeedback(message.id, 'positive')} disabled={!!message.feedback}>
              {message.feedback === 'positive' ? <ThumbUpIcon sx={{ fontSize: 16 }} color="primary" /> : <ThumbUpOutlinedIcon sx={{ fontSize: 16 }} />}
            </IconButton>
            <IconButton size="small" onClick={() => onFeedback(message.id, 'negative')} disabled={!!message.feedback}>
              {message.feedback === 'negative' ? <ThumbDownIcon sx={{ fontSize: 16 }} color="error" /> : <ThumbDownOutlinedIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Box>
        )}

        {isLast && !message.streaming && message.suggestions.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
            {message.suggestions.map(q => (
              <Chip key={q} label={q} variant="outlined" color="primary" onClick={() => onSuggestion(q)}
                sx={{ height: 'auto', py: 0.5, '& .MuiChip-label': { whiteSpace: 'normal' } }} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default MessageView;
