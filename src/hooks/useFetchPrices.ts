'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HOTELS } from '@/lib/hotels';
import { extractPrice } from '@/lib/extractPrice';
import type { FetchParams, HotelResult, PricePoint, PricesResponse } from '@/types/prices';

function getDates(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 1; i <= n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface FetchPricesVars {
  params: FetchParams;
  onProgress: (done: number, total: number, log: string, type?: string) => void;
  abortRef: React.MutableRefObject<boolean>;
}

async function runFetchLoop({
  params,
  onProgress,
  abortRef,
}: FetchPricesVars): Promise<HotelResult[]> {
  const dates = getDates(params.days);
  const total = HOTELS.length * dates.length;
  let done = 0;
  const results: HotelResult[] = [];

  for (const hotel of HOTELS) {
    if (abortRef.current) break;
    const prices: PricePoint[] = [];
    onProgress(done, total, `Iniciando: ${hotel.name}`, 'info');

    for (let i = 0; i < dates.length; i++) {
      if (abortRef.current) break;
      const checkIn = dates[i];
      const d2 = new Date(checkIn + 'T00:00:00');
      d2.setDate(d2.getDate() + 1);
      const checkOut = d2.toISOString().split('T')[0];

      try {
        const qs = new URLSearchParams({
          hotel_id: hotel.id,
          arrival_date: checkIn,
          departure_date: checkOut,
          rec_guest_qty: params.adults,
          currency_code: params.currency,
        });
        const resp = await fetch(`/api/rooms?${qs}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const price = extractPrice(data);
        prices.push({ date: checkIn, price });

        const fmtDate = new Date(checkIn + 'T00:00:00').toLocaleDateString('es-AR', {
          day: '2-digit',
          month: 'short',
        });
        const sym = { USD: '$', EUR: '€', ARS: '$', BRL: 'R$', MXN: '$' }[params.currency] ?? '$';
        const priceStr = price != null ? `${sym}${price.toLocaleString()}` : '—';
        onProgress(done + 1, total, `✓ ${fmtDate} → ${priceStr}`, price != null ? 'ok' : 'warn');
      } catch (e) {
        prices.push({ date: checkIn, price: null });
        const fmtDate = new Date(checkIn + 'T00:00:00').toLocaleDateString('es-AR', {
          day: '2-digit',
          month: 'short',
        });
        onProgress(done + 1, total, `✗ ${fmtDate} → ${(e as Error).message}`, 'err');
      }

      done++;
      await sleep(150);
    }

    results.push({ name: hotel.name, id: hotel.id, mine: hotel.mine, prices });
  }

  return results;
}

export function useFetchPrices() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: FetchPricesVars) => {
      const results = await runFetchLoop(vars);

      if (!vars.abortRef.current && results.length > 0) {
        // Save to Supabase
        const res = await fetch('/api/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            results,
            currency: vars.params.currency,
            adults: vars.params.adults,
            days: vars.params.days,
          }),
        });
        if (res.ok) {
          const snapshot = await res.json();
          return { snapshot, results };
        }
      }

      return { snapshot: null, results };
    },
    onSuccess: (data, vars) => {
      if (data.snapshot) {
        const response: PricesResponse = { snapshot: data.snapshot, fromCache: false };
        qc.setQueryData(['prices', vars.params], response);
      }
    },
  });
}
