import { expect, test } from 'vitest';
import { motionDone } from '../../../src/input/motions';
import type { InputFrame } from '../../../src/input/types';

const H = (...d: number[]) => d.map((dir) => ({ dir, pressed: 0 })) as InputFrame[];
const rep = (d: number, n: number): number[] => Array(n).fill(d);

test('qcf: full, skipped diagonal, and the down-forward shortcut', () => {
  expect(motionDone(H(5, 2, 3, 6), 3, 'qcf')).toBe(true);
  expect(motionDone(H(2, 6), 1, 'qcf')).toBe(true);
  expect(motionDone(H(3, 6), 1, 'qcf')).toBe(true);
});
test('qcf: button more than 8 ticks after the motion is too late', () => {
  expect(motionDone(H(2, 3, 6, ...rep(5, 8)), 10, 'qcf')).toBe(true);
  expect(motionDone(H(2, 3, 6, ...rep(5, 9)), 11, 'qcf')).toBe(false);
});
test('qcf: a motion stretched over more than 15 ticks fails', () =>
  expect(motionDone(H(2, ...rep(5, 15), 6), 16, 'qcf')).toBe(false));
test('dp and qcb are distinct from qcf', () => {
  expect(motionDone(H(6, 2, 3), 2, 'dp')).toBe(true);
  expect(motionDone(H(2, 3, 6), 2, 'dp')).toBe(false);
  expect(motionDone(H(2, 1, 4), 2, 'qcb')).toBe(true);
  expect(motionDone(H(2, 1, 4), 2, 'qcf')).toBe(false);
});
test('qcf2 within 25 ticks', () => {
  expect(motionDone(H(2, 3, 6, 2, 3, 6), 5, 'qcf2')).toBe(true);
  expect(motionDone(H(2, 3, 6, ...rep(5, 22), 2, 3, 6), 27, 'qcf2')).toBe(false); // spans 26 ticks
});
test('charge back 40 ticks, release within 10', () => {
  expect(motionDone(H(...rep(4, 40), 6), 40, 'chargeBack')).toBe(true);
  expect(motionDone(H(...rep(4, 39), 6), 39, 'chargeBack')).toBe(false);
  expect(motionDone(H(...rep(4, 40), ...rep(5, 10), 6), 50, 'chargeBack')).toBe(false);
  expect(motionDone(H(...rep(2, 40), 8), 40, 'chargeDown')).toBe(true);
});
test('endIndex only looks at history up to the press', () =>
  expect(motionDone(H(5, 5, 2, 3, 6), 1, 'qcf')).toBe(false));
