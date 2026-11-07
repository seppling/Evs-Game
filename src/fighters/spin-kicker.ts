import type { Box } from '../engine/types';
import { buildFighter, type SpecialFrameSpec, type SpecialSpec } from './defaults';
import { pick } from './pick';

const TORNADO_BOX: Box = { x: -40, y: 20, w: 140, h: 220 };

const specials: SpecialSpec[] = [
  {
    id: 'tornado-kick', name: 'Tornado Kick', kind: 'special', motion: 'qcf', group: 'K',
    build: (st) => {
      const n = pick(st, 3, 4, 5);
      const spins: SpecialFrameSpec[] = Array.from({ length: n }, (_, i) => ({
        sprite: i % 2 === 0 ? 'tornado-kick_02' : 'tornado-kick_03', ticks: 5, body: 'stand',
        hitbox: { x: 10, y: 120, w: 95, h: 70 }, hitGroup: i, velocity: { x: 450, y: 0 },
        ...(i === n - 1 ? { hit: { knockdown: true } } : {}),
      }));
      return {
        frames: [{ sprite: 'tornado-kick_01', ticks: 8, body: 'stand' }, ...spins, { sprite: 'tornado-kick_01', ticks: 16, body: 'stand' }],
        hit: { damage: 35, stun: 30, hitstun: 22, blockstun: 14, hitstop: 6, pushback: 15, level: 'mid', knockdown: false },
      };
    },
  },
  {
    id: 'cartwheel', name: 'Cartwheel', kind: 'special', motion: 'qcb', group: 'K',
    build: (st) => ({
      frames: [
        { sprite: 'cartwheel_01', ticks: 4, body: 'crouch' },
        { sprite: 'cartwheel_01', ticks: pick(st, 14, 18, 22), body: 'stand', velocity: { x: 900, y: 0 }, flags: ['projectileInvuln'] },
        { sprite: 'cartwheel_02', ticks: 6, body: 'stand', hitbox: { x: 20, y: 40, w: 70, h: 70 } },
        { sprite: 'cartwheel_02', ticks: 12, body: 'stand' },
      ],
      hit: { damage: 50, stun: 50, hitstun: 18, blockstun: 12, hitstop: 10, pushback: 30, level: 'mid', knockdown: false },
    }),
  },
  {
    id: 'handspring-heel', name: 'Handspring Heel', kind: 'special', motion: 'dp', group: 'K',
    build: (st) => ({
      frames: [
        { sprite: 'handspring-heel_01', ticks: pick(st, 16, 18, 20), body: 'crouch' },
        { sprite: 'handspring-heel_02', ticks: 8, body: 'air', leap: { height: 70, duration: 20, forward: 300 } },
        { sprite: 'handspring-heel_03', ticks: 8, body: 'air', hitbox: { x: 20, y: 60, w: 85, h: 100 } },
        { sprite: 'handspring-heel_03', ticks: 30, body: 'air' },
      ],
      landing: 10,
      hit: { damage: pick(st, 90, 100, 110), stun: 90, hitstun: 20, blockstun: 14, hitstop: 12, pushback: 35, level: 'overhead', knockdown: false },
    }),
  },
  {
    id: 'human-tornado', name: 'Human Tornado', kind: 'super', motion: 'qcf2', group: 'K',
    build: () => {
      const spins: SpecialFrameSpec[] = Array.from({ length: 8 }, (_, i) => ({
        sprite: i % 2 === 0 ? 'super_02' : 'super_03', ticks: 4, body: 'stand', hitbox: TORNADO_BOX, hitGroup: i,
        velocity: { x: 300, y: 0 }, ...(i < 2 ? { flags: ['strikeInvuln' as const] } : {}),
      }));
      return {
        frames: [
          { sprite: 'super_01', ticks: 1, body: 'stand', flags: ['strikeInvuln'] },
          ...spins,
          { sprite: 'super_04', ticks: 6, body: 'stand', hitbox: TORNADO_BOX, hitGroup: 8, hit: { damage: 60, knockdown: true, hitstop: 14, pushback: 80 } },
          { sprite: 'super_04', ticks: 28, body: 'stand' },
        ],
        hit: { damage: 30, stun: 0, hitstun: 24, blockstun: 18, hitstop: 6, pushback: 10, level: 'mid', knockdown: false },
      };
    },
  },
];

export const spinKicker = buildFighter({
  id: 'spin-kicker',
  name: 'Spin Kicker',
  size: 'medium',
  health: 950,
  stunLimit: 500,
  walkForward: 450,
  walkBack: 350,
  jump: { height: 230, duration: 40, forwardSpeed: 480 },
  colors: { primary: '#7e3fbf', secondary: '#c0c0c8' },
}, ['tornado-kick', 'cartwheel', 'handspring-heel'], specials);
