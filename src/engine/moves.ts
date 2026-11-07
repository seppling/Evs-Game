import type { Button } from '../input/types';
import type { HitProps, MoveDef, MoveFrame, MoveId, Stance, Strength } from './types';

const PREFIX: Record<Stance, string> = { stand: 'stand', crouch: 'crouch', air: 'jump' };

export function normalMoveId(stance: Stance, button: Button): MoveId {
  return `${PREFIX[stance]}-${button.toLowerCase()}`;
}

export const strengthMoveId = (base: string, s: Strength): MoveId => `${base}-${s}`;

/** The move's hit properties with this frame's overrides applied. */
export function effectiveHit(move: MoveDef, frame: MoveFrame): HitProps {
  return frame.hit ? { ...move.hit, ...frame.hit } : move.hit;
}
