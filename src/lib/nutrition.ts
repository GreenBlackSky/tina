import { FOODS, MEAT } from '../data/foods';
import type { CustomFood, Item, Per100, SavedMeal } from './types';

/* Food numbers: the built-in table, your own foods, and adding things up. */

export const r0 = (n: number): number => Math.round(n || 0);
export const r1 = (n: number): number => Math.round((n || 0) * 10) / 10;
/** "1,234" */
export const fmt = (n: number): string => r0(n).toLocaleString('en-US');

export interface Food {
  key: string;
  name: string;
  per100: Per100;
  src: 'usda' | 'custom';
}

export const BASE_FOODS: Food[] = FOODS.map(([key, name, kcal, p, c, f]) => ({
  key,
  name,
  per100: { kcal, p, c, f },
  src: 'usda',
}));
const BASE_BY_KEY = new Map(BASE_FOODS.map((food) => [food.key, food]));

export const CUSTOM_PREFIX = 'custom:';

/** Every food search can offer: the table (without meat and fish for
    vegetarians) and your own foods. */
export function allFoods(custom: CustomFood[], vegetarian: boolean): Food[] {
  return BASE_FOODS.filter((food) => !vegetarian || !MEAT.has(food.key)).concat(
    custom.map((food) => ({
      key: CUSTOM_PREFIX + food.id,
      name: food.name,
      per100: food.per100,
      src: 'custom' as const,
    })),
  );
}

export function findFood(
  key: string | null | undefined,
  custom: CustomFood[],
  vegetarian: boolean,
): Food | null {
  if (!key) {
    return null;
  }
  return (
    BASE_BY_KEY.get(key) ?? allFoods(custom, vegetarian).find((food) => food.key === key) ?? null
  );
}

const MAX_RESULTS = 30;

/** Foods whose name contains every word typed. */
export function searchFoods(query: string, foods: Food[]): Food[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [];
  }
  return foods
    .filter((food) => words.every((word) => food.name.toLowerCase().includes(word)))
    .slice(0, MAX_RESULTS);
}

export function itemValues(item: Pick<Item, 'grams' | 'per100'>): Per100 {
  const grams = Number(item.grams) || 0;
  const per100 = item.per100 ?? ({} as Per100);
  return {
    kcal: ((per100.kcal || 0) * grams) / 100,
    p: ((per100.p || 0) * grams) / 100,
    c: ((per100.c || 0) * grams) / 100,
    f: ((per100.f || 0) * grams) / 100,
  };
}

export function sumItems(items: Array<Pick<Item, 'grams' | 'per100'>> | undefined): Per100 {
  return (items ?? []).reduce(
    (total, item) => {
      const values = itemValues(item);
      total.kcal += values.kcal;
      total.p += values.p;
      total.c += values.c;
      total.f += values.f;
      return total;
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
}

/** A number from anything, at least 0 and at most max (0 if not a number). */
export function clampNumber(value: unknown, max = Infinity): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
}

const MAX_KCAL_PER_100 = 950;
const MAX_GRAMS_PER_100 = 100;

/** Sanity-check per-100 g values that came from Claude. */
export function cleanPer100(value: unknown): Per100 | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  return {
    kcal: clampNumber(raw.kcal, MAX_KCAL_PER_100),
    p: clampNumber(raw.p, MAX_GRAMS_PER_100),
    c: clampNumber(raw.c, MAX_GRAMS_PER_100),
    f: clampNumber(raw.f, MAX_GRAMS_PER_100),
  };
}

/* "Fits what's left": saved meals that fit the calories left today. */
const MIN_LEFT_FOR_SUGGESTIONS = 150;
const MIN_MEAL_KCAL = 80;
const PROTEIN_WORTH_CHASING = 10;
const SUGGESTIONS_SHOWN = 6;

export function mealsThatFit(
  meals: SavedMeal[],
  kcalLeft: number,
  proteinLeft: number,
): Array<{ meal: SavedMeal; values: Per100 }> {
  if (kcalLeft < MIN_LEFT_FOR_SUGGESTIONS || !meals.length) {
    return [];
  }
  return meals
    .map((meal) => ({ meal, values: sumItems(meal.items) }))
    .filter((entry) => entry.values.kcal >= MIN_MEAL_KCAL && entry.values.kcal <= kcalLeft)
    .map((entry) => {
      /* prefer protein-dense meals while protein is short, then bigger meals */
      const proteinScore =
        proteinLeft > PROTEIN_WORTH_CHASING
          ? (Math.min(entry.values.p, proteinLeft) / Math.max(entry.values.kcal, 1)) * 1000
          : 0;
      return { ...entry, score: proteinScore + (entry.values.kcal / kcalLeft) * 20 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, SUGGESTIONS_SHOWN);
}
