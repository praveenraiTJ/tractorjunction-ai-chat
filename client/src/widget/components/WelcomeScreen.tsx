import React from 'react';
import { Box, ButtonBase, Chip, Typography } from '@mui/material';
import { Strings } from '../strings';
import { PageContext } from '../types';

interface Props {
  s: Strings;
  pageContext: PageContext | null;
  onPrompt: (prompt: string) => void;
}

const WelcomeScreen: React.FC<Props> = ({ s, pageContext, onPrompt }) => {
  // On a product page, offer to ask about that product first
  const product = pageContext && (pageContext.model || pageContext.brand)
    ? [pageContext.brand, pageContext.model].filter(Boolean).join(' ')
    : null;

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ textAlign: 'center', mt: 1 }}>
        <Typography fontSize={44} lineHeight={1}>🚜</Typography>
        <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>{s.greeting}</Typography>
        <Typography variant="body2" color="text.secondary">{s.intro}</Typography>
      </Box>

      {product && (
        <Chip
          color="secondary"
          label={`${s.askAbout}: ${product}`}
          onClick={() => onPrompt(s.askPrompt.replace('{product}', product))}
          sx={{ alignSelf: 'center', maxWidth: '100%', fontWeight: 600 }}
        />
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
        {s.tiles.map((tile, i) => (
          <ButtonBase
            key={tile.label}
            onClick={() => onPrompt(tile.prompt)}
            sx={{
              // odd tile count: last one spans both columns
              gridColumn: i === s.tiles.length - 1 && s.tiles.length % 2 ? 'span 2' : undefined,
              justifyContent: 'flex-start', gap: 1, p: 1.25, borderRadius: 3, textAlign: 'left',
              border: 1, borderColor: 'divider', bgcolor: 'background.paper',
              transition: 'all .15s', '&:hover': { borderColor: 'secondary.main', bgcolor: 'action.hover', transform: 'translateY(-1px)' }
            }}
          >
            <Typography fontSize={22}>{tile.icon}</Typography>
            <Typography variant="body2" fontWeight={600}>{tile.label}</Typography>
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
};

export default WelcomeScreen;
