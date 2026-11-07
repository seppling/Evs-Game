# M2: Full Combat Systems Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mohawk Man and Spin Kicker become complete fighters. M2 adds motion and charge inputs, special moves, projectiles, throws and throw escapes, the super meter and supers, dizzy, cancels and chains, damage scaling, a combo counter, announcer callouts and Easy mode.

**Architecture:** This extends the pure, deterministic M1 engine.
- **Input:** `src/input/` gains a 60-tick, facing-relative input history and a pure motion detector.
- **Intent:** a new `src/engine/intent.ts` turns buffered input into the move the player is asking for, by priority.
- **One world per tick:** the engine ticks a `World` (both fighters plus projectiles plus the rules) instead of a bare fighter pair.
- **Data:** special moves and supers are fighter data, built by a shared helper.
- **Presentation:** the renderer reads the new state (meters, combo, freeze, projectiles). It never changes it.

**Tech Stack:** TypeScript, Vite, Vitest, Playwright 1.63.0, Canvas 2D (unchanged from M1).

**Spec:** `docs/superpowers/specs/2026-11-06-evs-game-design.md`. This plan covers section 16, item 2. Sections 4.3, 5.4–5.6, 5.8–5.12, 6, 10 and 15 apply. M1's plan (`docs/superpowers/plans/2026-11-06-m1-playable-skeleton.md`) describes the code this builds on.

## Global Constraints

- **Everything from M1's Global Constraints still holds:**
  - the pure integer simulation (no DOM, `Date`, `performance` or `Math.random` in `src/engine/**` or `src/input/commands.ts`/`motions.ts`)
  - `SUB = 100`
  - 60 ticks per second, with at most 4 ticks per frame
  - no runtime dependencies
  - `npm test`, `npm run typecheck`, `npm run e2e --trace off`
- **State must survive a JSON round-trip unchanged.** That includes `-0`: never store `-0`, and normalize with `|| 0` where a product can produce it.
- **Spec values, verbatim:**
  - chip damage is 25% and can KO
  - cancel window is hitstop + 3 ticks
  - damage scaling: hits 1–2 100%, hit 3 80%, then −10% per hit, minimum 40% (50% for supers)
  - throw range 70 units, throw startup 3, throw damage 120, escape window 7 ticks, no throwing for 6 ticks after hitstun, blockstun or getup
  - stun: drain starts 60 ticks after the last hit at 4 per tick; dizzy lasts 120 ticks; each mash input saves 3 ticks
  - meter: 1,000 max; normals +40/+60/+80 on hit or block; specials +100 on hit, +50 on block, +30 on a miss; taking damage gives +50% of the damage; supers cost 1,000
  - super freeze: 30 ticks
  - Easy-mode specials are medium strength at 85% damage
  - motion windows: motion within 15 ticks, button within 8 ticks after it; double quarter-circle within 25; charge 40 ticks, release within 10
- **Input priority** when several moves match: super, then special, then throw, then normal.
- **Default button mapping** (spec 4.3):
  - pad: LB = Easy Special (button 4), LT = Throw (button 6)
  - keyboard P1: Y = Special, H = Throw
  - keyboard P2: Numpad7 = Special, Numpad0 = Throw
- **Deferred:**
  - the `counter` and `armor` move flags (spec 5.11) are used only by M5 fighters (Two-Face, Richie) and are implemented then
  - P2 recoloring in mirror matches and the Options menu are M4

## Review Focus

1. **A super motion without a full meter** (↓↘→↓↘→+P at 999 meter) still gives the quarter-circle special (Karate Wave), not nothing. (Test in Task 3.)
2. **A fireball motion while your fireball is still on screen** gives a normal punch. It is not silently eaten, and a second projectile never appears. (Tests in Tasks 3 and 5.)
3. **Both players throw on the same tick:** both throws break apart with ESCAPE!, and nobody takes damage. Neither silently wins. (Test in Task 7.)
4. **A motion just after being crossed up** is read toward the opponent's new side, so ↓↘→ toward the opponent is a quarter-circle forward. (Test in Task 3.)
5. **A projectile still flying at KO** cannot hit during the KO slow motion, and is gone when the next round starts. (Test in Task 9.)

---

## File structure (new and changed)

```
src/input/types.ts        + INPUT_BUTTONS (adds THROW, SPECIAL), Dir, InputFrame; InputState.history
src/input/commands.ts     pushInput(s, raw, facing, frozen?) records history; relativeDir
src/input/motions.ts      NEW  motionDone(): qcf, qcb, dp, qcf2, chargeBack, chargeDown
src/input/devices.ts      map LB/LT and keyboard Y/H/Numpad7/Numpad0
src/engine/constants.ts   + M2 constants (below)
src/engine/types.ts       + MoveKind, ProjectileDef/State, new MoveFrame/MoveDef/FighterState/MatchState fields, new actions/events
src/engine/moves.ts       NEW  normalMoveId (moved from fighters/defaults), effectiveHit, moveOfKind helpers
src/engine/tick.ts        tickFighters → tickWorld(World)
src/engine/intent.ts      NEW  resolveIntent(): super > special > throw > normal; Easy mode
src/engine/fighter.ts     start moves via intents; leaps, landing recovery, frame velocity; cancels and chains; whiff meter; dizzy state
src/engine/combat.ts      hit groups, chip, scaling, combo tracking, meter, invulnerability flags, Easy damage, projectile hits
src/engine/projectiles.ts NEW  spawn, move, clash, hit
src/engine/throws.ts      NEW  grab, escape window, simultaneous throws, back throw
src/engine/stun.ts        NEW  stun build-up, drain, dizzy entry and mashing
src/engine/match.ts, step.ts   projectiles and freeze in MatchState; super freeze; meter carry/reset; config.easy
src/engine/validate.ts    kinds, specials, supers, projectiles, Easy slots
src/fighters/defaults.ts  SpecialSpec builder, cancel flags on normals, shared throw moves
src/fighters/mohawk-man.ts, spin-kicker.ts   specials and supers
src/render/hud.ts         meters, stun bars, Easy badge, comboText, ComboDisplay
src/render/effects.ts     clash sparks; ESCAPE!/DIZZY! callouts
src/render/renderer.ts    projectiles, super-flash overlay, dizzy stars
src/render/placeholder.ts fallbacks for thrown, throwing, landing
src/app/setup.ts, app.ts  ?easy=; Easy toggle on the title screen
tests/unit/helpers.ts     Ctx becomes a World; tickN uses tickWorld; motion(...) helper
```

**New constants** (`src/engine/constants.ts`), exactly:

```ts
CANCEL_WINDOW_TICKS = 3; METER_MAX = 1000; SUPER_FREEZE_TICKS = 30; CHIP_PERCENT = 25; EASY_DAMAGE_PERCENT = 85;
METER_GAIN = { specialHit: 100, specialBlock: 50, specialWhiff: 30, damageTakenPercent: 50 };
THROW = { range: 70, startup: 3, whiffRecovery: 20, escapeWindow: 7, hitTick: 20, duration: 30, damage: 120, breakPush: 40, behind: 80 };
THROW_PROTECT_TICKS = 6;
STUN = { drainDelay: 60, drainPerTick: 4, dizzyTicks: 120, mashTicks: 3 };
```

---

### Task 1: Input history, motion detection, Throw and Special buttons

**Files:**
- Modify: `src/input/types.ts`, `src/input/commands.ts`, `src/input/devices.ts`, `src/engine/tick.ts` (pass facing to `pushInput`)
- Create: `src/input/motions.ts`
- Test: `tests/unit/input/motions.test.ts`, plus additions to `tests/unit/input/commands.test.ts` and `devices.test.ts`

**Interfaces:**
- Produces, in `types.ts`:
  ```ts
  export const INPUT_BUTTONS = [...BUTTONS, 'THROW', 'SPECIAL'] as const;   // bits 0-5 unchanged, THROW bit 6, SPECIAL bit 7
  export type InputButton = (typeof INPUT_BUTTONS)[number];
  export function btn(...names: InputButton[]): number; export function isDown(buttons: number, b: InputButton): boolean;
  export type Dir = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;            // numpad, facing-relative: 6 = forward, 4 = back
  export interface InputFrame { dir: Dir; pressed: number }       // pressed = buttons newly down this tick (bitmask)
  export interface InputState { last: RawInput; presses: { button: InputButton; age: number }[]; history: InputFrame[] } // history newest last, at most 60
  ```
- Produces, in `commands.ts`:
  ```ts
  export const HISTORY_TICKS = 60;
  export function relativeDir(raw: RawInput, facing: Facing): Dir;   // 5 + raw.x*facing + 3*raw.y (normalize -0)
  export function pushInput(s: InputState, raw: RawInput, facing: Facing, frozen = false): void;
    // frozen (fighter in hitstop): buffered presses do NOT age; otherwise age +1 and drop age >= BUTTON_BUFFER_TICKS.
    // New presses (any INPUT_BUTTON) are added at age 0; append { dir, pressed } to history and trim it to HISTORY_TICKS.
  ```
  `readCommand(s, facing).press` stays as in M1: the highest-priority buffered **attack** button (`PRESS_PRIORITY`). THROW and SPECIAL are never returned as `press`.
