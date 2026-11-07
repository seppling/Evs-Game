import { readCommand } from '../input/commands';
import { AIR_RESET, CANCEL_WINDOW_TICKS, CHIP_PERCENT, EASY_DAMAGE_PERCENT, KNOCKDOWN, METER_GAIN, METER_MAX, PUSHBACK_TICKS, SUB } from './constants';
import { activeHit, currentFrame, hurtboxes, setAction } from './fighter';
import { overlapCenter, overlaps, worldBox } from './geometry';
import type { World } from './tick';
import type { Defs, Facing, FighterDef, FighterState, GameEvent, HitLevel, HitProps, MoveDef, MoveKind, PlayerIndex } from './types';

const BLOCKABLE = new Set(['idle', 'walkForward', 'walkBack', 'crouch', 'guard', 'blockstun']);
const COMBO_CONTINUES = new Set(['hitstun', 'knockdown', 'airReset', 'thrown']);

/** Damage percentage for the n-th hit of a combo. */
export function scalePercent(hitNumber: number, isSuper: boolean): number {
  const pct = hitNumber <= 2 ? 100 : 80 - 10 * (hitNumber - 3);
  return Math.max(isSuper ? 50 : 40, pct);
}

/** Does the defender's current frame let this attack pass through? */
export function attackMisses(d: FighterState, dDef: FighterDef, level: HitLevel, projectile: boolean): boolean {
  const flags = currentFrame(d, dDef)?.flags ?? [];
  if (!projectile && flags.includes('strikeInvuln')) return true;
  if (projectile && flags.includes('projectileInvuln')) return true;
  return flags.includes('upperInvuln') && level !== 'low';
}

function gainMeter(f: FighterState, amount: number): void {
  f.meter = Math.max(0, Math.min(METER_MAX, f.meter + amount));
}

function attackerMeter(kind: MoveKind, hit: HitProps, blocked: boolean): number {
  if (kind === 'normal') return hit.meterGain;
  if (kind === 'special') return blocked ? METER_GAIN.specialBlock : METER_GAIN.specialHit;
  return 0;
}

const takenMeter = (damage: number) => Math.trunc((damage * METER_GAIN.damageTakenPercent) / 100);

/** The stance the defender blocks in, or null if they can't block this attack right now. */
function blockStance(d: FighterState, level: HitLevel): 'stand' | 'crouch' | null {
  if (!BLOCKABLE.has(d.action) || d.arc !== null || d.y !== 0) return null;
  const cmd = readCommand(d.input, d.facing);
  if (!cmd.back) return null;
  const stance = cmd.down ? 'crouch' : 'stand';
  if (level === 'low' && stance !== 'crouch') return null;
  if (level === 'overhead' && stance !== 'stand') return null;
  return stance;
}

function knockdown(f: FighterState, away: Facing, me: PlayerIndex, events: GameEvent[]): void {
  setAction(f, 'knockdown');
  f.actionTick = 0;
  f.moveId = null;
  f.push = null;
  f.stunTicks = 0;
  f.arc = { t: 0, duration: KNOCKDOWN.fallTicks, height: KNOCKDOWN.fallHeight, startY: f.y, vx: away * KNOCKDOWN.fallSpeed };
  events.push({ type: 'knockdown', player: me });
}

function wasCrouching(d: FighterState, defenderMove: MoveDef | undefined): boolean {
  return d.action === 'crouch' || d.crouching || (d.action === 'attack' && defenderMove?.input.stance === 'crouch');
}

export interface Contact {
  att: PlayerIndex; hit: HitProps; kind: MoveKind; easy: boolean; at: { x: number; y: number }; projectile: boolean; group: number;
}

