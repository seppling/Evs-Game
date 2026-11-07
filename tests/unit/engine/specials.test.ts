import { expect, test } from 'vitest';
import { fightPair, motion, raw, tickN } from '../helpers';

test('qcf + LP starts Karate Wave light', () => {
  const c = fightPair(); motion(c, 0, [2, 3, 6], 'LP'); expect(c.fs[0].moveId).toBe('karate-wave-light');
});
test('Mohawk Ram travels forward', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 300, 1200); const x0 = c.fs[0].x; motion(c, 0, [2, 1, 4], 'LP');
  tickN(c, 10 + 14); expect(c.fs[0].x - x0).toBe(14 * 900);
});
test('Rising Chop leaves the ground and ends in landing recovery', () => {
  const c = fightPair(); motion(c, 0, [6, 2, 3], 'HP'); expect(c.fs[0].moveId).toBe('rising-chop-heavy');
  tickN(c, 8); expect(c.fs[0].y).toBeGreaterThan(0);
  tickN(c, 40); expect(c.fs[0].action).toBe('landing');
  tickN(c, 14); expect(c.fs[0].action).toBe('idle');
});
test('Tornado Kick light hits three times', () => {
  const c = fightPair('spin-kicker', 'mohawk-man', 900, 990);
  const ev = motion(c, 0, [2, 3, 6], 'LK').concat(tickN(c, 120));
  expect(ev.filter((e) => e.type === 'hit')).toHaveLength(3);
});
test('crouch MK → Karate Wave cancels on hit within the window', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 990); tickN(c, 1, raw(2, 'MK')); tickN(c, 6, raw(2));
  expect(c.fs[0].hasHit).toBe(true); motion(c, 0, [3, 6], 'LP'); tickN(c, 10);
  expect(c.fs[0].moveId).toBe('karate-wave-light');
});
test('no cancel on whiff: the special waits for recovery', () => {
  const c = fightPair(); tickN(c, 1, raw(2, 'MK')); tickN(c, 6, raw(2)); motion(c, 0, [3, 6], 'LP');
  expect(c.fs[0].moveId).toBe('crouch-mk');
});
test('light chain: LP into LP on hit', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 990); tickN(c, 1, raw(5, 'LP')); tickN(c, 4 + 8);
  tickN(c, 1, raw(5, 'LP')); expect(c.fs[0]).toMatchObject({ moveId: 'stand-lp', actionTick: 0 });
});
test('a heavy normal cannot chain into a light', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 990); tickN(c, 1, raw(5, 'HK')); tickN(c, 9 + 12);
  tickN(c, 1, raw(5, 'LP')); expect(c.fs[0].moveId).toBe('stand-hk');
});
test('super spends the bar and announces itself', () => {
  const c = fightPair(); c.fs[0].meter = 1000; const ev = motion(c, 0, [2, 3, 6, 2, 3, 6], 'LP');
  expect(c.fs[0]).toMatchObject({ moveId: 'super', meter: 0 });
  expect(ev).toContainEqual({ type: 'superFlash', player: 0, name: 'Thousand Chops' });
});
test('a missed special gains 30 meter', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 300, 1200); motion(c, 0, [2, 1, 4], 'LP'); tickN(c, 60);
  expect(c.fs[0].meter).toBe(30);
});
