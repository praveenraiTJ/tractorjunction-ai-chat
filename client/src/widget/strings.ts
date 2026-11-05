import { UiLang } from './types';

const strings = {
  hi: {
    title: 'TJ किसान मित्र',
    subtitle: 'खेती का AI साथी',
    online: 'ऑनलाइन',
    offline: 'कनेक्ट हो रहा है…',
    greeting: 'नमस्ते किसान भाई 🙏',
    intro: 'मंडी भाव, मौसम, शुभ मुहूर्त, मिट्टी, ट्रैक्टर — कुछ भी पूछें।',
    placeholder: 'अपना सवाल लिखें या बोलें…',
    newChat: 'नई चैट',
    history: 'पुरानी चैट',
    noHistory: 'अभी कोई पुरानी चैट नहीं है',
    close: 'बंद करें',
    stop: 'रोकें',
    send: 'भेजें',
    listening: 'सुन रहा हूँ…',
    shareLocation: 'मेरी लोकेशन',
    locationShared: 'लोकेशन मिल गई ✓',
    copy: 'कॉपी',
    copied: 'कॉपी हो गया',
    speak: 'सुनें',
    view: 'देखें',
    error: 'कुछ गड़बड़ हुई, दोबारा कोशिश करें।',
    disclaimer: 'AI जवाब गलत हो सकते हैं। ज़रूरी फैसले से पहले जाँच लें।',
    askAbout: 'इसके बारे में पूछें',
    askPrompt: '{product} की कीमत, फीचर्स और EMI बताइए',
    theme: 'डार्क मोड',
    language: 'English',
    tiles: [
      { icon: '💰', label: 'मंडी भाव', prompt: 'आज मेरे जिले की मंडी में गेहूं का भाव क्या है?' },
      { icon: '🌦️', label: 'मौसम', prompt: 'अगले 7 दिन का मौसम और खेती की सलाह बताइए' },
      { icon: '🪔', label: 'शुभ मुहूर्त', prompt: 'ट्रैक्टर खरीदने का अगला शुभ मुहूर्त कब है?' },
      { icon: '🌱', label: 'मिट्टी जाँच', prompt: 'मेरे राज्य की मिट्टी कैसी है और कौन सी फसल अच्छी रहेगी?' },
      { icon: '🚜', label: 'ट्रैक्टर', prompt: '8 लाख तक के अच्छे 45-50 HP ट्रैक्टर बताइए' },
      { icon: '⚙️', label: 'इम्प्लीमेंट', prompt: '45 HP ट्रैक्टर के लिए अच्छा रोटावेटर बताइए' },
      { icon: '🌾', label: 'हार्वेस्टर', prompt: 'धान के लिए अच्छा कंबाइन हार्वेस्टर बताइए' }
    ]
  },
  en: {
    title: 'TJ Kisan Mitra',
    subtitle: 'Your AI farming assistant',
    online: 'Online',
    offline: 'Connecting…',
    greeting: 'Namaste, farmer friend 🙏',
    intro: 'Ask about mandi prices, weather, shubh muhurat, soil, tractors and more.',
    placeholder: 'Type or speak your question…',
    newChat: 'New chat',
    history: 'Chat history',
    noHistory: 'No previous chats yet',
    close: 'Close',
    stop: 'Stop',
    send: 'Send',
    listening: 'Listening…',
    shareLocation: 'My location',
    locationShared: 'Location shared ✓',
    copy: 'Copy',
    copied: 'Copied',
    speak: 'Listen',
    view: 'View',
    error: 'Something went wrong, please try again.',
    disclaimer: 'AI answers can be wrong. Verify before important decisions.',
    askAbout: 'Ask about this',
    askPrompt: 'Tell me the price, features and EMI of {product}',
    theme: 'Dark mode',
    language: 'हिंदी',
    tiles: [
      { icon: '💰', label: 'Mandi prices', prompt: "What is today's wheat price in my district mandi?" },
      { icon: '🌦️', label: 'Weather', prompt: 'Weather for the next 7 days with farming advice' },
      { icon: '🪔', label: 'Shubh muhurat', prompt: 'When is the next auspicious day to buy a tractor?' },
      { icon: '🌱', label: 'Soil check', prompt: 'What soil is in my state and which crops suit it?' },
      { icon: '🚜', label: 'Tractors', prompt: 'Suggest good 45-50 HP tractors under 8 lakh' },
      { icon: '⚙️', label: 'Implements', prompt: 'Suggest a good rotavator for a 45 HP tractor' },
      { icon: '🌾', label: 'Harvesters', prompt: 'Suggest a good combine harvester for paddy' }
    ]
  }
};

export type Strings = typeof strings.hi;
export const getStrings = (lang: UiLang): Strings => strings[lang];
