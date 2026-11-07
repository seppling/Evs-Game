import { expect, test } from 'vitest';
import { MAX_SEPARATION } from '../../../src/engine/constants';
import { cameraX, stageBounds } from '../../../src/engine/space';
import { fightPair, raw, tickN } from '../helpers';

test('walk forward and back use the fighter speeds', () => {
  const c = fightPair(); const x0 = c.fs[0].x;
  tickN(c, 10, raw(6)); expect(c.fs[0].x).toBe(x0 + 3500);
  tickN(c, 10, raw(4)); expect(c.fs[0].x).toBe(x0 + 3500 - 2800);
});
test('crouch holds position and returns to idle', () => {
  const c = fightPair(); const x0 = c.fs[0].x; tickN(c, 5, raw(2));
  expect(c.fs[0]).toMatchObject({ action: 'crouch', x: x0 });
  tickN(c, 1); expect(c.fs[0].action).toBe('idle');
});
test('neutral jump: 3-tick prejump, apex at mid-flight, lands idle', () => {
  const c = fightPair(); tickN(c, 1, raw(8)); expect(c.fs[0].action).toBe('prejump');
  tickN(c, 2); tickN(c, 1); expect(c.fs[0].action).toBe('air');
  tickN(c, 22); expect(c.fs[0].y).toBe(22000);
  const ev = tickN(c, 22); expect(c.fs[0]).toMatchObject({ y: 0, action: 'idle' });
  expect(ev).toContainEqual({ type: 'land', player: 0 });
});
test('forward jump travels duration × forwardSpeed', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 500, 1400); const x0 = c.fs[0].x;
  tickN(c, 1, raw(9)); tickN(c, 3 + 44); expect(c.fs[0].x).toBe(x0 + 44 * 400);
});
test('fighters never overlap when walking into each other', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 1000); tickN(c, 120, raw(6), raw(4));
  expect(Math.abs(c.fs[1].x - c.fs[0].x)).toBeGreaterThanOrEqual((32 + 30) * 100);
});
test('walking back stops at the stage edge and at max separation', () => {
  const c = fightPair(); tickN(c, 600, raw(4), raw(6));
  expect(c.fs[0].x).toBeGreaterThanOrEqual(stageBounds(c.defs[0]).min);
  expect(c.fs[1].x - c.fs[0].x).toBeLessThanOrEqual(MAX_SEPARATION);
});
test('walking back alone stops at the stage edge', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 200, 800); tickN(c, 200, raw(4));
  expect(c.fs[0].x).toBe(stageBounds(c.defs[0]).min);
});
test('REVIEW FOCUS: cross-up — after jumping over, both turn around', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 1000); tickN(c, 1, raw(9)); tickN(c, 60);
  expect(c.fs[0].x).toBeGreaterThan(c.fs[1].x);
  expect(c.fs[0].facing).toBe(-1); expect(c.fs[1].facing).toBe(1);
});
test('REVIEW FOCUS: corner — nobody leaves the stage or ends up inside the other', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 1700, 1890); tickN(c, 120, raw(6), raw(6));
  expect(c.fs[1].x).toBeLessThanOrEqual(stageBounds(c.defs[1]).max);
  expect(c.fs[1].x - c.fs[0].x).toBeGreaterThanOrEqual((32 + 30) * 100);
});
test('cameraX centers on the midpoint and clamps', () => {
  expect(cameraX(fightPair('mohawk-man', 'spin-kicker', 900, 1100).fs)).toBe(360);
  expect(cameraX(fightPair('mohawk-man', 'spin-kicker', 40, 300).fs)).toBe(0);
});

// ---- Final review fixes ----
test('REVIEW: a press on the landing tick of a cross-up attacks toward the opponent', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 1000);
  tickN(c, 1, raw(9)); tickN(c, 46); tickN(c, 1, raw(5, 'LP'));
  expect(c.fs[0]).toMatchObject({ moveId: 'stand-lp', facing: -1 });
});
test('REVIEW: holding up-forward through a cross-up turns the fighter around on landing', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 1000);
  tickN(c, 1, raw(9)); tickN(c, 47, raw(9));
  expect(c.fs[0].x).toBeGreaterThan(c.fs[1].x);
  expect(c.fs[0].facing).toBe(-1);
});
test('REVIEW: a cornered fighter keeps the corner when a narrower fighter jumps in (left wall)', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 32, 160); tickN(c, 1, raw(5), raw(7)); tickN(c, 80);
  expect(c.fs[0].x).toBe(stageBounds(c.defs[0]).min);
  expect(c.fs[1].x).toBeGreaterThan(c.fs[0].x);
});
test('REVIEW: a cornered fighter keeps the corner when a narrower fighter jumps in (right wall)', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 1888, 1760); tickN(c, 1, raw(5), raw(9)); tickN(c, 80);
  expect(c.fs[0].x).toBe(stageBounds(c.defs[0]).max);
  expect(c.fs[1].x).toBeLessThan(c.fs[0].x);
});
test('REVIEW: a cornered narrow fighter keeps the corner when a wider fighter jumps in', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 160, 30); tickN(c, 1, raw(7)); tickN(c, 80);
  expect(c.fs[1].x).toBe(stageBounds(c.defs[1]).min);
  expect(c.fs[0].x).toBeGreaterThan(c.fs[1].x);
});
