# Evs-Game Art Brief

How to generate the fighter art with an image model: **one image per animation frame** (approach B).

Fighters created by our head character designer. Anything marked **❓ Ask** is a guess and should be checked with him before you generate it. His version always wins.

---

## Checklist

1. ☐ Go through the **❓ Ask** questions below with your son, especially how each fighter looks.
2. ☐ Make a **reference sheet** for each fighter (step 1 below) and let him pick the best one.
3. ☐ Pick one fighter to go first (his favorite) and make only its **starter set**, about 25 images.
4. ☐ Send those to me. I'll get them moving in the game so we can check the look and fix the prompts before you make the other ~600 images.
5. ☐ Make the full set for all eight, plus portraits and stages.

---

## Rules for every image

| Rule | Why |
|---|---|
| **Character faces RIGHT** in every image. | The game mirrors the image automatically for the player on the right side. |
| **Square 1024 × 1024** for a single frame. Use the widest landscape size (e.g. 1536 × 1024) for a strip of several frames. | Large images shrink cleanly to game size. |
| **Whole body in frame, small margin.** Nothing cut off: kicks, spikes, flaming hair. | Anything outside the frame is lost. |
| **Same size every time.** Standing, the character is about ¾ of the image height. | Keeps them from growing and shrinking between frames. |
| **Same camera.** Classic fighting-game side view: body turned right and slightly toward the viewer, camera at chest height, no dramatic angles. | Keeps them from appearing to rotate between frames. |
| **Background:** transparent if your tool offers it. Otherwise a plain, flat, solid **magenta (#FF00FF)**, or bright **green (#00FF00)** for fighters who wear purple or pink. | I remove the background automatically. A flat color is easy to remove; a busy one isn't. |
| **No floor, shadow, text, other people or effects.** | The game draws effects itself (see below). |
| **Save as PNG, never JPEG.** | JPEG blurs the edges and breaks background removal. |
| **Don't make alternate color versions.** | The game recolors fighters automatically when both players pick the same one. |

**The game draws these, so leave them out:** hit sparks, block flashes, dust clouds, dizzy stars, laser beams, fire trails, tornado swirls, electricity, speed lines, shadows, and the "being thrown" spin.

Don't worry about perfect positioning either. I'll build a tool that lines up the feet and lets us nudge any frame that comes out too big or too small.

---

## The prompt template

Every prompt has three parts. Copy the **STYLE** block and the fighter's **CHARACTER** block word for word every time. Only the **POSE** changes.

```
STYLE: Hand-drawn 2D fighting game character sprite in a 1990s arcade style.
Bold dark outlines, flat cel shading with one shadow tone, bright saturated colors.
Full body, classic fighting-game side view, body turned to the right and slightly
toward the viewer, facing RIGHT. The whole body fits inside the image with a small
margin. Plain flat solid {magenta #FF00FF / green #00FF00} background. No floor,
no shadow, no text, no other people, no special effects, no motion lines.

This is the same character as in the attached reference image. Keep the face,
hair, outfit, colors and body proportions exactly the same.

CHARACTER: {the fighter's CHARACTER block}

POSE: {one pose from the frame list}
```

**Example**, Mohawk Man, `stand-heavy-kick_02`:

```
STYLE: (as above, magenta background)
This is the same character as in the attached reference image. (as above)
CHARACTER: Mohawk Man, a tall, muscular karate fighter in his thirties with a tall,
spiky bright-red mohawk and shaved sides. He wears a white karate gi with the
sleeves torn off, a black belt, and red cloth wraps on his hands and forearms.
Barefoot. Confident grin, thick eyebrows.
POSE: Roundhouse kick at head height, kicking leg fully extended to the right,
standing on the other leg, arms held in guard.
```

### Tips for consistency
- **Always attach the reference sheet.** It's the biggest single factor in keeping a fighter looking the same.
- **Never reword the CHARACTER block.** Changing it even slightly changes the drawing.
- **Reject frames that drift.** If the outfit, colors or face are off, generate it again. Small differences show up as flicker once the frames play as animation.
- **Try whole moves as one strip.** Models are often more consistent within a single image. Ask for: *"Show 3 poses of this same character side by side, left to right, evenly spaced, the same size, not overlapping: 1) … 2) … 3) …"*. Save it as e.g. `stand-heavy-kick_strip.png` and I'll cut it apart. Try both ways on the first fighter and keep whichever looks better.
- **Keep notes.** Make a `notes.txt` in each fighter's folder with the model, seed and prompt of every image you keep, so you can come back later and match it.

---

## Step 1: Reference sheet (one per fighter)

Make this before any frames. It locks how the fighter looks.

```
STYLE: (as above, but replace the "Full body, classic fighting-game side view..."
sentence with:) Character reference sheet showing the same character twice, side
by side: on the left a front view, on the right a side view facing right. Both
standing in a relaxed neutral pose, full body, same size.

CHARACTER: {the fighter's CHARACTER block}
```

Use a landscape size. Save the one he picks as `reference.png`.

---

## Frame list (every fighter)

File names are lowercase with hyphens and two-digit frame numbers, in one folder per fighter, e.g. `mohawk-man/stand-heavy-kick_02.png`.

Fighter folder names: `mohawk-man`, `spin-kicker`, `flip-spin-crawler`, `weight-kicker`, `head-flip`, `two-face`, `poker-stick`, `richie`.

Where a fighter has a **flavor note** (in their section below), use it to give these poses their own style. For example, Mohawk Man's heavy punches are karate chops.

### Moving (14)
| File | Pose |
|---|---|
| `idle_01` | Fighting stance, fists raised in guard, knees slightly bent, weight on the back foot. |
| `idle_02` | Same stance, breathing in: chest and shoulders slightly raised. |
| `idle_03` | Same stance, breathing in fully: body at its highest point. |
| `walk_01` | Walking forward: front foot lifting, guard up. |
| `walk_02` | Front foot planted ahead, legs apart, guard up. |
| `walk_03` | Back foot passing the front foot, guard up. |
| `walk_04` | Legs coming back together into stance. |
| `crouch_01` | Halfway down, knees bending, guard up. |
| `crouch_02` | Fully crouched low, knees deeply bent, guard up. |
| `jump_01` | Jumping upward: body stretched up, arms rising. |
| `jump_02` | Top of the jump: knees tucked up toward the chest. |
| `jump_03` | Falling: legs reaching down, ready to land. |
| `jump-flip_01` | Mid-air somersault: body curled into a tight ball. |
| `jump-flip_02` | Mid-air somersault: curled ball, upside down. |

*Walking backward plays the walk frames in reverse, so no extra art is needed.*

### Standing attacks (14)
| File | Pose |
|---|---|
| `stand-light-punch_01` | Quick jab, arm half extended. |
| `stand-light-punch_02` | Jab fully extended at face height. |
| `stand-medium-punch_01` | Winding up a straight punch, shoulder pulled back. |
| `stand-medium-punch_02` | Strong straight punch, arm fully extended at chest height. |
| `stand-heavy-punch_01` | Big wind-up, fist pulled far back, body twisted. |
| `stand-heavy-punch_02` | Powerful punch fully extended, body leaning in. |
| `stand-heavy-punch_03` | Follow-through, arm swung across the body. |
| `stand-light-kick_01` | Knee lifted. |
| `stand-light-kick_02` | Quick front kick at knee height. |
| `stand-medium-kick_01` | Knee raised high, ready to kick. |
| `stand-medium-kick_02` | Side kick at stomach height, leg straight. |
| `stand-heavy-kick_01` | Spinning wind-up, back partly turned. |
| `stand-heavy-kick_02` | Roundhouse kick at head height, leg fully extended. |
| `stand-heavy-kick_03` | Follow-through, kicking leg coming down. |

### Crouching attacks (14)
| File | Pose |
|---|---|
| `crouch-light-punch_01` / `_02` | Crouched low, quick jab (half extended / fully extended). |
| `crouch-medium-punch_01` / `_02` | Crouched, straight punch (wind-up / fully extended). |
| `crouch-heavy-punch_01` | Crouched, fist pulled down low. |
| `crouch-heavy-punch_02` | Rising uppercut, arm thrust straight up. |
| `crouch-heavy-punch_03` | Follow-through, coming back down. |
| `crouch-light-kick_01` / `_02` | Crouched, short poke kick at ankle height (chambered / extended). |
| `crouch-medium-kick_01` / `_02` | Crouched, long low kick along the floor (chambered / extended). |
| `crouch-heavy-kick_01` | Crouched and spinning low, one hand on the floor. |
| `crouch-heavy-kick_02` | Low sweep kick, leg fully extended along the floor. |
| `crouch-heavy-kick_03` | Follow-through, leg pulling back in. |

### Jumping attacks (8)
| File | Pose |
|---|---|
| `jump-punch_01` / `_02` | In the air, punching diagonally down (wind-up / extended). |
| `jump-heavy-punch_01` / `_02` | In the air, big two-handed hammer strike downward (raised / smashed down). |
| `jump-kick_01` / `_02` | In the air, knee up, then kick extended diagonally down. |
| `jump-heavy-kick_01` / `_02` | In the air, big flying kick (chambered / leg straight, angled down). |

*Light and medium jumping attacks share these images; the game makes them faster or stronger.*

### Throw (3)
| File | Pose |
|---|---|
| `throw_01` | Reaching forward with both hands to grab. |
| `throw_02` | Gripping the air at chest height as if holding someone. Do not draw the other person. |
| `throw_03` | Big throwing motion, arms swinging forward and over. |

### Getting hit and blocking (11)
| File | Pose |
|---|---|
| `hit-high_01` | Hit in the face: head snapped back, eyes squeezed shut. |
| `hit-high_02` | Staggering backward, body bent back. |
| `hit-crouch_01` | Crouched, flinching from a hit. |
| `block-stand_01` | Standing braced, forearms crossed in front to block. |
| `block-crouch_01` | Crouched, forearms up to block. |
| `knockdown_01` | Knocked off the feet, flying backward, body horizontal. |
| `knockdown_02` | Lying flat on the back on the ground. |
| `knockdown_03` | Getting up: one knee and one hand on the ground. |
| `knockdown_04` | Almost standing, rising back up. |
| `dizzy_01` | Standing wobbly: eyes swirled, arms limp, head drooping. |
| `dizzy_02` | Same, swaying the other way. |

### Round start and end (4)
| File | Pose |
|---|---|
| `intro_01` | Entrance pose (see fighter section). |
| `win_01` | Victory pose (see fighter section). |
| `win_02` | Second victory pose (see fighter section). |
| `lose_01` | Exhausted, hunched over, hands on knees (for losing on time). |

### Portrait (1)
| File | Pose |
|---|---|
| `portrait` | Chest-up, facing right, dramatic expression, for the character-select and versus screens. Square, same style and background rules. |

### Specials and super
Listed per fighter below. Every super is saved as `super_01`, `super_02`, and so on.

**Effect images** (projectiles like a coin or a spike) show **only the object**, no fighter, in the same style and background. They're named like `coin-fx_01`.

**Total:** about 85 images per fighter, about 680 for all eight.

### Starter set: do these first (about 25)
`idle_01`, `idle_02`, `walk_01`, `walk_02`, `crouch_02`, `jump_02`, `stand-medium-punch_01–02`, `stand-heavy-kick_01–03`, `crouch-medium-kick_01–02`, `jump-kick_01–02`, all frames of **one** special move, `hit-high_01`, `block-stand_01`, `knockdown_01–04`, `win_01`.

That's enough to play the fighter in the game. Any missing frame borrows the closest one the game has, so each fighter improves as more art arrives.

---

## The eight fighters

### 1. Mohawk Man (`mohawk-man`): the all-rounder

**CHARACTER:** Mohawk Man, a tall, muscular karate fighter in his thirties with a tall, spiky bright-red mohawk and shaved sides. He wears a white karate gi with the sleeves torn off, a black belt, and red cloth wraps on his hands and forearms. Barefoot. Confident grin, thick eyebrows.

- **Background:** magenta. **Size:** tall.
- **Home ❓ Ask:** London, England. Stage: a city street at night with a red double-decker bus.
- **Flavor:** his heavy punches are karate chops. His standing stance is a classic karate stance.
- **Intro:** running a hand back over his mohawk. **Win 1:** arms crossed, grinning. **Win 2:** a karate bow.

| Move | Files | Poses |
|---|---|---|
| Mohawk Ram | `mohawk-ram_01–03` | 1) Crouched low, head down, mohawk pointed forward like a spear. 2) Launching forward horizontally, headfirst, body straight like a missile. 3) Skidding to a stop. |
| Rising Chop | `rising-chop_01–03` | 1) Crouched, hand held back as a blade. 2) Leaping upward, chopping hand thrust overhead. 3) Top of the leap, chopping arm high. |
| Karate Wave | `karate-wave_01–02` | 1) Arm raised high for a chop. 2) Chopping down and forward, arm extended. |
| Karate Wave effect | `karate-wave-fx_01–02` | A glowing white-and-red crescent-shaped wave of energy flying to the right (two slightly different shapes). |
| Super: Thousand Chops | `super_01–04` | 1) Power stance, fists clenched, shouting. 2) A flurry of chops, several arms blurred. 3) Flurry, arms in different spots. 4) One final huge chop. |

