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

/** Numpad direction relative to facing: 6 = forward, 4 = back, 2 = down, 8 = up. */
export type Dir = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** One tick of history: the facing-relative direction and the buttons newly pressed that tick. */
export interface InputFrame { dir: Dir; pressed: number }

/** Per-player input buffer kept inside the simulation state. */
export interface InputState {
  last: RawInput;
  presses: { button: InputButton; age: number }[];
  /** Newest last, at most HISTORY_TICKS long. */
  history: InputFrame[];
}
