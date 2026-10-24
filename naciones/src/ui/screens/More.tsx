import { useMemo, useRef, useState } from 'react';
import { COUNTRIES, getCountry } from '../../data/countries';
import { GLOSSARY } from '../../data/glossary';
import { fmtDate, monthsBetween } from '../../engine/calendar';
import { indicators } from '../../engine/economy/model';
import { nationalEstimate } from '../../engine/electoral/elections';
import { news } from '../../engine/news';
import { createBranch, deleteSlot, listSlots, loadSlot, parseSave, saveSlot, serialize } from '../../engine/save/save';
import type { GameState } from '../../engine/types';
import { LineChart, Sparkline, TileMap } from '../components/charts';
import { Empty, fmtValue, LayerBadge, nf, PartyName, Term, VerifBadge } from '../components/common';
import { useApp, useGame, type MorePage } from '../store';
import { ElectionView } from './Results';
import { IND_META } from './Summary';

const PAGES: { id: MorePage; label: string; desc: string }[] = [
  { id: 'mapa', label: 'Mapa territorial', desc: 'Voto, escaños y gobiernos por territorio' },
  { id: 'indicadores', label: 'Indicadores y cuentas públicas', desc: 'Series, presupuesto, déficit y deuda' },
  { id: 'elecciones', label: 'Elecciones', desc: 'Resultados y cómo se repartieron los escaños' },
  { id: 'noticias', label: 'Noticias', desc: 'Generadas sólo a partir de hechos del motor' },
  { id: 'historial', label: 'Historial', desc: 'Decisiones, votaciones y cambios institucionales' },
  { id: 'comparar', label: 'Comparar ramas', desc: 'Dos versiones de la misma partida' },
  { id: 'guardar', label: 'Guardar, cargar y exportar', desc: 'Partidas locales, archivos y ramas' },
  { id: 'glosario', label: 'Glosario', desc: 'Conceptos explicados de forma sencilla' },
  { id: 'fuentes', label: 'Fuentes y alcance', desc: 'De dónde salen las reglas y los datos' },
  { id: 'acerca', label: 'El modelo y sus límites', desc: 'Supuestos de la simulación' },
];

export function More() {
  const { more, setMore, setTutorial } = useApp();
  if (more === 'menu')
    return (
      <div className="stack">
        {PAGES.map((p) => <button key={p.id} className="card countrycard" onClick={() => setMore(p.id)}><b>{p.label}</b><div className="small muted">{p.desc}</div></button>)}
        <button className="card countrycard" onClick={() => setTutorial(true)}><b>Repetir el tutorial</b><div className="small muted">Recorrido breve por el juego</div></button>
      </div>
    );
  const page = PAGES.find((p) => p.id === more)!;
  return (
    <div className="stack">
      <div className="row between"><h2 style={{ margin: 0 }}>{page.label}</h2><button className="btn sm" onClick={() => setMore('menu')}>Volver</button></div>
      {more === 'mapa' && <MapPage />}
      {more === 'indicadores' && <IndicatorsPage />}
      {more === 'elecciones' && <ElectionsPage />}
      {more === 'noticias' && <NewsPage />}
      {more === 'historial' && <HistoryPage />}
      {more === 'comparar' && <ComparePage />}
      {more === 'guardar' && <SavePage />}
      {more === 'glosario' && <GlossaryPage />}
      {more === 'fuentes' && <SourcesPage />}
      {more === 'acerca' && <AboutPage />}
    </div>
  );
}

