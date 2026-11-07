import type { InputFrame } from './types';

export type Motion = 'qcf' | 'qcb' | 'dp' | 'qcf2' | 'chargeBack' | 'chargeDown';

export const MOTION_WINDOW = 15;
export const BUTTON_AFTER_MOTION = 8;
export const SUPER_WINDOW = 25;
export const CHARGE_TICKS = 40;
export const CHARGE_RELEASE = 10;

type Steps = readonly (readonly number[])[];
const SEQUENCES: Record<'qcf' | 'qcb' | 'dp' | 'qcf2', { steps: Steps; window: number }> = {
  qcf: { steps: [[2, 3], [6]], window: MOTION_WINDOW },
  qcb: { steps: [[2, 1], [4]], window: MOTION_WINDOW },
  dp: { steps: [[6], [2], [3]], window: MOTION_WINDOW },
  qcf2: { steps: [[2, 3], [6], [2, 3], [6]], window: SUPER_WINDOW },
};
const CHARGES: Record<'chargeBack' | 'chargeDown', { hold: readonly number[]; release: readonly number[] }> = {
  chargeBack: { hold: [1, 4, 7], release: [3, 6, 9] },
  chargeDown: { hold: [1, 2, 3], release: [7, 8, 9] },
};

/**
 * Did the history up to `endIndex` (the tick the button was pressed) complete `motion`?
 * Sequences: each step is matched at its latest possible tick, walking backwards from the button;
 * the last step must be within BUTTON_AFTER_MOTION ticks of the button and the whole motion within its window.
 */
export function motionDone(history: readonly InputFrame[], endIndex: number, motion: Motion): boolean {
  if (endIndex < 0 || endIndex >= history.length) return false;
  if (motion === 'chargeBack' || motion === 'chargeDown') {
    const { hold, release } = CHARGES[motion];
    if (!release.includes(history[endIndex]!.dir)) return false;
    for (let c = endIndex - 1; c >= Math.max(0, endIndex - CHARGE_RELEASE); c--) {
      if (c - CHARGE_TICKS + 1 < 0) break;
      let held = true;
      for (let i = c - CHARGE_TICKS + 1; i <= c; i++) if (!hold.includes(history[i]!.dir)) { held = false; break; }
      if (held) return true;
    }
    return false;
  }
  const { steps, window } = SEQUENCES[motion];
  let idx = endIndex;
  let last = -1;
  for (let k = steps.length - 1; k >= 0; k--) {
    const set = steps[k]!;
    while (idx >= 0 && !set.includes(history[idx]!.dir)) idx--;
    if (idx < 0) return false;
    if (k === steps.length - 1) {
      if (endIndex - idx > BUTTON_AFTER_MOTION) return false;
      last = idx;
    }
    if (last - idx > window) return false;
    if (k > 0) idx--;
  }
  return true;
}
