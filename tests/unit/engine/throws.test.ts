import { expect, test } from 'vitest';
import { fightPair, raw, tickN } from '../helpers';

const close = () => fightPair('mohawk-man', 'spin-kicker', 900, 965);

test('LP+LK in range grabs after 3 ticks and deals 120 at tick 20', () => {
  const c = close(); tickN(c, 1, raw(5, 'LP', 'LK')); tickN(c, 3);
  expect(c.fs[0].action).toBe('throwing'); expect(c.fs[1].action).toBe('thrown');
  tickN(c, 20); expect(c.fs[1].health).toBe(950 - 120); expect(['knockdown', 'down']).toContain(c.fs[1].action);
});
test('back throw puts the defender on the other side', () => {
  const c = close(); tickN(c, 1, raw(4, 'LP', 'LK')); tickN(c, 3 + 20 + 30); expect(c.fs[1].x).toBeLessThan(c.fs[0].x);
});
test('Throw button out of range whiffs into recovery', () => {
  const c = fightPair(); tickN(c, 1, raw(5, 'THROW')); tickN(c, 3);
  expect(c.fs[0]).toMatchObject({ action: 'attack', moveId: 'throw-forward' });
  tickN(c, 20); expect(c.fs[0].action).toBe('idle');
});
test('escape within 7 ticks: no damage, both idle, ESCAPE event', () => {
  const c = close(); tickN(c, 1, raw(5, 'LP', 'LK')); tickN(c, 3); const ev = tickN(c, 1, raw(), raw(5, 'THROW'));
  expect(ev).toContainEqual({ type: 'throwEscape', player: 1 }); tickN(c, 30); expect(c.fs[1].health).toBe(950);
});
test('escape at the 8th tick is too late', () => {
  const c = close(); tickN(c, 1, raw(5, 'LP', 'LK')); tickN(c, 3); tickN(c, 7); tickN(c, 1, raw(), raw(5, 'THROW')); tickN(c, 20);
  expect(c.fs[1].health).toBe(830);
});
test('REVIEW FOCUS: simultaneous throws both break', () => {
  const c = close(); const ev = tickN(c, 1, raw(5, 'LP', 'LK'), raw(5, 'LP', 'LK')).concat(tickN(c, 30));
  expect(ev.filter((e) => e.type === 'throwEscape')).toHaveLength(2);
  expect(c.fs[0].health).toBe(1000); expect(c.fs[1].health).toBe(950);
});
test('cannot throw an opponent in blockstun or in the 6 ticks after it', () => {
  const c = close(); c.fs[1].action = 'blockstun'; c.fs[1].stunTicks = 5; tickN(c, 1, raw(5, 'THROW')); tickN(c, 3);
  expect(c.fs[1].action).not.toBe('thrown');
  const d = close(); d.fs[1].action = 'blockstun'; d.fs[1].stunTicks = 1; tickN(d, 1, raw(5, 'THROW')); tickN(d, 3);
  expect(d.fs[1].action).not.toBe('thrown');
});
test('cannot throw an airborne opponent', () => {
  const c = close(); c.fs[1].action = 'air'; c.fs[1].arc = { t: 5, duration: 40, height: 230, startY: 0, vx: 0 }; c.fs[1].y = 4000;
  tickN(c, 1, raw(5, 'THROW')); tickN(c, 3); expect(c.fs[1].action).not.toBe('thrown');
});
