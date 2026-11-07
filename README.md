# Evs-Game

An original 2D fighting game for friends and family, in the spirit of early-90s arcade fighters. It runs in a web browser: open the link, plug in two controllers, and fight. Eight fighters are designed by our head character designer; the first two are playable now as placeholder figures while the art is being made.

## How to play

1. Open the game link (GitHub Pages, see below), or run it locally with `npm run dev`.
2. On the title screen, each player presses **Start** on their controller to join. The first controller to join is Player 1. (Players on the keyboard don't need to join.)
3. Press **Start** again (or **Enter**, or click) to fight.
4. After a match, press **Start** for a rematch.

**Keys:** **F1** shows hitboxes and frame info. **F** toggles fullscreen (between rounds). The game pauses if the tab is hidden or a controller is unplugged; press Start to carry on.

### Controls

| | Gamepad (standard layout) | Keyboard P1 | Keyboard P2 |
|---|---|---|---|
| Move / jump / crouch | D-pad or left stick | W A S D | Arrow keys |
| Light / Medium / Heavy Punch | X / Y / RB | U / I / O | Numpad 4 / 5 / 6 |
| Light / Medium / Heavy Kick | A / B / RT | J / K / L | Numpad 1 / 2 / 3 |
| Throw (same as Light Punch + Light Kick) | LT | H | Numpad 0 |
| Easy Special | LB | Y | Numpad 7 |
| Start | Start | Enter | Numpad Enter |

Hold **away** from your opponent to block. Crouch-block (down-away) stops low attacks; stand-block stops jumping attacks and overheads.

### Moves

Inputs are written for a fighter facing right (↓↘→ = quarter-circle forward). **P** = any punch, **K** = any kick; Light, Medium and Heavy change speed, distance and damage.

| Fighter | Move | Input | Easy mode |
|---|---|---|---|
| Mohawk Man | Karate Wave (fireball, one at a time) | ↓↘→ + P | Special |
| | Mohawk Ram (headfirst charge) | ↓↙← + P | Special + → |
| | Rising Chop (anti-air, invincible start) | →↓↘ + P | Special + ↓ |
| | **Super:** Thousand Chops | ↓↘→↓↘→ + P | Special + Heavy |
| Spin Kicker | Tornado Kick (several hits) | ↓↘→ + K | Special |
| | Cartwheel (passes through fireballs) | ↓↙← + K | Special + → |
| | Handspring Heel (overhead: block standing) | →↓↘ + K | Special + ↓ |
| | **Super:** Human Tornado | ↓↘→↓↘→ + K | Special + Heavy |

- **Supers** need a full meter (the blue bar at the bottom). It fills as you attack and as you take damage, and it carries over between rounds.
- **Throws:** Light Punch + Light Kick together when close (hold back to throw backwards). Press the same to break a throw right after you're grabbed: "ESCAPE!".
- **Combos:** light attacks chain into each other, and light and medium attacks cancel into specials when they connect. Damage scales down the longer a combo goes.
- **Dizzy:** take too many hits quickly and your fighter sees stars. Mash buttons and wiggle the stick to recover sooner.

### Easy mode

On the title screen, each player can press their **Special** button (LB / Y / Numpad 7) to turn Easy mode on or off. In Easy mode, Special plus a direction fires a special move and Special + a Heavy button fires the super. The regular inputs still work too. Easy-mode specials do 85% damage, so it stays fair.

## Development

```bash
npm install
npm run dev         # local dev server
npm test            # unit tests (Vitest)
npm run typecheck   # TypeScript
npm run build       # production build into dist/
npm run e2e         # browser smoke test (Playwright)
```

**Quick-setup URL parameters** (handy for testing): `?p1=spin-kicker&p2=mohawk-man&time=30&rounds=3`
- `p1`, `p2`: `mohawk-man` or `spin-kicker`
- `time`: round timer in seconds, 1–99, or `none`
- `rounds`: round wins needed, 1–3
- `easy`: `1`, `2` or `12` turns on Easy mode for those players

Anything invalid falls back to the default.

## Publishing

Every push to `main` runs the tests and deploys to GitHub Pages. The repository's **Settings → Pages → Source** must be set to **GitHub Actions** (one time).

## Documents

- [Game design spec](docs/superpowers/specs/2026-11-06-evs-game-design.md)
- [Art guide (for the humans)](docs/art-brief.md)
- [Image-model brief (upload this to the image model)](docs/image-model-brief.md)
- [Milestone 1 plan](docs/superpowers/plans/2026-11-06-m1-playable-skeleton.md)
