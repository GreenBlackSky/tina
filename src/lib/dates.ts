import type { MealSlot } from './types';

/* Days as the app saves them: local calendar dates, 'YYYY-MM-DD'. */

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function dateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseDate(text: string): Date {
  const [year, month, day] = text.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(text: string, days: number): string {
  const date = parseDate(text);
  date.setDate(date.getDate() + days);
  return dateString(date);
}

export const today = (): string => dateString(new Date());

export const nowISO = (): string => new Date().toISOString();

/** "Today", "Yesterday", or "Mon 21 Oct". */
export function niceDate(text: string): string {
  const now = today();
  if (text === now) {
    return 'Today';
  }
  if (text === addDays(now, -1)) {
    return 'Yesterday';
  }
  return parseDate(text).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** The Monday of the week containing a day. */
export function mondayOf(text: string): string {
  const date = parseDate(text);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return dateString(date);
}

export const MEALS: Array<[MealSlot, string]> = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
  ['snack', 'Snacks'],
];

/** Singular names: Breakfast, Lunch, Dinner, Snack. */
export const MEAL_NAME: Record<MealSlot, string> = Object.fromEntries(
  MEALS.map(([key, label]) => [key, label.replace(/s$/, '')]),
) as Record<MealSlot, string>;

const BREAKFAST_UNTIL = 11;
const LUNCH_UNTIL = 15;
const SNACK_UNTIL = 18;

/** The meal you are most likely logging right now. */
export function mealByHour(): MealSlot {
  const hour = new Date().getHours();
  if (hour < BREAKFAST_UNTIL) {
    return 'breakfast';
  }
  if (hour < LUNCH_UNTIL) {
    return 'lunch';
  }
  return hour < SNACK_UNTIL ? 'snack' : 'dinner';
}

/** A short random id, unique enough for one person's log. */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
