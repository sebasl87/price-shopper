'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HOTELS, CUR_SYM } from '@/lib/hotels';
import { useGeniusDiscounts, useSaveGeniusDiscounts } from '@/hooks/useGeniusDiscounts';
import type { HotelResult } from '@/types/prices';

interface Props {
  results: HotelResult[];
  currency: string;
  snapshotDate: string | null;
}

function pickDates(results: HotelResult[]): string[] {
  const today = new Date().toISOString().split('T')[0];
  const allDates = (results[0]?.prices ?? [])
    .map((p) => p.date)
    .filter((d) => d > today && d != null);

  const nonMine = results.filter((h) => !HOTELS.find((hh) => hh.id === h.id)?.mine);
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
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export default function GeniusCalibrationPage({ results, currency, snapshotDate }: Props) {
  const { data: saved } = useGeniusDiscounts();
  const saveDiscounts = useSaveGeniusDiscounts();

  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const sym = CUR_SYM[currency] ?? '$';
  const competitorHotels = HOTELS.filter((h) => !h.mine);
  const dates = pickDates(results);

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

  function calcRatio(hotelId: string): number | null {
    const pairs: { api: number; genius: number }[] = [];
    for (const date of dates) {
      const api = getApiPrice(hotelId, date);
      const raw = inputs[hotelId]?.[date];
      const genius = raw ? parseFloat(raw) : null;
      if (api && genius && genius > 0 && genius <= api) {
        pairs.push({ api, genius });
      }
    }
    if (pairs.length === 0) return null;
    return pairs.reduce((s, p) => s + p.genius / p.api, 0) / pairs.length;
  }

  async function handleSave() {
    const rows: { hotel_id: string; ratio: number }[] = [];
    for (const hotel of competitorHotels) {
      const ratio = calcRatio(hotel.id);
      if (ratio !== null) {
        rows.push({ hotel_id: hotel.id, ratio: Math.round(ratio * 10000) / 10000 });
      }
    }
    if (rows.length === 0) return;
    setSaving(true);
    try {
      await saveDiscounts(rows);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const hasInputs = competitorHotels.some((h) =>
    dates.some((d) => !!inputs[h.id]?.[d])
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div>
          <div className="sec-title">Calibración Genius</div>
          <p style={{ color: 'var(--muted)', fontSize: '11px', lineHeight: '1.5' }}>
            Entrá a Booking.com con tu cuenta Genius y anotá el precio que ves
            para estas fechas en cada competidor. El sistema calculará el % de
            descuento Genius por hotel.
          </p>
        </div>

        {snapshotDate && (
          <div className="cache-notice">
            <strong>Datos del snapshot</strong>
            <br />
            Fecha: {snapshotDate}
          </div>
        )}

        {saved && saved.length > 0 && (
          <div>
            <div className="sec-title">Última calibración</div>
            {saved.map((d) => {
              const hotel = HOTELS.find((h) => h.id === d.hotel_id);
              if (!hotel) return null;
              return (
                <div key={d.hotel_id} style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{hotel.name.split(' ')[0]}</span>
                  <span style={{ color: 'var(--text)' }}>{Math.round((1 - d.ratio) * 100)}% desc.</span>
                </div>
              );
            })}
            {saved[0]?.calibrated_at && (
              <div style={{ fontSize: '10px', color: 'var(--dim)', marginTop: '6px' }}>
                {new Date(saved[0].calibrated_at).toLocaleDateString('es-AR', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </div>
            )}
          </div>
        )}

        <Link href="/" style={{ color: 'var(--muted)', fontSize: '11px', textDecoration: 'none' }}>
          ← Volver al dashboard
        </Link>
      </aside>

      <main className="main">
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Calibración semanal de descuentos Genius</h2>
          </div>

          {dates.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📊</div>
              <h3>Sin datos de precios</h3>
              <p>Ejecutá una consulta desde el dashboard primero para tener precios de referencia.</p>
            </div>
          ) : (
            <div className="panel" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: 'var(--muted)', fontWeight: 500, paddingBottom: '10px', paddingRight: '16px', whiteSpace: 'nowrap' }}>
                      Hotel
                    </th>
                    {dates.map((d) => (
                      <th key={d} colSpan={2} style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 500, paddingBottom: '10px', minWidth: '140px' }}>
                        {fmtDate(d)}
                      </th>
                    ))}
                    <th style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 500, paddingBottom: '10px' }}>
                      % Genius
                    </th>
                  </tr>
                  <tr>
                    <td />
                    {dates.map((d) => (
                      <>
                        <td key={d + '-api'} style={{ textAlign: 'center', fontSize: '10px', color: 'var(--dim)', paddingBottom: '8px' }}>API</td>
                        <td key={d + '-genius'} style={{ textAlign: 'center', fontSize: '10px', color: 'var(--dim)', paddingBottom: '8px' }}>Genius</td>
                      </>
                    ))}
                    <td />
                  </tr>
                </thead>
                <tbody>
                  {competitorHotels.map((hotel) => {
                    const ratio = calcRatio(hotel.id);
                    const savedRatio = saved?.find((s) => s.hotel_id === hotel.id)?.ratio;
                    return (
                      <tr key={hotel.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 16px 10px 0', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {hotel.name}
                        </td>
                        {dates.map((date) => {
                          const api = getApiPrice(hotel.id, date);
                          const inputVal = inputs[hotel.id]?.[date] ?? '';
                          const geniusNum = inputVal ? parseFloat(inputVal) : null;
                          const isValid = api && geniusNum && geniusNum > 0 && geniusNum <= api;
                          const isInvalid = geniusNum !== null && (!isValid);
                          return (
                            <>
                              <td key={date + '-api'} style={{ padding: '8px 6px', textAlign: 'center' }}>
                                {api != null ? (
                                  <span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '11px' }}>
                                    {sym}{api.toLocaleString()}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--dim)' }}>—</span>
                                )}
                              </td>
                              <td key={date + '-genius'} style={{ padding: '8px 6px', textAlign: 'center' }}>
                                {api != null ? (
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={inputVal}
                                    onChange={(e) => setInput(hotel.id, date, e.target.value)}
                                    style={{
                                      width: '72px',
                                      background: 'var(--surface)',
                                      border: `1px solid ${isInvalid ? 'var(--error, #f87171)' : 'var(--border)'}`,
                                      borderRadius: '4px',
                                      color: 'var(--text)',
                                      padding: '4px 6px',
                                      fontSize: '11px',
                                      fontFamily: 'var(--mono)',
                                      textAlign: 'center',
                                    }}
                                  />
                                ) : (
                                  <span style={{ color: 'var(--dim)' }}>—</span>
                                )}
                              </td>
                            </>
                          );
                        })}
                        <td style={{ padding: '8px 0 8px 16px', textAlign: 'center' }}>
                          {ratio !== null ? (
                            <span style={{ fontWeight: 600, color: 'var(--accent, #f0b429)', fontFamily: 'var(--mono)' }}>
                              -{Math.round((1 - ratio) * 100)}%
                            </span>
                          ) : savedRatio != null ? (
                            <span style={{ color: 'var(--dim)', fontFamily: 'var(--mono)', fontSize: '11px' }}>
                              -{Math.round((1 - savedRatio) * 100)}%*
                            </span>
                          ) : (
                            <span style={{ color: 'var(--dim)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || savedOk || !hasInputs}
                >
                  {savedOk ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar calibración'}
                </button>
                {saved && saved.length > 0 && !hasInputs && (
                  <span style={{ fontSize: '11px', color: 'var(--dim)' }}>
                    * descuentos guardados previamente
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
