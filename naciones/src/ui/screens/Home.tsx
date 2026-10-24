import { useRef, useState } from 'react';
import { COUNTRIES } from '../../data/countries';
import { fmtDate } from '../../engine/calendar';
import { deleteSlot, listSlots, loadSlot, parseSave } from '../../engine/save/save';
import { useApp } from '../store';

export function Home({ onNew }: { onNew: () => void }) {
  const { storage, setGame, notify, setTab } = useApp();
  const [slots, setSlots] = useState(() => listSlots(storage));
  const [msg, setMsg] = useState<{ kind: 'err' | 'warn'; text: string[] } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const load = (id: string) => {
    const r = loadSlot(storage, id);
    if (!r.ok || !r.state) return setMsg({ kind: 'err', text: r.errors });
    if (r.warnings.length) notify(r.warnings.join(' '));
    setTab('resumen');
    setGame(r.state);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const r = parseSave(await f.text());
    if (!r.ok || !r.state) return setMsg({ kind: 'err', text: r.errors });
    if (r.warnings.length) notify(r.warnings.join(' '));
    setTab('resumen');
    setGame(r.state);
  };
  return (
    <div className="app">
      <header className="hero">
        <div className="seal" aria-hidden="true">N</div>
        <h1>Naciones: Poder y Consecuencias</h1>
        <p className="tag">Un juego educativo de elecciones, gobierno y reformas constitucionales con reglas reales de El Salvador, Estados Unidos y España.</p>
      </header>
      <main className="main" style={{ paddingBottom: 32 }}>
        <div className="card">
          <h2>Empezar</h2>
          <p className="muted">Elija un país, cree un partido ficticio y compita por gobernar. Las instituciones son reales; los partidos y personas, ficticios.</p>
          <div className="row">
            <button className="btn primary" onClick={onNew}>Nueva partida</button>
            <button className="btn" onClick={() => file.current?.click()}>Importar partida (.json)</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          {msg ? <div className={`notice ${msg.kind}`} style={{ marginTop: 10 }}>{msg.text.map((t) => <div key={t}>{t}</div>)}</div> : null}
        </div>
        <div className="card">
          <h2>Partidas guardadas en este dispositivo</h2>
          {slots.length === 0 ? <p className="muted small">Todavía no hay partidas guardadas. El juego guarda automáticamente al avanzar y antes de decisiones importantes.</p> : (
            <div className="stack">
              {slots.map((s) => (
                <div key={s.id} className="row between" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <div>
                    <b>{COUNTRIES[s.country as keyof typeof COUNTRIES]?.name ?? s.country}</b> · {fmtDate(s.date)}
                    <div className="small muted">{s.label} · {s.branchLabel}</div>
                  </div>
                  <div className="row">
                    <button className="btn sm primary" onClick={() => load(s.id)}>Cargar</button>
                    <button className="btn sm danger" onClick={() => { deleteSlot(storage, s.id); setSlots(listSlots(storage)); }}>Borrar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card flat small">
          <h3>Qué es y qué no es este juego</h3>
          <p>Distingue tres capas: <span className="badge juridica">Regla jurídica</span> (con fuente y artículo), <span className="badge observada">Dato observado</span> (estadísticas de partida) y <span className="badge simulacion">Simulación</span> (resultado del modelo).</p>
          <p className="muted">No representa todas las leyes de ningún país ni predice el futuro. Las simulaciones son escenarios con supuestos explícitos, útiles para aprender, no para pronosticar.</p>
        </div>
      </main>
    </div>
  );
}
