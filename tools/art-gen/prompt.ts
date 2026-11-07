import type { Brief, FighterBrief } from './brief.ts';

export const PILOT_FILES = ['idle_01', 'stand-heavy-kick_02', 'crouch_02'] as const;

const TRANSPARENT_RULE = 'Background: fully transparent, no background color at all.';
const SAME_CHARACTER = 'REFERENCE: This is the same character as in the attached reference image. '
  + 'Keep the face, hair, outfit, colors and body proportions exactly the same.';

function fighterOf(b: Brief, id: string): FighterBrief {
  const f = b.fighters[id];
  if (!f) throw new Error(`unknown fighter "${id}"`);
  return f;
}

const base = (file: string) => file.replace(/_\d{2}$/, '');

/** Every file to generate for a fighter, in the brief's work order (section 8), ending with the portrait. */
export function workOrder(b: Brief, fighter: string): string[] {
  const f = fighterOf(b, fighter);
  const firstMove = base(f.moves[0]!.file);
  const ordered = [
    ...b.starter.before,
    ...f.moves.filter((m) => base(m.file) === firstMove).map((m) => m.file),
    ...b.starter.after,
    ...b.frames.map((m) => m.file),
    ...f.moves.map((m) => m.file),
    'portrait',
  ];
  return [...new Set(ordered)];
}

function imageRules(b: Brief): string {
  return b.imageRules.map((r) => (r.startsWith('**Background:**') ? TRANSPARENT_RULE : r)).join(' ');
}

/** The exact prompt for one frame of one fighter (optionally with a reviewer's redo note). */
export function framePrompt(b: Brief, fighter: string, file: string, note?: string): string {
  const f = fighterOf(b, fighter);
  const lines = [`STYLE: ${b.style.join(' ')}`, `IMAGE RULES: ${imageRules(b)}`, SAME_CHARACTER, `CHARACTER: ${f.description}`];
  if (file === 'portrait') {
    lines.push(`PORTRAIT: ${b.special.portrait.join(' ')}`);
  } else {
    const entry = [...b.frames, ...f.moves].find((m) => m.file === file);
    if (!entry) throw new Error(`unknown file "${file}" for ${f.name}`);
    if (/-fx_\d{2}$/.test(file)) {
      lines.push(`EFFECT IMAGE: ${b.special.effect.join(' ')} Object: ${entry.pose}`);
    } else {
      const pose = file === 'intro_01' ? f.intro : file === 'win_01' ? f.win1 : file === 'win_02' ? f.win2 : entry.pose;
      lines.push(`BODY: ${f.body}`, `FLAVOR: ${f.flavor}`, `POSE (${file}): ${pose}`);
    }
  }
  if (note) lines.push(`REVIEWER NOTE: ${note}`);
  return lines.join('\n');
}

/** Prompt for a reference-sheet candidate (front and side views), drawn from the attached lineup picture. */
export function referencePrompt(b: Brief, fighter: string): string {
  const f = fighterOf(b, fighter);
  return [
    `STYLE: ${b.style.join(' ')}`,
    `REFERENCE SHEET: ${b.special.reference.join(' ')}`,
    'Use the attached picture as the design to follow.',
    `CHARACTER: ${f.description}`,
    `BODY: ${f.body}`,
    'Background: fully transparent.',
  ].join('\n');
}

export function sizeFor(file: string): '1024x1024' | '1536x1024' {
  return file.startsWith('reference') ? '1536x1024' : '1024x1024';
}
