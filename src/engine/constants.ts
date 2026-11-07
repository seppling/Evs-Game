export const TICKS_PER_SECOND = 60;
/** Subunits per world unit. Positions and velocities are integers in subunits. */
export const SUB = 100;
export const STAGE_WIDTH = 1920;
export const CAMERA_WIDTH = 1280;
export const CAMERA_HEIGHT = 720;
export const CAMERA_MARGIN = 64;
/** Max distance between fighters, in subunits. */
export const MAX_SEPARATION = (CAMERA_WIDTH - 2 * CAMERA_MARGIN) * SUB;
export const START_SEPARATION = 300;
export const BASE_HEIGHT = 300;
export const SIZE_SCALE = { small: 0.8, medium: 1, tall: 1.05, big: 1.15 } as const;
export const PREJUMP_TICKS = 3;
export const BUTTON_BUFFER_TICKS = 4;
export const PROXIMITY_GUARD_RANGE = 250;
export const PUSHBACK_TICKS = 8;
/** fallSpeed in subunits per tick. */
export const KNOCKDOWN = { fallTicks: 24, fallHeight: 50, fallSpeed: 250, lieTicks: 40, getupTicks: 20 } as const;
export const AIR_RESET = { ticks: 30, bump: 40, speed: 200 } as const;
export const ROUND_INTRO_TICKS = 120;
export const KO_SLOWMO_TICKS = 90;
export const KO_SLOWMO_FACTOR = 3;
export const ROUND_END_TICKS = 150;

// ---- M2: combat systems
export const CANCEL_WINDOW_TICKS = 3;
export const METER_MAX = 1000;
export const SUPER_FREEZE_TICKS = 30;
export const CHIP_PERCENT = 25;
export const EASY_DAMAGE_PERCENT = 85;
export const METER_GAIN = { specialHit: 100, specialBlock: 50, specialWhiff: 30, damageTakenPercent: 50 } as const;
export const THROW = {
  range: 70, startup: 3, whiffRecovery: 20, escapeWindow: 7, hitTick: 20, duration: 30, damage: 120, breakPush: 40, behind: 80,
} as const;
export const THROW_PROTECT_TICKS = 6;
export const STUN = { drainDelay: 60, drainPerTick: 4, dizzyTicks: 120, mashTicks: 3 } as const;
