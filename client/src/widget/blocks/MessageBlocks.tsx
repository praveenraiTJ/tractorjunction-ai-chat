import React from 'react';
import { Box } from '@mui/material';
import { Block } from '../types';
import ProductStrip from './ProductStrip';
import WeatherCard from './WeatherCard';
import MandiCard from './MandiCard';
import MuhuratCard from './MuhuratCard';
import SoilCard from './SoilCard';
import SourcesCard from './SourcesCard';

function renderBlock(block: Block, viewLabel: string) {
  switch (block.type) {
    case 'tractors':
    case 'implements':
    case 'harvesters':
      return <ProductStrip kind={block.type} items={block.data} viewLabel={viewLabel} />;
    case 'weather':
      return <WeatherCard data={block.data} />;
    case 'mandi_price':
      return <MandiCard data={block.data} />;
    case 'muhurat':
      return <MuhuratCard data={block.data} />;
    case 'soil':
      return <SoilCard data={block.data} />;
    case 'sources':
      return <SourcesCard data={block.data} />;
    default:
      return null;
  }
}

const MessageBlocks: React.FC<{ blocks: Block[]; viewLabel: string }> = ({ blocks, viewLabel }) => {
  if (!blocks.length) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 1 }}>
      {blocks.map((block, i) => <Box key={`${block.type}-${i}`}>{renderBlock(block, viewLabel)}</Box>)}
    </Box>
  );
};

export default MessageBlocks;
