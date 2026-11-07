import { METER_MAX } from '../engine/constants';
import type { Defs, MatchState } from '../engine/types';

export function announcerText(s: MatchState, names: readonly [string, string]): string | null {
  const wins = (r: MatchState['roundResult']) => (r === null || r === 'draw' ? 'DRAW' : `${names[r].toUpperCase()} WINS`);
  switch (s.phase) {
    case 'intro': return s.phaseTick < 60 ? `ROUND ${s.round}` : 'FIGHT!';
    case 'fight': return null;
    case 'ko': return 'K.O.';
    case 'roundEnd':
      if (s.phaseTick < 60) return s.roundEndReason === 'time' ? 'TIME' : s.perfect ? 'PERFECT' : null;
      return wins(s.roundResult);
    case 'matchEnd': return wins(s.matchWinner);
  }
}

/** The red "recent damage" part of a health bar: holds for 30 updates after damage, then drains 8 per update. */
export class HealthTrail {
  private trail: number;
  private last: number;
  private hold = 0;
  constructor(health: number) { this.trail = health; this.last = health; }
  get value(): number { return this.trail; }
  update(health: number): number {
    if (health > this.trail) {
      this.trail = health;
      this.hold = 0;
    } else {
      if (health < this.last) this.hold = 0;
      this.hold++;
      if (this.hold > 30) this.trail = Math.max(health, this.trail - 8);
    }
    this.last = health;
    return this.trail;
  }
}

/** Combo counter wording: null below 2 hits. */
export function comboText(hits: number): { label: string; shout: string | null } | null {
  if (hits < 2) return null;
  const shout = hits >= 10 ? 'INCREDIBLE!' : hits >= 7 ? 'AWESOME!' : hits >= 5 ? 'GREAT!' : hits >= 3 ? 'NICE!' : null;
  return { label: `${hits} HITS`, shout };
}

const COMBO_LINGER = 60;

/** Keeps showing the last combo of 2+ hits for a while after it ends. */
export class ComboDisplay {
  private current: { hits: number; damage: number } | null = null;
  private age = 0;
  get shown(): { hits: number; damage: number } | null { return this.current; }
  update(hits: number, damage: number): void {
    if (hits >= 2) {
      this.current = { hits, damage };
      this.age = 0;
    } else if (this.current) {
      this.age++;
      if (this.age > COMBO_LINGER) this.current = null;
    }
  }
}

const BAR = { w: 500, h: 28, y: 40, p1x: 60, p2x: 720 };
const METER_BAR = { w: 300, h: 14, y: 690, p1x: 60, p2xEnd: 1220 };

function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.lineWidth = Math.max(3, size / 12);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#fff';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

type Shown = { hits: number; damage: number } | null;

export function drawHud(ctx: CanvasRenderingContext2D, s: MatchState, defs: Defs, trails: readonly [number, number],
  combos: readonly [Shown, Shown] = [null, null]): void {
  ctx.save();
  ctx.textBaseline = 'middle';
  for (const i of [0, 1] as const) {
    const max = defs[i].health;
    const pct = Math.max(0, s.fighters[i].health) / max;
    const trailPct = Math.max(0, trails[i]) / max;
    const x0 = i === 0 ? BAR.p1x : BAR.p2x;
    ctx.fillStyle = '#222';
    ctx.fillRect(x0 - 3, BAR.y - 3, BAR.w + 6, BAR.h + 6);
    // P1's bar empties toward the left edge, P2's toward the right edge.
    const seg = (frac: number, color: string) => {
      ctx.fillStyle = color;
      const w = BAR.w * frac;
      ctx.fillRect(i === 0 ? x0 : x0 + BAR.w - w, BAR.y, w, BAR.h);
    };
    seg(trailPct, '#d32f2f');
    seg(pct, '#ffd54f');
    // Stun bar under the health bar.
    const f = s.fighters[i];
    const stunW = BAR.w * Math.min(1, f.stun / defs[i].stunLimit);
    ctx.fillStyle = '#ff9800';
    ctx.fillRect(i === 0 ? x0 : x0 + BAR.w - stunW, 72, stunW, 6);
    ctx.textAlign = i === 0 ? 'left' : 'right';
    const name = defs[i].name.toUpperCase();
    outlinedText(ctx, name, i === 0 ? x0 : x0 + BAR.w, 90, 22);
    if (s.config.easy[i]) {
      ctx.font = 'bold 16px system-ui, sans-serif';
      const nameW = (ctx.measureText(name).width * 22) / 16 + 10;
      ctx.fillStyle = '#80deea';
      ctx.fillText('EASY', i === 0 ? x0 + nameW : x0 + BAR.w - nameW, 92);
    }
    // Super meter along the bottom; flashes when full.
    const mx = i === 0 ? METER_BAR.p1x : METER_BAR.p2xEnd - METER_BAR.w;
    const full = f.meter >= METER_MAX;
    ctx.fillStyle = '#222';
    ctx.fillRect(mx - 2, METER_BAR.y - 2, METER_BAR.w + 4, METER_BAR.h + 4);
    ctx.fillStyle = full && Math.floor(s.tick / 8) % 2 === 0 ? '#ffffff' : '#4fc3f7';
    const mw = (METER_BAR.w * Math.min(f.meter, METER_MAX)) / METER_MAX;
    ctx.fillRect(i === 0 ? mx : mx + METER_BAR.w - mw, METER_BAR.y, mw, METER_BAR.h);
    // Combo counter on the attacker's side.
    const combo = combos[i];
    const text = combo ? comboText(combo.hits) : null;
    if (combo && text) {
      ctx.textAlign = 'center';
      const cx = i === 0 ? 160 : 1120;
      outlinedText(ctx, text.label, cx, 220, 44);
      outlinedText(ctx, `${combo.damage} DMG`, cx, 262, 24);
      if (text.shout) outlinedText(ctx, text.shout, cx, 300, 34);
    }
    for (let r = 0; r < s.config.roundsToWin; r++) {
      const cx = i === 0 ? x0 + 10 + r * 26 : x0 + BAR.w - 10 - r * 26;
      ctx.beginPath();
      ctx.arc(cx, 116, 9, 0, Math.PI * 2);
      ctx.fillStyle = r < s.fighters[i].roundsWon ? '#ffd54f' : '#333';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.textAlign = 'center';
  outlinedText(ctx, s.timer === null ? '∞' : String(s.timer), 640, 56, 52);
  const text = announcerText(s, [defs[0].name, defs[1].name]);
  if (text) outlinedText(ctx, text, 640, 300, 96);
  ctx.restore();
}
