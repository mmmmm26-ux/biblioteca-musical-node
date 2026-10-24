import { useMemo, useState } from 'react';
import { getCountry } from '../../data/countries';
import { ISSUES, SEGMENTS } from '../../data/segments';
import { fmtDate } from '../../engine/calendar';
import { effectivePct, indicators } from '../../engine/economy/model';
import { composition } from '../../engine/electoral/elections';
import { censureMotion, dissolve, isPlayerExecutive, makeBudgetProposal, makePolicyProposal, offerDeal, playerParty, questionOfConfidence, requestInvestiture, resolveDecision } from '../../engine/game';
import { DEALS, formationDeadline, investitureVotes, kingsCandidate, type DealKind } from '../../engine/government/formation';
import type { IssueId, Proposal } from '../../engine/types';
import { Hemicycle } from '../components/charts';
import { Empty, LayerBadge, nf, PartyName, RuleChip, signed, Term } from '../components/common';
import { useApp, useGame } from '../store';
import { ProposalReview } from './ProposalReview';

function beneficiaries(issue?: IssueId): string {
  if (!issue) return 'Varía según el uso del gasto.';
  return SEGMENTS.filter((s) => (s.priorities[issue] ?? 0) > 0).sort((a, b) => (b.priorities[issue] ?? 0) - (a.priorities[issue] ?? 0)).slice(0, 3).map((s) => s.name.toLowerCase()).join(', ') || 'grupos diversos';
}

export function Government() {
  const game = useGame();
  if (game.phase === 'formacion') return <Formation />;
  if (game.phase !== 'gobierno') return <Empty>El panel de gobierno se activa tras las elecciones, cuando hay un Ejecutivo constituido.</Empty>;
  return <Policies />;
}

