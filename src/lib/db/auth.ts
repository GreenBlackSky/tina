import type { Auth, AuthError, User } from 'firebase/auth';
import { firebaseConfig } from '../firebase-config';

/* Google sign-in, through Firebase Auth. Optional: the app works the same
   signed out. Firebase is loaded only when something here is first used, so
   it never slows down the app's first screen.

   Sign-in opens Google's window as a pop-up; where the browser blocks
   pop-ups, the whole page goes to Google and comes back (a "redirect"), and
   the result is picked up the next time Firebase loads.

   Each app has its own src/lib/firebase-config.ts; this file is the same in
   sibling apps of the workspace. */

export type Account =
  | { status: 'loading' }
  | { status: 'signed-out'; error?: string }
  | { status: 'signed-in'; uid: string; email: string; name: string }
  | { status: 'unavailable' };

type AuthModule = typeof import('firebase/auth');

/** Set while a redirect sign-in is under way (it survives the page reload). */
const REDIRECT_FLAG = 'firebase-auth-redirect';

let loading: Promise<{ auth: Auth; mod: AuthModule }> | null = null;

/** Why a redirect sign-in failed, until it has been shown once. */
let redirectError: string | undefined;

function load(): Promise<{ auth: Auth; mod: AuthModule }> {
  loading ??= (async () => {
    const [{ initializeApp }, mod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const auth = mod.getAuth(initializeApp(firebaseConfig));
    if (takeRedirectFlag()) {
      try {
        await mod.getRedirectResult(auth);
      } catch (e) {
        redirectError = errorMessage(e) ?? undefined;
      }
    }
    return { auth, mod };
  })();
  loading.catch(() => {
    loading = null; // e.g. offline before the app was ever saved: try again next time
  });
  return loading;
}

function takeRedirectFlag(): boolean {
  try {
    const set = sessionStorage.getItem(REDIRECT_FLAG) !== null;
    sessionStorage.removeItem(REDIRECT_FLAG);
    return set;
  } catch {
    return false;
  }
}

function toAccount(user: User | null, error?: string): Account {
  if (!user) {
    return error ? { status: 'signed-out', error } : { status: 'signed-out' };
  }
  return {
    status: 'signed-in',
    uid: user.uid,
    email: user.email ?? '',
    name: user.displayName ?? '',
  };
}

/** Calls `listener` with the account now and after every sign-in or sign-out;
    returns a function that stops it. */
export function onAccount(listener: (account: Account) => void): () => void {
  let stopped = false;
  let stop: (() => void) | undefined;
  listener({ status: 'loading' });
  load().then(
    ({ auth, mod }) => {
      if (stopped) {
        return;
      }
      stop = mod.onAuthStateChanged(auth, (user) => {
        const error = redirectError;
        redirectError = undefined;
        listener(toAccount(user, error));
      });
    },
    () => {
      if (!stopped) {
        listener({ status: 'unavailable' });
      }
    },
  );
  return () => {
    stopped = true;
    stop?.();
  };
}

/** Sign in with Google. Resolves quietly if the person closes Google's
    window; rejects with a readable message if sign-in fails. */
export async function signIn(): Promise<void> {
  const { auth, mod } = await load();
  const provider = new mod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await mod.signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as AuthError).code;
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      try {
        sessionStorage.setItem(REDIRECT_FLAG, '1');
      } catch {
        /* the result still arrives; only an error after it would go unshown */
      }
      await mod.signInWithRedirect(auth, provider);
      return;
    }
    const message = errorMessage(e);
    if (message) {
      throw new Error(message, { cause: e });
    }
  }
}

export async function signOut(): Promise<void> {
  const { auth, mod } = await load();
  await mod.signOut(auth);
}

/** What to tell the person, or null when there is nothing to say (they
    closed the window themselves). */
function errorMessage(e: unknown): string | null {
  const code = (e as AuthError | undefined)?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'auth/network-request-failed':
      return 'No connection — try again when online.';
    case 'auth/unauthorized-domain':
      return 'Sign-in is not allowed on this address yet.';
    default:
      return code ? `Sign-in failed (${code.replace('auth/', '')}).` : 'Sign-in failed.';
  }
}
