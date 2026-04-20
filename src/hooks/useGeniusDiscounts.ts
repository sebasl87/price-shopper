'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface GeniusDiscount {
  hotel_id: string;
  ratio: number;
  calibrated_at: string;
}

export function useGeniusDiscounts() {
  return useQuery<GeniusDiscount[]>({
    queryKey: ['genius-discounts'],
    queryFn: () => fetch('/api/genius-discounts').then((r) => r.json()),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useGeniusDiscountsMap() {
  const { data } = useGeniusDiscounts();
  const map: Record<string, number> = {};
  for (const d of data ?? []) map[d.hotel_id] = d.ratio;
  return map;
}

export function useSaveGeniusDiscounts() {
  const qc = useQueryClient();
  return async (rows: { hotel_id: string; ratio: number }[]) => {
    const res = await fetch('/api/genius-discounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error('Failed to save');
    qc.invalidateQueries({ queryKey: ['genius-discounts'] });
  };
}
