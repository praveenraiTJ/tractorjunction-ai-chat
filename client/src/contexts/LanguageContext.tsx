import React, { createContext, useContext, useState, useEffect } from 'react';

interface LanguageContextType {
  language: string;
  setLanguage: (language: string) => void;
  t: (key: string, params?: any) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

const translations = {
  en: {
    welcome: 'Welcome to Tractor Junction AI Chat Assistant',
    description: 'Ask me anything about tractors! I can help you find the perfect tractor, compare models, check prices, and more.',
    placeholder: 'Ask me anything about tractors...',
    connected: 'Connected',
    disconnected: 'Disconnected',
    online: 'Online',
    clearChat: 'Clear chat',
    retryConnection: 'Retry connection',
    relatedTractors: 'Related Tractors:',
    viewDetails: 'View Details',
    contactForPrice: 'Contact for price',
    addToFavorites: 'Add to favorites',
    share: 'Share',
    match: 'match',
    typing: 'Bot is typing...',
    error: 'An error occurred',
    retry: 'Retry',
    suggestions: [
      'Show me Mahindra tractors',
      'What is the price of John Deere 5050D?',
      'Best tractor for farming',
      'Compare tractors under 5 lakh',
    ],
  },
  hi: {
    welcome: 'ट्रैक्टर जंक्शन AI चैट में आपका स्वागत है',
    description: 'ट्रैक्टर के बारे में कुछ भी पूछें! मैं आपको सही ट्रैक्टर खोजने, मॉडलों की तुलना करने, कीमतें जांचने और बहुत कुछ करने में मदद कर सकता हूं।',
    placeholder: 'ट्रैक्टर के बारे में कुछ भी पूछें...',
    connected: 'जुड़ा हुआ',
    disconnected: 'डिस्कनेक्ट',
    online: 'ऑनलाइन',
    clearChat: 'चैट साफ़ करें',
    retryConnection: 'कनेक्शन पुनः प्रयास करें',
    relatedTractors: 'संबंधित ट्रैक्टर:',
    viewDetails: 'विवरण देखें',
    contactForPrice: 'कीमत के लिए संपर्क करें',
    addToFavorites: 'पसंदीदा में जोड़ें',
    share: 'साझा करें',
    match: 'मैच',
    typing: 'बॉट टाइप कर रहा है...',
    error: 'एक त्रुटि हुई',
    retry: 'पुनः प्रयास करें',
    suggestions: [
      'मुझे महिंद्रा ट्रैक्टर दिखाएं',
      'जॉन डीयर 5050D की कीमत क्या है?',
      'खेती के लिए सबसे अच्छा ट्रैक्टर',
      '5 लाख के तहत ट्रैक्टरों की तुलना करें',
    ],
  },
  ta: {
    welcome: 'டிராக்டர் ஜங்க்ஷன் AI சாட் வரவேற்கிறது',
    description: 'டிராக்டர்கள் பற்றி எதையும் கேளுங்கள்! சரியான டிராக்டரைக் கண்டறிய, மாடல்களை ஒப்பிட, விலைகளை சரிபார்க்க மற்றும் பலவற்றில் உதவ முடியும்.',
    placeholder: 'டிராக்டர்கள் பற்றி எதையும் கேளுங்கள்...',
    connected: 'இணைக்கப்பட்டது',
    disconnected: 'இணைப்பு துண்டிக்கப்பட்டது',
    online: 'ஆன்லைன்',
    clearChat: 'சாட் அழிக்க',
    retryConnection: 'இணைப்பு மீண்டும் முயற்சிக்க',
    relatedTractors: 'தொடர்புடைய டிராக்டர்கள்:',
    viewDetails: 'விவரங்களைக் காண்க',
    contactForPrice: 'விலைக்கு தொடர்பு கொள்ள',
    addToFavorites: 'பிடித்தவற்றில் சேர்க்க',
    share: 'பகிர்',
    match: 'பொருத்தம்',
    typing: 'பாட் தட்டச்சு செய்கிறது...',
    error: 'ஒரு பிழை ஏற்பட்டது',
    retry: 'மீண்டும் முயற்சிக்க',
    suggestions: [
      'மஹிந்திரா டிராக்டர்களைக் காட்டுங்கள்',
      'ஜான் டீர் 5050D இன் விலை என்ன?',
      'விவசாயத்திற்கு சிறந்த டிராக்டர்',
      '5 லட்சத்திற்கு கீழ் டிராக்டர்களை ஒப்பிடுங்கள்',
    ],
  },
};

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(() => {
    // Get language from localStorage or detect from browser
    const savedLanguage = localStorage.getItem('tractor-chat-language');
    if (savedLanguage && translations[savedLanguage as keyof typeof translations]) {
      return savedLanguage;
    }
    
    // Detect language from browser
    const browserLanguage = navigator.language.split('-')[0];
    if (translations[browserLanguage as keyof typeof translations]) {
      return browserLanguage;
    }
    
    return 'en';
  });

  const setLanguage = (newLanguage: string) => {
    setLanguageState(newLanguage);
    localStorage.setItem('tractor-chat-language', newLanguage);
  };

  const t = (key: string, params?: any): string => {
    const translation = translations[language as keyof typeof translations]?.[key as keyof typeof translations['en']];
    if (!translation) {
      console.warn(`Translation missing for key: ${key} in language: ${language}`);
      return key;
    }
    
    if (typeof translation === 'string') {
      return translation;
    }
    
    // If translation is an array, join it or return the first element
    if (Array.isArray(translation)) {
      return translation.join(' ');
    }
    
    // Fallback to string conversion
    return String(translation);
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
