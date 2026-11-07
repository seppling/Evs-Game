import { CAMERA_WIDTH, MAX_SEPARATION, STAGE_WIDTH, SUB } from './constants';
import { isActionable } from './fighter';
import { overlaps, worldBox } from './geometry';
import type { Defs, FighterDef, FighterState } from './types';

export function stageBounds(def: FighterDef): { min: number; max: number } {
  const half = Math.max(-def.pushbox.x, def.pushbox.x + def.pushbox.w);
  return { min: half * SUB, max: (STAGE_WIDTH - half) * SUB };
}

function clamp(f: FighterState, def: FighterDef): void {
  const b = stageBounds(def);
  f.x = Math.min(b.max, Math.max(b.min, f.x));
}

function pushWorldBox(f: FighterState, def: FighterDef) {
  return worldBox(f.y > 0 ? def.airPushbox : def.pushbox, f.x, f.y, f.facing);
}

/** Stage bounds, max separation and push boxes. Mutates positions. */
export function separate(fs: [FighterState, FighterState], defs: Defs, prevX: [number, number]): void {
  clamp(fs[0], defs[0]);
  clamp(fs[1], defs[1]);

  let excess = Math.abs(fs[1].x - fs[0].x) - MAX_SEPARATION;
  if (excess > 0) {
    for (const i of [0, 1] as const) {
      const f = fs[i], other = fs[1 - i]!;
      const away = Math.sign(f.x - other.x) || 1;
      const outward = (f.x - prevX[i]) * away;
      if (outward > 0 && excess > 0) {
        const undo = Math.min(outward, excess);
        f.x -= undo * away;
        excess -= undo;
      }
    }
  }

  keepCornerOwner(fs, defs);

  const [a, b] = fs;
  const A = pushWorldBox(a, defs[0]);
  const B = pushWorldBox(b, defs[1]);
  if (!overlaps(A, B)) return;
  // dirA: the direction fighter A is pushed.
  const dirA = a.x < b.x ? -1 : a.x > b.x ? 1 : a.facing === 1 ? -1 : 1;
  const ov = dirA === -1 ? A.x2 - B.x1 : B.x2 - A.x1;
  const bA = stageBounds(defs[0]), bB = stageBounds(defs[1]);
  const aBlocked = dirA === -1 ? a.x <= bA.min : a.x >= bA.max;
  const bBlocked = dirA === -1 ? b.x >= bB.max : b.x <= bB.min;
  let moveA = Math.ceil(ov / 2), moveB = ov - moveA;
  if (aBlocked && !bBlocked) { moveA = 0; moveB = ov; }
  else if (bBlocked && !aBlocked) { moveB = 0; moveA = ov; }
  a.x += dirA * moveA;
  b.x -= dirA * moveB;
  // If a wall stopped one fighter part-way, the other takes the rest.
  const ax = a.x, bx = b.x;
  clamp(a, defs[0]);
  clamp(b, defs[1]);
  if (a.x !== ax) b.x -= dirA * Math.abs(ax - a.x);
  if (b.x !== bx) a.x += dirA * Math.abs(bx - b.x);
  clamp(a, defs[0]);
  clamp(b, defs[1]);
}

/**
 * A grounded fighter standing at a wall owns that side: the other fighter is kept on the open side,
 * so a narrower fighter cannot jump in behind them and steal the corner. If both are grounded at the
 * same wall, the one nearer the wall owns it.
 */
function keepCornerOwner(fs: [FighterState, FighterState], defs: Defs): void {
  const grounded = (f: FighterState) => f.y === 0 && f.arc === null;
  for (const side of [-1, 1] as const) {
    const atWall = ([0, 1] as const).filter((i) => {
      const f = fs[i], bounds = stageBounds(defs[i]);
      return grounded(f) && (side === -1 ? f.x <= bounds.min : f.x >= bounds.max);
    });
    if (atWall.length === 0) continue;
    const owner = atWall.length === 1 ? atWall[0]! : (fs[0].x - fs[1].x) * side >= 0 ? 0 : 1;
    const f = fs[owner], other = fs[1 - owner]!;
    if (side === -1 && other.x <= f.x) other.x = f.x + 1;
    if (side === 1 && other.x >= f.x) other.x = f.x - 1;
  }
}

/** Slides fighters that were hit or blocked. If a wall or max separation stops the defender, the attacker slides instead. */
export function applyPushback(fs: [FighterState, FighterState], defs: Defs): void {
  for (const i of [0, 1] as const) {
    const f = fs[i], other = fs[1 - i]!;
    const push = f.push;
    if (!push || f.hitstop > 0) continue;
    const before = f.x;
    f.x += push.perTick;
    clamp(f, defs[i]);
    if (Math.abs(f.x - other.x) > MAX_SEPARATION) f.x = other.x + Math.sign(f.x - other.x) * MAX_SEPARATION;
    const blocked = push.perTick - (f.x - before);
    if (blocked !== 0) {
      other.x -= blocked;
      clamp(other, defs[1 - i]!);
    }
    push.ticks--;
    if (push.ticks <= 0) f.push = null;
  }
}

export function faceEachOther(fs: [FighterState, FighterState]): void {
  for (const i of [0, 1] as const) {
    const f = fs[i], other = fs[1 - i]!;
    if (f.y === 0 && f.arc === null && isActionable(f) && f.x !== other.x) f.facing = other.x > f.x ? 1 : -1;
  }
}

/** Left edge of the camera, in units. */
export function cameraX(fs: readonly [FighterState, FighterState]): number {
  const mid = (fs[0].x + fs[1].x) / 2 / SUB;
  return Math.min(STAGE_WIDTH - CAMERA_WIDTH, Math.max(0, Math.round(mid - CAMERA_WIDTH / 2)));
}
