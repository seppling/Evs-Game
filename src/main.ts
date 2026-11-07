import { App } from './app/app';
import { parseSetup } from './app/setup';
import type { MatchState } from './engine/types';

declare global {
  interface Window { __evs?: { mode: () => string; state: () => MatchState | null } }
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const app = new App(canvas, window, parseSetup(window.location.search));
window.__evs = { mode: () => app.mode, state: () => app.state };

const loop = (now: number) => {
  app.frame(now);
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
