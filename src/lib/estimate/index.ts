import { AnthropicEstimator, DEFAULT_MODEL } from './anthropic';
import type { Estimator } from './types';

/* Which estimator the app uses. Today: Claude with the key saved on this
   device, or none. The key and model are kept per device in localStorage —
   not in the database, so they never end up in a backup or (later) in
   Firestore. */

const KEY_STORAGE = 'tina.anthropic-key';
const MODEL_STORAGE = 'tina.anthropic-model';

/* The app was called Macro Lens before: a key and model saved under the old
   names are copied to the new ones on first start. */
for (const [name, old] of [
  [KEY_STORAGE, 'macro-lens.anthropic-key'],
  [MODEL_STORAGE, 'macro-lens.anthropic-model'],
]) {
  try {
    const value = localStorage.getItem(old);
    if (localStorage.getItem(name) === null && value !== null) {
      localStorage.setItem(name, value);
    }
  } catch {
    /* storage blocked: nothing to carry over */
  }
}

function read(name: string): string {
  try {
    return localStorage.getItem(name) ?? '';
  } catch {
    return '';
  }
}

function write(name: string, value: string): void {
  try {
    if (value) {
      localStorage.setItem(name, value);
    } else {
      localStorage.removeItem(name);
    }
  } catch {
    /* private mode: not remembered */
  }
}

export const savedKey = (): string => read(KEY_STORAGE);
export const savedModel = (): string => read(MODEL_STORAGE) || DEFAULT_MODEL;

export function saveClaudeSettings(key: string, model: string): void {
  write(KEY_STORAGE, key.trim());
  write(MODEL_STORAGE, model === DEFAULT_MODEL ? '' : model);
}

/** The estimator to use, or null when no key is set. */
export function currentEstimator(): Estimator | null {
  const key = savedKey();
  return key ? new AnthropicEstimator(key, savedModel()) : null;
}

/** "sk-ant-…a1b2", for showing which key is saved without showing it. */
export function maskKey(key: string): string {
  return key.length > 12 ? `${key.slice(0, 7)}…${key.slice(-4)}` : '••••';
}

export { errorMessage, EstimateError, type Estimator } from './types';
export { MODELS, DEFAULT_MODEL } from './anthropic';
