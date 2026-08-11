# einsvamp

Static Vite + vanilla TypeScript app generating Spectre (aperiodic monotile)
tilings as SVG. No runtime dependencies. Deploys as static files to Cloudflare
Pages.

## Environment

- `default.nix` and `.dir-locals.el` are **tangled from `~/org/repositories.org`**
  (heading `Mctria > Tino415 > Einsvamp`). Never edit them directly — edit the
  org file, tangle, then `nix-build -o .nix`.
- Both are gitignored for that reason.
- Node is not on the global PATH. Prefix everything with `nx`.
- Dev server is on port **4114** (`dev.local:4114`); 4115–4117 belong to other
  projects.
- Playwright browsers come from nixpkgs via `PLAYWRIGHT_BROWSERS_PATH`, not from
  `npx playwright install`. `playwright-core` lives in **`tool/package.json`**,
  not the root manifest, so Cloudflare deploy builds never install it. Its
  version is pinned **exactly** to `pkgs.playwright-driver` (1.56.1) — a caret
  range resolves to a newer release that expects browser builds nixpkgs does not
  ship, and `npm run e2e` then fails with "please run npx playwright install".
- `tsconfig.json` covers `src` only; `tsconfig.tool.json` adds `tool`. Keep it
  that way — `npm run build` runs `tsc` and must not need `tool/node_modules`.

## Layout

| File | Role |
| --- | --- |
| `src/geom.ts` | Points, 2x3 affine transforms, seeded RNG |
| `src/spectre.ts` | Tile polygon + substitution system. Pure, no DOM. |
| `src/params.ts` | Parameter schema — the single source of truth |
| `src/ui.ts` | Builds the control panel from the schema |
| `src/color.ts` | Colouring modes |
| `src/render.ts` | Params -> SVG DOM |
| `src/export.ts` | Serialize + download |
| `src/check.ts` | Geometric assertions, runs under plain node |
| `tool/render-svg.ts` | DOM shim so `render.ts` runs headlessly |
| `tool/e2e.ts` | Playwright end-to-end run |

## Rules of thumb

- Adding a parameter means adding **one entry** to `PARAMS` in `src/params.ts`.
  The UI, the state and the URL hash all follow automatically. Do not hand-write
  controls.
- `src/spectre.ts` must stay DOM-free — `check.ts` and `render-svg.ts` import it
  under node.
- After touching anything geometric, run `nx npm run check`. A wrong table still
  renders; it just renders a tiling that is not the Spectre.
- The placement matrices in `buildSupertiles` are recomputed every generation on
  purpose. The system is only self-similar in the limit — do not cache them.
- Every substitution round mirrors all placements, so handedness flips per
  level; `buildTiling` compensates with a global flip at odd depths. Tiles must
  all share one handedness, never mix.
