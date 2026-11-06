# Evs-Game Art Guide (for you)

How to make the fighter art with an image model, one image per animation frame.

The instructions for the image model itself are in **[`image-model-brief.md`](image-model-brief.md)**. That file is the single source for every art detail: style, image rules, the frame list, all eight character descriptions, special moves, stages and work order. This guide is just for you: what to do, in what order, and what to check.

Fighters created by our head character designer. His version always wins.

---

## Checklist

1. ☐ **Go through the questions below with your son** and send me his answers. I'll update the character descriptions in `image-model-brief.md`. They go into every image, so they need to match his picture first.
2. ☐ **Start a new chat with the image model for one fighter.** Upload `image-model-brief.md` and say: *"Read this document. We're doing Mohawk Man. Start with the reference sheet."* (Use whichever fighter he likes best.)
3. ☐ **Let your son pick the best reference sheet.** Regenerate until he loves it, then save it as `reference.png`.
4. ☐ **Make the starter set (about 25 images).** Say *"next"* after each one; the model knows the order. Attach `reference.png` again whenever the look starts to drift.
5. ☐ **Send me the starter set.** I'll get the fighter moving in the game so we can check the art and fix the instructions before you make the other ~600 images.
6. ☐ Then do the rest: the full set for all eight fighters (one chat per fighter), plus portraits and stages.

---

## Questions for your son

Everything here is a guess and is currently written into `image-model-brief.md`. Ask him to check what each fighter looks like (hair, clothes, colors, size) as well as these:

| Fighter | Questions |
|---|---|
| **Mohawk Man** | Where is he from? (Guess: London, England.) |
| **Spin Kicker** | What does she look like? (Guess: dark ponytail, purple-and-silver leotard.) Where is she from? (Guess: Romania.) |
| **Flip Spin Crawler** | Is he called "Crawler" because he crawls like a spider? Where is he from? (Guess: Hong Kong.) |
| **Weight Kicker** | Why "Weight"? (Guess: heavy weights strapped to his ankles.) What did the machine do to him? Does he have a super-move idea? (Guess: "Overload.") |
| **Head Flip** | Does she carry a walking stick? Where is she from? (Guess: Egypt, by the pyramids.) |
| **Two-Face** | Does he really have two faces? Where is the second one? (Guess: on the back of his head.) What do they look like? |
| **Poker Stick** | What do the pokers look like: metal spikes, porcupine quills or thorns? Where is she from? (Guess: Canada.) |
| **Richie** | Is he the big strong one who grabs and throws people? What did the machine do to him? |
| **Final boss** | Weight Kicker and Richie were both zapped by the same machine. Is whoever built it the final boss? |

---

## What to check on every image

Reject and say *"redo"* if any of these are wrong. Small differences become flicker when the frames play as animation.

- **Same character:** face, hair, outfit and colors match the reference sheet.
- **Facing right.**
- **Same size and camera** as the other frames. A crouch should look shorter, not zoomed in.
- **Whole body visible:** nothing cut off, including flames, spikes or kicks.
- **Flat background:** one solid color, or transparent. No floor, shadow, text or effects.
- **Saved as PNG** with the exact file name the model gives you.

## Tips

- **One chat per fighter.** Long chats drift. Start fresh for each fighter, upload `image-model-brief.md` and `reference.png`, and say which file you're up to.
- **Try strips for multi-frame moves.** Models are often more consistent within a single image. Say *"strip of `stand-heavy-kick_01` to `_03`"*. Try both strips and single frames on the first fighter and keep whichever looks better. I'll cut strips apart.
- **Keep notes.** Keep a `notes.txt` in each fighter's folder with the model and any settings you used, so you can match the style later.
- **Don't fix positioning by hand.** I'll build a tool that lines up the feet and lets us nudge any frame that's too big or small.
- **Don't make alternate color versions.** The game recolors fighters automatically when both players pick the same one.

---

## Getting the images to me

- Keep the **full-size originals** in a folder with one subfolder per fighter (`mohawk-man`, `spin-kicker`, `flip-spin-crawler`, `weight-kicker`, `head-flip`, `two-face`, `poker-stick`, `richie`, plus `stages`).
- **Google Drive works well.** It's connected to this session, so I can pull from a folder you share. Uploading to the GitHub repo also works.
- I'll shrink the images to game size and commit only the small versions. ~680 full-size images would bloat the repo to around a gigabyte.
