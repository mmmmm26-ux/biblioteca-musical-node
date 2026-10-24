import type { ReactNode } from 'react';
import { addConcession, checkInitiative, previewVotes, submitProposal } from '../../engine/game';
import { describeMajority, thresholdOverMembers } from '../../engine/legal/majority';
import { describeStep, getDef } from '../../engine/legal/procedures';
import type { Proposal } from '../../engine/types';
import { LayerBadge, nf, normName, PartyName, RuleChip, Term } from '../components/common';
import { useApp, useGame } from '../store';

const CHOICE: Record<string, string> = { si: 'Sí', no: 'No', abstencion: 'Abstención' };

export function ProposalReview({ proposal, setProposal, consequences, onDone, extra }: { proposal: Proposal; setProposal: (p: Proposal) => void; consequences: ReactNode; onDone: () => void; extra?: ReactNode }) {
  const game = useGame();
  const { setGame, notify, autosave } = useApp();
  const def = getDef(game, proposal.procedureId);
  const check = checkInitiative(game, proposal);
  const pv = previewVotes(game, proposal);
  const submit = () => {
    autosave(game, `antes de presentar «${proposal.title}»`);
    const r = submitProposal(game, proposal);
    if (!r.check.ok) return notify(r.check.errors.join(' '));
    setGame(r.game);
    notify(`Presentada: ${proposal.title}. Guardado automático realizado antes de la decisión.`);
    onDone();
  };
  return (
    <div className="stack">
      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>{proposal.title}</h3><span className="badge juridica">{normName(proposal.normType)}</span></div>
        <p className="small">{proposal.summary}</p>
        <p className="small"><b>Procedimiento:</b> {def.name}. <b>Pueden iniciarlo:</b> {def.initiators}.</p>
        {def.notes ? <p className="small muted">{def.notes}</p> : null}
        <div className="row">{def.ruleIds.map((r) => <RuleChip key={r} id={r} />)}</div>
      </div>

      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Etapas, mayorías y plazos</h3><LayerBadge layer="juridica" /></div>
        <ol className="steps">
          {walk(def).map((s) => (
            <li key={s.id}><span className="pt" /><b>{s.label}</b> <span className="small muted">— {s.institution}</span>
              <div className="small">{describeStep(game, s)}</div>
              {s.onFail ? <div className="small muted">Si no se supera: {def.steps.find((x) => x.id === s.onFail)?.label ?? '—'}</div> : null}
              <div className="row">{s.ruleIds.map((r) => <RuleChip key={r} id={r} />)}</div>
            </li>
          ))}
        </ol>
        <p className="small muted">Los plazos marcados como «duración aproximada del modelo» no son plazos legales: representan el tiempo típico de tramitación en el juego.</p>
      </div>

      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Apoyos estimados y negociación</h3><LayerBadge layer="simulacion" /></div>
        <p className="small muted">Estimación del modelo sin defecciones individuales. La disciplina de voto y los cambios de contexto pueden alterar el resultado. Apoyo ciudadano estimado: {nf(pv.support * 100, 0)} %.</p>
        {pv.chambers.map((ch) => {
          const first = ch.steps[0];
          if (!first) return null;
          const m = first.majority;
          const thr = m ? thresholdOverMembers(m, ch.members) : null;
          const enough = m ? (m.kind === 'simple' ? ch.yes > ch.no : ch.yes >= (thr ?? 0)) : true;
          return (
            <div key={ch.chamber.id} className="card flat">
              <div className="row between"><b>{ch.chamber.name}</b><span className={enough ? 'up' : 'down'}>{ch.yes} sí · {ch.no} no · {ch.abst} abst.</span></div>
              <p className="small" style={{ margin: 0 }}>{m ? describeMajority(m, ch.members) : 'Paso omitido por la regla vigente'} {m?.kind === 'cualificada' ? <Term id="mayoria-cualificada">(¿qué es?)</Term> : null}</p>
              <div className="scroll-x"><table className="table small"><tbody>
                {ch.rows.map((r) => (
                  <tr key={r.party.id}>
                    <td><PartyName game={game} id={r.party.id} short /> <span className="muted">{r.seats}</span></td>
                    <td><b>{CHOICE[r.choice]}</b><div className="muted">{r.reasons.join('; ')}</div></td>
                    <td>{r.choice !== 'si' && !r.party.isPlayer ? (
                      <div className="row">
                        <button className="btn sm" disabled={proposal.concessions.some((x) => x.partyId === r.party.id && x.kind === 'prioridad')} onClick={() => setProposal(addConcession(proposal, r.party.id, 'prioridad', r.party.short))}>Incluir sus prioridades</button>
                        <button className="btn sm" disabled={proposal.concessions.some((x) => x.partyId === r.party.id && x.kind === 'inversion-territorial')} onClick={() => setProposal(addConcession(proposal, r.party.id, 'inversion-territorial', r.party.short))}>Inversión territorial</button>
                      </div>
                    ) : null}</td>
                  </tr>
                ))}
              </tbody></table></div>
            </div>
          );
        })}
        {proposal.concessions.length ? <div className="notice info small"><b>Concesiones:</b> {proposal.concessions.map((x) => x.label).join('; ')}. Incluir prioridades ajenas modera el alcance de la propuesta; la inversión territorial cuesta 0,05 % del PIB al año (parámetro del juego).</div> : null}
      </div>

      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Consecuencias posibles</h3><LayerBadge layer="simulacion" /></div>
        {consequences}
      </div>

      {extra}

      {check.errors.length ? <div className="notice err">{check.errors.map((e) => <div key={e}>{e}</div>)}</div> : null}
      {check.warnings.length ? <div className="notice warn small">{check.warnings.map((e) => <div key={e}>{e}</div>)}</div> : null}
      <div className="row">
        <button className="btn gold" disabled={!check.ok} onClick={submit}>Presentar e iniciar el trámite</button>
        <button className="btn" onClick={onDone}>Cancelar</button>
      </div>
      <p className="small muted">Presentar no aprueba nada: la propuesta avanzará por cada etapa según el calendario y sólo tendrá efectos si las supera todas.</p>
    </div>
  );
}

function walk(def: ReturnType<typeof getDef>) {
  const out: ReturnType<typeof getDef>['steps'] = [];
  const seen = new Set<string>();
  const visit = (id: string | null | undefined) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const s = def.steps.find((x) => x.id === id);
    if (!s) return;
    out.push(s);
    visit(s.next);
    visit(s.onFail);
  };
  visit(def.first);
  return out;
}
