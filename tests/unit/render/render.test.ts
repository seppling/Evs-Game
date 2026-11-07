import { expect, test } from 'vitest';
import { createMatch } from '../../../src/engine/match';
import { announcerText, ComboDisplay, comboText, HealthTrail } from '../../../src/render/hud';
import { placeholderShapes } from '../../../src/render/placeholder';
import { computeViewport } from '../../../src/render/viewport';
import { DEFS, fightPair, setAttack } from '../helpers';

test('viewport fits 16:9 and scales to device pixels', () => {
  expect(computeViewport(1920, 1080, 1)).toEqual({ cssWidth: 1920, cssHeight: 1080, pixelWidth: 1920, pixelHeight: 1080, unitScale: 1.5 });
  expect(computeViewport(1000, 1000, 2)).toEqual({ cssWidth: 1000, cssHeight: 562, pixelWidth: 2000, pixelHeight: 1124, unitScale: 2000 / 1280 });
});
test('placeholder: idle is a body rect plus a head circle', () => {
  const { fs, defs } = fightPair(); const s = placeholderShapes(fs[0], defs[0]);
  expect(s.map((x) => x.kind).sort()).toEqual(['circle', 'rect']);
});
test('placeholder: an active attack shows a mirrored limb', () => {
  const { fs, defs } = fightPair(); setAttack(fs[1], 'stand-lp', 4);
  const limb = placeholderShapes(fs[1], defs[1]).filter((x) => x.color === defs[1].colors.secondary && x.kind === 'rect');
  expect(limb).toContainEqual(expect.objectContaining({ x: 1110 - 100, w: 70 }));
});
test('placeholder: the uppercut limb does not steal the head', () => {
  const { fs, defs } = fightPair(); setAttack(fs[0], 'crouch-hp', 9);
  const circles = placeholderShapes(fs[0], defs[0]).filter((x) => x.kind === 'circle');
  expect(circles).toHaveLength(1);
  expect(circles[0]!.y).toBe(defs[0].crouchingHurtboxes[1]!.y);
});
test('placeholder: a knocked-down fighter is still drawn', () => {
  const { fs, defs } = fightPair(); fs[0].action = 'down';
  expect(placeholderShapes(fs[0], defs[0]).length).toBeGreaterThan(0);
});
test('announcer text follows the phases', () => {
  const names = ['Mohawk Man', 'Spin Kicker'] as const; const s = createMatch(DEFS);
  expect(announcerText(s, names)).toBe('ROUND 1');
  expect(announcerText({ ...s, phaseTick: 60 }, names)).toBe('FIGHT!');
  expect(announcerText({ ...s, phase: 'fight' }, names)).toBeNull();
  expect(announcerText({ ...s, phase: 'ko' }, names)).toBe('K.O.');
  expect(announcerText({ ...s, phase: 'roundEnd', phaseTick: 70, roundResult: 1, roundEndReason: 'ko' }, names)).toBe('SPIN KICKER WINS');
  expect(announcerText({ ...s, phase: 'roundEnd', phaseTick: 10, roundResult: 0, roundEndReason: 'time' }, names)).toBe('TIME');
  expect(announcerText({ ...s, phase: 'roundEnd', phaseTick: 10, roundResult: 0, roundEndReason: 'ko', perfect: true }, names)).toBe('PERFECT');
  expect(announcerText({ ...s, phase: 'roundEnd', phaseTick: 70, roundResult: 'draw', roundEndReason: 'time' }, names)).toBe('DRAW');
  expect(announcerText({ ...s, phase: 'matchEnd', matchWinner: 0 }, names)).toBe('MOHAWK MAN WINS');
});
test('health trail holds, then drains toward health', () => {
  const t = new HealthTrail(1000); expect(t.update(900)).toBe(1000);
  for (let i = 0; i < 29; i++) t.update(900);
  expect(t.update(900)).toBe(992);
  for (let i = 0; i < 50; i++) t.update(900);
  expect(t.update(900)).toBe(900);
});
test('health trail snaps up when health rises (new round)', () => {
  const t = new HealthTrail(500); expect(t.update(1000)).toBe(1000);
});

test('comboText', () => {
  expect(comboText(1)).toBeNull();
  expect(comboText(2)).toEqual({ label: '2 HITS', shout: null });
  expect(comboText(3)!.shout).toBe('NICE!'); expect(comboText(5)!.shout).toBe('GREAT!');
  expect(comboText(7)!.shout).toBe('AWESOME!'); expect(comboText(12)!.shout).toBe('INCREDIBLE!');
});
test('ComboDisplay lingers 60 updates after the combo ends', () => {
  const d = new ComboDisplay(); d.update(3, 150); d.update(0, 0); expect(d.shown).toEqual({ hits: 3, damage: 150 });
  for (let i = 0; i < 59; i++) d.update(0, 0);
  expect(d.shown).not.toBeNull(); d.update(0, 0); expect(d.shown).toBeNull();
});
test('ComboDisplay ignores single hits', () => {
  const d = new ComboDisplay(); d.update(1, 30); expect(d.shown).toBeNull();
});
test('a thrown or landing fighter is still drawn', () => {
  const { fs, defs } = fightPair();
  for (const a of ['thrown', 'throwing', 'landing'] as const) { fs[1].action = a; expect(placeholderShapes(fs[1], defs[1]).length).toBeGreaterThan(0); }
});
