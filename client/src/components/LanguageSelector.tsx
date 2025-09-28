import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Box,
  Chip,
} from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';

interface LanguageSelectorProps {
  value: string;
  onChange: (language: string) => void;
}

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
];

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ value, onChange }) => {
  const handleChange = (event: SelectChangeEvent) => {
    onChange(event.target.value);
  };

  const currentLanguage = languages.find(lang => lang.code === value);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LanguageIcon color="primary" />
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <Select
          value={value}
          onChange={handleChange}
          displayEmpty
          sx={{
            '& .MuiSelect-select': {
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            },
          }}
        >
          {languages.map((language) => (
            <MenuItem key={language.code} value={language.code}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ fontSize: '1.2em' }}>{language.flag}</span>
                <span>{language.name}</span>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {currentLanguage && (
        <Chip
          label={currentLanguage.name}
          size="small"
          variant="outlined"
          icon={<span style={{ fontSize: '1em' }}>{currentLanguage.flag}</span>}
        />
      )}
    </Box>
  );
};

export default LanguageSelector;
