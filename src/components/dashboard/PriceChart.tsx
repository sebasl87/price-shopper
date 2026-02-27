'use client';

import { useEffect, useRef } from 'react';
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
  type ChartConfiguration,
} from 'chart.js';
import type { HotelResult } from '@/types/prices';
import { COLORS, CUR_SYM } from '@/lib/hotels';

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Tooltip, Filler);

interface PriceChartProps {
  results: HotelResult[];
  currency: string;
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  });
}

export default function PriceChart({ results, currency }: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !results.length) return;
    const sym = CUR_SYM[currency] ?? '$';
    const dates = results[0]?.prices.map((p) => p.date) ?? [];

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: dates.map((d) => fmtDate(d)),
        datasets: results.map((h, i) => ({
          label: h.name,
          data: h.prices.map((p) => p.price),
          borderColor: COLORS[i],
          backgroundColor: COLORS[i] + '18',
          borderWidth: h.mine ? 2.5 : 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3,
          fill: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1d24',
            borderColor: '#2e3340',
            borderWidth: 1,
            titleColor: '#9ca3af',
            bodyColor: '#e8eaf0',
            titleFont: { family: "'Space Mono', monospace", size: 10 },
            bodyFont: { family: "'Space Mono', monospace", size: 11 },
            callbacks: {
              title: (items) => items[0].label,
              label: (item) =>
                ` ${item.dataset.label}: ${item.parsed.y != null ? sym + item.parsed.y.toLocaleString() : '—'}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: '#1a1d24' },
            ticks: {
              color: '#6b7280',
              font: { family: "'Space Mono', monospace", size: 9 },
              maxTicksLimit: 12,
            },
            border: { color: '#252830' },
          },
          y: {
            grid: { color: '#1a1d24' },
            ticks: {
              color: '#6b7280',
              font: { family: "'Space Mono', monospace", size: 10 },
              callback: (v) => sym + Number(v).toLocaleString(),
            },
            border: { color: '#252830' },
          },
        },
      },
    };

    if (chartRef.current) {
      chartRef.current.destroy();
    }
    chartRef.current = new Chart(canvasRef.current, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [results, currency]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title-sm">Comparativa de tarifas</div>
          <div className="panel-title">Tarifa por noche · Habitación doble</div>
        </div>
        <div className="legend">
          {results.map((h, i) => (
            <div key={h.id + i} className="legend-item">
              <div className="legend-dot" style={{ background: COLORS[i] }} />
              {h.name.split(' ').slice(0, 2).join(' ')}
              {h.mine ? ' ★' : ''}
            </div>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ maxHeight: '280px' }} />
    </div>
  );
}
