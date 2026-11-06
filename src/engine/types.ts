import type { Button, InputState } from '../input/types';

export type PlayerIndex = 0 | 1;
export type Facing = 1 | -1;

/** Units, relative to the fighter's feet, authored facing right. */
export interface Box { x: number; y: number; w: number; h: number }
/** Subunits, world space. */
export interface WorldBox { x1: number; y1: number; x2: number; y2: number }

export type Strength = 'light' | 'medium' | 'heavy';
export type HitLevel = 'mid' | 'low' | 'overhead';
export type Stance = 'stand' | 'crouch' | 'air';
export type MoveId = string;
export type MoveFlag = 'strikeInvuln' | 'throwInvuln' | 'projectileInvuln' | 'upperInvuln' | 'counter' | 'armor';

export interface HitProps {
  damage: number; chip: number; stun: number; hitstun: number; blockstun: number;
  hitstop: number; pushback: number; level: HitLevel; knockdown: boolean; meterGain: number; strength: Strength;
}

export interface MoveFrame {
  sprite: string; ticks: number; hurtboxes: Box[]; hitbox?: Box;
  velocity?: { x: number; y: number }; flags?: MoveFlag[];
}

export interface InputPattern { button: Button; stance: Stance }

export interface MoveDef { input: InputPattern; frames: MoveFrame[]; hit: HitProps; cancels: ('special' | 'super' | 'chain')[] }

export type FighterSize = 'small' | 'medium' | 'tall' | 'big';

export interface FighterDef {
  id: string; name: string; size: FighterSize; health: number; stunLimit: number;
  /** Subunits per tick. */
  walkForward: number; walkBack: number;
  /** height in units, duration in ticks, forwardSpeed in subunits per tick. */
  jump: { height: number; duration: number; forwardSpeed: number };
  colors: { primary: string; secondary: string };
  pushbox: Box; airPushbox: Box; standingHurtboxes: Box[]; crouchingHurtboxes: Box[]; airHurtboxes: Box[];
  moves: Record<MoveId, MoveDef>;
}

export type Defs = readonly [FighterDef, FighterDef];

export type Action = 'intro' | 'idle' | 'walkForward' | 'walkBack' | 'crouch' | 'guard' | 'prejump' | 'air'
  | 'attack' | 'hitstun' | 'blockstun' | 'knockdown' | 'down' | 'getup' | 'airReset' | 'win' | 'lose';

/** height in units; startY in subunits; vx in subunits per tick. */
export interface Arc { t: number; duration: number; height: number; startY: number; vx: number }

export interface FighterState {
  id: string; x: number; y: number; facing: Facing; action: Action; actionTick: number;
  moveId: MoveId | null; hasHit: boolean; airAttackUsed: boolean; jumpDir: -1 | 0 | 1; arc: Arc | null;
  crouching: boolean; stunTicks: number; hitstop: number; push: { perTick: number; ticks: number } | null;
  health: number; ko: boolean; roundsWon: number; input: InputState;
}

export type Phase = 'intro' | 'fight' | 'ko' | 'roundEnd' | 'matchEnd';
export type RoundResult = PlayerIndex | 'draw';
export interface MatchConfig { roundsToWin: number; roundSeconds: number | null }

export interface MatchState {
  tick: number; phase: Phase; phaseTick: number; round: number; roundsPlayed: number;
  timer: number | null; timerTicks: number; roundResult: RoundResult | null;
  roundEndReason: 'ko' | 'doubleKo' | 'time' | null; perfect: boolean; matchWinner: RoundResult | null;
  fighters: [FighterState, FighterState]; config: MatchConfig;
}

export type GameEvent =
  | { type: 'hit'; attacker: PlayerIndex; strength: Strength; x: number; y: number; damage: number }
  | { type: 'block'; attacker: PlayerIndex; strength: Strength; x: number; y: number }
  | { type: 'swing'; player: PlayerIndex; strength: Strength }
  | { type: 'jump' | 'land' | 'knockdown'; player: PlayerIndex }
  | { type: 'roundStart'; round: number }
  | { type: 'fight' }
  | { type: 'ko'; player: PlayerIndex }
  | { type: 'timeUp' }
  | { type: 'roundOver'; result: RoundResult }
  | { type: 'matchOver'; winner: RoundResult };
