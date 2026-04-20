"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useAuth } from "@/hooks/useAuth";
import HotelList from "@/components/dashboard/HotelList";
import StatsBar from "@/components/dashboard/StatsBar";
import PriceChart from "@/components/dashboard/PriceChart";
import PriceTable from "@/components/dashboard/PriceTable";
import ProgressLog from "@/components/dashboard/ProgressLog";
import { usePrices } from "@/hooks/usePrices";
import { HOTELS } from "@/lib/hotels";
import { extractPrice } from "@/lib/extractPrice";
import type {
  FetchParams,
  HotelResult,
  PricesResponse,
} from "@/types/prices";

interface LogEntry {
  msg: string;
  type: string;
}

function getDates(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 1; i <= n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const CUR_SYM: Record<string, string> = {
  USD: "$",
  EUR: "€",
  ARS: "$",
  BRL: "R$",
  MXN: "$",
};

export default function DashboardPage() {
  const qc = useQueryClient();
  const { data: authUser } = useAuth();
  const isAdmin = authUser?.email === 'sebastian.loguzzo@gmail.com';

  const [currency, setCurrency] = useState("USD");
  const [adults, setAdults] = useState("2");
  const [days, setDays] = useState(60);

  const params: FetchParams = { currency, adults, days };
  const { data, isLoading } = usePrices(params);

  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [liveResults, setLiveResults] = useState<HotelResult[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const abortRef = useRef(false);

  // Feature Flag: enable-start-consultation
  const isStartEnabled = useFeatureFlag("enable-start-consultation");
  // Feature Flag: enable-demo
  const isDemoEnabled = useFeatureFlag("enable-demo");
  // Feature Flag: enable-patch-missing
  const isPatchEnabled = useFeatureFlag("enable-patch-missing");

  const addLog = useCallback((msg: string, type = "info") => {
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
    const total = dateList.length;
    let done = 0;
    const sym = CUR_SYM[currency] ?? "$";

    // Pre-build results array so all hotels are present from the start
    const results: HotelResult[] = HOTELS.map((hotel) => ({
      name: hotel.name,
      id: hotel.id,
      mine: hotel.mine,
      prices: [],
    }));

    for (let i = 0; i < dateList.length; i++) {
      if (abortRef.current) break;

      const checkIn = dateList[i];
      const d2 = new Date(checkIn + "T00:00:00");
      d2.setDate(d2.getDate() + 1);
      const checkOut = d2.toISOString().split("T")[0];
      const fmtDate = new Date(checkIn + "T00:00:00").toLocaleDateString(
        "es-AR",
        { day: "2-digit", month: "short" },
      );

      setProgress({ done, total, label: `Fecha: ${fmtDate}` });

      // Fetch all hotels for this date in parallel, staggered to avoid rate-limit bursts
      await Promise.allSettled(
        HOTELS.map(async (hotel, hotelIdx) => {
          if (hotelIdx > 0) await sleep(hotelIdx * 80);
          const qs = new URLSearchParams({
            hotel_id: hotel.id,
            arrival_date: checkIn,
            departure_date: checkOut,
            rec_guest_qty: adults,
            currency_code: currency,
          });

          const MAX_RETRIES = 2;
          let price: number | null = null;
          let lastError = "";

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (attempt > 0) {
              addLog(
                `↻ ${hotel.name.split(" ")[0]} ${fmtDate} reintento ${attempt}…`,
                "info",
              );
              await sleep(800 * attempt); // 800ms, 1600ms
            }
            try {
              const resp = await fetch(`/api/rooms?${qs}`);
              if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
              const apiData = await resp.json();
              price = extractPrice(apiData);
              if (price !== null) break; // got a valid price, stop retrying
              lastError = "sin tarifa";
            } catch (e) {
              lastError = (e as Error).message;
              if (!lastError.includes("429") && attempt === 0) break; // non-rate-limit error, don't retry
            }
          }

          results[hotelIdx].prices.push({ date: checkIn, price });
          const priceStr = price != null ? `${sym}${price.toLocaleString()}` : "—";
          addLog(
            `${price != null ? "✓" : "✗"} ${hotel.name.split(" ")[0]} ${fmtDate} → ${price != null ? priceStr : lastError}`,
            price != null ? "ok" : "warn",
          );
        }),
      );

      done++;
      setProgress((p) => ({ ...p, done }));
      setLiveResults(results.map((r) => ({ ...r, prices: [...r.prices] })));

      await sleep(150);
    }

    if (!abortRef.current && results.length > 0) {
      try {
        const res = await fetch("/api/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ results, currency, adults, days }),
        });
        if (res.ok) {
          const snapshot = await res.json();
          const response: PricesResponse = { snapshot, fromCache: false };
          qc.setQueryData(["prices", params], response);
        }
      } catch (e) {
        console.error("Failed to save snapshot:", e);
      }
    }

    setIsFetching(false);
  }

  function stopFetch() {
    abortRef.current = true;
    setIsFetching(false);
  }

  async function patchMissing() {
    if (!data?.snapshot) return;

    abortRef.current = false;
    setIsFetching(true);
    setLogs([]);

    // Deep-clone snapshot results so we don't mutate cached data
    const results: HotelResult[] = data.snapshot.results.map((h) => ({
      ...h,
      prices: h.prices.map((p) => ({ ...p })),
    }));

    const sym = CUR_SYM[currency] ?? "$";

    // Collect all null entries grouped by date for efficient batching
    const nullsByDate = new Map<string, number[]>();
    results.forEach((hotel, hotelIdx) => {
      hotel.prices.forEach((p) => {
        if (p.price === null) {
          if (!nullsByDate.has(p.date)) nullsByDate.set(p.date, []);
          nullsByDate.get(p.date)!.push(hotelIdx);
        }
      });
    });

    const dateList = [...nullsByDate.keys()].sort();
    const total = dateList.length;
    let done = 0;

    setProgress({ done: 0, total, label: "" });

    for (const checkIn of dateList) {
      if (abortRef.current) break;

      const d2 = new Date(checkIn + "T00:00:00");
      d2.setDate(d2.getDate() + 1);
      const checkOut = d2.toISOString().split("T")[0];
      const fmtDate = new Date(checkIn + "T00:00:00").toLocaleDateString(
        "es-AR",
        { day: "2-digit", month: "short" },
      );
      const hotelIdxs = nullsByDate.get(checkIn)!;

      setProgress({ done, total, label: `Parcheando: ${fmtDate}` });

      await Promise.allSettled(
        hotelIdxs.map(async (hotelIdx, i) => {
          if (i > 0) await sleep(i * 80);
          const hotel = HOTELS[hotelIdx];
          const qs = new URLSearchParams({
            hotel_id: hotel.id,
            arrival_date: checkIn,
            departure_date: checkOut,
            rec_guest_qty: adults,
            currency_code: currency,
          });

          const MAX_RETRIES = 2;
          let price: number | null = null;
          let lastError = "";

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (attempt > 0) {
              addLog(
                `↻ ${hotel.name.split(" ")[0]} ${fmtDate} reintento ${attempt}…`,
                "info",
              );
              await sleep(800 * attempt);
            }
            try {
              const resp = await fetch(`/api/rooms?${qs}`);
              if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
              const apiData = await resp.json();
              price = extractPrice(apiData);
              if (price !== null) break;
              lastError = "sin tarifa";
            } catch (e) {
              lastError = (e as Error).message;
              if (!lastError.includes("429") && attempt === 0) break;
            }
          }

          const entry = results[hotelIdx].prices.find((p) => p.date === checkIn);
          if (entry) entry.price = price;
          const priceStr = price != null ? `${sym}${price.toLocaleString()}` : "—";
          addLog(
            `${price != null ? "✓" : "✗"} ${hotel.name.split(" ")[0]} ${fmtDate} → ${price != null ? priceStr : lastError}`,
            price != null ? "ok" : "warn",
          );
        }),
      );

      done++;
      setProgress((p) => ({ ...p, done }));
      await sleep(150);
    }

    if (!abortRef.current) {
      try {
        const res = await fetch("/api/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ results, currency, adults, days }),
        });
        if (res.ok) {
          const snapshot = await res.json();
          qc.setQueryData(["prices", params], { snapshot, fromCache: false });
          setLiveResults(results);
        }
      } catch (e) {
        console.error("Failed to save patched snapshot:", e);
      }
    }

    setIsFetching(false);
  }

  function loadDemo() {
    if (isDemoEnabled === false) return;
    const bases = [180, 140, 120, 160, 200];
    const dateList = getDates(days);
    const demoResults: HotelResult[] = HOTELS.map((h, i) => ({
      name: h.name,
      id: "demo",
      mine: h.mine,
      prices: dateList.map((date, j) => {
        const s = Math.sin((j / 90) * Math.PI) * 0.25;
        const n = (Math.random() - 0.5) * 0.18;
        const d = new Date(date + "T00:00:00");
        const wk = d.getDay() === 0 || d.getDay() === 6 ? 0.12 : 0;
        return {
          date,
          price: Math.max(Math.round(bases[i] * (1 + s + n + wk)), 60),
        };
      }),
    }));
    setLiveResults(demoResults);
    setIsDemo(true);
  }

  const displayResults = liveResults.length
    ? liveResults
    : (data?.snapshot?.results ?? []);
  const displayCurrency = liveResults.length
    ? currency
    : (data?.snapshot?.currency ?? currency);
  const hasCachedData = !!data?.snapshot && !liveResults.length && !isDemo;

  if (isLoading) {
    return (
      <div className="app">
        <aside className="sidebar">
          <div
            style={{
              color: "var(--muted)",
              fontFamily: "var(--mono)",
              fontSize: "11px",
            }}
          >
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
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={isFetching}
          >
            <option value="USD">USD — Dólar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="ARS">ARS — Peso ARG</option>
            <option value="BRL">BRL — Real</option>
            <option value="MXN">MXN — Peso MEX</option>
          </select>

          <label>Adultos / habitación</label>
          <select
            value={adults}
            onChange={(e) => setAdults(e.target.value)}
            disabled={isFetching}
          >
            <option value="2">2 adultos (doble)</option>
            <option value="1">1 adulto (single)</option>
          </select>

          <label>Días a consultar</label>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            disabled={isFetching}
          >
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
            <option value={45}>45 días</option>
            <option value={60}>60 días</option>
          </select>
        </div>

        {/* Hotels */}
        <div>
          <div className="sec-title">Hoteles comparados</div>
          <HotelList />
        </div>

        {/* Cache notice */}
        {hasCachedData && (
          <div className="cache-notice">
            <strong>Datos en caché</strong>
            <br />
            Última consulta: {data!.snapshot!.date}
            <br />
            Consultado por: {data!.snapshot!.fetched_by}
            <br />
            Se actualizarán automáticamente mañana.
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {isFetching ? (
            <button className="btn btn-stop" onClick={stopFetch}>
              ■ Detener
            </button>
          ) : (
            <>
              {!hasCachedData && isStartEnabled !== false && (
                <button
                  className="btn btn-primary"
                  onClick={() => startFetch(false)}
                >
                  ▶ Iniciar consulta
                </button>
              )}
              {hasCachedData && isStartEnabled !== false && (
                <button
                  className="btn btn-secondary"
                  onClick={() => startFetch(true)}
                >
                  ↻ Forzar actualización
                </button>
              )}
              {hasCachedData && isPatchEnabled !== false && (
                <button
                  className="btn btn-secondary"
                  onClick={patchMissing}
                >
                  ⬡ Completar faltantes
                </button>
              )}
              {isDemoEnabled !== false && (
                <button className="btn btn-secondary" onClick={loadDemo}>
                  ← Datos demo
                </button>
              )}
            </>
          )}
        </div>

        {/* Genius Calibration link — admin only */}
        {isAdmin && !isFetching && (
          <Link
            href="/calibracion"
            style={{
              display: 'block',
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              fontSize: '11px',
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            ◎ Calibrar Genius
          </Link>
        )}

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
        <StatsBar
          results={displayResults}
          currency={displayCurrency}
          isDemo={isDemo}
        />

        <div className="content">
          {displayResults.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📊</div>
              <h3>Sin datos aún</h3>
              <p>
                Presioná <strong>Iniciar consulta</strong>. Los 5 hoteles están
                preconfigurados y la API key está en el servidor.
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
