import { readFileSync } from 'node:fs';

/** One image to make: its file name, what to draw, and the heading it is listed under. */
export interface Frame { file: string; pose: string; group: string }

export interface FighterBrief {
  id: string; name: string; background: string; description: string; body: string;
  flavor: string; intro: string; win1: string; win2: string; moves: Frame[];
}

/** docs/image-model-brief.md as data. */
export interface Brief {
  style: string[];
  imageRules: string[];
  frames: Frame[];
  fighters: Record<string, FighterBrief>;
  starter: { before: string[]; after: string[] };
  special: { reference: string[]; effect: string[]; portrait: string[] };
}

const fail = (what: string, where: string): never => { throw new Error(`image brief: missing ${what} in ${where}`); };

/** Splits on "## N. Title" headings, keyed by N. */
function sections(md: string): Map<number, string> {
  const out = new Map<number, string>();
  const parts = md.split(/^## (\d+)\. .*$/m);
  for (let i = 1; i < parts.length; i += 2) out.set(Number(parts[i]), parts[i + 1] ?? '');
  return out;
}

function section(all: Map<number, string>, n: number): string {
  return all.get(n) ?? fail(`section ${n}`, 'the brief');
}

/** Splits on "### Title" headings. */
function subsections(text: string): { title: string; body: string }[] {
  const parts = text.split(/^### (.*)$/m);
  const out: { title: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) out.push({ title: parts[i]!.trim(), body: parts[i + 1] ?? '' });
  return out;
}

const bullets = (text: string) => [...text.matchAll(/^- (.+)$/gm)].map((m) => m[1]!.trim());
const numbered = (text: string) => [...text.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1]!.trim());
const rows = (text: string, group: string): Frame[] =>
  [...text.matchAll(/^\| `([^`]+)` \| (.+?) \|\s*$/gm)].map((m) => ({ file: m[1]!, pose: m[2]!.trim(), group }));
const backticked = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);

function field(body: string, label: string, where: string): string {
  const m = body.match(new RegExp(`^- \\*\\*${label}:\\*\\* (.+)$`, 'm'));
  return m ? m[1]!.trim() : fail(label, where);
}

function parseFighter(title: string, body: string): FighterBrief {
  const folder = body.match(/^- \*\*Folder:\*\* `([^`]+)`/m)?.[1] ?? fail('Folder', title);
  const round = body.match(/^- \*\*Intro:\*\* (.+?) \*\*Win 1:\*\* (.+?) \*\*Win 2:\*\* (.+)$/m) ?? fail('Intro / Win 1 / Win 2', title);
  const moves = rows(body, 'Special moves and super');
  if (moves.length === 0) fail('move table', title);
  return {
    id: folder, name: title,
    background: field(body, 'Background', title),
    description: field(body, 'Character description', title),
    body: field(body, 'Body', title),
    flavor: field(body, 'Flavor notes', title),
    intro: round[1]!.trim(), win1: round[2]!.trim(), win2: round[3]!.trim(),
    moves,
  };
}

export function parseBrief(md: string): Brief {
  const all = sections(md);
  const style = bullets(section(all, 3));
  const imageRules = numbered(section(all, 4));
  if (style.length === 0) fail('style rules', 'section 3');
  if (!imageRules.some((r) => r.startsWith('**Background:**'))) fail('the Background rule', 'section 4');

  const frames = subsections(section(all, 5)).flatMap((s) => rows(s.body, s.title));
  if (frames.length === 0) fail('frame tables', 'section 5');

  const fighters: Record<string, FighterBrief> = {};
  for (const s of subsections(section(all, 6))) {
    const f = parseFighter(s.title, s.body);
    fighters[f.id] = f;
  }
  if (Object.keys(fighters).length === 0) fail('fighters', 'section 6');

  const types = subsections(section(all, 7));
  const typeBullets = (prefix: string) => bullets(types.find((t) => t.title.startsWith(prefix))?.body ?? fail(prefix, 'section 7'));
  const special = { reference: typeBullets('Reference sheet'), effect: typeBullets('Effect image'), portrait: typeBullets('Portrait') };

  const starterLine = numbered(section(all, 8)).find((l) => l.startsWith('**Starter set:**')) ?? fail('Starter set', 'section 8');
  const [beforeText, afterText] = starterLine.split('first special move');
  if (afterText === undefined) fail('"first special move" in the starter set', 'section 8');
  const starter = { before: backticked(beforeText!), after: backticked(afterText!) };

  return { style, imageRules, frames, fighters, starter, special };
}

export function loadBrief(path = 'docs/image-model-brief.md'): Brief {
  return parseBrief(readFileSync(path, 'utf8'));
}
