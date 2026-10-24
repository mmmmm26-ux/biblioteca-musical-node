import { getCountry } from '../src/data/countries';
import { advanceTurn, attemptShortcut, checkInitiative, makePolicyProposal, makeReformProposal, submitProposal } from '../src/engine/game';
import { runElection } from '../src/engine/electoral/elections';
import { ruleAt, str } from '../src/engine/legal/rules';
import { game, governing, setComposition } from './helpers';

function run(g: ReturnType<typeof game>, months: number) {
  let x = g;
  for (let i = 0; i < months; i++) x = advanceTurn(x);
  return x;
}

describe('reformas constitucionales (El Salvador)', () => {
  test('la cláusula pétrea bloquea el cambio a sistema parlamentario aunque fuera popular', () => {
    const g = governing(game('sv'));
    const rf = getCountry('sv').reforms.find((r) => r.id === 'sv-parlamentario')!;
    const routing = rf.classify('parlamentario', g);
    expect(routing.allowed).toBe(false);
    expect(routing.blockers[0]).toMatch(/irreformables/);
    expect(makeReformProposal(g, 'sv-parlamentario', 'parlamentario').proposal).toBeNull();
  });

  test('la iniciativa exige al menos 10 diputados', () => {
    const g = governing(game('sv'));
    setComposition(g, 'asamblea', { [g.playerParty]: 9, 'sv-mnc': 51 });
    const { proposal } = makeReformProposal(g, 'sv-segunda-vuelta', 'absoluta-2v', 'misma');
    const c = checkInitiative(g, proposal!);
    expect(c.ok).toBe(false);
    expect(c.errors.join(' ')).toMatch(/al menos 10 diputados/);
  });

  test('un atajo (decreto del Ejecutivo) no cuenta como reforma válida', () => {
    const g = governing(game('sv'));
    const r = attemptShortcut(g, 'sv-segunda-vuelta', 'decreto-ejecutivo');
    expect(r.game.amendments).toHaveLength(0);
    expect(ruleAt(r.game, 'sv.presidente.metodo').value).toBe('relativa');
    expect(r.game.log.some((l) => l.kind === 'intento-invalido')).toBe(true);
  });

  test('vía de la misma legislatura: 31 + 45 votos; la reforma rige desde la siguiente elección presidencial', () => {
    let g = governing(game('sv'));
    setComposition(g, 'asamblea', { [g.playerParty]: 46, 'sv-mnc': 14 });
    const { proposal } = makeReformProposal(g, 'sv-segunda-vuelta', 'absoluta-2v', 'misma');
    const sub = submitProposal(g, proposal!);
    expect(sub.check.ok).toBe(true);
    g = run(sub.game, 4);
    const proc = g.procedures.find((p) => p.proposal.reformId === 'sv-segunda-vuelta')!;
    expect(proc.status).toBe('vigente');
    expect(proc.log.some((l) => l.stepId === 'ratificacion' && l.outcome === 'superado')).toBe(true);
    const am = g.amendments.find((a) => a.ruleId === 'sv.presidente.metodo')!;
    expect(am).toBeDefined();
    // distinguir publicación y entrada en vigor
    expect(proc.publishedOn! < proc.inForceOn!).toBe(true);
    // la regla cambia sólo desde la siguiente elección presidencial
    expect(ruleAt(g, 'sv.presidente.metodo', proc.inForceOn).value).toBe('relativa');
    expect(ruleAt(g, 'sv.presidente.metodo', am.effectiveFrom).value).toBe('absoluta-2v');
    // y el motor electoral la aplica de verdad
    const out = runElection(g, ['presidencia'], am.effectiveFrom);
    expect(out.results[0].system).toMatch(/segunda vuelta/);
    expect(str(g, 'sv.presidente.metodo', am.effectiveFrom)).toBe('absoluta-2v');
  });

  test('sin 3/4 de los diputados la ratificación fracasa y la regla no cambia', () => {
    let g = governing(game('sv'));
    setComposition(g, 'asamblea', { [g.playerParty]: 40, 'sv-als': 20 });
    const { proposal } = makeReformProposal(g, 'sv-segunda-vuelta', 'absoluta-2v', 'misma');
    g = run(submitProposal(g, proposal!).game, 4);
    const proc = g.procedures.find((p) => p.proposal.reformId === 'sv-segunda-vuelta')!;
    expect(proc.status).toBe('rechazada');
    expect(g.amendments).toHaveLength(0);
  });

  test('vía de dos legislaturas: espera a la nueva Asamblea antes de ratificar', () => {
    let g = governing(game('sv'));
    setComposition(g, 'asamblea', { [g.playerParty]: 40, 'sv-mnc': 20 });
    const { proposal } = makeReformProposal(g, 'sv-segunda-vuelta', 'absoluta-2v', 'dos');
    g = run(submitProposal(g, proposal!).game, 3);
    const proc = g.procedures.find((p) => p.proposal.reformId === 'sv-segunda-vuelta')!;
    expect(proc.status).toBe('en-tramite');
    expect(proc.meta?.waitingLegislature).toBe('asamblea');
  });
});

