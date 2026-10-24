import type { ReactNode } from 'react';
import { getCountry } from '../../data/countries';
import { GLOSSARY_BY_ID } from '../../data/glossary';
import { fmtDate } from '../../engine/calendar';
import { ruleAt, verificationLabel } from '../../engine/legal/rules';
import type { GameState, Layer, Verification } from '../../engine/types';
import { useApp } from '../store';

export const nf = (x: number, d = 1) => (Number.isFinite(x) ? x.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
export const pct = (x: number, d = 1) => `${nf(x, d)} %`;
export const signed = (x: number, d = 1) => {
  const r = Math.abs(x) < 0.5 * 10 ** -d ? 0 : x;
  return `${r > 0 ? '+' : ''}${nf(r, d)}`;
};

const LAYER_LABEL: Record<Layer, string> = { juridica: 'Regla jurídica', observada: 'Dato observado', simulacion: 'Simulación' };

export function LayerBadge({ layer }: { layer: Layer }) {
  return <span className={`badge ${layer}`} title={layer === 'simulacion' ? 'Resultado del modelo con supuestos explícitos: no es una predicción del mundo real.' : undefined}>{LAYER_LABEL[layer]}</span>;
}

export function VerifBadge({ v }: { v: Verification }) {
  return <span className={`badge ${v}`}>{verificationLabel(v)}</span>;
}

export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const { openModal } = useApp();
  const e = GLOSSARY_BY_ID[id];
  return (
    <button type="button" className="term" onClick={() => openModal({ kind: 'term', id })} aria-label={`Qué significa ${e?.term ?? id}`}>
      {children ?? e?.term ?? id}
    </button>
  );
}

export function RuleChip({ id, label }: { id: string; label?: string }) {
  const { openModal, game } = useApp();
  const r = game?.rules[id];
  if (!r) return null;
  return (
    <button type="button" className="rulechip" onClick={() => openModal({ kind: 'rule', id })}>
      § {label ?? r.article}
    </button>
  );
}

export function Modal({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn sm" onClick={onClose} aria-label="Cerrar">Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RuleDetail({ game, id }: { game: GameState; id: string }) {
  const { rule, value, amendment } = ruleAt(game, id);
  const c = getCountry(game.country);
  const src = c.sources.find((s) => s.id === rule.sourceId);
  const later = game.amendments.filter((a) => a.ruleId === id);
  return (
    <div className="stack">
      <div className="row"><LayerBadge layer="juridica" /><VerifBadge v={rule.verification} /></div>
      <p>{rule.plain}</p>
      <table className="table">
        <tbody>
          <tr><th>Valor vigente en la partida</th><td>{fmtValue(value)}{amendment ? <span className="badge neutral" style={{ marginLeft: 6 }}>modificado en la partida</span> : null}</td></tr>
          <tr><th>Artículo o sección</th><td>{rule.article}</td></tr>
          <tr><th>Tipo de norma</th><td>{normName(rule.normLevel)}</td></tr>
          <tr><th>Fuente</th><td>{src ? <><a href={src.url} target="_blank" rel="noreferrer">{src.title}</a><div className="small muted">{src.publisher}</div></> : rule.sourceId}</td></tr>
          {src?.published ? <tr><th>Publicación de la fuente</th><td>{fmtDate(src.published)}</td></tr> : null}
          {rule.published ? <tr><th>Publicación</th><td>{fmtDate(rule.published)}</td></tr> : null}
          {rule.inForce || src?.inForce ? <tr><th>Entrada en vigor</th><td>{fmtDate((rule.inForce ?? src?.inForce)!)}</td></tr> : null}
          <tr><th>Vigencia</th><td>{rule.until ? `hasta ${fmtDate(rule.until)}` : 'Vigente en la versión de reglas'} {game.rulesetVersion}</td></tr>
          <tr><th>Fecha de consulta</th><td>{fmtDate(rule.consulted)}</td></tr>
        </tbody>
      </table>
      {rule.verificationNote ? <div className="notice warn small">{rule.verificationNote}</div> : null}
      {rule.verification === 'por-cotejar' ? <div className="notice warn small">Esta regla procede del texto oficial según el conocimiento del equipo, pero no pudo cotejarse directamente en esta versión. El juego la usa identificándola como pendiente de cotejo.</div> : null}
      {rule.verification === 'simplificacion' ? <div className="notice sim small">Simplificación del juego: no es una descripción exacta del derecho vigente.</div> : null}
      {rule.controversy ? <div className="notice info small"><b>Controversia: </b>{rule.controversy}</div> : null}
      {src?.note ? <p className="small muted">{src.note}</p> : null}
      {later.length ? (
        <div>
          <h3>Cambios aprobados en esta partida</h3>
          {later.map((a) => <p key={a.id} className="small">{fmtValue(a.previous)} → <b>{fmtValue(a.value)}</b> desde el {fmtDate(a.effectiveFrom)} ({a.label}). {a.transitional}</p>)}
        </div>
      ) : null}
    </div>
  );
}

export function fmtValue(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v < 1 ? `${nf(v * 100, 0)} %` : nf(v, 2);
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'object' && v) {
    const e = Object.entries(v as Record<string, number>);
    if (e.length > 4) return `Tabla de ${e.length} valores`;
    return e.map(([k, x]) => `${k}: ${x}`).join(', ');
  }
  const map: Record<string, string> = {
    relativa: 'Mayoría relativa', 'absoluta-2v': 'Mayoría absoluta con segunda vuelta', permitida: 'Permitida', 'no-inmediata': 'Prohibida la inmediata', dhondt: 'D’Hondt', hare: 'Cociente Hare y restos mayores',
    'colegio-electoral': 'Colegio Electoral', 'voto-popular': 'Voto popular nacional', provincial: 'Provincial', nacional: 'Única nacional', 'preferencia-varon': 'Preferencia del varón', igualdad: 'Igualdad', parlamentario: 'Parlamentario', presidencial: 'Presidencial',
  };
  return map[String(v)] ?? String(v);
}

export function normName(n: string): string {
  return ({ constitucion: 'Constitución', 'ley-ordinaria': 'Ley ordinaria', 'ley-organica': 'Ley orgánica', 'ley-presupuesto': 'Ley de presupuesto', 'decreto-ejecutivo': 'Decreto del Ejecutivo', 'decreto-ley': 'Decreto-ley', 'reglamento-parlamentario': 'Reglamento parlamentario', estatuto: 'Ley estatal (de cada estado)' } as Record<string, string>)[n] ?? n;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card flat muted small" style={{ textAlign: 'center' }}>{children}</div>;
}

export function Stat({ label, value, delta, layer, good, onClick }: { label: ReactNode; value: string; delta?: number; layer?: Layer; good?: 'up' | 'down'; onClick?: () => void }) {
  const cls = delta === undefined || Math.abs(delta) < 0.005 ? 'muted' : (delta > 0) === (good === 'up') ? 'up' : good ? 'down' : 'muted';
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp className="stat" onClick={onClick} style={onClick ? { textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', width: '100%' } : undefined}>
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
      <div className="row between">
        {delta !== undefined ? <span className={`d ${cls}`}>{signed(delta, 2)} en el mes</span> : <span />}
        {layer ? <LayerBadge layer={layer} /> : null}
      </div>
    </Comp>
  );
}

export function PartyName({ game, id, short }: { game: GameState; id: string; short?: boolean }) {
  const p = game.parties.find((x) => x.id === id);
  if (!p) return <span>{id}</span>;
  return <span><span className="swatch" style={{ background: p.color }} />{short ? p.short : p.name}{p.isPlayer ? ' (usted)' : ''}</span>;
}
