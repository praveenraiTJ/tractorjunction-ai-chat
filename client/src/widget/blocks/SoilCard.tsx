import React from 'react';
import { Box, Card, Chip, LinearProgress, Typography } from '@mui/material';
import { SoilData } from '../types';

// Qualitative nutrient levels → bar fill
const LEVEL: Record<string, number> = { 'very low': 10, low: 25, 'low-medium': 40, medium: 55, 'medium-high': 70, high: 85 };
const NUTRIENT_LABEL: Record<string, string> = { N: 'नाइट्रोजन (N)', P: 'फॉस्फोरस (P)', K: 'पोटाश (K)', organic_carbon: 'जैविक कार्बन' };

const SoilCard: React.FC<{ data: SoilData }> = ({ data }) => (
  <Card variant="outlined" sx={{ borderRadius: 3 }}>
    <Box sx={{ p: 1.5, background: 'linear-gradient(135deg, #6d4c41, #a1887f)', color: '#fff' }}>
      <Typography variant="subtitle1" fontWeight={700}>🌱 {data.profile?.hi || data.soil_type || 'मिट्टी रिपोर्ट'}</Typography>
      <Typography variant="caption">{[data.soil_type, data.state].filter(Boolean).join(' · ')}</Typography>
    </Box>
    {data.profile && (
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip label={`pH ${data.profile.ph}`} size="small" color="primary" />
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>{data.profile.texture}</Typography>
        </Box>
        {Object.entries(data.profile.nutrients).map(([key, level]) => (
          <Box key={key}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption">{NUTRIENT_LABEL[key] || key}</Typography>
              <Typography variant="caption" color="text.secondary">{level}</Typography>
            </Box>
            <LinearProgress variant="determinate" value={LEVEL[level] ?? 50} color={(LEVEL[level] ?? 50) < 40 ? 'warning' : 'success'} sx={{ height: 6, borderRadius: 3 }} />
          </Box>
        ))}
        <Box>
          <Typography variant="caption" fontWeight={700}>उपयुक्त फसलें</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {data.profile.crops.map(c => <Chip key={c} label={c} size="small" variant="outlined" sx={{ height: 22 }} />)}
          </Box>
        </Box>
      </Box>
    )}
    {data.soil_test && (
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Typography variant="caption" fontWeight={700}>आपकी जाँच रिपोर्ट</Typography>
        {Object.entries(data.soil_test).map(([k, v]) => (
          <Typography key={k} variant="body2" fontSize={13}>• {NUTRIENT_LABEL[k] || k}: {v}</Typography>
        ))}
      </Box>
    )}
    {data.tractor_for_crops.length > 0 && (
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <Typography variant="caption" fontWeight={700}>फसल के हिसाब से ट्रैक्टर</Typography>
        {data.tractor_for_crops.slice(0, 4).map(r => (
          <Box key={r.crop} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, py: 0.25 }}>
            <span>{r.crop}</span>
            <span><b>{r.hp}</b> · {r.budget}</span>
          </Box>
        ))}
      </Box>
    )}
    <Typography variant="caption" color="text.secondary" component="div" sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider' }}>
      {data.note}
    </Typography>
  </Card>
);

export default SoilCard;
