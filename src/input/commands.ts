import { BUTTON_BUFFER_TICKS } from '../engine/constants';
import type { Facing } from '../engine/types';
import { BUTTONS, isDown, NEUTRAL, type Button, type InputState, type RawInput } from './types';

/** Facing-relative directions plus the button press to act on this tick. */
export interface Command { forward: boolean; back: boolean; up: boolean; down: boolean; press: Button | null }

export const PRESS_PRIORITY: readonly Button[] = ['HP', 'HK', 'MP', 'MK', 'LP', 'LK'];

export function emptyInputState(): InputState {
  return { last: { ...NEUTRAL }, presses: [] };
}

/** Records one tick of input (mutates): ages buffered presses, drops expired ones, adds new presses. */
export function pushInput(s: InputState, raw: RawInput): void {
  for (const p of s.presses) p.age++;
  s.presses = s.presses.filter((p) => p.age < BUTTON_BUFFER_TICKS);
  for (const b of BUTTONS) {
    if (isDown(raw.buttons, b) && !isDown(s.last.buttons, b)) s.presses.push({ button: b, age: 0 });
  }
  s.last = { x: raw.x, y: raw.y, buttons: raw.buttons, start: raw.start };
}

export function readCommand(s: InputState, facing: Facing): Command {
  const { x, y } = s.last;
  let press: Button | null = null;
  for (const b of PRESS_PRIORITY) {
    if (s.presses.some((p) => p.button === b)) { press = b; break; }
  }
  return { forward: x === facing, back: x === -facing, up: y === 1, down: y === -1, press };
}

/** Called when an attack starts: buffered presses are used up. */
export function clearPresses(s: InputState): void {
  s.presses = [];
}
