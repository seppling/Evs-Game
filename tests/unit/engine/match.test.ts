import { expect, test } from 'vitest';
import { createMatch } from '../../../src/engine/match';
import { step } from '../../../src/engine/step';
import type { GameEvent, MatchState } from '../../../src/engine/types';
import type { RawInput } from '../../../src/input/types';
import { DEFS, raw } from '../helpers';

const defs = DEFS;
function run(s: MatchState, n: number, p1: RawInput = raw(), p2: RawInput = raw()) {
  const events: GameEvent[] = [];
  let state = s;
  for (let i = 0; i < n; i++) { const r = step(state, [p1, p2], defs); state = r.state; events.push(...r.events); }
  return { state, events };
}
const toFight = (s: MatchState) => run(s, 120).state;

test('createMatch places fighters and starts the intro', () => {
  const s = createMatch(defs);
  expect(s).toMatchObject({ phase: 'intro', round: 1, timer: 99 });
  expect(s.fighters.map((f) => f.x)).toEqual([81000, 111000]);
  expect(s.fighters.map((f) => f.facing)).toEqual([1, -1]);
});
test('the intro ignores input for 120 ticks, then FIGHT', () => {
  const { state, events } = run(createMatch(defs), 120, raw(6));
  expect(state.fighters[0].x).toBe(81000);
  expect(state.phase).toBe('fight');
  expect(events).toContainEqual({ type: 'fight' });
  expect(events).toContainEqual({ type: 'roundStart', round: 1 });
});
test('the timer counts down once per 60 ticks', () => expect(run(toFight(createMatch(defs)), 60).state.timer).toBe(98));
test('time-out with equal percentages is a draw; higher percentage wins', () => {
  const cfg = { roundsToWin: 2, roundSeconds: 1 };
  expect(run(toFight(createMatch(defs, cfg)), 60).state).toMatchObject({ phase: 'roundEnd', roundResult: 'draw', roundEndReason: 'time' });
  const s = toFight(createMatch(defs, cfg)); s.fighters[1].health = 900;
  expect(run(s, 60).state).toMatchObject({ roundResult: 0 });
});
test('KO → slow motion → round end → round 2 with reset health', () => {
  let s = toFight(createMatch(defs)); s.fighters[0].x = 90000; s.fighters[1].x = 98000; s.fighters[1].health = 1;
  s = run(s, 1, raw(5, 'LP')).state; s = run(s, 5).state; expect(s.phase).toBe('ko');
  s = run(s, 90).state; expect(s).toMatchObject({ phase: 'roundEnd', roundResult: 0, perfect: true });
  expect(s.fighters[0].roundsWon).toBe(1);
  s = run(s, 150).state;
  expect(s).toMatchObject({ phase: 'intro', round: 2 }); expect(s.fighters[1].health).toBe(950);
});
test('KO slow motion advances fighters every 3rd tick', () => {
  let s = toFight(createMatch(defs)); s.fighters[0].x = 90000; s.fighters[1].x = 98000; s.fighters[1].health = 1;
  s = run(s, 1, raw(5, 'LP')).state; s = run(s, 5).state; expect(s.phase).toBe('ko');
  const h = s.fighters[0].hitstop; expect(run(s, 9).state.fighters[0].hitstop).toBe(h - 3);
});
test('double KO is a draw round', () => {
  const s = toFight(createMatch(defs)); s.fighters[0].x = 90000; s.fighters[1].x = 98000; s.fighters[0].health = 1; s.fighters[1].health = 1;
  expect(run(s, 6, raw(5, 'LP'), raw(5, 'LP')).state).toMatchObject({ phase: 'ko', roundResult: 'draw', roundEndReason: 'doubleKo' });
});
const winRoundP1 = (s0: MatchState) => {
  const s = run(s0, 120).state; s.fighters[0].x = 90000; s.fighters[1].x = 98000; s.fighters[1].health = 1;
  return run(run(s, 1, raw(5, 'LP')).state, 5 + 90 + 150);
};
test('first to roundsToWin takes the match', () => {
  const r = winRoundP1(winRoundP1(createMatch(defs)).state);
  expect(r.state).toMatchObject({ phase: 'matchEnd', matchWinner: 0 });
  expect(r.events).toContainEqual({ type: 'matchOver', winner: 0 });
});
test('the round limit ends the match as a draw', () => {
  const r = run(createMatch(defs, { roundsToWin: 1, roundSeconds: 1 }), 3 * (120 + 60 + 150) + 5);
  expect(r.state).toMatchObject({ phase: 'matchEnd', matchWinner: 'draw', roundsPlayed: 3 });
});
test('no timer means no time-out', () =>
  expect(run(toFight(createMatch(defs, { roundsToWin: 2, roundSeconds: null })), 10000).state.phase).toBe('fight'));
