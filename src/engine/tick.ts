import { pushInput } from '../input/commands';
import type { RawInput } from '../input/types';
import { resolveHits } from './combat';
import { updateFighter } from './fighter';
import { applyPushback, faceEachOther, separate } from './space';
import type { Defs, FighterState, GameEvent } from './types';

/** One simulation tick for both fighters. `active` false ignores inputs and skips combat. */
export function tickFighters(fs: [FighterState, FighterState], inputs: readonly [RawInput, RawInput],
  defs: Defs, active: boolean, events: GameEvent[]): void {
  pushInput(fs[0].input, inputs[0], fs[0].facing, fs[0].hitstop > 0);
  pushInput(fs[1].input, inputs[1], fs[1].facing, fs[1].hitstop > 0);
  const prevX: [number, number] = [fs[0].x, fs[1].x];
  updateFighter(fs[0], defs[0], fs[1], defs[1], 0, active, events);
  updateFighter(fs[1], defs[1], fs[0], defs[0], 1, active, events);
  applyPushback(fs, defs);
  separate(fs, defs, prevX);
  if (active) resolveHits(fs, defs, events);
  faceEachOther(fs);
}
