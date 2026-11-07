import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { loadBrief, parseBrief } from '../../../tools/art-gen/brief.ts';

const b = loadBrief();
test('reads all eight fighters by folder', () => expect(Object.keys(b.fighters).sort()).toEqual(
  ['flip-spin-crawler', 'head-flip', 'mohawk-man', 'poker-stick', 'richie', 'spin-kicker', 'two-face', 'weight-kicker']));
test('reads the shared frame list', () => {
  expect(b.frames).toHaveLength(68); expect(b.frames[0]).toMatchObject({ file: 'idle_01', group: 'Moving' });
  expect(b.frames.find((f) => f.file === 'stand-heavy-kick_02')!.pose).toMatch(/^Roundhouse kick at head height/);
});
test('reads a fighter', () => {
  const m = b.fighters['mohawk-man']!;
  expect(m.name).toBe('Mohawk Man'); expect(m.description).toMatch(/^Mohawk Man, a tall, muscular karate fighter/);
  expect(m.intro).toMatch(/mohawk/); expect(m.win2).toMatch(/bow/);
  expect(m.moves[0]!.file).toBe('mohawk-ram_01'); expect(m.moves.map((x) => x.file)).toContain('karate-wave-fx_01');
});
test('reads style, image rules, special types and the starter set', () => {
  expect(b.style.length).toBeGreaterThanOrEqual(5); expect(b.imageRules.some((r) => r.startsWith('**Background:**'))).toBe(true);
  expect(b.special.reference.join(' ')).toMatch(/front view/); expect(b.special.effect.join(' ')).toMatch(/only the object/i);
  expect(b.starter.before[0]).toBe('idle_01'); expect(b.starter.before.at(-1)).toBe('jump-kick_02'); expect(b.starter.after.at(-1)).toBe('win_01');
});
test('REVIEW FOCUS: a broken fighter section stops the parse and names the fighter', () => {
  const md = readFileSync('docs/image-model-brief.md', 'utf8').replace(/- \*\*Character description:\*\* Richie,[^\n]*\n/, '');
  expect(() => parseBrief(md)).toThrow(/Richie/);
});
