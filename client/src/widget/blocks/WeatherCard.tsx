import React from 'react';
import { Alert, Box, Card, Typography } from '@mui/material';
import { WeatherData } from '../types';

// WMO weather interpretation codes → emoji
function weatherIcon(code: number) {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  return '⛈️';
}

const dayLabel = (date: string, index: number) =>
  index === 0 ? 'आज' : index === 1 ? 'कल' : new Date(`${date}T00:00:00`).toLocaleDateString('hi-IN', { weekday: 'short', day: 'numeric' });

const severity = { ok: 'success', info: 'info', warning: 'warning' } as const;

const WeatherCard: React.FC<{ data: WeatherData }> = ({ data }) => (
  <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
    <Box sx={{ p: 1.5, background: 'linear-gradient(135deg, #1e88e5, #42a5f5)', color: '#fff', display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography fontSize={40} lineHeight={1}>{weatherIcon(data.current.code)}</Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>📍 {data.location.name || 'आपकी लोकेशन'}{data.location.state ? `, ${data.location.state}` : ''}</Typography>
        <Typography variant="h5" fontWeight={700}>{Math.round(data.current.temp)}°C</Typography>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          नमी {data.current.humidity}% · हवा {Math.round(data.current.wind_kmh)} km/h
        </Typography>
      </Box>
    </Box>
    <Box sx={{ display: 'flex', overflowX: 'auto', borderBottom: 1, borderColor: 'divider' }}>
      {data.days.map((d, i) => (
        <Box key={d.date} sx={{ flex: '0 0 64px', textAlign: 'center', py: 1, borderRight: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" component="div">{dayLabel(d.date, i)}</Typography>
          <Typography fontSize={22}>{weatherIcon(d.code)}</Typography>
          <Typography variant="caption" fontWeight={700} component="div">{Math.round(d.temp_max)}° / {Math.round(d.temp_min)}°</Typography>
          <Typography variant="caption" color={d.rain_mm > 0 ? 'primary.main' : 'text.secondary'} component="div">
            💧 {d.rain_mm > 0 ? `${d.rain_mm}mm` : `${d.rain_prob}%`}
          </Typography>
        </Box>
      ))}
    </Box>
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {data.advisories.map(a => (
        <Alert key={a.code} severity={severity[a.level]} sx={{ py: 0, '& .MuiAlert-message': { fontSize: 13 } }}>{a.text}</Alert>
      ))}
    </Box>
  </Card>
);

export default WeatherCard;
