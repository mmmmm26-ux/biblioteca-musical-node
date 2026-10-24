import { getCountry } from '../../data/countries';
import { addDays } from '../calendar';
import { num, rec, str } from '../legal/rules';
import { stream } from '../rng';
import type { ElectionResult, GameState, ISODate, Legislator, Party, Territory } from '../types';
import { dhondt, distributeWithMinimum, hareLargestRemainder, huntingtonHill, plurality } from './allocation';
import { aggregate, countryCenter, partiesIn, territoryVote, type TerritoryVote, type VoteCtx } from './voters';

// Motor electoral: aplica el sistema vigente EN LA FECHA de la elección (incluidas reformas aprobadas).

export function nationalParties(game: GameState): Party[] {
  return game.parties;
}

/** Escaños por territorio para una cámara, según las reglas vigentes en la fecha. */
export function seatMap(game: GameState, chamberId: string, date: ISODate): Record<string, number> {
  const c = getCountry(game.country);
  const terr = c.territories;
  if (game.country === 'sv') {
    const n = num(game, 'sv.asamblea.diputados', date);
    if (n === 60) return { ...rec(game, 'sv.asamblea.reparto', date) };
    const ext = Math.round((6 * n) / 60);
    const pop = Object.fromEntries(terr.filter((t) => t.id !== 'sv-ext').map((t) => [t.id, t.pop]));
    return { ...distributeWithMinimum(pop, n - ext, 2), 'sv-ext': ext };
  }
  if (game.country === 'us') {
    if (chamberId === 'senado') return Object.fromEntries(terr.map((t) => [t.id, t.seats.senado]));
    const n = num(game, 'us.camara.miembros', date);
    if (n === 435) return { ...rec(game, 'us.camara.reparto', date), 'us-dc': 0 };
    const pop = Object.fromEntries(terr.filter((t) => t.short !== 'DC').map((t) => [t.id, t.pop]));
    return { ...huntingtonHill(pop, n), 'us-dc': 0 };
  }
  // España
  if (chamberId === 'senado') return Object.fromEntries(terr.map((t) => [t.id, t.seats.senado]));
  const n = num(game, 'es.congreso.diputados', date);
  if (n === 350) return { ...rec(game, 'es.congreso.reparto', date) };
  const pop = Object.fromEntries(terr.map((t) => [t.id, t.pop]));
  return distributeWithMinimum(pop, n, num(game, 'es.congreso.minimo', date), { 'es-ce': 1, 'es-ml': 1 });
}

export function chamberSize(game: GameState, chamberId: string, date: ISODate = game.date): number {
  const ch = getCountry(game.country).chambers.find((c) => c.id === chamberId);
  if (!ch) throw new Error(`Cámara desconocida ${chamberId}`);
  const base = Object.values(seatMap(game, chamberId, date)).reduce((a, b) => a + b, 0);
  return base + (ch.designated ? num(game, ch.designated.ruleId, date) : 0);
}

export function electorsMap(game: GameState, date: ISODate): Record<string, number> {
  const house = seatMap(game, 'camara', date);
  const out: Record<string, number> = {};
  for (const t of getCountry('us').territories) out[t.id] = t.short === 'DC' ? 3 : (house[t.id] ?? 0) + 2;
  return out;
}

export function isPluralityOffice(game: GameState, office: string): boolean {
  if (game.country === 'us') return true;
  if (game.country === 'sv') return office === 'presidencia';
  return false;
}

/** Ajustes por elegibilidad de candidatos (reelección/límites de mandato). */
export function candidateAdjust(game: GameState, date: ISODate): Record<string, { adj: number; note?: string }> {
  const out: Record<string, { adj: number; note?: string }> = {};
  const gov = game.government;
  if (!gov.executiveParty) return out;
  const leader = gov.executiveName;
  let barred = false;
  let why = '';
  if (game.country === 'sv') {
    if (str(game, 'sv.presidente.reeleccion', date) !== 'permitida') {
      barred = true;
      why = 'La reelección inmediata está prohibida por una reforma aprobada en la partida.';
    }
  } else if (game.country === 'us') {
    const lim = num(game, 'us.presidente.limite', date);
    if (lim > 0 && (gov.termsServed[leader] ?? 0) >= lim) {
      barred = true;
      why = `Límite de ${lim} elección(es) presidencial(es) alcanzado.`;
    }
  }
  if (barred) out[gov.executiveParty] = { adj: -0.08, note: `${leader} no puede presentarse: ${why} El partido presenta otra candidatura.` };
  return out;
}

