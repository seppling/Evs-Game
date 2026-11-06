import { SUB } from './constants';
import type { Arc, Box, Facing, WorldBox } from './types';

export function worldBox(box: Box, x: number, y: number, facing: Facing): WorldBox {
  const x1 = facing === 1 ? x + box.x * SUB : x - (box.x + box.w) * SUB;
  const y1 = y + box.y * SUB;
  return { x1, y1, x2: x1 + box.w * SUB, y2: y1 + box.h * SUB };
}

/** Touching edges do not overlap. */
export function overlaps(a: WorldBox, b: WorldBox): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

export function overlapCenter(a: WorldBox, b: WorldBox): { x: number; y: number } {
  const x1 = Math.max(a.x1, b.x1), x2 = Math.min(a.x2, b.x2);
  const y1 = Math.max(a.y1, b.y1), y2 = Math.min(a.y2, b.y2);
  return { x: Math.trunc((x1 + x2) / 2), y: Math.trunc((y1 + y2) / 2) };
}

/** Height (subunits) along an arc: a straight drop from startY plus a parabola peaking at `height` units. */
export function arcY(arc: Arc): number {
  const { t, duration: d, height, startY } = arc;
  return Math.trunc((startY * (d - t)) / d) + Math.trunc((4 * height * SUB * t * (d - t)) / (d * d));
}
