import { useState } from 'react';
import { getCountry } from '../../data/countries';
import { fmtDate } from '../../engine/calendar';
import { dhondt, hareLargestRemainder } from '../../engine/electoral/allocation';
import { str, num } from '../../engine/legal/rules';
import type { ElectionResult, GameState } from '../../engine/types';
import { Hemicycle, TileMap } from '../components/charts';
import { LayerBadge, nf, PartyName, RuleChip, Term } from '../components/common';

export function ElectionView({ game, result }: { game: GameState; result: ElectionResult }) {
  const c = getCountry(game.country);
  const [sel, setSel] = useState<string | null>(null);
  const color = (pid?: string) => game.parties.find((p) => p.id === pid)?.color ?? '#999';
  const ch = c.chambers.find((x) => x.id === result.office);
  const isPres = result.office === 'presidencia';
  const t = sel ? result.byTerritory[sel] : null;
  const terr = sel ? c.territories.find((x) => x.id === sel) : null;
  const national = Object.entries(result.national).sort((a, b) => b[1] - a[1]);
  const majority = result.seats ? Math.floor(Object.values(result.seats).reduce((a, b) => a + b, 0) / 2) + 1 : 0;
  // Tabla de reparto para circunscripciones proporcionales (didáctica)
  let table: { party: string; divisor: number; q: number; seat: boolean }[] = [];
  const proportional = ch?.system === 'dhondt';
  const formula = game.country === 'sv' ? str(game, 'sv.asamblea.formula', result.date) : 'dhondt';
  if (t && proportional && t.seats) {
    const k = Object.values(t.seats).reduce((a, b) => a + b, 0);
    const votes = Object.fromEntries(Object.entries(t.shares).map(([p, s]) => [p, s * 1000]));
    const thr = game.country === 'es' ? num(game, 'es.congreso.barrera', result.date) : 0;
    if (formula === 'dhondt') table = dhondt(votes, k, thr).table.slice(0, k + 4).map((r) => ({ party: r.party, divisor: r.divisor, q: r.quotient / 10, seat: r.seat }));
    else void hareLargestRemainder;
  }
  return (
    <div className="stack">
      <div className="row between"><h2 style={{ margin: 0 }}>{isPres ? `Elección de ${c.executive.title}` : ch?.name}</h2><LayerBadge layer="simulacion" /></div>
      <p className="small muted">{fmtDate(result.date)} · Sistema: {result.system} · Participación simulada {nf(result.turnout * 100)} %</p>
      <div className="row">{result.rulesUsed.map((r) => <RuleChip key={r} id={r} />)}</div>
      {isPres && result.winner ? <div className="notice ok"><b>Gana: <PartyName game={game} id={result.winner} /></b>{result.electors ? ` · Electores: ${Object.entries(result.electors).map(([p, e]) => `${game.parties.find((x) => x.id === p)?.short} ${e}`).join(', ')}` : ''}</div> : null}
      {result.runoff ? <div className="notice info small">Segunda vuelta ({fmtDate(result.runoff.date)}): {Object.entries(result.runoff.shares).map(([p, s]) => `${game.parties.find((x) => x.id === p)?.short} ${nf(s)} %`).join(' · ')}</div> : null}
      {result.contingent ? <div className="notice warn small"><Term id="colegio-electoral">Elección contingente</Term>: {result.contingent.detail}</div> : null}
      {result.seats ? <div className="card"><Hemicycle game={game} seats={result.seats} majority={majority} /></div> : null}
      <div className="card">
        <h3>Votos (nacional)</h3>
        <table className="table"><thead><tr><th>Partido</th><th className="num">Votos</th>{result.seats ? <th className="num">Escaños</th> : null}</tr></thead>
          <tbody>{national.map(([p, v]) => <tr key={p}><td><PartyName game={game} id={p} short /></td><td className="num">{nf(v)} %</td>{result.seats ? <td className="num">{result.seats[p] ?? 0}</td> : null}</tr>)}</tbody></table>
        {result.seats ? <p className="small muted">Compare votos y escaños: la fórmula y el tamaño de las circunscripciones hacen que no coincidan (<Term id={proportional ? 'dhondt' : 'distrito-uninominal'} />).</p> : null}
      </div>
      <div className="card">
        <h3>Por {c.territoryLabel.toLowerCase()}</h3>
        <TileMap game={game} colorOf={(id) => color(result.byTerritory[id]?.winner ?? Object.entries(result.byTerritory[id]?.shares ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0])} selected={sel} onSelect={setSel} />
        <p className="small muted">Mapa en rejilla aproximada (no geográfico). Toque un territorio para ver el detalle.</p>
        {t && terr ? (
          <div className="card flat">
            <b>{terr.name}</b>
            <table className="table small"><tbody>{Object.entries(t.shares).sort((a, b) => b[1] - a[1]).map(([p, s]) => <tr key={p}><td><PartyName game={game} id={p} short /></td><td className="num">{nf(s)} %</td><td className="num">{t.seats ? `${t.seats[p] ?? 0} esc.` : ''}</td></tr>)}</tbody></table>
            {t.electors ? <p className="small">Electores: {t.electors} → {game.parties.find((x) => x.id === t.winner)?.short}</p> : null}
            {table.length ? (
              <div className="scroll-x">
                <p className="small"><b>Cómo se repartieron los escaños (<Term id="dhondt" />):</b> votos de cada partido divididos entre 1, 2, 3…; ganan escaño los cocientes más altos (miles de votos simulados).</p>
                <table className="table small"><thead><tr><th>Partido</th><th className="num">÷</th><th className="num">Cociente</th><th>Escaño</th></tr></thead>
                  <tbody>{table.map((r, i) => <tr key={i} style={{ opacity: r.seat ? 1 : 0.55 }}><td>{game.parties.find((x) => x.id === r.party)?.short}</td><td className="num">{r.divisor}</td><td className="num">{nf(r.q, 1)}</td><td>{r.seat ? '✔' : ''}</td></tr>)}</tbody></table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <ul className="small">{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
    </div>
  );
}

export function Results({ game, onContinue }: { game: GameState; onContinue: () => void }) {
  const last = game.elections.filter((e) => e.date === game.date);
  const me = game.parties.find((p) => p.isPlayer)!;
  const c = getCountry(game.country);
  const pres = last.find((r) => r.office === 'presidencia');
  const main = last.find((r) => r.office === c.chambers[0].id);
  let headline = '';
  if (pres) headline = pres.winner === me.id ? '¡Ha ganado la elección presidencial!' : `Gana ${game.parties.find((p) => p.id === pres.winner)?.name}. Usted pasa a la oposición.`;
  else if (c.executive.kind === 'parlamentario' && main?.seats) {
    const top = Object.entries(main.seats).sort((a, b) => b[1] - a[1])[0];
    headline = top[0] === me.id ? 'Su partido es la primera fuerza… pero aún necesita la investidura.' : `${game.parties.find((p) => p.id === top[0])?.name} es la primera fuerza. Ser primero no garantiza gobernar: empieza la negociación.`;
  } else headline = 'Resultados de las elecciones legislativas.';
  return (
    <div className="stack">
      <div className="card" style={{ background: 'var(--navy)', color: '#fff' }}>
        <h1 style={{ color: '#fff' }}>Noche electoral</h1>
        <p style={{ margin: 0 }}>{headline}</p>
        {main?.seats ? <p className="small" style={{ margin: '6px 0 0', opacity: 0.9 }}>Su partido: {main.seats[me.id] ?? 0} escaños ({nf(main.national[me.id] ?? 0)} % de los votos).</p> : null}
      </div>
      {last.map((r) => <div key={r.id} className="card"><ElectionView game={game} result={r} /></div>)}
      <button className="btn gold block" onClick={onContinue}>Continuar</button>
    </div>
  );
}
