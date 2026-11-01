import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the same App component into one self-contained index.html (for shareable previews).
// SvelteKit's router is bypassed here; only `$lib` is needed.
// Build cùng component App thành một file index.html tự chứa (dùng cho bản preview chia sẻ).
// Bỏ qua router của SvelteKit; chỉ cần alias `$lib`.
export default defineConfig({
  root: fileURLToPath(new URL('./single', import.meta.url)),
  plugins: [svelte(), viteSingleFile()],
  resolve: { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  build: { outDir: fileURLToPath(new URL('./dist-single', import.meta.url)), emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
