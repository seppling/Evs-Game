# M1: Playable Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser game where two players with gamepads (or one keyboard) play a full best-of-three match between Mohawk Man and Spin Kicker. The game has movement, jumping, all 18 normal attacks, blocking, hitstop, pushback, knockdowns, a timer, KOs and a HUD. Fighters are drawn as placeholder figures. It deploys to GitHub Pages.

**Architecture:** A pure, deterministic, integer-only simulation (`src/engine/`, `src/input/commands.ts`) is advanced at a fixed 60 ticks per second by a browser shell (`src/app/`). The shell polls devices (`src/input/devices.ts`) and draws state to a canvas (`src/render/`). Fighter behavior is data (`src/fighters/`) built from a shared normals template.

**Tech Stack:** TypeScript (strict), Vite, Vitest, Playwright `@playwright/test@1.63.0` (matches the pre-installed browsers), HTML5 Canvas 2D, Gamepad API, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-06-evs-game-design.md` (Milestone M1, section 16). Sections 5.1–5.4, 5.7, 7, 8, 10, 14 and 15 apply.

## Global Constraints

- **No runtime dependencies.** Dev dependencies only: `vite@^8.3.6`, `vitest@^5.1.0`, `typescript@^7.0.2` (if TS 7 breaks the toolchain, pin `typescript@~5.9` instead), `@playwright/test@1.63.0`.
- **The simulation is pure.** `src/engine/**` and `src/input/commands.ts` must not touch the DOM, `Date`, `performance` or `Math.random`.
  - Integers only. Positions and velocities are in **subunits**: `SUB = 100` per unit. Boxes are in whole units.
  - All state must survive `structuredClone` and JSON round-trips unchanged.
- **Timing:** a fixed 60 ticks per second, and at most **4 ticks per animation frame**.
- **Space:**
  - logical screen 1,280 × 720 units; stage 1,920 units wide
  - y is height above the ground (up is positive)
  - boxes are authored facing right, measured from the feet, and mirrored for facing left
- **Medium fighter height:** 300 units. Size scales: `small 0.8, medium 1, tall 1.05, big 1.15`.
- **Sprite names** follow `docs/image-model-brief.md`, e.g. `stand-heavy-kick_02`.
- **Vite `base: './'`**, so the build works under any GitHub Pages path.
- **Test commands:** `npm test` (Vitest), `npm run typecheck`, `npm run e2e` (Playwright, always with `--trace off`).
- **Out of scope for M1** (later milestones): throws, specials, projectiles, meter, stun and dizzy, cancels and chains, damage scaling, combo counter, Easy mode, menus and profiles, audio, real art, the CPU opponent.

## Review Focus

1. **Keys stuck after the window loses focus.** If a player alt-tabs while holding a key, that fighter must stop: every key is released on `blur`. (Test in Task 9.)
2. **Game keys scrolling the page.** Arrow keys, numpad and F1 must not scroll the page or trigger browser actions: `preventDefault` on every mapped key. (Test in Task 9.)
3. **Pressing left and right at once** (or a keyboard and a pad disagreeing) gives neutral, not a jittering direction. (Test in Task 9.)
4. **Jumping over the opponent (a cross-up).** After landing on the other side, both fighters turn around, so "back" means the new direction. In the corner, neither fighter is ever pushed outside the stage or inside the other. (Test in Task 5.)
5. **Laptop sleep or a long tab-away.** A huge time gap must not run thousands of ticks: at most 4 per frame. (Test in Task 11.)

---

## File structure

```
package.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html, .gitignore
.github/workflows/ci.yml          CI on every push; deploys to Pages from main
src/main.ts                       Boot: create App, expose window.__evs
src/app/clock.ts                  advanceClock: fixed-timestep accumulator
src/app/setup.ts                  parseSetup: ?p1=&p2=&time=&rounds= (dev/testing)
src/app/app.ts                    App: title / match / paused modes, the frame loop
src/input/types.ts                Button, BUTTONS, RawInput, NEUTRAL, btn()
src/input/commands.ts             PURE: InputState, pushInput, readCommand, clearPresses
src/input/devices.ts              Browser: readGamepad, readKeyboard, mergeInputs, Keyboard, PadAssigner, DeviceManager
src/engine/constants.ts           Every engine number (below)
src/engine/types.ts               Box, FighterDef, MoveDef, FighterState, MatchState, GameEvent, …
src/engine/geometry.ts            worldBox, overlaps, overlapCenter, arcY
src/engine/fighter.ts             createFighter, resetForRound, hurtboxes, currentFrame, isActionable, updateFighter
src/engine/space.ts               separate, applyPushback, faceEachOther, cameraX
src/engine/combat.ts              resolveHits
src/engine/tick.ts                tickFighters: one tick of both fighters
src/engine/match.ts               createMatch, DEFAULT_CONFIG
src/engine/step.ts                step(state, inputs, defs) → { state, events }
src/engine/validate.ts            validateFighter
src/fighters/defaults.ts          Normals template, standard boxes, buildFighter, normalMoveId
src/fighters/mohawk-man.ts        Mohawk Man stats
src/fighters/spin-kicker.ts       Spin Kicker stats
src/fighters/index.ts             FIGHTERS, FIGHTER_IDS, getFighter
src/render/viewport.ts            computeViewport
src/render/placeholder.ts         placeholderShapes
src/render/hud.ts                 announcerText, HealthTrail, drawHud
src/render/effects.ts             Effects: hit sparks and block flashes from events
src/render/renderer.ts            Renderer: stage, shadows, fighters, effects, HUD, debug overlay, title/pause screens
tests/unit/**.test.ts             Vitest
tests/unit/helpers.ts             raw(), fightPair(), tickN(), setAttack()
tests/e2e/smoke.spec.ts           Playwright
README.md                         How to play and develop
```

> **If the son's favorite fighter isn't Mohawk Man or Spin Kicker,** replace `spin-kicker.ts` with that fighter's stats (spec section 6). Nothing else changes.

---

### Task 1: Project scaffold and CI/deploy pipeline

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.ts`, `tests/unit/sanity.test.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces:
  - npm scripts: `dev` (`vite`), `build` (`vite build`), `preview` (`vite preview`), `test` (`vitest run`), `typecheck` (`tsc --noEmit`), `e2e` (`playwright test --trace off`)
  - `index.html` holds `<canvas id="game">` and loads `/src/main.ts`

- [ ] **Step 1: Write the configuration.**
  - `package.json`: `"type": "module"`, the scripts above, and the dev dependencies from Global Constraints.
  - `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `target ES2022`, `module ESNext`, `moduleResolution bundler`, `lib ["ES2022","DOM","DOM.Iterable"]`, `include ["src","tests","*.ts"]`, `noEmit`.
  - `vite.config.ts`: `base: './'`, `test.include: ['tests/unit/**/*.test.ts']`, `test.environment: 'node'`.
  - `index.html`: black page background; the canvas centered with flexbox; `<title>Evs-Game</title>`.
  - `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`, `art-src/`.
- [ ] **Step 2: Write the sanity test** `tests/unit/sanity.test.ts`: `expect(1 + 1).toBe(2)`.
- [ ] **Step 3: Write a temporary `src/main.ts`** that fills the canvas black and draws the text "Evs-Game". Task 11 replaces it.
- [ ] **Step 4: Install and verify.** Run `npm install && npm test && npm run typecheck && npm run build && grep -c './assets/' dist/index.html`.
  - Expected: 1 test passes, the typecheck is clean, the build succeeds, and grep prints `1` or more (relative asset paths).
