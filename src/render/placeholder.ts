import { BASE_HEIGHT, SIZE_SCALE, SUB } from '../engine/constants';
import { activeHitbox, hurtboxes } from '../engine/fighter';
import type { Box, FighterDef, FighterState } from '../engine/types';

/** World units, y up (y is the bottom edge), already mirrored for facing. */
export interface Shape { kind: 'rect' | 'circle'; x: number; y: number; w: number; h: number; color: string }

function fallbackBoxes(f: FighterState, def: FighterDef): Box[] {
  switch (f.action) {
    case 'down': {
      const h = BASE_HEIGHT * SIZE_SCALE[def.size];
      return [{ x: -h / 2, y: 0, w: h, h: 50 }];
    }
    case 'knockdown': case 'airReset': return def.airHurtboxes;
    case 'getup': return def.crouchingHurtboxes;
    default: return def.standingHurtboxes;
  }
}

/** A figure built from the current boxes: box 1 (the head, by template convention) is a circle; the hitbox is a solid limb. */
export function placeholderShapes(f: FighterState, def: FighterDef): Shape[] {
  const live = hurtboxes(f, def);
  const boxes = live.length > 0 ? live : fallbackBoxes(f, def);
  const ox = f.x / SUB, oy = f.y / SUB;
  const place = (b: Box, kind: Shape['kind'], color: string): Shape => ({
    kind, color, w: b.w, h: b.h, y: oy + b.y, x: f.facing === 1 ? ox + b.x : ox - (b.x + b.w),
  });
  const shapes = boxes.map((b, i) => place(b, i === 1 ? 'circle' : 'rect', i === 1 ? def.colors.secondary : def.colors.primary));
  const hb = activeHitbox(f, def);
  if (hb) shapes.push(place(hb, 'rect', def.colors.secondary));
  return shapes;
}
