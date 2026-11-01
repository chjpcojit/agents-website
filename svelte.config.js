import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Static SPA: the UI is a client of the local orchestrator (localhost/Tailscale), no SSR needed.
// SPA tĩnh: UI chỉ là client của orchestrator chạy local (localhost/Tailscale), không cần SSR.
/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
  },
};

export default config;
