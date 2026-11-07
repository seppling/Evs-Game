# Art Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tool Claude runs from the cloud session to generate a fighter's reference sheets and animation frames through the OpenAI Images API, plus a private review page where the user approves frames or asks for redos.

**Architecture:** `tools/art-gen/` is plain TypeScript run directly by Node (type stripping) and tested with Vitest.
- `brief.ts` parses `docs/image-model-brief.md`.
- `prompt.ts` builds prompts and the work order.
- `openai.ts` calls the API.
- `run.ts` plans and executes a capped run, writing PNGs to `art-src/<fighter>/`.
- The review page (`tools/art-gen/review.html`) is published as a private claude.ai page with an asset store and a small database. Claude uploads frames to it and reads the user's decisions back, following the runbook (`tools/art-gen/README.md`).

**Tech Stack:** TypeScript on Node 22 (`node file.ts`, erasable syntax only), Vitest, `fetch`/`FormData`/`Blob` built into Node, the OpenAI Images API (image edit with reference), claude.ai pages (Artifact tool with the `assets` and `db` capabilities).

**Spec:** `docs/superpowers/specs/2026-11-07-art-generator-design.md`

## Global Constraints

- **No new dependencies.** Node built-ins only (`node:fs`, `node:path`, `fetch`, `FormData`, `Blob`).
- **Node runs the tools without compiling:** erasable TypeScript only (no `enum`, `namespace` or constructor parameter properties), and imports between `tools/art-gen` files use explicit `.ts` extensions. Add `"allowImportingTsExtensions": true` to `tsconfig.json`.
- **Never call the real API in tests.** The network is injected (`fetch`, `sleep`) everywhere.
- **The API key comes from the network proxy.** The tool sends `Authorization: Bearer ${process.env.OPENAI_API_KEY ?? 'proxy-injected'}` and never logs headers.
- **Spec values:**
  - frames 1024×1024; reference sheets 1536×1024
  - `background: transparent`, PNG, `n = 1`
  - default quality `medium`; default `--max` 30; 3 requests in flight
  - retries back off 2, 4, 8, 16 s
  - pilot files `idle_01`, `stand-heavy-kick_02`, `crouch_02`
  - 3 reference candidates
- **Working copies** go in `art-src/<fighter>/` (already git-ignored).

## Review Focus

1. **The brief gets edited** (a fighter's description changes, or a section's layout slips). The run must refuse to start and name the broken section, never generate from half-parsed text. (Test in Task 1.)
2. **Running "all" again after a crash or a redo round** never regenerates, and never pays again for, frames that already exist, unless they're named explicitly as redos. (Test in Task 4.)
3. **The spending cap holds** even when 85 frames are missing: `--max 30` generates exactly 30. (Test in Task 4.)
4. **A frame refused by the image service's content checks** is recorded as refused with its message. It is not retried, and the other frames continue. (Test in Task 3.)
5. **A bad or missing key (401)** stops the run after the first failure instead of attempting every frame. (Test in Task 4.)

---

## File structure

```
tools/art-gen/brief.ts        parseBrief / loadBrief: the image brief as data
tools/art-gen/prompt.ts       workOrder, framePrompt, referencePrompt, sizeFor, PILOT_FILES
tools/art-gen/openai.ts       generateImage, listModels, pickModel
tools/art-gen/run.ts          planRun, executeRun, CLI entry (npm run art -- …)
tools/art-gen/review.html     the review page (published per fighter)
tools/art-gen/README.md       runbook: setup, reference, pilot, batches, redo rounds, hand-off
tests/unit/tools/*.test.ts    Vitest
```

---

### Task 1: Brief parser

**Files:**
- Create: `tools/art-gen/brief.ts`
- Modify: `tsconfig.json` (`allowImportingTsExtensions: true`)
- Test: `tests/unit/tools/brief.test.ts`

**Interfaces (Produces):**
```ts
export interface Frame { file: string; pose: string; group: string }           // group = the ### heading above its table
export interface FighterBrief { id: string; name: string; background: string; description: string; body: string;
  flavor: string; intro: string; win1: string; win2: string; moves: Frame[] }   // moves group = 'Special moves and super'
export interface Brief {
  style: string[];                 // section 3 bullets, text only
  imageRules: string[];            // section 4 numbered items, text only (number stripped)
  frames: Frame[];                 // section 5 tables, in order
  fighters: Record<string, FighterBrief>;   // keyed by Folder
  starter: { before: string[]; after: string[] };  // section 8 item 2: backticked names before / after "first special move"
  special: { reference: string[]; effect: string[]; portrait: string[] };  // section 7 bullets
}
export function parseBrief(markdown: string): Brief;
export function loadBrief(path?: string): Brief;    // default 'docs/image-model-brief.md'
```

