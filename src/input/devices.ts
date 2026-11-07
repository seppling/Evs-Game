import type { PlayerIndex } from '../engine/types';
import { BUTTONS, btn, type Button, type RawInput } from './types';

/** The parts of the browser Gamepad this game reads (structurally compatible with Gamepad). */
export interface GamepadLike {
  index: number; connected: boolean; mapping: string;
  buttons: readonly { pressed: boolean; value: number }[]; axes: readonly number[];
}

export interface KeyLayout { up: string; down: string; left: string; right: string; start: string; buttons: Record<Button, string> }

export const P1_KEYS: KeyLayout = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', start: 'Enter',
  buttons: { LP: 'KeyU', MP: 'KeyI', HP: 'KeyO', LK: 'KeyJ', MK: 'KeyK', HK: 'KeyL' },
};
export const P2_KEYS: KeyLayout = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', start: 'NumpadEnter',
  buttons: { LP: 'Numpad4', MP: 'Numpad5', HP: 'Numpad6', LK: 'Numpad1', MK: 'Numpad2', HK: 'Numpad3' },
};

/** Standard Gamepad mapping indices. */
export const PAD_BUTTONS: Record<Button | 'start', number> = { LP: 2, MP: 3, HP: 5, LK: 0, MK: 1, HK: 7, start: 9 };
const DPAD = { up: 12, down: 13, left: 14, right: 15 } as const;
const STICK_DEAD_ZONE = 0.5;

const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

function padDown(pad: GamepadLike, index: number): boolean {
  const b = pad.buttons[index];
  return !!b && (b.pressed || b.value > 0.5);
}

export function readGamepad(pad: GamepadLike): RawInput {
  let buttons = 0;
  for (const b of BUTTONS) if (padDown(pad, PAD_BUTTONS[b])) buttons |= btn(b);
  const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
  const stickX = ax > STICK_DEAD_ZONE ? 1 : ax < -STICK_DEAD_ZONE ? -1 : 0;
  const stickY = ay < -STICK_DEAD_ZONE ? 1 : ay > STICK_DEAD_ZONE ? -1 : 0;
  const dpadX = (padDown(pad, DPAD.right) ? 1 : 0) - (padDown(pad, DPAD.left) ? 1 : 0);
  const dpadY = (padDown(pad, DPAD.up) ? 1 : 0) - (padDown(pad, DPAD.down) ? 1 : 0);
  return { x: sign(dpadX + stickX), y: sign(dpadY + stickY), buttons, start: padDown(pad, PAD_BUTTONS.start) };
}

/** Opposite directions held together cancel to neutral. */
export function readKeyboard(down: ReadonlySet<string>, layout: KeyLayout): RawInput {
  let buttons = 0;
  for (const b of BUTTONS) if (down.has(layout.buttons[b])) buttons |= btn(b);
  const x = sign((down.has(layout.right) ? 1 : 0) - (down.has(layout.left) ? 1 : 0));
  const y = sign((down.has(layout.up) ? 1 : 0) - (down.has(layout.down) ? 1 : 0));
  return { x, y, buttons, start: down.has(layout.start) };
}

export function mergeInputs(a: RawInput, b: RawInput): RawInput {
  return { x: sign(a.x + b.x), y: sign(a.y + b.y), buttons: a.buttons | b.buttons, start: a.start || b.start };
}

function layoutCodes(l: KeyLayout): string[] {
  return [l.up, l.down, l.left, l.right, l.start, ...Object.values(l.buttons)];
}
const GAME_KEYS: ReadonlySet<string> = new Set([...layoutCodes(P1_KEYS), ...layoutCodes(P2_KEYS), 'F1']);

/** Tracks held keys by `event.code`. Releases everything on blur so no key stays stuck. */
export class Keyboard {
  private readonly held = new Set<string>();
  /** Keys pressed since the last takeFrame(), so a tap shorter than one frame is not lost. */
  private readonly tapped = new Set<string>();
  get down(): ReadonlySet<string> { return this.held; }

  /** Keys held now plus keys tapped since the previous call (which are then forgotten). */
  takeFrame(): ReadonlySet<string> {
    const frame = new Set([...this.held, ...this.tapped]);
    this.tapped.clear();
    return frame;
  }

  constructor(private readonly target: EventTarget) {
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.onBlur);
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.onBlur);
  }

  private readonly onDown = (e: Event) => {
    const code = (e as KeyboardEvent).code;
    if (GAME_KEYS.has(code)) e.preventDefault();
    this.held.add(code);
    this.tapped.add(code);
  };
  private readonly onUp = (e: Event) => {
    const code = (e as KeyboardEvent).code;
    if (GAME_KEYS.has(code)) e.preventDefault();
    this.held.delete(code);
  };
  private readonly onBlur = () => {
    this.held.clear();
    this.tapped.clear();
  };
}

/** Assigns gamepads to player slots in the order they press Start, and tracks disconnects. */
export class PadAssigner {
  private readonly _slots: [number | null, number | null] = [null, null];
  private readonly lost: [boolean, boolean] = [false, false];
  get slots(): readonly [number | null, number | null] { return this._slots; }

  update(pads: readonly (GamepadLike | null)[]): void {
    for (const i of [0, 1] as const) {
      const idx = this._slots[i];
      if (idx === null) continue;
      const p = pads[idx];
      this.lost[i] = !(p && p.connected);
    }
    for (const p of pads) {
      if (!p || !p.connected || this._slots.includes(p.index) || !padDown(p, PAD_BUTTONS.start)) continue;
      // A player waiting on a lost controller gets the next pad first; otherwise fill the first free slot.
      const lostSlot = this.lost.findIndex((l, i) => l && this._slots[i] !== null);
      const slot = lostSlot >= 0 ? lostSlot : this._slots.indexOf(null);
      if (slot < 0) continue;
      this._slots[slot] = p.index;
      this.lost[slot] = false;
    }
  }

  disconnected(): PlayerIndex[] {
    return ([0, 1] as const).filter((i) => this._slots[i] !== null && this.lost[i]);
  }
}

/** Player i = keyboard layout i merged with the pad in slot i. */
export class DeviceManager {
  private readonly keyboard: Keyboard;
  private readonly assigner = new PadAssigner();
  private startWasDown = false;

  constructor(target: EventTarget, private readonly getPads: () => readonly (GamepadLike | null)[]) {
    this.keyboard = new Keyboard(target);
  }

  get padSlots(): readonly [number | null, number | null] { return this.assigner.slots; }

  poll(): { inputs: [RawInput, RawInput]; startPressed: boolean; disconnected: PlayerIndex[] } {
    const pads = this.getPads();
    this.assigner.update(pads);
    const keys = this.keyboard.takeFrame();
    const read = (i: PlayerIndex): RawInput => {
      let r = readKeyboard(keys, i === 0 ? P1_KEYS : P2_KEYS);
      const idx = this.assigner.slots[i];
      const p = idx !== null ? pads[idx] : null;
      if (p && p.connected) r = mergeInputs(r, readGamepad(p));
      return r;
    };
    const inputs: [RawInput, RawInput] = [read(0), read(1)];
    const startDown = inputs[0].start || inputs[1].start || pads.some((p) => !!p && p.connected && padDown(p, PAD_BUTTONS.start));
    const startPressed = startDown && !this.startWasDown;
    this.startWasDown = startDown;
    return { inputs, startPressed, disconnected: this.assigner.disconnected() };
  }
}
