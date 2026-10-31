import { addDays, mealByHour, mondayOf, nowISO, today, uid } from './dates';
import { db, DbError } from './db';
import { currentEstimator, errorMessage, EstimateError, type Estimator } from './estimate';
import { labelPrompt, mealPrompt } from './estimate/prompts';
import { prepareImage } from './image';
import {
  allFoods,
  clampNumber,
  cleanPer100,
  findFood,
  fmt,
  r0,
  r1,
  sumItems,
  type Food,
} from './nutrition';
import { DEFAULT_PROFILE } from './targets';
import type {
  CustomFood,
  Day,
  Entry,
  Item,
  MealSlot,
  Per100,
  Profile,
  SavedMeal,
  Settings,
} from './types';
import { toast } from './ui/toast.svelte';

/* Everything the screens show, kept live from the database, and every action
   that changes it. Svelte re-draws whatever reads a $state value when it
   changes — like a spreadsheet recalculating. */

export type View = 'today' | 'meals' | 'add' | 'week' | 'settings';
export type CaptureMode = 'photo' | 'label' | 'text' | 'search' | 'meal';
/** Which capture widget a request belongs to: the Add screen, or "add to this meal". */
export type CaptureTarget = 'new' | 'append';

/** A meal being reviewed before it is saved — logged, edited or built. */
export interface Draft {
  mode: 'log' | 'editEntry' | 'editMeal' | 'newMeal';
  date: string;
  meal: MealSlot;
  title: string;
  /** Claude's note about anything uncertain */
  comment: string;
  items: Item[];
  /** how it started: photo, label, text, search, meal */
  source?: string;
  /** log mode: also keep it as a saved meal */
  saveMeal: boolean;
  mealName: string;
  /** a food read from a label, offered for "My foods" */
  labelFood?: { name: string; per100: Per100 };
  saveFood?: boolean;
  /** editMeal: which saved meal */
  mealId?: string;
  /** editEntry: the entry as it was, and its day */
  orig?: Entry;
  origDate?: string;
  /** where Cancel goes back to */
  returnTo?: View;
}

const DEFAULT_SETTINGS: Settings = { kcal: 2000, p: 150, c: 200, f: 65, isSet: false };
const MAX_ITEMS = 25;
const MAX_GRAMS = 3000;
const MAX_NAME = 80;
/** How many days of log the app listens to. */
const DAYS_LOADED = 400;
const ARM_MS = 3500;

export const data = $state({
  settings: { ...DEFAULT_SETTINGS } as Settings,
  days: {} as Record<string, Day>,
  meals: [] as SavedMeal[],
  foods: [] as CustomFood[],
});

export const ui = $state({
  view: 'today' as View,
  /** the day shown on Today */
  date: today(),
  /** the Monday shown on Week */
  weekStart: mondayOf(today()),
  /** the Add screen's capture mode */
  mode: 'photo' as CaptureMode,
  /** the review screen's "Add to this meal" mode (null = closed) */
  addMode: null as CaptureMode | null,
  file: null as Blob | null,
  fileUrl: null as string | null,
  fileNote: '',
  notes: '',
  text: '',
  /** a request in flight: which kind, and for which widget */
  busy: null as 'photo' | 'label' | 'text' | null,
  busyTarget: null as CaptureTarget | null,
  error: '',
  errorTarget: null as CaptureTarget | null,
  draft: null as Draft | null,
  /** the food search box, and what a picked result is for */
  search: '',
  searchFor: null as { type: 'new' | 'add' | 'meal' } | { type: 'swap'; index: number } | null,
  /** a delete button waiting for its second tap, e.g. 'e:<entryId>' */
  armed: null as string | null,
  /** the target calculator's inputs */
  profile: { ...DEFAULT_PROFILE } as Profile,
  /** the meal slot "+ Add lunch" was tapped for */
  pendingMeal: null as MealSlot | null,
  mealQuery: '',
  /** bumped when the Claude key changes, so screens re-check it */
  estimatorVersion: 0,
});

let abortController: AbortController | null = null;

export const isVegetarian = (): boolean => data.settings.diet === 'vegetarian';
export const foodList = (): Food[] => allFoods(data.foods, isVegetarian());

