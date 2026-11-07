import { expect, test } from 'vitest';
import { specialEdges } from '../../../src/app/title';
import { btn } from '../../../src/input/types';
import { advanceClock, TICK_MS } from '../../../src/app/clock';
import { parseSetup } from '../../../src/app/setup';

test('advanceClock: one tick per 16.7 ms, remainder carried', () => {
  expect(advanceClock(0, 16.7).ticks).toBe(1);
  expect(advanceClock(0, 8)).toEqual({ ticks: 0, accMs: 8 });
});
test('advanceClock: at most 4 ticks per frame, leftover under one tick', () => {
  const r = advanceClock(0, 100); expect(r.ticks).toBe(4); expect(r.accMs).toBeLessThan(TICK_MS);
});
test('REVIEW FOCUS: a long sleep never runs a burst of ticks', () => {
  expect(advanceClock(0, 60000).ticks).toBe(4);
  expect(advanceClock(0, -5)).toEqual({ ticks: 0, accMs: 0 });
});
test('parseSetup: defaults, valid values, and bad values fall back', () => {
  expect(parseSetup('')).toEqual({ p1: 'mohawk-man', p2: 'spin-kicker', config: { roundsToWin: 2, roundSeconds: 99, easy: [false, false], easyDamage: true } });
  expect(parseSetup('?p1=spin-kicker&p2=mohawk-man&time=30&rounds=3')).toEqual({ p1: 'spin-kicker', p2: 'mohawk-man', config: { roundsToWin: 3, roundSeconds: 30, easy: [false, false], easyDamage: true } });
  expect(parseSetup('?time=none').config.roundSeconds).toBeNull();
  expect(parseSetup('?p1=nobody&time=abc&rounds=9')).toEqual(parseSetup(''));
  expect(parseSetup('?time=0').config.roundSeconds).toBe(99);
  expect(parseSetup('?time=12.5&rounds=1.5')).toEqual(parseSetup(''));
});

test('parseSetup easy', () => {
  expect(parseSetup('?easy=1').config.easy).toEqual([true, false]);
  expect(parseSetup('?easy=2').config.easy).toEqual([false, true]);
  expect(parseSetup('?easy=12').config.easy).toEqual([true, true]);
  expect(parseSetup('?easy=x').config.easy).toEqual([false, false]);
});
test('specialEdges sees a new Special press per player', () => {
  const r = (b: number) => ({ x: 0 as const, y: 0 as const, buttons: b, start: false });
  expect(specialEdges([0, btn('SPECIAL')], [r(btn('SPECIAL')), r(btn('SPECIAL'))])).toEqual([true, false]);
  expect(specialEdges([0, 0], [r(btn('LP')), r(0)])).toEqual([false, false]);
});
