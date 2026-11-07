import { SUB } from '../engine/constants';
import type { GameEvent, Strength } from '../engine/types';
import { FLOOR_Y } from './viewport';

const SPARK_SIZE: Record<Strength, number> = { light: 20, medium: 30, heavy: 45 };
const LIFETIME = 10;

interface Effect { kind: 'spark' | 'block'; x: number; y: number; size: number; age: number }

/** Short-lived hit sparks and block flashes, created from engine events. World units. */
export class Effects {
  private items: Effect[] = [];

  add(events: GameEvent[]): void {
    for (const e of events) {
      if (e.type === 'hit') this.items.push({ kind: 'spark', x: e.x / SUB, y: e.y / SUB, size: SPARK_SIZE[e.strength], age: 0 });
      else if (e.type === 'block') this.items.push({ kind: 'block', x: e.x / SUB, y: e.y / SUB, size: SPARK_SIZE[e.strength], age: 0 });
    }
  }

  tick(): void {
    for (const it of this.items) it.age++;
    this.items = this.items.filter((it) => it.age < LIFETIME);
  }

  clear(): void { this.items = []; }

  draw(ctx: CanvasRenderingContext2D, camX: number): void {
    ctx.save();
    for (const it of this.items) {
      const sx = it.x - camX, sy = FLOOR_Y - it.y;
      const t = it.age / LIFETIME;
      const r = it.size * (0.6 + t);
      ctx.globalAlpha = 1 - t;
      if (it.kind === 'spark') {
        ctx.strokeStyle = '#fff59d';
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
    ctx.restore();
  }
}