export function estimator(): Estimator | null {
  void ui.estimatorVersion;
  return currentEstimator();
}

export function dayTotals(date: string): Per100 {
  return sumItems((data.days[date]?.entries ?? []).flatMap((entry) => entry.items));
}

/* ---------------- loading ---------------- */

export function startState(): void {
  db.collection<Day>('days')
    .orderBy('date', 'desc')
    .limit(DAYS_LOADED)
    .onSnapshot((snap) => {
      data.days = Object.fromEntries(snap.docs.map((doc) => [doc.id, doc.data()]));
    });
  db.collection<SavedMeal>('meals').onSnapshot((snap) => {
    data.meals = snap.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  });
  db.collection<CustomFood>('foods').onSnapshot((snap) => {
    data.foods = snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  });
  db.doc<Settings>('settings/targets').onSnapshot((snap) => {
    if (snap.exists) {
      const saved = snap.data()!;
      data.settings = { ...data.settings, ...saved, isSet: saved.isSet !== false };
    }
  });
}

/* ---------------- saving (one write at a time, in order) ---------------- */

let writeChain: Promise<void> = Promise.resolve();

function queue(write: () => Promise<void>): Promise<void> {
  writeChain = writeChain.then(write).catch((e) => {
    console.error(e);
    toast(
      e instanceof DbError && e.code === 'quota_exceeded'
        ? 'Storage is full — delete old saved meals.'
        : 'Couldn’t save. Try again.',
    );
  });
  return writeChain;
}

async function getDay(date: string): Promise<Day> {
  const snap = await db.doc<Day>(`days/${date}`).get();
  return snap.exists ? snap.data()! : { date, entries: [] };
}

async function putDay(date: string, entries: Entry[]): Promise<void> {
  data.days[date] = { date, entries };
  await db.doc<Day>(`days/${date}`).set({ date, entries });
}

export function addEntry(date: string, entry: Entry): Promise<void> {
  return queue(async () => {
    const day = await getDay(date);
    await putDay(date, [...(day.entries ?? []), entry]);
  });
}

export function removeEntry(date: string, id: string): Promise<void> {
  return queue(async () => {
    const day = await getDay(date);
    await putDay(
      date,
      (day.entries ?? []).filter((entry) => entry.id !== id),
    );
  });
}

export function saveMeal(meal: SavedMeal): Promise<void> {
  return queue(() => db.doc<SavedMeal>(`meals/${meal.id}`).set(meal));
}

export function deleteMeal(id: string): Promise<void> {
  return queue(() => db.doc(`meals/${id}`).delete());
}

export function saveFood(food: CustomFood): Promise<void> {
  return queue(() => db.doc<CustomFood>(`foods/${food.id}`).set(food));
}

export function deleteFood(id: string): Promise<void> {
  return queue(() => db.doc(`foods/${id}`).delete());
}

export function saveSettings(settings: Omit<Settings, 'isSet' | 'diet'>): Promise<void> {
  data.settings = { ...settings, diet: data.settings.diet || '', isSet: true };
  const snapshot = { ...data.settings };
  return queue(() => db.doc<Settings>('settings/targets').set(snapshot));
}

export function setDiet(diet: '' | 'vegetarian'): void {
  data.settings.diet = diet;
  const snapshot = { ...data.settings };
  void queue(() => db.doc<Settings>('settings/targets').set(snapshot));
  toast(diet ? 'Vegetarian mode on' : 'Vegetarian mode off');
}

/* ---------------- navigation ---------------- */

export function go(view: View): void {
  ui.view = view;
  ui.armed = null;
  if (view === 'settings') {
    ui.profile = { ...DEFAULT_PROFILE, ...(data.settings.profile ?? {}) } as Profile;
  }
  window.scrollTo(0, 0);
}

/** Delete buttons need two taps; true on the second. */
export function arm(key: string): boolean {
  if (ui.armed === key) {
    ui.armed = null;
    return true;
  }
  ui.armed = key;
  setTimeout(() => {
    if (ui.armed === key) {
      ui.armed = null;
    }
  }, ARM_MS);
  return false;
}

/* ---------------- capture: photos, text, search ---------------- */