- Produces, in `motions.ts`:
  ```ts
  export type Motion = 'qcf' | 'qcb' | 'dp' | 'qcf2' | 'chargeBack' | 'chargeDown';
  export const MOTION_WINDOW = 15, BUTTON_AFTER_MOTION = 8, SUPER_WINDOW = 25, CHARGE_TICKS = 40, CHARGE_RELEASE = 10;
  export function motionDone(history: readonly InputFrame[], endIndex: number, motion: Motion): boolean;
  ```
- Produces, in `devices.ts`: `PAD_BUTTONS.SPECIAL = 4`, `PAD_BUTTONS.THROW = 6`. `KeyLayout.buttons` becomes `Record<InputButton, string>`: P1 `SPECIAL: 'KeyY', THROW: 'KeyH'`, P2 `SPECIAL: 'Numpad7', THROW: 'Numpad0'`. Readers loop over `INPUT_BUTTONS`.

**Motion rules.** The sequence motions are ordered steps. Each step is a set of directions, and any directions may come between steps.

| Motion | Steps | Span limit |
|---|---|---|
| qcf | `{2,3}` then `{6}` | 15 |
| qcb | `{2,1}` then `{4}` | 15 |
| dp | `{6}` then `{2}` then `{3}` | 15 |
| qcf2 | `{2,3}`, `{6}`, `{2,3}`, `{6}` | 25 |

**Matching sequence motions:**
1. Find the **last** step at the latest index `i ≤ endIndex`. It must satisfy `endIndex − i ≤ 8`.
2. Find each earlier step at the latest index before the following step.
3. The match succeeds if `i_last − i_first ≤` the span limit.

**Charge motions:**
- `chargeBack`: true when `history[endIndex].dir ∈ {3,6,9}` and there is an index `c` with `endIndex − c ≤ 10` such that the 40 frames ending at `c` all have `dir ∈ {1,4,7}`.
- `chargeDown`: the same, with release set `{7,8,9}` and hold set `{1,2,3}`.

- [ ] **Step 1: Write the failing tests** (`const H = (...d: number[]) => d.map((dir) => ({ dir, pressed: 0 })) as InputFrame[];`, `const rep = (d: number, n: number) => Array(n).fill(d)`):
  ```ts
  test('qcf: full, skipped diagonal, and the down-forward shortcut', () => {
    expect(motionDone(H(5, 2, 3, 6), 3, 'qcf')).toBe(true);
    expect(motionDone(H(2, 6), 1, 'qcf')).toBe(true);
    expect(motionDone(H(3, 6), 1, 'qcf')).toBe(true);
  });
  test('qcf: button more than 8 ticks after the motion is too late', () => {
    expect(motionDone(H(2, 3, 6, ...rep(5, 8)), 10, 'qcf')).toBe(true);
    expect(motionDone(H(2, 3, 6, ...rep(5, 9)), 11, 'qcf')).toBe(false);
  });
  test('qcf: a motion stretched over more than 15 ticks fails', () =>
    expect(motionDone(H(2, ...rep(5, 15), 6), 16, 'qcf')).toBe(false));
  test('dp and qcb are distinct from qcf', () => {
    expect(motionDone(H(6, 2, 3), 2, 'dp')).toBe(true); expect(motionDone(H(2, 3, 6), 2, 'dp')).toBe(false);
    expect(motionDone(H(2, 1, 4), 2, 'qcb')).toBe(true); expect(motionDone(H(2, 1, 4), 2, 'qcf')).toBe(false);
  });
  test('qcf2 within 25 ticks', () => {
    expect(motionDone(H(2, 3, 6, 2, 3, 6), 5, 'qcf2')).toBe(true);
    expect(motionDone(H(2, 3, 6, ...rep(5, 20), 2, 3, 6), 25, 'qcf2')).toBe(false);
  });
  test('charge back 40 ticks, release within 10', () => {
    expect(motionDone(H(...rep(4, 40), 6), 40, 'chargeBack')).toBe(true);
    expect(motionDone(H(...rep(4, 39), 6), 39, 'chargeBack')).toBe(false);
    expect(motionDone(H(...rep(4, 40), ...rep(5, 10), 6), 50, 'chargeBack')).toBe(false);
    expect(motionDone(H(...rep(2, 40), 8), 40, 'chargeDown')).toBe(true);
  });
  // commands.test.ts additions
  test('history stores directions relative to facing', () => {
    const s = emptyInputState(); pushInput(s, { x: 1, y: 0, buttons: 0, start: false }, -1); expect(s.history.at(-1)!.dir).toBe(4);
  });
  test('history keeps the last 60 ticks', () => { const s = emptyInputState(); for (let i = 0; i < 70; i++) pushInput(s, NEUTRAL, 1); expect(s.history).toHaveLength(60); });
  test('presses do not age while frozen (hitstop)', () => {
    const s = emptyInputState(); pushInput(s, R(0, 0, 'MP'), 1);
    for (let i = 0; i < 10; i++) pushInput(s, NEUTRAL, 1, true); expect(readCommand(s, 1).press).toBe('MP');
  });
  test('THROW and SPECIAL are buffered presses but never a normal press', () => {
    const s = emptyInputState(); pushInput(s, { x: 0, y: 0, buttons: btn('THROW', 'SPECIAL'), start: false }, 1);
    expect(s.presses.map((p) => p.button).sort()).toEqual(['SPECIAL', 'THROW']); expect(readCommand(s, 1).press).toBeNull();
  });
  // devices.test.ts additions
  test('LB is Special and LT is Throw on a pad', () => expect(readGamepad(pad(0, [4, 6])).buttons).toBe(btn('SPECIAL', 'THROW')));
  test('keyboard Y/H and Numpad7/Numpad0 are Special/Throw', () => {
    expect(readKeyboard(new Set(['KeyY', 'KeyH']), P1_KEYS).buttons).toBe(btn('SPECIAL', 'THROW'));
    expect(readKeyboard(new Set(['Numpad7', 'Numpad0']), P2_KEYS).buttons).toBe(btn('SPECIAL', 'THROW'));
  });
  ```
  Update the existing M1 calls `pushInput(s, x)` to `pushInput(s, x, 1)`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/input`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the interfaces above. In `tick.ts`, call `pushInput(f.input, raw, f.facing, f.hitstop > 0)`.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all PASS.
- [ ] **Step 5: Commit.** `feat(input): add facing-relative input history, motion detection, Throw and Special buttons`

---

### Task 2: Move model, World refactor, specials data for both fighters

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/constants.ts`, `src/engine/tick.ts`, `src/engine/step.ts`, `src/engine/match.ts`, `src/engine/fighter.ts` (import `normalMoveId` from `engine/moves`), `src/engine/validate.ts`, `src/fighters/defaults.ts`, `src/fighters/mohawk-man.ts`, `src/fighters/spin-kicker.ts`, `tests/unit/helpers.ts`
- Create: `src/engine/moves.ts`
- Test: `tests/unit/fighters/fighters.test.ts` (additions)

**Interfaces:**
- Produces, in `types.ts` (additions and changes):
  ```ts
  export type MoveKind = 'normal' | 'special' | 'super' | 'throw';
  export interface InputPattern { stance: Stance; button: Button | 'P' | 'K'; motion?: Motion }
  export interface ProjectileDef { speed: number; spawn: { x: number; y: number }; hitbox: Box; lifetime: number; hits: number; super: boolean; visual: string }
    // speed subunits/tick; spawn units from the feet (x forward); hitbox relative to the projectile's centre
  export interface MoveFrame { sprite: string; ticks: number; hurtboxes: Box[]; hitbox?: Box; hitGroup?: number; hit?: Partial<HitProps>;
    velocity?: { x: number; y: number }; flags?: MoveFlag[]; leap?: { height: number; duration: number; forward: number }; spawnProjectile?: boolean }
  export interface MoveDef { kind: MoveKind; name: string; input: InputPattern; frames: MoveFrame[]; hit: HitProps;
    cancels: ('special' | 'super' | 'chain')[]; projectile?: ProjectileDef; landing?: number }
  FighterDef += specialSlots: string[];       // base ids for Easy slots 1..4, e.g. ['karate-wave', 'mohawk-ram', 'rising-chop']
  Action += 'landing' | 'throwing' | 'thrown' | 'dizzy';
  FighterState += hitGroups: number; cancelTicks: number; easyMove: boolean; meter: number; stun: number; stunIdle: number;
    dizzyPending: boolean; dizzyUsed: boolean; comboHits: number; comboDamage: number; throwProtect: number; throwBack: boolean;
  export interface ProjectileState { owner: PlayerIndex; moveId: MoveId; x: number; y: number; vx: number; facing: Facing; ticksLeft: number; hitsLeft: number }
  MatchState += projectiles: ProjectileState[]; freeze: { ticks: number; player: PlayerIndex; name: string } | null;
  MatchConfig += easy: [boolean, boolean]; easyDamage: boolean;      // DEFAULT_CONFIG: easy [false, false], easyDamage true
  GameEvent += { type: 'superFlash'; player: PlayerIndex; name: string } | { type: 'throw' | 'throwEscape' | 'dizzy'; player: PlayerIndex }
             | { type: 'clash'; x: number; y: number };
  ```
