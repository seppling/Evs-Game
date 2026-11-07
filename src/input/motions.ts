import { facingDir, type Dir, type InputFrame } from './types';

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
export function motionDone(history: readonly InputFrame[], endIndex: number, motion: Motion, facing: 1 | -1 = 1): boolean {
  return motionEnd(history, endIndex, motion, facing) >= 0;
}

/** Like motionDone, but returns the history index of the motion's final step (or -1). Directions are mirrored by `facing`. */
export function motionEnd(history: readonly InputFrame[], endIndex: number, motion: Motion, facing: 1 | -1 = 1): number {
  if (endIndex < 0 || endIndex >= history.length) return -1;
  const dirAt = (i: number): Dir => facingDir(history[i]!.dir, facing);
  if (motion === 'chargeBack' || motion === 'chargeDown') {
    const { hold, release } = CHARGES[motion];
    if (!release.includes(dirAt(endIndex))) return -1;
    for (let c = endIndex - 1; c >= Math.max(0, endIndex - CHARGE_RELEASE); c--) {
      if (c - CHARGE_TICKS + 1 < 0) break;
      let held = true;
      for (let i = c - CHARGE_TICKS + 1; i <= c; i++) if (!hold.includes(dirAt(i))) { held = false; break; }
      if (held) return endIndex;
    }
    return -1;
  }
  const { steps, window } = SEQUENCES[motion];
  let idx = endIndex;
  let last = -1;
  for (let k = steps.length - 1; k >= 0; k--) {
    const set = steps[k]!;
    while (idx >= 0 && !set.includes(dirAt(idx))) idx--;
    if (idx < 0) return -1;
    if (k === steps.length - 1) {
      if (endIndex - idx > BUTTON_AFTER_MOTION) return -1;
      last = idx;
    }
    if (last - idx > window) return -1;
    if (k > 0) idx--;
  }
  return last;
}
