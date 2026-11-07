import { createMatch } from '../engine/match';
import { step } from '../engine/step';
import type { Defs, MatchState, PlayerIndex } from '../engine/types';
import { getFighter } from '../fighters/index';
import { DeviceManager, type GamepadLike } from '../input/devices';
import { Renderer } from '../render/renderer';
import { advanceClock } from './clock';
import type { Setup } from './setup';

export type AppMode = 'title' | 'match' | 'paused';

/** The browser shell: polls devices, runs the fixed-timestep simulation, and draws. */
export class App {
  mode: AppMode = 'title';
  state: MatchState | null = null;
  private readonly defs: Defs;
  private readonly devices: DeviceManager;
  private readonly renderer: Renderer;
  private acc = 0;
  private lastNow: number | null = null;
  private debug = false;
  private pauseLines: string[] = [];
  private tickTimes: number[] = [];

  constructor(canvas: HTMLCanvasElement, private readonly win: Window, private readonly setup: Setup) {
    this.defs = [getFighter(setup.p1)!, getFighter(setup.p2)!];
    this.devices = new DeviceManager(win, () => this.readPads());
    this.renderer = new Renderer(canvas);
    const resize = () => this.renderer.resize(win.innerWidth, win.innerHeight, win.devicePixelRatio || 1);
    resize();
    win.addEventListener('resize', resize);
    canvas.addEventListener('click', () => { if (this.mode === 'title') this.start(); });
    win.addEventListener('keydown', (e) => this.onKey(e));
    win.document.addEventListener('visibilitychange', () => {
      if (win.document.visibilityState === 'hidden' && this.mode === 'match') this.pause(['Paused', 'Press Start to resume']);
    });
  }

  private readPads(): readonly (GamepadLike | null)[] {
    try {
      return this.win.navigator.getGamepads?.() ?? [];
    } catch {
      return [];
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    if (e.code === 'F1') this.debug = !this.debug;
    // Fullscreen only outside live fighting, so a stray F press can't interrupt a round.
    const fighting = this.mode === 'match' && this.state !== null && this.state.phase !== 'matchEnd';
    if (e.code === 'KeyF' && !fighting) {
      const doc = this.win.document;
      if (doc.fullscreenElement) void doc.exitFullscreen?.();
      else void doc.documentElement.requestFullscreen?.().catch(() => {});
    }
  }

  start(): void {
    this.state = createMatch(this.defs, this.setup.config);
    this.mode = 'match';
    this.acc = 0;
  }

  private pause(lines: string[]): void {
    this.mode = 'paused';
    this.pauseLines = lines;
  }

  private joinedLabels(): [string, string] {
    const slots = this.devices.padSlots;
    const label = (i: PlayerIndex) => (slots[i] !== null ? `Gamepad ${slots[i]! + 1}` : 'Keyboard');
    return [label(0), label(1)];
  }

  private tickRate(now: number): number {
    this.tickTimes = this.tickTimes.filter((t) => now - t < 1000);
    return this.tickTimes.length;
  }

  frame(now: number): void {
    const elapsed = this.lastNow === null ? 0 : now - this.lastNow;
    this.lastNow = now;
    const poll = this.devices.poll();

    if (this.mode === 'title') {
      if (poll.startPressed) this.start();
      else return this.renderer.drawTitle(this.joinedLabels());
    }

    if (this.mode === 'match' && poll.disconnected.length > 0) {
      this.pause(poll.disconnected.map((p) => `Player ${p + 1} controller disconnected. Reconnect and press Start.`));
    }

    if (this.mode === 'paused') {
      const visible = this.win.document.visibilityState !== 'hidden';
      if (poll.startPressed && poll.disconnected.length === 0 && visible) {
        this.mode = 'match';
        this.acc = 0;
      } else {
        if (this.state) this.renderer.drawMatch(this.state, this.defs, { debug: this.debug, tickRate: 0 });
        this.renderer.drawOverlay(this.pauseLines);
        return;
      }
    }

    if (!this.state) return;
    if (this.state.phase === 'matchEnd' && poll.startPressed) this.start();
    const { ticks, accMs } = advanceClock(this.acc, elapsed);
    this.acc = accMs;
    for (let i = 0; i < ticks; i++) {
      const r = step(this.state!, poll.inputs, this.defs);
      this.state = r.state;
      this.renderer.addEvents(r.events);
      this.renderer.tickEffects();
      this.tickTimes.push(now);
    }
    this.renderer.drawMatch(this.state!, this.defs, { debug: this.debug, tickRate: this.tickRate(now) });
    if (this.state!.phase === 'matchEnd' && this.state!.phaseTick > 60) this.renderer.drawOverlay(['Press Start for a rematch']);
  }
}
