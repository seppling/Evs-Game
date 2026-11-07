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
| Start | Start | Enter | Numpad Enter |

Hold **away** from your opponent to block. Crouch-block (down-away) stops low attacks; stand-block stops jumping attacks. Special moves, throws, supers and Easy mode arrive in the next milestone.

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

Anything invalid falls back to the default.

## Publishing

Every push to `main` runs the tests and deploys to GitHub Pages. The repository's **Settings → Pages → Source** must be set to **GitHub Actions** (one time).

## Documents

- [Game design spec](docs/superpowers/specs/2026-11-06-evs-game-design.md)
- [Art guide (for the humans)](docs/art-brief.md)
- [Image-model brief (upload this to the image model)](docs/image-model-brief.md)
- [Milestone 1 plan](docs/superpowers/plans/2026-11-06-m1-playable-skeleton.md)
