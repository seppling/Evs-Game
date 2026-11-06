# Evs-Game: Design Spec

**Date:** 2026-11-06
**Status:** Draft for review
**Working title:** Evs-Game

---

## 1. Summary

An original 2D fighting game in the spirit of early-90s arcade fighters, built to be played by friends and family on one screen. It runs in a web browser, each player uses a gamepad, and the game is opened from a link with nothing to install.

- **Roster:** eight original fighters designed by the user's son (see `docs/image-model-brief.md`).
- **Matches:** one-on-one, best of three rounds, with a timer.
- **Controls:** classic six-button controls with motion inputs, plus a per-player Easy mode.
- **Other modes:** a CPU opponent with an arcade ladder, and win/loss records.

## 2. Goals and success criteria

| Goal | Success looks like |
|---|---|
| **Fun to play together** | Two people pick up gamepads and play a full match with no setup beyond opening a link and pressing Start. |
| **Feels like a real fighting game** | Hits have weight (hitstop, pushback, sparks). Motion inputs come out reliably. Blocking high/low, throws, combos and supers all work. |
| **Mixed skill levels** | Easy mode lets a newcomer fire specials and supers. A CPU opponent lets one person practice alone. |
| **The son's fighters, his way** | All eight fighters are playable with their own moves and personality. His art drops in without code changes. |
| **Bragging rights** | Records show head-to-head wins between named players, plus favorite fighters. |
| **Playable early** | A placeholder version is playable at the end of the first milestone, long before the art is done. |

## 3. Not in scope (for now)

- Online play. The engine is deterministic (section 7.3), so it could be added later.
- Mobile phones and touch controls.
- Story mode, cutscenes, training mode, tournament brackets.
- Music. Sound effects are in, music is a later addition.
- Safari support. Chrome, Edge and Firefox on desktop are the targets.

---

## 4. Player experience

### 4.1 Screen flow

```
Title ──► Main Menu ──┬─► Versus ───────┐
                      ├─► Vs CPU ───────┤
                      ├─► Arcade ───────┤
                      ├─► Records       │
                      ├─► Controls      │
                      └─► Options       │
                                        ▼
            Join & Profile ─► Character Select ─► Stage Select ─► VS Screen ─► Match ─► Results
                                   ▲                                                       │
                                   └────────── Rematch / Change Fighters ◄─────────────────┘
```

