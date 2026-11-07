import { SUB } from '../engine/constants';
import type { GameEvent, Strength } from '../engine/types';
import { FLOOR_Y } from './viewport';

const SPARK_SIZE: Record<Strength, number> = { light: 20, medium: 30, heavy: 45 };
const LIFETIME = 10;

interface Effect { kind: 'spark' | 'block' | 'clash'; x: number; y: number; size: number; age: number }
const CALLOUT_TICKS = 45;

/** Short-lived hit sparks and block flashes, created from engine events. World units. */
export class Effects {
  private items: Effect[] = [];
  private callouts: { text: string; age: number }[] = [];

  add(events: GameEvent[]): void {
    for (const e of events) {
      if (e.type === 'hit') this.items.push({ kind: 'spark', x: e.x / SUB, y: e.y / SUB, size: SPARK_SIZE[e.strength], age: 0 });
      else if (e.type === 'block') this.items.push({ kind: 'block', x: e.x / SUB, y: e.y / SUB, size: SPARK_SIZE[e.strength], age: 0 });
      else if (e.type === 'clash') this.items.push({ kind: 'clash', x: e.x / SUB, y: e.y / SUB, size: 40, age: 0 });
      else if (e.type === 'throwEscape' && !this.callouts.some((c) => c.text === 'ESCAPE!' && c.age === 0)) this.callouts.push({ text: 'ESCAPE!', age: 0 });
      else if (e.type === 'dizzy') this.callouts.push({ text: 'DIZZY!', age: 0 });
    }
  }

  tick(): void {
    for (const it of this.items) it.age++;
    this.items = this.items.filter((it) => it.age < LIFETIME);
    for (const c of this.callouts) c.age++;
    this.callouts = this.callouts.filter((c) => c.age < CALLOUT_TICKS);
  }

  clear(): void {
    this.items = [];
    this.callouts = [];
  }

  draw(ctx: CanvasRenderingContext2D, camX: number): void {
    ctx.save();
    for (const it of this.items) {
      const sx = it.x - camX, sy = FLOOR_Y - it.y;
      const t = it.age / LIFETIME;
      const r = it.size * (0.6 + t);
      ctx.globalAlpha = 1 - t;
      if (it.kind === 'spark' || it.kind === 'clash') {
        ctx.strokeStyle = it.kind === 'clash' ? '#ffffff' : '#fff59d';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const inner = k % 2 === 0 ? r * 0.2 : r * 0.4;
          ctx.moveTo(sx + Math.cos(a) * inner, sy + Math.sin(a) * inner);
          ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#64b5f6';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(sx, sy, r, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    this.callouts.forEach((c, i) => {
      ctx.globalAlpha = 1 - c.age / CALLOUT_TICKS;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = c.text === 'DIZZY!' ? '#ffeb3b' : '#80deea';
      ctx.strokeText(c.text, 640, 380 + i * 70);
      ctx.fillText(c.text, 640, 380 + i * 70);
    });
    ctx.restore();
  }
}