### 2. Spin Kicker (`spin-kicker`): fast and slippery

**CHARACTER:** Spin Kicker, a slim, athletic gymnast woman in her thirties with a long dark ponytail tied with a silver band. She wears a sparkling purple-and-silver gymnastics leotard with a star pattern, white wrist tape, and white gymnastics slippers. Focused, confident expression.

- **Background:** **green** (she wears purple). **Size:** medium.
- **Home ❓ Ask:** Romania. Stage: a grand gymnastics arena with a cheering crowd and a scoreboard.
- **Flavor:** her kicks look like gymnastics moves: high leg extensions, splits, flips.
- **Intro:** both arms raised like finishing a routine. **Win 1:** the same salute, beaming. **Win 2:** doing the splits.

| Move | Files | Poses |
|---|---|---|
| Tornado Kick | `tornado-kick_01–03` | 1) One leg raised, about to spin. 2) Mid-spin, leg swung out, back half-turned. 3) Mid-spin, facing forward, other leg out. |
| Cartwheel | `cartwheel_01–02` | 1) Mid-cartwheel, hands on the floor, legs up. 2) Landing from the cartwheel. |
| Handspring Heel | `handspring-heel_01–03` | 1) Diving forward onto her hands. 2) Upside down on her hands, legs swinging over. 3) Heel crashing straight down in front. |
| Super: Human Tornado | `super_01–04` | 1) Arms spread, starting to spin. 2) Spinning fast, body stretched tall. 3) Spinning, turned the other way. 4) Landing, arms out. |

