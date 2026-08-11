import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works from any path it is served under.
  base: './',
  // Present and empty on purpose: wrangler's project auto-setup refuses to run
  // against a config without a plugins array. Nothing needs to be added to it —
  // the site is static assets only (see wrangler.jsonc).
  plugins: [],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
