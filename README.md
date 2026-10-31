# Tina

A calorie and macro log with a cat's eye. Photograph your plate or a
nutrition label, or type what you ate, and Claude estimates it; or search a
table of about 250 common foods. Every estimate opens for review — check the grams, then save.
Saved meals log again in two taps, a calculator works out your targets (with
every step explained), and Week shows how the days added up.

On Today, Tina's yellow eye shows how the day is going: the pupil is wide and
round when she's hungry and narrows to a slit near the target; a little over,
her eyelid droops, and well over she's asleep.

It began as a single-file claude.ai artifact and was ported to TypeScript
and Svelte; it was called Macro Lens until it was renamed and restyled. It
lives in the `apps` workspace with the other phone apps, which
installs the tools for all of them at once (see `apps/README.md`).

## Running it

You need Node.js. Install once in the `apps` folder (`npm install`
there), then in this folder:

```
npm run dev        a local server with instant reload
```

`npm run dev` prints two addresses. `localhost` works on this computer. The
`Network` one works on your phone too, if it is on the same Wi-Fi. (The
camera button opens the phone's camera; on the computer it opens a file
picker.)

## Claude (photo, label and text estimates)

Outside claude.ai the app calls Claude through the Anthropic API with your
own API key:

1. Create a key at platform.claude.com → Settings → API keys, and set a
   monthly spend limit there. API usage is billed separately from a Claude
   subscription. Each estimate sends a few thousand tokens (the food table
   goes along every time); Haiku is the cheapest model to pick.
2. In the app: **Targets → Claude**, paste the key, pick a model, Save.

The key is kept in that browser only — not in backups, not synced — and is
sent only to Anthropic. Anyone who can use that browser could find it, so
use it on your own devices only. Without a key, everything else (Search,
saved meals, the log) works as before.

## Your data

Your log, saved meals, own foods and targets live in the browser you use
the app in (until Firebase is set up). To move them, use **Targets → Your
data → Save backup**, then **Restore backup…** on the other device. Data
saved while the app was Macro Lens is carried over on first start. A backup
file saved back then says `"app": "macro-lens"` near the top; change that to
`"tina"` and it restores the same way.

## Checking it

```
npm run check      TypeScript and Svelte type checking
npm run lint       code problems (ESLint); lint:fix repairs what it can
npm run format     tidy the layout of every file (Prettier)
npm test           builds the app and drives it in a headless phone-sized
                   browser; Claude's answers are faked, so no key is used
                   (first time: npx playwright install chromium)
npm run icons      re-draw the PNG icons after changing public/icon.svg
```

## Building and deploying

`npm run build` writes `dist/` — plain files, the whole app. Uploading that
folder anywhere that serves https makes it installable on Android: open the
address in Chrome, then *Add to Home screen*. (The camera needs https too.)
With Firebase Hosting, once the project exists:

```
npx firebase login
npx firebase init hosting      public directory: dist, single-page app: yes
npm run build && npx firebase deploy
```

## What's where

```
src/
  main.ts              starts the app
  App.svelte           one screen at a time and the tab bar
  app.css              the one stylesheet (colours as tokens, always dark)
  screens/             Today, Add (capture and review), Meals, Week, Targets
  components/          the capture widget, food search, Tina's eye, the
                       Claude and backup cards
  data/foods.ts        the built-in food table (USDA reference values)
  lib/
    types.ts           what is saved, collection by collection
    nutrition.ts       food lookups, adding up, "fits what's left"
    eye.ts             which of the eye's six drawings fits the day
    targets.ts         the target calculator and its explanations
    dates.ts           local calendar days, meal slots
    image.ts           shrinking a photo before it is sent
    estimate/          Claude: the interface, the Anthropic API client,
                       the prompts, which key and model to use
    state.svelte.ts    everything on screen, kept live from the database,
                       and every action that changes it
    db/                the database: local (today), Firebase (stub), backups
public/                icons for the home screen
tests/                 end-to-end tests and their (made-up) sample data
```