### 3. Flip Spin Crawler (`flip-spin-crawler`): sneaky kung fu with fire

**CHARACTER:** Flip Spin Crawler, a lean, wiry kung fu fighter in his twenties whose hair is made of living orange-and-yellow flames streaming upward. He wears a black sleeveless kung fu outfit with orange trim, an orange sash, and black cloth shoes. Sharp, mischievous grin.

- **Background:** magenta. **Size:** medium (often low to the ground).
- **❓ Ask:** is he called "Crawler" because he crawls like a spider? (Assumed yes.)
- **Home ❓ Ask:** Hong Kong, China. Stage: a night market full of glowing lanterns.
- **Flavor:** his stance is low and wide, almost spider-like, one hand near the floor.
- **Intro:** his hair bursts into big flames. **Win 1:** balancing upside down on one hand. **Win 2:** crouched and grinning, hair blazing.

| Move | Files | Poses |
|---|---|---|
| Crawl Strike | `crawl-strike_01–03` | 1) Low on all fours like a spider, head forward. 2) Scuttling, limbs spread wide. 3) Springing up from the floor with an upward kick. |
| Flame Flip | `flame-flip_01–03` | 1) Crouched, about to backflip. 2) Mid-backflip, upside down, hair blazing. 3) Landing in his low stance. |
| Hair Whip | `hair-whip_01–02` | 1) Head pulled back. 2) Head snapping forward, flaming hair lashing far out in front. |
| Super: Inferno Spin | `super_01–04` | 1) Hair flaring up huge. 2) Spinning on one hand, legs whirling. 3) Spinning, turned the other way. 4) Final pose, arms spread, hair roaring. |

