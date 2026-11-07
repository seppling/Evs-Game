import { expect, test } from 'vitest';
import { addStun } from '../../../src/engine/stun';
import { fightPair, raw, tickN } from '../helpers';

test('stun builds on hit and drains 4 per tick after 60 quiet ticks', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); tickN(c, 1, raw(5, 'HP')); tickN(c, 9);
  expect(c.fs[1].stun).toBe(100);
  tickN(c, 60); expect(c.fs[1].stun).toBe(100);
  tickN(c, 1); expect(c.fs[1].stun).toBe(96);
  tickN(c, 10); expect(c.fs[1].stun).toBe(56);
});
test('filling the stun bar makes the fighter dizzy when hitstun ends', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); c.fs[1].stun = 450; tickN(c, 1, raw(5, 'HP')); tickN(c, 9);
  const ev = tickN(c, 12 + 25 + 1);
  expect(ev).toContainEqual({ type: 'dizzy', player: 1 });
  expect(c.fs[1]).toMatchObject({ action: 'dizzy', stun: 0 });
});
test('dizzy lasts 120 ticks; mashing shortens it by 3 per input', () => {
  const a = fightPair(); a.fs[1].action = 'dizzy'; a.fs[1].stunTicks = 120;
  tickN(a, 119); expect(a.fs[1].action).toBe('dizzy'); tickN(a, 1); expect(a.fs[1].action).toBe('idle');
  const b = fightPair(); b.fs[1].action = 'dizzy'; b.fs[1].stunTicks = 120;
  for (let i = 0; i < 10; i++) { tickN(b, 1, raw(), raw(5, 'LP')); tickN(b, 1); }
  expect(b.fs[1].stunTicks).toBeLessThanOrEqual(120 - 20 - 30);
});
test('a dizzy fighter can be hit, which ends the dizzy', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); c.fs[1].action = 'dizzy'; c.fs[1].stunTicks = 120;
  tickN(c, 1, raw(5, 'HP')); tickN(c, 9); expect(c.fs[1]).toMatchObject({ action: 'hitstun', health: 850 });
});
test('cannot be dizzied twice in one combo', () => {
  const c = fightPair(); c.fs[1].dizzyUsed = true; c.fs[1].stun = 0; addStun(c.fs[1], c.defs[1], 600);
  expect(c.fs[1].dizzyPending).toBe(false);
});
