import { normalMoveId } from '../fighters/defaults';
import { BUTTONS } from '../input/types';
import type { Box, FighterDef } from './types';

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SPRITE_RE = /^[a-z0-9-]+_\d{2}$/;
const posInt = (n: number) => Number.isInteger(n) && n > 0;

/** Returns one readable message per problem; [] when the fighter is valid. */
export function validateFighter(def: FighterDef): string[] {
  const errors: string[] = [];
  const who = def.id || '(no id)';
  const err = (msg: string) => errors.push(`${who}: ${msg}`);
  const checkBox = (where: string, box: Box) => { if (!(box.w > 0 && box.h > 0)) err(`${where}: box must have w > 0 and h > 0`); };

  if (!ID_RE.test(def.id)) err(`id "${def.id}" must be lowercase words joined by hyphens`);
  for (const [name, value] of [['health', def.health], ['stunLimit', def.stunLimit], ['walkForward', def.walkForward],
    ['walkBack', def.walkBack], ['jump.height', def.jump.height], ['jump.duration', def.jump.duration]] as const) {
    if (!posInt(value)) err(`${name} must be a positive integer (got ${value})`);
  }
  checkBox('pushbox', def.pushbox);
  checkBox('airPushbox', def.airPushbox);
  for (const [list, boxes] of [['standingHurtboxes', def.standingHurtboxes], ['crouchingHurtboxes', def.crouchingHurtboxes], ['airHurtboxes', def.airHurtboxes]] as const) {
    boxes.forEach((bx, i) => checkBox(`${list}[${i}]`, bx));
  }
  for (const stance of ['stand', 'crouch', 'air'] as const) {
    for (const button of BUTTONS) {
      const id = normalMoveId(stance, button);
      if (!def.moves[id]) err(`missing normal move ${id}`);
    }
  }
  for (const [id, move] of Object.entries(def.moves)) {
    if (move.frames.length === 0) { err(`move ${id} has no frames`); continue; }
    if (!move.frames.some((f) => f.hitbox)) err(`move ${id} has no frame with a hitbox`);
    if (move.hit.damage < 0) err(`move ${id} has negative damage`);
    move.frames.forEach((f, i) => {
      if (!posInt(f.ticks)) err(`move ${id} frame ${i} ticks must be a positive integer (got ${f.ticks})`);
      if (!SPRITE_RE.test(f.sprite)) err(`move ${id} frame ${i} sprite "${f.sprite}" must look like name_01`);
      f.hurtboxes.forEach((bx, j) => checkBox(`move ${id} frame ${i} hurtbox ${j}`, bx));
      if (f.hitbox) checkBox(`move ${id} frame ${i} hitbox`, f.hitbox);
    });
  }
  return errors;
}
