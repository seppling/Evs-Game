import { setAction } from './fighter';
import { STUN } from './constants';
import { BUTTONS, isDown } from '../input/types';
import type { FighterDef, FighterState, GameEvent, PlayerIndex } from './types';

/** Adds stun from a hit. Filling the bar queues a dizzy (once per combo). */
export function addStun(d: FighterState, dDef: FighterDef, amount: number): void {
  d.stunIdle = 0;
  if (d.dizzyUsed || amount <= 0) return;
  d.stun += amount;
  if (d.stun >= dDef.stunLimit) {
    d.dizzyPending = true;
    d.dizzyUsed = true;
  }
}

/** Runs every tick: stun drains once the fighter has gone STUN.drainDelay ticks without being hit. */
export function drainStun(f: FighterState): void {
  f.stunIdle++;
  if (f.stunIdle > STUN.drainDelay && f.stun > 0) f.stun = Math.max(0, f.stun - STUN.drainPerTick);
}

/** Called where hitstun or get-up would end: enters dizzy instead if one is queued. */
export function maybeEnterDizzy(f: FighterState, me: PlayerIndex, events: GameEvent[]): boolean {
  if (!f.dizzyPending || f.ko) return false;
  f.dizzyPending = false;
  f.stun = 0;
  setAction(f, 'dizzy');
  f.actionTick = 0;
  f.stunTicks = STUN.dizzyTicks;
  events.push({ type: 'dizzy', player: me });
  return true;
}

/** Each new button press or change of direction this tick shortens the dizzy. */
export function mashDizzy(f: FighterState): void {
  const h = f.input.history;
  const now = h[h.length - 1], prev = h[h.length - 2];
  if (!now) return;
  let inputs = BUTTONS.filter((b) => isDown(now.pressed, b)).length;
  if (prev && prev.dir !== now.dir) inputs++;
  f.stunTicks -= inputs * STUN.mashTicks;
}
