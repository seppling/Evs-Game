import { expect, test } from 'vitest';
import { fightPair, motion, raw, setAttack, tickN } from '../helpers';

// 1. Motions after a cross-up are read toward the opponent's new side.
test('REVIEW: a quarter-circle done while landing from a jump over the opponent throws a fireball', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 1000);
  tickN(c, 1, raw(9)); tickN(c, 44); motion(c, 0, [2, 1, 4], 'LP'); // world ↓↙← = toward P2, who is now on the left
  expect(c.fs[0]).toMatchObject({ facing: -1, moveId: 'karate-wave-light' });
});
test('REVIEW: a quarter-circle done in blockstun after a cross-up throws a fireball', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 800);
  c.fs[0].facing = 1; c.fs[0].action = 'blockstun'; c.fs[0].stunTicks = 3; // still facing the old side
  motion(c, 0, [2, 1, 4], 'LP');
  expect(c.fs[0]).toMatchObject({ facing: -1, moveId: 'karate-wave-light' });
});
// 2. Walking forward first does not turn ↓↘→ into a dragon punch.
test('REVIEW: walk forward, pause, then ↓↘→ + P is still a fireball', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 300, 1500);
  tickN(c, 1, raw(6)); tickN(c, 12); motion(c, 0, [2, 3, 6], 'LP');
  expect(c.fs[0].moveId).toBe('karate-wave-light');
});
test('REVIEW: Spin Kicker walking forward then ↓↘→ + K is Tornado Kick', () => {
  const c = fightPair('spin-kicker', 'mohawk-man', 300, 1500);
  tickN(c, 6, raw(6)); motion(c, 0, [2, 3, 6], 'LK');
  expect(c.fs[0].moveId).toBe('tornado-kick-light');
});
// 3. Two-button presses one tick apart still count as together.
test('REVIEW: LP then LK one tick later (in range) is a throw, in either order', () => {
  for (const [first, second] of [['LP', 'LK'], ['LK', 'LP']] as const) {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 965);
    tickN(c, 1, raw(5, first)); tickN(c, 1, raw(5, second));
    expect(c.fs[0].moveId).toMatch(/^throw-/);
  }
});
test('REVIEW: Easy super with Special and Heavy one tick apart, in either order', () => {
  for (const [first, second] of [['SPECIAL', 'HP'], ['HP', 'SPECIAL']] as const) {
    const c = fightPair(); c.easy = [true, false]; c.fs[0].meter = 1000;
    tickN(c, 1, raw(5, first)); tickN(c, 1, raw(5, second));
    expect(c.fs[0]).toMatchObject({ moveId: 'super', meter: 0 });
  }
});
// 4. A throw pressed 1-3 ticks after the opponent's breaks instead of always losing.
test('REVIEW: staggered throw attempts 1-3 ticks apart both break', () => {
  for (const k of [1, 2, 3]) {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 965);
    const ev = tickN(c, 1, raw(5, 'LP', 'LK'));
    if (k > 1) ev.push(...tickN(c, k - 1));
    ev.push(...tickN(c, 1, raw(), raw(5, 'LP', 'LK')), ...tickN(c, 30));
    expect(ev.filter((e) => e.type === 'throwEscape')).toHaveLength(2);
    expect(c.fs[1].health).toBe(950);
  }
});
// 5. Filling the stun bar with a hit in the air dizzies on landing.
test('REVIEW: a stun-filling hit on a jumping opponent makes them dizzy when they land', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 980);
  c.fs[1].stun = 450; c.fs[1].action = 'air'; c.fs[1].y = 8000; c.fs[1].arc = { t: 15, duration: 40, height: 230, startY: 0, vx: 0 };
  setAttack(c.fs[0], 'crouch-hp', 9); tickN(c, 1); expect(c.fs[1].action).toBe('airReset');
  const ev = tickN(c, 12 + 30);
  expect(ev).toContainEqual({ type: 'dizzy', player: 1 }); expect(c.fs[1].action).toBe('dizzy');
});
// 6. A press during hitstop is read at the tick it was actually pressed.
test('REVIEW: ↘ then →+LP pressed as crouch MK hits still cancels into Karate Wave', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 990);
  tickN(c, 1, raw(2, 'MK')); tickN(c, 5, raw(2));
  tickN(c, 1, raw(3)); tickN(c, 1, raw(6, 'LP')); tickN(c, 15);
  expect(c.fs[0].moveId).toBe('karate-wave-light');
});
test('REVIEW: Easy ↓+Special pressed in hitstop reads ↓ (Rising Chop), not the later neutral', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 990); c.easy = [true, false];
  tickN(c, 1, raw(5, 'LP')); tickN(c, 4); tickN(c, 1, raw(2, 'SPECIAL')); tickN(c, 10);
  expect(c.fs[0].moveId).toBe('rising-chop-medium');
});