/** Applies one hit or block, from a fighter's attack or a projectile. */
export function applyContact(w: World, defs: Defs, c: Contact, events: GameEvent[]): void {
  const fs = w.fs;
  const a = fs[c.att], di = (1 - c.att) as PlayerIndex, d = fs[di];
  const hit = c.hit;
  if (!c.projectile) {
    a.hasHit = true;
    a.hitGroups |= 1 << c.group;
    a.cancelTicks = CANCEL_WINDOW_TICKS;
    a.hitstop = hit.hitstop;
  }
  d.hitstop = hit.hitstop;
  const away: Facing = Math.sign(d.x - a.x) === -1 ? -1 : Math.sign(d.x - a.x) === 1 ? 1 : a.facing;
  const push = { perTick: away * Math.trunc((hit.pushback * SUB) / PUSHBACK_TICKS), ticks: PUSHBACK_TICKS };

  const base = c.easy && w.easyDamage ? Math.trunc((hit.damage * EASY_DAMAGE_PERCENT) / 100) : hit.damage;

  // Throws are unblockable.
  const stance = c.kind === 'throw' ? null : blockStance(d, hit.level);
  if (stance) {
    setAction(d, 'blockstun');
    d.actionTick = 0;
    d.stunTicks = hit.blockstun;
    d.crouching = stance === 'crouch';
    d.push = push;
    events.push({ type: 'block', attacker: c.att, strength: hit.strength, x: c.at.x, y: c.at.y });
    const chip = c.kind === 'special' || c.kind === 'super' ? Math.trunc((base * CHIP_PERCENT) / 100) : 0;
    gainMeter(a, attackerMeter(c.kind, hit, true));
    if (chip > 0) {
      d.health -= chip;
      gainMeter(d, takenMeter(chip));
      if (d.health <= 0) {
        d.health = 0;
        d.ko = true;
        knockdown(d, away, di, events);
      }
    }
    return;
  }

  const defenderMove = d.moveId ? defs[di].moves[d.moveId] : undefined;
  const grounded = d.arc === null && d.y === 0;
  const crouching = wasCrouching(d, defenderMove);
  if (COMBO_CONTINUES.has(d.action)) {
    d.comboHits++;
  } else {
    d.comboHits = 1;
    d.comboDamage = 0;
  }
  const damage = Math.trunc((base * scalePercent(d.comboHits, c.kind === 'super')) / 100);
  d.health -= damage;
  d.comboDamage += damage;
  gainMeter(a, attackerMeter(c.kind, hit, false));
  gainMeter(d, takenMeter(damage));
  events.push({ type: 'hit', attacker: c.att, strength: hit.strength, x: c.at.x, y: c.at.y, damage });
  if (d.health <= 0) {
    d.health = 0;
    d.ko = true;
    knockdown(d, away, di, events);
  } else if (hit.knockdown) {
    knockdown(d, away, di, events);
  } else if (!grounded) {
    setAction(d, 'airReset');
    d.actionTick = 0;
    d.moveId = null;
    d.arc = { t: 0, duration: AIR_RESET.ticks, height: AIR_RESET.bump, startY: d.y, vx: away * AIR_RESET.speed };
  } else {
    setAction(d, 'hitstun');
    d.actionTick = 0;
    d.moveId = null;
    d.stunTicks = hit.hitstun;
    d.crouching = crouching;
    d.push = push;
  }
}

/** Finds every hitbox/hurtbox contact this tick (both directions first, so trades work), then applies them. */
export function resolveHits(w: World, defs: Defs, events: GameEvent[]): void {
  const fs = w.fs;
  const contacts: Contact[] = [];
  for (const i of [0, 1] as const) {
    const a = fs[i], d = fs[1 - i]!;
    if (a.hitstop > 0 || !a.moveId) continue;
    const ah = activeHit(a, defs[i]);
    if (!ah || (a.hitGroups & (1 << ah.group)) !== 0) continue;
    if (attackMisses(d, defs[1 - i]!, ah.hit.level, false)) continue;
    const W = worldBox(ah.box, a.x, a.y, a.facing);
    for (const box of hurtboxes(d, defs[1 - i]!)) {
      const H = worldBox(box, d.x, d.y, d.facing);
      if (overlaps(W, H)) {
        contacts.push({ att: i, hit: ah.hit, kind: ah.kind, easy: a.easyMove, group: ah.group, at: overlapCenter(W, H), projectile: false });
        break;
      }
    }
  }
  for (const c of contacts) applyContact(w, defs, c, events);
}