- [ ] **Step 5: Write `.github/workflows/ci.yml`.**
  - Trigger on `push` (all branches) and `pull_request`.
  - Job `test`: `ubuntu-latest`, `actions/checkout@v4`, `actions/setup-node@v4` (node 22, npm cache), then `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `actions/upload-pages-artifact@v3` with `path: dist`.
  - Job `deploy`: `needs: test`, `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`, permissions `pages: write, id-token: write`, environment `github-pages`, steps `actions/deploy-pages@v4`.
  - Add a comment at the top: Pages must be set to "Source: GitHub Actions" in the repository settings.
- [ ] **Step 6: Commit.**
  ```bash
  git add -A && git commit -m "chore: scaffold Vite + TypeScript + Vitest project with CI and Pages deploy"
  ```

---

### Task 2: Engine constants, types and geometry

**Files:**
- Create: `src/input/types.ts`, `src/engine/constants.ts`, `src/engine/types.ts`, `src/engine/geometry.ts`
- Test: `tests/unit/engine/geometry.test.ts`

**Interfaces:**
- Produces, in `src/input/types.ts`:
  ```ts
  export const BUTTONS = ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'] as const;
  export type Button = (typeof BUTTONS)[number];
  export interface RawInput { x: -1 | 0 | 1; y: -1 | 0 | 1; buttons: number; start: boolean } // world-relative; y: 1 = up; buttons: bit i = BUTTONS[i]
  export const NEUTRAL: RawInput;              // { x: 0, y: 0, buttons: 0, start: false }
  export function btn(...names: Button[]): number;   // bitmask
  export function isDown(buttons: number, b: Button): boolean;
  export interface InputState { last: RawInput; presses: { button: Button; age: number }[] }
  ```
- Produces, in `src/engine/constants.ts`, exactly these values:
  ```ts
  TICKS_PER_SECOND = 60; SUB = 100; STAGE_WIDTH = 1920; CAMERA_WIDTH = 1280; CAMERA_HEIGHT = 720;
  CAMERA_MARGIN = 64; MAX_SEPARATION = (CAMERA_WIDTH - 2 * CAMERA_MARGIN) * SUB; START_SEPARATION = 300;
  BASE_HEIGHT = 300; SIZE_SCALE = { small: 0.8, medium: 1, tall: 1.05, big: 1.15 };
  PREJUMP_TICKS = 3; BUTTON_BUFFER_TICKS = 4; PROXIMITY_GUARD_RANGE = 250; PUSHBACK_TICKS = 8;
  KNOCKDOWN = { fallTicks: 24, fallHeight: 50, fallSpeed: 250, lieTicks: 40, getupTicks: 20 }; // fallSpeed in subunits/tick
  AIR_RESET = { ticks: 30, bump: 40, speed: 200 };
  ROUND_INTRO_TICKS = 120; KO_SLOWMO_TICKS = 90; KO_SLOWMO_FACTOR = 3; ROUND_END_TICKS = 150;
  ```
- Produces, in `src/engine/types.ts`:
  ```ts
  export type PlayerIndex = 0 | 1; export type Facing = 1 | -1;
  export interface Box { x: number; y: number; w: number; h: number }            // units
  export interface WorldBox { x1: number; y1: number; x2: number; y2: number }   // subunits
  export type Strength = 'light' | 'medium' | 'heavy'; export type HitLevel = 'mid' | 'low' | 'overhead';
  export type Stance = 'stand' | 'crouch' | 'air'; export type MoveId = string;
  export type MoveFlag = 'strikeInvuln' | 'throwInvuln' | 'projectileInvuln' | 'upperInvuln' | 'counter' | 'armor';
  export interface HitProps { damage: number; chip: number; stun: number; hitstun: number; blockstun: number;
    hitstop: number; pushback: number; level: HitLevel; knockdown: boolean; meterGain: number; strength: Strength }
  export interface MoveFrame { sprite: string; ticks: number; hurtboxes: Box[]; hitbox?: Box;
    velocity?: { x: number; y: number }; flags?: MoveFlag[] }
  export interface InputPattern { button: Button; stance: Stance }
  export interface MoveDef { input: InputPattern; frames: MoveFrame[]; hit: HitProps; cancels: ('special' | 'super' | 'chain')[] }
  export type FighterSize = 'small' | 'medium' | 'tall' | 'big';
  export interface FighterDef { id: string; name: string; size: FighterSize; health: number; stunLimit: number;
    walkForward: number; walkBack: number;                                   // subunits per tick
    jump: { height: number; duration: number; forwardSpeed: number };        // units, ticks, subunits/tick
    colors: { primary: string; secondary: string };
    pushbox: Box; airPushbox: Box; standingHurtboxes: Box[]; crouchingHurtboxes: Box[]; airHurtboxes: Box[];
    moves: Record<MoveId, MoveDef> }
  export type Defs = readonly [FighterDef, FighterDef];
  export type Action = 'intro' | 'idle' | 'walkForward' | 'walkBack' | 'crouch' | 'guard' | 'prejump' | 'air'
    | 'attack' | 'hitstun' | 'blockstun' | 'knockdown' | 'down' | 'getup' | 'airReset' | 'win' | 'lose';
  export interface Arc { t: number; duration: number; height: number; startY: number; vx: number } // height units; startY subunits; vx subunits/tick
  export interface FighterState { id: string; x: number; y: number; facing: Facing; action: Action; actionTick: number;
    moveId: MoveId | null; hasHit: boolean; airAttackUsed: boolean; jumpDir: -1 | 0 | 1; arc: Arc | null;
    crouching: boolean; stunTicks: number; hitstop: number; push: { perTick: number; ticks: number } | null;
    health: number; ko: boolean; roundsWon: number; input: InputState }
  export type Phase = 'intro' | 'fight' | 'ko' | 'roundEnd' | 'matchEnd';
  export type RoundResult = PlayerIndex | 'draw';
  export interface MatchConfig { roundsToWin: number; roundSeconds: number | null }
  export interface MatchState { tick: number; phase: Phase; phaseTick: number; round: number; roundsPlayed: number;
    timer: number | null; timerTicks: number; roundResult: RoundResult | null;
    roundEndReason: 'ko' | 'doubleKo' | 'time' | null; perfect: boolean; matchWinner: RoundResult | null;
    fighters: [FighterState, FighterState]; config: MatchConfig }
  export type GameEvent =
    | { type: 'hit'; attacker: PlayerIndex; strength: Strength; x: number; y: number; damage: number }
    | { type: 'block'; attacker: PlayerIndex; strength: Strength; x: number; y: number }
    | { type: 'swing'; player: PlayerIndex; strength: Strength }
    | { type: 'jump' | 'land' | 'knockdown'; player: PlayerIndex }
    | { type: 'roundStart'; round: number } | { type: 'fight' } | { type: 'ko'; player: PlayerIndex } | { type: 'timeUp' }
    | { type: 'roundOver'; result: RoundResult } | { type: 'matchOver'; winner: RoundResult };
  ```
  `engine/types.ts` imports `InputState` and `Button` from `src/input/types.ts`, using `import type`.
- Produces, in `src/engine/geometry.ts`:
  ```ts
  export function worldBox(box: Box, x: number, y: number, facing: Facing): WorldBox; // mirror: facing -1 → x1 = x - (box.x + box.w)*SUB
  export function overlaps(a: WorldBox, b: WorldBox): boolean;                        // touching edges do NOT overlap
  export function overlapCenter(a: WorldBox, b: WorldBox): { x: number; y: number };  // integer (Math.trunc)
  export function arcY(arc: Arc): number; // Math.trunc(startY*(d-t)/d) + Math.trunc(4*height*SUB*t*(d-t)/(d*d))
  ```

- [ ] **Step 1: Write the failing tests** in `tests/unit/engine/geometry.test.ts`:
  ```ts
  test('worldBox facing right offsets by position', () =>
    expect(worldBox({ x: 30, y: 200, w: 70, h: 30 }, 90000, 0, 1)).toEqual({ x1: 93000, y1: 20000, x2: 100000, y2: 23000 }));
  test('worldBox facing left mirrors around the feet', () =>
    expect(worldBox({ x: 30, y: 200, w: 70, h: 30 }, 90000, 0, -1)).toEqual({ x1: 80000, y1: 20000, x2: 87000, y2: 23000 }));
  test('worldBox adds y position', () => expect(worldBox({ x: 0, y: 10, w: 1, h: 1 }, 0, 500, 1).y1).toBe(1500));
  test('overlaps: touching edges do not overlap', () => {
    expect(overlaps({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 10, y1: 0, x2: 20, y2: 10 })).toBe(false);
    expect(overlaps({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 9, y1: 9, x2: 20, y2: 20 })).toBe(true);
  });
  test('overlapCenter is the middle of the intersection', () =>
    expect(overlapCenter({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 5, y1: 2, x2: 20, y2: 8 })).toEqual({ x: 7, y: 5 }));
  test('arcY: a jump from the ground peaks at height and lands at 0', () => {
    const arc = { t: 0, duration: 44, height: 220, startY: 0, vx: 0 };
    expect(arcY({ ...arc, t: 22 })).toBe(22000); expect(arcY({ ...arc, t: 44 })).toBe(0); expect(arcY({ ...arc, t: 0 })).toBe(0);
  });
  test('arcY: a fall from a height ends at 0', () =>
    expect(arcY({ t: 30, duration: 30, height: 40, startY: 15000, vx: 0 })).toBe(0));
  test('btn builds a bitmask', () => { expect(btn('LP')).toBe(1); expect(isDown(btn('MP', 'HK'), 'HK')).toBe(true); });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/geometry.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the three files with the interfaces above.
- [ ] **Step 4: Run** `npx vitest run tests/unit/engine/geometry.test.ts && npm run typecheck`. Expected: PASS, clean.
- [ ] **Step 5: Commit.** `git commit -am "feat(engine): add constants, core types and geometry"` (add the new files first).

---

### Task 3: Input commands (pure)

**Files:**
- Create: `src/input/commands.ts`
- Test: `tests/unit/input/commands.test.ts`

**Interfaces:**
- Consumes: `RawInput`, `Button`, `InputState`, `NEUTRAL`, `btn` (Task 2), and `BUTTON_BUFFER_TICKS`.
- Produces:
  ```ts
  export interface Command { forward: boolean; back: boolean; up: boolean; down: boolean; press: Button | null }
  export const PRESS_PRIORITY: readonly Button[] = ['HP', 'HK', 'MP', 'MK', 'LP', 'LK'];
  export function emptyInputState(): InputState;
  export function pushInput(s: InputState, raw: RawInput): void;   // mutates: ages presses +1, drops age >= BUTTON_BUFFER_TICKS, adds new presses at age 0, sets last
  export function readCommand(s: InputState, facing: Facing): Command; // directions from s.last, relative to facing; press = highest PRESS_PRIORITY among buffered presses
  export function clearPresses(s: InputState): void;               // called when an attack starts
  ```

