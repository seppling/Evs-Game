import type { Box } from '../engine/types';
import { buildFighter, type SpecialFrameSpec, type SpecialSpec } from './defaults';
import { pick } from './pick';

const CHOP_BOX: Box = { x: 20, y: 120, w: 100, h: 120 };

const specials: SpecialSpec[] = [
  {
    id: 'karate-wave', name: 'Karate Wave', kind: 'special', motion: 'qcf', group: 'P',
    build: (st) => ({
      frames: [
        { sprite: 'karate-wave_01', ticks: 12, body: 'stand' },
        { sprite: 'karate-wave_02', ticks: 3, body: 'stand', spawnProjectile: true },
        { sprite: 'karate-wave_02', ticks: 28, body: 'stand' },
      ],
      hit: { damage: 90, stun: 80, hitstun: 20, blockstun: 16, hitstop: 10, pushback: 40, level: 'mid', knockdown: false },
      projectile: {
        speed: pick(st, 450, 600, 750), spawn: { x: 70, y: 160 }, hitbox: { x: -30, y: -30, w: 60, h: 60 },
        lifetime: 150, hits: 1, super: false, visual: 'karate-wave',
      },
    }),
  },
  {
    id: 'mohawk-ram', name: 'Mohawk Ram', kind: 'special', motion: 'qcb', group: 'P',
    build: (st) => ({
      frames: [
        { sprite: 'mohawk-ram_01', ticks: pick(st, 10, 12, 14), body: 'crouch' },
        { sprite: 'mohawk-ram_02', ticks: 14, body: 'stand', hitbox: { x: 20, y: 150, w: 75, h: 70 }, velocity: { x: pick(st, 900, 1100, 1300), y: 0 } },
        { sprite: 'mohawk-ram_03', ticks: 18, body: 'stand' },
      ],
      hit: { damage: pick(st, 100, 110, 120), stun: 100, hitstun: 22, blockstun: 16, hitstop: 12, pushback: 50, level: 'mid', knockdown: st === 'heavy' },
    }),
  },
  {
    id: 'rising-chop', name: 'Rising Chop', kind: 'special', motion: 'dp', group: 'P',
    build: (st) => {
      const hitbox: Box = { x: 15, y: 150, w: 70, h: 160 };
      return {
        frames: [
          { sprite: 'rising-chop_01', ticks: pick(st, 3, 4, 5), body: 'crouch', flags: ['strikeInvuln'] },
          {
            sprite: 'rising-chop_02', ticks: 4, body: 'air', hitbox, flags: ['strikeInvuln'],
            leap: { height: pick(st, 160, 190, 220), duration: pick(st, 34, 38, 42), forward: 150 },
          },
          { sprite: 'rising-chop_02', ticks: 6, body: 'air', hitbox },
          { sprite: 'rising-chop_03', ticks: 40, body: 'air' },
        ],
        landing: 14,
        hit: { damage: pick(st, 110, 120, 140), stun: 100, hitstun: 20, blockstun: 18, hitstop: 12, pushback: 40, level: 'mid', knockdown: true },
      };
    },
  },
  {
    id: 'thousand-chops', name: 'Thousand Chops', kind: 'super', motion: 'qcf2', group: 'P',
    build: () => {
      const flurry: SpecialFrameSpec[] = [0, 1, 2, 3, 4].map((i) => ({
        sprite: i % 2 === 0 ? 'super_02' : 'super_03', ticks: 4, body: 'stand', hitbox: CHOP_BOX, hitGroup: i,
        velocity: { x: 200, y: 0 }, ...(i < 2 ? { flags: ['strikeInvuln' as const] } : {}),
      }));
      return {
        frames: [
          { sprite: 'super_01', ticks: 1, body: 'stand', flags: ['strikeInvuln'] },
          ...flurry,
          { sprite: 'super_04', ticks: 6, body: 'stand', hitbox: CHOP_BOX, hitGroup: 5, hit: { damage: 100, knockdown: true, hitstop: 14, pushback: 80 } },
          { sprite: 'super_04', ticks: 30, body: 'stand' },
        ],
        hit: { damage: 40, stun: 0, hitstun: 24, blockstun: 18, hitstop: 6, pushback: 10, level: 'mid', knockdown: false },
      };
    },
  },
];

export const mohawkMan = buildFighter({
  id: 'mohawk-man',
  name: 'Mohawk Man',
  size: 'tall',
  health: 1000,
  stunLimit: 500,
  walkForward: 350,
  walkBack: 280,
  jump: { height: 220, duration: 44, forwardSpeed: 400 },
  colors: { primary: '#f5f5f0', secondary: '#e53935' },
}, ['karate-wave', 'mohawk-ram', 'rising-chop'], specials);
