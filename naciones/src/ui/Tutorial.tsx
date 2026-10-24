import { useState } from 'react';
import { useApp, type Tab } from './store';

const STEPS: { title: string; body: string; tab?: Tab }[] = [
  { title: 'Bienvenida', body: 'Va a competir por gobernar con instituciones reales y partidos ficticios. El objetivo no es sólo ganar: es entender cómo funcionan las reglas y qué consecuencias tienen sus decisiones.' },
  { title: 'Tres capas', body: 'Fíjese en las etiquetas: azul = regla jurídica (con fuente y artículo), verde = dato observado, ámbar = simulación del modelo. Sólo la azul es derecho; la ámbar no es una predicción.', tab: 'resumen' },
  { title: 'El calendario', body: 'Cada turno avanza un mes, pero los plazos legales se cuentan en días: votaciones, sanciones, entradas en vigor y elecciones ocurren en su fecha exacta. Pulse «Avanzar» en la barra superior.', tab: 'resumen' },
  { title: 'La campaña', body: 'Antes de cada elección puede hacer giras, fijar su mensaje, gastar en publicidad, debatir y buscar apoyos. Las encuestas tienen margen de error.', tab: 'campana' },
  { title: 'El Congreso', body: 'Aquí verá la composición de las cámaras, los umbrales de mayoría y cada trámite paso a paso. También votará y tomará decisiones pendientes.', tab: 'congreso' },
  { title: 'La Constitución', body: 'Explore reformas: el juego le dirá si basta una ley o hace falta reformar la Constitución, quién puede iniciarla, qué mayorías exige y qué podría pasar. Nada se aprueba con un clic.', tab: 'constitucion' },
  { title: '¿Por qué pasó esto?', body: 'Tras cada turno, el resumen explica qué cambió y separa decisiones, eventos externos y azar. Toque cualquier término subrayado para ver su definición.', tab: 'resumen' },
];

export function Tutorial() {
  const { tutorial, setTutorial, setTab } = useApp();
  const [i, setI] = useState(0);
  if (!tutorial) return null;
  const s = STEPS[i];
  const go = (k: number) => {
    setI(k);
    if (STEPS[k].tab) setTab(STEPS[k].tab!);
  };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Tutorial">
      <div className="modal">
        <div className="small muted">Tutorial · {i + 1}/{STEPS.length}</div>
        <h2>{s.title}</h2>
        <p>{s.body}</p>
        <div className="row between">
          <button className="btn" onClick={() => { setTutorial(false); setI(0); }}>Saltar</button>
          <div className="row">
            {i > 0 ? <button className="btn" onClick={() => go(i - 1)}>Atrás</button> : null}
            {i < STEPS.length - 1 ? <button className="btn primary" onClick={() => go(i + 1)}>Siguiente</button> : <button className="btn gold" onClick={() => { setTutorial(false); setI(0); setTab('resumen'); }}>Empezar a jugar</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