**Parsing rules:**
- Sections are split on `## N.` headings. Table rows match ``| `file` | pose |``.
- **Each fighter** (section 6, one `### Name` each) reads these bullets:
  - `- **Folder:**` (the backticked value)
  - `- **Background:**`, `- **Character description:**`, `- **Body:**`, `- **Flavor notes:**`
  - one `- **Intro:** … **Win 1:** … **Win 2:** …` line
- **Errors:** any missing section, fighter field or table throws `Error('image brief: missing <thing> in <section or fighter name>')`.

- [ ] **Step 1: Write the failing tests:**
  ```ts
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
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/tools/brief.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `brief.ts`.
- [ ] **Step 4: Run** the same command, then `npm run typecheck`. Expected: PASS, clean.
- [ ] **Step 5: Commit.** `feat(art-gen): parse the image-model brief into data`

---

### Task 2: Prompts and work order

**Files:**
- Create: `tools/art-gen/prompt.ts`
- Test: `tests/unit/tools/prompt.test.ts`

**Interfaces (Produces):**
```ts
export const PILOT_FILES = ['idle_01', 'stand-heavy-kick_02', 'crouch_02'] as const;
export function workOrder(b: Brief, fighter: string): string[];
export function framePrompt(b: Brief, fighter: string, file: string, note?: string): string;  // throws on an unknown fighter or file
export function referencePrompt(b: Brief, fighter: string): string;
export function sizeFor(file: string): '1024x1024' | '1536x1024';   // reference candidates (`reference-candidate-N`) are 1536x1024
```

**Work order:**
1. `starter.before`
2. every file of the fighter's first move base (the files sharing the prefix before `_NN` of `moves[0]`)
3. `starter.after`
4. the remaining `frames` in order
5. the remaining `moves` in order
6. `portrait`

No duplicates.

**`framePrompt` layout** (each block on its own line, in this order):
- `STYLE: ` + the style bullets joined with spaces
- `IMAGE RULES: ` + the image rules joined with spaces, with the rule beginning `**Background:**` replaced by `Background: fully transparent, no background color at all.`
- `REFERENCE: This is the same character as in the attached reference image. Keep the face, hair, outfit, colors and body proportions exactly the same.`
- `CHARACTER: ` + description
- `BODY: ` + body
- `FLAVOR: ` + flavor
- `POSE (file): ` + the pose, where:
  - `intro_01` uses the fighter's `intro`
  - `win_01` uses `win1`
  - `win_02` uses `win2`
- then `REVIEWER NOTE: ` + note, when a note is given

**Special file types:**
- **Effect files** (`-fx_NN`): replace the `POSE` line with `EFFECT IMAGE: ` + the effect bullets + ` Object: ` + pose, and drop `BODY`/`FLAVOR`.
- **`portrait`**: replace the `POSE` line with `PORTRAIT: ` + the portrait bullets.

**`referencePrompt` layout:**
- `STYLE: …`
- `REFERENCE SHEET: ` + the reference bullets
- `Use the attached picture as the design to follow.`
- `CHARACTER: …`
- `BODY: …`
- `Background: fully transparent.`

- [ ] **Step 1: Write the failing tests:**
  ```ts
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
  test('unknown files are rejected', () => expect(() => framePrompt(b, 'mohawk-man', 'idle_99')).toThrow(/idle_99/));
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
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/tools/prompt.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `prompt.ts`.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(art-gen): build frame and reference prompts and the work order from the brief`

---

### Task 3: OpenAI client

**Files:**
- Create: `tools/art-gen/openai.ts`
- Test: `tests/unit/tools/openai.test.ts`

**Interfaces (Produces):**
```ts
export type Quality = 'low' | 'medium' | 'high';
export interface ImageRequest { model: string; prompt: string; reference: Uint8Array; size: '1024x1024' | '1536x1024'; quality: Quality }
export type ImageResult = { ok: true; png: Uint8Array } | { ok: false; kind: 'refused' | 'failed' | 'auth'; message: string };
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export interface ClientDeps { fetch?: FetchLike; sleep?: (ms: number) => Promise<void> }
export async function generateImage(req: ImageRequest, deps?: ClientDeps): Promise<ImageResult>;
export async function listModels(deps?: ClientDeps): Promise<string[]>;      // GET /v1/models → data[].id
export function pickModel(ids: readonly string[]): string;
```

**`generateImage`:** `POST https://api.openai.com/v1/images/edits` as multipart, with fields:
- `model`, `prompt`
- `image[]`: the reference as `reference.png`, `image/png`
- `size`, `quality`
- `background=transparent`, `output_format=png`, `n=1`

