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
