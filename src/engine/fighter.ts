import { clearPresses, emptyInputState, readCommand } from '../input/commands';
import { normalMoveId } from '../fighters/defaults';
import { KNOCKDOWN, PREJUMP_TICKS, PROXIMITY_GUARD_RANGE, SUB } from './constants';
import { arcY } from './geometry';
import type { Action, Box, Facing, FighterDef, FighterState, GameEvent, MoveDef, MoveFrame, MoveId, PlayerIndex } from './types';

export function createFighter(def: FighterDef, x: number, facing: Facing): FighterState {
  return {
    id: def.id, x, y: 0, facing, action: 'idle', actionTick: 0,
    moveId: null, hasHit: false, airAttackUsed: false, jumpDir: 0, arc: null,
    crouching: false, stunTicks: 0, hitstop: 0, push: null,
    health: def.health, ko: false, roundsWon: 0, input: emptyInputState(),
  };
}

/** Puts a fighter back at the start of a round. Keeps roundsWon. */
export function resetForRound(f: FighterState, def: FighterDef, x: number, facing: Facing): void {
  const roundsWon = f.roundsWon;
  Object.assign(f, createFighter(def, x, facing), { roundsWon, action: 'intro' as Action });
}

export function currentFrame(f: FighterState, def: FighterDef): MoveFrame | null {
  if (f.action !== 'attack' || !f.moveId) return null;
  const move = def.moves[f.moveId];
  if (!move) return null;
  let start = 0;
  for (const frame of move.frames) {
    if (f.actionTick < start + frame.ticks) return frame;
    start += frame.ticks;
  }
  return null;
}

export function moveTotalTicks(m: MoveDef): number {
  return m.frames.reduce((sum, fr) => sum + fr.ticks, 0);
}

export function activeHitbox(f: FighterState, def: FighterDef): Box | null {
  return currentFrame(f, def)?.hitbox ?? null;
}

/** Tick at which the move's first active (hitbox) frame starts. */
function firstActiveTick(m: MoveDef): number {
  let start = 0;
  for (const fr of m.frames) {
    if (fr.hitbox) return start;
    start += fr.ticks;
  }
  return -1;
}

const INVULNERABLE: ReadonlySet<Action> = new Set(['knockdown', 'down', 'getup', 'airReset', 'intro', 'win', 'lose']);
const STANCE_HELD: ReadonlySet<Action> = new Set(['guard', 'hitstun', 'blockstun']);

export function hurtboxes(f: FighterState, def: FighterDef): Box[] {
  if (INVULNERABLE.has(f.action)) return [];
  if (f.action === 'attack') return currentFrame(f, def)?.hurtboxes ?? def.standingHurtboxes;
  if (f.action === 'crouch' || (STANCE_HELD.has(f.action) && f.crouching)) return def.crouchingHurtboxes;
  if (f.action === 'air') return def.airHurtboxes;
  return def.standingHurtboxes;
}

const ACTIONABLE: ReadonlySet<Action> = new Set(['idle', 'walkForward', 'walkBack', 'crouch', 'guard']);

export function isActionable(f: FighterState): boolean {
  return ACTIONABLE.has(f.action);
}

/** Changes action (resetting actionTick only on a real change). Stance is kept only by stance-holding actions. */
export function setAction(f: FighterState, action: Action): void {
  if (f.action !== action) {
    f.action = action;
    f.actionTick = 0;
  }
  if (!STANCE_HELD.has(action)) f.crouching = action === 'crouch';
}

/** Is the opponent's attack in startup or active frames (not recovery)? */
function attackIsThreatening(opp: FighterState, oppDef: FighterDef): boolean {
  if (opp.action !== 'attack' || !opp.moveId) return false;
  const move = oppDef.moves[opp.moveId];
  if (!move) return false;
  let lastHitboxEnd = 0, start = 0;
  for (const fr of move.frames) {
    start += fr.ticks;
    if (fr.hitbox) lastHitboxEnd = start;
  }
  return opp.actionTick < lastHitboxEnd;
}

function startAttack(f: FighterState, moveId: MoveId): void {
  f.action = 'attack';
  f.moveId = moveId;
  f.actionTick = 0;
  f.hasHit = false;
  clearPresses(f.input);
}

