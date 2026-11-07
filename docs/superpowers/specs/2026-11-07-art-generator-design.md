# Art Generator: Design Spec

**Date:** 2026-11-07
**Status:** Draft for review
**Related:** `docs/image-model-brief.md` (what to draw), `docs/art-brief.md` (the human guide), game spec section 13 (art import, Milestone 3)

---

## 1. Purpose

Generate every animation frame for a fighter without anyone sitting in an image chat. The person in charge (the parent, with the son as art director):
1. approves a **reference sheet**
2. says **go**
3. later **reviews** every frame on a web page, with Approve or Redo plus a note

Claude runs the generation from the cloud session, keeps it going between batches, regenerates the Redos, and hands approved frames to the game's art import (Milestone 3).

**Success looks like:**
- One "go" produces all ~85 frames of a fighter, correctly named, with no manual prompting.
- Reviewing takes clicks, not chat messages.
- A redo only regenerates the frames marked Redo.
- No full-size image is lost if the session drops between batches.

## 2. Not in scope

- Cutting images into game sprites and lining them up. That's Milestone 3's import tool; this tool only produces the source images.
- Stage backgrounds and portraits. The same tool can do them later with no design change, since they're entries in the brief, but the first goal is fighter frames.
- Any image service other than OpenAI.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Image service | **OpenAI Images API** (the model behind ChatGPT's images) | Matches the style of the approved lineup. Chosen by the user. |
| Where it runs | **This cloud session** (`tools/art-gen`, run by Claude) | Nobody touches a terminal; Claude can watch, retry and resume. |
| Consistency | Every frame request **attaches the approved reference sheet** and repeats the fighter's description word for word | Same approach as the human guide, applied automatically. |
| Background | **Transparent** (requested from the API) | Cleaner cut-outs than removing a magenta background; the brief already prefers transparent where available. |
| Default quality | **medium**; `low` and `high` available | Balances cost and detail. A pilot shows the result before spending on a full run. |
| Model | **Configurable**; the default is the newest `gpt-image*` model the account can use (found from the account's model list), falling back to `gpt-image-1` | Model names change; the tool shouldn't need editing when a new one ships. |
| Where full-size images live | **In each fighter's review page** (its private asset store, about 130 MB per fighter), plus a git-ignored working copy in `art-src/` | Permanent, downloadable, and never pushed through the conversation. The public repo stays small. |
| API key | A personal cloud environment **"Evs-Game"** with the key saved as a network secret (entered in a secure form) | The key is used only by this project's sessions; it never appears in chat, code or the repo. |

## 4. Workflow

1. **Reference.**
   - Claude generates **3 reference-sheet candidates** (front and side, per the brief's section 7), using the lineup crop `docs/art/reference/<fighter>.png` as their reference.
   - They appear on the fighter's review page with the lineup crop as a fourth choice.
   - The user picks one. That becomes `reference.png`.
2. **Pilot.** Claude generates 3 frames (`idle_01`, `stand-heavy-kick_02`, `crouch_02`). The user approves the look or asks for a change, e.g. switching quality or editing the brief's wording.
3. **Full run.** Claude generates the rest **in batches of 25**, in the brief's work order (section 8): the starter set first, then everything else. After each batch, its images are uploaded to the review page before the next batch starts.
4. **Review.** On the review page the user marks each frame **Approve** or **Redo** (with an optional note), or clicks **Approve all**. Choices save as they're made.
5. **Redo round.** When the user says "done reviewing", Claude regenerates only the Redo frames, adding each note to the prompt, and replaces them on the page. Repeat until all are approved.
6. **Hand-off.** Approved frames are ready for Milestone 3's import tool.

Running steps 3 and 5 again is safe: frames already generated, and not marked Redo, are skipped.

## 5. Components

```
tools/art-gen/
  brief.ts      Reads docs/image-model-brief.md into data: style rules, frame list, each fighter's description, flavor notes and moves, work order
  prompt.ts     Builds the exact prompt for (fighter, file, note?), and for a reference-sheet candidate
  openai.ts     Calls the Images API (edit-with-reference); retries and back-off; returns PNG bytes
  run.ts        Command line: which fighter, which files (pilot | all | redo list | named files), quality, model, limits; writes PNGs and a run log
art-src/<fighter>/      git-ignored working copies: <file>.png, reference.png, run-log.json
```

- **Single source of truth:** `brief.ts` parses `docs/image-model-brief.md`, which stays the one place the art is described. If the brief changes, the next run uses the change.
- **Prompt** (frames), in order:
  - the style rules
  - the image rules, with "transparent background" in place of the background-color line
  - "this is the same character as in the attached reference image…"
  - the fighter's description, verbatim
  - the fighter's flavor notes
  - the pose for that file
  - "Reviewer note: …" when redoing
- **API call:** the image-edit endpoint, with the reference sheet as the input image.
  - frames: 1024 × 1024
  - reference sheets: 1536 × 1024
  - `background: transparent`, PNG output, `n = 1`
  - 3 requests in flight at once
- **The review page** is a private claude.ai page per fighter ("Evs-Game Art: Mohawk Man"):
  - the frames are stored in its asset store
  - Approve/Redo/note choices are stored in the page's own small database, which Claude reads
  - it shows reference candidates at the top, then the frames grouped as in the brief, each with its file name, status and buttons
  - filters: All / Needs review / Redo / Approved
  - a count of how many are approved

## 6. Cost and safety

- **Approximate cost** at medium quality: a few cents per image. That's roughly $5–10 per fighter, including a round of redos. The run log records the count of images and the quality, so spend can be checked against OpenAI's dashboard.
- **Spending limits:**
  - each run has a hard cap on images (`--max` default 30, one batch plus margin)
  - a full fighter is several capped batches, each one only after the last was uploaded
  - nothing runs except when the user has said "go" for that fighter (or "done reviewing" for a redo round)
- **The key:** saved through the secure form, injected by the network proxy, never stored in code, the repo, logs or chat.

## 7. Error handling

| Situation | Behavior |
|---|---|
| Rate limit (429) or server error (5xx) | Retry with back-off (2, 4, 8, 16 s), then mark the frame **failed** in the run log and continue with the others |
| A request refused by the image service's content checks | Mark it **refused** with the service's message; do not retry automatically. Claude reports it and suggests a rewording |
| Invalid or missing key (401) | Stop the run immediately and report; no further requests |
| Session drops mid-batch | At most one batch of working copies is lost. Re-running skips frames already on the review page |
| A file name that isn't in the brief | The run refuses to start and lists the unknown names |
| The brief can't be parsed (e.g. a fighter section changed shape) | The run refuses to start and names the section; the parser tests catch this first |

## 8. Testing

- **Parser tests** (Vitest) run against the real `docs/image-model-brief.md`:
  - eight fighters, each with a description
  - the generic frame list (68 entries)
  - every fighter's move-table files
  - the work order starts with `reference` and then the starter set
- **Prompt tests:** the description appears verbatim, the pose is the one for that file, the background line says transparent, a redo note is appended, and nothing is left unfilled.
- **API client tests** with a fake `fetch`:
  - the request includes the reference image, size, quality and transparent background
  - retries on 429/5xx, stops on 401
  - a refusal is reported, not retried
  - base64 PNG decoding
- **Run planning tests:** pilot, all, redo and named-file selection; skipping existing frames; the `--max` cap; unknown file names rejected.
- **No test calls the real API.** The pilot run is the end-to-end check.

## 9. Open questions

- **Which fighter goes first.** Assumed **Mohawk Man**; the user may pick another.
- **Two-Face's second face** (back of the head?) must be settled before his reference sheet, since the current lineup shows one face.
