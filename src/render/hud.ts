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

const BAR = { w: 500, h: 28, y: 40, p1x: 60, p2x: 720 };

function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.lineWidth = Math.max(3, size / 12);
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#fff';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

export function drawHud(ctx: CanvasRenderingContext2D, s: MatchState, defs: Defs, trails: readonly [number, number]): void {
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
    ctx.textAlign = i === 0 ? 'left' : 'right';
    outlinedText(ctx, defs[i].name.toUpperCase(), i === 0 ? x0 : x0 + BAR.w, 90, 22);
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
