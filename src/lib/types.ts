/* What is saved, collection by collection. Field names are part of the saved
   format (existing backups must keep importing), so short ones stay. */

/** Energy and macros per 100 g (or 100 ml): kcal, protein, carbs, fat. */
export interface Per100 {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

/** Where an item's numbers came from, shown as a small badge. */
export type ItemSource = 'usda' | 'custom' | 'label' | 'est' | 'recipe';

/** One food in a logged entry, a saved meal or a draft. */
export interface Item {
  name: string;
  /** a key from the food table or 'custom:<id>'; null for estimates and labels */
  key: string | null;
  grams: number;
  per100: Per100;
  src?: ItemSource;
  /** what Claude called it, when it was matched to a different table name */
  guess?: string;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** One logged meal. */
export interface Entry {
  id: string;
  /** when it was logged (ISO) */
  t: string;
  meal: MealSlot;
  title: string;
  /** how it was added: photo, label, text, search, meal, manual */
  source: string;
  items: Item[];
  editedAt?: string;
}

/** 'days/{YYYY-MM-DD}': everything logged on one day. */
export interface Day {
  date: string;
  entries: Entry[];
}

/** 'meals/{id}': a saved meal to log again. */
export interface SavedMeal {
  id: string;
  name: string;
  items: Item[];
  createdAt?: string;
  updatedAt?: string;
  /** e.g. "Pike" for meals imported from recipes */
  source?: string;
  note?: string;
  recipeId?: string;
  tags?: string[];
}

/** 'foods/{id}': a food saved from a nutrition label. */
export interface CustomFood {
  id: string;
  name: string;
  per100: Per100;
  createdAt?: string;
}

export type Sex = 'male' | 'female';
export type Goal = 'lose' | 'maintain' | 'gain';

/** The calculator's inputs, kept as typed (strings while editing). */
export interface Profile {
  units: 'metric' | 'imperial';
  sex: Sex;
  age: string;
  heightCm: string | number;
  weightKg: string | number;
  bf: string;
  activity: string;
  goal: Goal;
  /** kg per week */
  rate: number;
  goalKg: string | number;
  /** protein level; missing → standard for vegetarians, higher otherwise */
  pLevel?: 'standard' | 'higher';
}

/** 'settings/targets' */
export interface Settings {
  kcal: number;
  p: number;
  c: number;
  f: number;
  /** false until the person sets their own (the defaults are examples) */
  isSet: boolean;
  method?: 'calculated' | 'custom';
  diet?: '' | 'vegetarian';
  profile?: Partial<Profile>;
}
