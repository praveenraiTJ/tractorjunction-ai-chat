import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, InputBase, Tooltip } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import MicNoneRoundedIcon from '@mui/icons-material/MicNoneRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import { Strings } from '../strings';
import { UiLang } from '../types';

// Web Speech API (Chrome/Edge/Android expose it with the webkit prefix)
const SpeechRecognitionImpl: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

interface Props {
  s: Strings;
  uiLang: UiLang;
  busy: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onLocation: (lat: number, lon: number) => void;
}

const Composer: React.FC<Props> = ({ s, uiLang, busy, disabled, onSend, onStop, onLocation }) => {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [locationShared, setLocationShared] = useState(false);
  const recognition = useRef<any>(null);

  useEffect(() => () => recognition.current?.abort(), []);

  const submit = () => {
    if (!text.trim() || busy) return;
    onSend(text);
    setText('');
  };

  const toggleMic = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const rec = new SpeechRecognitionImpl();
    rec.lang = uiLang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = true;
    rec.onresult = (e: any) => setText(Array.from(e.results).map((r: any) => r[0].transcript).join(''));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognition.current = rec;
    rec.start();
    setListening(true);
  };

  const shareLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      pos => {
        onLocation(+pos.coords.latitude.toFixed(4), +pos.coords.longitude.toFixed(4));
        setLocationShared(true);
      },
      () => setLocationShared(false),
      { timeout: 10000 }
    );
  };

  return (
    <Box sx={{ p: 1, pt: 0.5, flexShrink: 0 }}>
      <Box sx={{
        display: 'flex', alignItems: 'flex-end', gap: 0.5, px: 1, py: 0.5, borderRadius: 4,
        border: 1, borderColor: listening ? 'error.main' : 'divider', bgcolor: 'background.paper',
        boxShadow: '0 2px 10px rgba(0,0,0,.06)', '&:focus-within': { borderColor: 'primary.main' }
      }}>
        <Tooltip title={locationShared ? s.locationShared : s.shareLocation}>
          <IconButton size="small" onClick={shareLocation} color={locationShared ? 'primary' : 'default'} sx={{ mb: 0.25 }}>
            <MyLocationRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <InputBase
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={listening ? s.listening : s.placeholder}
          multiline
          maxRows={5}
          disabled={disabled}
          sx={{ flex: 1, py: 0.75, fontSize: 15 }}
        />
        {SpeechRecognitionImpl && !busy && (
          <IconButton size="small" onClick={toggleMic} color={listening ? 'error' : 'default'} sx={{ mb: 0.25 }}>
            <MicNoneRoundedIcon />
          </IconButton>
        )}
        {busy ? (
          <Tooltip title={s.stop}>
            <IconButton size="small" onClick={onStop} sx={{ mb: 0.25, bgcolor: 'text.primary', color: 'background.paper', '&:hover': { bgcolor: 'text.secondary' } }}>
              <StopRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title={s.send}>
            <span>
              <IconButton size="small" onClick={submit} disabled={!text.trim() || disabled}
                sx={{ mb: 0.25, bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}>
                <SendRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default Composer;
