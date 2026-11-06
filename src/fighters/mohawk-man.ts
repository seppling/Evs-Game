import { buildFighter } from './defaults';

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
});