- [ ] **Step 1: Write the failing tests:**
  ```ts
  const R = (x: -1|0|1, y: -1|0|1, ...b: Button[]) => ({ x, y, buttons: btn(...b), start: false });
  test('a newly pressed button is a press; holding it is not a new press', () => {
    const s = emptyInputState(); pushInput(s, R(0, 0, 'LP'));
    expect(readCommand(s, 1).press).toBe('LP'); clearPresses(s);
    pushInput(s, R(0, 0, 'LP')); expect(readCommand(s, 1).press).toBeNull();
  });
  test('a press stays buffered for 4 ticks, then expires', () => {
    const s = emptyInputState(); pushInput(s, R(0, 0, 'MK'));
    for (let i = 0; i < 3; i++) pushInput(s, NEUTRAL);
    expect(readCommand(s, 1).press).toBe('MK');           // age 3
    pushInput(s, NEUTRAL); expect(readCommand(s, 1).press).toBeNull(); // age 4
  });
  test('heavier buttons win when several are buffered', () => {
    const s = emptyInputState(); pushInput(s, R(0, 0, 'LP', 'HK', 'MP')); expect(readCommand(s, 1).press).toBe('HK');
  });
  test('directions are relative to facing', () => {
    const s = emptyInputState(); pushInput(s, R(1, -1));
    expect(readCommand(s, 1)).toMatchObject({ forward: true, back: false, down: true, up: false });
    expect(readCommand(s, -1)).toMatchObject({ forward: false, back: true, down: true });
  });
  test('state survives a JSON round-trip', () => {
    const s = emptyInputState(); pushInput(s, R(1, 1, 'HP'));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/input/commands.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/input/commands.ts` per the interfaces.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(input): add pure input buffer and command reading"`

---

### Task 4: Fighter data: normals template, two fighters, validation

**Files:**
- Create: `src/fighters/defaults.ts`, `src/fighters/mohawk-man.ts`, `src/fighters/spin-kicker.ts`, `src/fighters/index.ts`, `src/engine/validate.ts`
- Test: `tests/unit/fighters/fighters.test.ts`

**Interfaces:**
- Consumes: types and constants (Task 2).
- Produces:
  ```ts
  // defaults.ts
  export type FighterBase = Omit<FighterDef, 'pushbox' | 'airPushbox' | 'standingHurtboxes' | 'crouchingHurtboxes' | 'airHurtboxes' | 'moves'>;
  export function normalMoveId(stance: Stance, button: Button): MoveId; // 'stand-lp', 'crouch-hk', 'jump-mp'
  export function buildFighter(base: FighterBase, overrides?: Record<MoveId, MoveDef>): FighterDef; // template boxes × SIZE_SCALE[size], Math.round on x,y,w,h
  // index.ts
  export const FIGHTERS: Readonly<Record<string, FighterDef>>; export const FIGHTER_IDS: readonly string[]; // ['mohawk-man','spin-kicker']
  export function getFighter(id: string): FighterDef | undefined;
  // validate.ts
  export function validateFighter(def: FighterDef): string[]; // [] when valid; one readable message per problem
  ```

**Template boxes (medium size, units):**

| Box | Value |
|---|---|
| pushbox | `{x:-30,y:0,w:60,h:260}` |
| airPushbox | `{x:-20,y:150,w:40,h:110}` (high and narrow, so a forward jump from close range can pass over the opponent) |
| standing hurtboxes | `{x:-35,y:0,w:70,h:240}`, `{x:-25,y:240,w:50,h:60}` |
| crouching hurtboxes | `{x:-40,y:0,w:80,h:150}`, `{x:-25,y:150,w:50,h:45}` |
| air hurtboxes | `{x:-35,y:30,w:70,h:170}`, `{x:-25,y:200,w:50,h:50}` |

**Normals template.** Every move has 3 frames: startup (no hitbox), active (hitbox), recovery.
- Every frame's hurtboxes are the stance hurtboxes. Active and recovery frames also get a **limb hurtbox** `{x: hb.x, y: hb.y, w: hb.w - 15, h: hb.h}`.
- `chip: 0` for every normal. `meterGain`: 40 light, 60 medium, 80 heavy. `cancels: []`.

| Strength | Ground S/A/R | Jump S/A/R | Damage | Stun | Ground hitstun/blockstun | Jump hitstun/blockstun | Hitstop | Pushback (ground/jump) |
|---|---|---|---|---|---|---|---|---|
| light | 4/2/6 | 4/8/6 | 30 | 30 | 12/9 | 14/10 | 8 | 25/20 |
| medium | 6/3/12 | 6/6/10 | 60 | 60 | 18/14 | 18/14 | 10 | 35/30 |
| heavy | 9/4/20 | 8/6/14 | 100 | 100 | 25/20 | 22/18 | 12 | 50/40 |

| Move | Hitbox (medium) | Level | Knockdown | Sprite base |
|---|---|---|---|---|
| stand-lp | `{30,220,70,30}` | mid | no | `stand-light-punch` |
| stand-mp | `{30,180,85,35}` | mid | no | `stand-medium-punch` |
| stand-hp | `{30,190,95,45}` | mid | no | `stand-heavy-punch` |
| stand-lk | `{20,60,75,30}` | mid | no | `stand-light-kick` |
| stand-mk | `{25,120,95,35}` | mid | no | `stand-medium-kick` |
| stand-hk | `{25,210,105,45}` | mid | no | `stand-heavy-kick` |
| crouch-lp | `{30,120,70,30}` | mid | no | `crouch-light-punch` |
| crouch-mp | `{30,110,85,35}` | mid | no | `crouch-medium-punch` |
| crouch-hp | `{10,150,60,140}` | mid | no | `crouch-heavy-punch` |
| crouch-lk | `{25,0,85,30}` | low | no | `crouch-light-kick` |
| crouch-mk | `{25,0,110,30}` | low | no | `crouch-medium-kick` |
| crouch-hk | `{25,0,120,35}` | low | **yes** | `crouch-heavy-kick` |
| jump-lp, jump-mp | `{20,60,70,50}` | overhead | no | `jump-punch` |
| jump-hp | `{10,40,80,70}` | overhead | no | `jump-heavy-punch` |
| jump-lk, jump-mk | `{15,0,85,50}` | overhead | no | `jump-kick` |
| jump-hk | `{10,-10,100,60}` | overhead | no | `jump-heavy-kick` |

**Sprites:** startup `_01`, active `_02`, recovery `_03` for ground heavies, otherwise `_01`.

**Fighter stats:**

| | size | health | stunLimit | walkForward | walkBack | jump (height, duration, forwardSpeed) | colors |
|---|---|---|---|---|---|---|---|
| Mohawk Man | tall | 1000 | 500 | 350 | 280 | 220, 44, 400 | primary `#f5f5f0`, secondary `#e53935` |
| Spin Kicker | medium | 950 | 500 | 450 | 350 | 230, 40, 480 | primary `#7e3fbf`, secondary `#c0c0c8` |

