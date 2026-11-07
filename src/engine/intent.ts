import { PRESS_PRIORITY } from '../input/commands';
import { motionDone, type Motion } from '../input/motions';
import type { Button, InputButton, InputState } from '../input/types';
import { METER_MAX } from './constants';
import { normalMoveId, strengthMoveId } from './moves';
import type { FighterDef, MoveId, Stance } from './types';

export type Intent = { type: 'move'; moveId: MoveId; easy: boolean } | { type: 'throw'; back: boolean };

export interface IntentContext {
  def: FighterDef; stance: Stance; meter: number; hasProjectile: boolean; easy: boolean; throwInRange: boolean;
}

/** When several specials match, the more specific motion wins. */
const MOTION_ORDER: readonly Motion[] = ['dp', 'chargeDown', 'chargeBack', 'qcb', 'qcf'];
const GROUPS: Record<'P' | 'K', readonly Button[]> = { P: ['LP', 'MP', 'HP'], K: ['LK', 'MK', 'HK'] };
const CHORD_TICKS = 2;

type Press = { button: InputButton; age: number };

const move = (moveId: MoveId, easy: boolean): Intent => ({ type: 'move', moveId, easy });

function matchesButton(pattern: Button | 'P' | 'K', b: InputButton): boolean {
  return pattern === 'P' || pattern === 'K' ? (GROUPS[pattern] as readonly string[]).includes(b) : pattern === b;
}

/** The newest buffered press of a button, if any. */
function youngest(presses: readonly Press[], b: InputButton): Press | undefined {
  return presses.filter((p) => p.button === b).sort((x, y) => x.age - y.age)[0];
}

/** Turns buffered input into the move the player is asking for: super > special > throw > normal. */
export function resolveIntent(input: InputState, ctx: IntentContext): Intent | null {
  const { history, presses } = input;
  if (presses.length === 0) return null;
  const at = (p: Press) => history.length - 1 - p.age;
  const attack = presses.filter((p) => p.button !== 'THROW' && p.button !== 'SPECIAL');
  const normal = PRESS_PRIORITY.find((b) => attack.some((p) => p.button === b)) ?? null;
  if (ctx.stance === 'air') return normal ? move(normalMoveId('air', normal), false) : null;

  const special = ctx.easy ? youngest(presses, 'SPECIAL') : undefined;

  // 1. Super
  if (ctx.meter >= METER_MAX) {
    const sup = ctx.def.moves['super'];
    if (sup?.input.motion) {
      for (const p of attack) if (matchesButton(sup.input.button, p.button) && motionDone(history, at(p), sup.input.motion)) return move('super', false);
    }
    if (sup && special && attack.some((p) => (p.button === 'HP' || p.button === 'HK') && Math.abs(p.age - special.age) <= CHORD_TICKS)) {
      return move('super', true);
    }
  }

  // 2. Special
  let best: { id: MoveId; rank: number } | null = null;
  for (const [id, m] of Object.entries(ctx.def.moves)) {
    const motion = m.input.motion;
    if (m.kind !== 'special' || !motion || (m.projectile && ctx.hasProjectile)) continue;
    for (const p of attack) {
      if (p.button !== m.input.button || !motionDone(history, at(p), motion)) continue;
      // ↓↘→↓↘→ contains →↓↘ in its middle; a completed double quarter-circle is read as quarter-circles, never as a dragon punch.
      if (motion === 'dp' && motionDone(history, at(p), 'qcf2')) continue;
      const rank = MOTION_ORDER.indexOf(motion);
      if (!best || rank < best.rank) best = { id, rank };
    }
  }
  if (best) return move(best.id, false);
  if (special) {
    const dir = history[at(special)]?.dir ?? 5;
    const slots = ctx.def.specialSlots;
    const slot = [1, 2, 3].includes(dir) ? slots[2] : [6, 9].includes(dir) ? slots[1] : [4, 7].includes(dir) ? (slots[3] ?? slots[0]) : slots[0];
    const id = slot ? strengthMoveId(slot, 'medium') : null;
    const m = id ? ctx.def.moves[id] : undefined;
    if (id && m && !(m.projectile && ctx.hasProjectile)) return move(id, true);
  }

  // 3. Throw (standing only)
  if (ctx.stance === 'stand') {
    const t = youngest(presses, 'THROW');
    const lp = youngest(presses, 'LP'), lk = youngest(presses, 'LK');
    const chord = lp && lk && Math.abs(lp.age - lk.age) <= CHORD_TICKS ? (lp.age <= lk.age ? lp : lk) : undefined;
    const trigger = t ?? (ctx.throwInRange ? chord : undefined);
    if (trigger) return { type: 'throw', back: [1, 4, 7].includes(history[at(trigger)]?.dir ?? 5) };
  }

  // 4. Normal
  return normal ? move(normalMoveId(ctx.stance, normal), false) : null;
}
