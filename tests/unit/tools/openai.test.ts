import { expect, test } from 'vitest';
import { generateImage, pickModel, type FetchLike, type ImageRequest } from '../../../tools/art-gen/openai.ts';

const req = (): ImageRequest => ({ model: 'gpt-image-1', prompt: 'p', reference: new Uint8Array([1, 2, 3]), size: '1024x1024', quality: 'medium' });
const json = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function fakeFetch(queue: (() => Response)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn: FetchLike = async (url, init) => { calls.push({ url, init }); const next = queue.shift(); if (!next) throw new Error('no more responses'); return next(); };
  return { fn, calls };
}
const noSleep = async () => {};
function fakeSleep() { const delays: number[] = []; return { delays, fn: async (ms: number) => { delays.push(ms); } }; }

test('sends the reference, size, quality and transparent background; decodes the PNG', async () => {
  const f = fakeFetch([json(200, { data: [{ b64_json: Buffer.from('PNG').toString('base64') }] })]);
  const r = await generateImage(req(), { fetch: f.fn, sleep: noSleep });
  expect(r).toEqual({ ok: true, png: new Uint8Array(Buffer.from('PNG')) });
  const body = f.calls[0]!.init.body as FormData;
  expect(f.calls[0]!.url).toBe('https://api.openai.com/v1/images/edits');
  expect(body.get('size')).toBe('1024x1024'); expect(body.get('quality')).toBe('medium'); expect(body.get('background')).toBe('transparent');
  expect(body.getAll('image[]')).toHaveLength(1);
});
test('retries 429 and 5xx with 2/4/8/16 s back-off, then fails', async () => {
  const f = fakeFetch(Array.from({ length: 5 }, () => json(429, { error: { message: 'slow down' } }))); const s = fakeSleep();
  expect(await generateImage(req(), { fetch: f.fn, sleep: s.fn })).toMatchObject({ ok: false, kind: 'failed' });
  expect(s.delays).toEqual([2000, 4000, 8000, 16000]);
});
test('recovers when a retry succeeds', async () => {
  const f = fakeFetch([json(503, {}), json(200, { data: [{ b64_json: 'UE5H' }] })]);
  expect((await generateImage(req(), { fetch: f.fn, sleep: noSleep })).ok).toBe(true);
});
test('a network error is retried too', async () => {
  const f = fakeFetch([() => { throw new TypeError('fetch failed'); }, json(200, { data: [{ b64_json: 'UE5H' }] })]);
  expect((await generateImage(req(), { fetch: f.fn, sleep: noSleep })).ok).toBe(true);
});
test('REVIEW FOCUS: a content refusal is reported once, never retried', async () => {
  const f = fakeFetch([json(400, { error: { code: 'moderation_blocked', message: 'blocked by safety system' } })]);
  expect(await generateImage(req(), { fetch: f.fn, sleep: noSleep })).toEqual({ ok: false, kind: 'refused', message: 'blocked by safety system' });
  expect(f.calls).toHaveLength(1);
});
test('a bad key is an auth failure, not retried', async () => {
  const f = fakeFetch([json(401, { error: { message: 'Incorrect API key' } })]);
  expect(await generateImage(req(), { fetch: f.fn, sleep: noSleep })).toMatchObject({ ok: false, kind: 'auth' }); expect(f.calls).toHaveLength(1);
});
test('pickModel prefers the newest full gpt-image model', () => {
  expect(pickModel(['dall-e-3', 'gpt-image-1', 'gpt-image-1.5', 'gpt-image-1-mini'])).toBe('gpt-image-1.5');
  expect(pickModel(['dall-e-3'])).toBe('gpt-image-1');
});
