'use client';

import { useQuery } from '@tanstack/react-query';
import type { FetchParams, PricesResponse } from '@/types/prices';

async function fetchPrices(params: FetchParams): Promise<PricesResponse> {
  const qs = new URLSearchParams({
    currency: params.currency,
    adults: params.adults,
    days: String(params.days),
  });
  const res = await fetch(`/api/prices?${qs}`);
  if (!res.ok) throw new Error('Failed to fetch prices');
  return res.json();
}

export function usePrices(params: FetchParams) {
  return useQuery<PricesResponse, Error>({
    queryKey: ['prices', params],
    queryFn: () => fetchPrices(params),
    staleTime: Infinity,
  });
}