- Produces, in `moves.ts`:
  ```ts
  export function normalMoveId(stance: Stance, button: Button): MoveId;          // moved from fighters/defaults (re-export there)
  export function effectiveHit(move: MoveDef, frame: MoveFrame): HitProps;       // { ...move.hit, ...frame.hit }
  export const strengthMoveId = (base: string, s: Strength): MoveId => `${base}-${s}`;
  ```
- Produces, in `tick.ts`: `export interface World { fs: [FighterState, FighterState]; projectiles: ProjectileState[]; easy: readonly [boolean, boolean]; easyDamage: boolean }` and `tickWorld(w: World, inputs, defs, active, events)`. This replaces `tickFighters`, with the same order as before. `step.ts` builds the World view from `MatchState`. `createFighter` initializes every new field to 0/false.
- Produces, in `defaults.ts`:
  ```ts
  export interface SpecialFrameSpec { sprite: string; ticks: number; body: Stance; hitbox?: Box; hitGroup?: number; hit?: Partial<HitProps>;
    velocity?: { x: number; y: number }; flags?: MoveFlag[]; leap?: { height: number; duration: number; forward: number }; spawnProjectile?: boolean }
  export interface SpecialSpec { id: string; name: string; kind: 'special' | 'super'; motion: Motion; group: 'P' | 'K';
    build(strength: Strength): { frames: SpecialFrameSpec[]; hit: Omit<HitProps, 'chip' | 'meterGain' | 'strength'>; landing?: number; projectile?: ProjectileDef } }
  export function buildFighter(base: FighterBase, specialSlots: string[], specials: SpecialSpec[]): FighterDef;
  // FighterBase now also omits 'specialSlots'
  ```
  - **Specials:** each special becomes 3 moves, `${id}-light|medium|heavy`, with `input { stance:'stand', motion, button: LP/MP/HP or LK/MK/HK }`, `cancels ['super']`, `chip = trunc(damage/4)`, `meterGain 0`.
  - **Supers:** each super becomes 1 move `super`, with `input { stance:'stand', motion: 'qcf2', button: group }`, built at `'heavy'` strength, `cancels []`.
  - **Scaling:** all boxes, leap heights and projectile spawn/hitbox are scaled by size, like the normals.
  - **Hurtboxes:** `body` turns into stance hurtboxes, plus the limb box when there is a hitbox, as for the normals.
- **Cancel flags on the normals template:**
  - light normals: `['special','super','chain']`
  - medium normals and `stand-hp`: `['special','super']`
  - other heavies and every jump normal: `[]`
- **Every normal gets `kind 'normal'` and `name`** equal to its id.
- **Shared throw moves:** `throw-forward` and `throw-back`, with `kind 'throw'` and `input { stance:'stand', button:'LP' }`. Frames: `throw_01` × `THROW.startup` (standing hurtboxes), then `throw_01` × `THROW.whiffRecovery`. Hit: `damage THROW.damage`, `knockdown true`, `level 'mid'`, `hitstop 0`, `chip 0`, `strength 'heavy'`, other fields 0.
- **`validateFighter` additions:**
  - every move except `kind 'throw'` and moves with a `projectile` has a hitbox frame
  - a move with a `spawnProjectile` frame has a `projectile`
  - every `specialSlots` entry has `-light`, `-medium` and `-heavy` moves
  - a `super` move exists with `kind 'super'` and motion `qcf2`
  - every special and super has a `motion`

**Special move data.** All values are in medium units; the builder scales them. "`×N`" means N frames of that description. In hitboxes, `{x,y,w,h}` means `{x:…, y:…, w:…, h:…}`. Where three values are given as L/M/H, they apply to light, medium and heavy.

*Mohawk Man:* `specialSlots ['karate-wave','mohawk-ram','rising-chop']`

| Move | Frames | Hit |
|---|---|---|
| **Karate Wave** (`qcf`, P) | `karate-wave_01` 12 stand · `karate-wave_02` 3 stand `spawnProjectile` · `karate-wave_02` 28 stand | damage 90, stun 80, hitstun 20, blockstun 16, hitstop 10, pushback 40, mid. Projectile: speed L/M/H 450/600/750, spawn `{x:70,y:160}`, hitbox `{-30,-30,60,60}`, lifetime 150, hits 1, super false, visual `'karate-wave'` |
| **Mohawk Ram** (`qcb`, P) | `mohawk-ram_01` L/M/H 10/12/14 crouch · `mohawk-ram_02` 14 stand, hitbox `{20,150,75,70}`, velocity x L/M/H 900/1100/1300 · `mohawk-ram_03` 18 stand | damage L/M/H 100/110/120, stun 100, hitstun 22, blockstun 16, hitstop 12, pushback 50, mid, knockdown heavy only |
| **Rising Chop** (`dp`, P) | `rising-chop_01` L/M/H 3/4/5 crouch `strikeInvuln` · `rising-chop_02` 4 air, hitbox `{15,150,70,160}`, leap `{height L/M/H 160/190/220, duration 34/38/42, forward 150}`, `strikeInvuln` · `rising-chop_02` 6 air, same hitbox · `rising-chop_03` 40 air; `landing 14` | damage L/M/H 110/120/140, stun 100, hitstun 20, blockstun 18, hitstop 12, pushback 40, mid, knockdown true |
| **Super: Thousand Chops** (`qcf2`, P) | `super_01` 1 stand `strikeInvuln` · ×5: `super_02`/`super_03` alternating, 4 ticks, stand, hitbox `{20,120,100,120}`, hitGroup 0–4, velocity x 200, first two `strikeInvuln` · `super_04` 6 stand, same hitbox, hitGroup 5, `hit {damage:100, knockdown:true, hitstop:14, pushback:80}` · `super_04` 30 stand | base: damage 40, stun 0, hitstun 24, blockstun 18, hitstop 6, pushback 10, mid |

*Spin Kicker:* `specialSlots ['tornado-kick','cartwheel','handspring-heel']`

| Move | Frames | Hit |
|---|---|---|
| **Tornado Kick** (`qcf`, K) | `tornado-kick_01` 8 stand · ×(L/M/H 3/4/5): `tornado-kick_02`/`_03` alternating, 5 ticks, stand, hitbox `{10,120,95,70}`, hitGroup i, velocity x 450; the last one has `hit {knockdown:true}` · `tornado-kick_01` 16 stand | damage 35, stun 30, hitstun 22, blockstun 14, hitstop 6, pushback 15, mid |
| **Cartwheel** (`qcb`, K) | `cartwheel_01` 4 crouch · `cartwheel_01` L/M/H 14/18/22 stand, velocity x 900, `projectileInvuln` · `cartwheel_02` 6 stand, hitbox `{20,40,70,70}` · `cartwheel_02` 12 stand | damage 50, stun 50, hitstun 18, blockstun 12, hitstop 10, pushback 30, mid |
| **Handspring Heel** (`dp`, K) | `handspring-heel_01` L/M/H 16/18/20 crouch · `handspring-heel_02` 8 air, leap `{height 70, duration 20, forward 300}` · `handspring-heel_03` 8 air, hitbox `{20,60,85,100}` · `handspring-heel_03` 30 air; `landing 10` | damage L/M/H 90/100/110, stun 90, hitstun 20, blockstun 14, hitstop 12, pushback 35, **overhead** |
| **Super: Human Tornado** (`qcf2`, K) | `super_01` 1 stand `strikeInvuln` · ×8: `super_02`/`_03` alternating, 4 ticks, stand, hitbox `{-40,20,140,220}`, hitGroup 0–7, velocity x 300, first two `strikeInvuln` · `super_04` 6 stand, same hitbox, hitGroup 8, `hit {damage:60, knockdown:true, hitstop:14, pushback:80}` · `super_04` 28 stand | base: damage 30, stun 0, hitstun 24, blockstun 18, hitstop 6, pushback 10, mid |

Both supers deal 300 before scaling.

