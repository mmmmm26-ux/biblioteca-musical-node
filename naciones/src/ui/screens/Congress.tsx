import { getCountry } from '../../data/countries';
import { fmtDate } from '../../engine/calendar';
import { chamberSize, composition } from '../../engine/electoral/elections';
import { resolveDecision, setPlayerVote } from '../../engine/game';
import { ceilFrac } from '../../engine/legal/majority';
import { describeStep, getDef } from '../../engine/legal/procedures';
import type { ProcedureInstance } from '../../engine/types';
import { Hemicycle } from '../components/charts';
import { Empty, LayerBadge, normName, PartyName, RuleChip, Term } from '../components/common';
import { useApp, useGame } from '../store';

const STATUS: Record<string, string> = { 'en-tramite': 'En trámite', rechazada: 'Rechazada', vigente: 'En vigor', anulada: 'Anulada', invalida: 'Inválida' };

function ProcCard({ proc }: { proc: ProcedureInstance }) {
  const game = useGame();
  const { setGame } = useApp();
  const def = getDef(game, proc.defId);
  const cur = proc.currentStep ? def.steps.find((s) => s.id === proc.currentStep) : null;
  const myVote = (proc.meta?.playerVote as string | undefined) ?? (proc.proposerParty === game.playerParty ? 'si' : undefined);
  const done = new Set(proc.log.filter((l) => l.outcome === 'superado').map((l) => l.stepId));
  const failed = new Set(proc.log.filter((l) => l.outcome === 'no-superado' || l.outcome === 'vetado').map((l) => l.stepId));
  return (
    <div className="card">
      <div className="row between"><b>{proc.title}</b><span className={`badge ${proc.status === 'vigente' ? 'contrastada' : proc.status === 'rechazada' ? 'pendiente' : 'neutral'}`}>{STATUS[proc.status]}</span></div>
      <p className="small muted" style={{ margin: 0 }}>{def.name} ({normName(def.normType)}) · Propone <PartyName game={game} id={proc.proposerParty} short /> · desde el {fmtDate(proc.startedOn)}</p>
      {cur && proc.status === 'en-tramite' ? <p className="small">Próximo paso: <b>{cur.label}</b> {proc.meta?.waitingLegislature ? '(a la espera de la nueva legislatura)' : `· previsto el ${fmtDate(proc.nextActionOn)}`}<br /><span className="muted">{describeStep(game, cur)}</span></p> : null}
      {proc.inForceOn ? <p className="small">Publicada: {proc.publishedOn ? fmtDate(proc.publishedOn) : '—'} · En vigor: <b>{fmtDate(proc.inForceOn)}</b></p> : null}
      {proc.status === 'en-tramite' && proc.proposerParty !== game.playerParty ? (
        <div className="row small">Voto de su grupo:
          {(['si', 'abstencion', 'no'] as const).map((v) => <button key={v} className={`chip${myVote === v ? ' on' : ''}`} onClick={() => setGame(setPlayerVote(game, proc.id, v))}>{{ si: 'Sí', abstencion: 'Abstención', no: 'No' }[v]}</button>)}
          {!myVote ? <span className="muted">(sin fijar: votará según su programa)</span> : null}
        </div>
      ) : null}
      <details>
        <summary className="small">Historial del trámite</summary>
        <ol className="steps" style={{ marginTop: 8 }}>
          {def.steps.filter((s) => done.has(s.id) || failed.has(s.id) || s.id === proc.currentStep).map((s) => (
            <li key={s.id} className={failed.has(s.id) ? 'fail' : done.has(s.id) ? 'done' : 'cur'}><span className="pt" /><b className="small">{s.label}</b>
              {proc.log.filter((l) => l.stepId === s.id).map((l, i) => <div key={i} className="small">{fmtDate(l.date)}: {l.detail}{l.tally?.byParty ? <div className="muted">{Object.entries(l.tally.byParty).map(([p, v]) => `${game.parties.find((x) => x.id === p)?.short}: ${v.yes}/${v.no}/${v.abstain}`).join(' · ')} (sí/no/abst.)</div> : null}</div>)}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

export function Congress() {
  const game = useGame();
  const { setGame, autosave } = useApp();
  const c = getCountry(game.country);
  const active = game.procedures.filter((p) => p.status === 'en-tramite');
  const past = game.procedures.filter((p) => p.status !== 'en-tramite').slice(-12).reverse();
  return (
    <div className="stack">
      {game.decisions.length ? (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <h2>Decisiones pendientes</h2>
          {game.decisions.map((d) => (
            <div key={d.id} className="card flat">
              <b>{d.title}</b>
              <p className="small">{d.detail}</p>
              <div className="row">{d.options.map((o) => <button key={o.id} className="btn" title={o.explain} onClick={() => { autosave(game, d.title); setGame(resolveDecision(game, d.id, o.id)); }}>{o.label}</button>)}</div>
              <p className="small muted">{d.options.map((o) => `${o.label}: ${o.explain}`).join(' · ')}</p>
            </div>
          ))}
        </div>
      ) : null}
      {c.chambers.map((ch) => {
        const comp = composition(game, ch.id);
        const n = chamberSize(game, ch.id);
        return (
          <div key={ch.id} className="card">
            <div className="row between"><h2 style={{ margin: 0 }}>{ch.name}</h2><LayerBadge layer="simulacion" /></div>
            <Hemicycle game={game} seats={comp} majority={Math.floor(n / 2) + 1} />
            <table className="table small" style={{ marginTop: 8 }}>
              <tbody>
                <tr><th>Miembros</th><td className="num">{n}</td><td><RuleChip id={ch.membersRule} /></td></tr>
                <tr><th><Term id="mayoria-absoluta" /></th><td className="num">{Math.floor(n / 2) + 1}</td><td /></tr>
                <tr><th>3/5</th><td className="num">{ceilFrac(n, 3, 5)}</td><td /></tr>
                <tr><th>2/3</th><td className="num">{ceilFrac(n, 2, 3)}</td><td /></tr>
                {game.country === 'sv' ? <tr><th>3/4</th><td className="num">{ceilFrac(n, 3, 4)}</td><td /></tr> : null}
              </tbody>
            </table>
            <p className="small muted">Composición resultante de las elecciones simuladas; los partidos son ficticios.{ch.designated ? ` Incluye ${ch.designated.count} senadores autonómicos (simplificado).` : ''}</p>
          </div>
        );
      })}
      <h2>Trámites en curso</h2>
      {active.length ? active.map((p) => <ProcCard key={p.id} proc={p} />) : <Empty>No hay iniciativas en trámite. Puede presentarlas desde Gobierno o Constitución.</Empty>}
      <h2>Trámites concluidos</h2>
      {past.length ? past.map((p) => <ProcCard key={p.id} proc={p} />) : <Empty>Todavía no ha concluido ningún trámite.</Empty>}
    </div>
  );
}
