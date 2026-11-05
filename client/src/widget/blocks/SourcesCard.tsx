import React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import { SourceItem } from '../types';
import { openUrl } from '../parentBridge';

// Where the answer came from: TJ articles / guides the knowledge search used
const SourcesCard: React.FC<{ data: SourceItem[] }> = ({ data }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
    <Typography variant="caption" color="text.secondary" fontWeight={700}>स्रोत / Sources</Typography>
    {data.map(source => (
      <ButtonBase
        key={source.url}
        onClick={() => openUrl(source.url)}
        sx={{
          justifyContent: 'flex-start', textAlign: 'left', gap: 1, p: 1, borderRadius: 2,
          border: 1, borderColor: 'divider', bgcolor: 'background.paper', '&:hover': { borderColor: 'secondary.main' }
        }}
      >
        <ArticleOutlinedIcon sx={{ fontSize: 18, color: 'secondary.main', flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontSize={13} fontWeight={600} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {source.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {source.kind}{source.date ? ` · ${String(source.date).slice(0, 10)}` : ''}
          </Typography>
        </Box>
      </ButtonBase>
    ))}
  </Box>
);

export default SourcesCard;