export function clearFile(): void {
  if (ui.fileUrl) {
    URL.revokeObjectURL(ui.fileUrl);
  }
  ui.file = null;
  ui.fileUrl = null;
}

export async function takeFile(file: File): Promise<void> {
  clearFile();
  ui.error = '';
  ui.fileNote = 'Preparing photo…';
  const { blob, note } = await prepareImage(file);
  ui.file = blob;
  ui.fileUrl = URL.createObjectURL(blob);
  ui.fileNote = note;
}

function newDraft(fields: Partial<Draft>): Draft {
  const meal = ui.pendingMeal ?? mealByHour();
  ui.pendingMeal = null;
  return {
    mode: 'log',
    date: ui.date,
    meal,
    title: '',
    comment: '',
    items: [],
    saveMeal: false,
    mealName: '',
    ...fields,
  };
}

function resetCapture(): void {
  clearFile();
  ui.notes = '';
  ui.text = '';
  ui.fileNote = '';
}

async function readLabel(target: CaptureTarget, signal: AbortSignal): Promise<Item[] | null> {
  const result = (await estimator()!.json(labelPrompt(ui.notes), {
    images: [ui.file!],
    signal,
  })) as Record<string, unknown> | null;
  const per100 = cleanPer100(result?.per100);
  if (!per100) {
    ui.error = String(result?.comment || '') || 'Couldn’t read a nutrition label in that photo.';
    return null;
  }
  const name = String(result?.name || 'Packaged food').slice(0, MAX_NAME);
  const grams =
    clampNumber(result?.gramsEaten, MAX_GRAMS) ||
    clampNumber(result?.servingGrams, MAX_GRAMS) ||
    100;
  const item: Item = { name, key: null, grams: r0(grams), per100, src: 'label' };
  if (target === 'new') {
    ui.draft = newDraft({
      title: name,
      source: 'label',
      comment: String(result?.comment || ''),
      items: [item],
      labelFood: { name, per100 },
      saveFood: true,
    });
    return [];
  }
  if (!data.foods.some((food) => food.name === name)) {
    void saveFood({ id: uid(), name, per100, createdAt: nowISO() });
    toast(`Added “${name}” and saved it to My foods`);
  }
  return [item];
}

async function estimateMeal(
  kind: 'photo' | 'text',
  target: CaptureTarget,
  signal: AbortSignal,
): Promise<Item[] | null> {
  const prompt = mealPrompt({
    kind,
    text: ui.text,
    notes: ui.notes,
    vegetarian: isVegetarian(),
    foods: foodList(),
  });
  const result = (await estimator()!.json(prompt, {
    images: kind === 'photo' ? [ui.file!] : undefined,
    signal,
  })) as Record<string, unknown> | null;
  const raw = Array.isArray(result?.items) ? (result.items as unknown[]).slice(0, MAX_ITEMS) : [];
  const items = raw
    .map((value): Item | null => {
      const found = value as Record<string, unknown> | null;
      const food = findFood(found?.key as string, data.foods, isVegetarian());
      const grams = r0(clampNumber(found?.grams, MAX_GRAMS));
      if (food) {
        return {
          name: food.name,
          key: food.key,
          grams,
          per100: { ...food.per100 },
          src: food.src,
          guess: String(found?.name || ''),
        };
      }
      const per100 = cleanPer100(found?.per100);
      return per100
        ? {
            name: String(found?.name || 'Food').slice(0, MAX_NAME),
            key: null,
            grams,
            per100,
            src: 'est',
          }
        : null;
    })
    .filter((item): item is Item => item !== null);
  if (!items.length) {
    ui.error =
      String(result?.comment || '') || 'No food found. Try another photo or describe it in text.';
    return null;
  }
  if (target === 'new') {
    ui.draft = newDraft({
      title: String(result?.title || '').slice(0, MAX_NAME),
      source: kind,
      comment: String(result?.comment || ''),
      items,
    });
    return [];
  }
  if (result?.comment && ui.draft) {
    ui.draft.comment = String(result.comment);
  }
  return items;
}