- [ ] **Step 1: Write the failing tests** (additions to `fighters.test.ts`):
  ```ts
  test('specials come in three strengths with exact button inputs', () => {
    const m = getFighter('mohawk-man')!.moves;
    expect(m['karate-wave-heavy']!.input).toEqual({ stance: 'stand', motion: 'qcf', button: 'HP' });
    expect(m['karate-wave-light']!.projectile!.speed).toBe(450); expect(m['karate-wave-medium']!.kind).toBe('special');
  });
  test('supers deal 300 before scaling', () => {
    for (const id of FIGHTER_IDS) { const s = getFighter(id)!.moves['super']!;
      const total = s.frames.filter((f) => f.hitbox).reduce((t, f) => t + (f.hit?.damage ?? s.hit.damage), 0);
      expect(total).toBe(300); expect(s.input.motion).toBe('qcf2'); }
  });
  test('Tornado Kick hits 3/4/5 times by strength', () => {
    const m = getFighter('spin-kicker')!.moves;
    expect(['light', 'medium', 'heavy'].map((s) => m[`tornado-kick-${s}`]!.frames.filter((f) => f.hitbox).length)).toEqual([3, 4, 5]);
  });
  test('normals carry cancel flags; jump normals do not cancel', () => {
    const m = getFighter('spin-kicker')!.moves;
    expect(m['stand-lp']!.cancels).toEqual(['special', 'super', 'chain']); expect(m['crouch-mk']!.cancels).toEqual(['special', 'super']);
    expect(m['crouch-hk']!.cancels).toEqual([]); expect(m['jump-mp']!.cancels).toEqual([]);
  });
  test('Easy slots point at real moves', () => {
    for (const id of FIGHTER_IDS) { const d = getFighter(id)!; expect(d.specialSlots.length).toBeGreaterThanOrEqual(3);
      for (const s of d.specialSlots) expect(d.moves[`${s}-medium`]).toBeDefined(); }
  });
  test('validateFighter rejects a projectile move without a projectile def', () => {
    const d = structuredClone(getFighter('mohawk-man')!); delete d.moves['karate-wave-light']!.projectile;
    expect(validateFighter(d).some((e) => e.includes('karate-wave-light'))).toBe(true);
  });
  ```
  Update `tests/unit/helpers.ts`:
  - `Ctx` becomes `World & { defs: Defs }`.
  - `fightPair` returns `{ fs, defs, projectiles: [], easy: [false, false], easyDamage: true }`.
  - `tickN` calls `tickWorld`.
  - Add `motion(ctx, player: 0 | 1, dirs: number[], ...buttons): GameEvent[]`, which ticks once per direction (world-relative numpad), presses the buttons on the last tick with the other player neutral, and returns the events.
- [ ] **Step 2: Run** `npx vitest run tests/unit/fighters`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the types, `moves.ts`, the World refactor, the builder, the two fighters' data and the validation additions.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all PASS, including every M1 test (behavior is unchanged so far).
- [ ] **Step 5: Commit.** `feat(fighters): add move kinds, specials and supers for Mohawk Man and Spin Kicker; World refactor`

---

### Task 3: Intent resolution (what move did the player ask for?)

**Files:**
- Create: `src/engine/intent.ts`
- Test: `tests/unit/engine/intent.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Intent = { type: 'move'; moveId: MoveId; easy: boolean } | { type: 'throw'; back: boolean };
  export interface IntentContext { def: FighterDef; stance: Stance; meter: number; hasProjectile: boolean; easy: boolean; throwInRange: boolean }
  export function resolveIntent(input: InputState, ctx: IntentContext): Intent | null;
  ```

**Rules:**
- **Each buffered press** `{ button, age }` has press index `history.length − 1 − age`.
- **Air** (`stance 'air'`): only normals, using `normalMoveId('air', highest-priority attack press)`.
- **Ground**, in priority order:
  1. **Super:**
     - `meter >= METER_MAX`, and a `super` move whose `input.button` group (P = LP/MP/HP, K = LK/MK/HK) contains a pressed button, and `motionDone(history, pressIndex, 'qcf2')`.
     - Easy version: `easy` is on, SPECIAL is pressed, and HP or HK was pressed within 2 ticks of it (ages differ by ≤ 2), with a full meter. This gives `{ moveId:'super', easy:true }`.
  2. **Special:**
     - A `kind 'special'` move whose `input.button` equals a pressed button and `motionDone(history, pressIndex, input.motion)`.
     - Skip moves with a `projectile` when `hasProjectile`.
     - If several match, prefer motions in the order `dp, chargeDown, chargeBack, qcb, qcf`.
     - Easy version: `easy` is on and SPECIAL is pressed. Read the direction at its press index:
       - `{1,2,3}` → slot 3
       - `{6,9}` → slot 2
       - `{4,7}` → slot 4, or slot 1 if there is no slot 4
       - anything else → slot 1
       - This gives `${slot}-medium` with `easy:true`. If that move has a projectile and `hasProjectile`, there is no Easy special.
  3. **Throw** (only when not holding down, i.e. `stance 'stand'`):
     - either a THROW press, or LP and LK both pressed within 2 ticks of each other while `throwInRange`
     - gives `{ type:'throw', back }`, where `back` = the direction at the press is in `{1,4,7}`
  4. **Normal:** the highest-priority attack press, giving `normalMoveId(stance, button)` with `easy:false`.
- **Nothing pressed** → `null`.

