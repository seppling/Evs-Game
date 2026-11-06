import type { FighterDef } from '../engine/types';
import { mohawkMan } from './mohawk-man';
import { spinKicker } from './spin-kicker';

export const FIGHTERS: Readonly<Record<string, FighterDef>> = Object.freeze({
  [mohawkMan.id]: mohawkMan,
  [spinKicker.id]: spinKicker,
});

export const FIGHTER_IDS: readonly string[] = Object.keys(FIGHTERS);

export function getFighter(id: string): FighterDef | undefined {
  return Object.prototype.hasOwnProperty.call(FIGHTERS, id) ? FIGHTERS[id] : undefined;
}
