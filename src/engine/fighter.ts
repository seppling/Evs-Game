import { clearPresses, emptyInputState, readCommand } from '../input/commands';
import { effectiveHit } from './moves';
import { KNOCKDOWN, METER_GAIN, METER_MAX, PREJUMP_TICKS, PROXIMITY_GUARD_RANGE, SUB } from './constants';
import { arcY } from './geometry';
import { resolveIntent, type Intent } from './intent';
import { hasProjectile, spawnProjectile } from './projectiles';
import type { World } from './tick';
import type { Action, Box, Facing, FighterDef, FighterState, GameEvent, HitProps, MoveDef, MoveFrame, MoveId, MoveKind, PlayerIndex } from './types';

export function createFighter(def: FighterDef, x: number, facing: Facing): FighterState {
  return {
    id: def.id, x, y: 0, facing, action: 'idle', actionTick: 0,
    moveId: null, hasHit: false, airAttackUsed: false, jumpDir: 0, arc: null,
    crouching: false, stunTicks: 0, hitstop: 0, push: null,
    health: def.health, ko: false, roundsWon: 0, input: emptyInputState(),
    hitGroups: 0, cancelTicks: 0, easyMove: false, meter: 0, stun: 0, stunIdle: 0,
    dizzyPending: false, dizzyUsed: false, comboHits: 0, comboDamage: 0, throwProtect: 0, throwBack: false,
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

/** The current hitbox with its hit group and effective hit properties, for combat. */
export function activeHit(f: FighterState, def: FighterDef): { box: Box; group: number; hit: HitProps; kind: MoveKind } | null {
  const frame = currentFrame(f, def);
  const move = f.moveId ? def.moves[f.moveId] : undefined;
  if (!frame?.hitbox || !move) return null;
  return { box: frame.hitbox, group: frame.hitGroup ?? 0, hit: effectiveHit(move, frame), kind: move.kind };
}

/** Index and start tick of the frame the fighter is in. */
function frameAt(move: MoveDef, tick: number): { frame: MoveFrame; start: number } | null {
  let start = 0;
  for (const frame of move.frames) {
    if (tick < start + frame.ticks) return { frame, start };
    start += frame.ticks;
  }
  return null;
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

const INVULNERABLE: ReadonlySet<Action> = new Set(['knockdown', 'down', 'getup', 'airReset', 'intro', 'win', 'lose', 'thrown', 'throwing']);
const STANCE_HELD: ReadonlySet<Action> = new Set(['guard', 'hitstun', 'blockstun']);
const TIMED: ReadonlySet<Action> = new Set(['hitstun', 'blockstun', 'landing']);

export function hurtboxes(f: FighterState, def: FighterDef): Box[] {
  if (INVULNERABLE.has(f.action)) return [];
  if (f.action === 'attack') return currentFrame(f, def)?.hurtboxes ?? def.standingHurtboxes;
  if (f.action === 'crouch' || f.action === 'landing' || (STANCE_HELD.has(f.action) && f.crouching)) return def.crouchingHurtboxes;
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

/** Starts a move. A super spends the full meter and announces itself. */
export function startMove(f: FighterState, def: FighterDef, moveId: MoveId, easy: boolean, me: PlayerIndex, events: GameEvent[]): void {
  setAction(f, 'attack');
  f.action = 'attack';
  f.moveId = moveId;
  f.actionTick = 0;
  f.hasHit = false;
  f.hitGroups = 0;
  f.cancelTicks = 0;
  f.easyMove = easy;
  clearPresses(f.input);
  const move = def.moves[moveId];
  if (move?.kind === 'super') {
    f.meter = Math.max(0, f.meter - METER_MAX);
    events.push({ type: 'superFlash', player: me, name: move.name });
  }
}

function gainMeter(f: FighterState, amount: number): void {
  f.meter = Math.min(METER_MAX, f.meter + amount);
}

/** A special that ends without ever connecting still earns a little meter. */
function endMove(f: FighterState, def: FighterDef): void {
  const move = f.moveId ? def.moves[f.moveId] : undefined;
  // A projectile special is judged by its projectile instead (see projectiles.ts).
  if (move?.kind === 'special' && !f.hasHit && !move.projectile) gainMeter(f, METER_GAIN.specialWhiff);
  f.moveId = null;
}

function startIntent(f: FighterState, def: FighterDef, intent: Intent, me: PlayerIndex, events: GameEvent[]): void {
  if (intent.type === 'throw') startMove(f, def, intent.back ? 'throw-back' : 'throw-forward', false, me, events);
  else startMove(f, def, intent.moveId, intent.easy, me, events);
}

function intentFor(f: FighterState, def: FighterDef, me: PlayerIndex, w: World, stance: 'stand' | 'crouch' | 'air'): Intent | null {
  return resolveIntent(f.input, {
    def, stance, meter: f.meter, hasProjectile: hasProjectile(w, me),
    easy: w.easy[me], throwInRange: false,
  });
}

/** May the move in progress be cancelled into `next` right now? */
function cancelAllowed(cur: MoveDef, next: MoveDef): boolean {
  if (next.kind === 'special') return cur.cancels.includes('special');
  if (next.kind === 'super') return cur.cancels.includes('super');
  return next.kind === 'normal' && next.hit.strength === 'light' && cur.kind === 'normal'
    && cur.hit.strength === 'light' && cur.cancels.includes('chain');
}

function land(f: FighterState, def: FighterDef, me: PlayerIndex, events: GameEvent[]): void {
  const move = f.action === 'attack' && f.moveId ? def.moves[f.moveId] : undefined;
  if (move?.landing !== undefined) {
    endMove(f, def);
    setAction(f, 'landing');
    f.stunTicks = move.landing;
  } else if (f.action === 'air' || f.action === 'attack') {
    if (f.action === 'attack') endMove(f, def);
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
function advance(f: FighterState, def: FighterDef, me: PlayerIndex, events: GameEvent[], w: World): void {
  f.actionTick++;
  if (f.arc) {
    const arc = f.arc;
    arc.t++;
    f.y = arcY(arc);
    f.x += arc.vx;
    if (arc.t >= arc.duration) {
      f.y = 0;
      f.arc = null;
      land(f, def, me, events);
    }
  }
  if (f.action === 'attack' && f.moveId) {
    const move = def.moves[f.moveId];
    const at = move ? frameAt(move, f.actionTick) : null;
    if (!move || !at) {
      endMove(f, def);
      setAction(f, f.arc ? 'air' : 'idle');
    } else {
      if (f.actionTick === firstActiveTick(move)) events.push({ type: 'swing', player: me, strength: move.hit.strength });
      if (f.actionTick === at.start && at.frame.leap) {
        const { height, duration, forward } = at.frame.leap;
        f.arc = { t: 0, duration, height, startY: f.y, vx: forward * f.facing || 0 };
      }
      if (f.actionTick === at.start && at.frame.spawnProjectile && move.projectile && f.moveId) {
        spawnProjectile(w, me, f, f.moveId, move.projectile);
      }
      if (at.frame.velocity) f.x += at.frame.velocity.x * f.facing;
    }
  }
  if (TIMED.has(f.action)) {
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
function decide(f: FighterState, def: FighterDef, opp: FighterState, oppDef: FighterDef, me: PlayerIndex, events: GameEvent[], w: World): void {
  const cmd = readCommand(f.input, f.facing);
  const threatened = cmd.back && attackIsThreatening(opp, oppDef) && Math.abs(opp.x - f.x) <= PROXIMITY_GUARD_RANGE * SUB;
  const intent = intentFor(f, def, me, w, cmd.down ? 'crouch' : 'stand');
  if (intent) {
    startIntent(f, def, intent, me, events);
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
  me: PlayerIndex, active: boolean, events: GameEvent[], w: World): void {
  if (f.hitstop > 0) {
    f.hitstop--;
    return;
  }
  // Cancels and chains: for a few ticks after a move connects (hit or block), a special, super or light chain can interrupt it.
  if (active && f.action === 'attack' && f.hasHit && f.cancelTicks > 0 && f.moveId) {
    f.cancelTicks--;
    const cur = def.moves[f.moveId];
    const intent = intentFor(f, def, me, w, f.arc ? 'air' : readCommand(f.input, f.facing).down ? 'crouch' : 'stand');
    const next = intent?.type === 'move' ? def.moves[intent.moveId] : undefined;
    if (cur && intent && next && cancelAllowed(cur, next)) {
      startIntent(f, def, intent, me, events);
      return;
    }
  }
  advance(f, def, me, events, w);
  // A combo ends when the defender is free again (or lying down).
  if (isActionable(f) || f.action === 'down') {
    f.comboHits = 0;
    f.comboDamage = 0;
    f.dizzyUsed = false;
  }
  // A fighter that just became free (landing, end of stun, getting up) turns to face the opponent
  // before reading its controls, so "back" and attacks point the right way after a cross-up.
  if (isActionable(f) && f.y === 0 && f.arc === null && f.x !== opp.x) f.facing = opp.x > f.x ? 1 : -1;
  if (isActionable(f)) {
    if (active) decide(f, def, opp, oppDef, me, events, w);
    else setAction(f, 'idle');
  } else if (active && f.action === 'air' && !f.airAttackUsed) {
    const intent = intentFor(f, def, me, w, 'air');
    if (intent) {
      startIntent(f, def, intent, me, events);
      f.airAttackUsed = true;
    }
  }
}