function Policies() {
  const game = useGame();
  const { setGame, notify, autosave, openModal } = useApp();
  const c = getCountry(game.country);
  const exec = isPlayerExecutive(game);
  const ind = indicators(game);
  const [review, setReview] = useState<{ p: Proposal; cons: JSX.Element } | null>(null);
  const [pct, setPct] = useState<Record<string, number>>(() => ({ ...game.fiscal.spendingPct }));
  const [fin, setFin] = useState<number>(game.fiscal.levers.financiacion ?? 100);
  const [taxes, setTaxes] = useState<Record<string, number>>(() => ({ ...game.fiscal.levers }));
  const [regs, setRegs] = useState<Record<string, number>>(() => ({ ...game.fiscal.levers }));
  const [recon, setRecon] = useState(false);
  const eff = effectivePct(c, pct, { ...game.fiscal.levers, financiacion: fin });
  const effNow = effectivePct(c, game.fiscal.spendingPct, game.fiscal.levers);
  const spendNew = Object.values(eff).reduce((a, b) => a + b, 0);
  const spendNow = Object.values(effNow).reduce((a, b) => a + b, 0);
  const deficitEst = ind.deficit + (spendNew - spendNow);

  if (review) return <ProposalReview proposal={review.p} setProposal={(p) => setReview({ ...review, p })} consequences={review.cons} onDone={() => setReview(null)} />;

  const budgetCons = () => (
    <div className="small stack">
      <p><b>Efecto jurídico:</b> si se aprueba, fija las asignaciones del ejercicio {makeBudgetProposal(game, pct).fiscalYear}. Si no se aprueba a tiempo, se prorroga el anterior (<Term id="prorroga" />).</p>
      <p><b>Cuentas públicas:</b> gasto primario {nf(spendNow)} → {nf(spendNew)} % del PIB. <Term id="deficit" /> estimado si nada más cambia: {nf(deficitEst)} % (hoy {nf(ind.deficit)} %). Más déficit significa más <Term id="deuda" />; con deuda alta sube la prima de riesgo y el coste de los intereses.</p>
      <ul>
        {c.budget.map((b) => {
          const d = eff[b.id] - effNow[b.id];
          if (Math.abs(d) < 0.005) return null;
          return <li key={b.id}><b>{b.name}: {signed(d, 2)} pp del PIB.</b> Efecto sobre la actividad ≈ {signed(d * b.multiplier * c.economy.openness, 2)} pp, gradual en ~{b.lag} meses (<Term id="multiplicador" /> {nf(b.multiplier * c.economy.openness, 2)}, parámetro del juego). {b.service ? `La calidad del servicio responde con retraso y los aumentos rápidos se ven limitados por la capacidad administrativa.` : ''} Beneficiarios probables: {beneficiaries(b.issue)}.{b.competence !== 'nacional' ? ' Parte del servicio depende de gobiernos territoriales.' : ''}</li>;
        })}
      </ul>
      <p className="muted">Incertidumbre: los multiplicadores y demoras son supuestos simplificados; su valor real depende del ciclo económico, de la política monetaria y de cómo se ejecute el gasto.</p>
    </div>
  );

  const taxCons = (lev: Record<string, number>) => (
    <div className="small stack">
      <ul>
        {Object.entries(lev).map(([k, v]) => {
          const t = c.taxes.find((x) => x.id === k);
          const r = c.regulations.find((x) => x.id === k);
          const cur = game.fiscal.levers[k];
          if (t) {
            const dRev = t.basePct * ((v - cur) / t.base);
            return <li key={k}><b>{t.name}: {cur} → {v}.</b> Recaudación ≈ {signed(dRev, 2)} pp del PIB si la economía no cambia. Efecto en la actividad ≈ {signed(t.multiplier * c.economy.openness * dRev, 2)} pp en unos 4 meses. {k === 'consumo' ? 'Sube (o baja) los precios de una vez: afecta más a hogares con menos ingresos.' : ''}{k === 'sociedades' || k === 'renta' ? ' A largo plazo, una carga mayor reduce algo el crecimiento potencial (parámetro).' : ''}{k === 'aranceles' ? ' Encarece importaciones, reduce algo el crecimiento y puede provocar represalias (no modeladas).' : ''}{k === 'cotizaciones' ? ' Encarece el empleo formal: puede elevar el desempleo estructural.' : ''}</li>;
          }
          if (r) return <li key={k}><b>{r.name}: {cur} → {v}.</b> {k === 'salario-minimo' ? 'Sube los ingresos de quienes cobran el mínimo y reduce algo la pobreza; puede aumentar el desempleo estructural (efecto incierto y discutido; mayor en economías con mucha informalidad) y la inflación.' : 'Mejora lentamente la calidad ambiental (años) y supone costes de adaptación para las empresas a corto plazo.'}</li>;
          return null;
        })}
      </ul>
      <p className="muted">Grupos: {game.groups.map((g) => g.name).join(', ')} reaccionarán según sus preferencias (parámetros del juego).</p>
    </div>
  );

  const confirm = (title: string, body: string, run: () => { game: typeof game; message: string }) =>
    openModal({ kind: 'custom', title, body: <div className="stack"><p>{body}</p><button className="btn gold" onClick={() => { autosave(game, title); const r = run(); setGame(r.game); notify(r.message); openModal(null); }}>Confirmar</button></div> });

  const fy = makeBudgetProposal(game, pct).fiscalYear;
  return (
    <div className="stack">
      <div className="card">
        <div className="row between"><h2 style={{ margin: 0 }}>{exec ? 'Gobierno' : 'Oposición'}</h2><span className="badge neutral">{c.system.label}</span></div>
        <p className="small">{exec ? `Usted dirige el Ejecutivo. Las medidas deben pasar por el legislativo según sus reglas.` : `Gobierna ${game.government.executiveName}. Desde la oposición puede presentar iniciativas legislativas (si cumple los requisitos), votar y negociar.`}</p>
        <div className="notice info small"><b>Fuera de su control:</b> {c.economy.monetaryNote} <RuleChip id={game.country === 'us' ? 'us.fed' : game.country === 'es' ? 'es.bce' : 'sv.moneda'} /></div>
        {c.system.territorial !== 'unitario' ? <p className="small muted" style={{ marginTop: 8 }}>{game.country === 'es' ? 'Sanidad y educación las gestionan las comunidades autónomas: usted sólo puede cambiar su financiación.' : 'Educación y policía son sobre todo competencias estatales y locales: el gasto federal sólo complementa.'} <Term id={game.country === 'es' ? 'estado-autonomico' : 'federalismo'} /></p> : null}
      </div>

      {game.country === 'es' ? (
        <div className="card">
          <h3>Relación con el Congreso</h3>
          {exec ? (
            <div className="row">
              <button className="btn" onClick={() => confirm('Cuestión de confianza', 'Pedirá al Congreso que reafirme su confianza por mayoría simple. Si la pierde, el Gobierno dimite y se abre una nueva investidura (arts. 112 y 114.1).', () => questionOfConfidence(game))}>Plantear cuestión de confianza</button>
              <button className="btn" onClick={() => confirm('Disolución anticipada', 'Se disuelven las Cortes y se convocan elecciones generales. No es posible con una moción de censura en trámite ni antes de un año desde la anterior disolución (art. 115).', () => dissolve(game))}>Disolver las Cortes</button>
            </div>
          ) : (
            <button className="btn" onClick={() => confirm('Moción de censura', 'Presentará una moción con su candidato como alternativa. Requiere 35 diputados para proponerla y mayoría absoluta (176) para prosperar (arts. 113-114).', () => censureMotion(game))}>Presentar moción de censura</button>
          )}
          <div className="row" style={{ marginTop: 6 }}><RuleChip id="es.confianza" /><RuleChip id="es.disolucion" /><RuleChip id="es.censura" /></div>
        </div>
      ) : null}

      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Presupuesto del ejercicio {fy}</h3><LayerBadge layer="juridica" /></div>
        <p className="small muted">Asignaciones en % del PIB. Vigente: ejercicio {game.fiscal.fiscalYear} ({game.fiscal.approvedBy === 'prorroga' ? 'prorrogado' : game.fiscal.approvedBy === 'ley' ? 'aprobado por ley' : 'inicial'}). {game.pendingFiscal ? `Aprobado para ${game.pendingFiscal.fiscalYear}.` : ''} Sólo el Ejecutivo puede presentarlo.</p>
        {c.budget.map((b) => (
          <div key={b.id} className="slider-row">
            <span>{b.name} {b.competence !== 'nacional' ? <span className="badge neutral">{b.competence === 'territorial' ? 'competencia territorial' : 'compartida'}</span> : null}</span>
            <span className="mono">{nf(eff[b.id], 2)} %</span>
            {b.adjustable ? <input className="full" type="range" min={Math.round(b.basePct * 60) / 100} max={Math.round(b.basePct * 150) / 100} step={b.basePct > 5 ? 0.1 : 0.05} value={pct[b.id] ?? b.basePct} onChange={(e) => setPct({ ...pct, [b.id]: Number(e.target.value) })} aria-label={b.name} /> : <span className="full small muted">{b.note}</span>}
          </div>
        ))}
        {game.country === 'es' ? (
          <div className="slider-row"><span>Financiación autonómica (índice)</span><span className="mono">{fin}</span>
            <input className="full" type="range" min={90} max={115} step={1} value={fin} onChange={(e) => setFin(Number(e.target.value))} aria-label="Financiación autonómica" />
            <span className="full small muted">Las comunidades deciden cómo gastar la financiación. <RuleChip id="es.financiacion" /></span></div>
        ) : null}
        <p className="small">Gasto primario: {nf(spendNow)} → <b>{nf(spendNew)} %</b> · Déficit estimado: <b>{nf(deficitEst)} %</b> del PIB</p>
        <button className="btn primary" disabled={!exec} onClick={() => setReview({ p: makeBudgetProposal(game, pct, game.country === 'es' ? fin : undefined), cons: budgetCons() })}>{exec ? 'Revisar y presentar el presupuesto' : 'Sólo el Ejecutivo puede presentarlo'}</button>
      </div>

      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Impuestos</h3><LayerBadge layer="juridica" /></div>
        <p className="small muted">Requieren una ley tributaria. {game.country === 'es' ? 'La ley de presupuestos no puede crear tributos (art. 134.7).' : ''}{game.country === 'us' ? 'Las leyes para recaudar deben originarse en la Cámara.' : ''}</p>
        {c.taxes.map((t) => (
          <div key={t.id} className="slider-row">
            <span>{t.name}</span><span className="mono">{taxes[t.id] ?? t.base}{t.unit === 'tipo' ? ' %' : ''}</span>
            {t.competence === 'nacional' && t.max > t.min ? <input className="full" type="range" min={t.min} max={t.max} step={t.step} value={taxes[t.id] ?? t.base} onChange={(e) => setTaxes({ ...taxes, [t.id]: Number(e.target.value) })} aria-label={t.name} /> : <span className="full small muted">{t.note}</span>}
            {t.note && t.competence === 'nacional' ? <span className="full small muted">{t.note}</span> : null}
          </div>
        ))}
        {game.country === 'us' ? <label className="row small" style={{ marginTop: 8 }}><input type="checkbox" checked={recon} onChange={(e) => setRecon(e.target.checked)} /> Tramitar por reconciliación presupuestaria (sin filibusterismo; sólo medidas con efecto presupuestario)</label> : null}
        {(() => {
          const lev = Object.fromEntries(c.taxes.filter((t) => (taxes[t.id] ?? t.base) !== game.fiscal.levers[t.id]).map((t) => [t.id, taxes[t.id]]));
          return <button className="btn primary" disabled={!Object.keys(lev).length} onClick={() => setReview({ p: makePolicyProposal(game, 'tributaria', lev, recon), cons: taxCons(lev) })}>Revisar la reforma tributaria</button>;
        })()}
      </div>

      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Empleo, comercio y medioambiente</h3><LayerBadge layer="juridica" /></div>
        {c.regulations.map((r) => (
          <div key={r.id} className="slider-row">
            <span>{r.name}</span><span className="mono">{r.enabled ? regs[r.id] ?? r.base : '—'}</span>
            {r.enabled ? <input className="full" type="range" min={r.min} max={r.max} step={r.step} value={regs[r.id] ?? r.base} onChange={(e) => setRegs({ ...regs, [r.id]: Number(e.target.value) })} aria-label={r.name} /> : null}
            <span className="full small muted">{r.enabled ? `${r.desc} Competencia: ${r.competence}.` : r.disabledReason}</span>
            {r.enabled ? <span className="full"><button className="btn sm" disabled={(regs[r.id] ?? r.base) === game.fiscal.levers[r.id]} onClick={() => setReview({ p: makePolicyProposal(game, 'sectorial', { [r.id]: regs[r.id] }), cons: taxCons({ [r.id]: regs[r.id] }) })}>Revisar ({r.normType === 'decreto-ejecutivo' ? 'decreto' : 'ley'})</button></span> : null}
          </div>
        ))}
      </div>

      {game.regional.length ? (
        <div className="card">
          <h3>Gobiernos territoriales</h3>
          <p className="small muted">Simulados a partir del voto (no se celebran elecciones territoriales en esta versión). Deciden sobre sus propias competencias{game.country === 'us' ? ' y ratifican enmiendas constitucionales' : ''}.</p>
          <div className="chips">{Object.entries(game.regional.reduce((a, r) => ({ ...a, [r.party]: (a[r.party] ?? 0) + 1 }), {} as Record<string, number>)).map(([p, n]) => <span key={p} className="chip"><PartyName game={game} id={p} short /> {n}</span>)}</div>
        </div>
      ) : null}
    </div>
  );
}

