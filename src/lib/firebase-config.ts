/* Which Firebase project this app talks to, from the Firebase console
   (Project settings → Your apps → Tina). These values are public by design:
   they name the project, they don't unlock it — the database's security
   rules decide who may read and write what.

   authDomain is where Google sign-in runs. On the app's own Firebase Hosting
   address (tina-gbs.web.app) that is the address itself, so sign-in never
   hops to a second site — phone browsers increasingly block that. Anywhere
   else (the dev server on localhost) it is the project's default address. */

const PROJECT_AUTH_DOMAIN = 'daily-helpers.firebaseapp.com';

function authDomain(): string {
  const host = location.host;
  return host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')
    ? host
    : PROJECT_AUTH_DOMAIN;
}

export const firebaseConfig = {
  apiKey: 'AIzaSyCfxP-_hInHMOaDfqKwk0pl4PPFVUgRa8w',
  authDomain: authDomain(),
  projectId: 'daily-helpers',
  storageBucket: 'daily-helpers.firebasestorage.app',
  messagingSenderId: '91846543632',
  appId: '1:91846543632:web:528a3bf5b49791cd46bd95',
};
