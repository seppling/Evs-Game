import { DEFAULT_CONFIG } from '../engine/match';
import type { MatchConfig } from '../engine/types';
import { FIGHTER_IDS } from '../fighters/index';

export interface Setup { p1: string; p2: string; config: MatchConfig }

function intInRange(v: string | null, min: number, max: number): number | null {
  if (v === null || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
}

/** Reads ?p1=&p2=&time=&rounds= (for testing and quick setups). Anything invalid falls back to its default. */
export function parseSetup(search: string): Setup {
  const q = new URLSearchParams(search);
  const fighter = (key: string, fallback: string) => {
    const v = q.get(key);
    return v !== null && FIGHTER_IDS.includes(v) ? v : fallback;
  };
  const time = q.get('time');
  return {
    p1: fighter('p1', 'mohawk-man'),
    p2: fighter('p2', 'spin-kicker'),
    config: {
      roundsToWin: intInRange(q.get('rounds'), 1, 3) ?? DEFAULT_CONFIG.roundsToWin,
      roundSeconds: time === 'none' ? null : intInRange(time, 1, 99) ?? DEFAULT_CONFIG.roundSeconds,
    },
  };
}
