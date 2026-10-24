import { getCountry } from '../../data/countries';
import { GLOSSARY_BY_ID } from '../../data/glossary';
import { fmtShort } from '../../engine/calendar';
import { acknowledgeResults, advanceTurn, campaignOpen } from '../../engine/game';
import { Modal, RuleDetail } from '../components/common';
import { useApp, useGame, type Tab } from '../store';
import { Tutorial } from '../Tutorial';
import { Campaign } from './Campaign';
import { Congress } from './Congress';
import { Constitution } from './Constitution';
import { Government } from './Government';
import { More } from './More';
import { Results } from './Results';
import { Summary, WhyPanel } from './Summary';

export function Game({ onExit }: { onExit: () => void }) {
  const game = useGame();
  const { setGame, tab, setTab, setMore, modal, openModal, toast, autosave } = useApp();
  const c = getCountry(game.country);
  const camp = campaignOpen(game);
  const tabs: { id: Tab; label: string; ic: string; badge?: number }[] = [
    { id: 'resumen', label: 'Resumen', ic: '◎' },
    camp && game.phase !== 'formacion' ? { id: 'campana', label: 'Campaña', ic: '✦' } : { id: 'gobierno', label: game.phase === 'formacion' ? 'Investidura' : 'Gobierno', ic: '⚑' },
    { id: 'congreso', label: 'Congreso', ic: '▥', badge: game.decisions.length || undefined },
    { id: 'constitucion', label: 'Constitución', ic: '§' },
    { id: 'mas', label: 'Más', ic: '☰' },
  ];
  const advance = () => {
    if (game.phase === 'resultados') {
      setGame(acknowledgeResults(game));
      setTab(game.country === 'es' ? 'gobierno' : 'resumen');
      return;
    }
    const g = advanceTurn(game);
    autosave(g, 'turno');
    setGame(g);
    if (g.phase === 'resultados') window.scrollTo(0, 0);
  };
  const advLabel = game.phase === 'resultados' ? 'Continuar' : game.phase === 'campana' ? 'Avanzar campaña' : 'Avanzar un mes';
  const activeTab = tab === 'campana' && !camp ? 'resumen' : tab === 'gobierno' && camp && game.phase === 'campana' ? 'campana' : tab;
  return (
    <div className="app">
      <header className="topbar">
        <button className="icon" onClick={onExit} aria-label="Salir al menú principal">⌂</button>
        <div className="grow">
          <div className="title">{c.name}</div>
          <div className="sub">{fmtShort(game.date)} · {game.phase === 'campana' ? 'Campaña' : game.phase === 'resultados' ? 'Resultados' : game.phase === 'formacion' ? 'Formación de gobierno' : game.playerRole === 'gobierno' ? 'En el Gobierno' : 'En la oposición'}</div>
        </div>
        <button className="adv" onClick={advance}>{advLabel}</button>
      </header>
      {game.phase === 'resultados' ? (
        <main className="main"><Results game={game} onContinue={advance} /></main>
      ) : (
        <div className="layout">
          <nav className="bottomnav" aria-label="Secciones">
            {tabs.map((t) => (
              <button key={t.id} className={activeTab === t.id ? 'on' : ''} onClick={() => { setTab(t.id); if (t.id === 'mas') setMore('menu'); window.scrollTo(0, 0); }} aria-current={activeTab === t.id ? 'page' : undefined}>
                <span className="ic" aria-hidden="true">{t.ic}</span><span>{t.label} {t.badge ? <span className="dot">{t.badge}</span> : null}</span>
              </button>
            ))}
          </nav>
          <main className="main">
            {activeTab === 'resumen' && <Summary />}
            {activeTab === 'campana' && <Campaign />}
            {activeTab === 'gobierno' && <Government />}
            {activeTab === 'congreso' && <Congress />}
            {activeTab === 'constitucion' && <Constitution />}
            {activeTab === 'mas' && <More />}
          </main>
        </div>
      )}
      {modal?.kind === 'term' && <Modal title={GLOSSARY_BY_ID[modal.id]?.term ?? modal.id} onClose={() => openModal(null)}><p>{GLOSSARY_BY_ID[modal.id]?.def}</p>{GLOSSARY_BY_ID[modal.id]?.example ? <p className="muted">Ejemplo: {GLOSSARY_BY_ID[modal.id]?.example}</p> : null}</Modal>}
      {modal?.kind === 'rule' && <Modal title={game.rules[modal.id]?.title ?? 'Regla'} onClose={() => openModal(null)}><RuleDetail game={game} id={modal.id} /></Modal>}
      {modal?.kind === 'why' && <Modal title="¿Por qué pasó esto?" onClose={() => openModal(null)}><WhyPanel game={game} /></Modal>}
      {modal?.kind === 'custom' && <Modal title={modal.title} onClose={() => openModal(null)}>{modal.body}</Modal>}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
      <Tutorial />
    </div>
  );
}