**Response handling:**
- **200:** decode `data[0].b64_json`.
- **401/403:** `{ kind: 'auth' }` immediately.
- **400** whose body has `error.code === 'moderation_blocked'`, or whose `error.message` mentions safety: `{ kind: 'refused', message }` with no retry.
- **429, 5xx, or a thrown fetch:** retry after 2, 4, 8, 16 s (via `sleep`), then `{ kind: 'failed' }`.
- **Other 4xx:** `{ kind: 'failed' }` with no retry.

**`pickModel`:** among ids starting `gpt-image` and not containing `mini`, choose the highest version number. Return `gpt-image-1` when there is none.

- [ ] **Step 1: Write the failing tests** (a fake `fetch` records calls and returns queued `Response`s; a fake `sleep` records delays):
  ```ts
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
    const f = fakeFetch(Array(5).fill(json(429, { error: { message: 'slow down' } }))); const s = fakeSleep();
    expect(await generateImage(req(), { fetch: f.fn, sleep: s.fn })).toMatchObject({ ok: false, kind: 'failed' });
    expect(s.delays).toEqual([2000, 4000, 8000, 16000]);
  });
  test('recovers when a retry succeeds', async () => {
    const f = fakeFetch([json(503, {}), json(200, { data: [{ b64_json: 'UE5H' }] })]);
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
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/tools/openai.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `openai.ts`.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(art-gen): add the OpenAI image client with retries and refusal handling`

---

### Task 4: Run planning, execution and the command line

**Files:**
- Create: `tools/art-gen/run.ts`
- Modify: `package.json` (script `"art": "node tools/art-gen/run.ts"`)
- Test: `tests/unit/tools/run.test.ts`

**Interfaces (Produces):**
```ts
export type Selection = { kind: 'pilot' } | { kind: 'all' } | { kind: 'files'; files: string[] } | { kind: 'reference'; count: number };
export interface RunPlan { fighter: string; files: string[]; unknown: string[] }
export function planRun(b: Brief, fighter: string, sel: Selection, existing: ReadonlySet<string>, max: number): RunPlan;
export interface FrameOutcome { file: string; status: 'done' | 'refused' | 'failed' | 'auth' | 'skipped'; message?: string }
export async function executeRun(files: string[], generate: (file: string) => Promise<ImageResult>,
  save: (file: string, png: Uint8Array) => Promise<void>, concurrency: number): Promise<FrameOutcome[]>;
```