/** Ask Claude about the photo, label or text in the capture widget. */
export async function runEstimate(
  kind: 'photo' | 'label' | 'text',
  target: CaptureTarget,
): Promise<void> {
  if (!estimator() || ui.busy) {
    return;
  }
  ui.error = '';
  ui.errorTarget = target;
  ui.busy = kind;
  ui.busyTarget = target;
  abortController = new AbortController();
  let added: Item[] | null = null;
  try {
    added =
      kind === 'label'
        ? await readLabel(target, abortController.signal)
        : await estimateMeal(kind, target, abortController.signal);
  } catch (e) {
    const code = e instanceof EstimateError ? e.code : '';
    ui.error = errorMessage(e) + (code && code !== 'cancelled' ? ` (${code})` : '');
  } finally {
    if (added) {
      if (added.length && ui.draft) {
        ui.draft.items.push(...added);
        toast(`Added ${added.length} item${added.length > 1 ? 's' : ''}`);
        ui.addMode = null;
      }
      resetCapture();
    }
    ui.busy = null;
    abortController = null;
  }
}

export function stopEstimate(): void {
  abortController?.abort();
}

/** A food picked from search: start a draft, add it, or swap an item for it. */
export function pickFood(key: string): void {
  const food = findFood(key, data.foods, isVegetarian());
  if (!food) {
    return;
  }
  const item: Item = {
    name: food.name,
    key: food.key,
    grams: 100,
    per100: { ...food.per100 },
    src: food.src,
  };
  const purpose = ui.searchFor ?? { type: 'new' as const };
  if (purpose.type === 'swap' && ui.draft) {
    const old = ui.draft.items[purpose.index];
    ui.draft.items[purpose.index] = { ...item, grams: old.grams };
  } else if (purpose.type === 'add' && ui.draft) {
    ui.draft.items.push(item);
    ui.addMode = null;
  } else {
    ui.draft = newDraft({ source: 'search', items: [item] });
  }
  ui.searchFor = null;
  ui.search = '';
}

/** A saved meal picked while building a meal: its foods are added. */
export function pickMealInto(id: string): void {
  const meal = data.meals.find((other) => other.id === id);
  if (meal && ui.draft) {
    ui.draft.items.push(...meal.items.map((item) => ({ ...item })));
    toast(`Added ${meal.name}`);
  }
  ui.searchFor = null;
  ui.search = '';
  ui.addMode = null;
}

/* ---------------- drafts ---------------- */

const copyItems = (items: Item[]): Item[] =>
  items.map((item) => ({ ...item, per100: { ...item.per100 } }));

function openDraft(draft: Draft): void {
  ui.addMode = null;
  ui.draft = draft;
  ui.searchFor = null;
  ui.search = '';
  ui.error = '';
  ui.view = 'add';
  window.scrollTo(0, 0);
}

/** "Log it" on a saved meal: open it for review first. */
export function startDraftFromMeal(meal: SavedMeal): void {
  ui.draft = newDraft({
    date: ui.date,
    title: meal.name,
    source: 'meal',
    items: copyItems(meal.items),
  });
  ui.view = 'add';
  window.scrollTo(0, 0);
}

export function newSavedMeal(): void {
  openDraft({
    mode: 'newMeal',
    title: '',
    items: [],
    returnTo: 'meals',
    date: today(),
    meal: 'snack',
    comment: '',
    saveMeal: false,
    mealName: '',
  });
}

export function editSavedMeal(meal: SavedMeal): void {
  openDraft({
    mode: 'editMeal',
    mealId: meal.id,
    title: meal.name,
    items: copyItems(meal.items),
    returnTo: 'meals',
    date: today(),
    meal: 'snack',
    comment: '',
    saveMeal: false,
    mealName: '',
  });
}

export function editEntry(entry: Entry): void {
  openDraft({
    mode: 'editEntry',
    orig: entry,
    origDate: ui.date,
    date: ui.date,
    meal: entry.meal || 'snack',
    title: entry.title,
    items: copyItems(entry.items),
    returnTo: 'today',
    comment: '',
    saveMeal: false,
    mealName: '',
  });
}

export function logEntryAgain(entry: Entry): void {
  ui.draft = newDraft({
    date: today(),
    meal: entry.meal,
    title: entry.title,
    source: 'meal',
    items: entry.items.map((item) => ({ ...item })),
  });
  ui.view = 'add';
}

