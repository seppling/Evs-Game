import { expect, test } from 'vitest';
import { hurtboxes } from '../../../src/engine/fighter';
import { arcY } from '../../../src/engine/geometry';
import type { Button, RawInput } from '../../../src/input/types';
import { fightPair, raw, setAttack, tickN, type Ctx } from '../helpers';

const close = () => fightPair('mohawk-man', 'spin-kicker', 900, 980);
const press = (c: Ctx, dir: number, b: Button, p2: RawInput = raw()) => tickN(c, 1, raw(dir, b), p2);

test('stand LP hits: damage, hitstop on both, then 12 ticks hitstun', () => {
  const c = close(); press(c, 5, 'LP'); const ev = tickN(c, 4);
  expect(ev.find((e) => e.type === 'hit')).toMatchObject({ attacker: 0, damage: 30 });
  expect(c.fs[1]).toMatchObject({ health: 920, action: 'hitstun', hitstop: 8 });
  expect(c.fs[0].hitstop).toBe(8);
  const at = c.fs[0].actionTick; tickN(c, 8); expect(c.fs[0].actionTick).toBe(at);
  tickN(c, 11); expect(c.fs[1].action).toBe('hitstun');
  tickN(c, 1); expect(c.fs[1].action).toBe('idle');
});
test('one hit per move activation', () => { const c = close(); press(c, 5, 'LP'); tickN(c, 20); expect(c.fs[1].health).toBe(920); });
test('holding back blocks a mid standing and crouching', () => {
  for (const dir of [6, 3]) {
    const c = close(); press(c, 5, 'MP', raw(dir)); const ev = tickN(c, 6, raw(), raw(dir));
    expect(ev.some((e) => e.type === 'block')).toBe(true);
    expect(c.fs[1]).toMatchObject({ health: 950, action: 'blockstun' });
  }
});
test('lows must be blocked crouching', () => {
  const a = close(); press(a, 2, 'MK', raw(6)); tickN(a, 7, raw(2), raw(6)); expect(a.fs[1].health).toBe(890);
  const b = close(); press(b, 2, 'MK', raw(3)); tickN(b, 7, raw(2), raw(3)); expect(b.fs[1].health).toBe(950);
});
test('overheads must be blocked standing', () => {
  for (const [dir, hp] of [[3, 850], [6, 950]] as const) {
    const c = close();
    setAttack(c.fs[0], 'jump-hk', 8);
    c.fs[0].arc = { t: 39, duration: 44, height: 220, startY: 0, vx: 0 }; c.fs[0].y = arcY(c.fs[0].arc);
    tickN(c, 1, raw(), raw(dir)); tickN(c, 1, raw(), raw(dir));
    expect(c.fs[1].health).toBe(hp);
  }
});
test('pushback slides the defender back over 8 ticks', () => {
  const c = close(); press(c, 5, 'LP'); tickN(c, 4); const x = c.fs[1].x; tickN(c, 8 + 8);
  expect(c.fs[1].x - x).toBe(8 * Math.trunc(2500 / 8));
});
test('in the corner the attacker is pushed back instead', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 1810, 1890); const x0 = c.fs[0].x, x1 = c.fs[1].x;
  press(c, 5, 'LP'); tickN(c, 4 + 8 + 8);
  expect(c.fs[1].x).toBe(x1); expect(x0 - c.fs[0].x).toBe(8 * Math.trunc(2500 / 8));
});
test('sweep knocks down: fall, lie, invulnerable get-up, idle', () => {
  const c = close(); press(c, 2, 'HK'); const ev = tickN(c, 9);
  expect(ev).toContainEqual({ type: 'knockdown', player: 1 });
  tickN(c, 12 + 24); expect(c.fs[1].action).toBe('down');
  expect(hurtboxes(c.fs[1], c.defs[1])).toEqual([]);
  tickN(c, 40); expect(c.fs[1].action).toBe('getup');
  tickN(c, 20); expect(c.fs[1].action).toBe('idle');
});
test('an airborne defender hit by a non-knockdown move air-resets and lands', () => {
  const c = close(); c.fs[1].action = 'air'; c.fs[1].y = 8000; c.fs[1].arc = { t: 15, duration: 40, height: 230, startY: 0, vx: 0 };
  setAttack(c.fs[0], 'crouch-hp', 9); tickN(c, 1); expect(c.fs[1].action).toBe('airReset');
  tickN(c, 12 + 30); expect(c.fs[1]).toMatchObject({ action: 'idle', y: 0 });
});
test('simultaneous hits trade', () => {
  const c = close(); tickN(c, 1, raw(5, 'LP'), raw(5, 'LP')); tickN(c, 4);
  expect(c.fs[0].health).toBe(970); expect(c.fs[1].health).toBe(920);
});
test('a hit at 0 health is a KO knockdown with no get-up', () => {
  const c = close(); c.fs[1].health = 20; press(c, 5, 'LP'); tickN(c, 4 + 8 + 24 + 200);
  expect(c.fs[1]).toMatchObject({ health: 0, ko: true, action: 'down' });
});
test('proximity guard: holding back near an attack blocks instead of walking', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 1100); const x = c.fs[1].x;
  press(c, 5, 'HK', raw(6)); tickN(c, 3, raw(), raw(6)); expect(c.fs[1]).toMatchObject({ action: 'guard', x });
  const far = fightPair('mohawk-man', 'spin-kicker', 600, 1100); press(far, 5, 'HK', raw(6));
  expect(far.fs[1].action).toBe('walkBack');
});
test('cannot block while attacking', () => {
  const c = close(); setAttack(c.fs[1], 'stand-hk', 20); press(c, 5, 'LP', raw(6)); tickN(c, 4, raw(), raw(6));
  expect(c.fs[1].health).toBe(920);
});
