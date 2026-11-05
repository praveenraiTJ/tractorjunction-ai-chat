// Shapes of the structured blocks produced by server/services/agent/tools/*

export interface ProductItem {
  id: number;
  brand: string | null;
  model: string;
  image?: string | null;
  url: string;
  hp?: string | null;
  pto_hp?: string | null;
  price_lakh?: string | null;
  min_price_lakh?: number | null;
  max_price_lakh?: number | null;
  wheel_drive?: string | null;
  min_emi?: number | null;
  category?: string | null;
  tractor_power?: string | null;
  power_source?: string;
  type?: string | null;
  engine_hp?: string | null;
  cutter_bar?: string | null;
}

export interface WeatherDay {
  date: string;
  code: number;
  temp_max: number;
  temp_min: number;
  rain_mm: number;
  rain_prob: number;
  wind_kmh: number;
}

export interface WeatherData {
  location: { name: string | null; state?: string };
  current: { temp: number; humidity: number; wind_kmh: number; code: number };
  days: WeatherDay[];
  advisories: { level: 'ok' | 'info' | 'warning'; code: string; text: string }[];
}

export interface MandiRow {
  state: string;
  district: string;
  market: string;
  variety: string;
  date: string;
  min: number;
  max: number;
  modal: number;
}

export interface MandiData {
  commodity: string;
  unit: string;
  source: string;
  latest_date: string;
  summary: { markets: number; avg_modal: number; highest: MandiRow; lowest: MandiRow };
  rows: MandiRow[];
}

export interface MuhuratDay {
  date: string;
  vaar: string;
  sunrise: string;
  sunset: string;
  tithi: { paksha: string; name: string };
  nakshatra: { name: string };
  rahu_kaal: string;
  score: number;
  reasons: string[];
  cautions: string[];
}

export interface MuhuratData {
  from: string;
  to: string;
  best: MuhuratDay[];
  note: string;
}

export interface SoilData {
  state: string | null;
  soil_type: string | null;
  profile: {
    hi: string;
    ph: string;
    texture: string;
    nutrients: Record<string, string>;
    crops: string[];
    tips: string[];
  } | null;
  soil_test: Record<string, string> | null;
  tractor_for_crops: { crop: string; hp: string; budget: string }[];
  note: string;
}

export interface SourceItem {
  kind: string;
  title: string;
  date: string | null;
  url: string;
}

export type Block =
  | { type: 'tractors'; data: ProductItem[] }
  | { type: 'implements'; data: ProductItem[] }
  | { type: 'harvesters'; data: ProductItem[] }
  | { type: 'weather'; data: WeatherData }
  | { type: 'mandi_price'; data: MandiData }
  | { type: 'muhurat'; data: MuhuratData }
  | { type: 'soil'; data: SoilData }
  | { type: 'sources'; data: SourceItem[] };

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  blocks: Block[];
  suggestions: string[];
  streaming?: boolean;
  feedback?: 'positive' | 'negative';
}

export interface PageContext {
  url?: string;
  title?: string;
  page_type?: string | null;
  tractor_id?: string | null;
  brand?: string | null;
  model?: string | null;
}

export type UiLang = 'hi' | 'en';
