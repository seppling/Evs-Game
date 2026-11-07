import { STAGE_WIDTH, SUB } from './constants';
import { applyContact } from './combat';
import { currentFrame, hurtboxes } from './fighter';
import { overlapCenter, overlaps, worldBox } from './geometry';
import type { World } from './tick';
import type { Defs, FighterState, GameEvent, MoveId, PlayerIndex, ProjectileDef, ProjectileState, WorldBox } from './types';

export function hasProjectile(w: World, owner: PlayerIndex): boolean {
  return w.projectiles.some((p) => p.owner === owner);
}

export function spawnProjectile(w: World, owner: PlayerIndex, f: FighterState, moveId: MoveId, def: ProjectileDef): void {
  w.projectiles.push({
    owner, moveId, facing: f.facing, easy: f.easyMove,
    x: f.x + def.spawn.x * SUB * f.facing, y: f.y + def.spawn.y * SUB, vx: def.speed * f.facing,
    ticksLeft: def.lifetime, hitsLeft: def.hits,
  });
}

function defOf(p: ProjectileState, defs: Defs): ProjectileDef {
  return defs[p.owner].moves[p.moveId]!.projectile!;
}

function boxOf(p: ProjectileState, defs: Defs): WorldBox {
  return worldBox(defOf(p, defs).hitbox, p.x, p.y, p.facing);
}

/** Removes matching items in place (the array may be shared with MatchState). */
function removeWhere<T>(arr: T[], doomed: (item: T) => boolean): void {
  for (let i = arr.length - 1; i >= 0; i--) if (doomed(arr[i]!)) arr.splice(i, 1);
}

/** Moves projectiles, resolves clashes, and (when `active`) hits. */
export function updateProjectiles(w: World, defs: Defs, active: boolean, events: GameEvent[]): void {
  const ps = w.projectiles;
  for (const p of ps) {
    p.x += p.vx;
    p.ticksLeft--;
  }
  removeWhere(ps, (p) => p.ticksLeft <= 0 || p.x < 0 || p.x > STAGE_WIDTH * SUB);

  const gone = new Set<ProjectileState>();
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i]!, b = ps[j]!;
      if (a.owner === b.owner || gone.has(a) || gone.has(b)) continue;
      const A = boxOf(a, defs), B = boxOf(b, defs);
      if (!overlaps(A, B)) continue;
      const superA = defOf(a, defs).super, superB = defOf(b, defs).super;
      if (superA === superB) {
        gone.add(a);
        gone.add(b);
        events.push({ type: 'clash', ...overlapCenter(A, B) });
      } else {
        gone.add(superA ? b : a);
      }
    }
  }
  removeWhere(ps, (p) => gone.has(p));
  if (!active) return;

  for (const p of [...ps]) {
    const di = (1 - p.owner) as PlayerIndex;
    const d = w.fs[di], dDef = defs[di];
    if (currentFrame(d, dDef)?.flags?.includes('projectileInvuln')) continue;
    const P = boxOf(p, defs);
    for (const hb of hurtboxes(d, dDef)) {
      const H = worldBox(hb, d.x, d.y, d.facing);
      if (!overlaps(P, H)) continue;
      const move = defs[p.owner].moves[p.moveId]!;
      applyContact(w, defs, { att: p.owner, hit: move.hit, kind: move.kind, easy: p.easy, at: overlapCenter(P, H), projectile: true, group: 0 }, events);
      p.hitsLeft--;
      break;
    }
  }
  removeWhere(ps, (p) => p.hitsLeft <= 0);
}