export function buildCtx(game: GameState, date: ISODate, plurality: boolean, withNoise: boolean, label = 'eleccion'): VoteCtx {
  const c = getCountry(game.country);
  const valenceAdj: Record<string, number> = {};
  const gov = game.government;
  if (gov.executiveParty) {
    const retro = ((game.economy.approval - 50) / 50) * 0.6;
    valenceAdj[gov.executiveParty] = retro;
    for (const p of gov.coalition) if (p !== gov.executiveParty) valenceAdj[p] = retro * 0.4;
  }
  for (const [p, a] of Object.entries(candidateAdjust(game, date))) valenceAdj[p] = (valenceAdj[p] ?? 0) + a.adj;
  const mobilization: Record<string, Record<string, number>> = { [game.playerParty]: game.campaign.mobilization };
  const focus = { [game.playerParty]: game.campaign.focus };
  let noise: Record<string, number> | undefined;
  if (withNoise) {
    const r = stream(game.seed, label, date);
    noise = Object.fromEntries(game.parties.map((p) => [p.id, r.normal(0, 0.1)]));
  }
  // viabilidad: voto esperado nacional sin ajuste (para el voto útil en sistemas mayoritarios)
  let viability: Record<string, number> | undefined;
  if (plurality) {
    const pre: VoteCtx = { country: game.country, parties: game.parties, valenceAdj, mobilization, focus, plurality: false, turnoutFactor: c.turnoutFactor, center: countryCenter(c) };
    viability = aggregate(c.territories.map((t) => territoryVote(t, pre))).shares;
  }
  return { country: game.country, parties: game.parties, valenceAdj, mobilization, focus, plurality, turnoutFactor: c.turnoutFactor, noise, viability, center: countryCenter(c) };
}

export function nationalEstimate(game: GameState, office?: string): { shares: Record<string, number>; turnout: number; byTerritory: Record<string, Record<string, number>> } {
  const c = getCountry(game.country);
  const plur = isPluralityOffice(game, office ?? (c.executive.kind === 'presidencial' ? 'presidencia' : 'congreso'));
  const ctx = buildCtx(game, game.date, plur, false);
  const tv = c.territories.map((t) => territoryVote(t, ctx));
  const agg = aggregate(tv);
  return { shares: agg.shares, turnout: agg.turnout, byTerritory: Object.fromEntries(c.territories.map((t, i) => [t.id, tv[i].shares])) };
}

function round1(x: number): number {
  return Math.round(x * 1000) / 10;
}

function pctShares(s: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, round1(v)]));
}

function mkLegislator(game: GameState, chamber: string, terr: string, party: Party, idx: number, termEnds: ISODate, date: ISODate, discipline: number): Legislator {
  const r = stream(game.seed, 'legislador', chamber, terr, idx, date);
  return {
    id: `${chamber}-${terr}-${idx}`,
    chamber,
    territory: terr,
    party: party.id,
    econ: party.econ + r.normal(0, 0.12),
    social: party.social + r.normal(0, 0.12),
    discipline: Math.min(0.99, Math.max(0.4, discipline + r.normal(0, 0.04))),
    termEnds,
  };
}

export interface ElectionOutput {
  results: ElectionResult[];
  legislators: Legislator[];
  replaceChambers: { chamber: string; seatIds?: string[] }[];
  presidentWinner?: string;
}

