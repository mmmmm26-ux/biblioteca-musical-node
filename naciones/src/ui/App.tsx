import { useState } from 'react';
import { GLOSSARY_BY_ID } from '../data/glossary';
import { Modal } from './components/common';
import { Game } from './screens/Game';
import { Home } from './screens/Home';
import { NewGame } from './screens/NewGame';
import { useApp } from './store';

export function App() {
  const { game, setGame, modal, openModal } = useApp();
  const [screen, setScreen] = useState<'inicio' | 'nueva'>('inicio');
  if (game) return <Game onExit={() => { setGame(null); setScreen('inicio'); }} />;
  return (
    <>
      {screen === 'nueva' ? <NewGame onCancel={() => setScreen('inicio')} /> : <Home onNew={() => setScreen('nueva')} />}
      {modal?.kind === 'term' ? <Modal title={GLOSSARY_BY_ID[modal.id]?.term ?? modal.id} onClose={() => openModal(null)}><p>{GLOSSARY_BY_ID[modal.id]?.def}</p></Modal> : null}
    </>
  );
}
