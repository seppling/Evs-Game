import { expect, test } from 'vitest';
import { validateFighter } from '../../../src/engine/validate';
import { normalMoveId } from '../../../src/fighters/defaults';
import { FIGHTER_IDS, getFighter } from '../../../src/fighters/index';

test.each(FIGHTER_IDS)('%s is valid', (id) => expect(validateFighter(getFighter(id)!)).toEqual([]));
test('normalMoveId', () => {
  expect(normalMoveId('crouch', 'HK')).toBe('crouch-hk');
  expect(normalMoveId('air', 'MP')).toBe('jump-mp');
});
test('tall fighters get scaled boxes', () =>
  expect(getFighter('mohawk-man')!.standingHurtboxes[1]).toEqual({ x: -26, y: 252, w: 53, h: 63 }));
test('stand-hk frame data and sprites', () => {
  const m = getFighter('spin-kicker')!.moves['stand-hk']!;
  expect(m.frames.map((f) => f.ticks)).toEqual([9, 4, 20]);
  expect(m.frames.map((f) => f.sprite)).toEqual(['stand-heavy-kick_01', 'stand-heavy-kick_02', 'stand-heavy-kick_03']);
  expect(m.hit).toMatchObject({ damage: 100, hitstun: 25, blockstun: 20, hitstop: 12, pushback: 50, level: 'mid', strength: 'heavy' });
});
test('the sweep is low and knocks down', () =>
  expect(getFighter('spin-kicker')!.moves['crouch-hk']!.hit).toMatchObject({ level: 'low', knockdown: true }));
test('jump attacks are overheads sharing sprites', () => {
  const m = getFighter('spin-kicker')!.moves['jump-lp']!;
  expect(m.frames[1]!.sprite).toBe('jump-punch_02');
  expect(m.hit.level).toBe('overhead');
});
test('validateFighter reports a missing normal and a zero-tick frame', () => {
  const def = structuredClone(getFighter('spin-kicker')!);
  delete def.moves['stand-lp'];
  def.moves['stand-mp']!.frames[0]!.ticks = 0;
  const errors = validateFighter(def);
  expect(errors.some((e) => e.includes('stand-lp'))).toBe(true);
  expect(errors.some((e) => e.includes('stand-mp'))).toBe(true);
});

test('specials come in three strengths with exact button inputs', () => {
  const m = getFighter('mohawk-man')!.moves;
  expect(m['karate-wave-heavy']!.input).toEqual({ stance: 'stand', motion: 'qcf', button: 'HP' });
  expect(m['karate-wave-light']!.projectile!.speed).toBe(450);
  expect(m['karate-wave-medium']!.kind).toBe('special');
});
test('supers deal 300 before scaling', () => {
  for (const id of FIGHTER_IDS) {
    const s = getFighter(id)!.moves['super']!;
    const total = s.frames.filter((f) => f.hitbox).reduce((t, f) => t + (f.hit?.damage ?? s.hit.damage), 0);
    expect(total).toBe(300); expect(s.input.motion).toBe('qcf2'); expect(s.kind).toBe('super');
  }
});
test('Tornado Kick hits 3/4/5 times by strength', () => {
  const m = getFighter('spin-kicker')!.moves;
  expect(['light', 'medium', 'heavy'].map((s) => m[`tornado-kick-${s}`]!.frames.filter((f) => f.hitbox).length)).toEqual([3, 4, 5]);
});
test('normals carry cancel flags; jump normals do not cancel', () => {
  const m = getFighter('spin-kicker')!.moves;
  expect(m['stand-lp']!.cancels).toEqual(['special', 'super', 'chain']);
  expect(m['crouch-mk']!.cancels).toEqual(['special', 'super']);
  expect(m['stand-hp']!.cancels).toEqual(['special', 'super']);
  expect(m['crouch-hk']!.cancels).toEqual([]);
  expect(m['jump-mp']!.cancels).toEqual([]);
  expect(m['stand-lp']!.kind).toBe('normal');
});
test('shared throw moves exist', () => {
  const m = getFighter('mohawk-man')!.moves;
  expect(m['throw-forward']!.kind).toBe('throw'); expect(m['throw-back']!.hit.damage).toBe(120);
});
test('Easy slots point at real moves', () => {
  for (const id of FIGHTER_IDS) {
    const d = getFighter(id)!; expect(d.specialSlots.length).toBeGreaterThanOrEqual(3);
    for (const s of d.specialSlots) expect(d.moves[`${s}-medium`]).toBeDefined();
  }
});
test('validateFighter rejects a projectile move without a projectile def', () => {
  const d = structuredClone(getFighter('mohawk-man')!); delete d.moves['karate-wave-light']!.projectile;
  expect(validateFighter(d).some((e) => e.includes('karate-wave-light'))).toBe(true);
});
test('special boxes are scaled for tall fighters', () =>
  expect(getFighter('mohawk-man')!.moves['mohawk-ram-light']!.frames[1]!.hitbox).toEqual({ x: 21, y: 158, w: 79, h: 74 }));
