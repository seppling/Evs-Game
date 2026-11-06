import { SIZE_SCALE } from '../engine/constants';
import type { Box, FighterDef, HitLevel, MoveDef, MoveFrame, MoveId, Stance, Strength } from '../engine/types';
import { BUTTONS, type Button } from '../input/types';

/** Everything a fighter file provides; boxes and normals come from the shared template. */
export type FighterBase = Omit<FighterDef, 'pushbox' | 'airPushbox' | 'standingHurtboxes' | 'crouchingHurtboxes' | 'airHurtboxes' | 'moves'>;

const PREFIX: Record<Stance, string> = { stand: 'stand', crouch: 'crouch', air: 'jump' };

export function normalMoveId(stance: Stance, button: Button): MoveId {
  return `${PREFIX[stance]}-${button.toLowerCase()}`;
}

// ---- Template boxes for a medium (300-unit) fighter. By convention, stance lists are [body, head].
const PUSHBOX: Box = { x: -30, y: 0, w: 60, h: 260 };
const AIR_PUSHBOX: Box = { x: -20, y: 150, w: 40, h: 110 };
const STANDING: Box[] = [{ x: -35, y: 0, w: 70, h: 240 }, { x: -25, y: 240, w: 50, h: 60 }];
const CROUCHING: Box[] = [{ x: -40, y: 0, w: 80, h: 150 }, { x: -25, y: 150, w: 50, h: 45 }];
const AIR: Box[] = [{ x: -35, y: 30, w: 70, h: 170 }, { x: -25, y: 200, w: 50, h: 50 }];

// ---- Frame data by strength.
interface StrengthData {
  ground: [number, number, number]; jump: [number, number, number];
  damage: number; stun: number; groundStun: [number, number]; jumpStun: [number, number];
  hitstop: number; pushback: [number, number]; meterGain: number;
}
const STRENGTH: Record<Strength, StrengthData> = {
  light: { ground: [4, 2, 6], jump: [4, 8, 6], damage: 30, stun: 30, groundStun: [12, 9], jumpStun: [14, 10], hitstop: 8, pushback: [25, 20], meterGain: 40 },
  medium: { ground: [6, 3, 12], jump: [6, 6, 10], damage: 60, stun: 60, groundStun: [18, 14], jumpStun: [18, 14], hitstop: 10, pushback: [35, 30], meterGain: 60 },
  heavy: { ground: [9, 4, 20], jump: [8, 6, 14], damage: 100, stun: 100, groundStun: [25, 20], jumpStun: [22, 18], hitstop: 12, pushback: [50, 40], meterGain: 80 },
};
const BUTTON_STRENGTH: Record<Button, Strength> = { LP: 'light', MP: 'medium', HP: 'heavy', LK: 'light', MK: 'medium', HK: 'heavy' };

