import { expect, test } from 'vitest';
import { clearPresses, emptyInputState, pushInput, readCommand } from '../../../src/input/commands';
import { btn, NEUTRAL, type Button, type RawInput } from '../../../src/input/types';

const R = (x: -1 | 0 | 1, y: -1 | 0 | 1, ...b: Button[]): RawInput => ({ x, y, buttons: btn(...b), start: false });

test('a newly pressed button is a press; holding it is not a new press', () => {
  const s = emptyInputState();
  pushInput(s, R(0, 0, 'LP'), 1);
  expect(readCommand(s, 1).press).toBe('LP');
  clearPresses(s);
  pushInput(s, R(0, 0, 'LP'), 1);
  expect(readCommand(s, 1).press).toBeNull();
});
test('a press stays buffered for 4 ticks, then expires', () => {
  const s = emptyInputState();
  pushInput(s, R(0, 0, 'MK'), 1);
  for (let i = 0; i < 3; i++) pushInput(s, NEUTRAL, 1);
  expect(readCommand(s, 1).press).toBe('MK');
  pushInput(s, NEUTRAL, 1);
  expect(readCommand(s, 1).press).toBeNull();
});
test('heavier buttons win when several are buffered', () => {
  const s = emptyInputState();
  pushInput(s, R(0, 0, 'LP', 'HK', 'MP'), 1);
  expect(readCommand(s, 1).press).toBe('HK');
});
test('directions are relative to facing', () => {
  const s = emptyInputState();
  pushInput(s, R(1, -1), 1);
  expect(readCommand(s, 1)).toMatchObject({ forward: true, back: false, down: true, up: false });
  expect(readCommand(s, -1)).toMatchObject({ forward: false, back: true, down: true });
});
test('state survives a JSON round-trip', () => {
  const s = emptyInputState();
  pushInput(s, R(1, 1, 'HP'), 1);
  expect(JSON.parse(JSON.stringify(s))).toEqual(s);
});

test('history stores directions relative to facing', () => {
  const s = emptyInputState();
  pushInput(s, { x: 1, y: 0, buttons: 0, start: false }, -1);
  expect(s.history.at(-1)!.dir).toBe(4);
});
test('history keeps the last 60 ticks', () => {
  const s = emptyInputState();
  for (let i = 0; i < 70; i++) pushInput(s, NEUTRAL, 1);
  expect(s.history).toHaveLength(60);
});
test('presses do not age while frozen (hitstop)', () => {
  const s = emptyInputState(); pushInput(s, R(0, 0, 'MP'), 1);
  for (let i = 0; i < 10; i++) pushInput(s, NEUTRAL, 1, true);
  expect(readCommand(s, 1).press).toBe('MP');
});
test('THROW and SPECIAL are buffered presses but never a normal press', () => {
  const s = emptyInputState();
  pushInput(s, { x: 0, y: 0, buttons: btn('THROW', 'SPECIAL'), start: false }, 1);
  expect(s.presses.map((p) => p.button).sort()).toEqual(['SPECIAL', 'THROW']);
  expect(readCommand(s, 1).press).toBeNull();
});
test('a neutral jump facing left stores 8, never -0 anywhere', () => {
  const s = emptyInputState(); pushInput(s, { x: 0, y: 1, buttons: 0, start: false }, -1);
  expect(s.history.at(-1)!.dir).toBe(8); expect(JSON.parse(JSON.stringify(s))).toEqual(s);
});
