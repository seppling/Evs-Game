import { expect, test } from 'vitest';
import { fightPair, motion, raw, tickN } from '../helpers';

test('Karate Wave spawns in front at the spawn frame and travels', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 400, 1500); motion(c, 0, [2, 3, 6], 'LP'); tickN(c, 12);
  expect(c.projectiles).toHaveLength(1);
  const x = c.projectiles[0]!.x; tickN(c, 10);
  expect(c.projectiles[0]!.x - x).toBe(10 * 450);
});
test('the projectile hits a far opponent and disappears', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 400, 900); motion(c, 0, [2, 3, 6], 'HP'); const ev = tickN(c, 120);
  expect(ev.some((e) => e.type === 'hit' && e.attacker === 0)).toBe(true);
  expect(c.fs[1].health).toBe(950 - 90); expect(c.projectiles).toHaveLength(0);
});
test('REVIEW FOCUS: only one projectile on screen; the second motion gives a normal', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 200, 1500); motion(c, 0, [2, 3, 6], 'LP'); tickN(c, 50);
  motion(c, 0, [2, 3, 6], 'LP'); expect(c.fs[0].moveId).toBe('stand-lp');
  tickN(c, 20); expect(c.projectiles).toHaveLength(1);
});
test('projectiles clash and cancel', () => {
  const c = fightPair('mohawk-man', 'mohawk-man', 500, 1300);
  tickN(c, 1, raw(2), raw(2)); tickN(c, 1, raw(3), raw(1));
  const ev = tickN(c, 1, raw(6, 'LP'), raw(4, 'LP')).concat(tickN(c, 120));
  expect(ev.some((e) => e.type === 'clash')).toBe(true);
  expect(c.fs[0].health).toBe(1000); expect(c.fs[1].health).toBe(1000); expect(c.projectiles).toHaveLength(0);
});
test('Cartwheel passes through a projectile', () => {
  const c = fightPair('spin-kicker', 'mohawk-man', 800, 1100); motion(c, 1, [2, 1, 4], 'LP'); tickN(c, 8);
  motion(c, 0, [2, 1, 4], 'HK'); tickN(c, 30); expect(c.fs[0].health).toBe(950);
});
test('a projectile leaving the stage is removed (before its lifetime runs out)', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 1500, 1700); c.fs[1].action = 'down'; c.fs[1].ko = true;
  motion(c, 0, [2, 3, 6], 'HP'); tickN(c, 12); expect(c.projectiles).toHaveLength(1);
  tickN(c, 60); expect(c.projectiles).toHaveLength(0);
});
