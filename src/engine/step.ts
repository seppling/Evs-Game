import type { RawInput } from '../input/types';
import { KO_SLOWMO_FACTOR, KO_SLOWMO_TICKS, ROUND_END_TICKS, ROUND_INTRO_TICKS, TICKS_PER_SECOND } from './constants';
import { isActionable } from './fighter';
import { startNextRound } from './match';
import { tickFighters } from './tick';
import type { Defs, GameEvent, MatchState, Phase, PlayerIndex, RoundResult } from './types';

function enter(s: MatchState, phase: Phase): void {
  s.phase = phase;
  s.phaseTick = 0;
}

function enterRoundEnd(s: MatchState, defs: Defs, events: GameEvent[]): void {
  enter(s, 'roundEnd');
  s.roundsPlayed++;
  const r = s.roundResult;
  if (r !== null && r !== 'draw') {
    s.fighters[r].roundsWon++;
    s.perfect = s.fighters[r].health === defs[r].health;
  }
  events.push({ type: 'roundOver', result: r ?? 'draw' });
}

/** Win/lose poses for fighters that are free to strike one. */
function strikePoses(s: MatchState): void {
  const result = s.phase === 'matchEnd' ? s.matchWinner : s.roundResult;
  s.fighters.forEach((f, i) => {
    if (f.ko || !isActionable(f)) return;
    f.action = result === i ? 'win' : 'lose';
    f.actionTick = 0;
  });
}

function timeUpResult(s: MatchState, defs: Defs): RoundResult {
  const pct = (i: PlayerIndex) => Math.trunc((s.fighters[i].health * 1000) / defs[i].health);
  const a = pct(0), b = pct(1);
  return a === b ? 'draw' : a > b ? 0 : 1;
}

/** Advances the match by one tick. Never mutates `state`. */
export function step(state: MatchState, inputs: readonly [RawInput, RawInput], defs: Defs): { state: MatchState; events: GameEvent[] } {
  const s = structuredClone(state);
  const events: GameEvent[] = [];
  s.tick++;
  switch (s.phase) {
    case 'intro': {
      if (s.phaseTick === 0) events.push({ type: 'roundStart', round: s.round });
      tickFighters(s.fighters, inputs, defs, false, events);
      s.phaseTick++;
      if (s.phaseTick >= ROUND_INTRO_TICKS) {
        enter(s, 'fight');
        for (const f of s.fighters) { f.action = 'idle'; f.actionTick = 0; }
        events.push({ type: 'fight' });
      }
      break;
    }
    case 'fight': {
      tickFighters(s.fighters, inputs, defs, true, events);
      s.phaseTick++;
      const kos = ([0, 1] as const).filter((i) => s.fighters[i].ko);
      if (kos.length > 0) {
        s.roundResult = kos.length === 2 ? 'draw' : (kos[0] === 0 ? 1 : 0);
        s.roundEndReason = kos.length === 2 ? 'doubleKo' : 'ko';
        for (const i of kos) events.push({ type: 'ko', player: i });
        enter(s, 'ko');
        break;
      }
      if (s.timer !== null) {
        s.timerTicks++;
        if (s.timerTicks >= TICKS_PER_SECOND) {
          s.timer--;
          s.timerTicks = 0;
        }
        if (s.timer <= 0) {
          s.timer = 0;
          events.push({ type: 'timeUp' });
          s.roundResult = timeUpResult(s, defs);
          s.roundEndReason = 'time';
          enterRoundEnd(s, defs, events);
        }
      }
      break;
    }
    case 'ko': {
      if (s.phaseTick % KO_SLOWMO_FACTOR === 0) tickFighters(s.fighters, inputs, defs, false, events);
      s.phaseTick++;
      if (s.phaseTick >= KO_SLOWMO_TICKS) enterRoundEnd(s, defs, events);
      break;
    }
    case 'roundEnd': {
      tickFighters(s.fighters, inputs, defs, false, events);
      strikePoses(s);
      s.phaseTick++;
      if (s.phaseTick >= ROUND_END_TICKS) {
        const winner = ([0, 1] as const).find((i) => s.fighters[i].roundsWon >= s.config.roundsToWin);
        if (winner !== undefined || s.roundsPlayed >= 2 * s.config.roundsToWin + 1) {
          s.matchWinner = winner ?? 'draw';
          enter(s, 'matchEnd');
          events.push({ type: 'matchOver', winner: s.matchWinner });
        } else {
          startNextRound(s, defs);
        }
      }
      break;
    }
    case 'matchEnd': {
      tickFighters(s.fighters, inputs, defs, false, events);
      strikePoses(s);
      s.phaseTick++;
      break;
    }
  }
  return { state: s, events };
}
