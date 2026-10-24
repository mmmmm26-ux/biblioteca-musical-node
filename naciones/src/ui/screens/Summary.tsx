import { getCountry } from '../../data/countries';
import { daysBetween, fmtDate } from '../../engine/calendar';
import { indicators } from '../../engine/economy/model';
import { campaignOpen, nextElection } from '../../engine/game';
import { composition } from '../../engine/electoral/elections';
import { news } from '../../engine/news';
import type { CauseKind, GameState } from '../../engine/types';
import { Hemicycle } from '../components/charts';
import { Empty, LayerBadge, nf, PartyName, signed, Stat, Term } from '../components/common';
import { useApp, useGame } from '../store';

export const IND_META: Record<string, { label: string; unit: string; good?: 'up' | 'down'; term?: string; desc: string }> = {
  crecimiento: { label: 'Crecimiento del PIB real', unit: '% anual', good: 'up', term: 'pib', desc: 'Variación del PIB real en los últimos 12 meses.' },
  inflacion: { label: 'Inflación', unit: '% anual', good: 'down', term: 'inflacion', desc: 'Subida de precios en 12 meses. El banco central (o el BCE) la controla, no el Gobierno.' },
  desempleo: { label: 'Desempleo', unit: '%', good: 'down', desc: 'Porcentaje de la población activa sin empleo.' },
  pobreza: { label: 'Pobreza', unit: '%', good: 'down', desc: 'Indicador de pobreza del país (definición nacional aproximada).' },
  deuda: { label: 'Deuda pública', unit: '% del PIB', good: 'down', term: 'deuda', desc: 'Deuda total respecto al PIB de los últimos 12 meses.' },
  deficit: { label: 'Déficit público', unit: '% del PIB', good: 'down', term: 'deficit', desc: 'Gasto + intereses − ingresos de los últimos 12 meses.' },
  servicios: { label: 'Servicios públicos', unit: 'índice', good: 'up', desc: 'Promedio de salud, educación, seguridad e infraestructura (50 = nivel inicial).' },
  confianza: { label: 'Confianza institucional', unit: 'índice', good: 'up', desc: 'Índice del modelo (50 = inicial).' },
  aprobacion: { label: 'Aprobación del Ejecutivo', unit: '%', good: 'up', desc: 'Estimación del modelo a partir de los segmentos de electores.' },
  medioambiente: { label: 'Calidad ambiental', unit: 'índice', good: 'up', desc: 'Índice del modelo (50 = inicial).' },
  salud: { label: 'Salud', unit: 'índice', good: 'up', desc: 'Calidad del servicio (índice del modelo).' },
  educacion: { label: 'Educación', unit: 'índice', good: 'up', desc: 'Calidad del servicio (índice del modelo).' },
  seguridad: { label: 'Seguridad', unit: 'índice', good: 'up', desc: 'Calidad del servicio (índice del modelo).' },
  infraestructura: { label: 'Infraestructura', unit: 'índice', good: 'up', desc: 'Calidad del servicio (índice del modelo).' },
  capacidad: { label: 'Capacidad administrativa', unit: 'índice', good: 'up', term: 'capacidad-administrativa', desc: 'Capacidad de ejecutar el gasto (índice del modelo).' },
  tipo: { label: 'Tipo de interés oficial', unit: '%', desc: 'Lo fija el banco central (no el jugador).' },
};

const KIND_LABEL: Record<CauseKind, string> = { decision: 'Decisión', evento: 'Evento externo', aleatorio: 'Aleatorio', tendencia: 'Tendencia/inercia', institucional: 'Institucional' };

export function WhyPanel({ game, compact }: { game: GameState; compact?: boolean }) {
  const rep = game.reports[game.reports.length - 1];
  if (!rep) return <Empty>Todavía no ha pasado ningún turno. Avance el calendario para ver qué cambió y por qué.</Empty>;
  const keys = ['aprobacion', 'crecimiento', 'inflacion', 'desempleo', 'deuda', 'deficit', 'servicios', 'confianza'];
  const actIndicator: Record<string, string> = { crecimiento: 'actividad' };
  return (
    <div className="stack">
      <p className="small muted">Del {fmtDate(rep.from)} al {fmtDate(rep.to)}. Cada cambio se descompone en <span className="kind-decision">decisiones</span>, <span className="kind-evento">eventos externos</span>, <span className="kind-aleatorio">componentes aleatorios</span>, <span className="kind-tendencia">inercia</span> y efectos <span className="kind-institucional">institucionales</span>. Son resultados del modelo, no mediciones.</p>
      {keys.slice(0, compact ? 4 : keys.length).map((k) => {
        const meta = IND_META[k];
        const ind = actIndicator[k] ?? (k === 'servicios' ? 'salud' : k);
        const cs = rep.contributions.filter((c) => c.indicator === ind).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 5);
        const d = rep.deltas[k] ?? 0;
        return (
          <div key={k} className="card flat">
            <div className="row between"><b>{meta.label}</b><span className={`mono ${Math.abs(d) < 0.005 ? 'muted' : (d > 0) === (meta.good === 'up') ? 'up' : 'down'}`}>{signed(d, 2)} {meta.unit === '%' || meta.unit.startsWith('%') ? 'pp' : ''}</span></div>
            {k === 'crecimiento' ? <p className="small muted" style={{ margin: 0 }}>Aportes a la brecha de actividad este mes (puntos porcentuales del PIB):</p> : null}
            {cs.length ? (
              <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {cs.map((c, i) => <li key={i}><span className={`kind-${c.kind}`}>{KIND_LABEL[c.kind]}</span>: {c.label} <span className="mono">({signed(c.value, 3)})</span></li>)}
              </ul>
            ) : <p className="small muted" style={{ margin: 0 }}>Sin cambios relevantes atribuibles.</p>}
          </div>
        );
      })}
      {rep.notes.length ? (
        <div className="card flat"><b>Lo que ocurrió en el turno</b><ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>{rep.notes.slice(-10).map((n, i) => <li key={i}>{n}</li>)}</ul></div>
      ) : null}
    </div>
  );
}

