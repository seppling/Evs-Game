export const BUTTONS = ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'] as const;
export type Button = (typeof BUTTONS)[number];

/** One tick of raw controller state. World-relative: x 1 = right, y 1 = up. buttons: bit i = BUTTONS[i]. */
export interface RawInput {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  buttons: number;
  start: boolean;
}

export const NEUTRAL: RawInput = Object.freeze({ x: 0, y: 0, buttons: 0, start: false }) as RawInput;

export function btn(...names: Button[]): number {
  let mask = 0;
  for (const n of names) mask |= 1 << BUTTONS.indexOf(n);
  return mask;
}

export function isDown(buttons: number, b: Button): boolean {
  return (buttons & (1 << BUTTONS.indexOf(b))) !== 0;
}

/** Per-player input buffer kept inside the simulation state. */
export interface InputState {
  last: RawInput;
  presses: { button: Button; age: number }[];
}