- [ ] **Step 1: Write the failing tests.** Helper `feed(seq: [dir, ...InputButton[]][], facing = 1)` pushes one frame per entry, with directions in numpad notation that are **world**-relative, and returns an InputState. `ctx(over)` returns a Mohawk Man context: `{ def: mohawk, stance:'stand', meter:0, hasProjectile:false, easy:false, throwInRange:false, ...over }`.
  ```ts
  test('qcf + punch strength picks the variant', () => {
    expect(resolveIntent(feed([[2], [3], [6, 'LP']]), ctx())).toEqual({ type: 'move', moveId: 'karate-wave-light', easy: false });
    expect(resolveIntent(feed([[2], [3], [6, 'HP']]), ctx())).toMatchObject({ moveId: 'karate-wave-heavy' });
  });
  test('dp beats qcf when both are present', () => expect(resolveIntent(feed([[6], [2], [3, 'MP']]), ctx())).toMatchObject({ moveId: 'rising-chop-medium' }));
  test('qcb + punch is Mohawk Ram', () => expect(resolveIntent(feed([[2], [1], [4, 'LP']]), ctx())).toMatchObject({ moveId: 'mohawk-ram-light' }));
  test('super with a full meter', () =>
    expect(resolveIntent(feed([[2], [3], [6], [2], [3], [6, 'MP']]), ctx({ meter: 1000 }))).toMatchObject({ moveId: 'super' }));
  test('REVIEW FOCUS: super motion without full meter falls back to the special', () =>
    expect(resolveIntent(feed([[2], [3], [6], [2], [3], [6, 'MP']]), ctx({ meter: 999 }))).toMatchObject({ moveId: 'karate-wave-medium' }));
  test('REVIEW FOCUS: fireball motion with a projectile out gives a normal punch', () =>
    expect(resolveIntent(feed([[2], [3], [6, 'LP']]), ctx({ hasProjectile: true }))).toMatchObject({ moveId: 'stand-lp' }));
  test('REVIEW FOCUS: after a cross-up, the motion toward the new side is a qcf', () =>
    expect(resolveIntent(feed([[2], [1], [4, 'LP']], -1), ctx())).toMatchObject({ moveId: 'karate-wave-light' }));
  test('Easy Special by direction, only when Easy is on', () => {
    expect(resolveIntent(feed([[5, 'SPECIAL']]), ctx({ easy: true }))).toEqual({ type: 'move', moveId: 'karate-wave-medium', easy: true });
    expect(resolveIntent(feed([[6, 'SPECIAL']]), ctx({ easy: true }))).toMatchObject({ moveId: 'mohawk-ram-medium' });
    expect(resolveIntent(feed([[3, 'SPECIAL']]), ctx({ easy: true }))).toMatchObject({ moveId: 'rising-chop-medium' });
    expect(resolveIntent(feed([[4, 'SPECIAL']]), ctx({ easy: true }))).toMatchObject({ moveId: 'karate-wave-medium' });
    expect(resolveIntent(feed([[5, 'SPECIAL']]), ctx({ easy: false }))).toBeNull();
  });
  test('Easy super: Special + Heavy with a full meter; without meter it is the special', () => {
    expect(resolveIntent(feed([[5, 'SPECIAL', 'HP']]), ctx({ easy: true, meter: 1000 }))).toEqual({ type: 'move', moveId: 'super', easy: true });
    expect(resolveIntent(feed([[5, 'SPECIAL', 'HP']]), ctx({ easy: true, meter: 0 }))).toMatchObject({ moveId: 'karate-wave-medium' });
  });
  test('throws: LP+LK in range, back throw, out of range, Throw button', () => {
    expect(resolveIntent(feed([[5, 'LP', 'LK']]), ctx({ throwInRange: true }))).toEqual({ type: 'throw', back: false });
    expect(resolveIntent(feed([[4, 'LP', 'LK']]), ctx({ throwInRange: true }))).toEqual({ type: 'throw', back: true });
    expect(resolveIntent(feed([[5, 'LP', 'LK']]), ctx({ throwInRange: false }))).toMatchObject({ moveId: 'stand-lp' });
    expect(resolveIntent(feed([[5, 'THROW']]), ctx({ throwInRange: false }))).toEqual({ type: 'throw', back: false });
  });
  test('air: normals only', () => expect(resolveIntent(feed([[2], [3], [6, 'HK']]), ctx({ stance: 'air' }))).toMatchObject({ moveId: 'jump-hk' }));
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/intent.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `resolveIntent`.
- [ ] **Step 4: Run** `npx vitest run tests/unit/engine/intent.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(engine): resolve player intent with super > special > throw > normal priority and Easy mode`

---

### Task 4: Executing specials and supers: movement, leaps, cancels, chains, whiff meter

**Files:**
- Modify: `src/engine/fighter.ts`, `src/engine/combat.ts` (hit groups, `cancelTicks` on contact), `src/engine/tick.ts`
- Test: `tests/unit/engine/specials.test.ts`

**Interfaces:**
- Produces, in `fighter.ts`:
  ```ts
  export function startMove(f: FighterState, def: FighterDef, moveId: MoveId, easy: boolean, me: PlayerIndex, events: GameEvent[]): void;
    // action 'attack', moveId, actionTick 0, hasHit false, hitGroups 0, cancelTicks 0, easyMove = easy, clearPresses.
    // kind 'super': meter -= METER_MAX and emit { type:'superFlash', player: me, name: move.name }.
  export function activeHit(f: FighterState, def: FighterDef): { box: Box; group: number; hit: HitProps; kind: MoveKind } | null;
    // replaces activeHitbox for combat; activeHitbox stays for rendering
  ```
- **`updateFighter` gains a final parameter `w: World`**, which `tickWorld` passes in.
- **`decide()`** builds an `IntentContext`, using `stance = cmd.down ? 'crouch' : 'stand'`, `hasProjectile` from the world, `easy = w.easy[me]` and `throwInRange: false` (Task 7 fills it in). It calls `resolveIntent`:
  - a move intent → `startMove`
  - a throw intent → `startMove('throw-forward' | 'throw-back')` (Task 7 adds the grab)
  - no intent → the existing M1 movement logic
  - air attacks use `resolveIntent` with `stance 'air'`
- **Frame entry effects** (when `actionTick` equals a frame's start):
  - `leap` → set the arc `{t:0, duration, height, startY: y, vx: forward*facing}`
  - `spawnProjectile` frames do nothing yet; Task 5 adds the call
- **Each tick of a frame with `velocity`:** `x += velocity.x * facing` (normalize `-0`).
- **Landing:** landing during an attack whose move has `landing` → action `'landing'` with `stunTicks = landing`, then `idle`. Without `landing`, M1 behavior.
- **Hit groups:** in combat, a hitbox frame can connect only if bit `group` is not set in `f.hitGroups`. Contact sets the bit, plus `hasHit = true` and `cancelTicks = CANCEL_WINDOW_TICKS`.
- **Cancels:** in `updateFighter`, after the hitstop check:
  - if `action === 'attack' && hasHit && cancelTicks > 0`, resolve the intent and start it **only** when:
    - it is a special and the current move's `cancels` includes `'special'`, or
    - it is the super and `cancels` includes `'super'`, or
    - it is a light normal (LP/LK) and the current move is a light normal with `'chain'`
  - then `cancelTicks--`
- **Whiff meter:** when a `kind 'special'` move ends (its frames run out, or landing) with `hasHit` false → `meter += METER_GAIN.specialWhiff` (clamped to `METER_MAX`).

- [ ] **Step 1: Write the failing tests** (using the `motion` helper and `fightPair`):
  ```ts
  test('qcf + LP starts Karate Wave light', () => {
    const c = fightPair(); motion(c, 0, [2, 3, 6], 'LP'); expect(c.fs[0].moveId).toBe('karate-wave-light');
  });
  test('Mohawk Ram travels forward', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 300, 1200); const x0 = c.fs[0].x; motion(c, 0, [2, 1, 4], 'LP');
    tickN(c, 10 + 14); expect(c.fs[0].x - x0).toBe(14 * 900);
  });
  test('Rising Chop leaves the ground and ends in landing recovery', () => {
    const c = fightPair(); motion(c, 0, [6, 2, 3], 'HP'); tickN(c, 8); expect(c.fs[0].y).toBeGreaterThan(0);
    tickN(c, 40); expect(c.fs[0].action).toBe('landing'); tickN(c, 14); expect(c.fs[0].action).toBe('idle');
  });
  test('Tornado Kick light hits three times', () => {
    const c = fightPair('spin-kicker', 'mohawk-man', 900, 990); const ev = motion(c, 0, [2, 3, 6], 'LK').concat(tickN(c, 120));
    expect(ev.filter((e) => e.type === 'hit')).toHaveLength(3);
  });
  test('crouch MK → Karate Wave cancels on hit within the window', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 990); tickN(c, 1, raw(2, 'MK')); tickN(c, 6, raw(2));
    expect(c.fs[0].hasHit).toBe(true); motion(c, 0, [3, 6], 'LP'); tickN(c, 10);
    expect(c.fs[0].moveId).toBe('karate-wave-light');
  });
  test('no cancel on whiff: the special waits for recovery', () => {
    const c = fightPair(); tickN(c, 1, raw(2, 'MK')); tickN(c, 6, raw(2)); motion(c, 0, [3, 6], 'LP');
    expect(c.fs[0].moveId).toBe('crouch-mk');
  });
  test('light chain: LP into LP on hit', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 990); tickN(c, 1, raw(5, 'LP')); tickN(c, 4 + 8);
    tickN(c, 1, raw(5, 'LP')); expect(c.fs[0]).toMatchObject({ moveId: 'stand-lp', actionTick: 0 });
  });
  test('super spends the bar and announces itself', () => {
    const c = fightPair(); c.fs[0].meter = 1000; const ev = motion(c, 0, [2, 3, 6, 2, 3, 6], 'LP');
    expect(c.fs[0]).toMatchObject({ moveId: 'super', meter: 0 }); expect(ev).toContainEqual({ type: 'superFlash', player: 0, name: 'Thousand Chops' });
  });
  test('a missed special gains 30 meter', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 300, 1200); motion(c, 0, [2, 1, 4], 'LP'); tickN(c, 60); expect(c.fs[0].meter).toBe(30);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/specials.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the rules above.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all PASS.
- [ ] **Step 5: Commit.** `feat(engine): execute specials and supers with leaps, movement, cancels, chains and whiff meter`

---

### Task 5: Projectiles

**Files:**
- Create: `src/engine/projectiles.ts`
- Modify: `src/engine/tick.ts` (call `updateProjectiles` after `separate`, before `resolveHits`), `src/engine/fighter.ts` (spawn hook), `src/engine/combat.ts` (export the hit-application used by projectiles)
- Test: `tests/unit/engine/projectiles.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function hasProjectile(w: World, owner: PlayerIndex): boolean;
  export function spawnProjectile(w: World, owner: PlayerIndex, f: FighterState, moveId: MoveId, def: ProjectileDef): void;
    // x = f.x + spawn.x*SUB*facing, y = f.y + spawn.y*SUB, vx = speed*facing, ticksLeft = lifetime, hitsLeft = hits
  export function updateProjectiles(w: World, defs: Defs, active: boolean, events: GameEvent[]): void;
  ```
- Produces, in `combat.ts`:
  ```ts
  export interface Contact { att: PlayerIndex; hit: HitProps; kind: MoveKind; easy: boolean; at: { x: number; y: number }; projectile: boolean }
  export function applyContact(w: World, defs: Defs, c: Contact, events: GameEvent[]): void; // shared by fighters and projectiles
  ```
  For a projectile contact, only the defender gets hitstop. The owner is not frozen and is not marked `hasHit`.

**`updateProjectiles`, in order:**
1. **Move:** `x += vx`, `ticksLeft--`. Remove when `ticksLeft <= 0` or `x` is outside `[0, STAGE_WIDTH*SUB]`.
2. **Clash:** when opposing projectiles' world hitboxes overlap:
   - both `super`, or both not: remove both and emit `clash` at the overlap center
   - otherwise: remove only the non-super one
