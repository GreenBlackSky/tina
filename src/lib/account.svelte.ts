import {
  onAccount,
  signIn as googleSignIn,
  signOut as googleSignOut,
  type Account,
} from './db/auth';
import { toast } from './ui/toast.svelte';

/* Who is signed in, for Today's corner button and the Account card on
   Targets. Followed from startup (Firebase loads after the first screen is
   drawn). */

export const account = $state({ now: { status: 'loading' } as Account, busy: false });

export function startAccount(): void {
  onAccount((next) => {
    account.now = next;
    if (next.status === 'signed-out' && next.error) {
      toast(next.error);
    }
  });
}

async function run(action: () => Promise<void>): Promise<void> {
  account.busy = true;
  try {
    await action();
  } catch (e) {
    toast((e as Error).message);
  } finally {
    account.busy = false;
  }
}

export const signIn = (): Promise<void> => run(googleSignIn);
export const signOut = (): Promise<void> => run(googleSignOut);

/** "G" for greenblacksky@…: the letter in Today's corner when signed in. */
export function initial(a: Account): string {
  if (a.status !== 'signed-in') {
    return '';
  }
  return (a.name || a.email || '?').trim().charAt(0).toUpperCase();
}

export type { Account };
