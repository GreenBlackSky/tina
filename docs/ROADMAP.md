# Tina — roadmap

Nothing below is built yet.

## Claude without a key in the browser

Today the user's API key sits in the browser (fine for one person's own
devices). Before the app is shared, or if the key should not live on the
phone, move it behind a server. The options, cheapest first:

1. **A Firebase Cloud Function** holding the key (as a secret) and calling
   the Anthropic API. Calling outside services from Functions needs the
   Blaze (pay-as-you-go) plan; its free allowance covers personal use, but
   a card must be on file. The app sends the prompt and photo to the
   function instead of to Anthropic; only `currentEstimator()` changes.
2. **A small proxy elsewhere** on a free tier (e.g. a Cloudflare Worker),
   keeping Firebase on the free Spark plan.
3. **Gemini through Firebase AI Logic**, which works on Spark with no key
   in the app — but a different model, so the prompts need re-tuning and
   the estimates re-checking with real photos.

Whichever is used, the function should check the caller is signed in
(Firebase Auth) so it cannot be used by strangers.

## Firebase

1. **Hosting**: this app's `dist/` on its own Firebase Hosting site (https
   is also what lets the camera work on the phone).
2. **Sign-in and sync**: Google sign-in (optional); the log in Firestore
   under `users/{uid}/apps/tina/`, same documents as today.
3. **Moving in**: on first sign-in, upload what is in this browser.

## Foods from the internet: online search and barcodes

Not to be implemented until asked. Today Search only knows the built-in
table and My foods. The plan: as you type, the built-in and own foods show
at once, and after a short pause (about 0.4 s, at least 3 letters) online
results appear below in their own sections, each marked with its source,
while "Tina is sniffing…" shows. Picking one opens the usual review (grams,
then save) and keeps the food in My foods, so next time it's instant and
works offline. A barcode button next to the search box looks a packaged
product up by its code.

Two free sources, both tested from the app's page (both allow calls from
the browser):

- **USDA FoodData Central**, for plain ingredients (lab values, English
  names). `GET https://api.nal.usda.gov/fdc/v1/foods/search?query=…&dataType=Foundation,SR%20Legacy&pageSize=25&api_key=…`
  Needs a free personal key (api.data.gov, emailed in minutes), saved per
  device in localStorage like the Claude key — a "Food databases" card
  under Targets. Without one the shared `DEMO_KEY` works but allows only
  about 30 searches an hour. Energy comes in different fields per food
  (by `nutrientNumber`): kcal `208`, else Atwater kcal `958` or `957`, else
  kJ `268` ÷ 4.184; protein `203`, fat `204`, carbs `205`. `foodCategory`
  ("Beef Products", "Poultry Products", "Finfish and Shellfish Products",
  "Sausages and Luncheon Meats"…) is what vegetarian mode filters on.
- **Open Food Facts**, for packaged products (shop items, Serbian ones
  included; values typed in by volunteers, so quality varies). No key.
  Search: `GET https://world.openfoodfacts.org/cgi/search.pl?search_terms=…&json=1&page_size=20&fields=code,product_name,brands,nutriments,categories_tags`
  (about 0.5 s; limited to about 10 searches a minute, so debounce, cache
  per word, and say so on HTTP 429). The newer `search.openfoodfacts.org`
  does not allow browser calls. Values: `nutriments.energy-kcal_100g`
  (else `energy_100g` in kJ), `proteins_100g`, `carbohydrates_100g`,
  `fat_100g`. Vegetarian mode drops products whose `categories_tags`
  include meats, poultry, fish or seafood.
- **Barcodes**, from Open Food Facts:
  `GET https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=…`
  An unknown code answers HTTP 200 with `"status": 0`; a known product can
  still lack nutrition values — then offer the Label photo instead.
  Scanning: Chrome on Android has the built-in `BarcodeDetector` (formats
  ean_13, ean_8, upc_a, upc_e). Live camera scanning needs https (a
  hosted app, or localhost) — over the dev server's Wi-Fi address it isn't
  allowed, so also offer "photograph the barcode" (a file input, then
  `BarcodeDetector.detect` on the image) and typing the number. Desktop
  Chrome on Windows has no `BarcodeDetector`: typing only.

Saving: a picked food becomes a normal `foods/{id}` document, with two new
optional fields, `from: 'usda' | 'off'` and `ref` (fdcId or barcode), so
the same food is never saved twice. Old backups keep importing. Tests fake
both services with `page.route`, like Claude.

## A light theme ("day eyes")

Not to be implemented until asked. Tina is always dark ("Night eyes"). The
light version was sketched: a warm light grey page with white cards, the
eye kept as it is (yellow iris, dark pupil), and a deeper gold (about
`#C49410`) wherever yellow sits on a light background, so text stays
readable. To do: a second set of colour tokens in `app.css`, a switch —
Match device / Light / Dark — saved per device in localStorage (not in the
database, so it never reaches a backup), a place for it (Targets, next to
the Claude settings and backup cards), and the `theme-color` meta tag and
manifest colours following the choice.

## Changed during the port

- Claude is reached through the Anthropic API with your own key (Targets →
  Claude), instead of claude.ai's built-in sampling. Error messages now
  name the real causes (key refused, out of credit, busy).
- The "Photo support" diagnostics (claude.ai sampling limits) became the
  Claude settings card.
- The data is in this browser instead of claude.ai's database; a backup
  card under Targets saves and restores it.

## Changed after the port: Macro Lens became Tina

- Renamed. Data under the old key (`macro-lens.db.v1`) and the Claude key
  and model (`macro-lens.anthropic-*`) are copied to the new names on first
  start; the old copies are left as they were. Backups now say `"app":
  "tina"`.
- Restyled "Night eyes": always dark, grey fur and yellow eyes, the Outfit
  font. Today's ring became Tina's eye (six fixed drawings, `lib/eye.ts`)
  and the macro rings became bars. Over the target is shown in grey with
  the word "over", never in an alarm colour; carbs moved from amber to
  coral.
- A few cat lines: "Tina is sniffing your plate…" while Claude estimates,
  "Bowl's empty." on an empty Today, and her mood under the number.

## Ideas, not decided

- Logging a portion straight from Pike's "I made this".
- Unit tests for `targets.ts` (the calculator) and `nutrition.ts`.
