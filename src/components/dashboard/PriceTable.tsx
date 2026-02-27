'use client';

import { useState } from 'react';
import type { HotelResult } from '@/types/prices';
import { COLORS, CUR_SYM } from '@/lib/hotels';

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface PriceTableProps {
  results: HotelResult[];
  currency: string;
}

type FilterMode = 'all' | 'weekday' | 'weekend';

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  });
}

function isWeekend(s: string) {
  const d = new Date(s + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

export default function PriceTable({ results, currency }: PriceTableProps) {
  const [filter, setFilter] = useState<FilterMode>('all');

  if (!results.length) return null;

  const sym = CUR_SYM[currency] ?? '$';
  const dates = results[0].prices.map((p) => p.date);

  const filtered = dates.filter((d) => {
    if (filter === 'weekend') return isWeekend(d);
    if (filter === 'weekday') return !isWeekend(d);
    return true;
  });

  function exportCSV() {
    let csv = `Fecha,${results.map((h) => `${h.name} (${currency})`).join(',')},Spread\n`;
    dates.forEach((d) => {
      const prices = results.map((h) => h.prices.find((p) => p.date === d)?.price ?? '');
      const valid = prices.filter((p) => p !== '') as number[];
      const sp = valid.length > 1 ? Math.max(...valid) - Math.min(...valid) : '';
      csv += `${d},${prices.join(',')},${sp}\n`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `price-shopper-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div className="table-header">
        <div className="table-title">Detalle por fecha</div>
        <div className="table-controls">
          {(['all', 'weekday', 'weekend'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              className={`filter-btn${filter === mode ? ' active' : ''}`}
              onClick={() => setFilter(mode)}
            >
              {mode === 'all' ? 'Todos' : mode === 'weekday' ? 'Lun–Vie' : 'Fin semana'}
            </button>
          ))}
          <button className="export-btn" onClick={exportCSV}>
            ⬇ CSV
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Día</th>
              {results.map((h, i) => (
                <th key={h.id + i} className="r" style={{ color: COLORS[i] }}>
                  {h.name.split(' ').slice(0, 3).join(' ')}
                  {h.mine ? ' ★' : ''}
                </th>
              ))}
              {results.length > 1 && <th className="r">Spread</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((date) => {
              const wk = isWeekend(date);
              const day = new Date(date + 'T00:00:00').getDay();
              const prices = results.map(
                (h) => h.prices.find((p) => p.date === date)?.price ?? null
              );
              const valid = prices.filter((p) => p != null) as number[];
              const minP = valid.length ? Math.min(...valid) : null;
              const maxP = valid.length ? Math.max(...valid) : null;
              const spread = valid.length > 1 && maxP != null && minP != null ? maxP - minP : null;

              return (
                <tr key={date} className={wk ? 'weekend' : ''}>
                  <td className="muted">{fmtDate(date)}</td>
                  <td className={wk ? 'wk' : 'muted'}>{DAYS_ES[day]}</td>
                  {prices.map((p, idx) => (
                    <td
                      key={idx}
                      className={`r ${p == null ? 'na' : p === minP && valid.length > 1 ? 'best' : 'normal'}`}
                    >
                      {p != null ? `${sym}${p.toLocaleString()}` : '—'}
                    </td>
                  ))}
                  {results.length > 1 && (
                    <td className="spread">
                      {spread != null ? `${sym}${spread.toLocaleString()}` : '—'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