export function runElection(game: GameState, offices: string[], date: ISODate): ElectionOutput {
  const c = getCountry(game.country);
  const out: ElectionOutput = { results: [], legislators: [], replaceChambers: [] };
  const byId = new Map(game.parties.map((p) => [p.id, p]));
  const proportionalCtx = buildCtx(game, date, false, true);
  const pluralCtx = buildCtx(game, date, true, true);
  const terrVotesP = new Map<string, TerritoryVote>();
  const terrVotesM = new Map<string, TerritoryVote>();
  const tvP = (t: Territory) => {
    if (!terrVotesP.has(t.id)) terrVotesP.set(t.id, territoryVote(t, proportionalCtx));
    return terrVotesP.get(t.id)!;
  };
  const tvM = (t: Territory) => {
    if (!terrVotesM.has(t.id)) terrVotesM.set(t.id, territoryVote(t, pluralCtx));
    return terrVotesM.get(t.id)!;
  };
  const adjNotes = Object.values(candidateAdjust(game, date)).map((a) => a.note!).filter(Boolean);
  let seq = 0;
  const id = (o: string) => `el-${date}-${o}-${seq++}`;

  for (const office of offices) {
    if (office === 'presidencia') {
      if (game.country === 'sv') {
        const tv = c.territories.map(tvM);
        const agg = aggregate(tv);
        const method = str(game, 'sv.presidente.metodo', date);
        const res: ElectionResult = {
          id: id(office), date, office, system: method === 'relativa' ? 'Mayoría relativa' : 'Mayoría absoluta con segunda vuelta', turnout: agg.turnout,
          national: pctShares(agg.shares), byTerritory: Object.fromEntries(c.territories.map((t, i) => [t.id, { shares: pctShares(tv[i].shares), winner: plurality(tv[i].votes) }])),
          notes: [...adjNotes], rulesUsed: ['sv.presidente.metodo', 'sv.presidente.reeleccion'],
        };
        const top = Object.entries(agg.shares).sort((a, b) => b[1] - a[1]);
        if (method === 'relativa' || top[0][1] > 0.5) {
          res.winner = top[0][0];
          res.notes.push(method === 'relativa' ? 'Gana la candidatura más votada, aunque no alcance la mitad de los votos.' : 'La candidatura ganadora superó el 50 % de los votos válidos.');
        } else {
          const finalists = [top[0][0], top[1][0]];
          const ctx2 = { ...buildCtx(game, addDays(date, 28), false, true, 'segunda-vuelta'), parties: game.parties.filter((p) => finalists.includes(p.id)) };
          const agg2 = aggregate(c.territories.map((t) => territoryVote(t, ctx2)));
          const w = plurality(agg2.votes);
          res.runoff = { shares: pctShares(agg2.shares), winner: w, date: addDays(date, 28) };
          res.winner = w;
          res.notes.push(`Nadie superó el 50 %: segunda vuelta entre ${finalists.map((f) => byId.get(f)?.short).join(' y ')} (fecha del modelo: 4 semanas después; el plazo legal está pendiente de cotejo).`);
        }
        out.presidentWinner = res.winner;
        out.results.push(res);
      } else if (game.country === 'us') {
        const method = str(game, 'us.presidente.metodo', date);
        const tv = c.territories.map(tvM);
        const agg = aggregate(tv);
        const el = electorsMap(game, date);
        const electors: Record<string, number> = {};
        const byT: ElectionResult['byTerritory'] = {};
        c.territories.forEach((t, i) => {
          const w = plurality(tv[i].votes);
          electors[w] = (electors[w] ?? 0) + el[t.id];
          byT[t.id] = { shares: pctShares(tv[i].shares), winner: w, electors: el[t.id] };
        });
        const totalE = Object.values(el).reduce((a, b) => a + b, 0);
        const need = Math.floor(totalE / 2) + 1;
        const res: ElectionResult = { id: id(office), date, office, system: method === 'voto-popular' ? 'Voto popular nacional' : `Colegio Electoral (${need} de ${totalE})`, turnout: agg.turnout, national: pctShares(agg.shares), byTerritory: byT, electors, notes: [...adjNotes], rulesUsed: ['us.presidente.metodo', 'us.presidente.contingente', 'us.colegio.reparto'] };
        if (method === 'voto-popular') {
          res.winner = plurality(agg.votes);
          res.notes.push('Reforma aplicada: gana quien obtiene más votos en todo el país.');
        } else {
          const top = Object.entries(electors).sort((a, b) => b[1] - a[1]);
          if (top[0][1] >= need) {
            res.winner = top[0][0];
            const pv = plurality(agg.votes);
            if (pv !== res.winner) res.notes.push('El ganador del Colegio Electoral no ganó el voto popular nacional: es posible con este sistema.');
          } else {
            res.notes.push(`Nadie alcanzó ${need} electores: decide la Cámara de Representantes votando por delegaciones estatales (Enmienda XII).`);
            res.contingent = { winner: '', detail: '' };
          }
        }
        out.presidentWinner = res.winner;
        out.results.push(res);
      }
      continue;
    }
    const ch = c.chambers.find((x) => x.id === office);
    if (!ch) continue;
    const seats = seatMap(game, ch.id, date);
    const termYears = num(game, ch.termRule, date);
    const install = c.installationDate(ch.id, date, game);
    const termEnds = addDays(`${Number(install.slice(0, 4)) + termYears}${install.slice(4)}`, -1);
    const total: Record<string, number> = {};
    const byT: ElectionResult['byTerritory'] = {};
    const notes: string[] = [];
    const rulesUsed: string[] = [ch.membersRule];
    let aggVotes = aggregate(c.territories.map(ch.system === 'dhondt' ? tvP : tvM));

    if (ch.system === 'dhondt') {
      const isES = game.country === 'es';
      const formula = isES ? 'dhondt' : str(game, 'sv.asamblea.formula', date);
      const threshold = isES ? num(game, 'es.congreso.barrera', date) : 0;
      const national = isES && str(game, 'es.congreso.circunscripcion', date) === 'nacional';
      rulesUsed.push(isES ? 'es.congreso.formula' : 'sv.asamblea.formula');
      if (isES) rulesUsed.push('es.congreso.barrera', 'es.congreso.circunscripcion');
      if (national) {
        const n = Object.values(seats).reduce((a, b) => a + b, 0);
        const r = dhondt(aggVotes.votes, n, threshold);
        Object.assign(total, r.seats);
        notes.push(`Reforma aplicada: circunscripción única nacional de ${n} escaños.`);
        let idx = 0;
        for (const [p, s] of Object.entries(r.seats)) for (let k = 0; k < s; k++) out.legislators.push(mkLegislator(game, ch.id, 'nacional', byId.get(p)!, idx++, termEnds, date, ch.discipline));
        for (const t of c.territories) byT[t.id] = { shares: pctShares(tvP(t).shares) };
      } else {
        for (const t of c.territories) {
          const n = seats[t.id] ?? 0;
          const v = tvP(t);
          const s = formula === 'hare' ? hareLargestRemainder(v.votes, n, threshold) : dhondt(v.votes, n, threshold).seats;
          byT[t.id] = { shares: pctShares(v.shares), seats: s, winner: plurality(v.votes) };
          let idx = 0;
          for (const [p, k] of Object.entries(s)) {
            total[p] = (total[p] ?? 0) + k;
            for (let j = 0; j < k; j++) out.legislators.push(mkLegislator(game, ch.id, t.id, byId.get(p)!, idx++, termEnds, date, ch.discipline));
          }
        }
        notes.push(formula === 'hare' ? 'Reparto por cociente Hare y restos mayores en cada circunscripción.' : 'Reparto D’Hondt en cada circunscripción.');
        if (threshold > 0) notes.push(`Barrera del ${(threshold * 100).toFixed(0)} % de los votos válidos de cada circunscripción.`);
        else if (isES) notes.push('Sin barrera electoral (reforma aplicada).');
      }
      out.replaceChambers.push({ chamber: ch.id });
    } else if (ch.system === 'smd') {
      // Cámara de EE. UU.: distritos uninominales con geografía simulada fija por semilla
      for (const t of c.territories) {
        const n = seats[t.id] ?? 0;
        const s: Record<string, number> = {};
        for (let d = 0; d < n; d++) {
          const geo = stream(game.seed, 'geo', t.id, d);
          const shift = { econ: geo.normal(0, 0.16), social: geo.normal(0, 0.28) };
          const v = territoryVote(t, pluralCtx, shift);
          const w = plurality(v.votes);
          s[w] = (s[w] ?? 0) + 1;
          total[w] = (total[w] ?? 0) + 1;
          out.legislators.push(mkLegislator(game, ch.id, t.id, byId.get(w)!, d, termEnds, date, ch.discipline));
        }
        byT[t.id] = { shares: pctShares(tvM(t).shares), seats: s, winner: plurality(tvM(t).votes) };
      }
      notes.push('Un escaño por distrito para el candidato más votado. La geografía de los distritos es simulada.');
      rulesUsed.push('us.camara.distritos', 'us.camara.reparto');
      out.replaceChambers.push({ chamber: ch.id });
    } else if (ch.system === 'senado-clases') {
      const y = Number(date.slice(0, 4));
      const cls = [3, 1, 2][(((y - 2028) / 2) % 3 + 3) % 3];
      const ids: string[] = [];
      const senEnd = addDays(`${y + 1 + 6}-01-03`, -1);
      for (const t of c.territories) {
        if (!t.senateClasses?.includes(cls)) {
          byT[t.id] = { shares: pctShares(tvM(t).shares) };
          continue;
        }
        const v = tvM(t);
        const w = plurality(v.votes);
        total[w] = (total[w] ?? 0) + 1;
        byT[t.id] = { shares: pctShares(v.shares), seats: { [w]: 1 }, winner: w };
        const L = mkLegislator(game, ch.id, t.id, byId.get(w)!, cls, senEnd, date, ch.discipline);
        L.id = `senado-${t.id}-c${cls}`;
        ids.push(L.id);
        out.legislators.push(L);
      }
      aggVotes = aggregate(c.territories.filter((t) => t.senateClasses?.includes(cls)).map(tvM));
      notes.push(`Se renueva la clase ${cls} del Senado (${ids.length} escaños); el resto de senadores sigue en su cargo.`);
      rulesUsed.push('us.senado.mandato');
      out.replaceChambers.push({ chamber: ch.id, seatIds: ids });
    } else if (ch.system === 'voto-limitado') {
      for (const t of c.territories) {
        const n = seats[t.id] ?? 0;
        const v = tvP(t);
        const order = Object.entries(v.votes).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
        const first = n === 2 ? 1 : n === 4 ? 3 : Math.ceil(n * 0.6);
        const s: Record<string, number> = { [order[0]]: first };
        if (order[1]) s[order[1]] = (s[order[1]] ?? 0) + (n - first);
        byT[t.id] = { shares: pctShares(v.shares), seats: s, winner: order[0] };
        let idx = 0;
        for (const [p, k] of Object.entries(s)) {
          total[p] = (total[p] ?? 0) + k;
          for (let j = 0; j < k; j++) out.legislators.push(mkLegislator(game, ch.id, t.id, byId.get(p)!, idx++, termEnds, date, ch.discipline));
        }
      }
      if (ch.designated) {
        const k = num(game, ch.designated.ruleId, date);
        const d = dhondt(aggVotes.votes, k).seats;
        let idx = 0;
        for (const [p, s] of Object.entries(d)) {
          total[p] = (total[p] ?? 0) + s;
          for (let j = 0; j < s; j++) out.legislators.push(mkLegislator(game, ch.id, 'autonomico', byId.get(p)!, idx++, termEnds, date, ch.discipline));
        }
        notes.push(`${k} senadores autonómicos repartidos según el voto nacional (simplificación).`);
      }
      notes.push('Voto limitado simplificado: 3 escaños para la lista más votada y 1 para la segunda en cada provincia.');
      rulesUsed.push('es.senado.sistema', 'es.senado.composicion');
      out.replaceChambers.push({ chamber: ch.id });
    }
    for (const p of game.parties) total[p.id] = total[p.id] ?? 0;
    out.results.push({ id: id(office), date, office, system: ch.name, turnout: aggVotes.turnout, national: pctShares(aggVotes.shares), seats: total, byTerritory: byT, notes, rulesUsed });
  }

  // Elección contingente (EE. UU.) con la nueva Cámara
  const pres = out.results.find((r) => r.office === 'presidencia' && r.contingent);
  if (pres) {
    const house = out.legislators.filter((l) => l.chamber === 'camara');
    const top3 = Object.entries(pres.electors ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
    const deleg: Record<string, number> = {};
    for (const t of c.territories) {
      const m = house.filter((l) => l.territory === t.id);
      if (!m.length) continue;
      const cnt: Record<string, number> = {};
      for (const l of m) if (top3.includes(l.party)) cnt[l.party] = (cnt[l.party] ?? 0) + 1;
      const best = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
      // precedente de 1825: hace falta la mayoría de la delegación; si no, el voto del estado queda dividido
      if (best.length && best[0][1] > m.length / 2) deleg[best[0][0]] = (deleg[best[0][0]] ?? 0) + 1;
    }
    const order = Object.entries(deleg).sort((a, b) => b[1] - a[1]);
    const winner = order[0]?.[0] ?? top3[0];
    const ok = (order[0]?.[1] ?? 0) >= 26;
    pres.winner = winner;
    pres.contingent = { winner, detail: `Delegaciones estatales: ${order.map(([p, n]) => `${byId.get(p)?.short} ${n}`).join(', ')}. ${ok ? 'Mayoría de estados alcanzada (26).' : 'Ninguna candidatura llegó a 26 estados; el juego asigna la Presidencia a la que tiene más delegaciones (simplificación: en la realidad se repetirían las votaciones).'}` };
    out.presidentWinner = winner;
  }
  return out;
}

/** Composición actual de una cámara. */
export function composition(game: GameState, chamber: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of game.legislators) if (l.chamber === chamber) out[l.party] = (out[l.party] ?? 0) + 1;
  return out;
}

export { partiesIn };
