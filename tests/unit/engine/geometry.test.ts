import { expect, test } from 'vitest';
import { arcY, overlapCenter, overlaps, worldBox } from '../../../src/engine/geometry';
import { btn, isDown } from '../../../src/input/types';

test('worldBox facing right offsets by position', () =>
  expect(worldBox({ x: 30, y: 200, w: 70, h: 30 }, 90000, 0, 1)).toEqual({ x1: 93000, y1: 20000, x2: 100000, y2: 23000 }));
test('worldBox facing left mirrors around the feet', () =>
  expect(worldBox({ x: 30, y: 200, w: 70, h: 30 }, 90000, 0, -1)).toEqual({ x1: 80000, y1: 20000, x2: 87000, y2: 23000 }));
test('worldBox adds y position', () => expect(worldBox({ x: 0, y: 10, w: 1, h: 1 }, 0, 500, 1).y1).toBe(1500));
test('overlaps: touching edges do not overlap', () => {
  expect(overlaps({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 10, y1: 0, x2: 20, y2: 10 })).toBe(false);
  expect(overlaps({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 9, y1: 9, x2: 20, y2: 20 })).toBe(true);
});
test('overlapCenter is the middle of the intersection', () =>
  expect(overlapCenter({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 5, y1: 2, x2: 20, y2: 8 })).toEqual({ x: 7, y: 5 }));
test('arcY: a jump from the ground peaks at height and lands at 0', () => {
  const arc = { t: 0, duration: 44, height: 220, startY: 0, vx: 0 };
  expect(arcY({ ...arc, t: 22 })).toBe(22000);
  expect(arcY({ ...arc, t: 44 })).toBe(0);
  expect(arcY({ ...arc, t: 0 })).toBe(0);
});
test('arcY: a fall from a height ends at 0', () =>
  expect(arcY({ t: 30, duration: 30, height: 40, startY: 15000, vx: 0 })).toBe(0));
test('btn builds a bitmask', () => {
  expect(btn('LP')).toBe(1);
  expect(isDown(btn('MP', 'HK'), 'HK')).toBe(true);
});
