import './app.css';
import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import { startState } from './lib/state.svelte';

startState();
mount(App, { target: document.body });

/* installable and offline: the service worker caches the app and updates
   itself in the background the next time you open it online */
registerSW({ immediate: true });