export function Summary() {
  const game = useGame();
  const { openModal, setTab, setMore } = useApp();
  const c = getCountry(game.country);
  const ind = indicators(game);
  const rep = game.reports[game.reports.length - 1];
  const ne = nextElection(game);
  const exec = game.parties.find((p) => p.id === game.government.executiveParty);
  const mainCh = c.chambers[0];
  const comp = composition(game, mainCh.id);
  const members = Object.values(comp).reduce((a, b) => a + b, 0);
  const n = news(game, 4);
  const initial = game.history[0]?.ind ?? {};
  return (
    <div className="stack">
      {game.decisions.length ? (
        <div className="notice warn"><b>Decisiones pendientes ({game.decisions.length}).</b> <button className="btn sm" onClick={() => setTab('congreso')}>Ver</button></div>
      ) : null}
      <div className="card">
        <div className="row between"><h2 style={{ margin: 0 }}>{c.name}</h2><span className="badge neutral">{c.system.label}</span></div>
        <p className="small" style={{ marginTop: 6 }}>
          {c.executive.title}: <b>{game.government.executiveName}</b> {exec ? <>(<PartyName game={game} id={exec.id} short />)</> : null}
          {game.government.coalition.length > 1 ? <> · Coalición: {game.government.coalition.map((p) => game.parties.find((x) => x.id === p)?.short).join(' + ')}</> : null}
        </p>
        <p className="small" style={{ margin: 0 }}>
          Su papel: <b>{game.playerRole === 'gobierno' ? 'Gobierno' : game.playerRole === 'oposicion' ? 'Oposición' : game.phase === 'formacion' ? 'Negociando la investidura' : 'Candidatura'}</b>
          {ne ? <> · Próximas elecciones: <b>{fmtDate(ne.date)}</b> ({daysBetween(game.date, ne.date)} días)</> : null}
        </p>
        {game.installs.length ? <p className="small muted" style={{ margin: 0 }}>Pendiente: {game.installs.map((i) => `${i.office === 'presidencia' ? 'toma de posesión' : 'constitución de ' + (c.chambers.find((x) => x.id === i.office)?.short ?? i.office)} el ${fmtDate(i.date)}`).join(' · ')}</p> : null}
        {campaignOpen(game) ? <div className="notice info small" style={{ marginTop: 8 }}>La campaña está abierta. <button className="btn sm" onClick={() => setTab('campana')}>Ir a campaña</button></div> : null}
        {game.phase === 'formacion' ? <div className="notice info small" style={{ marginTop: 8 }}>Negociación de investidura en curso. <button className="btn sm" onClick={() => setTab('gobierno')}>Negociar</button></div> : null}
      </div>

      <div className="section-title"><h2>Indicadores</h2><button className="btn sm" onClick={() => { setTab('mas'); setMore('indicadores'); }}>Ver todos</button></div>
      <div className="grid3">
        {(['aprobacion', 'crecimiento', 'inflacion', 'desempleo', 'deuda', 'deficit', 'pobreza', 'servicios', 'confianza'] as const).map((k) => (
          <Stat key={k} label={IND_META[k].label} value={`${nf(ind[k])}${IND_META[k].unit.startsWith('%') ? ' %' : ''}`} delta={rep?.deltas[k]} good={IND_META[k].good} layer={game.history.length <= 1 && ['crecimiento', 'inflacion', 'desempleo', 'deuda', 'deficit', 'pobreza'].includes(k) ? 'observada' : 'simulacion'} />
        ))}
      </div>
      <p className="small muted">Valores iniciales de crecimiento, inflación, desempleo, deuda, déficit y pobreza: <LayerBadge layer="observada" /> datos de referencia del último año disponible (aprox.). Desde el primer turno, todos son <LayerBadge layer="simulacion" />. Inicial: deuda {nf(initial.deuda ?? 0)} %, déficit {nf(initial.deficit ?? 0)} %.</p>

      <div className="section-title"><h2>¿Por qué pasó esto?</h2><button className="btn sm" onClick={() => openModal({ kind: 'why' })}>Detalle completo</button></div>
      <WhyPanel game={game} compact />

      <div className="section-title"><h2>{mainCh.name}</h2><button className="btn sm" onClick={() => setTab('congreso')}>Congreso</button></div>
      <div className="card">{members ? <Hemicycle game={game} seats={comp} majority={Math.floor(members / 2) + 1} /> : <Empty>Sin composición todavía.</Empty>}
        <p className="small muted" style={{ marginTop: 6 }}>Mayoría absoluta: más de la mitad de los miembros (<Term id="mayoria-absoluta" />).</p></div>

      <div className="section-title"><h2>Noticias</h2><button className="btn sm" onClick={() => { setTab('mas'); setMore('noticias'); }}>Más</button></div>
      {n.length ? n.map((x) => (
        <div key={x.id} className="card flat"><div className="row between small muted"><span>{x.section} · {fmtDate(x.date)}</span><LayerBadge layer={x.layer} /></div><b>{x.headline}</b><p className="small" style={{ margin: 0 }}>{x.lede}</p></div>
      )) : <Empty>Sin noticias todavía.</Empty>}
    </div>
  );
}