function land(f: FighterState, me: PlayerIndex, events: GameEvent[]): void {
  if (f.action === 'air' || f.action === 'attack') {
    setAction(f, 'idle');
    f.moveId = null;
    f.airAttackUsed = false;
    events.push({ type: 'land', player: me });
  } else if (f.action === 'airReset') {
    setAction(f, 'idle');
  } else if (f.action === 'knockdown') {
    setAction(f, 'down');
  }
  f.airAttackUsed = false;
}

/** Advances timers, arcs and timed transitions by one tick. */
function advance(f: FighterState, def: FighterDef, me: PlayerIndex, events: GameEvent[]): void {
  f.actionTick++;
  if (f.arc) {
    const arc = f.arc;
    arc.t++;
    f.y = arcY(arc);
    f.x += arc.vx;
    if (arc.t >= arc.duration) {
      f.y = 0;
      f.arc = null;
      land(f, me, events);
    }
  }
  if (f.action === 'attack' && f.moveId) {
    const move = def.moves[f.moveId];
    if (!move || f.actionTick >= moveTotalTicks(move)) {
      f.moveId = null;
      setAction(f, f.arc ? 'air' : 'idle');
    } else if (f.actionTick === firstActiveTick(move)) {
      events.push({ type: 'swing', player: me, strength: move.hit.strength });
    }
  }
  if (f.action === 'hitstun' || f.action === 'blockstun') {
    f.stunTicks--;
    if (f.stunTicks <= 0) {
      f.stunTicks = 0;
      setAction(f, 'idle');
    }
  } else if (f.action === 'down' && !f.ko && f.actionTick >= KNOCKDOWN.lieTicks) {
    setAction(f, 'getup');
  } else if (f.action === 'getup' && f.actionTick >= KNOCKDOWN.getupTicks) {
    setAction(f, 'idle');
  }
  if (f.action === 'prejump' && f.actionTick >= PREJUMP_TICKS) {
    setAction(f, 'air');
    f.arc = { t: 0, duration: def.jump.duration, height: def.jump.height, startY: 0, vx: f.jumpDir * f.facing * def.jump.forwardSpeed };
    events.push({ type: 'jump', player: me });
  }
}

/** Chooses what an actionable fighter does this tick from its command. */
function decide(f: FighterState, def: FighterDef, opp: FighterState, oppDef: FighterDef): void {
  const cmd = readCommand(f.input, f.facing);
  const threatened = cmd.back && attackIsThreatening(opp, oppDef) && Math.abs(opp.x - f.x) <= PROXIMITY_GUARD_RANGE * SUB;
  if (cmd.press) {
    startAttack(f, normalMoveId(cmd.down ? 'crouch' : 'stand', cmd.press));
  } else if (cmd.up) {
    setAction(f, 'prejump');
    f.jumpDir = cmd.forward ? 1 : cmd.back ? -1 : 0;
  } else if (threatened) {
    setAction(f, 'guard');
    f.crouching = cmd.down;
  } else if (cmd.down) {
    setAction(f, 'crouch');
  } else if (cmd.forward) {
    setAction(f, 'walkForward');
    f.x += def.walkForward * f.facing;
  } else if (cmd.back) {
    setAction(f, 'walkBack');
    f.x -= def.walkBack * f.facing;
  } else {
    setAction(f, 'idle');
  }
}

/** One tick for one fighter. `active` false means inputs are ignored (intro, KO, round end). */
export function updateFighter(f: FighterState, def: FighterDef, opp: FighterState, oppDef: FighterDef,
  me: PlayerIndex, active: boolean, events: GameEvent[]): void {
  if (f.hitstop > 0) {
    f.hitstop--;
    return;
  }
  advance(f, def, me, events);
  if (isActionable(f)) {
    if (active) decide(f, def, opp, oppDef);
    else setAction(f, 'idle');
  } else if (active && f.action === 'air' && !f.airAttackUsed) {
    const press = readCommand(f.input, f.facing).press;
    if (press) {
      startAttack(f, normalMoveId('air', press));
      f.airAttackUsed = true;
    }
  }
}