describe('España', () => {
  test('cambiar la barrera electoral es ley orgánica; superar 400 diputados exige reformar la Constitución', () => {
    const g = governing(game('es'));
    const rf = getCountry('es').reforms.find((r) => r.id === 'es-diputados')!;
    expect(rf.classify(400, g).normType).toBe('ley-organica');
    expect(rf.classify(450, g).normType).toBe('constitucion');
    expect(rf.classify(450, g).procedureId).toBe('es.reforma-167');
    expect(getCountry('es').reforms.find((r) => r.id === 'es-barrera')!.classify(0.05, g).procedureId).toBe('es.ley-organica');
    expect(getCountry('es').reforms.find((r) => r.id === 'es-corona')!.classify('igualdad', g).procedureId).toBe('es.reforma-168');
  });

  test('el art. 168 disuelve las Cortes y convoca elecciones', () => {
    let g = governing(game('es'));
    setComposition(g, 'congreso', { [g.playerParty]: 300, 'es-alc': 50 });
    setComposition(g, 'senado', { [g.playerParty]: 220, 'es-alc': 46 });
    const { proposal } = makeReformProposal(g, 'es-corona', 'igualdad');
    g = run(submitProposal(g, proposal!).game, 4);
    expect(g.schedule[0].reason).toMatch(/168/);
    const proc = g.procedures.find((p) => p.proposal.reformId === 'es-corona')!;
    expect(proc.status).toBe('en-tramite');
    expect(proc.meta?.waitingLegislature).toBeTruthy();
  });

  test('barrera del 5 % aprobada: la siguiente elección la aplica', () => {
    let g = governing(game('es'));
    setComposition(g, 'congreso', { [g.playerParty]: 200, 'es-alc': 150 });
    setComposition(g, 'senado', { [g.playerParty]: 150, 'es-alc': 116 });
    const { proposal } = makeReformProposal(g, 'es-barrera', 0.05);
    g = run(submitProposal(g, proposal!).game, 6);
    const am = g.amendments.find((a) => a.ruleId === 'es.congreso.barrera')!;
    expect(am).toBeDefined();
    const out = runElection(g, ['congreso'], am.effectiveFrom);
    expect(out.results[0].notes.join(' ')).toMatch(/5 %/);
  });
});

describe('Estados Unidos', () => {
  test('enmienda: 2/3 de ambas cámaras y ratificación de 38 estados; el Presidente no interviene', () => {
    const g = governing(game('us'));
    const { proposal, routing } = makeReformProposal(g, 'us-voto-popular', 'voto-popular');
    expect(routing.procedureId).toBe('us.enmienda');
    const def = getCountry('us').procedures.find((p) => p.id === 'us.enmienda')!;
    expect(def.steps.some((s) => s.kind === 'sancion')).toBe(false);
    expect(def.steps.find((s) => s.kind === 'ratificacion-territorial')!.fraction).toEqual({ num: 3, den: 4 });
    expect(proposal).not.toBeNull();
  });

  test('eliminar el filibusterismo hace que las leyes se salten el paso de cloture', () => {
    let g = governing(game('us'));
    setComposition(g, 'senado', { [g.playerParty]: 55, 'us-fro': 45 });
    setComposition(g, 'camara', { [g.playerParty]: 250, 'us-fro': 185 });
    const { proposal } = makeReformProposal(g, 'us-filibuster', 0.5);
    g = run(submitProposal(g, proposal!).game, 1);
    expect(ruleAt(g, 'us.senado.cloture').value).toBe(0.5);
    const law = makePolicyProposal(g, 'sectorial', { 'regulacion-ambiental': 60 });
    g = run(submitProposal(g, law).game, 4);
    const proc = g.procedures.find((p) => p.proposal.levers?.['regulacion-ambiental'] === 60)!;
    expect(proc.log.find((l) => l.stepId === 'cloture')?.detail).toMatch(/omitido/);
  });

  test('leyes tributarias sólo pueden presentarlas miembros del Congreso', () => {
    const g = governing(game('us'));
    setComposition(g, 'camara', { 'us-fro': 435 });
    const c = checkInitiative(g, makePolicyProposal(g, 'tributaria', { renta: 105 }));
    expect(c.ok).toBe(false);
  });
});
