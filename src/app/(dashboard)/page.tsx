'use client';

import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import HotelList from '@/components/dashboard/HotelList';
import StatsBar from '@/components/dashboard/StatsBar';
import PriceChart from '@/components/dashboard/PriceChart';
import PriceTable from '@/components/dashboard/PriceTable';
import ProgressLog from '@/components/dashboard/ProgressLog';
import { usePrices } from '@/hooks/usePrices';
import { HOTELS } from '@/lib/hotels';
import { extractPrice } from '@/lib/extractPrice';
import type { FetchParams, HotelResult, PricePoint, PricesResponse } from '@/types/prices';

interface LogEntry { msg: string; type: string; }

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

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

const CUR_SYM: Record<string, string> = { USD: '$', EUR: '€', ARS: '$', BRL: 'R$', MXN: '$' };

export default function DashboardPage() {
  const qc = useQueryClient();

  const [currency, setCurrency] = useState('USD');
  const [adults, setAdults] = useState('2');
  const [days, setDays] = useState(90);

  const params: FetchParams = { currency, adults, days };
  const { data, isLoading } = usePrices(params);

  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [liveResults, setLiveResults] = useState<HotelResult[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const abortRef = useRef(false);

  const addLog = useCallback((msg: string, type = 'info') => {
    setLogs((prev) => [...prev, { msg, type }]);
  }, []);

  async function startFetch(force = false) {
    if (!force && data?.snapshot) return;

    abortRef.current = false;
    setIsFetching(true);
    setIsDemo(false);
    setLogs([]);
    setLiveResults([]);

    const dateList = getDates(days);
    const total = HOTELS.length * dateList.length;
    let done = 0;
    const results: HotelResult[] = [];
    const sym = CUR_SYM[currency] ?? '$';

    for (const hotel of HOTELS) {
      if (abortRef.current) break;
      const prices: PricePoint[] = [];
      addLog(`Iniciando: ${hotel.name}`, 'info');
      setProgress({ done, total, label: `Hotel: ${hotel.name}` });

      for (let i = 0; i < dateList.length; i++) {
        if (abortRef.current) break;
        const checkIn = dateList[i];
        const d2 = new Date(checkIn + 'T00:00:00');
        d2.setDate(d2.getDate() + 1);
        const checkOut = d2.toISOString().split('T')[0];

        try {
          const qs = new URLSearchParams({
            hotel_id: hotel.id,
            arrival_date: checkIn,
            departure_date: checkOut,
            rec_guest_qty: adults,
            currency_code: currency,
          });
          const resp = await fetch(`/api/rooms?${qs}`);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const apiData = await resp.json();
          const price = extractPrice(apiData);
          prices.push({ date: checkIn, price });

          const fmtDate = new Date(checkIn + 'T00:00:00').toLocaleDateString('es-AR', {
            day: '2-digit', month: 'short',
          });
          const priceStr = price != null ? `${sym}${price.toLocaleString()}` : '—';
          done++;
          setProgress((p) => ({ ...p, done }));
          addLog(`✓ ${fmtDate} → ${priceStr}`, price != null ? 'ok' : 'warn');
        } catch (e) {
          prices.push({ date: checkIn, price: null });
          const fmtDate = new Date(checkIn + 'T00:00:00').toLocaleDateString('es-AR', {
            day: '2-digit', month: 'short',
          });
          done++;
          setProgress((p) => ({ ...p, done }));
          addLog(`✗ ${fmtDate} → ${(e as Error).message}`, 'err');
        }

        await sleep(150);
      }

      results.push({ name: hotel.name, id: hotel.id, mine: hotel.mine, prices });
      setLiveResults([...results]);
    }

    if (!abortRef.current && results.length > 0) {
      try {
        const res = await fetch('/api/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results, currency, adults, days }),
        });
        if (res.ok) {
          const snapshot = await res.json();
          const response: PricesResponse = { snapshot, fromCache: false };
          qc.setQueryData(['prices', params], response);
        }
      } catch (e) {
        console.error('Failed to save snapshot:', e);
      }
    }

    setIsFetching(false);
  }

  function stopFetch() {
    abortRef.current = true;
    setIsFetching(false);
  }

  function loadDemo() {
    const bases = [180, 140, 120, 160, 200];
    const dateList = getDates(days);
    const demoResults: HotelResult[] = HOTELS.map((h, i) => ({
      name: h.name,
      id: 'demo',
      mine: h.mine,
      prices: dateList.map((date, j) => {
        const s = Math.sin((j / 90) * Math.PI) * 0.25;
        const n = (Math.random() - 0.5) * 0.18;
        const d = new Date(date + 'T00:00:00');
        const wk = d.getDay() === 0 || d.getDay() === 6 ? 0.12 : 0;
        return { date, price: Math.max(Math.round(bases[i] * (1 + s + n + wk)), 60) };
      }),
    }));
    setLiveResults(demoResults);
    setIsDemo(true);
  }

  const displayResults = liveResults.length ? liveResults : (data?.snapshot?.results ?? []);
  const displayCurrency = liveResults.length ? currency : (data?.snapshot?.currency ?? currency);
  const hasCachedData = !!data?.snapshot && !liveResults.length && !isDemo;

  if (isLoading) {
    return (
      <div className="app">
        <aside className="sidebar">
          <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '11px' }}>
            Cargando...
          </div>
        </aside>
        <main className="main">
          <StatsBar results={[]} currency={currency} />
          <div className="content">
            <div className="empty">
              <div className="empty-icon">⏳</div>
              <h3>Cargando datos...</h3>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        {/* Config */}
        <div>
          <div className="sec-title">Configuración</div>
          <label>Moneda</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={isFetching}>
            <option value="USD">USD — Dólar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="ARS">ARS — Peso ARG</option>
            <option value="BRL">BRL — Real</option>
            <option value="MXN">MXN — Peso MEX</option>
          </select>

          <label>Adultos / habitación</label>
          <select value={adults} onChange={(e) => setAdults(e.target.value)} disabled={isFetching}>
            <option value="2">2 adultos (doble)</option>
            <option value="1">1 adulto (single)</option>
          </select>

          <label>Días a consultar</label>
          <input
            type="number"
            value={days}
            min={7}
            max={180}
            onChange={(e) => setDays(parseInt(e.target.value) || 90)}
            disabled={isFetching}
          />
        </div>

        {/* Hotels */}
        <div>
          <div className="sec-title">Hoteles comparados</div>
          <HotelList />
        </div>

        {/* Cache notice */}
        {hasCachedData && (
          <div className="cache-notice">
            <strong>Datos en caché</strong><br />
            Última consulta: {data!.snapshot!.date}<br />
            Consultado por: {data!.snapshot!.fetched_by}<br />
            Se actualizarán automáticamente mañana.
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isFetching ? (
            <button className="btn btn-stop" onClick={stopFetch}>
              ■ Detener
            </button>
          ) : (
            <>
              {!hasCachedData ? (
                <button className="btn btn-primary" onClick={() => startFetch(false)}>
                  ▶ Iniciar consulta
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={() => startFetch(true)}>
                  ↻ Forzar actualización
                </button>
              )}
              <button className="btn btn-secondary" onClick={loadDemo}>
                ← Datos demo
              </button>
            </>
          )}
        </div>

        {/* Progress */}
        {isFetching && (
          <div>
            <ProgressLog
              done={progress.done}
              total={progress.total}
              label={progress.label}
              logs={logs}
            />
          </div>
        )}
      </aside>

      <main className="main">
        <StatsBar results={displayResults} currency={displayCurrency} isDemo={isDemo} />

        <div className="content">
          {displayResults.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📊</div>
              <h3>Sin datos aún</h3>
              <p>
                Presioná <strong>Iniciar consulta</strong>. Los 5 hoteles están preconfigurados y
                la API key está en el servidor.
              </p>
            </div>
          ) : (
            <>
              <PriceChart results={displayResults} currency={displayCurrency} />
              <PriceTable results={displayResults} currency={displayCurrency} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
