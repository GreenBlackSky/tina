# CLAUDE.md — Tina (calories)

A calorie and macro log with photo, label and text estimates by Claude.
Screens: Today, Meals, Add (the camera button), Week, Targets. Dev server
port 5183, test preview port 4183. It was called Macro Lens until it was
renamed and restyled (see docs/ROADMAP.md).

The look ("Night eyes"): a cat theme, always dark. Night background,
grey-fur cards, one yellow accent (`--accent`, the eyes), near-black
pupils; the Outfit font, a thin spaced "T I N A" wordmark. Today's top is
Tina's eye (`components/Eye.svelte`, states in `lib/eye.ts`): six fixed
drawings, no animation — the pupil narrows as the day fills, a little over
the eyelid droops, well over she's asleep. Over target is grey (`--over`)
with the word "over", never an alarm colour; `--warn` is only for errors
and Delete. Macro colours: protein violet, carbs coral, fat teal. Cat lines
are few and light; keep the rest of the wording as it is.

It began as a single-file claude.ai artifact (~1,400 lines) and was ported
to TypeScript and Svelte. Screens, wording and behaviour match the original
— Today, Meals, Week and the review screen were compared pixel for pixel
with the same data. What changed: Claude is reached through the Anthropic
API with the user's own key (the artifact used claude.ai's built-in
sampling), and the "Photo support" diagnostics became the Claude settings
card.

## The workspace (read this first)

This repo is developed inside an npm workspace: a parent folder, not in any
repo, whose `package.json` lists this project with a few others and holds
the one shared install. The app stands alone and shares no code with them.

- Some files are deliberately the same in sibling apps of the workspace
  and are kept in step by hand: `eslint.config.js`, `.prettierrc.json`,
  `src/lib/db/` (the database layer, except `index.ts`), `scripts/icons.mjs`.
- Install only from the workspace root: `npm install` there. Never run
  `npm install` inside a project (it would create a stray lock file and a
  local `node_modules` that shadows the shared one).
- Every project pins the same tool versions (exact versions in each
  `package.json`). An upgrade is done in all of them at once, then
  everything is tested: `npm test` from the workspace root.
- Machine-specific and personal notes live in the workspace's own
  CLAUDE.md, outside the repos. Keep this file free of them.

## Environment and tools

- Node 22. Editor settings (`.vscode/`) are git-ignored and machine-specific.
- Svelte 5 with runes; TypeScript 6, Vite 8, svelte-check 4. Playwright pinned to 1.56.1.

## Code style

- **Prettier** (100 columns, single quotes) and **ESLint** (`curly: all`,
  `one-var: never`, `prefer-const`, `no-nested-ternary` warning — none).
- Before finishing a change: `npm run format`, `npm run lint`,
  `npm run check` (0 warnings), `npm test`.
- Pure logic in plain `.ts` files; `state.svelte.ts` holds state and
  actions. Values saved go through JSON (`db/local.ts`).
- User-facing wording — especially the calculator's explanations and the
  prompts — was checked against the original; change it only on purpose.

## Claude

- `src/lib/estimate/types.ts` — the `Estimator` interface (`json(prompt,
  {images, signal})` → the parsed JSON object) and the error codes with
  their messages. Screens only see this.
- `anthropic.ts` — calls `POST https://api.anthropic.com/v1/messages` from
  the browser with the `anthropic-dangerous-direct-browser-access` header,
  the user's key, `anthropic-version: 2023-06-01`. Images go as base64
  JPEG content blocks before the text. The reply's JSON is pulled out even
  if wrapped in fences. Models offered: `claude-sonnet-5-5` (default),
  `claude-haiku-5-5`, `claude-opus-5-5`.
- `index.ts` — the key and model live in localStorage
  (`tina.anthropic-key`, `tina.anthropic-model`), never in the database:
  they must not reach a backup or Firestore. Values under the old names
  (`macro-lens.anthropic-*`) are copied over on first start.
- `prompts.ts` — the meal prompt sends the whole food table (key | name)
  so Claude can match items to it; unmatched items come back with its own
  per-100 g values and get the "estimate" badge.
- Tests fake the API with `page.route` (tests/helpers.ts `fakeClaude`);
  never put a real key in a test.
- Planned: move the key behind a Firebase function (see docs/ROADMAP.md);
  only `currentEstimator()` should need to change.

## Data

Saved through `src/lib/db` (Firestore-shaped). Today `LocalDatabase`, one
localStorage key `tina.db.v1` in the backup-file format. Data under the
old name's key, `macro-lens.db.v1`, is copied to it on first start
(`db/index.ts`). Backups carry `"app": "tina"`.
`src/lib/types.ts` documents every field. The saved format must not break:

- `days/{YYYY-MM-DD}`: `{date, entries: [{id, t, meal, title, source,
  items}]}` — a whole day is read and rewritten for every change; writes go
  through one queue so they never overlap.
- `meals/{id}`, `foods/{id}` (from labels), `settings/targets` (`{kcal, p,
  c, f, isSet, method, diet, profile}`).
- Items: `{name, key, grams, per100: {kcal, p, c, f}, src}`. Food table
  keys are saved in items — never rename one in `data/foods.ts`.

## Project notes

- Target is an Android phone: an installable PWA, later Firebase Hosting.
  Firebase is deliberately not implemented yet — only a stub.



## Commands (in this folder; install happens in the workspace root)

```
npm run dev        dev server with live reload
npm run check      svelte-check
npm run lint       ESLint (lint:fix fixes what it can)
npm run format     Prettier
npm test           builds, serves on the preview port, runs Playwright
npm run build      dist/ — the finished PWA
npm run icons      PNG icons from public/icon.svg
```

## Google backend: Firebase (planned, not started)

Not to be implemented until asked. `src/lib/db/firebase.ts` is
the stub. The design: one Firebase project shared with the sibling apps; one
Hosting site per app; optional Google sign-in; data in Firestore under
`users/{uid}/apps/tina/…` with the same documents as today; offline
persistence on; rules so a user reads and writes only their own subtree.

See `docs/ROADMAP.md`.
