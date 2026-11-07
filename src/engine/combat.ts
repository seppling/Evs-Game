import { readCommand } from '../input/commands';
import { AIR_RESET, KNOCKDOWN, PUSHBACK_TICKS, SUB } from './constants';
import { activeHitbox, hurtboxes, setAction } from './fighter';
import { overlapCenter, overlaps, worldBox } from './geometry';
import type { Defs, Facing, FighterState, GameEvent, HitLevel, MoveDef, PlayerIndex } from './types';

const BLOCKABLE = new Set(['idle', 'walkForward', 'walkBack', 'crouch', 'guard', 'blockstun']);

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

interface Contact { att: PlayerIndex; move: MoveDef; at: { x: number; y: number } }

function apply(fs: [FighterState, FighterState], defs: Defs, c: Contact, events: GameEvent[]): void {
  const a = fs[c.att], di = (1 - c.att) as PlayerIndex, d = fs[di];
  const hit = c.move.hit;
  a.hasHit = true;
  a.hitstop = hit.hitstop;
  d.hitstop = hit.hitstop;
  const away: Facing = Math.sign(d.x - a.x) === -1 ? -1 : Math.sign(d.x - a.x) === 1 ? 1 : a.facing;
  const push = { perTick: away * Math.trunc((hit.pushback * SUB) / PUSHBACK_TICKS), ticks: PUSHBACK_TICKS };

  const stance = blockStance(d, hit.level);
  if (stance) {
    setAction(d, 'blockstun');
    d.actionTick = 0;
    d.stunTicks = hit.blockstun;
    d.crouching = stance === 'crouch';
    d.push = push;
    events.push({ type: 'block', attacker: c.att, strength: hit.strength, x: c.at.x, y: c.at.y });
    return;
  }

  const defenderMove = d.moveId ? defs[di].moves[d.moveId] : undefined;
  const grounded = d.arc === null && d.y === 0;
  const crouching = wasCrouching(d, defenderMove);
  d.health -= hit.damage;
  events.push({ type: 'hit', attacker: c.att, strength: hit.strength, x: c.at.x, y: c.at.y, damage: hit.damage });
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
export function resolveHits(fs: [FighterState, FighterState], defs: Defs, events: GameEvent[]): void {
  const contacts: Contact[] = [];
  for (const i of [0, 1] as const) {
    const a = fs[i], d = fs[1 - i]!;
    if (a.hasHit || a.hitstop > 0 || !a.moveId) continue;
    const hb = activeHitbox(a, defs[i]);
    const move = defs[i].moves[a.moveId];
    if (!hb || !move) continue;
    const W = worldBox(hb, a.x, a.y, a.facing);
    for (const box of hurtboxes(d, defs[1 - i]!)) {
      const H = worldBox(box, d.x, d.y, d.facing);
      if (overlaps(W, H)) {
        contacts.push({ att: i, move, at: overlapCenter(W, H) });
        break;
      }
    }
  }
  for (const c of contacts) apply(fs, defs, c, events);
}
