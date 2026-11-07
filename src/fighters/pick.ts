import type { Strength } from '../engine/types';

/** Chooses a value by special-move strength. */
export const pick = <T>(s: Strength, light: T, medium: T, heavy: T): T => (s === 'light' ? light : s === 'medium' ? medium : heavy);
