import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadBrief, type Brief } from './brief.ts';
import { generateImage, listModels, pickModel, type ImageResult, type Quality } from './openai.ts';
import { framePrompt, PILOT_FILES, referencePrompt, sizeFor, workOrder } from './prompt.ts';

export type Selection = { kind: 'pilot' } | { kind: 'all' } | { kind: 'files'; files: string[] } | { kind: 'reference'; count: number };
export interface RunPlan { fighter: string; files: string[]; unknown: string[] }
export interface FrameOutcome { file: string; status: 'done' | 'refused' | 'failed' | 'auth' | 'skipped'; message?: string }

/** Which files this run will generate (capped at `max`). Existing frames are skipped unless named explicitly. */
export function planRun(b: Brief, fighter: string, sel: Selection, existing: ReadonlySet<string>, max: number): RunPlan {
  let files: string[] = [];
  let unknown: string[] = [];
  if (sel.kind === 'pilot') files = [...PILOT_FILES];
  else if (sel.kind === 'all') files = workOrder(b, fighter).filter((f) => !existing.has(f));
  else if (sel.kind === 'reference') files = Array.from({ length: sel.count }, (_, i) => `reference-candidate-${i + 1}`);
  else {
    const known = new Set(workOrder(b, fighter));
    files = sel.files.filter((f) => known.has(f));
    unknown = sel.files.filter((f) => !known.has(f));
  }
  return { fighter, files: files.slice(0, Math.max(0, max)), unknown };
}

/** Generates with `concurrency` requests in flight, saving each image as it arrives. A bad key stops the run. */
export async function executeRun(files: string[], generate: (file: string) => Promise<ImageResult>,
  save: (file: string, png: Uint8Array) => Promise<void>, concurrency: number): Promise<FrameOutcome[]> {
  const outcomes = new Map<string, FrameOutcome>();
  let stopped = false;
  let next = 0;
  const worker = async () => {
    while (!stopped && next < files.length) {
      const file = files[next++]!;
      const r = await generate(file);
      if (r.ok) {
        await save(file, r.png);
        outcomes.set(file, { file, status: 'done' });
      } else {
        outcomes.set(file, { file, status: r.kind, message: r.message });
        if (r.kind === 'auth') stopped = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return files.map((f) => outcomes.get(f) ?? { file: f, status: 'skipped' });
}

// ---------------------------------------------------------------- command line

const USAGE = `npm run art -- --fighter <id> (--pilot | --all | --files a,b,c | --reference N)
  [--quality low|medium|high] [--model <id>] [--max 30] [--notes notes.json] [--skip uploaded.txt] [--dry-run]`;

function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) throw new Error(`unexpected argument "${a}"\n${USAGE}`);
    const value = argv[i + 1];
    if (value !== undefined && !value.startsWith('--')) { out[a.slice(2)] = value; i++; } else out[a.slice(2)] = true;
  }
  return out;
}

async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const fighter = typeof args.fighter === 'string' ? args.fighter : '';
  const b = loadBrief();
  if (!b.fighters[fighter]) throw new Error(`unknown or missing --fighter "${fighter}"\n${USAGE}`);
  const sel: Selection | null = args.pilot ? { kind: 'pilot' } : args.all ? { kind: 'all' }
    : typeof args.files === 'string' ? { kind: 'files', files: args.files.split(',').map((s) => s.trim()).filter(Boolean) }
      : typeof args.reference === 'string' ? { kind: 'reference', count: Number(args.reference) } : null;
  if (!sel) throw new Error(`choose --pilot, --all, --files or --reference\n${USAGE}`);
  const quality = (typeof args.quality === 'string' ? args.quality : 'medium') as Quality;
  if (!['low', 'medium', 'high'].includes(quality)) throw new Error(`--quality must be low, medium or high`);
  const max = typeof args.max === 'string' ? Number(args.max) : 30;

  const outDir = join('art-src', fighter);
  mkdirSync(outDir, { recursive: true });
  const existing = new Set(readdirSync(outDir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)));
  if (typeof args.skip === 'string' && existsSync(args.skip)) {
    for (const line of readFileSync(args.skip, 'utf8').split('\n')) if (line.trim()) existing.add(line.trim());
  }
  const plan = planRun(b, fighter, sel, existing, max);
  if (plan.unknown.length) throw new Error(`these files are not in the brief: ${plan.unknown.join(', ')}`);

  const referencePath = sel.kind === 'reference' ? join('docs', 'art', 'reference', `${fighter}.png`) : join(outDir, 'reference.png');
  if (!existsSync(referencePath)) {
    throw new Error(sel.kind === 'reference' ? `missing lineup crop ${referencePath}` : `pick a reference first: ${referencePath} does not exist`);
  }
  const notes: Record<string, string> = typeof args.notes === 'string' ? JSON.parse(readFileSync(args.notes, 'utf8')) : {};
  const promptFor = (file: string) => (file.startsWith('reference-candidate') ? referencePrompt(b, fighter) : framePrompt(b, fighter, file, notes[file]));

  if (args['dry-run']) {
    console.log(`dry run: ${plan.files.length} file(s): ${plan.files.join(', ')}`);
    if (plan.files[0]) console.log(`\nprompt for ${plan.files[0]}:\n${promptFor(plan.files[0])}`);
    return;
  }
  if (plan.files.length === 0) { console.log('nothing to generate'); return; }

  const model = typeof args.model === 'string' ? args.model : pickModel(await listModels());
  const reference = new Uint8Array(readFileSync(referencePath));
  const outcomes = await executeRun(plan.files,
    (file) => generateImage({ model, prompt: promptFor(file), reference, size: sizeFor(file), quality }),
    async (file, png) => writeFileSync(join(outDir, `${file}.png`), png), 3);
  const count = (s: FrameOutcome['status']) => outcomes.filter((o) => o.status === s).length;
  const log = { at: new Date().toISOString(), model, quality, generated: count('done'), outcomes };
  writeFileSync(join(outDir, `run-${log.at.replace(/[:.]/g, '-')}.json`), JSON.stringify(log, null, 2));
  console.log(`model ${model} · quality ${quality} · generated ${count('done')} · refused ${count('refused')} · failed ${count('failed')}`
    + (count('auth') ? ' · STOPPED: the API key was rejected' : ''));
  for (const o of outcomes) if (o.status !== 'done') console.log(`  ${o.file}: ${o.status}${o.message ? ` — ${o.message}` : ''}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e: Error) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
