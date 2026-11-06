import { buildFighter } from './defaults';

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
});
