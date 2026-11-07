import { expect, test } from 'vitest';
import { loadBrief } from '../../../tools/art-gen/brief.ts';
import { executeRun, planRun } from '../../../tools/art-gen/run.ts';

const b = loadBrief();
test('pilot plans the three pilot frames', () =>
  expect(planRun(b, 'mohawk-man', { kind: 'pilot' }, new Set(), 30).files).toEqual(['idle_01', 'stand-heavy-kick_02', 'crouch_02']));
test('REVIEW FOCUS: "all" skips frames that already exist', () => {
  const p = planRun(b, 'mohawk-man', { kind: 'all' }, new Set(['idle_01', 'idle_02']), 500);
  expect(p.files).not.toContain('idle_01'); expect(p.files[0]).toBe('walk_01');
});
test('REVIEW FOCUS: the cap holds with many frames missing', () =>
  expect(planRun(b, 'mohawk-man', { kind: 'all' }, new Set(), 30).files).toHaveLength(30));
test('named files are regenerated even if they exist; unknown names are reported', () => {
  const p = planRun(b, 'mohawk-man', { kind: 'files', files: ['idle_01', 'idle_99'] }, new Set(['idle_01']), 30);
  expect(p.files).toEqual(['idle_01']); expect(p.unknown).toEqual(['idle_99']);
});
test('reference candidates', () => expect(planRun(b, 'mohawk-man', { kind: 'reference', count: 3 }, new Set(), 30).files)
  .toEqual(['reference-candidate-1', 'reference-candidate-2', 'reference-candidate-3']));
test('executeRun saves each finished image and reports refusals without stopping', async () => {
  const saved: string[] = [];
  const out = await executeRun(['a', 'b', 'c'],
    async (f) => (f === 'b' ? { ok: false, kind: 'refused', message: 'no' } : { ok: true, png: new Uint8Array([1]) }),
    async (f) => { saved.push(f); }, 2);
  expect(saved.sort()).toEqual(['a', 'c']); expect(out.find((o) => o.file === 'b')).toMatchObject({ status: 'refused', message: 'no' });
});
test('REVIEW FOCUS: an auth failure stops the run', async () => {
  let calls = 0;
  const out = await executeRun(['a', 'b', 'c', 'd', 'e'], async () => { calls++; return { ok: false, kind: 'auth', message: '401' }; }, async () => {}, 1);
  expect(calls).toBe(1); expect(out.filter((o) => o.status === 'skipped')).toHaveLength(4);
});
test('executeRun keeps several requests in flight', async () => {
  let inFlight = 0, peak = 0;
  await executeRun(['a', 'b', 'c', 'd', 'e', 'f'], async () => {
    inFlight++; peak = Math.max(peak, inFlight); await new Promise((r) => setTimeout(r, 5)); inFlight--;
    return { ok: true, png: new Uint8Array([1]) };
  }, async () => {}, 3);
  expect(peak).toBe(3);
});
