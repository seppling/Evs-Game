import { START_SEPARATION, STAGE_WIDTH, SUB } from './constants';
import { createFighter, resetForRound } from './fighter';
import type { Defs, MatchConfig, MatchState } from './types';

export const DEFAULT_CONFIG: Readonly<MatchConfig> = Object.freeze({ roundsToWin: 2, roundSeconds: 99, easy: [false, false], easyDamage: true }) as MatchConfig;

export const START_X: readonly [number, number] = [
  (STAGE_WIDTH / 2 - START_SEPARATION / 2) * SUB,
  (STAGE_WIDTH / 2 + START_SEPARATION / 2) * SUB,
];

export function createMatch(defs: Defs, config: Partial<MatchConfig> = {}): MatchState {
  const cfg: MatchConfig = { ...DEFAULT_CONFIG, ...config, easy: [...(config.easy ?? DEFAULT_CONFIG.easy)] as [boolean, boolean] };
  const p1 = createFighter(defs[0], START_X[0], 1);
  const p2 = createFighter(defs[1], START_X[1], -1);
  p1.action = 'intro';
  p2.action = 'intro';
  return {
    tick: 0, phase: 'intro', phaseTick: 0, round: 1, roundsPlayed: 0,
    timer: cfg.roundSeconds, timerTicks: 0, roundResult: null, roundEndReason: null, perfect: false, matchWinner: null,
    fighters: [p1, p2], config: cfg, projectiles: [], freeze: null,
  };
}

/** Resets both fighters and the clock for the next round. */
export function startNextRound(s: MatchState, defs: Defs): void {
  s.round++;
  resetForRound(s.fighters[0], defs[0], START_X[0], 1);
  resetForRound(s.fighters[1], defs[1], START_X[1], -1);
  s.timer = s.config.roundSeconds;
  s.timerTicks = 0;
  s.roundResult = null;
  s.roundEndReason = null;
  s.perfect = false;
  s.phase = 'intro';
  s.phaseTick = 0;
}
