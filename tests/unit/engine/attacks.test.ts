import { expect, test } from 'vitest';
import { activeHitbox } from '../../../src/engine/fighter';
import { fightPair, raw, tickN } from '../helpers';

test('stand LP: 4 startup, 2 active, 6 recovery, then idle', () => {
  const c = fightPair(); tickN(c, 1, raw(5, 'LP'));
  expect(c.fs[0]).toMatchObject({ action: 'attack', moveId: 'stand-lp', actionTick: 0 });
  tickN(c, 3); expect(activeHitbox(c.fs[0], c.defs[0])).toBeNull();
  const ev = tickN(c, 1);
  expect(activeHitbox(c.fs[0], c.defs[0])).not.toBeNull();
  expect(ev).toContainEqual({ type: 'swing', player: 0, strength: 'light' });
  tickN(c, 2); expect(activeHitbox(c.fs[0], c.defs[0])).toBeNull();
  tickN(c, 5); expect(c.fs[0].action).toBe('attack');
  tickN(c, 1); expect(c.fs[0].action).toBe('idle');
});
test('down or down-forward + HK is the sweep', () => {
  const c = fightPair(); tickN(c, 1, raw(3, 'HK')); expect(c.fs[0].moveId).toBe('crouch-hk');
});
test('one air attack per jump; landing ends it', () => {
  const c = fightPair(); tickN(c, 1, raw(8)); tickN(c, 10); tickN(c, 1, raw(5, 'MK'));
  expect(c.fs[0].moveId).toBe('jump-mk');
  tickN(c, 25); tickN(c, 1, raw(5, 'HK'));
  expect(c.fs[0].moveId).not.toBe('jump-hk');
  tickN(c, 20); expect(c.fs[0].action).toBe('idle');
});
test('attacks do not move the fighter', () => {
  const c = fightPair(); const x0 = c.fs[0].x; tickN(c, 1, raw(6, 'HP')); tickN(c, 10, raw(6)); expect(c.fs[0].x).toBe(x0);
});
test('a press up to 3 ticks before recovery ends comes out on the first free tick', () => {
  const c = fightPair(); tickN(c, 1, raw(5, 'LP')); tickN(c, 10); tickN(c, 1, raw(5, 'MP')); tickN(c, 1);
  expect(c.fs[0]).toMatchObject({ moveId: 'stand-mp', actionTick: 0 });
});
test('a press 5 ticks before recovery ends is dropped', () => {
  const c = fightPair(); tickN(c, 1, raw(5, 'LP')); tickN(c, 6); tickN(c, 1, raw(5, 'MP')); tickN(c, 5);
  expect(c.fs[0].action).toBe('idle');
});
