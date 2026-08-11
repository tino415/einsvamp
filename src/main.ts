import './style.css';

import { type Params, defaults, decodeParams, encodeParams, PARAMS } from './params.ts';
import { buildControls } from './ui.ts';
import { render } from './render.ts';
import { downloadSvg } from './export.ts';

const stage = document.getElementById('stage') as HTMLDivElement;
const panel = document.getElementById('controls') as HTMLDivElement;
const status = document.getElementById('status') as HTMLSpanElement;
const btnExport = document.getElementById('export') as HTMLButtonElement;
const btnReset = document.getElementById('reset') as HTMLButtonElement;
const btnRandom = document.getElementById('randomize') as HTMLButtonElement;
const btnCopy = document.getElementById('copy-link') as HTMLButtonElement;

// Build identity, so the page in front of you can be tied to a commit.
// Visible in the sidebar footer, on the console, and as window.EINSVAMP_BUILD.
const BUILD = { sha: __BUILD_SHA__, time: __BUILD_TIME__ };
(window as unknown as Record<string, unknown>).EINSVAMP_BUILD = BUILD;
const buildEl = document.getElementById('build');
if (buildEl) {
  buildEl.textContent = `build ${BUILD.sha} · ${BUILD.time.replace('T', ' ').replace('Z', ' UTC')}`;
}
console.info(`einsvamp build ${BUILD.sha} (${BUILD.time})`);

let state: Params = location.hash.length > 1 ? decodeParams(location.hash) : defaults();

const PREVIEW = 900;
let pending = 0;

function draw(): void {
  const t0 = performance.now();
  let result;
  try {
    result = render(state, PREVIEW);
  } catch (err) {
    status.textContent = `render failed: ${String(err)}`;
    status.classList.add('error');
    return;
  }
  status.classList.remove('error');
  stage.replaceChildren(result.svg);
  const ms = Math.round(performance.now() - t0);
  status.textContent = `${result.tileCount.toLocaleString()} tiles · ${ms} ms`;
}

/** Coalesce rapid slider input into one render per frame. */
function schedule(): void {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    draw();
    const q = encodeParams(state);
    history.replaceState(null, '', q ? `#${q}` : location.pathname);
  });
}

const controls = buildControls(panel, state, (key, value) => {
  state[key] = value;
  schedule();
});

btnReset.addEventListener('click', () => {
  state = defaults();
  controls.sync(state);
  schedule();
});

btnRandom.addEventListener('click', () => {
  for (const def of PARAMS) {
    // Leave the heavy/structural knobs alone so randomising stays responsive
    // and keeps rendering the same family of tiling.
    if (['subdivisions', 'system', 'exportSize', 'precision'].includes(def.key)) continue;
    if (def.type === 'range') {
      const steps = Math.round((def.max - def.min) / def.step);
      state[def.key] = def.min + Math.round(Math.random() * steps) * def.step;
    } else if (def.type === 'select') {
      state[def.key] = def.options[Math.floor(Math.random() * def.options.length)][0];
    } else if (def.type === 'toggle') {
      state[def.key] = Math.random() < 0.5;
    } else {
      const h = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
      state[def.key] = `#${h}`;
    }
  }
  controls.sync(state);
  schedule();
});

btnExport.addEventListener('click', () => {
  const bytes = downloadSvg(state);
  status.textContent = `exported ${(bytes / 1024).toFixed(1)} kB`;
});

btnCopy.addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#${encodeParams(state)}`;
  try {
    await navigator.clipboard.writeText(url);
    status.textContent = 'link copied';
  } catch {
    status.textContent = url;
  }
});

// Drag to pan, wheel to zoom.
let dragging: { x: number; y: number } | null = null;
stage.addEventListener('pointerdown', (e) => {
  dragging = { x: e.clientX, y: e.clientY };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = stage.getBoundingClientRect();
  state.panX = clampParam('panX', (state.panX as number) + (e.clientX - dragging.x) / rect.width);
  state.panY = clampParam('panY', (state.panY as number) + (e.clientY - dragging.y) / rect.height);
  dragging = { x: e.clientX, y: e.clientY };
  controls.sync(state);
  schedule();
});
stage.addEventListener('pointerup', () => { dragging = null; });
stage.addEventListener('pointercancel', () => { dragging = null; });
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
  state.zoom = clampParam('zoom', (state.zoom as number) * factor);
  controls.sync(state);
  schedule();
}, { passive: false });

function clampParam(key: string, v: number): number {
  const def = PARAMS.find((d) => d.key === key);
  if (def && def.type === 'range') return Math.min(def.max, Math.max(def.min, v));
  return v;
}

draw();
