'use client';

import type { HotelResult } from '@/types/prices';
import { CUR_SYM } from '@/lib/hotels';

interface StatsBarProps {
  results: HotelResult[];
  currency: string;
  isDemo?: boolean;
}

export default function StatsBar({ results, currency, isDemo }: StatsBarProps) {
  const sym = CUR_SYM[currency] ?? '$';
  const allP = results.flatMap((h) =>
    h.prices.filter((p) => p.price != null).map((p) => ({ ...p, hotel: h.name }))
  );

  if (!allP.length) {
    return (
      <div className="stats">
        {['Tarifa más baja', 'Tarifa más alta', 'Promedio general', 'Noches cargadas'].map((label) => (
          <div key={label} className="stat">
            <div className="stat-label">{label}</div>
            <div className="stat-value">—</div>
            <div className="stat-sub">—</div>
          </div>
        ))}
      </div>
    );
  }

  const sorted = [...allP].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = Math.round(allP.reduce((s, p) => s + (p.price ?? 0), 0) / allP.length);

  function fmtDate(s: string) {
    return new Date(s + 'T00:00:00').toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
    });
  }

  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-label">Tarifa más baja</div>
        <div className="stat-value">
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{sym}</span>
          {min.price?.toLocaleString()}
        </div>
        <div className="stat-sub">
          {min.hotel.split(' ')[0]} · {fmtDate(min.date)}
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Tarifa más alta</div>
        <div className="stat-value">
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{sym}</span>
          {max.price?.toLocaleString()}
        </div>
        <div className="stat-sub">
          {max.hotel.split(' ')[0]} · {fmtDate(max.date)}
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Promedio general</div>
        <div className="stat-value">
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{sym}</span>
          {avg.toLocaleString()}
        </div>
        <div className="stat-sub">todos los hoteles</div>
      </div>
      <div className="stat">
        <div className="stat-label">Noches cargadas</div>
        <div className="stat-value">{results[0]?.prices.length ?? 0}</div>
        <div className="stat-sub">
          {isDemo ? (
            <span className="chip chip-demo">Demo</span>
          ) : (
            <span className="chip chip-live">Live</span>
          )}
        </div>
      </div>
    </div>
  );
}