test('step does not mutate its input', () => {
  const s = createMatch(defs); const copy = structuredClone(s); step(s, [raw(6), raw(4)], defs); expect(s).toEqual(copy);
});
test('determinism: the same input script gives identical states', () => {
  const pick = <T,>(xs: readonly T[], t: number, salt: number) => xs[((t * 2654435761 + salt) >>> 0) % xs.length]!;
  const script = (t: number): [RawInput, RawInput] => [
    t % 5 === 0 ? raw(pick([5, 6, 4, 2, 3, 8, 9], t, 1), pick(['LP', 'MK', 'HP', 'HK'] as const, t, 2)) : raw(pick([5, 6, 4, 2, 3, 8, 9], t, 1)),
    t % 7 === 0 ? raw(pick([4, 6, 1, 5], t, 3), pick(['LK', 'MP'] as const, t, 4)) : raw(pick([4, 6, 1, 5], t, 3))];
  const a: string[] = [], b: string[] = [];
  for (const out of [a, b]) {
    let s = createMatch(defs);
    for (let t = 0; t < 3000; t++) { s = step(s, script(t), defs).state; if (t % 100 === 0) out.push(JSON.stringify(s)); }
  }
  expect(a).toEqual(b);
  expect(JSON.parse(a[a.length - 1]!)).toEqual(JSON.parse(b[b.length - 1]!));
});

test('super freeze: 30 ticks with no movement and no timer', () => {
  let s = toFight(createMatch(defs)); s.fighters[0].meter = 1000;
  for (const d of [2, 3, 6, 2, 3]) s = run(s, 1, raw(d)).state;
  s = run(s, 1, raw(6, 'LP')).state;
  expect(s.freeze).toMatchObject({ ticks: 30, player: 0, name: 'Thousand Chops' });
  const timer = s.timer, at = s.fighters[0].actionTick, timerTicks = s.timerTicks;
  s = run(s, 29).state;
  expect(s.timer).toBe(timer); expect(s.timerTicks).toBe(timerTicks); expect(s.fighters[0].actionTick).toBe(at);
  s = run(s, 1).state; expect(s.freeze).toBeNull();
});
test('meter carries into the next round and resets for a new match', () => {
  let s = toFight(createMatch(defs)); s.fighters[0].meter = 700; s.fighters[1].health = 1; s.fighters[0].x = 90000; s.fighters[1].x = 98000;
  s = run(run(s, 1, raw(5, 'LP')).state, 5 + 90 + 150).state;
  expect(s.round).toBe(2); expect(s.fighters[0].meter).toBe(740);
  expect(createMatch(defs).fighters[0].meter).toBe(0);
});
test('REVIEW FOCUS: a projectile in flight at KO cannot hit and is gone next round', () => {
  let s = toFight(createMatch(defs)); s.fighters[0].x = 40000; s.fighters[1].x = 120000; s.fighters[1].health = 1;
  for (const d of [2, 3]) s = run(s, 1, raw(d)).state;
  s = run(s, 1, raw(6, 'LP')).state; s = run(s, 13).state;
  expect(s.projectiles).toHaveLength(1);
  s.fighters[0].health = 0; s.fighters[0].ko = true; s = run(s, 1).state;
  expect(s.phase).toBe('ko'); s = run(s, 89).state; expect(s.fighters[1].health).toBe(1);
  // A long-lived, motionless projectile left on screen must still be gone when round 2 starts.
  s.projectiles.push({ owner: 0, moveId: 'karate-wave-light', x: 100000, y: 16800, vx: 0, facing: 1, ticksLeft: 999, hitsLeft: 1, easy: false });
  s = run(s, 1 + 150).state; expect(s.round).toBe(2); expect(s.projectiles).toHaveLength(0);
});
