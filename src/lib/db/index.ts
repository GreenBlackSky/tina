import { LocalDatabase } from './local';

/* The one database the app uses. Today: this browser's storage. When Firebase
   is set up, this is where FirebaseDatabase gets chosen for a signed-in user
   (see firebase.ts) — the screens only ever see the Database interface. */

export const APP_ID = 'tina';

const STORAGE_KEY = 'tina.db.v1';

/* The app was called Macro Lens before: data saved under its old key is
   copied to the new one on first start (the old copy is left as it was). */
const OLD_STORAGE_KEY = 'macro-lens.db.v1';
try {
  if (localStorage.getItem(STORAGE_KEY) === null) {
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old !== null) {
      localStorage.setItem(STORAGE_KEY, old);
    }
  }
} catch {
  /* storage blocked: nothing to carry over */
}

export const db = new LocalDatabase(APP_ID, STORAGE_KEY);

export type { Database, DocData, DocRef, CollectionRef, DocSnapshot, Backup } from './types';
export { DbError } from './local';