function Formation() {
  const game = useGame();
  const { setGame, notify, autosave } = useApp();
  const me = playerParty(game);
  const f = game.government.formation;
  const comp = composition(game, 'congreso');
  const members = Object.values(comp).reduce((a, b) => a + b, 0);
  const deals = Object.fromEntries(Object.entries(f?.offers ?? {}).filter(([k]) => !k.startsWith('__')));
  const est = useMemo(() => investitureVotes(game, me.id, deals), [game]);
  const king = useMemo(() => kingsCandidate(game, deals), [game]);
  const deadline = formationDeadline(game);
  const decision = game.decisions.find((d) => d.kind === 'voto-investidura');
  const [msg, setMsg] = useState<string | null>(null);
  if (!f) return <Empty>Las Cortes todavía no se han constituido. La negociación empieza tras la sesión constitutiva.</Empty>;
  return (
    <div className="stack">
      <div className="card">
        <h2>Formación de gobierno</h2>
        <p className="small">En un sistema <Term id="parlamentarismo">parlamentario</Term> el Presidente del Gobierno necesita la <Term id="investidura" /> del Congreso: <Term id="mayoria-absoluta" /> ({Math.floor(members / 2) + 1}) en la primera votación o <Term id="mayoria-simple" /> 48 horas después. <RuleChip id="es.investidura" /> <RuleChip id="es.investidura.plazo" /></p>
        <Hemicycle game={game} seats={comp} majority={Math.floor(members / 2) + 1} />
        <p className="small">{f.firstVoteOn ? <>Primera votación: {fmtDate(f.firstVoteOn)} · si nadie es investido antes del <b>{deadline ? fmtDate(deadline) : '—'}</b>, se disuelven las Cortes.</> : 'Aún no ha habido votaciones: el plazo de dos meses empieza con la primera.'}</p>
        <p className="small">Gobierno en funciones: <PartyName game={game} id={f.caretaker} />. Tras las consultas, el Rey propondría a: <b><PartyName game={game} id={king} /></b>.</p>
      </div>
      {decision ? (
        <div className="card">
          <h3>{decision.title}</h3><p className="small">{decision.detail}</p>
          <div className="row">{decision.options.map((o) => <button key={o.id} className="btn" onClick={() => { autosave(game, 'voto de investidura'); setGame(resolveDecision(game, decision.id, o.id)); }}>{o.label}</button>)}</div>
        </div>
      ) : null}
      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Negociar apoyos para {me.short}</h3><LayerBadge layer="simulacion" /></div>
        <p className="small muted">Cada partido responde según su distancia programática con usted, la existencia de alternativas más cercanas y un componente incierto. Un partido sólo puede cerrar un acuerdo con usted.</p>
        {game.parties.filter((p) => p.id !== me.id && (comp[p.id] ?? 0) > 0).map((p) => (
          <div key={p.id} className="card flat">
            <div className="row between"><PartyName game={game} id={p.id} /><span className="small">{comp[p.id]} escaños · distancia {nf(Math.hypot(p.econ - me.econ, p.social - me.social), 2)}</span></div>
            {deals[p.id] ? <div className="notice ok small">Acuerdo cerrado: {DEALS[deals[p.id] as DealKind].label}</div> : (
              <div className="row" style={{ marginTop: 6 }}>
                {(Object.keys(DEALS) as DealKind[]).map((k) => <button key={k} className="btn sm" title={DEALS[k].explain} onClick={() => { const r = offerDeal(game, p.id, k); setMsg(r.message); setGame(r.game); }}>{DEALS[k].label}</button>)}
              </div>
            )}
          </div>
        ))}
        {msg ? <div className="notice info small">{msg}</div> : null}
      </div>
      <div className="card">
        <h3>Votación estimada de su investidura</h3>
        <p className="small">{est.tally.yes} sí · {est.tally.no} no · {est.tally.abstain} abstenciones → primera votación: <b className={est.first ? 'up' : 'down'}>{est.first ? 'aprobada' : 'no alcanza 176'}</b> · segunda: <b className={est.second ? 'up' : 'down'}>{est.second ? 'aprobada' : 'rechazada'}</b></p>
        <button className="btn gold" onClick={() => { autosave(game, 'antes de la investidura'); const r = requestInvestiture(game); setGame(r.game); notify(r.message); }}>Someterse a la investidura</button>
        <p className="small muted">Coaliciones y acuerdos programáticos condicionarán su programa; la inversión territorial cuesta 0,1 % del PIB anual.</p>
      </div>
      {f.attempts.length ? (
        <div className="card"><h3>Votaciones realizadas</h3><ul className="small">{f.attempts.map((a, i) => <li key={i}>{fmtDate(a.date)} · {game.parties.find((p) => p.id === a.candidateParty)?.short} · {a.vote}.ª votación: {a.yes} sí, {a.no} no, {a.abstain} abst. → {a.passed ? 'investido' : 'rechazado'}</li>)}</ul></div>
      ) : null}
      <p className="small muted">Prioridades de los partidos: {game.parties.filter((p) => comp[p.id]).map((p) => `${p.short}: ${p.priorities.map((x) => ISSUES[x].name).join('/')}`).join(' · ')}</p>
    </div>
  );
}
