// Unified type definitions for the Tractor Junction AI Chat application

export interface Tractor {
  id: number;
  tractors_id: number;
  model_name: string;
  price: string;
  hp: number;
  transmission_type: string;
  wheel_drive: number;
  applications: string;
  overview: string;
  spec_overview: string;
  image: string;
  images?: string;
  brand_name: string;
  brand_slug: string;
  fuel_pump?: string;
  cylinder?: number;
  capacity?: number;
  status: string;
  lang: string;
  brand_id: number;
}

export interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
  metadata?: any;
  tractors?: Tractor[];
  hasTractors?: boolean;
  searchIntent?: string;
}

export interface TractorDisplayProps {
  tractors: Tractor[];
  loading: boolean;
  onViewDetails: (tractor: Tractor) => void;
  baseImageUrl?: string;
}

export interface TractorCardProps {
  tractor: Tractor;
  onViewDetails: (tractor: Tractor) => void;
  baseImageUrl?: string;
}

export interface TractorGridProps {
  tractors: Tractor[];
  loading: boolean;
  onViewDetails: (tractor: Tractor) => void;
  baseImageUrl?: string;
}
