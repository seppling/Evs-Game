import { expect, test } from 'vitest';
import { loadBrief } from '../../../tools/art-gen/brief.ts';
import { framePrompt, referencePrompt, sizeFor, workOrder } from '../../../tools/art-gen/prompt.ts';

const b = loadBrief(); const m = b.fighters['mohawk-man']!;
test('frame prompt carries the description verbatim, the pose, and a transparent background', () => {
  const p = framePrompt(b, 'mohawk-man', 'stand-heavy-kick_02');
  expect(p).toContain(m.description); expect(p).toContain('Roundhouse kick at head height');
  expect(p).toMatch(/fully transparent/); expect(p).not.toMatch(/#FF00FF|#00FF00/);
});
test('round poses come from the fighter', () => expect(framePrompt(b, 'mohawk-man', 'intro_01')).toContain(m.intro));
test('a redo note is appended', () => expect(framePrompt(b, 'mohawk-man', 'idle_01', 'arm cut off')).toMatch(/REVIEWER NOTE: arm cut off$/));
test('effect images draw only the object', () => {
  const p = framePrompt(b, 'mohawk-man', 'karate-wave-fx_01'); expect(p).toMatch(/EFFECT IMAGE/); expect(p).not.toMatch(/^POSE/m);
});
test('portrait uses the portrait rules', () => expect(framePrompt(b, 'mohawk-man', 'portrait')).toMatch(/^PORTRAIT: /m));
test('unknown files are rejected', () => expect(() => framePrompt(b, 'mohawk-man', 'idle_99')).toThrow(/idle_99/));
test('unknown fighters are rejected', () => expect(() => framePrompt(b, 'nobody', 'idle_01')).toThrow(/nobody/));
test('work order: starter set, first special, rest, portrait last', () => {
  const o = workOrder(b, 'mohawk-man'); const i = o.indexOf('jump-kick_02');
  expect(o.slice(0, 2)).toEqual(['idle_01', 'idle_02']);
  expect(o.slice(i + 1, i + 4)).toEqual(['mohawk-ram_01', 'mohawk-ram_02', 'mohawk-ram_03']);
  expect(o[i + 4]).toBe('hit-high_01'); expect(o.at(-1)).toBe('portrait');
  expect(new Set(o).size).toBe(o.length); expect(o).toHaveLength(68 + m.moves.length + 1);
});
test('reference prompt and sizes', () => {
  expect(referencePrompt(b, 'mohawk-man')).toMatch(/front view/); expect(referencePrompt(b, 'mohawk-man')).toContain(m.description);
  expect(sizeFor('reference-candidate-2')).toBe('1536x1024'); expect(sizeFor('idle_01')).toBe('1024x1024');
});
test('no prompt asks for the old background color', () => {
  for (const p of [referencePrompt(b, 'mohawk-man'), framePrompt(b, 'mohawk-man', 'portrait'), framePrompt(b, 'mohawk-man', 'karate-wave-fx_01')]) {
    expect(p).not.toMatch(/fighter's background color/); expect(p).toMatch(/transparent/);
  }
});