### 4. Weight Kicker (`weight-kicker`): the dodger

**CHARACTER:** Weight Kicker, a stocky, muscular kickboxer in his twenties with short spiky blue-black hair and glowing electric-blue eyes. Heavy iron weights are strapped around both ankles. He wears a navy-blue sleeveless training top, navy kickboxing shorts with an electric-blue stripe, and wrapped hands. A glowing electric-blue lightning-shaped scar runs down his left arm from the machine that zapped him. Calm, cocky smirk.

- **Background:** magenta. **Size:** medium.
- **❓ Ask:** why is he called "Weight" Kicker? Heavy weights on his legs is a guess. What exactly did the machine do to him? Does he have a super-move idea?
- **Home ❓ Ask:** Switzerland. Stage: the secret mountain laboratory where the machine zapped him.
- **Flavor:** his kicks are slow and heavy. His punches are rare and quick.
- **Intro:** lifting one weighted leg and stomping it down. **Win 1:** leaning back, hands behind his head ("couldn't touch me"). **Win 2:** holding a high kick.

| Move | Files | Poses |
|---|---|---|
| Dodge | `dodge_01–02` | 1) Leaning far back and to the side, dodging. 2) Ducking and weaving low to the side. |
| Counter Kick | `counter-kick_01–02` | 1) Spinning around out of a dodge. 2) Huge kick, leg fully extended. |
| Weight Drop | `weight-drop_01–02` | 1) Leg raised high overhead, ankle weight showing. 2) Stomping down hard. |
| Super: Overload (name ❓) | `super_01–04` | 1) Powering up, fists clenched, scar glowing bright. 2) Lightning-fast kick, high. 3) Lightning-fast kick, low. 4) Final pose on one leg. |

