import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the same App component into one self-contained index.html (for shareable previews).
// SvelteKit's router is bypassed here; only `$lib` is needed.
// Build cùng component App thành một file index.html tự chứa (dùng cho bản preview chia sẻ).
// Bỏ qua router của SvelteKit; chỉ cần alias `$lib`.
// `--mode v2` builds the futuristic v2 UI instead of the 3D office. / `--mode v2` build giao diện v2 thay cho văn phòng 3D.
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL(mode === 'v2' ? './single-v2' : './single', import.meta.url)),
  plugins: [svelte(), viteSingleFile()],
  resolve: { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  build: {
    outDir: fileURLToPath(new URL(mode === 'v2' ? './dist-single-v2' : './dist-single', import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
}));
