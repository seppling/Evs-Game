# Art generator runbook

How Claude makes a fighter's frames with the OpenAI Images API and gets them reviewed. The design is in `docs/superpowers/specs/2026-11-07-art-generator-design.md`.

**Golden rules:**
- Spend money only after the user says **go** (or **done reviewing** for redos).
- Never more than one batch (`--max 25`) per command.
- Upload each batch before starting the next.

## Commands

```
npm run art -- --fighter <id> (--pilot | --all | --files a,b,c | --reference 3)
               [--quality low|medium|high] [--model <id>] [--max 30] [--notes notes.json] [--skip <file>] [--dry-run]
```

- **Output:** `art-src/<id>/<file>.png` (git-ignored), plus a run log `art-src/<id>/run-<time>.json`.
- **Errors:** the run refuses to start on an unknown file name, a brief it can't parse, or a missing reference picture.
- **`--dry-run`:** shows the plan and the first prompt without calling the API.

## 1. Setup (once per session)

1. **Environment:** the key belongs to a personal cloud environment named **Evs-Game**, not the Default one.
   - Call `get_environment`. If this session isn't already on Evs-Game, propose `create_environment` (personal, `switch_session: network_only`, allow `api.openai.com`, package managers and MCP servers).
   - Then call `request_credential` for host `api.openai.com` (Bearer).
   - Never ask for the key in chat.
2. **Check the key with no image spend:** `node -e "import('./tools/art-gen/openai.ts').then(async m => console.log(m.pickModel(await m.listModels())))"`. It should print a `gpt-image…` model name.

## 2. The fighter's review page

1. **Copy the page.** Copy `tools/art-gen/review.html` to the scratchpad as `review-<id>.html` and replace every `{{FIGHTER}}` with the fighter's name, e.g. `Mohawk Man`.
2. **Publish it** (first time only) with `capabilities: { db: {}, assets: {} }`, icon `image`, and a description like "Approve or redo every animation frame for <Name>". Later publishes of the same file keep the same link and omit `icon`.
3. **Fill in its database** with `ArtifactData` on the page's URL:
   - `set` `meta/info` to `{ fighter: '<id>', name: '<Name>' }`
   - upload `docs/art/reference/<id>.png` as an asset (`asset: true`), then `set` `references/lineup` to `{ id: 'lineup', label: 'Your lineup', url: <asset url>, order: 0 }`
4. **Record the page URL** in `art-src/<id>/page.txt`.

## 3. Reference round

1. `npm run art -- --fighter <id> --reference 3`
2. Upload the three `reference-candidate-N.png` files as assets (one call with `file_paths`).
3. `set` `references/candidate-N` to `{ id: 'candidate-N', label: 'Option N', url, order: N }`.
4. Ask the user to pick one on the page.
5. Read `choice/reference`.
   - If they picked a candidate, copy it to `art-src/<id>/reference.png`. It's already local; if the session restarted, download the asset with `Artifact read` and `path`.
   - If they picked the lineup, copy `docs/art/reference/<id>.png`.

## 4. Pilot

1. `npm run art -- --fighter <id> --pilot`
2. Upload the three frames.
3. For each, `set` `frames/<file>` to `{ file, group, order, url, version: 1, status: 'pending', note: '' }`.
   - `group` and `order` come from the brief: the heading the frame sits under, and its position in `workOrder`.
4. Append the names to `art-src/<id>/uploaded.txt`.
5. Wait for the user to approve the look before any full run.

## 5. Batches (after "go")

Repeat until the command says `nothing to generate`:

1. `npm run art -- --fighter <id> --all --max 25 --skip art-src/<id>/uploaded.txt`
2. Upload the new PNGs (up to 25 per call with `file_paths`).
3. Write their `frames/<file>` rows with one `ArtifactData` `batch`.
4. Append their names to `uploaded.txt`.
5. Tell the user how many are ready to review.

**Problems in a run:** report refused frames (the content check's message) and failed frames to the user. A refused frame needs a rewording in the brief or a note before it's retried.

## 6. Redo round (after "done reviewing")

1. `query` `frames` where `status == 'redo'`.
2. Write `art-src/<id>/notes.json` as `{ file: note }`.
3. `npm run art -- --fighter <id> --files <comma list> --notes art-src/<id>/notes.json`
   - `--max` defaults to 30. Split longer lists into several runs.
4. Upload the new PNGs, then `update` each row with `{ url, version: version + 1, status: 'pending', note: '' }`.
5. Delete the replaced assets from the page's asset store.
6. Repeat until nothing is marked Redo.

## 7. Hand-off

When every frame row is `approved`, the fighter is done. The approved PNGs (in `art-src/<id>/`, or downloadable from the page) feed Milestone 3's art import tool.
