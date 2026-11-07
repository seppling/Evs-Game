import { CAMERA_HEIGHT, CAMERA_WIDTH, SUB } from '../engine/constants';
import { activeHitbox, hurtboxes } from '../engine/fighter';
import { worldBox } from '../engine/geometry';
import { cameraX } from '../engine/space';
import type { Box, Defs, FighterDef, FighterState, GameEvent, MatchState, ProjectileState } from '../engine/types';
import { Effects } from './effects';
import { ComboDisplay, drawHud, HealthTrail } from './hud';
import { placeholderShapes, type Shape } from './placeholder';
import { computeViewport, FLOOR_Y, type Viewport } from './viewport';

const FLOOR_LINE_SPACING = 120;

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private vp: Viewport = computeViewport(CAMERA_WIDTH, CAMERA_HEIGHT, 1);
  private readonly effects = new Effects();
  private trails: [HealthTrail, HealthTrail] | null = null;
  /** combos[i] = the combo player i is landing (read from the other fighter). */
  private combos: [ComboDisplay, ComboDisplay] = [new ComboDisplay(), new ComboDisplay()];
  private lastTick = -1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available in this browser');
    this.ctx = ctx;
  }

  resize(winW: number, winH: number, dpr: number): void {
    this.vp = computeViewport(winW, winH, dpr);
    this.canvas.style.width = `${this.vp.cssWidth}px`;
    this.canvas.style.height = `${this.vp.cssHeight}px`;
    this.canvas.width = this.vp.pixelWidth;
    this.canvas.height = this.vp.pixelHeight;
  }

  addEvents(events: GameEvent[]): void { this.effects.add(events); }
  tickEffects(): void { this.effects.tick(); }

  /** Draws in logical 1280×720 units. */
  private begin(): CanvasRenderingContext2D {
    const ctx = this.ctx;
    ctx.setTransform(this.vp.unitScale, 0, 0, this.vp.unitScale, 0, 0);
    return ctx;
  }

  drawMatch(s: MatchState, defs: Defs, opts: { debug: boolean; tickRate: number }): void {
    const ctx = this.begin();
    if (!this.trails || s.tick < this.lastTick) {
      this.trails = [new HealthTrail(s.fighters[0].health), new HealthTrail(s.fighters[1].health)];
      this.combos = [new ComboDisplay(), new ComboDisplay()];
      this.effects.clear();
      this.lastTick = s.tick;
    }
    const steps = Math.min(4, Math.max(0, s.tick - this.lastTick));
    for (let i = 0; i < steps; i++) {
      this.trails[0].update(s.fighters[0].health);
      this.trails[1].update(s.fighters[1].health);
      this.combos[0].update(s.fighters[1].comboHits, s.fighters[1].comboDamage);
      this.combos[1].update(s.fighters[0].comboHits, s.fighters[0].comboDamage);
    }
    this.lastTick = s.tick;

    const camX = cameraX(s.fighters);
    this.drawStage(ctx, camX);
    if (s.freeze) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);
    }
    for (const f of s.fighters) this.drawShadow(ctx, f, camX);
    // Draw the fighter who is attacking on top.
    const order = s.fighters[1].action === 'attack' ? [0, 1] : [1, 0];
    for (const i of order) this.drawFighter(ctx, s.fighters[i]!, defs[i]!, camX);
    for (const p of s.projectiles) this.drawProjectile(ctx, p, defs, camX);
    s.fighters.forEach((f, i) => { if (f.action === 'dizzy') this.drawDizzyStars(ctx, f, defs[i as 0 | 1], camX, s.tick); });
    this.effects.draw(ctx, camX);
    drawHud(ctx, s, defs, [this.trails[0].value, this.trails[1].value], [this.combos[0].shown, this.combos[1].shown]);
    if (s.freeze) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 56px system-ui, sans-serif';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#ffd54f';
      const text = `${defs[s.freeze.player].name.toUpperCase()}: ${s.freeze.name.toUpperCase()}`;
      ctx.strokeText(text, 640, 200);
      ctx.fillText(text, 640, 200);
      ctx.restore();
    }
    if (opts.debug) this.drawDebug(ctx, s, defs, camX, opts.tickRate);
  }

  private drawStage(ctx: CanvasRenderingContext2D, camX: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    sky.addColorStop(0, '#1b2a49');
    sky.addColorStop(1, '#4a6fa5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CAMERA_WIDTH, FLOOR_Y);
    ctx.fillStyle = '#3b3b4f';
    ctx.fillRect(0, FLOOR_Y, CAMERA_WIDTH, CAMERA_HEIGHT - FLOOR_Y);
    ctx.strokeStyle = '#4c4c66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(CAMERA_WIDTH, FLOOR_Y);
    for (let wx = Math.floor(camX / FLOOR_LINE_SPACING) * FLOOR_LINE_SPACING; wx <= camX + CAMERA_WIDTH; wx += FLOOR_LINE_SPACING) {
      const sx = wx - camX;
      ctx.moveTo(sx, FLOOR_Y);
      ctx.lineTo(sx + (sx - CAMERA_WIDTH / 2) * 0.25, CAMERA_HEIGHT);
    }
    ctx.stroke();
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, p: ProjectileState, defs: Defs, camX: number): void {
    const def = defs[p.owner].moves[p.moveId]?.projectile;
    if (!def) return;
    const x = p.x / SUB - camX, y = FLOOR_Y - p.y / SUB;
    const r = def.hitbox.w / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(p.facing, 1);
    if (def.visual === 'karate-wave') {
      ctx.beginPath();
      ctx.arc(-r * 0.4, 0, r, -Math.PI / 2.2, Math.PI / 2.2);
      ctx.arc(-r * 0.9, 0, r * 0.85, Math.PI / 2.2, -Math.PI / 2.2, true);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#e53935';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  }

  private drawDizzyStars(ctx: CanvasRenderingContext2D, f: FighterState, def: FighterDef, camX: number, tick: number): void {
    const head = def.standingHurtboxes[1] ?? def.standingHurtboxes[0]!;
    const cx = f.x / SUB - camX, cy = FLOOR_Y - (f.y / SUB + head.y + head.h + 20);
    ctx.save();
    ctx.fillStyle = '#ffeb3b';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const a = tick / 10 + (k * Math.PI * 2) / 3;
      const sx = cx + Math.cos(a) * 34, sy = cy + Math.sin(a) * 8;
      ctx.beginPath();
      for (let p = 0; p < 10; p++) {
        const rr = p % 2 === 0 ? 9 : 4, ang = (p * Math.PI) / 5 - Math.PI / 2;
        ctx.lineTo(sx + Math.cos(ang) * rr, sy + Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawShadow(ctx: CanvasRenderingContext2D, f: FighterState, camX: number): void {
    const scale = Math.max(0.4, 1 - f.y / SUB / 400);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(f.x / SUB - camX, FLOOR_Y + 4, 50 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFighter(ctx: CanvasRenderingContext2D, f: FighterState, def: FighterDef, camX: number): void {
    const shapes = placeholderShapes(f, def);
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#111';
    for (const sh of shapes) this.drawShape(ctx, sh, camX);
    // An eye on the head shows which way the fighter faces.
    const head = shapes.find((sh) => sh.kind === 'circle');
    if (head) {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(head.x - camX + head.w / 2 + f.facing * head.w * 0.22, FLOOR_Y - (head.y + head.h * 0.6), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawShape(ctx: CanvasRenderingContext2D, sh: Shape, camX: number): void {
    const x = sh.x - camX, top = FLOOR_Y - (sh.y + sh.h);
    ctx.fillStyle = sh.color;
    ctx.beginPath();
    if (sh.kind === 'circle') ctx.ellipse(x + sh.w / 2, top + sh.h / 2, sh.w / 2, sh.h / 2, 0, 0, Math.PI * 2);
    else ctx.rect(x, top, sh.w, sh.h);
    ctx.fill();
    ctx.stroke();
  }

  private drawDebug(ctx: CanvasRenderingContext2D, s: MatchState, defs: Defs, camX: number, tickRate: number): void {
    ctx.save();
    ctx.lineWidth = 2;
    const outline = (b: Box, f: FighterState, color: string) => {
      const w = worldBox(b, f.x, f.y, f.facing);
      ctx.strokeStyle = color;
      ctx.strokeRect(w.x1 / SUB - camX, FLOOR_Y - w.y2 / SUB, (w.x2 - w.x1) / SUB, (w.y2 - w.y1) / SUB);
    };
    s.fighters.forEach((f, i) => {
      const def = defs[i as 0 | 1];
      outline(f.y > 0 ? def.airPushbox : def.pushbox, f, '#66bb6a');
      for (const b of hurtboxes(f, def)) outline(b, f, '#42a5f5');
      const hb = activeHitbox(f, def);
      if (hb) outline(hb, f, '#ef5350');
    });
    ctx.fillStyle = '#fff';
    ctx.font = '16px ui-monospace, monospace';
    ctx.textAlign = 'left';
    const lines = [
      `ticks/s ${tickRate}  phase ${s.phase} (${s.phaseTick})  tick ${s.tick}`,
      ...s.fighters.map((f, i) => `P${i + 1} ${f.action}${f.moveId ? `:${f.moveId}` : ''} t${f.actionTick} hp${f.health} stop${f.hitstop}`),
    ];
    lines.forEach((l, i) => ctx.fillText(l, 12, 150 + i * 20));
    ctx.restore();
  }

  drawTitle(joined: readonly [string, string], easy: readonly [boolean, boolean] = [false, false]): void {
    const ctx = this.begin();
    const bg = ctx.createLinearGradient(0, 0, 0, CAMERA_HEIGHT);
    bg.addColorStop(0, '#1a1033');
    bg.addColorStop(1, '#5c1a1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd54f';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.font = 'bold 132px system-ui, sans-serif';
    ctx.strokeText('EVS-GAME', 640, 230);
    ctx.fillText('EVS-GAME', 640, 230);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('Controllers: press Start to join', 640, 380);
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText('Special button (LB / Y / Numpad 7): toggle Easy mode', 640, 425);
    ctx.fillText('Then press Start again (or Enter, or click) to fight!', 640, 465);
    const label = (i: 0 | 1) => `P${i + 1}: ${joined[i]}${easy[i] ? ' · EASY' : ''}`;
    ctx.fillText(`${label(0)}     ${label(1)}`, 640, 530);
  }

  /** A dark band with centered lines, drawn over whatever is on screen. */
  drawOverlay(lines: string[]): void {
    const ctx = this.begin();
    const h = 60 + lines.length * 44;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 470 - h / 2, CAMERA_WIDTH, h);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 32px system-ui, sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, 640, 470 - ((lines.length - 1) * 44) / 2 + i * 44));
  }
}
