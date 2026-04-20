'use client';

import { useState } from 'react';
import type { HotelResult } from '@/types/prices';
import { HOTELS, CUR_SYM } from '@/lib/hotels';
import { useGeniusDiscounts, useSaveGeniusDiscounts } from '@/hooks/useGeniusDiscounts';

interface Props {
  results: HotelResult[];
  currency: string;
}

function pickDates(results: HotelResult[]): string[] {
  const today = new Date().toISOString().split('T')[0];
  const nonMine = results.filter((h) => !HOTELS.find((hh) => hh.id === h.id)?.mine);
  const allDates = (results[0]?.prices ?? [])
    .map((p) => p.date)
    .filter((d) => d > today);

  // Prefer dates where all non-mine hotels have a price
  const good = allDates.filter((d) =>
    nonMine.every((h) => h.prices.find((p) => p.date === d)?.price != null)
  );
  const pool = good.length >= 3 ? good : allDates;
  if (pool.length === 0) return [];
  const step = Math.max(1, Math.floor(pool.length / 3));
  return [pool[0], pool[step], pool[Math.min(step * 2, pool.length - 1)]].filter(
    (v, i, a) => a.indexOf(v) === i
  );
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  });
}

export default function GeniusCalibration({ results, currency }: Props) {
  const { data: saved } = useGeniusDiscounts();
  const saveDiscounts = useSaveGeniusDiscounts();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved2, setSaved2] = useState(false);

  const sym = CUR_SYM[currency] ?? '$';
  const competitorHotels = HOTELS.filter((h) => !h.mine);
  const dates = pickDates(results);

  // inputs[hotel_id][date] = string
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});

  function setInput(hotelId: string, date: string, val: string) {
    setInputs((prev) => ({
      ...prev,
      [hotelId]: { ...(prev[hotelId] ?? {}), [date]: val },
    }));
  }

  function getApiPrice(hotelId: string, date: string): number | null {
    const hotel = results.find((h) => h.id === hotelId);
    return hotel?.prices.find((p) => p.date === date)?.price ?? null;
  }

  async function handleSave() {
    const rows: { hotel_id: string; ratio: number }[] = [];

    for (const hotel of competitorHotels) {
      const pairs: { api: number; genius: number }[] = [];
      for (const date of dates) {
        const api = getApiPrice(hotel.id, date);
        const raw = inputs[hotel.id]?.[date];
        const genius = raw ? parseFloat(raw) : null;
        if (api && genius && genius > 0 && genius <= api) {
          pairs.push({ api, genius });
        }
      }
      if (pairs.length > 0) {
        const ratio =
          pairs.reduce((s, p) => s + p.genius / p.api, 0) / pairs.length;
        rows.push({ hotel_id: hotel.id, ratio: Math.round(ratio * 10000) / 10000 });
      }
    }

    if (rows.length === 0) return;
    setSaving(true);
    try {
      await saveDiscounts(rows);
      setSaved2(true);
      setTimeout(() => { setSaved2(false); setOpen(false); }, 1500);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    const lastCalibrated = saved?.[0]?.calibrated_at;
    return (
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>
        ◎ Calibrar Genius
        {lastCalibrated && (
          <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '6px' }}>
            {new Date(lastCalibrated).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="panel" style={{ padding: '12px', fontSize: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <strong>Calibración Genius</strong>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
      </div>

      <p style={{ color: 'var(--muted)', marginBottom: '10px', lineHeight: '1.4' }}>
        Entrá a B.com con tu cuenta Genius e ingresá los precios que ves para estas fechas:
      </p>

      {dates.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No hay datos suficientes. Ejecutá una consulta primero.</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: 'var(--muted)', fontWeight: 400, paddingBottom: '6px' }}>Hotel</th>
                {dates.map((d) => (
                  <th key={d} style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 400, paddingBottom: '6px' }}>
                    {fmtDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {competitorHotels.map((hotel) => {
                const result = results.find((r) => r.id === hotel.id);
                if (!result) return null;
                return (
                  <tr key={hotel.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 0', paddingRight: '8px', whiteSpace: 'nowrap' }}>
                      {hotel.name.split(' ')[0]}
                    </td>
                    {dates.map((date) => {
                      const api = getApiPrice(hotel.id, date);
                      return (
                        <td key={date} style={{ padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>
                          {api != null ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span style={{ color: 'var(--muted)', fontSize: '10px' }}>API {sym}{api}</span>
                              <input
                                type="number"
                                placeholder="Genius"
                                value={inputs[hotel.id]?.[date] ?? ''}
                                onChange={(e) => setInput(hotel.id, date, e.target.value)}
                                style={{
                                  width: '64px',
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '4px',
                                  color: 'var(--text)',
                                  padding: '3px 5px',
                                  fontSize: '11px',
                                  textAlign: 'center',
                                }}
                              />
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleSave}
            disabled={saving || saved2}
          >
            {saved2 ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar calibración'}
          </button>
        </>
      )}
    </div>
  );
}
