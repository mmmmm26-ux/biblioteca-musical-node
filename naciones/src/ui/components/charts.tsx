import { getCountry } from '../../data/countries';
import type { GameState } from '../../engine/types';
import { nf } from './common';

/** Hemiciclo: un punto por escaño, ordenado de izquierda a derecha según la posición económica del partido. */
export function Hemicycle({ game, seats, majority, label }: { game: GameState; seats: Record<string, number>; majority?: number; label?: string }) {
  const order = game.parties.filter((p) => (seats[p.id] ?? 0) > 0).sort((a, b) => a.econ - b.econ);
  const total = order.reduce((a, p) => a + seats[p.id], 0);
  if (!total) return <div className="muted small">Sin escaños asignados.</div>;
  const rows = Math.max(3, Math.min(12, Math.round(Math.sqrt(total / 2.2))));
  const W = 320, H = 170, R = 150, r0 = 55;
  const radii = Array.from({ length: rows }, (_, i) => r0 + ((R - r0) * (i + 0.5)) / rows);
  const len = radii.reduce((a, r) => a + r, 0);
  const counts = radii.map((r) => Math.round((total * r) / len));
  let diff = total - counts.reduce((a, b) => a + b, 0);
  for (let i = counts.length - 1; diff !== 0; i = (i - 1 + counts.length) % counts.length) {
    counts[i] += Math.sign(diff);
    diff -= Math.sign(diff);
  }
  const pts: { x: number; y: number; a: number }[] = [];
  radii.forEach((r, i) => {
    const n = counts[i];
    for (let k = 0; k < n; k++) {
      const a = Math.PI - (Math.PI * (k + 0.5)) / n;
      pts.push({ x: W / 2 + r * Math.cos(a), y: H - 8 - r * Math.sin(a), a });
    }
  });
  pts.sort((p, q) => q.a - p.a);
  const colors: string[] = [];
  for (const p of order) for (let i = 0; i < seats[p.id]; i++) colors.push(p.color);
  const dot = Math.max(2, Math.min(7, 260 / Math.sqrt(total) / 3.4));
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label ?? `Hemiciclo de ${total} escaños`}>
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={dot} fill={colors[i]} />)}
        <text x={W / 2} y={H - 22} textAnchor="middle" fontSize="20" fontWeight="700" style={{ fill: 'var(--ink)' }}>{total}</text>
        {majority ? <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10">mayoría absoluta: {majority}</text> : null}
      </svg>
      <div className="legend">
        {order.map((p) => <span key={p.id}><span className="swatch" style={{ background: p.color }} />{p.short} {seats[p.id]}</span>)}
      </div>
    </figure>
  );
}

export interface Series { label: string; color: string; values: { x: number; y: number }[]; dashed?: boolean }

export function LineChart({ series, height = 170, yLabel, xLabels }: { series: Series[]; height?: number; yLabel?: string; xLabels?: [string, string] }) {
  const all = series.flatMap((s) => s.values);
  if (all.length < 2) return <div className="muted small">Aún no hay suficientes datos: avance algunos turnos.</div>;
  const W = 340, H = height, L = 38, B = 22, T = 8, Rm = 8;
  let ymin = Math.min(...all.map((p) => p.y));
  let ymax = Math.max(...all.map((p) => p.y));
  if (ymax - ymin < 1e-6) { ymin -= 1; ymax += 1; }
  const pad = (ymax - ymin) * 0.1;
  ymin -= pad; ymax += pad;
  const xmin = Math.min(...all.map((p) => p.x));
  const xmax = Math.max(...all.map((p) => p.x)) || 1;
  const sx = (x: number) => L + ((x - xmin) / Math.max(1, xmax - xmin)) * (W - L - Rm);
  const sy = (y: number) => T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B);
  const ticks = [ymin + pad, (ymin + ymax) / 2, ymax - pad];
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={yLabel ?? 'Gráfico'}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={W - Rm} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={L - 4} y={sy(t) + 3} textAnchor="end" fontSize="10">{nf(t, Math.abs(t) < 10 ? 1 : 0)}</text>
          </g>
        ))}
        {series.map((s) => (
          <polyline key={s.label} fill="none" stroke={s.color} strokeWidth={2.2} strokeDasharray={s.dashed ? '5 4' : undefined} points={s.values.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} />
        ))}
        {xLabels ? <><text x={L} y={H - 6} fontSize="10">{xLabels[0]}</text><text x={W - Rm} y={H - 6} fontSize="10" textAnchor="end">{xLabels[1]}</text></> : null}
      </svg>
      {series.length > 1 ? <div className="legend">{series.map((s) => <span key={s.label}><span className="swatch" style={{ background: s.color }} />{s.label}</span>)}</div> : null}
    </figure>
  );
}

export function Sparkline({ values, color = 'var(--legal)' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const W = 120, H = 28;
  const mn = Math.min(...values), mx = Math.max(...values);
  const sy = (v: number) => H - 3 - ((v - mn) / Math.max(1e-9, mx - mn)) * (H - 6);
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true"><polyline fill="none" stroke={color} strokeWidth="2" points={values.map((v, i) => `${(i / (values.length - 1)) * W},${sy(v)}`).join(' ')} /></svg>;
}

/** Barras de encuesta con intervalo de ±margen de error. */
export function PollBars({ game, shares, moe }: { game: GameState; shares: Record<string, number>; moe: number }) {
  const rows = Object.entries(shares).sort((a, b) => b[1] - a[1]);
  const max = Math.max(50, ...rows.map((r) => r[1] + moe));
  return (
    <div>
      {rows.map(([id, v]) => {
        const p = game.parties.find((x) => x.id === id);
        if (!p) return null;
        return (
          <div key={id} style={{ marginBottom: 8 }}>
            <div className="row between small"><span><span className="swatch" style={{ background: p.color }} />{p.short}{p.isPlayer ? ' (usted)' : ''}</span><span className="mono">{nf(v)} % <span className="muted">(±{nf(moe)})</span></span></div>
            <svg viewBox="0 0 100 10" width="100%" height="12" preserveAspectRatio="none" aria-hidden="true">
              <rect className="bar-bg" x="0" y="0" width="100" height="10" rx="2" />
              <rect x="0" y="1.5" width={(v / max) * 100} height="7" fill={p.color} rx="2" />
              <rect x={(Math.max(0, v - moe) / max) * 100} y="4" width={((Math.min(v + moe, max) - Math.max(0, v - moe)) / max) * 100} height="2" fill="var(--ink)" opacity="0.45" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

/** Mapa de teselas: representación territorial aproximada (no geográfica exacta). */
export function TileMap({ game, colorOf, labelOf, selected, onSelect }: { game: GameState; colorOf: (id: string) => string; labelOf?: (id: string) => string; selected?: string | null; onSelect?: (id: string) => void }) {
  const c = getCountry(game.country);
  const cols = Math.max(...c.territories.map((t) => t.grid[0])) + 1;
  const rows = Math.max(...c.territories.map((t) => t.grid[1])) + 1;
  return (
    <div className="tilemap" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, auto)` }}>
      {c.territories.map((t) => (
        <button key={t.id} type="button" className={`tile${selected === t.id ? ' sel' : ''}`} style={{ gridColumn: t.grid[0] + 1, gridRow: t.grid[1] + 1, background: colorOf(t.id) }} onClick={() => onSelect?.(t.id)} aria-label={t.name} title={t.name}>
          {labelOf ? labelOf(t.id) : t.short}
        </button>
      ))}
    </div>
  );
}
