import { expect, test } from 'vitest';
import { clearPresses, emptyInputState, pushInput, readCommand } from '../../../src/input/commands';
import { btn, NEUTRAL, type Button, type RawInput } from '../../../src/input/types';

const R = (x: -1 | 0 | 1, y: -1 | 0 | 1, ...b: Button[]): RawInput => ({ x, y, buttons: btn(...b), start: false });

test('a newly pressed button is a press; holding it is not a new press', () => {
  const s = emptyInputState();
  pushInput(s, R(0, 0, 'LP'));
  expect(readCommand(s, 1).press).toBe('LP');
  clearPresses(s);
  pushInput(s, R(0, 0, 'LP'));
  expect(readCommand(s, 1).press).toBeNull();
});
test('a press stays buffered for 4 ticks, then expires', () => {
  const s = emptyInputState();
  pushInput(s, R(0, 0, 'MK'));
  for (let i = 0; i < 3; i++) pushInput(s, NEUTRAL);
  expect(readCommand(s, 1).press).toBe('MK');
  pushInput(s, NEUTRAL);
  expect(readCommand(s, 1).press).toBeNull();
});
test('heavier buttons win when several are buffered', () => {
  const s = emptyInputState();
  pushInput(s, R(0, 0, 'LP', 'HK', 'MP'));
  expect(readCommand(s, 1).press).toBe('HK');
});
test('directions are relative to facing', () => {
  const s = emptyInputState();
  pushInput(s, R(1, -1));
  expect(readCommand(s, 1)).toMatchObject({ forward: true, back: false, down: true, up: false });
  expect(readCommand(s, -1)).toMatchObject({ forward: false, back: true, down: true });
});
test('state survives a JSON round-trip', () => {
  const s = emptyInputState();
  pushInput(s, R(1, 1, 'HP'));
  expect(JSON.parse(JSON.stringify(s))).toEqual(s);
});
