export const TICK_MS = 1000 / 60;
export const MAX_TICKS_PER_FRAME = 4;
export const MAX_ELAPSED_MS = 250;

/**
 * Fixed-timestep accumulator. Returns how many simulation ticks to run this frame.
 * When it falls behind it drops the backlog (the game slows down) instead of racing to catch up.
 */
export function advanceClock(accMs: number, elapsedMs: number): { ticks: number; accMs: number } {
  let acc = accMs + Math.min(MAX_ELAPSED_MS, Math.max(0, elapsedMs));
  const ticks = Math.min(Math.floor(acc / TICK_MS), MAX_TICKS_PER_FRAME);
  acc -= ticks * TICK_MS;
  if (ticks === MAX_TICKS_PER_FRAME) acc = 0;
  return { ticks, accMs: acc };
}
