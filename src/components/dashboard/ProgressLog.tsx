'use client';

import { useEffect, useRef } from 'react';

interface LogEntry {
  msg: string;
  type: string;
}

interface ProgressLogProps {
  done: number;
  total: number;
  label: string;
  logs: LogEntry[];
}

export default function ProgressLog({ done, total, label, logs }: ProgressLogProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="progress-wrap">
      <div className="progress-header">
        <span>{label || 'Iniciando...'}</span>
        <span>{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="log-area" ref={logRef}>
        {logs.map((entry, i) => (
          <div key={i} className={`log-${entry.type || 'info'}`}>
            {entry.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
