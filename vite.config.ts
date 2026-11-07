import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

/* `npm run dev` serves the app with instant reload; `npm run build` writes
   dist/, the folder that gets uploaded to hosting. The PWA plugin adds what
   Android needs to install it from the browser: a manifest and a service
   worker that keeps the app working offline. */
export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      /* Firebase Hosting's own pages (/__/auth/… for Google sign-in) must
         come from the server, not from the offline copy of the app. */
      workbox: { navigateFallbackDenylist: [/^\/__\//] },
      manifest: {
        name: 'Tina',
        short_name: 'Tina',
        description:
          'A calorie and macro log; photograph a plate or a label and Claude estimates it.',
        theme_color: '#1D1F22',
        background_color: '#1D1F22',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: { port: 5183, strictPort: true },
});
