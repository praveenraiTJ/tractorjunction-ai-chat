import React from 'react';
import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { MandiData } from '../types';

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const Stat: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({ label, value, sub, color }) => (
  <Box sx={{ flex: 1, minWidth: 0, p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
    <Typography variant="caption" color="text.secondary" component="div">{label}</Typography>
    <Typography variant="subtitle2" fontWeight={700} color={color}>{value}</Typography>
    {sub && <Typography variant="caption" color="text.secondary" noWrap component="div">{sub}</Typography>}
  </Box>
);

const MandiCard: React.FC<{ data: MandiData }> = ({ data }) => (
  <Card variant="outlined" sx={{ borderRadius: 3 }}>
    <Box sx={{ p: 1.5, pb: 1 }}>
      <Typography variant="subtitle1" fontWeight={700}>💰 {data.commodity} मंडी भाव</Typography>
      <Typography variant="caption" color="text.secondary">
        {data.latest_date} · {data.unit} · स्रोत: {data.source}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Stat label="औसत" value={rupees(data.summary.avg_modal)} sub={`${data.summary.markets} मंडियाँ`} />
        <Stat label="सबसे ऊँचा" value={rupees(data.summary.highest.modal)} sub={data.summary.highest.market} color="success.main" />
        <Stat label="सबसे कम" value={rupees(data.summary.lowest.modal)} sub={data.summary.lowest.market} color="error.main" />
      </Box>
    </Box>
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ '& td, & th': { px: 1, fontSize: 12, whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow>
            <TableCell>मंडी</TableCell>
            <TableCell align="right">मॉडल भाव</TableCell>
            <TableCell align="right">न्यूनतम - अधिकतम</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.rows.map(r => (
            <TableRow key={`${r.market}-${r.variety}-${r.date}`}>
              <TableCell>
                <Typography variant="body2" fontSize={12} fontWeight={600}>{r.market}</Typography>
                <Typography variant="caption" color="text.secondary">{r.district} · {r.variety}</Typography>
              </TableCell>
              <TableCell align="right"><b>{rupees(r.modal)}</b></TableCell>
              <TableCell align="right">{rupees(r.min)} - {rupees(r.max)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  </Card>
);

export default MandiCard;