**`validateFighter` rules** (each failure adds one message naming the fighter and the move):
- `id` matches `/^[a-z0-9]+(-[a-z0-9]+)*$/`
- `health`, `stunLimit`, both walk speeds, `jump.height` and `jump.duration` are positive integers
- all 18 normals exist (`normalMoveId` over 3 stances × 6 buttons)
- every move has at least one frame, and every `frame.ticks` is a positive integer
- every move has at least one frame with a hitbox
- every box has `w > 0` and `h > 0`
- every sprite matches `/^[a-z0-9-]+_\d{2}$/`
- `hit.damage >= 0`

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test.each(FIGHTER_IDS)('%s is valid', (id) => expect(validateFighter(getFighter(id)!)).toEqual([]));
  test('normalMoveId', () => { expect(normalMoveId('crouch', 'HK')).toBe('crouch-hk'); expect(normalMoveId('air', 'MP')).toBe('jump-mp'); });
  test('tall fighters get scaled boxes', () => expect(getFighter('mohawk-man')!.standingHurtboxes[1]).toEqual({ x: -26, y: 252, w: 53, h: 63 }));
  test('stand-hk frame data and sprites', () => {
    const m = getFighter('spin-kicker')!.moves['stand-hk']!;
    expect(m.frames.map((f) => f.ticks)).toEqual([9, 4, 20]);
    expect(m.frames.map((f) => f.sprite)).toEqual(['stand-heavy-kick_01', 'stand-heavy-kick_02', 'stand-heavy-kick_03']);
    expect(m.hit).toMatchObject({ damage: 100, hitstun: 25, blockstun: 20, hitstop: 12, pushback: 50, level: 'mid', strength: 'heavy' });
  });
  test('the sweep is low and knocks down', () => expect(getFighter('spin-kicker')!.moves['crouch-hk']!.hit).toMatchObject({ level: 'low', knockdown: true }));
  test('jump attacks are overheads sharing sprites', () =>
    expect(getFighter('spin-kicker')!.moves['jump-lp']!.frames[1]!.sprite).toBe('jump-punch_02'));
  test('validateFighter reports a missing normal and a zero-tick frame', () => {
    const def = structuredClone(getFighter('spin-kicker')!); delete def.moves['stand-lp']; def.moves['stand-mp']!.frames[0]!.ticks = 0;
    const errors = validateFighter(def);
    expect(errors.some((e) => e.includes('stand-lp'))).toBe(true); expect(errors.some((e) => e.includes('stand-mp'))).toBe(true);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/fighters`. Expected: FAIL.
- [ ] **Step 3: Implement** the template in `defaults.ts`, the two stat files, `index.ts` and `validate.ts`.
- [ ] **Step 4: Run** `npx vitest run tests/unit/fighters && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(fighters): add normals template, Mohawk Man, Spin Kicker and validation"`

---

### Task 5: Movement, jumping and spacing

**Files:**
- Create: `src/engine/fighter.ts`, `src/engine/space.ts`, `src/engine/tick.ts`, `tests/unit/helpers.ts`
- Test: `tests/unit/engine/movement.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
  ```ts
  // fighter.ts
  export function createFighter(def: FighterDef, x: number, facing: Facing): FighterState; // x in subunits; action 'idle'
  export function resetForRound(f: FighterState, def: FighterDef, x: number, facing: Facing): void; // keeps roundsWon; action 'intro'; fresh input
  export function currentFrame(f: FighterState, def: FighterDef): MoveFrame | null;  // when action === 'attack'
  export function hurtboxes(f: FighterState, def: FighterDef): Box[];
    // attack → frame.hurtboxes; crouch, or guard/hitstun/blockstun with crouching → crouchingHurtboxes;
    // air → airHurtboxes; knockdown/down/getup/airReset/intro/win/lose → [] (invulnerable); otherwise (incl. prejump) standingHurtboxes
  export function isActionable(f: FighterState): boolean;  // idle | walkForward | walkBack | crouch | guard
  export function updateFighter(f: FighterState, def: FighterDef, opp: FighterState, oppDef: FighterDef,
    me: PlayerIndex, active: boolean, events: GameEvent[]): void;
  // space.ts
  export function separate(fs: [FighterState, FighterState], defs: Defs, prevX: [number, number]): void;
  export function applyPushback(fs: [FighterState, FighterState], defs: Defs): void;   // Task 7 fills in
  export function faceEachOther(fs: [FighterState, FighterState]): void;
  export function stageBounds(def: FighterDef): { min: number; max: number };
    // half = max(-pushbox.x, pushbox.x + pushbox.w) units (rounding makes boxes slightly lopsided); min = half*SUB, max = (STAGE_WIDTH - half)*SUB
  export function cameraX(fs: readonly [FighterState, FighterState]): number;          // units, left edge, clamped to [0, STAGE_WIDTH - CAMERA_WIDTH]
  // tick.ts
  export function tickFighters(fs: [FighterState, FighterState], inputs: readonly [RawInput, RawInput],
    defs: Defs, active: boolean, events: GameEvent[]): void;
    // order: pushInput ×2 → record prevX → updateFighter ×2 → applyPushback → separate → (Task 7: resolveHits when active) → faceEachOther
  // tests/unit/helpers.ts
  export function raw(dir?: number, ...buttons: Button[]): RawInput;  // numpad notation, world-relative: 1↙ 2↓ 3↘ 4← 5 neutral 6→ 7↖ 8↑ 9↗
  export function fightPair(p1?: string, p2?: string, p1x?: number, p2x?: number): { fs: [FighterState, FighterState]; defs: Defs }; // defaults mohawk-man, spin-kicker, 810, 1110 (units)
  export function tickN(ctx: { fs: [FighterState, FighterState]; defs: Defs }, n: number, p1?: RawInput, p2?: RawInput): GameEvent[];
  export function setAttack(f: FighterState, moveId: MoveId, actionTick: number): void; // action 'attack', moveId, actionTick, hasHit false
  export const DEFS: Defs; // [mohawk-man, spin-kicker]
  ```

**`updateFighter` behavior for one tick:**
1. If `hitstop > 0`: decrement it and return.
2. Advance the current action:
   - `actionTick++`.
   - Arc physics: `arc.t++`, `y = arcY(arc)`, `x += arc.vx`. When `arc.t >= arc.duration`: `y = 0`, `arc = null`, and landing happens.
     - From `air` or an air `attack`: become `idle`, `airAttackUsed = false`, emit `land`.
     - From `airReset`: become `idle`.
     - From `knockdown`: become `down`.
   - `prejump`: after `PREJUMP_TICKS`, become `air` with arc `{t:0, duration: jump.duration, height: jump.height, startY: 0, vx: jumpDir*facing*jump.forwardSpeed}`, and emit `jump`.
3. If actionable, and `active` is true, decide from `readCommand(f.input, f.facing)` in this order:
   - (Task 6: a press → attack.)
   - up → `prejump`, with `jumpDir` +1 forward, −1 back, 0 otherwise.
   - down → `crouch`.
   - (Task 7: guard.)
   - forward → `walkForward` (`x += walkForward*facing`).
   - back → `walkBack` (`x -= walkBack*facing`).
   - otherwise `idle`.
   - Changing action resets `actionTick` to 0.
   - If `active` is false, an actionable fighter becomes `idle`.

**`separate`:**
1. Clamp each `x` to `stageBounds`.
2. If the separation is over `MAX_SEPARATION`, move back each fighter that moved away from the other this tick (compared with `prevX`, P1 first) until the separation equals `MAX_SEPARATION`.
3. Push boxes: use `airPushbox` when airborne (`y > 0`) and `pushbox` otherwise. If the world boxes overlap, push the fighters apart by the overlap: P1 gets `ceil(ov/2)`, P2 `floor(ov/2)`.
   - A fighter at its stage bound doesn't move, and the other takes the full amount.
   - If both have the same x, P1 goes left if facing 1, otherwise right.
4. Re-clamp to the stage bounds.

**`faceEachOther`:** each fighter that is grounded and actionable sets `facing = sign(opp.x - x)`, unless the two x values are equal.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('walk forward and back use the fighter speeds', () => {
    const c = fightPair(); const x0 = c.fs[0].x;
    tickN(c, 10, raw(6)); expect(c.fs[0].x).toBe(x0 + 3500);
    tickN(c, 10, raw(4)); expect(c.fs[0].x).toBe(x0 + 3500 - 2800);
  });
  test('crouch holds position and returns to idle', () => {
    const c = fightPair(); const x0 = c.fs[0].x; tickN(c, 5, raw(2));
    expect(c.fs[0]).toMatchObject({ action: 'crouch', x: x0 }); tickN(c, 1); expect(c.fs[0].action).toBe('idle');
  });
  test('neutral jump: 3-tick prejump, apex at mid-flight, lands idle', () => {
    const c = fightPair(); tickN(c, 1, raw(8)); expect(c.fs[0].action).toBe('prejump');
    tickN(c, 2); tickN(c, 1); expect(c.fs[0].action).toBe('air');
    tickN(c, 22); expect(c.fs[0].y).toBe(22000);
    const ev = tickN(c, 22); expect(c.fs[0]).toMatchObject({ y: 0, action: 'idle' }); expect(ev).toContainEqual({ type: 'land', player: 0 });
  });
  test('forward jump travels duration × forwardSpeed', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 500, 1400); const x0 = c.fs[0].x;
    tickN(c, 1, raw(9)); tickN(c, 3 + 44); expect(c.fs[0].x).toBe(x0 + 44 * 400);
  });
  test('fighters never overlap when walking into each other', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 1000); tickN(c, 120, raw(6), raw(4));
    expect(Math.abs(c.fs[1].x - c.fs[0].x)).toBeGreaterThanOrEqual((32 + 30) * 100);
  });
  test('walking back stops at the stage edge and at max separation', () => {
    const c = fightPair(); tickN(c, 600, raw(4), raw(6));
    expect(c.fs[0].x).toBeGreaterThanOrEqual(stageBounds(c.defs[0]).min);
    expect(c.fs[1].x - c.fs[0].x).toBeLessThanOrEqual(MAX_SEPARATION);
  });
  test('REVIEW FOCUS: cross-up — after jumping over, both turn around', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 1000); tickN(c, 1, raw(9)); tickN(c, 60);
    expect(c.fs[0].x).toBeGreaterThan(c.fs[1].x); expect(c.fs[0].facing).toBe(-1); expect(c.fs[1].facing).toBe(1);
  });
  test('REVIEW FOCUS: corner — nobody leaves the stage or ends up inside the other', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 1700, 1890); tickN(c, 120, raw(6), raw(6));
    expect(c.fs[1].x).toBeLessThanOrEqual(stageBounds(c.defs[1]).max);
    expect(c.fs[1].x - c.fs[0].x).toBeGreaterThanOrEqual((32 + 30) * 100);
  });
  test('cameraX centers on the midpoint and clamps', () => {
    expect(cameraX(fightPair('mohawk-man', 'spin-kicker', 900, 1100).fs)).toBe(360);
    expect(cameraX(fightPair('mohawk-man', 'spin-kicker', 40, 300).fs)).toBe(0);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/movement.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `fighter.ts`, `space.ts` (`applyPushback` as a no-op for now), `tick.ts` and `helpers.ts`.
- [ ] **Step 4: Run** the same command plus `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(engine): add movement, jumping, push boxes, stage bounds and facing"`

---

### Task 6: Normal attacks

**Files:**
- Modify: `src/engine/fighter.ts`
- Test: `tests/unit/engine/attacks.test.ts`

**Interfaces:**
- Consumes: `normalMoveId` (Task 4), `clearPresses` (Task 3), `currentFrame` (Task 5).
- Produces: attack decision and execution inside `updateFighter`, plus:
  ```ts
  export function activeHitbox(f: FighterState, def: FighterDef): Box | null; // hitbox of the current frame, or null
  export function moveTotalTicks(m: MoveDef): number;
  ```

**Rules:**
- **Starting an attack:** an actionable fighter on the ground with `cmd.press` starts `normalMoveId(cmd.down ? 'crouch' : 'stand', press)`. A fighter in `air` with `!airAttackUsed` starts `normalMoveId('air', press)` and sets `airAttackUsed`. Starting an attack sets `action 'attack'`, `moveId`, `actionTick 0`, `hasHit false`, and calls `clearPresses`. Any other action keeps the buffered press for later.
- **Running it:** frame *k* covers `actionTick` values `[cum_k, cum_k + ticks_k)`. Emit `swing` when `actionTick === ` the first active frame's start.
- **Ending it:** when `actionTick >= moveTotalTicks`, a grounded fighter becomes `idle`, and the decision step runs **in the same tick** (so a buffered press comes out on that tick). An airborne fighter returns to `air`. Landing while in an air attack ends it.
- **No movement:** walking input is ignored during attacks.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('stand LP: 4 startup, 2 active, 6 recovery, then idle', () => {
    const c = fightPair(); tickN(c, 1, raw(5, 'LP'));
    expect(c.fs[0]).toMatchObject({ action: 'attack', moveId: 'stand-lp', actionTick: 0 });
    tickN(c, 3); expect(activeHitbox(c.fs[0], c.defs[0])).toBeNull();
    const ev = tickN(c, 1); expect(activeHitbox(c.fs[0], c.defs[0])).not.toBeNull(); expect(ev).toContainEqual({ type: 'swing', player: 0, strength: 'light' });
    tickN(c, 2); expect(activeHitbox(c.fs[0], c.defs[0])).toBeNull();
    tickN(c, 5); expect(c.fs[0].action).toBe('attack'); tickN(c, 1); expect(c.fs[0].action).toBe('idle');
  });
  test('down or down-forward + HK is the sweep', () => {
    const c = fightPair(); tickN(c, 1, raw(3, 'HK')); expect(c.fs[0].moveId).toBe('crouch-hk');
  });
  test('one air attack per jump; landing ends it', () => {
    const c = fightPair(); tickN(c, 1, raw(8)); tickN(c, 10); tickN(c, 1, raw(5, 'MK'));
    expect(c.fs[0].moveId).toBe('jump-mk'); tickN(c, 25); tickN(c, 1, raw(5, 'HK'));
    expect(c.fs[0].moveId).not.toBe('jump-hk'); tickN(c, 20); expect(c.fs[0].action).toBe('idle');
  });
  test('attacks do not move the fighter', () => {
    const c = fightPair(); const x0 = c.fs[0].x; tickN(c, 1, raw(6, 'HP')); tickN(c, 10, raw(6)); expect(c.fs[0].x).toBe(x0);
  });
  test('a press up to 3 ticks before recovery ends comes out on the first free tick', () => {
    const c = fightPair(); tickN(c, 1, raw(5, 'LP')); tickN(c, 10); tickN(c, 1, raw(5, 'MP')); tickN(c, 1);
    expect(c.fs[0]).toMatchObject({ moveId: 'stand-mp', actionTick: 0 });
  });
  test('a press 5 ticks before recovery ends is dropped', () => {
    const c = fightPair(); tickN(c, 1, raw(5, 'LP')); tickN(c, 6); tickN(c, 1, raw(5, 'MP')); tickN(c, 5);
    expect(c.fs[0].action).toBe('idle');
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/attacks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the rules in `fighter.ts`.
- [ ] **Step 4: Run** `npx vitest run tests/unit/engine && npm run typecheck`. Expected: PASS (including the Task 5 tests).
- [ ] **Step 5: Commit.** `git commit -m "feat(engine): add normal attacks with frame timing and press buffering"`

---

### Task 7: Hits, blocking, hitstop, pushback and knockdown

**Files:**
- Create: `src/engine/combat.ts`
- Modify: `src/engine/fighter.ts` (guard, stun timers, knockdown sequence), `src/engine/space.ts` (`applyPushback`), `src/engine/tick.ts` (call `resolveHits` when `active`)
- Test: `tests/unit/engine/combat.test.ts`

**Interfaces:**
- Produces: `export function resolveHits(fs: [FighterState, FighterState], defs: Defs, events: GameEvent[]): void`

**Rules (spec 5.3, 5.4, 5.7):**
- **Detecting hits:**
  - For each attacker with `activeHitbox`, `!hasHit` and `hitstop === 0`, test its world hitbox against the defender's world `hurtboxes`.
  - **Collect both directions before applying anything**, so trades hit both fighters.
  - On contact, set `attacker.hasHit = true`, and set both fighters' `hitstop = hit.hitstop`.
- **Blocking:** the defender blocks when:
  - their action is one of `idle | walkForward | walkBack | crouch | guard | blockstun`
  - they're grounded (`arc === null`, `y === 0`)
  - `readCommand(defender.input, defender.facing).back` is true
  - and the stance fits the level: stance is crouch if `cmd.down`, otherwise stand; `low` needs crouch, `overhead` needs stand, `mid` accepts either
- **On block:** `action 'blockstun'`, `stunTicks = blockstun`, `crouching` set from the stance, no damage, pushback, and a `block` event at `overlapCenter`.
- **On hit:**
  - `health -= damage`, then a `hit` event at `overlapCenter`.
  - **Grounded, no knockdown:** `hitstun` with `stunTicks = hitstun`. `crouching` is true if the defender was crouching (action `crouch`, or `crouching` already set), then pushback.
  - **Knockdown move, or the defender is airborne with a knockdown move:** knockdown.
  - **Airborne with any other move:** `airReset` with arc `{t:0, duration: AIR_RESET.ticks, height: AIR_RESET.bump, startY: y, vx: away*AIR_RESET.speed}`.
  - **`health <= 0`:** `health = 0`, `ko = true`, then knockdown.
- **Knockdown:** `action 'knockdown'` with arc `{t:0, duration: KNOCKDOWN.fallTicks, height: KNOCKDOWN.fallHeight, startY: y, vx: away*KNOCKDOWN.fallSpeed}`, where `away = sign(defender.x - attacker.x)`. Emit a `knockdown` event.
  - On landing: `down` for `lieTicks`, then `getup` for `getupTicks`, then `idle`.
  - A fighter with `ko` stays `down`.
  - There are no hurtboxes during any of these.
- **Stun timers:** `hitstun` and `blockstun` count `stunTicks` down after hitstop ends. At 0 the fighter becomes `idle`, and the decision step runs that same tick.
- **Pushback:** the defender gets `push = { perTick: away*Math.trunc(pushback*SUB/PUSHBACK_TICKS), ticks: PUSHBACK_TICKS }`. `applyPushback` moves each non-hitstop fighter with `push` by `perTick` and decrements `ticks`. If the stage bound or max separation blocks the defender, the blocked remainder moves the attacker the opposite way.
- **Proximity guard:** in the decision step, checked after a press and `up` but **before** `down` and walking: if `cmd.back` is held, the opponent is in `attack` on a startup or active frame, and `|dx| <= PROXIMITY_GUARD_RANGE*SUB`, the fighter enters `guard` (no movement, `crouching = cmd.down`) instead of walking back or crouching.

- [ ] **Step 1: Write the failing tests** (`close()` is `fightPair('mohawk-man','spin-kicker',900,980)`):
  ```ts
  const press = (c, dir, b, p2 = raw()) => tickN(c, 1, raw(dir, b), p2);
  test('stand LP hits: damage, hitstop on both, then 12 ticks hitstun', () => {
    const c = close(); press(c, 5, 'LP'); const ev = tickN(c, 4);
    expect(ev.find((e) => e.type === 'hit')).toMatchObject({ attacker: 0, damage: 30 });
    expect(c.fs[1]).toMatchObject({ health: 920, action: 'hitstun', hitstop: 8 }); expect(c.fs[0].hitstop).toBe(8);
    const at = c.fs[0].actionTick; tickN(c, 8); expect(c.fs[0].actionTick).toBe(at);
    tickN(c, 11); expect(c.fs[1].action).toBe('hitstun'); tickN(c, 1); expect(c.fs[1].action).toBe('idle');
  });
  test('one hit per move activation', () => { const c = close(); press(c, 5, 'LP'); tickN(c, 20); expect(c.fs[1].health).toBe(920); });
  test('holding back blocks a mid standing and crouching', () => {
    for (const dir of [6, 3]) { const c = close(); press(c, 5, 'MP', raw(dir)); const ev = tickN(c, 6, raw(), raw(dir));
      expect(ev.some((e) => e.type === 'block')).toBe(true); expect(c.fs[1]).toMatchObject({ health: 950, action: 'blockstun' }); }
  });
  test('lows must be blocked crouching', () => {
    const a = close(); press(a, 2, 'MK', raw(6)); tickN(a, 7, raw(2), raw(6)); expect(a.fs[1].health).toBe(890);
    const b = close(); press(b, 2, 'MK', raw(3)); tickN(b, 7, raw(2), raw(3)); expect(b.fs[1].health).toBe(950);
  });
  test('overheads must be blocked standing', () => {
    for (const [dir, hp] of [[3, 850], [6, 950]] as const) { const c = close();
      setAttack(c.fs[0], 'jump-hk', 8); c.fs[0].arc = { t: 39, duration: 44, height: 220, startY: 0, vx: 0 }; c.fs[0].y = arcY(c.fs[0].arc);
      tickN(c, 1, raw(), raw(dir)); tickN(c, 1, raw(), raw(dir)); expect(c.fs[1].health).toBe(hp); }
  });
  test('pushback slides the defender back over 8 ticks', () => {
    const c = close(); press(c, 5, 'LP'); tickN(c, 4); const x = c.fs[1].x; tickN(c, 8 + 8);
    expect(c.fs[1].x - x).toBe(8 * Math.trunc(2500 / 8));
  });
  test('in the corner the attacker is pushed back instead', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 1810, 1890); const x0 = c.fs[0].x, x1 = c.fs[1].x;
    press(c, 5, 'LP'); tickN(c, 4 + 8 + 8); expect(c.fs[1].x).toBe(x1); expect(x0 - c.fs[0].x).toBe(8 * Math.trunc(2500 / 8));
  });
  test('sweep knocks down: fall, lie, invulnerable get-up, idle', () => {
    const c = close(); press(c, 2, 'HK'); const ev = tickN(c, 9);
    expect(ev).toContainEqual({ type: 'knockdown', player: 1 }); tickN(c, 12 + 24); expect(c.fs[1].action).toBe('down');
    expect(hurtboxes(c.fs[1], c.defs[1])).toEqual([]); tickN(c, 40); expect(c.fs[1].action).toBe('getup');
    tickN(c, 20); expect(c.fs[1].action).toBe('idle');
  });
  test('an airborne defender hit by a non-knockdown move air-resets and lands', () => {
    const c = close(); c.fs[1].action = 'air'; c.fs[1].y = 8000; c.fs[1].arc = { t: 15, duration: 40, height: 230, startY: 0, vx: 0 };
    setAttack(c.fs[0], 'crouch-hp', 9); tickN(c, 1); expect(c.fs[1].action).toBe('airReset');
    tickN(c, 12 + 30); expect(c.fs[1]).toMatchObject({ action: 'idle', y: 0 });
  });
  test('simultaneous hits trade', () => { const c = close(); tickN(c, 1, raw(5, 'LP'), raw(5, 'LP')); tickN(c, 4);
    expect(c.fs[0].health).toBe(970); expect(c.fs[1].health).toBe(920); });
  test('a hit at 0 health is a KO knockdown with no get-up', () => {
    const c = close(); c.fs[1].health = 20; press(c, 5, 'LP'); tickN(c, 4 + 8 + 24 + 200);
    expect(c.fs[1]).toMatchObject({ health: 0, ko: true, action: 'down' });
  });
  test('proximity guard: holding back near an attack blocks instead of walking', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 1100); const x = c.fs[1].x;
    press(c, 5, 'HK', raw(6)); tickN(c, 3, raw(), raw(6)); expect(c.fs[1]).toMatchObject({ action: 'guard', x });
    const far = fightPair('mohawk-man', 'spin-kicker', 600, 1100); press(far, 5, 'HK', raw(6)); expect(far.fs[1].action).toBe('walkBack');
  });
  test('cannot block while attacking', () => {
    const c = close(); setAttack(c.fs[1], 'stand-hk', 20); press(c, 5, 'LP', raw(6)); tickN(c, 4, raw(), raw(6));
    expect(c.fs[1].health).toBe(920);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/combat.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `combat.ts` and the changes to `fighter.ts`, `space.ts` and `tick.ts`.
- [ ] **Step 4: Run** `npx vitest run tests/unit && npm run typecheck`. Expected: all PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(engine): add hit resolution, blocking, hitstop, pushback and knockdowns"`

---

### Task 8: Rounds, timer, KO and the `step` entry point

**Files:**
- Create: `src/engine/match.ts`, `src/engine/step.ts`
- Test: `tests/unit/engine/match.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const DEFAULT_CONFIG: MatchConfig = { roundsToWin: 2, roundSeconds: 99 };
  export function createMatch(defs: Defs, config?: MatchConfig): MatchState;
    // phase 'intro', round 1, timer = roundSeconds, fighters at (STAGE_WIDTH/2 ∓ START_SEPARATION/2)*SUB facing each other, action 'intro'
  export function step(state: MatchState, inputs: readonly [RawInput, RawInput], defs: Defs): { state: MatchState; events: GameEvent[] };
    // never mutates its argument: structuredClone first
  ```

**Phase rules** (`tick++` and `phaseTick++` every step):
- **intro:**
  - Emit `roundStart` on `phaseTick` 0. Run `tickFighters(active = false)`.
  - At `ROUND_INTRO_TICKS`, switch to `fight`, set both fighters `idle` and emit `fight`.
- **fight:** `tickFighters(active = true)`, then:
  - **KO check:** if any fighter has `ko`, switch to `ko`.
    - One KO: the other fighter wins the round, reason `'ko'`.
    - Both KO: the round is a draw, reason `'doubleKo'`.
    - Emit `ko` for each KO'd fighter.
  - **Timer:** otherwise, if `timer !== null`: `timerTicks++`. At 60: `timer--`, `timerTicks = 0`.
  - **Time-out:** at `timer === 0`, emit `timeUp` and enter `roundEnd` with reason `'time'`. Compare `Math.trunc(health*1000/def.health)`: the higher one wins, equal is a draw.
- **ko:** run `tickFighters(active = false)` only when `phaseTick % KO_SLOWMO_FACTOR === 0`. At `KO_SLOWMO_TICKS`, enter `roundEnd`.
- **Entering roundEnd:**
  - `roundsPlayed++`; the round winner's `roundsWon++`.
  - `perfect = winner.health === def.health`.
  - Emit `roundOver`.
- **roundEnd:**
  - Each tick, run `tickFighters(active = false)`. Any actionable fighter that isn't KO'd takes the `win` pose if it won the round, otherwise `lose` (both `lose` on a draw).
  - At `ROUND_END_TICKS`:
    - If a fighter has `roundsWon >= roundsToWin`, or `roundsPlayed >= 2*roundsToWin + 1` (a draw match), switch to `matchEnd`, set `matchWinner` and emit `matchOver`.
    - Otherwise start the next round: `round++`, `resetForRound` both fighters, timer reset, clear `roundResult`, `roundEndReason` and `perfect`, and go back to `intro`.
- **matchEnd:** `tickFighters(active = false)`.

- [ ] **Step 1: Write the failing tests** (helper `run(s, n, p1?, p2?)` loops `step` and returns `{ state, events }`; `defs = DEFS`; `toFight(s)` returns `run(s, 120).state`):
  ```ts
  test('createMatch places fighters and starts the intro', () => {
    const s = createMatch(defs); expect(s).toMatchObject({ phase: 'intro', round: 1, timer: 99 });
    expect(s.fighters.map((f) => f.x)).toEqual([81000, 111000]); expect(s.fighters.map((f) => f.facing)).toEqual([1, -1]);
  });
  test('the intro ignores input for 120 ticks, then FIGHT', () => {
    const { state, events } = run(createMatch(defs), 120, raw(6)); expect(state.fighters[0].x).toBe(81000);
    expect(state.phase).toBe('fight'); expect(events).toContainEqual({ type: 'fight' });
  });
  test('the timer counts down once per 60 ticks', () => expect(run(toFight(createMatch(defs)), 60).state.timer).toBe(98));
  test('time-out with equal percentages is a draw; higher percentage wins', () => {
    const cfg = { roundsToWin: 2, roundSeconds: 1 };
    expect(run(toFight(createMatch(defs, cfg)), 60).state).toMatchObject({ phase: 'roundEnd', roundResult: 'draw', roundEndReason: 'time' });
    const s = toFight(createMatch(defs, cfg)); s.fighters[1].health = 900;
    expect(run(s, 60).state).toMatchObject({ roundResult: 0 });
  });
  test('KO → slow motion → round end → round 2 with reset health', () => {
    let s = toFight(createMatch(defs)); s.fighters[0].x = 90000; s.fighters[1].x = 98000; s.fighters[1].health = 1;
    s = run(s, 1, raw(5, 'LP')).state; s = run(s, 5).state; expect(s.phase).toBe('ko');
    s = run(s, 90).state; expect(s).toMatchObject({ phase: 'roundEnd', roundResult: 0, perfect: true });
    expect(s.fighters[0].roundsWon).toBe(1); s = run(s, 150).state;
    expect(s).toMatchObject({ phase: 'intro', round: 2 }); expect(s.fighters[1].health).toBe(950);
  });
  test('KO slow motion advances fighters every 3rd tick', () => {
    let s = toFight(createMatch(defs)); s.fighters[0].x = 90000; s.fighters[1].x = 98000; s.fighters[1].health = 1;
    s = run(s, 1, raw(5, 'LP')).state; s = run(s, 5).state; expect(s.phase).toBe('ko');
    const h = s.fighters[0].hitstop; expect(run(s, 9).state.fighters[0].hitstop).toBe(h - 3);
  });
  test('double KO is a draw round', () => {
    const s = toFight(createMatch(defs)); s.fighters[0].x = 90000; s.fighters[1].x = 98000; s.fighters[0].health = 1; s.fighters[1].health = 1;
    expect(run(s, 6, raw(5, 'LP'), raw(5, 'LP')).state).toMatchObject({ phase: 'ko', roundResult: 'draw', roundEndReason: 'doubleKo' });
  });
  const winRoundP1 = (s0: MatchState) => { const s = run(s0, 120).state; s.fighters[0].x = 90000; s.fighters[1].x = 98000;
    s.fighters[1].health = 1; return run(run(s, 1, raw(5, 'LP')).state, 5 + 90 + 150); };
  test('first to roundsToWin takes the match', () => {
    const r = winRoundP1(winRoundP1(createMatch(defs)).state);
    expect(r.state).toMatchObject({ phase: 'matchEnd', matchWinner: 0 }); expect(r.events).toContainEqual({ type: 'matchOver', winner: 0 });
  });
  test('the round limit ends the match as a draw', () => {
    const r = run(createMatch(defs, { roundsToWin: 1, roundSeconds: 1 }), 3 * (120 + 60 + 150) + 5);
    expect(r.state).toMatchObject({ phase: 'matchEnd', matchWinner: 'draw', roundsPlayed: 3 });
  });
  test('no timer means no time-out', () =>
    expect(run(toFight(createMatch(defs, { roundsToWin: 2, roundSeconds: null })), 10000).state.phase).toBe('fight'));
  test('step does not mutate its input', () => { const s = createMatch(defs); const copy = structuredClone(s); step(s, [raw(6), raw(4)], defs); expect(s).toEqual(copy); });
  test('determinism: the same input script gives identical states', () => {
    const pick = <T,>(xs: readonly T[], t: number, salt: number) => xs[((t * 2654435761 + salt) >>> 0) % xs.length]!;
    const script = (t: number): [RawInput, RawInput] => [
      t % 5 === 0 ? raw(pick([5, 6, 4, 2, 3, 8, 9], t, 1), pick(['LP', 'MK', 'HP', 'HK'] as const, t, 2)) : raw(pick([5, 6, 4, 2, 3, 8, 9], t, 1)),
      t % 7 === 0 ? raw(pick([4, 6, 1, 5], t, 3), pick(['LK', 'MP'] as const, t, 4)) : raw(pick([4, 6, 1, 5], t, 3))];
    const a: string[] = [], b: string[] = [];
    for (const out of [a, b]) { let s = createMatch(defs); for (let t = 0; t < 3000; t++) { s = step(s, script(t), defs).state; if (t % 100 === 0) out.push(JSON.stringify(s)); } }
    expect(a).toEqual(b);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/match.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `match.ts` and `step.ts`.
- [ ] **Step 4: Run** `npx vitest run tests/unit && npm run typecheck`. Expected: all PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(engine): add round and match flow, timer, KO and step()"`

---

### Task 9: Keyboard and gamepad devices

**Files:**
- Create: `src/input/devices.ts`
- Test: `tests/unit/input/devices.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface GamepadLike { index: number; connected: boolean; mapping: string;
    buttons: readonly { pressed: boolean; value: number }[]; axes: readonly number[] }
  export interface KeyLayout { up: string; down: string; left: string; right: string; start: string; buttons: Record<Button, string> }
  export const P1_KEYS: KeyLayout; // KeyW KeyS KeyA KeyD, Enter; LP KeyU, MP KeyI, HP KeyO, LK KeyJ, MK KeyK, HK KeyL
  export const P2_KEYS: KeyLayout; // ArrowUp ArrowDown ArrowLeft ArrowRight, NumpadEnter; Numpad4/5/6 punches, Numpad1/2/3 kicks
  export const PAD_BUTTONS: Record<Button | 'start', number>; // LP 2, MP 3, HP 5, LK 0, MK 1, HK 7, start 9; d-pad 12 up, 13 down, 14 left, 15 right
  export function readGamepad(pad: GamepadLike): RawInput;   // button down if pressed || value > 0.5; stick axes[0], -axes[1] with dead zone 0.5; d-pad OR stick
  export function readKeyboard(down: ReadonlySet<string>, layout: KeyLayout): RawInput;
  export function mergeInputs(a: RawInput, b: RawInput): RawInput;  // OR buttons and start; x = sign(a.x + b.x), same for y
  export class Keyboard { constructor(target: EventTarget); readonly down: ReadonlySet<string>; dispose(): void }
    // keydown/keyup on event.code; 'blur' clears all; preventDefault on every code in P1_KEYS, P2_KEYS and 'F1'
  export class PadAssigner { readonly slots: readonly [number | null, number | null];
    update(pads: readonly (GamepadLike | null)[]): void; disconnected(): PlayerIndex[] }
  export class DeviceManager { constructor(target: EventTarget, getPads: () => readonly (GamepadLike | null)[]);
    poll(): { inputs: [RawInput, RawInput]; startPressed: boolean; disconnected: PlayerIndex[] };
    readonly padSlots: readonly [number | null, number | null] }
    // player i = keyboard layout i merged with the pad in slot i; startPressed = a Start edge on any device this poll
  ```
  **Opposite directions:** in `readKeyboard`, left + right gives `x = 0`, and up + down gives `y = 0`.

  **`PadAssigner`:**
  - A connected, unassigned pad whose Start (button 9) is down takes the first free slot.
  - A pad already in a slot never takes a second one.
  - A slot whose pad is missing or `!connected` is reported by `disconnected()`. The same index reconnecting restores it.
  - While a slot is disconnected, another unassigned pad pressing Start takes that slot.

- [ ] **Step 1: Write the failing tests** (helper `pad(index, pressed: number[], axes = [0, 0], connected = true)` builds a 17-button `GamepadLike`):
  ```ts
  test('pad buttons map to the standard layout', () => expect(readGamepad(pad(0, [2, 7]))).toMatchObject({ buttons: btn('LP', 'HK') }));
  test('triggers count as pressed above half travel', () => {
    const p = pad(0, []); (p.buttons as any)[7] = { pressed: false, value: 0.8 }; expect(readGamepad(p).buttons).toBe(btn('HK'));
  });
  test('stick: dead zone 0.5, and up is +1', () => {
    expect(readGamepad(pad(0, [], [0.3, -0.4]))).toMatchObject({ x: 0, y: 0 });
    expect(readGamepad(pad(0, [], [0.9, -0.9]))).toMatchObject({ x: 1, y: 1 });
  });
  test('d-pad works', () => expect(readGamepad(pad(0, [13, 14]))).toMatchObject({ x: -1, y: -1 }));
  test('REVIEW FOCUS: left+right and up+down cancel to neutral', () => {
    expect(readKeyboard(new Set(['KeyA', 'KeyD', 'KeyW', 'KeyS']), P1_KEYS)).toMatchObject({ x: 0, y: 0 });
    expect(mergeInputs({ ...NEUTRAL, x: 1 }, { ...NEUTRAL, x: -1 }).x).toBe(0);
  });
  test('REVIEW FOCUS: blur releases every held key', () => {
    const t = new EventTarget(); const k = new Keyboard(t);
    t.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code: 'KeyD' })); expect(k.down.has('KeyD')).toBe(true);
    t.dispatchEvent(new Event('blur')); expect(k.down.size).toBe(0);
  });
  test('REVIEW FOCUS: mapped keys do not scroll the page', () => {
    const t = new EventTarget(); new Keyboard(t); const e = Object.assign(new Event('keydown', { cancelable: true }), { code: 'ArrowDown' });
    t.dispatchEvent(e); expect(e.defaultPrevented).toBe(true);
  });
  test('pads join in Start order; the same pad cannot take both slots', () => {
    const a = new PadAssigner(); a.update([null, pad(1, [9])]); a.update([pad(0, []), pad(1, [9])]); expect(a.slots).toEqual([1, null]);
    a.update([pad(0, [9]), pad(1, [])]); expect(a.slots).toEqual([1, 0]);
  });
  test('disconnect is reported; reconnecting restores the slot', () => {
    const a = new PadAssigner(); a.update([pad(0, [9])]); a.update([null]); expect(a.disconnected()).toEqual([0]);
    a.update([pad(0, [])]); expect(a.disconnected()).toEqual([]);
  });
  test('DeviceManager reports a Start edge only once', () => {
    const t = new EventTarget(); let pads = [pad(0, [9])]; const d = new DeviceManager(t, () => pads);
    expect(d.poll().startPressed).toBe(true); expect(d.poll().startPressed).toBe(false);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/input/devices.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/input/devices.ts`.
- [ ] **Step 4: Run** the same command plus `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(input): add keyboard and gamepad devices with joining and disconnects"`

---

### Task 10: Rendering: viewport, stage, placeholder fighters, effects, HUD

**Files:**
- Create: `src/render/viewport.ts`, `src/render/placeholder.ts`, `src/render/hud.ts`, `src/render/effects.ts`, `src/render/renderer.ts`
- Test: `tests/unit/render/render.test.ts`

**Interfaces:**
- Consumes: `MatchState`, `Defs`, `hurtboxes`, `activeHitbox`, `cameraX`.
- Produces:
  ```ts
  export interface Viewport { cssWidth: number; cssHeight: number; pixelWidth: number; pixelHeight: number; unitScale: number } // device px per world unit
  export function computeViewport(winW: number, winH: number, dpr: number): Viewport; // largest 16:9 inside the window, Math.floor on css size
  export interface Shape { kind: 'rect' | 'circle'; x: number; y: number; w: number; h: number; color: string } // world units, y up, already mirrored
  export function placeholderShapes(f: FighterState, def: FighterDef): Shape[];
  export function announcerText(s: MatchState, names: readonly [string, string]): string | null;
  export class HealthTrail { constructor(health: number); update(health: number): number } // returns trail value
  export class Effects { add(events: GameEvent[]): void; tick(): void; draw(ctx: CanvasRenderingContext2D, camX: number): void }
  export class Renderer { constructor(canvas: HTMLCanvasElement); resize(winW: number, winH: number, dpr: number): void;
    drawMatch(s: MatchState, defs: Defs, opts: { debug: boolean; tickRate: number }): void;
    drawTitle(joined: readonly [string, string]): void; drawOverlay(lines: string[]): void;
    addEvents(events: GameEvent[]): void; tickEffects(): void }
  ```

**Rules:**
- **`placeholderShapes`:**
  - Boxes come from `hurtboxes`. If that's empty, use a fallback by action:
    - `down`: one rect `{x: -h/2, y: 0, w: h, h: 50}`, where h = `BASE_HEIGHT*SIZE_SCALE`
    - `knockdown` and `airReset`: `airHurtboxes`
    - `getup`: `crouchingHurtboxes`
    - `intro`, `win`, `lose`: `standingHurtboxes`
  - By template convention, box index 1 is the head (stance lists are `[body, head]`, and attack frames are `[body, head, limb]`). It becomes a **circle** in `colors.secondary`. Every other box is a rect in `colors.primary`. A single fallback rect has no head.
  - The active hitbox is added as a rect in `colors.secondary`.
  - Everything is mirrored by `facing` and offset by the fighter's position in units.
- **`announcerText`:**
  - intro: `phaseTick < 60` → `ROUND n`, otherwise `FIGHT!`
  - fight: null
  - ko: `K.O.`
  - roundEnd, `phaseTick < 60`: `TIME` if the reason was `'time'`; otherwise `PERFECT` if `perfect`, else null
  - roundEnd, `phaseTick >= 60`: `DRAW` or `<NAME> WINS` (name uppercased)
  - matchEnd: `DRAW` or `<NAME> WINS`
- **`HealthTrail`:** each `update(health)` works like this:
  - a health above the trail snaps the trail up to it
  - a health lower than the last update's resets a hold counter to 0
  - then the counter increments; once it is over 30, the trail falls by 8, never below the health
  - returns the trail
- **Drawing** (not unit tested; checked by the smoke test and by eye):
  - Ground line at screen y 640 units.
  - Flat stage: a sky gradient, floor color `#3b3b4f`, and vertical floor lines every 120 units so scrolling is visible.
  - Shadow ellipses under fighters.
  - `Effects`: hit sparks are 8-ray star bursts sized by strength (light 20, medium 30, heavy 45 units) that last 10 ticks. Block flashes are blue arcs.
  - HUD:
    - health bars 500 × 28 at y 40 (P1 from x 60, P2 ending at x 1220 and draining toward the center), with the red trail behind them
    - fighter names under the bars
    - round-win dots under the names
    - the timer at the center top (`∞` when null)
    - announcer text at 96 px in the center
  - Debug overlay (`opts.debug`):
    - hurtboxes outlined blue, hitboxes red, push boxes green
    - top-left text: tick rate, phase, each fighter's action and `actionTick`

- [ ] **Step 1: Write the failing tests:**
  ```ts
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
  test('placeholder: a knocked-down fighter is still drawn', () => {
    const { fs, defs } = fightPair(); fs[0].action = 'down'; expect(placeholderShapes(fs[0], defs[0]).length).toBeGreaterThan(0);
  });
  test('announcer text follows the phases', () => {
    const names = ['Mohawk Man', 'Spin Kicker'] as const; const s = createMatch(DEFS);
    expect(announcerText(s, names)).toBe('ROUND 1'); expect(announcerText({ ...s, phaseTick: 60 }, names)).toBe('FIGHT!');
    expect(announcerText({ ...s, phase: 'roundEnd', phaseTick: 70, roundResult: 1, roundEndReason: 'ko' }, names)).toBe('SPIN KICKER WINS');
    expect(announcerText({ ...s, phase: 'roundEnd', phaseTick: 10, roundResult: 0, roundEndReason: 'time' }, names)).toBe('TIME');
  });
  test('health trail holds, then drains toward health', () => {
    const t = new HealthTrail(1000); expect(t.update(900)).toBe(1000); // counter 1
    for (let i = 0; i < 29; i++) t.update(900); expect(t.update(900)).toBe(992); for (let i = 0; i < 50; i++) t.update(900);
    expect(t.update(900)).toBe(900);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/render`. Expected: FAIL.
- [ ] **Step 3: Implement** the five render files.
- [ ] **Step 4: Run** `npx vitest run tests/unit && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(render): add viewport, flat stage, placeholder fighters, effects and HUD"`

---

### Task 11: App loop, title and pause, smoke test, README

**Files:**
- Create: `src/app/clock.ts`, `src/app/setup.ts`, `src/app/app.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `src/main.ts` (replace), `.github/workflows/ci.yml` (add e2e), `README.md`
- Test: `tests/unit/app/app.test.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // clock.ts
  export const TICK_MS = 1000 / 60, MAX_TICKS_PER_FRAME = 4, MAX_ELAPSED_MS = 250;
  export function advanceClock(accMs: number, elapsedMs: number): { ticks: number; accMs: number };
    // acc += clamp(elapsed, 0, MAX_ELAPSED_MS); ticks = min(floor(acc / TICK_MS), MAX); acc -= ticks * TICK_MS; if ticks === MAX: acc = 0 (drop the backlog: slow down, don't catch up)
  // setup.ts
  export interface Setup { p1: string; p2: string; config: MatchConfig }
  export function parseSetup(search: string): Setup;
    // defaults: p1 'mohawk-man', p2 'spin-kicker', DEFAULT_CONFIG; p1/p2 must be in FIGHTER_IDS;
    // time: integer 1–99 or 'none' (→ null); rounds: integer 1–3; anything else → that field's default
  // app.ts
  export type AppMode = 'title' | 'match' | 'paused';
  export class App { constructor(canvas: HTMLCanvasElement, win: Window, setup: Setup);
    readonly mode: AppMode; readonly state: MatchState | null; frame(nowMs: number): void; start(): void }
  // main.ts: window.__evs = { mode: () => app.mode, state: () => app.state }
  ```

**App behavior:**
- **Frame loop:** `requestAnimationFrame` calls `frame(now)`. Each frame: `devices.poll()`, then `advanceClock`. In `match` mode, run `step()` once per tick with the polled inputs, feed events to the renderer, and tick effects once per tick. Then draw once.
- **title:** `drawTitle` shows "EVS-GAME", "Press Enter or click to start", "Players: press Start on your controller to join", and P1/P2 shown as `Keyboard`, or `Gamepad N` from `PadAssigner` slots. A click, or any Start edge, calls `start()` (`createMatch` from the setup), and the mode becomes `match`.
- **paused:**
  - Entered when `document.visibilityState === 'hidden'` (`visibilitychange`): overlay "Paused".
  - Also entered when `poll().disconnected` is non-empty during a match: overlay "Player N controller disconnected. Reconnect and press Start."
  - It resumes on a Start edge once nothing is disconnected. The clock accumulator is reset on resume.
- **matchEnd:** an overlay line "Press Start for a rematch". A Start edge calls `start()` again.
- **Keys:** F1 toggles the debug overlay. F toggles fullscreen (`requestFullscreen` on the document element).
- **Resizing:** on `resize`, call `renderer.resize(innerWidth, innerHeight, devicePixelRatio)`.
- **Tick rate:** count ticks executed in the last 1,000 ms of wall time and pass the count to the renderer.

- [ ] **Step 1: Write the failing unit tests:**
  ```ts
  test('advanceClock: one tick per 16.7 ms, remainder carried', () => {
    expect(advanceClock(0, 16.7).ticks).toBe(1); expect(advanceClock(0, 8)).toEqual({ ticks: 0, accMs: 8 });
  });
  test('advanceClock: at most 4 ticks per frame, leftover under one tick', () => {
    const r = advanceClock(0, 100); expect(r.ticks).toBe(4); expect(r.accMs).toBeLessThan(TICK_MS);
  });
  test('REVIEW FOCUS: a long sleep never runs a burst of ticks', () => {
    expect(advanceClock(0, 60000).ticks).toBe(4); expect(advanceClock(0, -5)).toEqual({ ticks: 0, accMs: 0 });
  });
  test('parseSetup: defaults, valid values, and bad values fall back', () => {
    expect(parseSetup('')).toEqual({ p1: 'mohawk-man', p2: 'spin-kicker', config: { roundsToWin: 2, roundSeconds: 99 } });
    expect(parseSetup('?p1=spin-kicker&p2=mohawk-man&time=30&rounds=3')).toEqual({ p1: 'spin-kicker', p2: 'mohawk-man', config: { roundsToWin: 3, roundSeconds: 30 } });
    expect(parseSetup('?time=none').config.roundSeconds).toBeNull();
    expect(parseSetup('?p1=nobody&time=abc&rounds=9')).toEqual(parseSetup(''));
    expect(parseSetup('?time=0').config.roundSeconds).toBe(99);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/app`. Expected: FAIL.
- [ ] **Step 3: Implement** `clock.ts`, `setup.ts`, `app.ts` and the new `main.ts`.
- [ ] **Step 4: Run** `npx vitest run tests/unit && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Write the smoke test.**
  - `playwright.config.ts`: `testDir 'tests/e2e'`, `webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI }`, `use.baseURL` the same URL, a single `chromium` project, `timeout: 60_000`.
  - `tests/e2e/smoke.spec.ts`:
  ```ts
  test('boots, starts a match, moves P1, finishes a timed round, no errors', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/?time=3');
    expect(await page.evaluate(() => (window as any).__evs.mode())).toBe('title');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => (window as any).__evs.state()?.phase), { timeout: 5000 }).toBe('fight');
    const x0 = await page.evaluate(() => (window as any).__evs.state().fighters[0].x);
    await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await page.keyboard.up('KeyD');
    expect(await page.evaluate(() => (window as any).__evs.state().fighters[0].x)).toBeGreaterThan(x0);
    await expect.poll(() => page.evaluate(() => (window as any).__evs.state().roundsPlayed), { timeout: 10000 }).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  });
  ```
- [ ] **Step 6: Run** `npm run e2e`. Expected: 1 passed.
- [ ] **Step 7: Add e2e to CI.** In the `test` job, after `npm run build`, add `npx playwright install --with-deps chromium` and `npm run e2e`.
- [ ] **Step 8: Write `README.md`.** Include:
  - what the game is
  - how to play: the link, press Enter or click, press Start on a controller to join
  - the default gamepad and keyboard controls (spec 4.3, without Easy mode and throw, which come in M2)
  - dev commands
  - query parameters (`p1`, `p2`, `time`, `rounds`)
  - F1 for the debug overlay and F for fullscreen
  - links to the spec, the art guide and the image-model brief
  - a note that GitHub Pages must be set to "Source: GitHub Actions" and that deploys happen from `main`
- [ ] **Step 9: Run everything.** Run `npm run typecheck && npm test && npm run build && npm run e2e`. Expected: all pass.
- [ ] **Step 10: Commit.** `git commit -m "feat(app): add game loop, title and pause screens, smoke test and README"`

---

## Done when

- `npm run typecheck && npm test && npm run build && npm run e2e` all pass locally and in CI.
- Playing by hand (two pads, or the keyboard): a full best-of-three match plays to `matchEnd`, and Start gives a rematch. Hits freeze briefly and push back, blocking high and low works, sweeps knock down, and the timer and HUD update.