### 5. Head Flip (`head-flip`): the ancient acrobat

**CHARACTER:** Head Flip, a tiny, wrinkled 50,000-year-old woman with a big white hair bun held by a bone hairpin, bright sharp eyes and a toothy grin. She wears a flowing ancient robe in green and gold, gold bracelets, and is barefoot. Slightly hunched, but incredibly bendy and athletic.

- **Background:** magenta. **Size:** small (the shortest fighter).
- **❓ Ask:** does she carry a walking stick? It would be funny if she tossed it aside to start flipping.
- **Home ❓ Ask:** Egypt. Stage: the desert by the ancient pyramids at sunset.
- **Flavor:** many of her attacks are headbutts and flips.
- **Intro:** stretching her back with a big crack. **Win 1:** cackling, hand on hip. **Win 2:** a handstand.

| Move | Files | Poses |
|---|---|---|
| Head Stomp | `head-stomp_01–03` | 1) Crouched, ready to leap. 2) Flipping high, curled up. 3) Coming down feet-first to stomp. |
| Skull Smash | `skull-smash_01–02` | 1) Leaning back, head pulled back. 2) Lunging forward with a giant headbutt. |
| Somersault Kick | `somersault-kick_01–02` | 1) Crouched low. 2) Flipping upward, leg kicking high. |
| Super: The 50,000-Year Flip | `super_01–04` | 1) Dropping into a deep crouch. 2) Flipping, curled tight. 3) Flipping, stretched out. 4) Landing with a little bow. |

### 6. Two-Face (`two-face`): the long-range sniper

**CHARACTER:** Two-Face, a tall, thin, sneaky fighter with two faces: one on the front of his bald head and a second one on the back, so he can see in every direction. Both faces have glowing red eyes. He wears a skin-tight khaki-and-brown camouflage bodysuit, combat boots and fingerless gloves. Serious, watchful expression.

- **Background:** magenta. **Size:** tall.
- **❓ Ask:** this is the biggest guess. Does he really have two faces, and where is the second one? What does each face look like?
- **Home ❓ Ask:** Brazil. Stage: deep in the Amazon rainforest by a waterfall.
- **Intro:** turning his head to show the face on the back. **Win 1:** arms folded, the back face smiling. **Win 2:** eyes glowing bright.

| Move | Files | Poses |
|---|---|---|
| Laser Eyes | `laser-eyes_01–02` | 1) Head pulled back, eyes glowing. 2) Leaning forward, eyes blazing. The game draws the beam. |
| Laser Eyes (up) | `laser-eyes-up_01` | Looking up at an angle, eyes blazing. |
| Camouflage | `camouflage_01` | Crouched low, perfectly still, blending in. The game fades him out. |
| I See You | `i-see-you_01–02` | 1) Counter stance, eyes wide, one hand raised. 2) Striking back, eyes blazing. |
| Super: Double Laser | `super_01–04` | 1) Both faces glowing. 2) Firing, leaning forward. 3) Firing harder, body braced. 4) Recovering, steam rising. |

