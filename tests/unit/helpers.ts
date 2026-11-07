import { SUB } from '../../src/engine/constants';
import { createFighter } from '../../src/engine/fighter';
import { tickWorld, type World } from '../../src/engine/tick';
import type { Defs, FighterState, GameEvent, MoveId } from '../../src/engine/types';
import { getFighter } from '../../src/fighters/index';
import { btn, type InputButton, type RawInput } from '../../src/input/types';

export const DEFS: Defs = [getFighter('mohawk-man')!, getFighter('spin-kicker')!];

const DIRS: Record<number, [-1 | 0 | 1, -1 | 0 | 1]> = {
  1: [-1, -1], 2: [0, -1], 3: [1, -1], 4: [-1, 0], 5: [0, 0], 6: [1, 0], 7: [-1, 1], 8: [0, 1], 9: [1, 1],
};

/** Numpad notation, world-relative: 1↙ 2↓ 3↘ 4← 5 neutral 6→ 7↖ 8↑ 9↗. */
export function raw(dir = 5, ...buttons: InputButton[]): RawInput {
  const d = DIRS[dir];
  if (!d) throw new Error(`bad direction ${dir}`);
  return { x: d[0], y: d[1], buttons: btn(...buttons), start: false };
}

export type Ctx = World & { defs: Defs };

/** Two fighters on the ground, facing each other. Positions in units. */
export function fightPair(p1 = 'mohawk-man', p2 = 'spin-kicker', p1x = 810, p2x = 1110): Ctx {
  const defs: Defs = [getFighter(p1)!, getFighter(p2)!];
  const facing = p1x <= p2x ? 1 : -1;
  return {
    defs, projectiles: [], easy: [false, false], easyDamage: true,
    fs: [createFighter(defs[0], p1x * SUB, facing), createFighter(defs[1], p2x * SUB, facing === 1 ? -1 : 1)],
  };
}

/** Runs n ticks with the same inputs held (a button held for n ticks is one press). */
export function tickN(ctx: Ctx, n: number, p1: RawInput = raw(), p2: RawInput = raw()): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < n; i++) tickWorld(ctx, [p1, p2], ctx.defs, true, events);
  return events;
}

/** One tick per direction (world-relative numpad) for `player`, pressing `buttons` on the last tick; the other player is neutral. */
export function motion(ctx: Ctx, player: 0 | 1, dirs: number[], ...buttons: InputButton[]): GameEvent[] {
  const events: GameEvent[] = [];
  dirs.forEach((d, i) => {
    const mine = raw(d, ...(i === dirs.length - 1 ? buttons : []));
    events.push(...tickN(ctx, 1, player === 0 ? mine : raw(), player === 1 ? mine : raw()));
  });
  return events;
}

export function setAttack(f: FighterState, moveId: MoveId, actionTick: number): void {
  f.action = 'attack';
  f.moveId = moveId;
  f.actionTick = actionTick;
  f.hasHit = false;
}
