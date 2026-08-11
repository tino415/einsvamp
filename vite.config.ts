import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works from any path on Cloudflare Pages.
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