interface NormalSpec { hitbox: Box; level: HitLevel; knockdown: boolean; sprite: string }
const b = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const NORMALS: Record<Stance, Record<Button, NormalSpec>> = {
  stand: {
    LP: { hitbox: b(30, 220, 70, 30), level: 'mid', knockdown: false, sprite: 'stand-light-punch' },
    MP: { hitbox: b(30, 180, 85, 35), level: 'mid', knockdown: false, sprite: 'stand-medium-punch' },
    HP: { hitbox: b(30, 190, 95, 45), level: 'mid', knockdown: false, sprite: 'stand-heavy-punch' },
    LK: { hitbox: b(20, 60, 75, 30), level: 'mid', knockdown: false, sprite: 'stand-light-kick' },
    MK: { hitbox: b(25, 120, 95, 35), level: 'mid', knockdown: false, sprite: 'stand-medium-kick' },
    HK: { hitbox: b(25, 210, 105, 45), level: 'mid', knockdown: false, sprite: 'stand-heavy-kick' },
  },
  crouch: {
    LP: { hitbox: b(30, 120, 70, 30), level: 'mid', knockdown: false, sprite: 'crouch-light-punch' },
    MP: { hitbox: b(30, 110, 85, 35), level: 'mid', knockdown: false, sprite: 'crouch-medium-punch' },
    HP: { hitbox: b(10, 150, 60, 140), level: 'mid', knockdown: false, sprite: 'crouch-heavy-punch' },
    LK: { hitbox: b(25, 0, 85, 30), level: 'low', knockdown: false, sprite: 'crouch-light-kick' },
    MK: { hitbox: b(25, 0, 110, 30), level: 'low', knockdown: false, sprite: 'crouch-medium-kick' },
    HK: { hitbox: b(25, 0, 120, 35), level: 'low', knockdown: true, sprite: 'crouch-heavy-kick' },
  },
  air: {
    LP: { hitbox: b(20, 60, 70, 50), level: 'overhead', knockdown: false, sprite: 'jump-punch' },
    MP: { hitbox: b(20, 60, 70, 50), level: 'overhead', knockdown: false, sprite: 'jump-punch' },
    HP: { hitbox: b(10, 40, 80, 70), level: 'overhead', knockdown: false, sprite: 'jump-heavy-punch' },
    LK: { hitbox: b(15, 0, 85, 50), level: 'overhead', knockdown: false, sprite: 'jump-kick' },
    MK: { hitbox: b(15, 0, 85, 50), level: 'overhead', knockdown: false, sprite: 'jump-kick' },
    HK: { hitbox: b(10, -10, 100, 60), level: 'overhead', knockdown: false, sprite: 'jump-heavy-kick' },
  },
};

function scaleBox(box: Box, s: number): Box {
  return { x: Math.round(box.x * s), y: Math.round(box.y * s), w: Math.round(box.w * s), h: Math.round(box.h * s) };
}

function stanceBoxes(stance: Stance, s: number): Box[] {
  return (stance === 'stand' ? STANDING : stance === 'crouch' ? CROUCHING : AIR).map((bx) => scaleBox(bx, s));
}

function buildNormal(stance: Stance, button: Button, s: number): MoveDef {
  const strength = BUTTON_STRENGTH[button];
  const sd = STRENGTH[strength];
  const spec = NORMALS[stance][button];
  const isAir = stance === 'air';
  const [startup, active, recovery] = isAir ? sd.jump : sd.ground;
  const [hitstun, blockstun] = isAir ? sd.jumpStun : sd.groundStun;
  const hitbox = scaleBox(spec.hitbox, s);
  const body = stanceBoxes(stance, s);
  const limb: Box = { x: hitbox.x, y: hitbox.y, w: hitbox.w - 15, h: hitbox.h };
  const recoverySprite = !isAir && strength === 'heavy' ? '_03' : '_01';
  const frames: MoveFrame[] = [
    { sprite: `${spec.sprite}_01`, ticks: startup, hurtboxes: body },
    { sprite: `${spec.sprite}_02`, ticks: active, hurtboxes: [...body, limb], hitbox },
    { sprite: `${spec.sprite}${recoverySprite}`, ticks: recovery, hurtboxes: [...body, limb] },
  ];
  return {
    input: { button, stance },
    frames,
    hit: {
      damage: sd.damage, chip: 0, stun: sd.stun, hitstun, blockstun, hitstop: sd.hitstop,
      pushback: isAir ? sd.pushback[1] : sd.pushback[0], level: spec.level, knockdown: spec.knockdown,
      meterGain: sd.meterGain, strength,
    },
    cancels: [],
  };
}

export function buildFighter(base: FighterBase, overrides: Record<MoveId, MoveDef> = {}): FighterDef {
  const s = SIZE_SCALE[base.size];
  const moves: Record<MoveId, MoveDef> = {};
  for (const stance of ['stand', 'crouch', 'air'] as const) {
    for (const button of BUTTONS) moves[normalMoveId(stance, button)] = buildNormal(stance, button, s);
  }
  return {
    ...base,
    pushbox: scaleBox(PUSHBOX, s),
    airPushbox: scaleBox(AIR_PUSHBOX, s),
    standingHurtboxes: stanceBoxes('stand', s),
    crouchingHurtboxes: stanceBoxes('crouch', s),
    airHurtboxes: stanceBoxes('air', s),
    moves: { ...moves, ...overrides },
  };
}
