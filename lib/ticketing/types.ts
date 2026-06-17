// Types mirror the RetroGroove API JSON (retrogroove_api).

export type SeatStatus = 'available' | 'locked' | 'sold' | 'blocked';

export interface Seat {
  id: string;
  label: string | null;
  number: number;
  row: string | null;
  status: SeatStatus;
  table_id: string | null;
  pos_x: number;
  pos_y: number;
}

export interface VenueTable {
  id: string;
  label: string;
  seat_count: number;
  pos_x: number;
  pos_y: number;
  size?: number;
}

export interface PriceBundle {
  quantity: number;
  price: string; // decimal as string, e.g. "70"
}

export interface Section {
  id: string;
  name: string;
  layout_type: 'tables' | 'rows' | 'general';
  capacity: number | null;
  available?: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  tables: VenueTable[];
  seats: Seat[];
  price_bundles: PriceBundle[];
}

export interface TicketEvent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  venue_name: string | null;
  venue_address?: string | null;
  venue_photo_url?: string | null;
  map_url?: string | null;
  starts_at: string;
  status: string;
  flyer_url: string | null;
  canvas_width: number;
  canvas_height: number;
  stage_x?: number;
  stage_y?: number;
  stage_w?: number;
  stage_h?: number;
  sections: Section[];
}

export interface Ticket {
  id: string;
  code: string | null;
  public_token: string | null;
  status: 'pending' | 'valid' | 'used' | 'void';
  qr_svg: string | null;
  checked_in_at: string | null;
  seat_id: string;
  event_name?: string | null;
  event_starts_at?: string | null;
  seat_label?: string | null;
  section_name?: string | null;
}

export interface Order {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'comp' | 'cancelled';
  total: string;
  buyer_email: string;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  expires_at: string | null;
  tickets: Ticket[];
}

export interface Buyer {
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
}
