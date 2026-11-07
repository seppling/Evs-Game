import { expect, test } from 'vitest';
import { resolveIntent, type IntentContext } from '../../../src/engine/intent';
import type { Facing } from '../../../src/engine/types';
import { getFighter } from '../../../src/fighters/index';
import { emptyInputState, pushInput } from '../../../src/input/commands';
import type { InputButton } from '../../../src/input/types';
import { raw } from '../helpers';

const mohawk = getFighter('mohawk-man')!;
function feed(seq: [number, ...InputButton[]][], facing: Facing = 1) {
  const s = emptyInputState();
  for (const [dir, ...buttons] of seq) pushInput(s, raw(dir, ...buttons), facing);
  return s;
}
const ctx = (over: Partial<IntentContext> = {}): IntentContext => ({
  def: mohawk, stance: 'stand', meter: 0, hasProjectile: false, easy: false, throwInRange: false, ...over,
});

test('qcf + punch strength picks the variant', () => {
  expect(resolveIntent(feed([[2], [3], [6, 'LP']]), ctx())).toEqual({ type: 'move', moveId: 'karate-wave-light', easy: false });
  expect(resolveIntent(feed([[2], [3], [6, 'HP']]), ctx())).toMatchObject({ moveId: 'karate-wave-heavy' });
});
test('dp beats qcf when both are present', () =>
  expect(resolveIntent(feed([[6], [2], [3, 'MP']]), ctx())).toMatchObject({ moveId: 'rising-chop-medium' }));
test('qcb + punch is Mohawk Ram', () =>
  expect(resolveIntent(feed([[2], [1], [4, 'LP']]), ctx())).toMatchObject({ moveId: 'mohawk-ram-light' }));
test('super with a full meter', () =>
  expect(resolveIntent(feed([[2], [3], [6], [2], [3], [6, 'MP']]), ctx({ meter: 1000 }))).toMatchObject({ moveId: 'super' }));
test('REVIEW FOCUS: super motion without full meter falls back to the special', () =>
  expect(resolveIntent(feed([[2], [3], [6], [2], [3], [6, 'MP']]), ctx({ meter: 999 }))).toMatchObject({ moveId: 'karate-wave-medium' }));
test('REVIEW FOCUS: fireball motion with a projectile out gives a normal punch', () =>
  expect(resolveIntent(feed([[2], [3], [6, 'LP']]), ctx({ hasProjectile: true }))).toMatchObject({ moveId: 'stand-lp' }));
test('REVIEW FOCUS: after a cross-up, the motion toward the new side is a qcf', () =>
  expect(resolveIntent(feed([[2], [1], [4, 'LP']], -1), ctx())).toMatchObject({ moveId: 'karate-wave-light' }));
test('Easy Special by direction, only when Easy is on', () => {
  expect(resolveIntent(feed([[5, 'SPECIAL']]), ctx({ easy: true }))).toEqual({ type: 'move', moveId: 'karate-wave-medium', easy: true });
  expect(resolveIntent(feed([[6, 'SPECIAL']]), ctx({ easy: true }))).toMatchObject({ moveId: 'mohawk-ram-medium' });
  expect(resolveIntent(feed([[3, 'SPECIAL']]), ctx({ easy: true }))).toMatchObject({ moveId: 'rising-chop-medium' });
  expect(resolveIntent(feed([[4, 'SPECIAL']]), ctx({ easy: true }))).toMatchObject({ moveId: 'karate-wave-medium' });
  expect(resolveIntent(feed([[5, 'SPECIAL']]), ctx({ easy: false }))).toBeNull();
});
test('Easy super: Special + Heavy with a full meter; without meter it is the special', () => {
  expect(resolveIntent(feed([[5, 'SPECIAL', 'HP']]), ctx({ easy: true, meter: 1000 }))).toEqual({ type: 'move', moveId: 'super', easy: true });
  expect(resolveIntent(feed([[5, 'SPECIAL', 'HP']]), ctx({ easy: true, meter: 0 }))).toMatchObject({ moveId: 'karate-wave-medium' });
});
test('throws: LP+LK in range, back throw, out of range, Throw button', () => {
  expect(resolveIntent(feed([[5, 'LP', 'LK']]), ctx({ throwInRange: true }))).toEqual({ type: 'throw', back: false });
  expect(resolveIntent(feed([[4, 'LP', 'LK']]), ctx({ throwInRange: true }))).toEqual({ type: 'throw', back: true });
  expect(resolveIntent(feed([[5, 'LP', 'LK']]), ctx({ throwInRange: false }))).toMatchObject({ moveId: 'stand-lp' });
  expect(resolveIntent(feed([[5, 'THROW']]), ctx({ throwInRange: false }))).toEqual({ type: 'throw', back: false });
});
test('air: normals only', () =>
  expect(resolveIntent(feed([[2], [3], [6, 'HK']]), ctx({ stance: 'air' }))).toMatchObject({ moveId: 'jump-hk' }));
test('nothing pressed → null', () => expect(resolveIntent(feed([[2], [3], [6]]), ctx())).toBeNull());