3. **Hit:** only if `active`. Test against the opponent's `hurtboxes`, skipping when the opponent's current frame has `projectileInvuln`.
   - On contact: `applyContact` with the owner's move hit props and kind (`'special'`), then `hitsLeft--`, and remove the projectile at 0.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('Karate Wave spawns in front at the spawn frame and travels', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 400, 1500); motion(c, 0, [2, 3, 6], 'LP'); tickN(c, 12);
    expect(c.projectiles).toHaveLength(1); const x = c.projectiles[0]!.x; tickN(c, 10);
    expect(c.projectiles[0]!.x - x).toBe(10 * 450);
  });
  test('the projectile hits a far opponent and disappears', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 400, 900); motion(c, 0, [2, 3, 6], 'HP'); const ev = tickN(c, 120);
    expect(ev.some((e) => e.type === 'hit' && e.attacker === 0)).toBe(true); expect(c.fs[1].health).toBe(950 - 90); expect(c.projectiles).toHaveLength(0);
  });
  test('REVIEW FOCUS: only one projectile on screen; the second motion gives a normal', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 200, 1500); motion(c, 0, [2, 3, 6], 'LP'); tickN(c, 50);
    motion(c, 0, [2, 3, 6], 'LP'); expect(c.fs[0].moveId).toBe('stand-lp'); tickN(c, 20); expect(c.projectiles).toHaveLength(1);
  });
  test('projectiles clash and cancel', () => {
    const c = fightPair('mohawk-man', 'mohawk-man', 500, 1300);
    for (const d of [2, 3]) tickN(c, 1, raw(d), raw(d === 2 ? 2 : 1)); const ev = tickN(c, 1, raw(6, 'LP'), raw(4, 'LP')).concat(tickN(c, 120));
    expect(ev.some((e) => e.type === 'clash')).toBe(true); expect(c.fs[0].health).toBe(1000); expect(c.fs[1].health).toBe(1000);
  });
  test('Cartwheel passes through a projectile', () => {
    const c = fightPair('spin-kicker', 'mohawk-man', 800, 1100); motion(c, 1, [2, 1, 4], 'LP'); tickN(c, 8);
    motion(c, 0, [2, 1, 4], 'HK'); tickN(c, 30); expect(c.fs[0].health).toBe(950);
  });
  test('a projectile leaving the stage is removed (before its lifetime runs out)', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 1500, 1700); c.fs[1].action = 'down'; c.fs[1].ko = true; // lying: nothing to hit
    motion(c, 0, [2, 3, 6], 'HP'); tickN(c, 12); expect(c.projectiles).toHaveLength(1);
    tickN(c, 60); expect(c.projectiles).toHaveLength(0);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/projectiles.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all PASS.
- [ ] **Step 5: Commit.** `feat(engine): add projectiles with one-per-fighter, clashes and projectile invulnerability`

---

### Task 6: Chip, damage scaling, combos, meter, invulnerability, Easy damage

**Files:**
- Modify: `src/engine/combat.ts`, `src/engine/fighter.ts` (reset combo on becoming actionable; hurtboxes for the new actions)
- Test: `tests/unit/engine/damage.test.ts`

**Interfaces:**
- Produces, in `combat.ts`: `export function scalePercent(hitNumber: number, isSuper: boolean): number`
  - hits 1–2 → 100, hit 3 → 80, then −10 per hit
  - floor 40, or 50 for supers

**Rules for `applyContact`:**
- **Easy damage:** `base = hit.damage`. If `c.easy && w.easyDamage`, then `base = trunc(base*EASY_DAMAGE_PERCENT/100)`.
- **Block** (M1 blocking rules):
  - chip `= trunc(base*CHIP_PERCENT/100)` for `kind` special/super, otherwise 0
  - `health -= chip`; if `health <= 0` → health 0, `ko`, knockdown (**chip KO**)
- **Hit:**
  - The combo continues if the defender's action was `hitstun`, `knockdown`, `airReset` or `thrown`: `comboHits += 1`. Otherwise `comboHits = 1`, `comboDamage = 0`.
  - `damage = trunc(base*scalePercent(comboHits, kind==='super')/100)`; `comboDamage += damage`.
- **Meter, attacker** (`c.att`, which is the owner for projectile hits):
  - normal: `+hit.meterGain` on hit or block
  - special: `+100` on hit, `+50` on block
  - super and throw: `+0`
- **Meter, defender:** `+trunc(damageTaken*METER_GAIN.damageTakenPercent/100)` for hit damage and chip.
- **Clamp:** both meters to `[0, METER_MAX]`.
- **Invulnerability**, from the defender's current frame flags:
  - `strikeInvuln`: fighter hitboxes miss (projectiles still hit unless `projectileInvuln`)
  - `upperInvuln`: only `level 'low'` attacks connect
