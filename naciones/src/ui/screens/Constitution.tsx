import { useState } from 'react';
import type { ReformDef } from '../../engine/country';
import { getCountry } from '../../data/countries';
import { fmtDate } from '../../engine/calendar';
import { attemptShortcut, makeReformProposal } from '../../engine/game';
import { pendingAmendments, ruleAt } from '../../engine/legal/rules';
import type { Proposal, RuleCategory, RuleValue } from '../../engine/types';
import { fmtValue, LayerBadge, normName, RuleChip, Term, VerifBadge } from '../components/common';
import { useApp, useGame } from '../store';
import { ProposalReview } from './ProposalReview';

const CAT: Record<RuleCategory, string> = { ejecutivo: 'Poder Ejecutivo', legislativo: 'Poder Legislativo', electoral: 'Sistema electoral', judicial: 'Tribunales y control constitucional', territorial: 'Organización territorial', presupuesto: 'Presupuesto', reforma: 'Reforma constitucional', control: 'Control, censura y disolución', emergencia: 'Estados de emergencia', economia: 'Competencias económicas' };

function ReformWizard({ rf, onClose }: { rf: ReformDef; onClose: () => void }) {
  const game = useGame();
  const { setGame, notify } = useApp();
  const opts = rf.options.filter((o) => o.value !== ruleAt(game, rf.ruleId).value);
  const [value, setValue] = useState<RuleValue>(opts[0]?.value ?? rf.options[0].value);
  const routing = rf.classify(value, game);
  const [route, setRoute] = useState<string | undefined>(routing.routes?.[0]?.id);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const cur = ruleAt(game, rf.ruleId);
  const q = rf.qualitative;
  const cons = (
    <div className="small stack">
      <p><b>Efecto jurídico directo:</b> {q.legal}</p>
      <p><b>Entrada en vigor y transitoria:</b> {rf.transitional.text} <Term id="transitoria" /></p>
      <p><b>Efectos políticos posibles:</b> {q.political}</p>
      <p><b>Efectos sociales posibles:</b> {q.social}</p>
      <p><b>Efectos económicos:</b> {q.economic}</p>
      <p><b>Podrían beneficiarse:</b> {q.beneficiaries.join(', ') || '—'} · <b>Podrían asumir costes:</b> {q.costs.join(', ') || '—'}</p>
      <p><b>Plazos aproximados:</b> {q.timeline}</p>
      <p className="muted"><b>Incertidumbre:</b> {q.uncertainty} El juego no asigna cifras de impacto a las reformas constitucionales: sus efectos se ven en las reglas que cambian y en cómo responden los actores.</p>
    </div>
  );
  if (proposal) {
    const extra = (
      <div className="card">
        <h3>¿Y si se intenta saltar el procedimiento?</h3>
        <p className="small muted">Estos atajos no tienen validez jurídica: el motor no los contabiliza como reforma. Pruébelos para ver por qué.</p>
        <div className="row">{getCountry(game.country).shortcuts.map((s) => <button key={s.id} className="btn sm danger" onClick={() => { const r = attemptShortcut(game, rf.id, s.id); setGame(r.game); notify(r.message); }}>{s.label}</button>)}</div>
      </div>
    );
    return <ProposalReview proposal={proposal} setProposal={setProposal} consequences={cons} onDone={onClose} extra={extra} />;
  }
  return (
    <div className="stack">
      <div className="card">
        <div className="row between"><h2 style={{ margin: 0 }}>{rf.title}</h2><button className="btn sm" onClick={onClose}>Volver</button></div>
        <p>{rf.question}</p>
        <div className="card flat">
          <div className="row between"><b>Regla actual</b><span className="row"><LayerBadge layer="juridica" /><VerifBadge v={cur.rule.verification} /></span></div>
          <p className="small" style={{ margin: '4px 0' }}>{cur.rule.plain}</p>
          <p className="small" style={{ margin: 0 }}>Valor: <b>{fmtValue(cur.value)}</b> · <RuleChip id={rf.ruleId} /></p>
        </div>
        <h3 style={{ marginTop: 12 }}>Cambio propuesto</h3>
        <div className="chips">{rf.options.map((o) => <button key={String(o.value)} className={`chip${value === o.value ? ' on' : ''}`} disabled={o.value === cur.value} onClick={() => { setValue(o.value); setRoute(rf.classify(o.value, game).routes?.[0]?.id); }}>{o.label}</button>)}</div>
      </div>
      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Qué exige el derecho</h3><LayerBadge layer="juridica" /></div>
        <p className="small"><b>Tipo de norma necesaria:</b> {normName(routing.normType)}{routing.normType !== 'constitucion' ? ' (no hace falta reformar la Constitución)' : ''}.</p>
        <p className="small"><b>Quién puede iniciarlo:</b> {routing.initiators}.</p>
        <ul className="small">{routing.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        <div className="row">{routing.ruleIds.map((r) => <RuleChip key={r} id={r} />)}</div>
        {routing.routes ? (
          <div style={{ marginTop: 8 }}>
            <b className="small">Vía de tramitación</b>
            <div className="chips">{routing.routes.map((r) => <button key={r.id} className={`chip${route === r.id ? ' on' : ''}`} onClick={() => setRoute(r.id)}>{r.label}</button>)}</div>
          </div>
        ) : null}
        {rf.controversy ? <div className="notice info small" style={{ marginTop: 8 }}><b>Controversia: </b>{rf.controversy}</div> : null}
        {routing.blockers.length ? <div className="notice err" style={{ marginTop: 8 }}>{routing.blockers.map((b) => <div key={b}>{b}</div>)}</div> : null}
      </div>
      <button className="btn primary" disabled={!routing.allowed} onClick={() => { const r = makeReformProposal(game, rf.id, value, route); if (r.proposal) setProposal(r.proposal); }}>Ver procedimiento, apoyos y consecuencias</button>
      {!routing.allowed ? <p className="small muted">Una propuesta legalmente imposible no se puede tramitar, aunque fuera popular. Ser impopular, en cambio, no la hace ilegal.</p> : null}
    </div>
  );
}

export function Constitution() {
  const game = useGame();
  const c = getCountry(game.country);
  const [open, setOpen] = useState<ReformDef | null>(null);
  const [cat, setCat] = useState<RuleCategory | 'todas'>('todas');
  if (open) return <ReformWizard rf={open} onClose={() => setOpen(null)} />;
  const pend = pendingAmendments(game);
  const rules = Object.values(game.rules).filter((r) => cat === 'todas' || r.category === cat);
  const counts = Object.values(game.rules).reduce((a, r) => ({ ...a, [r.verification]: (a[r.verification] ?? 0) + 1 }), {} as Record<string, number>);
  return (
    <div className="stack">
      <div className="card">
        <h2>Constitución y reglas</h2>
        <p className="small">{c.system.summary}</p>
        <p className="small muted"><Term id="separacion-poderes" /> · <Term id={c.system.executive === 'presidencial' ? 'presidencialismo' : 'parlamentarismo'} /> · <Term id={c.system.territorial === 'federal' ? 'federalismo' : c.system.territorial === 'autonomico' ? 'estado-autonomico' : 'estado-unitario'} /> · <Term id="control-constitucional" /> · <Term id="reforma-constitucional" /></p>
        <p className="small">Versión de reglas de esta partida: <b>{game.rulesetVersion}</b> (fecha de consulta de fuentes). Verificación: {counts.contrastada ?? 0} contrastadas, {counts['por-cotejar'] ?? 0} pendientes de cotejo, {counts.simplificacion ?? 0} simplificaciones, {counts.pendiente ?? 0} pendientes.</p>
      </div>

      <h2>Reformas que puede explorar</h2>
      <p className="small muted">Catálogo acotado: sólo reformas con información suficiente para modelarlas. El juego no interpreta textos constitucionales libres.</p>
      {c.reforms.map((rf) => {
        const routing = rf.classify(rf.options[0].value, game);
        const inProc = game.procedures.find((p) => p.status === 'en-tramite' && p.proposal.reformId === rf.id);
        return (
          <button key={rf.id} className="card countrycard" onClick={() => setOpen(rf)}>
            <div className="row between"><b>{rf.title}</b><span className={`badge ${routing.allowed ? (routing.normType === 'constitucion' ? 'juridica' : 'neutral') : 'pendiente'}`}>{routing.allowed ? normName(routing.normType) : 'Prohibida'}</span></div>
            <p className="small muted" style={{ margin: 0 }}>{rf.question}</p>
            {inProc ? <p className="small" style={{ margin: 0 }}>En trámite desde el {fmtDate(inProc.startedOn)}.</p> : null}
          </button>
        );
      })}

      {game.amendments.length ? (
        <div className="card">
          <h3>Cambios institucionales aprobados en la partida</h3>
          <ul className="small">{game.amendments.map((a) => <li key={a.id}><b>{game.rules[a.ruleId].title}</b>: {fmtValue(a.previous)} → {fmtValue(a.value)} · efecto desde el {fmtDate(a.effectiveFrom)}{pend.includes(a) ? ' (aún no aplicado)' : ''}</li>)}</ul>
        </div>
      ) : null}

      <h2>Reglas vigentes</h2>
      <div className="chips"><button className={`chip${cat === 'todas' ? ' on' : ''}`} onClick={() => setCat('todas')}>Todas</button>{(Object.keys(CAT) as RuleCategory[]).filter((k) => Object.values(game.rules).some((r) => r.category === k)).map((k) => <button key={k} className={`chip${cat === k ? ' on' : ''}`} onClick={() => setCat(k)}>{CAT[k]}</button>)}</div>
      {rules.map((r) => {
        const v = ruleAt(game, r.id);
        return (
          <div key={r.id} className="card flat">
            <div className="row between"><b>{r.title}</b><VerifBadge v={r.verification} /></div>
            <p className="small" style={{ margin: '4px 0' }}>{r.plain}</p>
            <div className="row small"><RuleChip id={r.id} /> <span className="muted">{normName(r.normLevel)}</span>{v.amendment ? <span className="badge neutral">modificada en la partida</span> : null}</div>
          </div>
        );
      })}
    </div>
  );
}
