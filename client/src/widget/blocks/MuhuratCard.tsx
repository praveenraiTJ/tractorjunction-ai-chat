import React from 'react';
import { Box, Card, Chip, Typography } from '@mui/material';
import { MuhuratData } from '../types';

const stars = (score: number) => '★'.repeat(Math.min(5, Math.max(1, score - 3))).padEnd(5, '☆');

const MuhuratCard: React.FC<{ data: MuhuratData }> = ({ data }) => (
  <Card variant="outlined" sx={{ borderRadius: 3 }}>
    <Box sx={{ p: 1.5, background: 'linear-gradient(135deg, #f57c00, #ffb300)', color: '#fff' }}>
      <Typography variant="subtitle1" fontWeight={700}>🪔 ट्रैक्टर खरीद शुभ मुहूर्त</Typography>
      <Typography variant="caption">{data.from} से {data.to} तक</Typography>
    </Box>
    {data.best.length === 0 && (
      <Typography variant="body2" sx={{ p: 1.5 }}>इस अवधि में कोई विशेष शुभ दिन नहीं मिला।</Typography>
    )}
    {data.best.map(d => {
      const date = new Date(`${d.date}T00:00:00`);
      return (
        <Box key={d.date} sx={{ display: 'flex', gap: 1.25, p: 1.25, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ flex: '0 0 52px', textAlign: 'center', borderRadius: 2, bgcolor: 'secondary.main', color: '#fff', py: 0.5, alignSelf: 'flex-start' }}>
            <Typography variant="h6" fontWeight={700} lineHeight={1.1}>{date.getDate()}</Typography>
            <Typography variant="caption">{date.toLocaleDateString('hi-IN', { month: 'short' })}</Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="subtitle2" fontWeight={700}>{d.vaar}</Typography>
              <Typography variant="caption" color="secondary.main" sx={{ letterSpacing: 1 }}>{stars(d.score)}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" component="div">
              {d.tithi.paksha} {d.tithi.name} · {d.nakshatra.name} नक्षत्र
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {d.reasons.slice(0, 2).map(r => <Chip key={r} label={r} size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: 11 }} />)}
            </Box>
            <Typography variant="caption" color="error.main" component="div" sx={{ mt: 0.5 }}>
              ⚠️ राहु काल {d.rahu_kaal} में खरीद न करें
            </Typography>
          </Box>
        </Box>
      );
    })}
    <Typography variant="caption" color="text.secondary" component="div" sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider' }}>
      {data.note}
    </Typography>
  </Card>
);

export default MuhuratCard;