- **Combo end:** a fighter that becomes actionable, or enters `down`, sets `comboHits = 0`, `comboDamage = 0`, `dizzyUsed = false`.
- **Hurtboxes:**
  - `thrown`, `throwing` → `[]`
  - `landing` → crouching
  - `dizzy` → standing

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('scalePercent', () => expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => scalePercent(n, false))).toEqual([100, 100, 80, 70, 60, 50, 40, 40, 40]));
  test('supers never scale below 50%', () => expect(scalePercent(9, true)).toBe(50));
  test('blocked Karate Wave deals 25% chip', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 400, 900); motion(c, 0, [2, 3, 6], 'HP', ); tickN(c, 120, raw(), raw(6));
    expect(c.fs[1].health).toBe(950 - 22);
  });
  test('chip damage can KO', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 400, 900); c.fs[1].health = 10; motion(c, 0, [2, 3, 6], 'HP'); tickN(c, 120, raw(), raw(6));
    expect(c.fs[1]).toMatchObject({ health: 0, ko: true });
  });
  test('the 4th hit of a combo deals 70%', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); c.fs[1].action = 'hitstun'; c.fs[1].stunTicks = 30; c.fs[1].comboHits = 3;
    tickN(c, 1, raw(5, 'HP')); tickN(c, 9); expect(c.fs[1].health).toBe(950 - 70); expect(c.fs[1].comboHits).toBe(4);
  });
  test('meter: attacker +40 for a light hit, defender +15 for taking 30', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); tickN(c, 1, raw(5, 'LP')); tickN(c, 4);
    expect(c.fs[0].meter).toBe(40); expect(c.fs[1].meter).toBe(15);
  });
  test('Easy specials deal 85% damage; the option can turn it off', () => {
    for (const [easyDamage, hp] of [[true, 950 - 76], [false, 950 - 90]] as const) {
      const c = fightPair('mohawk-man', 'spin-kicker', 400, 900); c.easy = [true, false]; c.easyDamage = easyDamage;
      tickN(c, 1, raw(5, 'SPECIAL')); tickN(c, 120); expect(c.fs[1].health).toBe(hp);
    }
  });
  test('Rising Chop startup is invulnerable to strikes', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 980);
    setAttack(c.fs[0], 'rising-chop-heavy', 0); setAttack(c.fs[1], 'stand-hp', 9); // P2's punch is active next tick
    tickN(c, 1); expect(c.fs[0].health).toBe(1000);
  });
  test('upperInvuln: mids miss, lows connect', () => {
    for (const [press, hold, hp] of [[raw(5, 'HP'), raw(), 950], [raw(2, 'MK'), raw(2), 890]] as const) {
      const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); const defs = structuredClone(c.defs) as Defs;
      for (const f of defs[1].moves['throw-forward']!.frames) f.flags = ['upperInvuln']; // a move with no hitbox of its own
      const w = { ...c, defs }; setAttack(w.fs[1], 'throw-forward', 4);
      tickN(w, 1, press); tickN(w, 10, hold); expect(w.fs[1].health).toBe(hp);
    }
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/damage.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all PASS. The M1 combat tests still pass because a single hit scales at 100%.
- [ ] **Step 5: Commit.** `feat(engine): add chip, damage scaling, combo tracking, meter gain, invulnerability and Easy damage`

---

### Task 7: Throws and throw escapes

**Files:**
- Create: `src/engine/throws.ts`
- Modify: `src/engine/fighter.ts` (`throwInRange` in the intent context; throw protection countdown; set protection when leaving hitstun, blockstun or getup), `src/engine/tick.ts` (call `resolveThrows` after `updateFighter` ×2, when `active`)
- Test: `tests/unit/engine/throws.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function throwable(d: FighterState, dDef: FighterDef): boolean;
  export function inThrowRange(a: FighterState, d: FighterState): boolean;   // |dx| <= THROW.range*SUB
  export function resolveThrows(w: World, defs: Defs, events: GameEvent[]): void;
  ```

**Rules:**
- **`throwable`:**
  - grounded (`arc === null`, `y === 0`)
  - action not in `hitstun, blockstun, knockdown, down, getup, airReset, thrown, throwing, landing`
  - `throwProtect === 0`
  - current frame has no `throwInvuln`
- **Grab:** in `resolveThrows`, for each fighter in `throw-forward` or `throw-back` with `actionTick === THROW.startup`, check `inThrowRange` and `throwable(opponent)`.
  - **Both fighters grabbing on the same tick** (a simultaneous throw): both become `idle`, both are pushed apart by `THROW.breakPush` units each (using `push`), and `throwEscape` is emitted for both.
  - **One fighter grabbing:**
    - attacker becomes `throwing`, defender becomes `thrown` (`actionTick 0`)
    - `defender.throwBack` = the move is `throw-back`
    - emit `throw`
  - **No grab:** the move continues into its whiff recovery.
- **Escape:** while the defender is `thrown` with `actionTick < THROW.escapeWindow`, a buffered THROW press, or LP and LK within 2 ticks, breaks the throw:
  - both fighters become `idle` and are pushed apart
  - emit `throwEscape` for the defender
  - clear the defender's presses
- **Throw lands:** when the attacker is `throwing` and `actionTick === THROW.hitTick`, `applyContact` with the throw hit (kind `'throw'`, unblockable: skip `blockStance`).
  - For a back throw, first move the defender to `attacker.x − attacker.facing*THROW.behind*SUB`.
  - The knockdown direction is `away = −attacker.facing` for a back throw, `attacker.facing` otherwise.
  - The attacker becomes `idle` at `actionTick === THROW.duration`.
- **Protection:** a fighter leaving `hitstun`, `blockstun` or `getup` gets `throwProtect = THROW_PROTECT_TICKS`, which decrements each tick.

- [ ] **Step 1: Write the failing tests** (`close = () => fightPair('mohawk-man','spin-kicker',900,965)`):
  ```ts
  test('LP+LK in range grabs after 3 ticks and deals 120 at tick 20', () => {
    const c = close(); tickN(c, 1, raw(5, 'LP', 'LK')); tickN(c, 3);
    expect(c.fs[0].action).toBe('throwing'); expect(c.fs[1].action).toBe('thrown');
    tickN(c, 20); expect(c.fs[1].health).toBe(950 - 120); expect(['knockdown', 'down']).toContain(c.fs[1].action);
  });
  test('back throw puts the defender on the other side', () => {
    const c = close(); tickN(c, 1, raw(4, 'LP', 'LK')); tickN(c, 3 + 20 + 30); expect(c.fs[1].x).toBeLessThan(c.fs[0].x);
  });
  test('Throw button out of range whiffs into recovery', () => {
    const c = fightPair(); tickN(c, 1, raw(5, 'THROW')); tickN(c, 3); expect(c.fs[0]).toMatchObject({ action: 'attack', moveId: 'throw-forward' });
    tickN(c, 20); expect(c.fs[0].action).toBe('idle');
  });
  test('escape within 7 ticks: no damage, both idle, ESCAPE event', () => {
    const c = close(); tickN(c, 1, raw(5, 'LP', 'LK')); tickN(c, 3); const ev = tickN(c, 1, raw(), raw(5, 'THROW'));
    expect(ev).toContainEqual({ type: 'throwEscape', player: 1 }); tickN(c, 30); expect(c.fs[1].health).toBe(950);
  });
  test('escape at the 8th tick is too late', () => {
    const c = close(); tickN(c, 1, raw(5, 'LP', 'LK')); tickN(c, 3); tickN(c, 7); tickN(c, 1, raw(), raw(5, 'THROW')); tickN(c, 20);
    expect(c.fs[1].health).toBe(830);
  });
  test('REVIEW FOCUS: simultaneous throws both break', () => {
    const c = close(); const ev = tickN(c, 1, raw(5, 'LP', 'LK'), raw(5, 'LP', 'LK')).concat(tickN(c, 30));
    expect(ev.filter((e) => e.type === 'throwEscape')).toHaveLength(2); expect(c.fs[0].health).toBe(1000); expect(c.fs[1].health).toBe(950);
  });
  test('cannot throw an opponent in blockstun or in the 6 ticks after it', () => {
    const c = close(); c.fs[1].action = 'blockstun'; c.fs[1].stunTicks = 5; tickN(c, 1, raw(5, 'THROW')); tickN(c, 3);
    expect(c.fs[1].action).not.toBe('thrown');
  });
  test('cannot throw an airborne opponent', () => {
    const c = close(); c.fs[1].action = 'air'; c.fs[1].arc = { t: 5, duration: 40, height: 230, startY: 0, vx: 0 }; c.fs[1].y = 4000;
    tickN(c, 1, raw(5, 'THROW')); tickN(c, 3); expect(c.fs[1].action).not.toBe('thrown');
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/throws.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all PASS.
- [ ] **Step 5: Commit.** `feat(engine): add throws, back throws, throw escapes, simultaneous-throw breaks and throw protection`

---

### Task 8: Stun and dizzy

**Files:**
- Create: `src/engine/stun.ts`
- Modify: `src/engine/combat.ts` (add stun on hit), `src/engine/fighter.ts` (drain each tick; enter dizzy instead of idle; mashing; the dizzy action)
- Test: `tests/unit/engine/stun.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function addStun(d: FighterState, dDef: FighterDef, amount: number): void;   // skipped when dizzyUsed; sets stunIdle 0; at >= stunLimit: dizzyPending, dizzyUsed
  export function drainStun(f: FighterState): void;   // stunIdle++; once stunIdle > STUN.drainDelay: stun = max(0, stun - STUN.drainPerTick)
  export function maybeEnterDizzy(f: FighterState, me: PlayerIndex, events: GameEvent[]): boolean;
    // called where hitstun or getup would end in idle: if dizzyPending and !ko → action 'dizzy', stunTicks STUN.dizzyTicks, stun 0, emit 'dizzy'
  export function mashDizzy(f: FighterState): void;  // each new press, or a change of dir vs the previous history frame, reduces stunTicks by STUN.mashTicks
  ```

**Dizzy rules:**
- A dizzy fighter is not actionable. It is hittable with standing hurtboxes and throwable.
- A hit ends dizzy (normal hit reaction).
- At `stunTicks <= 0` it becomes `idle`.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('stun builds on hit and drains 4 per tick after 60 quiet ticks', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); tickN(c, 1, raw(5, 'HP')); tickN(c, 9); expect(c.fs[1].stun).toBe(100);
    tickN(c, 60); expect(c.fs[1].stun).toBe(100); tickN(c, 1); expect(c.fs[1].stun).toBe(96); tickN(c, 10); expect(c.fs[1].stun).toBe(56);
  });
  test('filling the stun bar makes the fighter dizzy when hitstun ends', () => {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); c.fs[1].stun = 450; tickN(c, 1, raw(5, 'HP')); tickN(c, 9);
    const ev = tickN(c, 12 + 25 + 1); expect(ev).toContainEqual({ type: 'dizzy', player: 1 });
    expect(c.fs[1]).toMatchObject({ action: 'dizzy', stun: 0 });
  });
  test('dizzy lasts 120 ticks; mashing shortens it by 3 per input', () => {
    const a = fightPair(); a.fs[1].action = 'dizzy'; a.fs[1].stunTicks = 120; tickN(a, 119); expect(a.fs[1].action).toBe('dizzy'); tickN(a, 1); expect(a.fs[1].action).toBe('idle');
    const b = fightPair(); b.fs[1].action = 'dizzy'; b.fs[1].stunTicks = 120;
    for (let i = 0; i < 10; i++) { tickN(b, 1, raw(), raw(5, 'LP')); tickN(b, 1); } expect(b.fs[1].stunTicks).toBeLessThanOrEqual(120 - 20 - 30);
  });
  test('cannot be dizzied twice in one combo', () => {
    const c = fightPair(); c.fs[1].dizzyUsed = true; c.fs[1].stun = 0; addStun(c.fs[1], c.defs[1], 600); expect(c.fs[1].dizzyPending).toBe(false);
  });
  ```
  `drainStun` runs at the top of `updateFighter`, **before** the hitstop check, so hitstop ticks count as quiet ticks.
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/stun.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all PASS.
- [ ] **Step 5: Commit.** `feat(engine): add stun build-up, drain, dizzy and mashing out`

---

### Task 9: Match level: super freeze, projectiles and meter across rounds

**Files:**
- Modify: `src/engine/match.ts`, `src/engine/step.ts`, `src/engine/fighter.ts` (`resetForRound` keeps `meter` and resets stun and combo fields)
- Test: `tests/unit/engine/match.test.ts` (additions)

**Rules:**
- **`createMatch`:**
  - `projectiles: []`, `freeze: null`, meters 0
  - config merged over `DEFAULT_CONFIG` (`{ roundsToWin: 2, roundSeconds: 99, easy: [false, false], easyDamage: true }`)
- **fight phase:**
  - if `freeze` is set: `freeze.ticks--`; when it hits 0 → `freeze = null`. **No** fighter, projectile or timer update during the freeze.
  - otherwise `tickWorld`. If a `superFlash` event came out, set `freeze = { ticks: SUPER_FREEZE_TICKS, player, name }`.
- **ko, roundEnd and matchEnd:** `tickWorld` with `active = false` (projectiles move but cannot hit).
- **`startNextRound`:** clears `projectiles` and `freeze`. Meters carry over.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('super freeze: 30 ticks with no movement and no timer', () => {
    let s = toFight(createMatch(defs)); s.fighters[0].meter = 1000;
    for (const d of [2, 3, 6, 2, 3]) s = run(s, 1, raw(d)).state; s = run(s, 1, raw(6, 'LP')).state;
    expect(s.freeze).toMatchObject({ ticks: 30, player: 0, name: 'Thousand Chops' });
    const timer = s.timer, at = s.fighters[0].actionTick; s = run(s, 29).state;
    expect(s.timer).toBe(timer); expect(s.fighters[0].actionTick).toBe(at); s = run(s, 1).state; expect(s.freeze).toBeNull();
  });
  test('meter carries into the next round and resets for a new match', () => {
    let s = toFight(createMatch(defs)); s.fighters[0].meter = 700; s.fighters[1].health = 1; s.fighters[0].x = 90000; s.fighters[1].x = 98000;
    s = run(run(s, 1, raw(5, 'LP')).state, 5 + 90 + 150).state; expect(s.round).toBe(2); expect(s.fighters[0].meter).toBe(740);
    expect(createMatch(defs).fighters[0].meter).toBe(0);
  });
  test('REVIEW FOCUS: a projectile in flight at KO cannot hit and is gone next round', () => {
    let s = toFight(createMatch(defs)); s.fighters[0].x = 40000; s.fighters[1].x = 120000; s.fighters[1].health = 1;
    for (const d of [2, 3]) s = run(s, 1, raw(d)).state; s = run(s, 1, raw(6, 'LP')).state; s = run(s, 13).state;
    expect(s.projectiles).toHaveLength(1); s.fighters[0].health = 0; s.fighters[0].ko = true; s = run(s, 1).state;
    expect(s.phase).toBe('ko'); s = run(s, 89).state; expect(s.fighters[1].health).toBe(1);
    s = run(s, 1 + 150).state; expect(s.projectiles).toHaveLength(0);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/engine/match.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all PASS (including the determinism test).
- [ ] **Step 5: Commit.** `feat(engine): add super freeze, projectiles and meter across rounds`

---

### Task 10: Presentation: meters, stun bars, combo counter, callouts, super flash, projectiles

**Files:**
- Modify: `src/render/hud.ts`, `src/render/effects.ts`, `src/render/renderer.ts`, `src/render/placeholder.ts`
- Test: `tests/unit/render/render.test.ts` (additions)

**Interfaces:**
- Produces, in `hud.ts`:
  ```ts
  export function comboText(hits: number): { label: string; shout: string | null } | null;
    // < 2 → null; label `${n} HITS`; shout: n >= 10 'INCREDIBLE!', >= 7 'AWESOME!', >= 5 'GREAT!', >= 3 'NICE!', else null
  export class ComboDisplay { update(hits: number, damage: number): void; get shown(): { hits: number; damage: number } | null }
    // keeps showing the last combo of >= 2 hits for 60 updates after it ends; a new combo replaces it
  ```
- **HUD layout** (logical units):
  - **stun bar:** under each health bar at y 72, height 6, width `500*stun/stunLimit`, color `#ff9800`
  - **meter bars:** 300 × 14 at y 690, P1 from x 60, P2 ending at x 1220. Fill `#4fc3f7`. When full, alternate with `#ffffff` every 8 ticks (`s.tick`).
  - **Easy badge:** `EASY`, 16 px, after the fighter name
  - **combo counter:** on the **attacker's** side (P1's combos at x 160, P2's at x 1120, y 220). It shows `label`, then `${damage} DMG`, then `shout`. It reads the **defender's** `comboHits` and `comboDamage`.
- **`Effects`:**
  - `clash` → a white spark (size 40)
  - `throwEscape` → callout `ESCAPE!`
  - `dizzy` → callout `DIZZY!`
  - callouts: centered at y 380, 64 px, lasting 45 ticks
- **Renderer:**
  - **projectiles:** visual `'karate-wave'` is a white crescent with a red edge, 60 × 60, facing its direction
  - **super flash:** when `s.freeze` is set, draw `rgba(0,0,0,0.55)` over the stage, then the fighters, then the text `${NAME}: ${freeze.name.toUpperCase()}` at y 200
  - **dizzy:** three yellow stars circling above the head (angle from `s.tick`)
- **`placeholderShapes` fallbacks:**
  - `thrown` and `throwing` → standing boxes
  - `landing` → crouching boxes
  - (`dizzy` already has standing hurtboxes)

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('comboText', () => {
    expect(comboText(1)).toBeNull(); expect(comboText(2)).toEqual({ label: '2 HITS', shout: null });
    expect(comboText(3)!.shout).toBe('NICE!'); expect(comboText(5)!.shout).toBe('GREAT!'); expect(comboText(7)!.shout).toBe('AWESOME!');
    expect(comboText(12)!.shout).toBe('INCREDIBLE!');
  });
  test('ComboDisplay lingers 60 updates after the combo ends', () => {
    const d = new ComboDisplay(); d.update(3, 150); d.update(0, 0); expect(d.shown).toEqual({ hits: 3, damage: 150 });
    for (let i = 0; i < 59; i++) d.update(0, 0); expect(d.shown).not.toBeNull(); d.update(0, 0); expect(d.shown).toBeNull();
  });
  test('a thrown fighter is still drawn', () => {
    const { fs, defs } = fightPair(); fs[1].action = 'thrown'; expect(placeholderShapes(fs[1], defs[1]).length).toBeGreaterThan(0);
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/unit/render`. Expected: FAIL.
- [ ] **Step 3: Implement.** Check by eye with a Playwright screenshot of a combo, a super flash and a projectile (scratchpad, not committed).
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): add meters, stun bars, combo counter, callouts, super flash, projectiles and dizzy stars`

---

### Task 11: Easy-mode toggle, setup parameter, smoke test, README

**Files:**
- Modify: `src/app/setup.ts`, `src/app/app.ts`, `src/render/renderer.ts` (`drawTitle(joined, easy)`), `tests/e2e/smoke.spec.ts`, `README.md`
- Create: `src/app/title.ts`
- Test: `tests/unit/app/app.test.ts` (additions)

**Interfaces:**
- `parseSetup` adds `easy`: `?easy=1` → `[true,false]`, `2` → `[false,true]`, `12` → `[true,true]`, anything else → `[false,false]`.
- `src/app/title.ts`: `export function specialEdges(prev: readonly [number, number], inputs: readonly [RawInput, RawInput]): [boolean, boolean]` → per player, true when the SPECIAL bit is down now and was up in `prev`.
- **Title screen:** each player's Special button (LB / Y / Numpad7) toggles their Easy mode.
  - The title shows `P1: Keyboard · EASY`.
  - Lines: "Controllers: press Start to join", "Special button: toggle Easy mode", "Then press Start again (or Enter, or click) to fight!".
  - `start()` passes the Easy flags into `createMatch`'s config.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('parseSetup easy', () => {
    expect(parseSetup('?easy=1').config.easy).toEqual([true, false]); expect(parseSetup('?easy=12').config.easy).toEqual([true, true]);
    expect(parseSetup('?easy=x').config.easy).toEqual([false, false]);
  });
  test('specialEdges sees a new Special press per player', () => {
    const r = (b: number) => ({ x: 0 as const, y: 0 as const, buttons: b, start: false });
    expect(specialEdges([0, btn('SPECIAL')], [r(btn('SPECIAL')), r(btn('SPECIAL'))])).toEqual([true, false]);
  });
  ```
  Then extend the e2e smoke test after the existing round assertions:
  - open `/?time=none`, press Enter, wait for `fight`
  - press `KeyS` down, wait 40 ms; `KeyD` down, wait 40 ms; `KeyS` up, wait 40 ms; press `KeyU`; `KeyD` up
  - `expect.poll(() => state().projectiles.length).toBe(1)` within 2 s
  - still no console errors
- [ ] **Step 2: Run** `npx vitest run tests/unit/app`. Expected: FAIL.
- [ ] **Step 3: Implement.** Update the README:
  - the controls table adds Throw (LT / H / Numpad0) and Easy Special (LB / Y / Numpad7)
  - a **Moves** section lists both fighters' specials and supers with inputs and Easy directions (spec section 6)
  - the `?easy=` parameter
  - Easy mode toggling on the title screen
- [ ] **Step 4: Run** `npm run typecheck && npm test && npm run build && npm run e2e`. Expected: all pass.
- [ ] **Step 5: Commit.** `feat(app): add Easy-mode toggle and ?easy=, extend smoke test, document moves`

---

## Done when

- `npm run typecheck && npm test && npm run build && npm run e2e` all pass locally and in CI.
- Playing by hand, Mohawk Man can:
  - throw Karate Waves (one at a time)
  - Mohawk Ram forward
  - Rising Chop a jump-in
  - cancel crouch MK into Karate Wave
  - land Thousand Chops with a freeze and announcer banner
- Spin Kicker can:
  - Tornado Kick (multi-hit)
  - Cartwheel through a Karate Wave
  - Handspring Heel a crouching blocker
- Throws and escapes work, dizzy happens after heavy pressure, the combo counter shows hits and damage, and Easy mode works from the title toggle.