export function cancelDraft(): void {
  const back = ui.draft?.returnTo;
  abortController?.abort();
  ui.draft = null;
  ui.addMode = null;
  clearFile();
  ui.fileNote = '';
  ui.searchFor = null;
  ui.search = '';
  ui.error = '';
  if (back) {
    ui.view = back;
  }
}

function finishDraft(view: View): void {
  ui.draft = null;
  ui.searchFor = null;
  ui.search = '';
  ui.error = '';
  ui.view = view;
  window.scrollTo(0, 0);
}

/** A title from the first three foods: "Rice, Tofu, Broccoli". */
const titleFrom = (items: Item[]): string =>
  items
    .map((item) => item.name.split(',')[0])
    .slice(0, 3)
    .join(', ');

export async function commitDraft(): Promise<void> {
  const draft = ui.draft;
  if (!draft || !draft.items.length) {
    return;
  }
  const items: Item[] = draft.items
    .filter((item) => Number(item.grams) > 0)
    .map((item) => ({
      name: item.name,
      key: item.key || null,
      grams: r1(Number(item.grams)),
      per100: item.per100,
      src: item.src,
    }));
  if (!items.length) {
    toast('Set a weight for at least one item.');
    return;
  }
  const title = (draft.title || '').trim() || titleFrom(items);

  if (draft.mode === 'editMeal' || draft.mode === 'newMeal') {
    const base: Partial<SavedMeal> =
      draft.mode === 'editMeal' ? (data.meals.find((meal) => meal.id === draft.mealId) ?? {}) : {};
    void saveMeal({
      ...base,
      id: draft.mealId || uid(),
      name: title,
      items,
      createdAt: base.createdAt || nowISO(),
      updatedAt: nowISO(),
    });
    finishDraft('meals');
    toast(draft.mode === 'editMeal' ? 'Meal updated' : 'Meal saved');
    return;
  }

  if (draft.mode === 'editEntry' && draft.orig && draft.origDate) {
    const original = draft.orig;
    const fromDate = draft.origDate;
    const toDate = draft.date || fromDate;
    const updated: Entry = { ...original, meal: draft.meal, title, items, editedAt: nowISO() };
    void queue(async () => {
      const fromDay = await getDay(fromDate);
      if (toDate === fromDate) {
        await putDay(
          fromDate,
          (fromDay.entries ?? []).map((entry) => (entry.id === original.id ? updated : entry)),
        );
      } else {
        await putDay(
          fromDate,
          (fromDay.entries ?? []).filter((entry) => entry.id !== original.id),
        );
        const toDay = await getDay(toDate);
        await putDay(toDate, [...(toDay.entries ?? []), updated]);
      }
    });
    ui.date = toDate;
    finishDraft('today');
    toast('Changes saved');
    return;
  }

  const entry: Entry = {
    id: uid(),
    t: nowISO(),
    meal: draft.meal,
    title,
    source: draft.source || 'manual',
    items,
  };
  const date = draft.date || today();
  void addEntry(date, entry);
  if (draft.saveMeal) {
    void saveMeal({
      id: uid(),
      name: (draft.mealName || title).trim(),
      items,
      createdAt: nowISO(),
    });
  }
  if (draft.labelFood && draft.saveFood) {
    void saveFood({
      id: uid(),
      name: draft.labelFood.name,
      per100: draft.labelFood.per100,
      createdAt: nowISO(),
    });
  }
  ui.addMode = null;
  resetCapture();
  ui.date = date;
  finishDraft('today');
  toast(`Logged ${fmt(sumItems(items).kcal)} kcal`);
}

export function scaleDraft(factor: number): void {
  if (ui.draft && factor > 0) {
    for (const item of ui.draft.items) {
      item.grams = r1((Number(item.grams) || 0) * factor);
    }
  }
}

export function saveEntryAsMeal(entry: Entry): void {
  void saveMeal({ id: uid(), name: entry.title, items: entry.items, createdAt: nowISO() });
  toast('Saved to regular meals');
}

export function previousDay(): void {
  ui.date = addDays(ui.date, -1);
}

export function nextDay(): void {
  if (ui.date < today()) {
    ui.date = addDays(ui.date, 1);
  }
}
