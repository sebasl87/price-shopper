export interface PricePoint {
  date: string;
  price: number | null;
}

export interface HotelResult {
  name: string;
  id: string;
  mine: boolean;
  prices: PricePoint[];
}

export interface PriceSnapshot {
  id: string;
  date: string;
  results: HotelResult[];
  currency: string;
  adults: string;
  days: number;
  fetched_at: string;
  fetched_by: string;
}

export interface FetchParams {
  currency: string;
  adults: string;
  days: number;
}

export interface PricesResponse {
  snapshot: PriceSnapshot | null;
  fromCache: boolean;
}
