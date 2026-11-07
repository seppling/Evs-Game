import { pushInput } from '../input/commands';
import type { RawInput } from '../input/types';
import { resolveHits } from './combat';
import { updateFighter } from './fighter';
import { applyPushback, faceEachOther, separate } from './space';
import type { Defs, FighterState, GameEvent, ProjectileState } from './types';

/** Everything one simulation tick works on: both fighters, projectiles, and the per-match rules. */
export interface World {
  fs: [FighterState, FighterState];
  projectiles: ProjectileState[];
  easy: readonly [boolean, boolean];
  easyDamage: boolean;
}

/** One simulation tick of the world. `active` false ignores inputs and skips combat. */
export function tickWorld(w: World, inputs: readonly [RawInput, RawInput], defs: Defs, active: boolean, events: GameEvent[]): void {
  const fs = w.fs;
  pushInput(fs[0].input, inputs[0], fs[0].facing, fs[0].hitstop > 0);
  pushInput(fs[1].input, inputs[1], fs[1].facing, fs[1].hitstop > 0);
  const prevX: [number, number] = [fs[0].x, fs[1].x];
  updateFighter(fs[0], defs[0], fs[1], defs[1], 0, active, events, w);
  updateFighter(fs[1], defs[1], fs[0], defs[0], 1, active, events, w);
  applyPushback(fs, defs);
  separate(fs, defs, prevX);
  if (active) resolveHits(fs, defs, events);
  faceEachOther(fs);
}
