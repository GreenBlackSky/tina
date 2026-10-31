import type { Food } from '../nutrition';

/* What is asked of Claude. The wording was tuned in the original artifact;
   change it only on purpose, and test with real photos when you do. */

const JSON_SHAPE = `{"title":"short meal name","items":[{"name":"what it is","key":"a key from the table, or null","grams":150,"per100":null}],"comment":"one short sentence about anything uncertain, or empty"}
When "key" is null, "per100" must be {"kcal":number,"p":number,"c":number,"f":number} with your best values per 100 g.`;

const MAX_TEXT = 2000;
const MAX_NOTES = 1000;
const MAX_LABEL_NOTES = 600;

function catalogText(foods: Food[]): string {
  return foods.map((food) => `${food.key} | ${food.name}`).join('\n');
}

export interface MealPromptInput {
  kind: 'photo' | 'text';
  /** the typed description (text mode) */
  text: string;
  /** the optional note under a photo */
  notes: string;
  vegetarian: boolean;
  foods: Food[];
}

export function mealPrompt({ kind, text, notes, vegetarian, foods }: MealPromptInput): string {
  const intro =
    kind === 'photo'
      ? `You estimate nutrition for a calorie-tracking app. The attached photo shows food someone is about to eat.
Identify each distinct food or ingredient visible. Estimate the edible weight in grams as served (cooked weight for cooked food). Use things in the picture for scale: a dinner plate is about 26 cm, a fork about 19 cm, a hand about 18 cm long.
If food looks fried, glossy, buttered or dressed, add the cooking fat or sauce as its own item with a realistic amount.`
      : `You estimate nutrition for a calorie-tracking app. Here is a description of what someone ate:
"""${text.trim().slice(0, MAX_TEXT)}"""
Split it into distinct foods or ingredients and estimate the weight in grams of each (cooked weight for cooked food). Use typical portion sizes when the description gives none (1 large egg = 50 g, 1 slice of bread = 30 g, 1 tbsp oil = 13.5 g).`;
  const note =
    kind === 'photo' && notes.trim()
      ? `\nThe person added this note (trust it over the photo): """${notes.trim().slice(0, MAX_NOTES)}"""`
      : '';
  const diet = vegetarian
    ? `\nThe person is vegetarian: they eat eggs and dairy but never meat or fish. Anything that looks like meat or fish is a plant-based substitute (tofu, seitan, soy mince, veggie burger or sausage, plant-based chicken). Use those keys, never a meat or fish one.`
    : '';
  return `${intro}${note}${diet}

Match each item to ONE key from the reference table below when it is the same food in the same state (cooked vs raw). If nothing fits well, set "key" to null and give per-100 g values yourself.

Reference table (key | name):
${catalogText(foods)}

Reply with only JSON in this shape:
${JSON_SHAPE}
If there is no food, reply {"title":"","items":[],"comment":"what you see instead"}.`;
}

const LABEL_PROMPT = `Read the nutrition label in this photo for a calorie-tracking app.
Return values per 100 g (or per 100 ml for drinks). If the label only gives values per serving, convert using the serving size in grams. If energy is only in kJ, convert (kcal = kJ / 4.184).
Reply with only JSON:
{"name":"product name if visible, otherwise a short description","servingGrams":number or null,"per100":{"kcal":number,"p":number,"c":number,"f":number},"comment":"one short sentence about anything unclear, or empty"}
If you cannot read a nutrition label, set "per100" to null and say why in "comment".`;

export function labelPrompt(notes: string): string {
  const note = notes.trim();
  return (
    LABEL_PROMPT +
    (note
      ? `\nThe person added this note: """${note.slice(0, MAX_LABEL_NOTES)}"""\nIf the note says how much they ate, also return "gramsEaten": number (grams). Otherwise "gramsEaten": null.`
      : '')
  );
}