- **Title:** "Press Enter or click to start". Browsers only allow sound and fullscreen after a key press or click, and gamepad buttons don't count, so this one-time step is required.
- **Join & Profile:** each player presses Start on their gamepad. The first pad to press becomes Player 1, the next becomes Player 2. Each player then picks a saved profile (a name), **Guest**, or **New profile**. New profiles are named with an on-screen letter grid that works with a gamepad.
- **Character Select:** a grid of eight portraits with one cursor per player. Pressing **Back/Select** toggles that player's **Easy mode**, shown as a badge. If both pick the same fighter, Player 2 is automatically recolored.
- **Stage Select:** defaults to **Random**. Left and right cycle through the eight stages (each fighter's home).
- **VS Screen:** both portraits and names, plus their **head-to-head record** (e.g. "Dad 12 – 15 Sam"). The two fighters and the stage load during this screen.
- **Match:** best of three rounds (section 5).
- **Results:** the winner's victory pose and win/loss tally. The options are Rematch (same fighters), Change Fighters, or Main Menu. The result is saved to records.
- **Pause:** Start during a match opens Resume, Controls or Quit to menu.

### 4.2 Modes

- **Versus:** two humans.
- **Vs CPU:** one human against a CPU fighter of their choice, at a chosen difficulty (Easy, Medium or Hard).
- **Arcade:** one human picks a fighter and faces the other seven in a random order. Difficulty rises from Easy to Hard. Losing offers a continue. Clearing it is saved to records. A slot is reserved at the end for a final boss, if the son designs one.
- **Records:** see section 12.
- **Controls:** remap buttons per player. The mapping is saved with the player's profile.
- **Options:** round timer (60, 99 or no timer), rounds to win (1, 2 or 3), Easy-mode damage reduction (on/off), sound volume.

### 4.3 Controls

**Default gamepad layout** (standard mapping; Xbox names, PlayStation equivalents work the same way):

| Input | Button |
|---|---|
| Move / jump / crouch | D-pad or left stick (8 directions; stick dead zone 0.5) |
| Light / Medium / Heavy Punch | X / Y / RB |
| Light / Medium / Heavy Kick | A / B / RT |
| Throw shortcut (same as LP+LK) | LT |
| **Easy Special** | LB |
| Pause / join | Start |
| Back / toggle Easy mode at Character Select | Back/Select |

**Keyboard fallback**, mainly for testing:

| | Player 1 | Player 2 |
|---|---|---|
| Move | W A S D | Arrow keys |
| Punches | U I O | Numpad 4 5 6 |
| Kicks | J K L | Numpad 1 2 3 |
| Easy Special | Y | Numpad 7 |
| Throw | H | Numpad 0 |
| Start | Enter | Numpad Enter |

**Easy mode** (per player) adds a shortcut. It doesn't take anything away: motion inputs still work.

| Easy input | Result |
|---|---|
| Special + no direction | Special 1 |
| Special + forward | Special 2 |
| Special + down | Special 3 |
| Special + back | Special 4 if the fighter has one, otherwise Special 1 |
| Special + any Heavy button, with a full super meter | Super |

- Easy-mode specials come out at **medium strength**.
- Easy-mode specials and supers deal **85% damage**. This is an option and can be turned off.

---

## 5. Combat rules

All timings are in **ticks**. The game runs at a fixed **60 ticks per second**. Every number below is a **starting value** stored in data and tuned through playtesting.

### 5.1 Rounds and match
- **Health:** 1,000 points by default. Each fighter has its own value (section 6).
- **Timer:** 99, counting down once per second.
- **Round start:** "ROUND 1" then "FIGHT!" (2 seconds, no control).
- **Winning a round:**
  - KO: health reaches 0.
  - Time-out: the fighter with the higher health percentage wins.
  - Equal health on time-out, or a double KO, is a **draw round**. Nobody scores.
- **Winning the match:** first to 2 round wins (set in Options). If 2 × rounds-to-win + 1 rounds pass without a winner (5 rounds when it's first to 2), the match is a **draw**.
- **KO:** a moment of slow motion, then the winner's pose. "PERFECT" if the winner took no damage that round.

### 5.2 Movement
- Walk forward and back, crouch, and jump (neutral, forward, back). Jumps have a fixed arc and can't be steered mid-air.
- A forward or back jump uses the somersault frames.
- There are no dashes; each fighter's specials cover mobility.
- Fighters automatically **face each other** whenever they're on the ground and not in the middle of an action.
- Fighters have push boxes, so they can't overlap. Walking into an opponent pushes them slowly.
- **Stage:** 1,920 units wide. The camera (1,280 × 720 units) follows the midpoint between the fighters. The fighters can never be farther apart than the camera view, minus a margin.

### 5.3 Attacks and frame data
- Every attack has **startup**, **active** and **recovery** ticks. Each tick has its own hurtboxes, plus a hitbox during active ticks.
- **Starting values:**

| | Startup | Active | Recovery | Damage | Stun | Hitstop |
|---|---|---|---|---|---|---|
| Light | 4 | 2 | 6 | 30 | 30 | 8 |
| Medium | 6 | 3 | 12 | 60 | 60 | 10 |
| Heavy | 9 | 4 | 20 | 100 | 100 | 12 |
| Special | 10–14 | varies | varies | 80–140 | 80–120 | 12 |
| Super | 1, then a 30-tick screen freeze | varies | varies | about 300 total | 0 | 14 |

- **Hitstop:** on contact, both fighters freeze for the hitstop ticks. This is what makes hits feel heavy.
- **Hitstun and blockstun:** set per move. Lights leave the attacker slightly ahead; heavies are a little unsafe on block.
- **Hit levels:**
  - **Mid:** block standing or crouching.
  - **Low:** must be blocked crouching. Includes crouching kicks, sweeps and some specials.
  - **Overhead:** must be blocked standing. Includes all jumping attacks and some specials.
- **Pushback:** the defender slides back on hit and on block. If the defender is against the edge, the attacker slides back instead.

### 5.4 Blocking
- **Hold away** from the opponent to block, standing or crouching.
- **Proximity guard:** holding away while an opponent's attack or projectile is near puts you in a block stance instead of walking away.
- **Chip damage:** specials and supers deal 25% of their damage on block. Normal attacks deal none. Chip damage **can KO**.

### 5.5 Combos and cancels
- **Cancels:**
  - Light and medium normals, and selected heavies, can be **cancelled into specials** on hit or block. The cancel window is the hitstop plus the 3 ticks after it.
  - Specials can be **cancelled into the super**.
- **Light chains:** a light punch or kick can be chained into another light punch or kick on hit or block.
- **Damage scaling:**
  - Hits 1–2 deal 100%, hit 3 deals 80%, and each later hit loses another 10%.
  - The minimum is 40%, or 50% for super damage.
- **Hitting an airborne opponent:**
  - A move that knocks down: they fall into a knockdown.
  - Any other move: they flip and land on their feet (an "air reset").
  - There are no juggles, except where a super specifically allows it.

### 5.6 Throws
- **Input:** Light Punch + Light Kick together (or the throw shortcut) when close (within 70 units).
  - Forward or no direction is a **forward throw**. Back is a **back throw**, which throws to the other side.
- **Properties:** 3-tick startup, unblockable, 120 damage, ends in a knockdown.
- **Can't throw** an opponent who is:
  - in the air
  - in hitstun or blockstun
  - in the 6 ticks after leaving hitstun, blockstun or getting up
- **Throw escape:** within **7 ticks** of being grabbed, the defender presses Light Punch + Light Kick (or the shortcut). The throw breaks, both fighters are pushed apart, and nobody takes damage. "ESCAPE!" appears on screen.

### 5.7 Knockdown and getting up
- Sweeps, throws, knockdown specials and supers knock the opponent down.
- They lie on the ground for 40 ticks, then take 20 ticks to stand up, unhittable and unthrowable while doing so.

### 5.8 Dizzy (stun)
- Every hit adds **stun points** (column in 5.3). Each fighter has a stun limit (default 500), shown as a small bar under the health bar.
- Stun drains when you aren't being hit: 60 ticks after the last hit, it drains 4 points per tick.
- When stun reaches the limit, the fighter is **dizzy** for 120 ticks, with stars drawn by the game. Mashing buttons and wiggling the stick shortens it by 3 ticks per input.
- Stun resets to 0 after a dizzy. A fighter can't be dizzied twice in the same combo.

### 5.9 Super meter
- One bar, 1,000 points. It carries over between rounds and resets at the start of each match.
- **Gaining meter:**

| Action | Meter |
|---|---|
| A normal attack connects (hit or block) | +40 light / +60 medium / +80 heavy |
| A special hits | +100 |
| A special is blocked | +50 |
| A special misses | +30 |
| Taking damage | +50% of the damage taken |

- **Super:** quarter-circle forward twice + punch or kick (each fighter's own), or the Easy shortcut. Costs the full bar.
- **Super flash:** the screen darkens and freezes for 30 ticks, with the fighter's name and the super's name.

### 5.10 Projectiles
- Each fighter can have **one projectile on screen** at a time.
- Two projectiles that collide cancel each other out. A super projectile beats a normal one.
- Projectiles are defined in data: speed, hitbox, lifetime, number of hits, and either an effect image or code-drawn visuals. Two-Face's lasers are fast, long-hitbox projectiles drawn as beams.

### 5.11 Invulnerability and special properties
Each tick of a move can set these flags:

| Flag | Effect | Used by |
|---|---|---|
| `strikeInvuln` | Attacks pass through | e.g. Rising Chop's first ticks |
| `throwInvuln` | Can't be thrown | |
| `projectileInvuln` | Projectiles pass through | e.g. Cartwheel |
| `upperInvuln` | Upper body can't be hit (no upper hurtbox); still hittable by lows and throws | Weight Kicker's Dodge |
| `counter` | Getting hit during these ticks triggers an automatic counter-attack instead | Two-Face's I See You |
| `armor` | Takes one hit without flinching (still takes the damage) | e.g. a Richie heavy move |

### 5.12 Combo counter and announcer
- From 2 hits up, a counter appears on the attacker's side, e.g. "3 HITS" plus the total damage.
- Shout-outs at milestones: 3 hits "NICE!", 5 "GREAT!", 7 "AWESOME!", 10 or more "INCREDIBLE!".
- Other announcer text: ROUND N, FIGHT!, K.O., TIME, PERFECT, DRAW, ESCAPE!, DIZZY!, "[NAME] WINS".
- All announcer text is drawn on screen. Recording voice lines (perhaps by the son) is a possible later addition.

---

## 6. The fighters

Full visual descriptions, frame lists and move poses are in `docs/image-model-brief.md`. This section covers gameplay.

**Input notation:** ↓↘→ is quarter-circle forward, ↓↙← is quarter-circle back, →↓↘ is the "dragon punch" motion, and [←]→ means hold back for 40 ticks, then press forward. P is any punch, K is any kick. Light, Medium and Heavy change a special's speed, distance and damage. All supers use ↓↘→↓↘→ plus P or K, so they're the same motion on every fighter.

| Fighter | Style | Special 1 (Easy: no direction) | Special 2 (Easy: forward) | Special 3 (Easy: down) | Special 4 (Easy: back) | Super | Health | Size |
|---|---|---|---|---|---|---|---|---|
| **Mohawk Man** | All-rounder | Karate Wave ↓↘→+P: projectile | Mohawk Ram ↓↙←+P: headfirst charge | Rising Chop →↓↘+P: anti-air, invulnerable at the start | — | Thousand Chops (+P) | 1000 | Tall |
| **Spin Kicker** | Rushdown, fast | Tornado Kick ↓↘→+K: multi-hit, moves forward | Cartwheel ↓↙←+K: moves forward through projectiles | Handspring Heel →↓↘+K: overhead | — | Human Tornado (+K) | 950 | Medium |
| **Flip Spin Crawler** | Trickster: lows and mix-ups | Hair Whip ↓↘→+P: long-reach fire strike | Crawl Strike ↓↙←+K: low crawl, then rising kick | Flame Flip →↓↘+K: anti-air backflip | — | Inferno Spin (+K) | 950 | Medium (low profile) |
| **Weight Kicker** | Counter and charge | Dodge ↓↙←+P: `upperInvuln` | Counter Kick [←]→+K: advancing heavy kick | Weight Drop [↓]↑+K: overhead stomp | — | Overload (+K) | 1000 | Medium |
| **Head Flip** | Aerial acrobat | Head Stomp ↓↘→+K: arcing leap, overhead | Skull Smash ↓↙←+P: lunging headbutt | Somersault Kick →↓↘+K: anti-air | — | 50,000-Year Flip (+K) | 900 | Small |
| **Two-Face** | Zoner | Laser Eyes ↓↘→+P: fast straight beam | I See You ↓↙←+P: counter stance | Laser Eyes Up →↓↘+P: diagonal anti-air beam | Camouflage ↓↓+K: nearly invisible for 90 ticks, ends when he attacks | Double Laser (+P) | 950 | Tall |
| **Poker Stick** | Keep-away, defensive | Spike Shot ↓↘→+P: projectile | Spike Ball ↓↙←+K: rolling spiky attack | Porcupine Burst →↓↘+P: spikes in every direction, anti-air | — | Spike Storm (+P) | 1000 | Medium |
| **Richie** | Heavy hitter (grappler pending) | Coin Toss ↓↘→+P: slow projectile | Money Bag Slam ↓↙←+P: big swing with `armor` | Make It Rain →↓↘+P: coins fall in front of him | — | Gold Rush (+P) | 1100 | Big |

- **Speeds and jumps:** each fighter has its own walk speed, jump height and jump speed. For example, Spin Kicker walks fast, Richie walks slowly, and Head Flip walks slowly but jumps high and fast.
- **Size:** sets each fighter's on-screen height. A medium fighter stands **300 units** tall (out of a 720-unit-tall screen). Small is ×0.8, tall ×1.05, big ×1.15.
- **Richie:** if the son decides he's the grappler, Make It Rain becomes a command grab, a half-circle back→forward + P that can only be escaped like a normal throw.
- **Changes are data-only:** answers to the open questions in section 17 change only fighter data and art, never the engine.

---

## 7. Architecture

### 7.1 Technology
- **TypeScript** with **Vite** (dev server and build).
- **HTML5 Canvas 2D** for drawing, the **Web Audio API** for sound, the **Gamepad API** for controllers, and **localStorage** for records.
- **Vitest** for unit and scenario tests, **Playwright** for browser smoke tests.
- **Node + sharp** for the art import tool.
- Hosted on **GitHub Pages**, deployed by GitHub Actions on every push to `main`.
- No game framework. A small custom engine gives exact control over timing and hitboxes (approach 1, agreed in the earlier discussion).

### 7.2 Module layout

```
src/
  main.ts              Boot; the fixed-timestep loop
  engine/              PURE SIMULATION: no DOM, no clock, no randomness, integer math only
    types.ts           MatchState, FighterState, MoveDef, Box, … (plain data)
    step.ts            step(state, inputs) → { state, events }: the single entry point
    match.ts           Round and match flow, timer, win/draw rules
    fighter.ts         Fighter state machine (idle, walk, crouch, jump, attack, hitstun, …)
    moves.ts           Running moves frame by frame; cancels, chains, invulnerability
    combat.ts          Hit/block/throw resolution, damage, chip, scaling, stun, meter
    projectiles.ts     Projectile movement, collision, clashes
    space.ts           Push boxes, stage edges, camera bounds, auto-facing
  input/
    commands.ts        PURE: input history buffer; motion, charge, chord and Easy-mode detection
    devices.ts         Browser: gamepad/keyboard polling, joining, remapping
  fighters/            DATA: one file per fighter, plus shared defaults
  ai/                  CPU opponent; produces the same raw input a gamepad would
  render/              Canvas: stage, sprites or placeholders, effects, HUD, camera
  audio/               Synthesized sound effects, played from engine events
  screens/             Title, menus, join/profile, select screens, VS, match, results, records, controls, options
  records/             Profiles and match history in localStorage
  assets/              Manifest loading, per-fighter lazy loading, missing-frame fallback
tools/
  import-art/          Node: raw images → game-ready sprite atlases + manifest
  viewer/              Dev-only page: play animations, nudge alignment, draw hitboxes
public/assets/         Processed sprites and stages (committed)
tests/                 Unit, scenario and smoke tests
```

**Boundaries:**
- `engine/` and `input/commands.ts` know nothing about the browser. They can be tested without one and run identically everywhere.
- `render/`, `audio/` and `screens/` only **read** engine state and events. They never change it.
- `fighters/` is pure data, checked by tests (section 15).

### 7.3 Determinism
- The simulation uses **integers only**. Positions are stored in hundredths of a unit.
- It never reads the clock or `Math.random`. The CPU opponent uses its own seeded random generator and talks to the engine only through inputs.
- State is plain, serializable data. The same starting state plus the same inputs always gives the same result.
- This makes tests reliable and keeps replays and online play possible later.

### 7.4 The loop and data flow (each tick)

```
devices.ts / ai ──raw input (directions + buttons)──► commands.ts (input buffer → detected commands)
                                                              │
                                                              ▼
                                  engine/step.ts: state(t) + commands ──► state(t+1) + events
                                                              │
                          ┌───────────────────────────────────┼─────────────────┐
                          ▼                                   ▼                 ▼
                    render (reads state)            audio (plays events)   records (on match end)
```

- `requestAnimationFrame` drives an accumulator that runs the simulation at exactly 60 ticks per second, independent of the monitor's refresh rate.
- It runs at most **4 ticks per animation frame**. If the computer falls behind, the game slows down briefly rather than skipping ahead.
- Rendering always draws the latest state.

### 7.5 Fighter data format

```ts
interface FighterDef {
  id: string;                    // "mohawk-man"
  name: string;
  size: "small" | "medium" | "tall" | "big";
  health: number; stunLimit: number;
  walkForward: number; walkBack: number;    // units per tick (×100)
  jump: { height: number; duration: number; forwardSpeed: number };
  colors: { primary: string; secondary: string };  // for placeholders and recoloring
  pushbox: Box; standingHurtboxes: Box[]; crouchingHurtboxes: Box[];
  moves: Record<MoveId, MoveDef>;           // normals, throws, specials, super
  animations: Record<AnimId, AnimDef>;      // idle, walk, hit-high, knockdown, …
}

interface MoveDef {
  input: InputPattern;           // e.g. { motion: "qcf", button: "P" } or { button: "HK", stance: "crouch" }
  frames: MoveFrame[];           // one entry per span of ticks
  hit: { damage: number; chip: number; stun: number; hitstun: number; blockstun: number;
         hitstop: number; pushback: number; level: "mid" | "low" | "overhead";
         knockdown: boolean; meterGain: number };
  cancels: ("special" | "super" | "chain")[];
  projectile?: ProjectileDef;
}

interface MoveFrame {
  sprite: string;                // art file name, e.g. "stand-heavy-kick_02"
  ticks: number;
  hurtboxes: Box[]; hitbox?: Box;
  velocity?: { x: number; y: number };
  flags?: ("strikeInvuln" | "throwInvuln" | "projectileInvuln" | "upperInvuln" | "counter" | "armor")[];
  spawnProjectile?: boolean;
}
```

- **Boxes:** rectangles in units, measured from the fighter's feet, facing right. They're mirrored automatically when facing left.
- **Shared defaults:** a shared template provides standard normals, throws and reactions. Each fighter overrides only what's different.

---

## 8. Rendering and presentation

- **Screen:** a 1,280 × 720 logical screen, scaled to fit the window with letterboxing, sharp at the device's pixel density. **Fullscreen** with F or a button.
- **Draw order:** stage background, then shadows, fighters, projectiles, effects, HUD, and announcer text on top.
- **Placeholders until art arrives:** any frame without a sprite is drawn as a figure built from that tick's hurtboxes, filled with the fighter's colors. The head is a circle, and the active hitbox is drawn as a solid limb. So the game is fully playable and readable with zero art.
- **Effects drawn in code:**
  - hit sparks (by strength), block flashes, dust on landings and knockdowns
  - dizzy stars, laser beams, fire trails, tornado swirls, electricity
  - simple shadows under fighters
  - screen shake on heavy hits and supers
  - the super flash
  - the "being thrown" spin, done by rotating knockdown frames
- **Recoloring:** in a mirror match, Player 2's fighter is recolored with a hue shift. The recolored sprites are prepared once and cached.
- **HUD:**
  - health bars with a red "recent damage" trail
  - small stun bars underneath
  - player names and fighter names
  - round-win markers
  - the timer in the center
  - super meters along the bottom, flashing when full
  - the combo counter on the attacker's side
  - announcer text in the center

## 9. Audio

- Sound effects are **synthesized with Web Audio** (no files): light, medium and heavy hits, block, whoosh, throw, landing, KO, the super flash, menu moves and confirm.
- Played from engine events.
- Volume in Options.
- No music for now.

---

## 10. Input handling

- **Polling:** devices are read once per tick. Gamepads use the browser's standard mapping. Pads with non-standard mappings (common on Firefox, and with some arcade sticks) are fixed with the Controls screen.
- **Input buffer:** the last 60 ticks of directions and button presses per player, stored relative to which way the fighter is facing.
- **Motion detection** (all directions relative to facing):
  - quarter-circles and dragon punch: the motion within **15 ticks**, and the button within **8 ticks** after the motion ends
  - shortcuts are accepted (e.g. ↓↘ alone, then → plus the button)
  - charge: hold for **40 ticks**, release into the other direction plus the button within **10 ticks**
  - double quarter-circle for supers: within **25 ticks**
- **Priority** when several moves match: super, then special, then throw, then normal.
- **Button presses** are buffered for **4 ticks**, so a special input done slightly early during recovery still comes out.
- **Easy mode** translates Special + direction straight into the fighter's special command before priority is applied.
- **Joining and disconnects:** pads join by pressing Start (section 4.1). A disconnect during a match is handled in section 14.

---

## 11. CPU opponent

- **Same interface as a player:** the CPU produces raw input each tick, exactly like a gamepad, including motion inputs played back as short input sequences. It follows exactly the same rules as a human.
- **Reaction delay:** it sees the match with a delay that depends on difficulty, so it reacts like a person rather than instantly.
- **Tactics:** each tick it scores a small set of tactics and picks one, using its seeded random generator:
  - keep the preferred distance
  - poke
  - throw a projectile
  - anti-air a jump
  - block an incoming attack
  - punish a blocked or missed move
  - jump in
  - throw when close
  - do a combo from the fighter's list
- **Per fighter:** each fighter has a preferred distance, tactic weights and a short combo list. For example, Two-Face and Poker Stick keep away, while Spin Kicker rushes in.
- **Difficulty:**

| | Reaction delay | Blocks | Anti-airs | Uses combos |
|---|---|---|---|---|
| Easy | 25 ticks | 30% | 20% | Rarely |
| Medium | 15 ticks | 60% | 50% | Sometimes |
| Hard | 8 ticks | 85% | 80% | Often |

## 12. Records

- **Storage:** `localStorage`, key `evs.records.v1`, a versioned JSON document:

```ts
interface RecordsV1 {
  version: 1;
  profiles: { id: string; name: string; createdAt: string; controls?: ControlMap }[];
  matches: { id: string; at: string;
             players: [PlayerEntry, PlayerEntry];   // { profileId | null (guest), cpuLevel?, fighter }
             winner: 0 | 1 | null;                  // null = draw
             rounds: (0 | 1 | null)[] }[];
  arcadeClears: { profileId: string; fighter: string; at: string }[];
}
```

- **Records screen:**
  - per player: total wins and losses, head-to-head against each other player, most-played fighters, win rate with each fighter, and arcade clears
  - the head-to-head score also appears on the VS screen
- **Guests:** guest matches aren't saved to anyone's record.
- **History limit:** the newest **5,000 matches** are kept, to bound storage.
- **Export / Import:** download or load a JSON file, so records survive a cleared browser or move to another computer.

---

## 13. Art pipeline

The image model makes full-size images following `docs/image-model-brief.md`. `tools/import-art` turns them into game sprites:

1. **Read** raw PNGs from a source folder outside the repo (or downloaded from a shared Google Drive folder), organized by fighter folder.
2. **Remove the background:** keep transparency if present; otherwise remove the flat magenta or green with an edge-tolerance pass, and clean up color spill along the outlines.
3. **Split strips** (`*_strip.png`) into separate frames by finding empty columns between poses.
4. **Trim** each frame to its content and find the **foot line**, the lowest solid row, for grounded poses.
5. **Scale** each fighter so its `idle_01` matches its size class (section 6). Every frame of that fighter gets the same scale.
6. **Apply manual nudges** from `art-overrides.json` (per-frame scale and offset).
7. **Pack** each fighter into one WebP atlas, with a JSON file of frame rectangles and foot anchors. Stages and portraits get the same treatment.
8. **Report** missing, extra or misnamed files against the frame list.

`tools/viewer` (dev only) plays any animation at game speed, steps frame by frame, nudges alignment (writing to `art-overrides.json`), and lets you draw hurtboxes and hitboxes over a frame and copy the numbers into fighter data.

Only processed assets are committed. Raw originals stay outside the repo.

**Missing frames fall back**, in order:
1. another frame of the same animation
2. the closest related pose (e.g. `crouch-light-punch` → `crouch-medium-punch` → `crouch_02`)
3. the placeholder figure

The game never fails because of missing art.

---

## 14. Error handling

| Situation | Behavior |
|---|---|
| Sprite or stage missing, or fails to load | Fallback chain (section 13), never a crash. A warning in the console, and the dev overlay lists missing frames. |
| Fighter data invalid | Caught by tests before shipping. At load, an invalid fighter is greyed out on Character Select with a console error, rather than crashing the game. |
| Gamepad disconnects mid-match | The game pauses: "Player 2 controller disconnected. Reconnect and press Start." Reconnecting (same pad, or any free pad) resumes. |
| Browser tab hidden | Auto-pause. |
| Sound blocked by the browser | The Title screen's key press or click unlocks it. If still blocked, the game runs silently. |
| `localStorage` unavailable or full | The game still works. Records show "Records can't be saved in this browser" and matches aren't saved. |
| Records data corrupt or an unknown version | The bad data is saved under a backup key, fresh records start, and a notice is shown. |
| The computer is too slow for 60 ticks per second | Capped catch-up (section 7.4): brief slow-down instead of skipping. A dev overlay shows the tick rate. |
| Unknown gamepad layout | Default mapping first. The player can remap on the Controls screen; the mapping is saved per profile. |

## 15. Testing

- **Input tests (Vitest):**
  - each motion type is detected with the right timing windows, and rejected outside them
  - charge timing
  - shortcuts and priority
  - Easy-mode translation
  - everything works facing either way
- **Rules tests:**
  - blocking (mid, low, overhead)
  - chip damage, including chip KO
  - hitstop and pushback
  - cancel windows and light chains
  - damage scaling
  - throw range, throw protection and the escape window
  - stun build-up, draining and dizzy
  - meter gain and spending
  - projectile clashes
  - each invulnerability flag
  - time-out, draw and double-KO results
  - the round limit
- **Scenario tests:** scripted inputs played through the engine, with the outcome checked. For example: "Mohawk Man crouching medium kick → Karate Wave combos on hit", "a jumping attack can't be blocked crouching", "Weight Kicker's Dodge avoids a standing heavy punch but not a sweep".
- **Determinism test:** the same input script run twice produces identical state at every tick.
- **Fighter data tests**, for all eight fighters:
  - every move has positive tick counts and a hitbox during active ticks
  - every sprite name used is in the frame list
  - every special has an input and an Easy-mode slot
  - health and sizes are valid
- **Art import tests:** background removal, strip splitting and foot alignment, on small sample images.
- **Records tests:** saving and loading, migration, corruption recovery, the history limit.
- **Browser smoke test (Playwright, headless):** the game loads, the menus work with the keyboard, and a full CPU-vs-CPU match runs to completion with no console errors.
- **Playtesting:** with the family, using the dev overlay (hitboxes, frame data, tick rate; toggled with F1). Balance numbers are tuned in data files.

---

## 16. Milestones

Each milestone ends with a playable deploy to GitHub Pages and gets **its own implementation plan**.

1. **M1: Playable skeleton.**
   - Project setup and deploy pipeline, the loop, keyboard and gamepad input.
   - Engine basics: movement, jumping, normal attacks, blocking, hit and block reactions, hitstop, pushback, knockdown, rounds, timer, KO.
   - Basic HUD, placeholder fighters, and a flat stage.
   - Mohawk Man and Spin Kicker with normal attacks only. If the son's favorite is a different fighter, he replaces Spin Kicker here, so the first real art lands on a fighter that already works.
   - *You can play a full match.*
2. **M2: Full combat systems.**
   - Motion and charge detection, specials, projectiles, invulnerability flags.
   - Throws and escapes, super meter and supers, dizzy, cancels and chains, damage scaling.
   - Combo counter and announcer text, Easy mode.
   - Both M1 fighters complete.
3. **M3: Art pipeline.** Import tool, viewer and box tool. The first fighter's starter set in the game.
4. **M4: Screens and records.**
   - Title, menus, join and profile, character select, stage select, VS, results, pause.
   - Controls remapping, options, records with export and import.
5. **M5: The other six fighters.** Fighter data, art as it arrives, and all eight stages.
6. **M6: CPU opponent.** Vs CPU and Arcade modes.
7. **M7: Polish.** Sound effects, effect polish, screen shake, the super flash, and a balance pass from family playtests.

---

## 17. Open questions (none block M1–M4)

Questions for the son, also listed in `docs/art-brief.md`. Answers change only fighter data and art:

- What each fighter looks like, and their home country.
- Flip Spin Crawler: is "Crawler" from crawling like a spider?
- Weight Kicker: why "Weight"? What did the machine do? A super move?
- Head Flip: a walking stick?
- Two-Face: does he have two faces, and where?
- Poker Stick: what do the pokers look like?
- Richie: is he the grappler? What did the machine do?
- A final boss: whoever built the machine?
- A real name for the game? What does "Evs" mean?
- Victory quotes for each fighter, shown on the Results screen once he writes them.
