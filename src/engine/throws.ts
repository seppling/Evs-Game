import { clearPresses } from '../input/commands';
import { PUSHBACK_TICKS, SUB, THROW } from './constants';
import { applyContact } from './combat';
import { currentFrame, setAction } from './fighter';
import type { World } from './tick';
import type { Action, Defs, FighterDef, FighterState, GameEvent, PlayerIndex } from './types';

const NOT_THROWABLE: ReadonlySet<Action> = new Set([
  'hitstun', 'blockstun', 'knockdown', 'down', 'getup', 'airReset', 'thrown', 'throwing', 'landing',
]);

const isThrowMove = (f: FighterState) => f.action === 'attack' && (f.moveId === 'throw-forward' || f.moveId === 'throw-back');

export function throwable(d: FighterState, dDef: FighterDef): boolean {
  if (d.arc !== null || d.y !== 0 || NOT_THROWABLE.has(d.action) || d.throwProtect > 0) return false;
  return !currentFrame(d, dDef)?.flags?.includes('throwInvuln');
}

export function inThrowRange(a: FighterState, d: FighterState): boolean {
  return Math.abs(a.x - d.x) <= THROW.range * SUB;
}

/** Both fighters let go and slide apart. */
function breakApart(fs: [FighterState, FighterState]): void {
  for (const i of [0, 1] as const) {
    const f = fs[i], other = fs[1 - i]!;
    setAction(f, 'idle');
    f.moveId = null;
    const dir = f.x < other.x ? -1 : f.x > other.x ? 1 : i === 0 ? -1 : 1;
    f.push = { perTick: dir * Math.trunc((THROW.breakPush * SUB) / PUSHBACK_TICKS), ticks: PUSHBACK_TICKS };
  }
}

function escapePressed(d: FighterState): boolean {
  const ps = d.input.presses;
  if (ps.some((p) => p.button === 'THROW')) return true;
  const lp = ps.find((p) => p.button === 'LP'), lk = ps.find((p) => p.button === 'LK');
  return !!lp && !!lk && Math.abs(lp.age - lk.age) <= 2;
}

/** Grabs (including simultaneous-throw breaks), throw escapes, and throws landing. */
export function resolveThrows(w: World, defs: Defs, events: GameEvent[]): void {
  const fs = w.fs;
  const grabbers = ([0, 1] as const).filter((i) => {
    const f = fs[i];
    return isThrowMove(f) && f.hitstop === 0 && f.actionTick === THROW.startup
      && inThrowRange(f, fs[1 - i]!) && throwable(fs[1 - i]!, defs[1 - i]!);
  });
  // A throw that is still starting up when the opponent's grab arrives also counts as simultaneous:
  // pressing throw a split second late breaks the throw instead of always losing.
  const lateThrow = grabbers.length === 1 && isThrowMove(fs[1 - grabbers[0]!]!) && fs[1 - grabbers[0]!]!.actionTick < THROW.startup;
  if (grabbers.length === 2 || lateThrow) {
    breakApart(fs);
    events.push({ type: 'throwEscape', player: 0 }, { type: 'throwEscape', player: 1 });
  } else if (grabbers.length === 1) {
    const i = grabbers[0]!;
    const a = fs[i], d = fs[1 - i]!;
    d.throwBack = a.moveId === 'throw-back';
    setAction(a, 'throwing');
    a.actionTick = 0;
    setAction(d, 'thrown');
    d.actionTick = 0;
    d.moveId = null;
    events.push({ type: 'throw', player: i });
  }

  for (const di of [0, 1] as const) {
    const d = fs[di], a = fs[1 - di]!;
    if (d.action === 'thrown' && a.action === 'throwing' && d.actionTick < THROW.escapeWindow && escapePressed(d)) {
      breakApart(fs);
      clearPresses(d.input);
      events.push({ type: 'throwEscape', player: di });
    }
  }

  for (const ai of [0, 1] as const) {
    const a = fs[ai], d = fs[1 - ai]!;
    if (a.action !== 'throwing') continue;
    if (a.actionTick === THROW.hitTick && d.action === 'thrown') {
      if (d.throwBack) d.x = a.x - a.facing * THROW.behind * SUB;
      const move = defs[ai].moves[a.moveId ?? 'throw-forward']!;
      applyContact(w, defs, { att: ai as PlayerIndex, hit: move.hit, kind: 'throw', easy: false, at: { x: d.x, y: 150 * SUB }, projectile: false, group: 0 }, events);
    }
    if (a.actionTick >= THROW.duration) {
      setAction(a, 'idle');
      a.moveId = null;
    }
  }
}
