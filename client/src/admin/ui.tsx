import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DayPoint } from './types';

const nf = new Intl.NumberFormat('ru-RU');
export const fmt = (n: number) => nf.format(n);
export const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.0', '')} млн` : n >= 10_000 ? `${(n / 1000).toFixed(1).replace('.0', '')} тыс.` : fmt(n);

const dayLabel = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

export function StatTile({
  label,
  value,
  delta,
  icon,
  alert,
  href,
}: {
  label: string;
  value: number;
  delta?: string;
  icon?: ReactNode;
  alert?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <p className="label">
        {icon}
        {label}
      </p>
      <span className="value">{compact(value)}</span>
      {delta && <span className="delta">{delta}</span>}
    </>
  );
  const cls = `card tile${alert && value > 0 ? ' alert' : ''}`;
  return href ? (
    <Link to={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Single-series column chart (one hue, no legend — the card title names the series) with a hover tooltip. */
export function BarChart({ data, height = 160, unit }: { data: DayPoint[]; height?: number; unit: [string, string, string] }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  // Draw at the real pixel width so axis text keeps its size instead of being scaled.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const padL = 34;
  const padB = 22;
  const max = Math.max(1, ...data.map((d) => d.count));
  const ticks = useMemo(() => {
    const step = Math.max(1, Math.ceil(max / 3));
    return [0, step, step * 2, step * 3].filter((t) => t <= Math.max(max, step));
  }, [max]);
  const top = ticks[ticks.length - 1] || 1;
  const band = (W - padL) / data.length;
  const barW = Math.min(24, band - 2);
  const y = (v: number) => (height - padB) * (1 - v / top);
  const every = Math.ceil(data.length / Math.max(2, Math.floor(W / 70)));
  const plural = (n: number) => {
    const m10 = n % 10;
    const m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? unit[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? unit[1] : unit[2];
  };
  const h = hover != null ? data[hover] : null;

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <div ref={box} style={{ width: '100%' }} />
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`График: ${data.map((d) => `${dayLabel(d.date)} — ${d.count}`).join(', ')}`}>
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={padL} x2={W} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={padL - 6} y={y(t) + 4} textAnchor="end">
              {compact(t)}
            </text>
          ))}
          {data.map((d, i) =>
            i % every === 0 ? (
              <text key={d.date} x={padL + band * i + band / 2} y={height - 4} textAnchor="middle">
                {dayLabel(d.date)}
              </text>
            ) : null,
          )}
        </g>
        {data.map((d, i) => {
          const x = padL + band * i + (band - barW) / 2;
          const bh = Math.max(0, y(0) - y(d.count));
          const r = Math.min(4, bh);
          // Rounded data-end (top), square at the baseline.
          const path =
            bh > 0
              ? `M${x},${y(0)} V${y(d.count) + r} Q${x},${y(d.count)} ${x + r},${y(d.count)} H${x + barW - r} Q${x + barW},${y(d.count)} ${x + barW},${y(d.count) + r} V${y(0)} Z`
              : '';
          return (
            <g key={d.date}>
              <rect className="hit" x={padL + band * i} y={0} width={band} height={height - padB} onMouseEnter={() => setHover(i)} />
              {path && <path className={`bar${hover === i ? ' active' : ''}`} d={path} />}
            </g>
          );
        })}
      </svg>
      {h && hover != null && (
        <div className="tooltip" style={{ left: 20 + padL + band * hover + band / 2, top: 4 + y(h.count) }}>
          {dayLabel(h.date)}
          <b>
            {fmt(h.count)} {plural(h.count)}
          </b>
        </div>
      )}
    </div>
  );
}

export function HBars({ rows }: { rows: { label: ReactNode; value: number; key: string | number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.key}>
          <span className="ellipsis">{r.label}</span>
          <div className="track">
            <div className="fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="num">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Pager({ page, total, perPage, onPage }: { page: number; total: number; perPage: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(total, page * perPage);
  return (
    <div className="pager">
      <span>
        {fmt(from)}–{fmt(to)} из {fmt(total)}
      </span>
      <span style={{ display: 'flex', gap: 4 }}>
        <button className="icon-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Предыдущая страница">
          <ChevronLeft size={18} />
        </button>
        <button className="icon-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Следующая страница">
          <ChevronRight size={18} />
        </button>
      </span>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)} />;
}

export function SwitchRow({ title, hint, on, onChange }: { title: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="switch-row">
      <div className="text">
        <b>{title}</b>
        {hint && <span>{hint}</span>}
      </div>
      <Toggle on={on} onChange={onChange} label={title} />
    </div>
  );
}

export function AdminHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="admin-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="right">{children}</div>}
    </div>
  );
}

export const LEVEL_TYPE_LABEL = { superadmin: 'Суперадмин', admin: 'Администратор', moderator: 'Модератор', user: 'Пользователь' } as const;