**`planRun` rules:**
- **pilot:** `PILOT_FILES`.
- **all:** `workOrder` minus `existing`.
- **files:** the named files, kept even if they exist (that's how redos regenerate). Names not in the work order go to `unknown`.
- **reference:** `reference-candidate-1..count`.
- **Always:** cut the list to `max`.

**`executeRun` rules:**
- Keeps `concurrency` generations in flight.
- After the first `auth` result it starts no new ones; the remaining files are `skipped`.
- Saves each `done` PNG as it arrives.

**The command line:**
```
npm run art -- --fighter <id> (--pilot | --all | --files a,b,c | --reference 3)
               [--quality low|medium|high] [--model <id>] [--max 30] [--notes notes.json] [--skip uploaded.txt] [--dry-run]
```
- **`existing`:** the `*.png` names already in `art-src/<id>/`, plus the lines of `--skip`. The skip file is the list of frames already uploaded to the review page, so nothing is paid for twice after a container restart.
- **Refuses to start:**
  - with any `unknown` name (and lists them)
  - with no `art-src/<id>/reference.png` for a non-reference run ("pick a reference first")
  - when the brief fails to parse
- **References:** reference candidates use `docs/art/reference/<id>.png` as the input image; everything else uses `art-src/<id>/reference.png`.
- **Notes:** `--notes` is a JSON object `{ file: note }`, passed to `framePrompt`.
- **Model:** from `--model`, or `pickModel(await listModels())`.
- **Run log:** written to `art-src/<id>/run-<timestamp>.json`: `{ model, quality, outcomes, generated }`. A one-line summary is printed (`generated 30 · refused 1 · failed 0`).
- **`--dry-run`:** prints the plan and the first prompt. No network.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  const b = loadBrief();
  test('pilot plans the three pilot frames', () => expect(planRun(b, 'mohawk-man', { kind: 'pilot' }, new Set(), 30).files).toEqual(['idle_01', 'stand-heavy-kick_02', 'crouch_02']));
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
    const out = await executeRun(['a', 'b', 'c'], async (f) => (f === 'b' ? { ok: false, kind: 'refused', message: 'no' } : { ok: true, png: new Uint8Array([1]) }),
      async (f) => { saved.push(f); }, 2);
    expect(saved.sort()).toEqual(['a', 'c']); expect(out.find((o) => o.file === 'b')).toMatchObject({ status: 'refused', message: 'no' });
  });
  test('REVIEW FOCUS: an auth failure stops the run', async () => {
    let calls = 0;
    const out = await executeRun(['a', 'b', 'c', 'd', 'e'], async () => { calls++; return { ok: false, kind: 'auth', message: '401' }; }, async () => {}, 1);
    expect(calls).toBe(1); expect(out.filter((o) => o.status === 'skipped')).toHaveLength(4);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/tools/run.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `run.ts`. The CLI part only runs when the file is the entry point: `import.meta.url === pathToFileURL(process.argv[1]).href`.
- [ ] **Step 4: Run** the tests, then `npm run art -- --fighter mohawk-man --pilot --dry-run`.
  - Expected: tests PASS.
  - The dry run refuses with "pick a reference first" (no `art-src/mohawk-man/reference.png` yet).
  - With `--reference 3 --dry-run`, it prints 3 planned files and a prompt containing "front view".
- [ ] **Step 5: Commit.** `feat(art-gen): plan and run capped, resumable generation from the command line`

---

### Task 5: Review page and runbook

**Files:**
- Create: `tools/art-gen/review.html`, `tools/art-gen/README.md`
- No unit tests. This is a page plus operating instructions. It's verified by publishing a page for Mohawk Man and reading it back (step 3).

**Before writing the page:** load the `artifact-design` and `artifact-capabilities` skills. The page declares the **`assets`** and **`db`** capabilities, and uses the exact client calls the capabilities skill documents.

**Data, in the page's database** (Claude writes the first three; the page writes the last two):
- **`frames`** collection, document id = file name: `{ file, group, order, url, version, status: 'pending' | 'approved' | 'redo', note }`
  - Claude writes `file`, `group`, `order`, `url`, `version`, and `status: 'pending'` on every new upload.
  - The page writes `status` and `note`.
- **`references`** collection: `{ id, label, url }` for each candidate and for the lineup crop.
- **`choice`** document `reference`: `{ id }`, written by the page when the user picks.

**The page:**
- **Header:** "Evs-Game Art: <Fighter>", counts (approved / redo / pending), filters (All · Needs review · Redo · Approved), and **Approve all pending**.
- **Reference section:** the candidates side by side with a **Use this one** button. The chosen one is highlighted.
- **Frames:** grouped by `group` in `order`. Each card shows:
  - the image on a checkerboard background (so transparency is visible)
  - the file name
  - Approve / Redo buttons
  - a note box that saves when you leave it
- **Phone layout:** works at phone width (two cards per row).

**`README.md` runbook.** The exact steps Claude follows, so the procedure survives a context reset:
1. **Setup:**
   - create the personal "Evs-Game" environment and move this session onto it (approval prompt)
   - request the OpenAI key for `api.openai.com` (secure form)
   - verify with `npm run art -- --fighter mohawk-man --reference 1 --max 1`
2. **Publish the fighter's page** from `review.html`, then upload `docs/art/reference/<id>.png` as the "Lineup" reference.
3. **Reference round:** `--reference 3`, then upload the results as assets and write the `references` documents. Wait for the user's pick. Download the chosen asset to `art-src/<id>/reference.png`.
4. **Pilot:** `--pilot`, upload, write `frames`, wait for the user's OK.
5. **Batches:**
   - `--all --max 25 --skip art-src/<id>/uploaded.txt`
   - after each batch: upload (`file_paths`, up to 25 per call), write `frames` with an `ArtifactData` batch, append the names to `uploaded.txt`
   - repeat until the plan is empty
6. **Redo round:**
   - read `frames` where `status = 'redo'`
   - write `notes.json`, then `--files <redo list> --notes notes.json`
   - upload, replace those documents (`version + 1`, `status: 'pending'`) and delete the replaced assets
7. **Hand-off:** when every frame is approved, the approved set is ready for Milestone 3's art import.

- [ ] **Step 1: Write `review.html` and `README.md`** as above.
- [ ] **Step 2: Typecheck and run the full suite.** Run `npm run typecheck && npm test`. Expected: all PASS (nothing imports the page).
- [ ] **Step 3: Publish and check the page.**
  - Publish the Mohawk Man review page (private), upload the lineup crop as its first reference, and write its `references` document.
  - Read the page back and confirm it renders the reference with its **Use this one** button.
  - Commit `review.html` and `README.md` with the message `feat(art-gen): add the review page and runbook`.

---

## Go-live (after the build, with the user)

These are runbook steps 1–4, run with the user present, not build tasks:
1. **Setup:** two approval prompts, the environment and the key form.
2. **Reference sheets:** generate 3 for Mohawk Man; the user picks on the page.
3. **Pilot:** 3 frames; the user approves the look.
4. **The full run** on the user's "go".
