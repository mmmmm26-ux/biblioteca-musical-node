import { useMemo, useState } from 'react';
import { getCountry } from '../../data/countries';
import { ISSUES } from '../../data/segments';
import { daysBetween, fmtDate } from '../../engine/calendar';
import { dhondt } from '../../engine/electoral/allocation';
import { nationalEstimate, seatMap } from '../../engine/electoral/elections';
import { campaignAction, campaignOpen, nextElection, playerParty, type CampaignAction } from '../../engine/game';
import type { IssueId } from '../../engine/types';
import { LineChart, PollBars, TileMap } from '../components/charts';
import { Empty, LayerBadge, nf, Term } from '../components/common';
import { useApp, useGame } from '../store';

function mix(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (x: number) => Math.round(x + (230 - x) * (1 - t));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

export function Campaign() {
  const game = useGame();
  const { setGame, notify } = useApp();
  const c = getCountry(game.country);
  const me = playerParty(game);
  const [sel, setSel] = useState<string[]>([]);
  const [focus, setFocus] = useState<IssueId[]>(game.campaign.focus.length ? game.campaign.focus : playerParty(game).priorities.slice(0, 2));
  const est = useMemo(() => nationalEstimate(game), [game]);
  const ne = nextElection(game);
  const open = campaignOpen(game);
  const poll = game.polls[game.polls.length - 1];
  const act = (a: CampaignAction) => {
    const r = campaignAction(game, a);
    notify(r.message);
    if (r.game !== game) setGame(r.game);
    setSel([]);
  };
  const turnKey = (k: string) => game.campaign.visited.includes(`${k}-${game.counters.turn}`);
  const giras = game.campaign.visited.filter((x) => x.startsWith(`gira-${game.counters.turn}`)).length;
  // proyección de escaños (modelo, sin ruido) para cámaras proporcionales
  const proj = useMemo(() => {
    const ch = c.chambers.find((x) => x.system === 'dhondt');
    if (!ch) return null;
    const seats = seatMap(game, ch.id, ne?.date ?? game.date);
    const out: Record<string, number> = {};
    for (const t of c.territories) {
      const v = Object.fromEntries(Object.entries(est.byTerritory[t.id] ?? {}).map(([p, s]) => [p, s * 1000]));
      for (const [p, k] of Object.entries(dhondt(v, seats[t.id] ?? 0, game.country === 'es' ? 0.03 : 0).seats)) out[p] = (out[p] ?? 0) + k;
    }
    return { ch, out };
  }, [game, est, c, ne]);
  const history = game.polls.filter((p) => p.shares[me.id] !== undefined);
  if (!open) return <Empty>La campaña se abre unos cuatro meses antes de cada elección. {ne ? `Próximas elecciones: ${fmtDate(ne.date)}.` : ''}</Empty>;
  return (
    <div className="stack">
      <div className="card">
        <div className="row between"><h2 style={{ margin: 0 }}>Campaña</h2><LayerBadge layer="simulacion" /></div>
        <p className="small">Elecciones: <b>{ne ? fmtDate(ne.date) : '—'}</b> ({ne ? daysBetween(game.date, ne.date) : 0} días) · Fondos de campaña: <b>{me.funds}</b> · Popularidad del partido: {nf(me.valence, 2)}</p>
        <p className="small muted">Los efectos de cada acción son parámetros del juego, no estimaciones de la ciencia política. Las demás candidaturas también hacen campaña.</p>
      </div>

      <div className="card">
        <h3>1. Gira territorial (máx. 3 por turno · 5 fondos cada una)</h3>
        <TileMap game={game} colorOf={(id) => (sel.includes(id) ? 'var(--gold)' : mix(me.color, Math.min(1, 0.25 + (est.byTerritory[id]?.[me.id] ?? 0) * 2.5)))} selected={null} onSelect={(id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length + giras < 3 ? [...sel, id] : sel)} />
        <p className="small muted">Color: su intención de voto estimada en cada territorio (más intenso = más apoyo). Toque para elegir. Visitas este turno: {giras}/3.</p>
        <button className="btn primary" disabled={!sel.length} onClick={() => act({ kind: 'gira', territories: sel })}>Visitar {sel.length ? sel.map((s) => c.territories.find((t) => t.id === s)?.short).join(', ') : ''}</button>
      </div>

      <div className="card">
        <h3>2. Mensaje de campaña (dos temas)</h3>
        <div className="chips">{(Object.keys(ISSUES) as IssueId[]).map((i) => <button key={i} className={`chip${focus.includes(i) ? ' on' : ''}`} onClick={() => setFocus(focus.includes(i) ? focus.filter((x) => x !== i) : focus.length < 2 ? [...focus, i] : focus)}>{ISSUES[i].name}</button>)}</div>
        <p className="small muted">Reforzar temas que coinciden con sus prioridades atrae a los electores que más los valoran. Su programa: {me.priorities.map((p) => ISSUES[p].name).join(', ')}.</p>
        <button className="btn" disabled={turnKey('mensaje') || !focus.length} onClick={() => act({ kind: 'mensaje', issues: focus })}>{turnKey('mensaje') ? 'Mensaje ya fijado este turno' : 'Fijar mensaje'}</button>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>3. Publicidad</h3>
          <p className="small muted">Rendimientos decrecientes: duplicar el gasto no duplica el efecto.</p>
          <div className="row">{[10, 20, 30].map((a) => <button key={a} className="btn sm" disabled={turnKey('publicidad') || me.funds < a} onClick={() => act({ kind: 'publicidad', amount: a })}>{a} fondos</button>)}</div>
        </div>
        <div className="card">
          <h3>4. Debate electoral</h3>
          <p className="small muted">Una vez por campaña. Tiene un componente aleatorio: puede salir bien o mal.</p>
          <button className="btn" disabled={game.campaign.debateDone} onClick={() => act({ kind: 'debate' })}>{game.campaign.debateDone ? 'Ya participó' : 'Participar'}</button>
        </div>
      </div>

      <div className="card">
        <h3>5. Apoyos de organizaciones</h3>
        <p className="small muted">Aportan fondos y algo de popularidad, pero a cambio adquiere un compromiso público.</p>
        <div className="row">{game.groups.map((g) => <button key={g.id} className="btn sm" disabled={turnKey('alianza')} onClick={() => act({ kind: 'alianza', group: g.id })}>{g.name}</button>)}</div>
        {me.promises.length ? <p className="small" style={{ marginTop: 8 }}>Sus compromisos: {me.promises.join(' · ')}</p> : null}
      </div>

      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Encuestas</h3><LayerBadge layer="simulacion" /></div>
        {poll ? <>
          <p className="small muted">{poll.label} · {fmtDate(poll.date)} · muestra simulada de {poll.sample} personas · <Term id="margen-error" /> ±{nf(poll.moe)} puntos.</p>
          <PollBars game={game} shares={poll.shares} moe={poll.moe} />
          <p className="small muted">El margen indica sólo el error por azar de la muestra. Las encuestas del juego se generan a partir del modelo y pueden fallar.</p>
        </> : <Empty>Sin encuestas todavía.</Empty>}
        {history.length > 1 ? <LineChart series={game.parties.filter((p) => history.some((h) => (h.shares[p.id] ?? 0) > 3)).map((p) => ({ label: p.short, color: p.color, values: history.map((h, i) => ({ x: i, y: h.shares[p.id] ?? 0 })) }))} yLabel="Intención de voto (%)" /> : null}
      </div>

      {proj ? (
        <div className="card">
          <div className="row between"><h3 style={{ margin: 0 }}>Proyección de escaños ({proj.ch.short})</h3><LayerBadge layer="simulacion" /></div>
          <p className="small muted">Reparto con <Term id="dhondt" /> por circunscripción sobre la estimación del modelo, sin margen de error. No es un pronóstico.</p>
          <div className="chips">{Object.entries(proj.out).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([p, v]) => <span key={p} className="chip"><span className="swatch" style={{ background: game.parties.find((x) => x.id === p)?.color }} />{game.parties.find((x) => x.id === p)?.short} {v}</span>)}</div>
        </div>
      ) : null}
    </div>
  );
}
