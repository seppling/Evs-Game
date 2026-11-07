export type Quality = 'low' | 'medium' | 'high';
export interface ImageRequest { model: string; prompt: string; reference: Uint8Array; size: '1024x1024' | '1536x1024'; quality: Quality }
export type ImageResult = { ok: true; png: Uint8Array } | { ok: false; kind: 'refused' | 'failed' | 'auth'; message: string };
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export interface ClientDeps { fetch?: FetchLike; sleep?: (ms: number) => Promise<void> }

const API = 'https://api.openai.com/v1';
const BACKOFF_MS = [2000, 4000, 8000, 16000];
const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The network proxy injects the real key; the header value here is only a placeholder when no key is set locally. */
function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? 'proxy-injected'}` };
}

async function errorOf(res: Response): Promise<{ code: string; message: string }> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    return { code: body.error?.code ?? '', message: body.error?.message ?? `HTTP ${res.status}` };
  } catch {
    return { code: '', message: `HTTP ${res.status}` };
  }
}

/** One image from a prompt plus a reference picture. Retries busy/server errors; never retries refusals or bad keys. */
export async function generateImage(req: ImageRequest, deps: ClientDeps = {}): Promise<ImageResult> {
  const doFetch = deps.fetch ?? (fetch as FetchLike);
  const sleep = deps.sleep ?? realSleep;
  let lastMessage = 'no response';
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1]!);
    const form = new FormData();
    form.append('model', req.model);
    form.append('prompt', req.prompt);
    form.append('image[]', new Blob([new Uint8Array(req.reference)], { type: 'image/png' }), 'reference.png');
    form.append('size', req.size);
    form.append('quality', req.quality);
    form.append('background', 'transparent');
    form.append('output_format', 'png');
    form.append('n', '1');
    let res: Response;
    try {
      res = await doFetch(`${API}/images/edits`, { method: 'POST', headers: authHeader(), body: form });
    } catch (e) {
      lastMessage = `network error: ${(e as Error).message}`;
      continue;
    }
    if (res.ok) {
      const body = (await res.json()) as { data?: { b64_json?: string }[] };
      const b64 = body.data?.[0]?.b64_json;
      if (!b64) return { ok: false, kind: 'failed', message: 'response had no image' };
      return { ok: true, png: new Uint8Array(Buffer.from(b64, 'base64')) };
    }
    const err = await errorOf(res);
    if (res.status === 401 || res.status === 403) return { ok: false, kind: 'auth', message: err.message };
    if (res.status === 400 && (err.code === 'moderation_blocked' || /safety/i.test(err.message))) {
      return { ok: false, kind: 'refused', message: err.message };
    }
    if (res.status === 429 || res.status >= 500) {
      lastMessage = err.message;
      continue;
    }
    return { ok: false, kind: 'failed', message: err.message };
  }
  return { ok: false, kind: 'failed', message: lastMessage };
}

export async function listModels(deps: ClientDeps = {}): Promise<string[]> {
  const doFetch = deps.fetch ?? (fetch as FetchLike);
  const res = await doFetch(`${API}/models`, { method: 'GET', headers: authHeader() });
  if (!res.ok) throw new Error(`listing models failed: ${(await errorOf(res)).message}`);
  const body = (await res.json()) as { data?: { id: string }[] };
  return (body.data ?? []).map((m) => m.id);
}

/** The newest full (non-mini) gpt-image model, or gpt-image-1. */
export function pickModel(ids: readonly string[]): string {
  const versioned = ids
    .filter((id) => id.startsWith('gpt-image') && !id.includes('mini'))
    .map((id) => ({ id, v: Number(id.match(/^gpt-image-(\d+(?:\.\d+)?)$/)?.[1] ?? NaN) }))
    .filter((m) => !Number.isNaN(m.v))
    .sort((a, b) => b.v - a.v);
  return versioned[0]?.id ?? 'gpt-image-1';
}
