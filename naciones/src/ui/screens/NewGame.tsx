import { useMemo, useState } from 'react';
import { COUNTRIES } from '../../data/countries';
import { ISSUES } from '../../data/segments';
import { fmtDate } from '../../engine/calendar';
import { newGame } from '../../engine/game';
import type { CountryId, GameState, IssueId } from '../../engine/types';
import { Term } from '../components/common';
import { useApp } from '../store';

const COLORS = ['#7b2cbf', '#0077b6', '#e76f51', '#2a9d8f', '#d62828', '#6a994e', '#f4a261', '#3d405b'];
const GENERIC_PROMISES = ['Mejorar la sanidad pública', 'Bajar los impuestos a las familias', 'Más seguridad ciudadana', 'Crear empleo de calidad', 'Invertir en infraestructura', 'Proteger el medioambiente', 'Reforzar la transparencia y el control del poder', 'Equilibrar las cuentas públicas'];

function randomSeed() {
  return Math.random().toString(36).slice(2, 8);
}

export function NewGame({ onCancel }: { onCancel: () => void }) {
  const { setGame, setTab, setTutorial, autosave } = useApp();
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState<CountryId>('sv');
  const [difficulty, setDifficulty] = useState<GameState['difficulty']>('normal');
  const [mode, setMode] = useState<'nuevo' | 'existente'>('nuevo');
  const [base, setBase] = useState<string>('');
  const [name, setName] = useState('Movimiento Ciudadano Renovador');
  const [short, setShort] = useState('MCR');
  const [color, setColor] = useState(COLORS[0]);
  const [econ, setEcon] = useState(0);
  const [social, setSocial] = useState(0);
  const [prios, setPrios] = useState<IssueId[]>(['empleo', 'salud', 'instituciones']);
  const [leader, setLeader] = useState('Alex Rivera');
  const [promises, setPromises] = useState<string[]>([]);
  const [seed, setSeed] = useState(randomSeed);
  const c = COUNTRIES[country];
  const baseParty = c.parties.find((p) => p.id === base);
  const promiseOptions = useMemo(() => [...GENERIC_PROMISES, ...c.reforms.filter((r) => r.options.length > 1).map((r) => r.title)], [c]);

  const pickCountry = (id: CountryId) => {
    setCountry(id);
    setBase('');
    setMode('nuevo');
    setPromises([]);
  };
  const choosePartyBase = (id: string) => {
    setBase(id);
    const p = COUNTRIES[country].parties.find((x) => x.id === id);
    if (p) {
      setName(p.name);
      setShort(p.short);
      setColor(p.color);
      setEcon(p.econ);
      setSocial(p.social);
      setPrios(p.priorities);
    }
  };
  const clampToBase = (v: number, b?: number) => (b === undefined ? v : Math.max(b - 0.25, Math.min(b + 0.25, v)));
  const canNext = step === 1 ? name.trim().length > 1 && short.trim().length > 0 && leader.trim().length > 1 && prios.length === 3 && (mode === 'nuevo' || !!base) : true;

  const start = () => {
    const g = newGame({ country, difficulty, seed: seed.trim() || randomSeed(), partyMode: mode, baseParty: base || undefined, party: { name: name.trim(), short: short.trim().slice(0, 6), color, econ: clampToBase(econ, baseParty?.econ), social: clampToBase(social, baseParty?.social), priorities: prios }, leader: leader.trim(), promises });
    autosave(g, 'inicio');
    setTab('resumen');
    setTutorial(true);
    setGame(g);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="grow"><div className="title">Nueva partida</div><div className="sub">Paso {step + 1} de 4</div></div>
        <button className="icon" onClick={onCancel} aria-label="Volver al inicio">✕</button>
      </header>
      <main className="main" style={{ paddingBottom: 32 }}>
        {step === 0 && (
          <div className="stack">
            <h2>1. País y dificultad</h2>
            {(Object.values(COUNTRIES)).map((k) => (
              <button key={k.id} className={`card countrycard${country === k.id ? ' on' : ''}`} onClick={() => pickCountry(k.id)} aria-pressed={country === k.id}>
                <div className="row between"><h3 style={{ margin: 0 }}>{k.name}</h3><span className={`badge ${k.status === 'completo' ? 'contrastada' : 'simplificacion'}`}>{k.status === 'completo' ? 'Implementación completa' : 'Implementación simplificada'}</span></div>
                <div className="small"><b>{k.system.label}</b></div>
                <p className="small muted" style={{ marginTop: 4 }}>{k.system.summary}</p>
                <p className="small" style={{ margin: 0 }}>Escenario: {k.scenario.note} Comienza el {fmtDate(k.scenario.start)}.</p>
              </button>
            ))}
            <div className="card">
              <h3>Dificultad</h3>
              <div className="chips">
                {(['facil', 'normal', 'dificil'] as const).map((d) => <button key={d} className={`chip${difficulty === d ? ' on' : ''}`} onClick={() => setDifficulty(d)}>{{ facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' }[d]}</button>)}
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>La dificultad cambia sus recursos de campaña y la popularidad inicial del gobierno saliente. No cambia ninguna regla jurídica ni favorece a ninguna ideología.</p>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="stack">
            <h2>2. Partido y candidatura (ficticios)</h2>
            <div className="card">
              <div className="chips" style={{ marginBottom: 10 }}>
                <button className={`chip${mode === 'nuevo' ? ' on' : ''}`} onClick={() => setMode('nuevo')}>Fundar un partido nuevo</button>
                <button className={`chip${mode === 'existente' ? ' on' : ''}`} onClick={() => setMode('existente')}>Liderar un partido ficticio existente</button>
              </div>
              {mode === 'existente' ? (
                <div className="chips" style={{ marginBottom: 10 }}>
                  {c.parties.map((p) => <button key={p.id} className={`chip${base === p.id ? ' on' : ''}`} onClick={() => choosePartyBase(p.id)}><span className="swatch" style={{ background: p.color }} />{p.name}</button>)}
                </div>
              ) : null}
              <p className="small muted">{mode === 'nuevo' ? 'Un partido nuevo empieza con poca implantación: en sistemas mayoritarios (como EE. UU.) le costará mucho ganar escaños.' : 'Un partido existente tiene estructura y votantes fieles; puede ajustar su programa, pero no más de un cuarto del espectro sin perder credibilidad.'}</p>
              <label className="field"><span>Nombre del partido</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
              <label className="field"><span>Siglas</span><input type="text" value={short} onChange={(e) => setShort(e.target.value.toUpperCase())} maxLength={6} /></label>
              <div className="field"><span className="small muted">Color</span><div className="chips">{COLORS.map((col) => <button key={col} className={`chip${color === col ? ' on' : ''}`} style={{ background: col, width: 40 }} onClick={() => setColor(col)} aria-label={`Color ${col}`} />)}</div></div>
              <label className="field"><span>Nombre de su candidato o candidata (ficticio)</span><input type="text" value={leader} onChange={(e) => setLeader(e.target.value)} maxLength={40} /></label>
            </div>
            <div className="card">
              <h3>Posición política</h3>
              <label className="field"><span>Economía: más intervención y redistribución ← → más mercado ({econ.toFixed(2)})</span>
                <input type="range" min={-1} max={1} step={0.05} value={econ} onChange={(e) => setEcon(Number(e.target.value))} /></label>
              <label className="field"><span>Sociedad: más progresista/liberal ← → más tradicional/orden ({social.toFixed(2)})</span>
                <input type="range" min={-1} max={1} step={0.05} value={social} onChange={(e) => setSocial(Number(e.target.value))} /></label>
              {baseParty ? <p className="small muted">Se limitará a ±0,25 de la posición histórica del partido ({baseParty.econ.toFixed(2)}, {baseParty.social.toFixed(2)}).</p> : null}
              <p className="small muted">Ninguna posición tiene ventaja de partida: el resultado depende de dónde estén los votantes de cada territorio, de la competencia y de sus decisiones.</p>
            </div>
            <div className="card">
              <h3>Tres prioridades</h3>
              <div className="chips">
                {(Object.keys(ISSUES) as IssueId[]).map((i) => <button key={i} className={`chip${prios.includes(i) ? ' on' : ''}`} onClick={() => setPrios(prios.includes(i) ? prios.filter((x) => x !== i) : prios.length < 3 ? [...prios, i] : prios)}>{ISSUES[i].name}</button>)}
              </div>
              <p className="small muted" style={{ marginTop: 6 }}>Los electores que comparten sus prioridades le valoran más. Seleccionadas: {prios.length}/3.</p>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <h2>3. Propuestas de campaña</h2>
            <div className="card">
              <p className="small muted">Elija hasta tres compromisos. Quedarán registrados en la ficha de su partido para que pueda contrastarlos con lo que haga. Las reformas institucionales deberán seguir su procedimiento real.</p>
              <div className="chips">
                {promiseOptions.map((p) => <button key={p} className={`chip${promises.includes(p) ? ' on' : ''}`} onClick={() => setPromises(promises.includes(p) ? promises.filter((x) => x !== p) : promises.length < 3 ? [...promises, p] : promises)}>{p}</button>)}
              </div>
            </div>
            <div className="card">
              <h3>Semilla aleatoria</h3>
              <p className="small muted">La <Term id="semilla" /> hace que la partida sea reproducible: con la misma semilla y las mismas decisiones se obtiene lo mismo.</p>
              <div className="row"><input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ maxWidth: 220 }} aria-label="Semilla" /><button className="btn sm" onClick={() => setSeed(randomSeed())}>Otra</button></div>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="stack">
            <h2>4. Resumen</h2>
            <div className="card">
              <p><b>{c.name}</b> · {c.system.label} · dificultad {difficulty}</p>
              <p><span className="swatch" style={{ background: color }} /><b>{name}</b> ({short}) — candidatura de {leader}</p>
              <p className="small">Prioridades: {prios.map((p) => ISSUES[p].name).join(', ')}. Compromisos: {promises.length ? promises.join('; ') : 'ninguno'}.</p>
              <p className="small muted">Reglas jurídicas: versión {c.rulesetVersion}. La partida quedará vinculada a esta versión; futuras actualizaciones del juego no cambiarán sus reglas.</p>
              <div className="notice info small">{c.executive.kind === 'parlamentario' ? 'Recuerde: en España ganar las elecciones no basta. Tendrá que conseguir la investidura en el Congreso.' : 'El Ejecutivo se elige por voto directo (en EE. UU., mediante el Colegio Electoral). Gobernar sin mayoría legislativa obliga a negociar.'}</div>
            </div>
          </div>
        )}
        <div className="row between" style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}>{step === 0 ? 'Cancelar' : 'Atrás'}</button>
          {step < 3 ? <button className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Siguiente</button> : <button className="btn gold" onClick={start}>Comenzar la campaña</button>}
        </div>
      </main>
    </div>
  );
}
