import React from 'react';
import { Box, Button, Card, Chip, Typography } from '@mui/material';
import { ProductItem } from '../types';
import { openUrl } from '../parentBridge';

const FALLBACK_IMAGE = 'https://assets.tractorjunction.com/tractor-junction/assets/images/upload/di-60-1631527166.webp?width=347&height=202';

function priceText(item: ProductItem) {
  if (item.min_price_lakh && item.max_price_lakh && item.min_price_lakh !== item.max_price_lakh) {
    return `₹${item.min_price_lakh} - ${item.max_price_lakh} लाख*`;
  }
  const single = item.min_price_lakh || item.max_price_lakh || (item.price_lakh && parseFloat(item.price_lakh));
  return single ? `₹${single} लाख*` : null;
}

function specChips(item: ProductItem, kind: string): string[] {
  if (kind === 'tractors') return [item.hp && `${item.hp} HP`, item.wheel_drive, item.pto_hp && `PTO ${item.pto_hp}`].filter(Boolean) as string[];
  if (kind === 'implements') return [item.category, item.tractor_power].filter(Boolean) as string[];
  return [item.power_source, item.engine_hp && `${String(item.engine_hp).replace(/\s*HP$/i, '')} HP`, item.cutter_bar].filter(Boolean) as string[];
}

interface Props {
  kind: 'tractors' | 'implements' | 'harvesters';
  items: ProductItem[];
  viewLabel: string;
}

const ProductStrip: React.FC<Props> = ({ kind, items, viewLabel }) => (
  <Box sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 1, mx: -0.5, px: 0.5, scrollSnapType: 'x mandatory' }}>
    {items.map(item => {
      const price = priceText(item);
      return (
        <Card
          key={`${kind}-${item.id}`}
          variant="outlined"
          sx={{ flex: '0 0 188px', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', borderRadius: 3, overflow: 'hidden' }}
        >
          <Box
            component="img"
            src={item.image || FALLBACK_IMAGE}
            alt={`${item.brand || ''} ${item.model}`}
            loading="lazy"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.src = FALLBACK_IMAGE; }}
            sx={{ width: '100%', height: 104, objectFit: 'contain', bgcolor: '#fff' }}
          />
          <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" noWrap component="div">{item.brand}</Typography>
              <Typography variant="subtitle2" fontWeight={700} lineHeight={1.25} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.model}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {specChips(item, kind).slice(0, 3).map(chip => (
                <Chip key={chip} label={chip} size="small" sx={{ height: 20, fontSize: 11 }} />
              ))}
            </Box>
            {price && <Typography variant="body2" fontWeight={700} color="primary.main">{price}</Typography>}
            {item.min_emi ? <Typography variant="caption" color="text.secondary">EMI ₹{item.min_emi.toLocaleString('en-IN')}/माह से</Typography> : null}
            <Button size="small" variant="contained" disableElevation onClick={() => openUrl(item.url)} sx={{ mt: 'auto', borderRadius: 2 }}>
              {viewLabel} →
            </Button>
          </Box>
        </Card>
      );
    })}
  </Box>
);

export default ProductStrip;