function MapPage() {
  const game = useGame();
  const c = getCountry(game.country);
  const [mode, setMode] = useState<'intencion' | 'eleccion' | 'gobierno'>('intencion');
  const [sel, setSel] = useState<string | null>(null);
  const est = useMemo(() => nationalEstimate(game), [game]);
  const last = [...game.elections].reverse().find((e) => e.office === c.chambers[0].id);
  const color = (pid?: string) => game.parties.find((p) => p.id === pid)?.color ?? '#9aa';
  const top = (sh?: Record<string, number>) => Object.entries(sh ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  const regionOf = (tid: string) => {
    const t = c.territories.find((x) => x.id === tid)!;
    return game.regional.find((r) => r.group === (game.country === 'us' ? t.id : t.group))?.party;
  };
  const colorOf = (id: string) => (mode === 'intencion' ? color(top(est.byTerritory[id])) : mode === 'eleccion' ? color(last?.byTerritory[id]?.winner ?? top(last?.byTerritory[id]?.shares)) : color(regionOf(id)));
  const t = sel ? c.territories.find((x) => x.id === sel) : null;
  return (
    <div className="stack">
      <div className="chips">
        <button className={`chip${mode === 'intencion' ? ' on' : ''}`} onClick={() => setMode('intencion')}>Intención de voto (modelo)</button>
        <button className={`chip${mode === 'eleccion' ? ' on' : ''}`} onClick={() => setMode('eleccion')} disabled={!last}>Última elección</button>
        {game.regional.length ? <button className={`chip${mode === 'gobierno' ? ' on' : ''}`} onClick={() => setMode('gobierno')}>Gobiernos territoriales</button> : null}
      </div>
      <div className="card">
        <TileMap game={game} colorOf={colorOf} selected={sel} onSelect={setSel} />
        <div className="legend">{game.parties.map((p) => <span key={p.id}><span className="swatch" style={{ background: p.color }} />{p.short}</span>)}</div>
        <p className="small muted">Rejilla aproximada: cada casilla es un {c.territoryLabel.toLowerCase().replace(/s$/, '')}; la posición es orientativa y el tamaño no refleja la población. <LayerBadge layer="simulacion" /></p>
      </div>
      {t ? (
        <div className="card">
          <h3>{t.name}</h3>
          <p className="small">Peso de población usado (aprox.): {t.pop.toLocaleString('es-ES')} mil · Urbanización: {nf(t.urban * 100, 0)} %{t.group ? ` · ${c.groups?.find((g) => g.id === t.group)?.name ?? ''}` : ''}</p>
          <p className="small">Escaños: {Object.entries(t.seats).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>
          {regionOf(t.id) ? <p className="small">Gobierno territorial (simulado): <PartyName game={game} id={regionOf(t.id)!} /></p> : null}
          <table className="table small"><thead><tr><th>Partido</th><th className="num">Intención (modelo)</th>{last ? <th className="num">Última elección</th> : null}</tr></thead>
            <tbody>{Object.entries(est.byTerritory[t.id] ?? {}).sort((a, b) => b[1] - a[1]).map(([p, s]) => <tr key={p}><td><PartyName game={game} id={p} short /></td><td className="num">{nf(s * 100)} %</td>{last ? <td className="num">{nf(last.byTerritory[t.id]?.shares[p] ?? 0)} %</td> : null}</tr>)}</tbody></table>
        </div>
      ) : <p className="small muted">Toque un territorio para ver detalles.</p>}
    </div>
  );
}

function IndicatorsPage() {
  const game = useGame();
  const c = getCountry(game.country);
  const ind = indicators(game);
  const [k, setK] = useState('deuda');
  const series = game.history.map((h, i) => ({ x: i, y: h.ind[k] ?? 0 }));
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const e = game.economy;
  const rev = sum(e.flows.rev), sp = sum(e.flows.spend), it = sum(e.flows.int), gdp = sum(e.flows.gdp);
  return (
    <div className="stack">
      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>{IND_META[k]?.label}</h3><LayerBadge layer="simulacion" /></div>
        <p className="small muted">{IND_META[k]?.desc} {IND_META[k]?.term ? <Term id={IND_META[k].term!}>(concepto)</Term> : null}</p>
        <LineChart series={[{ label: IND_META[k]?.label ?? k, color: 'var(--legal)', values: series }]} xLabels={[game.history[0] ? fmtDate(game.history[0].date) : '', fmtDate(game.date)]} />
      </div>
      <div className="grid3">
        {Object.keys(IND_META).map((key) => (
          <button key={key} className={`stat${k === key ? ' on' : ''}`} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', outline: k === key ? '2px solid var(--legal)' : undefined }} onClick={() => setK(key)}>
            <div className="lbl">{IND_META[key].label}</div>
            <div className="val" style={{ fontSize: '1.1rem' }}>{nf((ind as unknown as Record<string, number>)[key])}{IND_META[key].unit.startsWith('%') ? ' %' : ''}</div>
            <Sparkline values={game.history.map((h) => h.ind[key] ?? 0)} />
          </button>
        ))}
      </div>
      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Cuentas públicas (últimos 12 meses)</h3><LayerBadge layer="simulacion" /></div>
        <table className="table small">
          <tbody>
            <tr><th>Ingresos</th><td className="num">{nf(rev, 1)}</td><td className="num">{nf((rev / gdp) * 100)} % PIB</td></tr>
            <tr><th>Gasto primario</th><td className="num">{nf(sp, 1)}</td><td className="num">{nf((sp / gdp) * 100)} % PIB</td></tr>
            <tr><th>Intereses de la deuda</th><td className="num">{nf(it, 1)}</td><td className="num">{nf((it / gdp) * 100)} % PIB</td></tr>
            <tr><th><Term id="deficit" /> = gasto + intereses − ingresos</th><td className="num"><b>{nf(sp + it - rev, 1)}</b></td><td className="num"><b>{nf(((sp + it - rev) / gdp) * 100)} % PIB</b></td></tr>
            <tr><th><Term id="deuda" /> acumulada</th><td className="num">{nf(e.debt, 1)}</td><td className="num">{nf(ind.deuda)} % PIB</td></tr>
            <tr><th>PIB nominal (12 meses)</th><td className="num">{nf(gdp, 1)}</td><td /></tr>
            <tr><th>Coste medio de la deuda</th><td className="num">{nf(e.effectiveDebtRate, 2)} %</td><td /></tr>
          </tbody>
        </table>
        <p className="small muted">Importes en miles de millones de {c.economy.currency}, en términos <Term id="nominal-real">nominales</Term>. La deuda de cada mes es la del mes anterior más el déficit del mes. Nivel de precios: {nf(e.priceLevel, 3)} (1 = inicio).</p>
      </div>
      <div className="card">
        <h3>Datos observados de partida</h3>
        <table className="table small"><tbody>{c.economy.observed.map((o) => <tr key={o.key}><td>{o.label}</td><td>{o.value}</td><td>{o.year}</td><td><VerifBadge v={o.verification} /></td><td className="small">{c.sources.find((s) => s.id === o.sourceId)?.publisher}</td></tr>)}</tbody></table>
        <p className="small muted">El juego toma estos valores como punto de partida en la fecha de inicio sin extrapolarlos. <LayerBadge layer="observada" /></p>
      </div>
      <div className="card">
        <h3>Organizaciones</h3>
        {game.groups.map((g) => <p key={g.id} className="small" style={{ margin: 0 }}>{g.name}: {g.mood > 0.3 ? 'satisfecha' : g.mood < -0.3 ? 'descontenta' : 'expectante'} ({nf(g.mood, 2)})</p>)}
        <h3 style={{ marginTop: 10 }}>Aprobación por grupos de electores</h3>
        {Object.entries(game.economy.segmentApproval).map(([s, v]) => <p key={s} className="small" style={{ margin: 0 }}>{s}: {nf(v, 0)}</p>)}
        <p className="small muted">Los grupos no son bloques uniformes: dentro de cada uno hay votantes con posiciones distintas.</p>
      </div>
    </div>
  );
}

function ElectionsPage() {
  const game = useGame();
  const [i, setI] = useState(game.elections.length - 1);
  if (!game.elections.length) return <Empty>Todavía no se han celebrado elecciones en la partida.</Empty>;
  const r = game.elections[Math.max(0, Math.min(i, game.elections.length - 1))];
  return (
    <div className="stack">
      <div className="chips">{game.elections.map((e, k) => <button key={e.id} className={`chip${k === i ? ' on' : ''}`} onClick={() => setI(k)}>{fmtDate(e.date)} · {e.office}</button>)}</div>
      <div className="card"><ElectionView game={game} result={r} /></div>
    </div>
  );
}

function NewsPage() {
  const game = useGame();
  const items = news(game, 60);
  if (!items.length) return <Empty>Sin noticias todavía.</Empty>;
  return (
    <div className="stack">
      <p className="small muted">Cada noticia procede de una entrada del registro del motor; no se inventan hechos.</p>
      {items.map((x) => <div key={x.id} className="card flat"><div className="row between small muted"><span>{x.section} · {fmtDate(x.date)}</span><LayerBadge layer={x.layer} /></div><b>{x.headline}</b><p className="small" style={{ margin: 0 }}>{x.lede}</p></div>)}
    </div>
  );
}

function HistoryPage() {
  const game = useGame();
  const [f, setF] = useState<'todo' | 'instituciones' | 'votaciones' | 'eventos'>('todo');
  const kinds: Record<string, string[]> = { instituciones: ['reforma-vigente', 'ley-vigente', 'intento-invalido', 'gobierno', 'investidura'], votaciones: ['votacion', 'rechazo', 'procedimiento'], eventos: ['evento', 'economia', 'campana'] };
  const list = game.log.filter((l) => f === 'todo' || kinds[f].includes(l.kind)).slice().reverse();
  return (
    <div className="stack">
      <div className="chips">{(['todo', 'instituciones', 'votaciones', 'eventos'] as const).map((k) => <button key={k} className={`chip${f === k ? ' on' : ''}`} onClick={() => setF(k)}>{{ todo: 'Todo', instituciones: 'Cambios institucionales', votaciones: 'Trámites y votaciones', eventos: 'Eventos y economía' }[k]}</button>)}</div>
      {list.length ? list.map((l) => <div key={l.id} className="card flat"><div className="row between small muted"><span>{fmtDate(l.date)}</span><LayerBadge layer={l.layer} /></div><b className="small">{l.title}</b><p className="small" style={{ margin: 0 }}>{l.detail}</p></div>) : <Empty>Nada que mostrar con este filtro.</Empty>}
    </div>
  );
}

function ComparePage() {
  const game = useGame();
  const { storage, setGame, notify } = useApp();
  const slots = listSlots(storage).filter((s) => s.gameId === game.id);
  const [a, setA] = useState<string>('actual');
  const [b, setB] = useState<string>(slots.find((s) => s.branchId !== game.branchId)?.id ?? '');
  const [k, setK] = useState('aprobacion');
  const get = (id: string): GameState | null => (id === 'actual' ? game : id ? loadSlot(storage, id).state ?? null : null);
  const A = get(a), B = get(b);
  const mk = (g: GameState, color: string, dashed?: boolean) => ({ label: `${g.branchLabel} (${fmtDate(g.date)})`, color, dashed, values: g.history.map((h) => ({ x: monthsBetween(g.startDate, h.date), y: h.ind[k] ?? 0 })) });
  const branchHere = () => {
    const label = `Rama ${new Date().toLocaleTimeString('es-ES')}`;
    const br = createBranch(game, label);
    saveSlot(storage, `rama-${game.branchId}`, `Punto de partida (${game.branchLabel})`, game);
    saveSlot(storage, br.branchId, label, br);
    setGame(br);
    notify('Rama creada: la versión anterior quedó guardada. Juegue de forma distinta y compare.');
  };
  return (
    <div className="stack">
      <div className="notice info small">Las dos ramas comparten semilla, estado inicial y eventos externos (dependen sólo de la semilla y del mes). Las diferencias son resultados del modelo bajo sus supuestos; <b>no prueban causalidad en la vida real</b>.</div>
      <button className="btn primary" onClick={branchHere}>Crear una rama desde aquí</button>
      {slots.length === 0 ? <Empty>No hay otras versiones guardadas de esta partida. Cree una rama para comparar.</Empty> : null}
      <div className="grid2">
        <label className="field"><span>Rama A</span><select value={a} onChange={(e) => setA(e.target.value)}><option value="actual">Partida actual ({game.branchLabel})</option>{slots.map((s) => <option key={s.id} value={s.id}>{s.label} · {s.branchLabel} · {fmtDate(s.date)}</option>)}</select></label>
        <label className="field"><span>Rama B</span><select value={b} onChange={(e) => setB(e.target.value)}><option value="">—</option><option value="actual">Partida actual</option>{slots.map((s) => <option key={s.id} value={s.id}>{s.label} · {s.branchLabel} · {fmtDate(s.date)}</option>)}</select></label>
      </div>
      <div className="chips">{['aprobacion', 'crecimiento', 'desempleo', 'inflacion', 'deuda', 'deficit', 'servicios', 'pobreza', 'confianza'].map((x) => <button key={x} className={`chip${k === x ? ' on' : ''}`} onClick={() => setK(x)}>{IND_META[x].label}</button>)}</div>
      {A && B ? (
        <>
          <div className="card"><LineChart series={[mk(A, 'var(--legal)'), mk(B, 'var(--gold)', true)]} yLabel={IND_META[k].label} /><p className="small muted">Eje horizontal: meses desde el inicio.</p></div>
          <div className="card">
            <h3>Diferencias institucionales</h3>
            <DiffList title="Reformas en A" items={A.amendments.map((x) => `${A.rules[x.ruleId].title}: ${fmtValue(x.value)}`)} other={B.amendments.map((x) => `${B.rules[x.ruleId].title}: ${fmtValue(x.value)}`)} />
            <DiffList title="Reformas en B" items={B.amendments.map((x) => `${B.rules[x.ruleId].title}: ${fmtValue(x.value)}`)} other={A.amendments.map((x) => `${A.rules[x.ruleId].title}: ${fmtValue(x.value)}`)} />
            <DiffList title="Leyes en vigor sólo en A" items={A.procedures.filter((p) => p.status === 'vigente').map((p) => p.title)} other={B.procedures.filter((p) => p.status === 'vigente').map((p) => p.title)} />
            <DiffList title="Leyes en vigor sólo en B" items={B.procedures.filter((p) => p.status === 'vigente').map((p) => p.title)} other={A.procedures.filter((p) => p.status === 'vigente').map((p) => p.title)} />
          </div>
        </>
      ) : <Empty>Elija dos versiones para compararlas.</Empty>}
    </div>
  );
}

function DiffList({ title, items, other }: { title: string; items: string[]; other: string[] }) {
  const only = items.filter((x) => !other.includes(x));
  return <p className="small"><b>{title}:</b> {only.length ? only.join('; ') : 'ninguna diferencia'}</p>;
}

function SavePage() {
  const game = useGame();
  const { storage, setGame, notify } = useApp();
  const [label, setLabel] = useState('Mi partida');
  const [slots, setSlots] = useState(() => listSlots(storage));
  const [err, setErr] = useState<string[] | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const exportFile = () => {
    const blob = new Blob([serialize(game, label)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `naciones-${game.country}-${game.date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const imp = async (f?: File) => {
    if (!f) return;
    const r = parseSave(await f.text());
    if (!r.ok || !r.state) return setErr(r.errors);
    setErr(null);
    if (r.warnings.length) notify(r.warnings.join(' '));
    setGame(r.state);
    notify('Partida importada y validada.');
  };
  return (
    <div className="stack">
      <div className="card">
        <h3>Guardar en este dispositivo</h3>
        <div className="row"><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} style={{ maxWidth: 260 }} aria-label="Nombre del guardado" /><button className="btn primary" onClick={() => { saveSlot(storage, `manual-${Date.now()}`, label, game); setSlots(listSlots(storage)); notify('Partida guardada.'); }}>Guardar</button></div>
        <p className="small muted">El juego guarda automáticamente al avanzar cada turno y antes de decisiones importantes (presentar reformas, votaciones de investidura, disoluciones).</p>
      </div>
      <div className="card">
        <h3>Archivo</h3>
        <div className="row"><button className="btn" onClick={exportFile}>Exportar (.json)</button><button className="btn" onClick={() => file.current?.click()}>Importar</button><input ref={file} hidden type="file" accept=".json,application/json" onChange={(e) => imp(e.target.files?.[0])} /></div>
        <p className="small muted">El archivo incluye la versión de reglas ({game.rulesetVersion}) y una suma de verificación. Al importar se valida la estructura; un archivo dañado o modificado se rechaza.</p>
        {err ? <div className="notice err small">{err.map((e) => <div key={e}>{e}</div>)}</div> : null}
      </div>
      <div className="card">
        <h3>Guardados</h3>
        {slots.length ? slots.map((s) => (
          <div key={s.id} className="row between" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
            <div className="small"><b>{s.label}</b> · {COUNTRIES[s.country as keyof typeof COUNTRIES]?.name} · {fmtDate(s.date)}<div className="muted">{s.branchLabel}</div></div>
            <div className="row"><button className="btn sm" onClick={() => { const r = loadSlot(storage, s.id); if (r.state) { setGame(r.state); notify('Partida cargada.'); } else setErr(r.errors); }}>Cargar</button><button className="btn sm danger" onClick={() => { deleteSlot(storage, s.id); setSlots(listSlots(storage)); }}>Borrar</button></div>
          </div>
        )) : <Empty>No hay partidas guardadas.</Empty>}
      </div>
    </div>
  );
}

function GlossaryPage() {
  const [q, setQ] = useState('');
  const list = GLOSSARY.filter((g) => (g.term + g.def).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="stack">
      <input type="search" placeholder="Buscar un concepto…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en el glosario" />
      {list.length ? list.map((g) => <div key={g.id} className="card flat"><b>{g.term}</b><p className="small" style={{ margin: 0 }}>{g.def}</p>{g.example ? <p className="small muted" style={{ margin: 0 }}>Ejemplo: {g.example}</p> : null}</div>) : <Empty>Sin resultados.</Empty>}
    </div>
  );
}

function SourcesPage() {
  const game = useGame();
  const c = getCountry(game.country);
  return (
    <div className="stack">
      <div className="card">
        <h3>Alcance para {c.name} <span className={`badge ${c.status === 'completo' ? 'contrastada' : 'simplificacion'}`}>{c.status}</span></h3>
        <b className="small">Implementado</b><ul className="small">{c.coverage.implemented.map((x) => <li key={x}>{x}</li>)}</ul>
        <b className="small">Simplificado</b><ul className="small">{c.coverage.simplified.map((x) => <li key={x}>{x}</li>)}</ul>
        <b className="small">Pendiente</b><ul className="small">{c.coverage.pending.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
      <div className="notice warn small">Durante el desarrollo, el entorno no permitió descargar directamente los textos oficiales; las reglas «contrastadas» se verificaron con búsquedas en fuentes oficiales y reproducciones fiables del texto. Las marcadas «pendiente de cotejo» deben revisarse en el texto oficial enlazado.</div>
      {c.sources.map((s) => (
        <div key={s.id} className="card flat">
          <b className="small">{s.title}</b>
          <div className="small muted">{s.publisher} · {s.kind}{s.published ? ` · publicada ${fmtDate(s.published)}` : ''}{s.inForce ? ` · en vigor ${fmtDate(s.inForce)}` : ''}</div>
          <a className="small" href={s.url} target="_blank" rel="noreferrer">{s.url}</a>
          {s.note ? <p className="small" style={{ margin: 0 }}>{s.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

function AboutPage() {
  return (
    <div className="stack small">
      <div className="card">
        <h3>Tres capas</h3>
        <p><LayerBadge layer="juridica" /> El motor jurídico decide si una acción puede tramitarse y cómo: quién la inicia, qué mayorías y plazos exige. Cada regla tiene fuente, artículo, fecha de consulta y vigencia.</p>
        <p><LayerBadge layer="observada" /> Datos estadísticos de partida (PIB, deuda, déficit, desempleo…), con su fuente y año.</p>
        <p><LayerBadge layer="simulacion" /> Todo lo demás: votos, escaños, reacciones de actores, economía mes a mes. Son escenarios con supuestos explícitos, no predicciones.</p>
      </div>
      <div className="card">
        <h3>Supuestos principales</h3>
        <ul>
          <li>Electores: siete segmentos con dispersión interna amplia; votan por cercanía ideológica, prioridades, popularidad y movilización (modelo logit).</li>
          <li>Economía: brecha de producción con multiplicadores fiscales y demoras; inflación con inercia; desempleo por la ley de Okun; deuda = deuda anterior + déficit.</li>
          <li>Servicios públicos: responden al gasto real ejecutado con meses o años de retraso, limitados por la capacidad administrativa.</li>
          <li>Bancos centrales y la UE quedan fuera del control del jugador.</li>
          <li>Eventos externos con probabilidades fijadas como parámetros; los internos dependen del estado de la partida.</li>
        </ul>
        <p>Detalle completo en docs/MODELO.md.</p>
      </div>
    </div>
  );
}
