import { BUTTON_BUFFER_TICKS } from '../engine/constants';
import type { Facing } from '../engine/types';
import { INPUT_BUTTONS, isDown, NEUTRAL, type Button, type Dir, type InputState, type RawInput } from './types';

/** Presses that started a move stay available this many ticks for a chord partner. */
export const CHORD_TICKS = 2;

/** Facing-relative directions plus the button press to act on this tick. */
export interface Command { forward: boolean; back: boolean; up: boolean; down: boolean; press: Button | null }

export const PRESS_PRIORITY: readonly Button[] = ['HP', 'HK', 'MP', 'MK', 'LP', 'LK'];

export const HISTORY_TICKS = 60;

export function emptyInputState(): InputState {
  return { last: { ...NEUTRAL }, presses: [], consumed: [], history: [] };
}

/** The world numpad direction of a raw input (6 = screen right). */
export function worldDir(raw: RawInput): Dir {
  return (5 + raw.x + 3 * raw.y) as Dir;
}

/**
 * Records one tick of input (mutates). Buffered presses age and expire, except while `frozen`
 * (the fighter is in hitstop), so an input made during hitstop is still there afterwards.
 */
export function pushInput(s: InputState, raw: RawInput, frozen = false): void {
  for (const p of s.presses) p.since++;
  for (const p of s.consumed) p.since++;
  s.consumed = s.consumed.filter((p) => p.since <= CHORD_TICKS);
  if (!frozen) {
    for (const p of s.presses) p.age++;
    s.presses = s.presses.filter((p) => p.age < BUTTON_BUFFER_TICKS);
  }
  let pressed = 0;
  INPUT_BUTTONS.forEach((b, i) => {
    if (isDown(raw.buttons, b) && !isDown(s.last.buttons, b)) {
      s.presses.push({ button: b, age: 0, since: 0 });
      pressed |= 1 << i;
    }
  });
  s.history.push({ dir: worldDir(raw), pressed });
  if (s.history.length > HISTORY_TICKS) s.history.splice(0, s.history.length - HISTORY_TICKS);
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

/** Called when a move starts: buffered presses are used up (kept briefly as `consumed` for chords). */
export function clearPresses(s: InputState): void {
  s.consumed = s.presses.filter((p) => p.since <= CHORD_TICKS);
  s.presses = [];
}