### 7. Poker Stick (`poker-stick`): the spiky one

**CHARACTER:** Poker Stick, a tough woman in her twenties covered in long, sharp steel-gray spikes ("pokers") that grow out of her head like spiky hair, and out of her shoulders, back, forearms and shins. She wears a teal sleeveless bodysuit with black panels, black fingerless gloves and black boots. Fierce, determined expression.

- **Background:** magenta. **Size:** medium.
- **❓ Ask:** what do the pokers look like: metal spikes, porcupine quills, or thorns?
- **Home ❓ Ask:** Canada. Stage: a pine forest beside a lake.
- **Intro:** shaking herself so her spikes bristle up. **Win 1:** arms folded, spikes bristling. **Win 2:** twirling a spike in her fingers.

| Move | Files | Poses |
|---|---|---|
| Spike Shot | `spike-shot_01–02` | 1) Pulling a spike from her shoulder. 2) Throwing arm extended forward. |
| Spike effect | `spike-fx_01` | A single long, sharp steel-gray spike flying to the right. |
| Spike Ball | `spike-ball_01–02` | 1) Curling up. 2) Fully curled into a spiky ball. The game rolls it. |
| Porcupine Burst | `porcupine-burst_01–02` | 1) Crouched, hugging herself. 2) Arms flung out wide, every spike standing straight out. |
| Super: Spike Storm | `super_01–03` | 1) Arms raised to the sky. 2) Flinging spikes upward. 3) Watching them rain down, grinning. The game uses the spike effect for the rain. |

### 8. Richie (`richie`): the money fighter

**CHARACTER:** Richie, a big, broad, heavyset man in a shiny gold suit with a white shirt and a green dollar-sign tie, gold chains, gold rings on every finger, slicked-back black hair and gold-rimmed sunglasses. Big self-satisfied grin.

- **Background:** magenta. **Size:** big (the biggest fighter).
- **❓ Ask:** is Richie the big strong one who grabs and throws people? If so, Make It Rain becomes a big grab move. What did the machine do to him?
- **Home ❓ Ask:** USA. Stage: his giant gold vault, piled high with coins.
- **Intro:** fanning out a handful of cash. **Win 1:** throwing cash in the air. **Win 2:** polishing a ring, smug.

| Move | Files | Poses |
|---|---|---|
| Coin Toss | `coin-toss_01–02` | 1) Coin balanced on his thumb. 2) Flicking it forward. |
| Coin effect | `coin-fx_01–02` | A shiny gold coin: 1) seen face-on, 2) seen from the edge. The game spins it. |
| Money Bag Slam | `money-bag-slam_01–03` | 1) Swinging a big money bag back over his shoulder. 2) Swinging it forward. 3) Slamming it down. |
| Make It Rain | `make-it-rain_01–02` | 1) Hands full of coins. 2) Tossing them high into the air. The game drops the coins. |
| Super: Gold Rush | `super_01–04` | 1) Opening a glowing briefcase. 2) Gold blasting out of it. 3) Leaning into the blast. 4) Closing the case, smug. |

---

## Stages and portraits

- **Stages** (`stages/<fighter-folder>.png`, e.g. `stages/mohawk-man.png`):
  - The widest landscape size your tool offers, viewed straight from the side.
  - Flat, level ground across the bottom fifth.
  - No one in the foreground; a crowd far in the back is fine.
  - No text, no logos.
  - Same art style as the fighters.
- **Portraits:** see `portrait` in the frame list.
- **The final boss ❓ Ask:** Weight Kicker and Richie were both zapped by the same machine. Is whoever built it the final boss? If so, they get their own section later.

---

## Getting the images to me

- Keep the **full-size originals** in a folder with one subfolder per fighter, named as above. Google Drive works well: it's connected to this session, so I can pull from a folder you share. Uploading to the GitHub repo also works.
- I'll shrink them to game size and commit only the small versions to the repo. ~680 full-size images would bloat it to around a gigabyte.
