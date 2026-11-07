/** The six attack buttons. */
export const BUTTONS = ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'] as const;
export type Button = (typeof BUTTONS)[number];
/** Every input button: the attack buttons plus the Throw and Easy-Special shortcuts. */
export const INPUT_BUTTONS = [...BUTTONS, 'THROW', 'SPECIAL'] as const;
export type InputButton = (typeof INPUT_BUTTONS)[number];

/** One tick of raw controller state. World-relative: x 1 = right, y 1 = up. buttons: bit i = INPUT_BUTTONS[i]. */
export interface RawInput {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  buttons: number;
  start: boolean;
}

export const NEUTRAL: RawInput = Object.freeze({ x: 0, y: 0, buttons: 0, start: false }) as RawInput;

export function btn(...names: InputButton[]): number {
  let mask = 0;
  for (const n of names) mask |= 1 << INPUT_BUTTONS.indexOf(n);
  return mask;
}

export function isDown(buttons: number, b: InputButton): boolean {
  return (buttons & (1 << INPUT_BUTTONS.indexOf(b))) !== 0;
}

/** Numpad direction: 6 = right/forward, 4 = left/back, 2 = down, 8 = up. */
export type Dir = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** History stores WORLD directions (6 = screen right); readers mirror them by the fighter's current facing. */
export interface InputFrame { dir: Dir; pressed: number }

const MIRROR: Record<Dir, Dir> = { 1: 3, 2: 2, 3: 1, 4: 6, 5: 5, 6: 4, 7: 9, 8: 8, 9: 7 };
/** A world direction as seen by a fighter facing `facing` (6 = toward where they face). */
export const facingDir = (dir: Dir, facing: 1 | -1): Dir => (facing === 1 ? dir : MIRROR[dir]);

/**
 * A buffered press. `age` is buffer age: it pauses during hitstop so a press made then survives.
 * `since` is real ticks since the press: it always counts, and locates the press in the history.
 */
export interface Press { button: InputButton; age: number; since: number }

/** Per-player input buffer kept inside the simulation state. */
export interface InputState {
  last: RawInput;
  presses: Press[];
  /** Presses used up by the move that just started, kept briefly so a 2-button chord can still complete. */
  consumed: Press[];
  /** Newest last, at most HISTORY_TICKS long. */
  history: InputFrame[];
}
