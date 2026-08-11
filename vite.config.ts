import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/**
 * Identify the build so a browser can be checked against a commit.
 * Cloudflare Workers Builds sets WORKERS_CI_COMMIT_SHA; Pages sets
 * CF_PAGES_COMMIT_SHA. Locally, fall back to git.
 */
function buildSha(): string {
  const ci = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA;
  if (ci) return ci.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  // Relative base so the built site works from any path it is served under.
  base: './',
  // Present and empty on purpose: wrangler's project auto-setup refuses to run
  // against a config without a plugins array. Nothing needs to be added to it —
  // the site is static assets only (see wrangler.jsonc).
  plugins: [],
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().replace(/\.\d+Z$/, 'Z')),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
