import { isDown, type RawInput } from '../input/types';

/** Per player: was the Special button pressed this frame (down now, up last frame)? */
export function specialEdges(prev: readonly [number, number], inputs: readonly [RawInput, RawInput]): [boolean, boolean] {
  return [0, 1].map((i) => isDown(inputs[i]!.buttons, 'SPECIAL') && !isDown(prev[i]!, 'SPECIAL')) as [boolean, boolean];
}
