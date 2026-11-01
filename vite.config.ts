import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` inlines every asset into one index.html (used for shareable previews).
// `--mode single` gộp toàn bộ asset vào một file index.html (dùng cho bản preview chia sẻ).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 1200,
  },
}));
