/**
 * The parameter schema. This is the single source of truth: the state object,
 * the control panel and the URL hash are all derived from it, so adding a
 * knob means adding one entry here.
 */

export type ParamDef =
  | { key: string; label: string; group: string; type: 'range'; min: number; max: number; step: number; def: number; hint?: string }
  | { key: string; label: string; group: string; type: 'select'; options: [string, string][]; def: string; hint?: string }
  | { key: string; label: string; group: string; type: 'color'; def: string; hint?: string }
  | { key: string; label: string; group: string; type: 'toggle'; def: boolean; hint?: string };

export type Params = Record<string, number | string | boolean>;

export const PALETTES: Record<string, string[]> = {
  // Figure 5.3 from the paper.
  paper: ['#cb9d7e', '#a39685', '#d0d796', '#b8cdb2', '#d3b190', '#dac5a1', '#bf927e', '#e4d5a7', '#e0df9c'],
  // The demo's original bright scheme.
  bright: ['#ffffff', '#dcdcdc', '#ffbfbf', '#ffa07a', '#fff200', '#87cefa', '#f5f5dc', '#00ff00', '#00ffff'],
  mono: ['#111111', '#2a2a2a', '#444444', '#5e5e5e', '#787878', '#929292', '#acacac', '#c6c6c6', '#e0e0e0'],
  ember: ['#1a0d0a', '#3d1510', '#7a2216', '#b83a1a', '#e06618', '#f29d38', '#f7c76b', '#fbe3a8', '#fff6d9'],
  ocean: ['#04202c', '#0b3a4a', '#0f5c6b', '#12809b', '#2aa8c4', '#67c9dd', '#a5e3ee', '#d2f2f7', '#f0fbfd'],
  forest: ['#12200f', '#1d3a17', '#2d5a22', '#417d2c', '#5aa03a', '#7fbf58', '#a8d787', '#cbe9b6', '#e8f6dc'],
  violet: ['#160b24', '#2b1244', '#452066', '#5f3190', '#7d4cb8', '#9d73d1', '#bd9de4', '#d9c4f1', '#efe4fa'],
  candy: ['#ff2d6f', '#ff6b35', '#ffd23f', '#3bceac', '#0ead69', '#00a5cf', '#4059ad', '#7d5ba6', '#e15aef'],
};

export const PARAMS: ParamDef[] = [
  // ---- Tiling ----
  {
    key: 'system', label: 'Tile system', group: 'Tiling', type: 'select',
    def: 'spectre',
    options: [
      ['spectre', 'Spectre (vampire einstein)'],
      ['hat-turtle', 'Hat / Turtle'],
      ['hexagon', 'Hexagon (abstract)'],
    ],
    hint: 'Spectre is the reflection-free monotile. Hexagon shows the underlying combinatorics.',
  },
  {
    key: 'subdivisions', label: 'Subdivisions', group: 'Tiling', type: 'range',
    min: 0, max: 6, step: 1, def: 3,
    hint: 'Substitution depth. Tile count grows about 7.9x per level.',
  },
  {
    key: 'startCluster', label: 'Start cluster', group: 'Tiling', type: 'select',
    def: 'Delta',
    options: [
      ['Gamma', 'Gamma (Mystic)'], ['Delta', 'Delta'], ['Theta', 'Theta'],
      ['Lambda', 'Lambda'], ['Xi', 'Xi'], ['Pi', 'Pi'], ['Sigma', 'Sigma'],
      ['Phi', 'Phi'], ['Psi', 'Psi'],
    ],
  },

  // ---- Shape ----
  {
    key: 'curved', label: 'Curved edges', group: 'Shape', type: 'toggle', def: true,
    hint: 'The true Spectre. Straight edges give Tile(1,1), which needs reflections forbidden by fiat.',
  },
  { key: 'curveAmplitude', label: 'Curve depth', group: 'Shape', type: 'range', min: -1.2, max: 1.2, step: 0.01, def: 0.6 },
  { key: 'curveT1', label: 'Curve start', group: 'Shape', type: 'range', min: 0.05, max: 0.5, step: 0.01, def: 0.33 },
  { key: 'curveT2', label: 'Curve end', group: 'Shape', type: 'range', min: 0.5, max: 0.95, step: 0.01, def: 0.67 },
  {
    key: 'tileInset', label: 'Tile inset', group: 'Shape', type: 'range',
    min: 0, max: 0.4, step: 0.005, def: 0,
    hint: 'Shrinks each tile toward its centre, leaving grout between tiles.',
  },
  {
    key: 'cornerRadius', label: 'Corner rounding', group: 'Shape', type: 'range',
    min: 0, max: 0.45, step: 0.005, def: 0,
    hint: 'Straight-edge mode only.',
  },

  // ---- View ----
  { key: 'zoom', label: 'Zoom', group: 'View', type: 'range', min: 0.1, max: 6, step: 0.01, def: 1 },
  { key: 'panX', label: 'Pan X', group: 'View', type: 'range', min: -1, max: 1, step: 0.005, def: 0 },
  { key: 'panY', label: 'Pan Y', group: 'View', type: 'range', min: -1, max: 1, step: 0.005, def: 0 },
  { key: 'rotation', label: 'Rotation', group: 'View', type: 'range', min: -180, max: 180, step: 1, def: 0 },
  {
    key: 'clipMode', label: 'Clip', group: 'View', type: 'select', def: 'none',
    options: [['none', 'None'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['hex', 'Hexagon']],
  },
  { key: 'clipInset', label: 'Clip inset', group: 'View', type: 'range', min: 0, max: 0.45, step: 0.005, def: 0.05 },

  // ---- Colour ----
  {
    key: 'colorMode', label: 'Colour by', group: 'Colour', type: 'select', def: 'label',
    options: [
      ['label', 'Cluster label'],
      ['rotation', 'Tile rotation'],
      ['branch', 'Supertile branch'],
      ['radial', 'Distance from centre'],
      ['angular', 'Angle from centre'],
      ['random', 'Random (seeded)'],
      ['single', 'Single colour'],
      ['mystic', 'Mystics only'],
    ],
  },
  {
    key: 'palette', label: 'Palette', group: 'Colour', type: 'select', def: 'paper',
    options: Object.keys(PALETTES).map((k) => [k, k[0].toUpperCase() + k.slice(1)] as [string, string]),
  },
  { key: 'singleColor', label: 'Single colour', group: 'Colour', type: 'color', def: '#d8c9a8' },
  { key: 'hueShift', label: 'Hue shift', group: 'Colour', type: 'range', min: -180, max: 180, step: 1, def: 0 },
  { key: 'saturation', label: 'Saturation', group: 'Colour', type: 'range', min: 0, max: 2, step: 0.01, def: 1 },
  { key: 'lightness', label: 'Lightness', group: 'Colour', type: 'range', min: 0.2, max: 1.8, step: 0.01, def: 1 },
  { key: 'fillOpacity', label: 'Fill opacity', group: 'Colour', type: 'range', min: 0, max: 1, step: 0.01, def: 1 },

  // ---- Stroke ----
  { key: 'strokeColor', label: 'Stroke', group: 'Stroke', type: 'color', def: '#1a1a1a' },
  { key: 'strokeWidth', label: 'Stroke width', group: 'Stroke', type: 'range', min: 0, max: 0.3, step: 0.002, def: 0.03 },
  { key: 'strokeOpacity', label: 'Stroke opacity', group: 'Stroke', type: 'range', min: 0, max: 1, step: 0.01, def: 1 },
  {
    key: 'strokeLinejoin', label: 'Line join', group: 'Stroke', type: 'select', def: 'round',
    options: [['round', 'Round'], ['miter', 'Miter'], ['bevel', 'Bevel']],
  },

  // ---- Background ----
  { key: 'background', label: 'Background', group: 'Background', type: 'color', def: '#0e0e10' },
  { key: 'transparent', label: 'Transparent', group: 'Background', type: 'toggle', def: false },

  // ---- Noise ----
  { key: 'seed', label: 'Seed', group: 'Noise', type: 'range', min: 1, max: 9999, step: 1, def: 1234 },
  { key: 'jitterPosition', label: 'Position jitter', group: 'Noise', type: 'range', min: 0, max: 0.3, step: 0.002, def: 0 },
  { key: 'jitterRotation', label: 'Rotation jitter', group: 'Noise', type: 'range', min: 0, max: 20, step: 0.1, def: 0 },

  // ---- Export ----
  {
    key: 'exportSize', label: 'Export size (px)', group: 'Export', type: 'range',
    min: 200, max: 4000, step: 50, def: 1200,
  },
  {
    key: 'precision', label: 'Coordinate precision', group: 'Export', type: 'range',
    min: 1, max: 6, step: 1, def: 3,
    hint: 'Fewer decimals means a much smaller SVG file.',
  },
  {
    key: 'flatten', label: 'Standalone paths', group: 'Export', type: 'toggle', def: true,
    hint: 'Write every tile as its own <path> instead of a reused <use>. Larger file, but Illustrator and other editors handle it reliably.',
  },
];

export const GROUPS = [...new Set(PARAMS.map((p) => p.group))];

export const defaults = (): Params =>
  Object.fromEntries(PARAMS.map((p) => [p.key, p.def]));

/** Compact URL-hash encoding, so a tiling can be bookmarked and shared. */
export function encodeParams(p: Params): string {
  const d = defaults();
  const parts: string[] = [];
  for (const def of PARAMS) {
    const v = p[def.key];
    if (v === d[def.key]) continue;
    parts.push(`${def.key}=${encodeURIComponent(String(v))}`);
  }
  return parts.join('&');
}

export function decodeParams(hash: string): Params {
  const p = defaults();
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  for (const def of PARAMS) {
    const raw = q.get(def.key);
    if (raw === null) continue;
    if (def.type === 'range') {
      const n = Number(raw);
      if (Number.isFinite(n)) p[def.key] = Math.min(def.max, Math.max(def.min, n));
    } else if (def.type === 'toggle') {
      p[def.key] = raw === 'true';
    } else if (def.type === 'select') {
      if (def.options.some(([v]) => v === raw)) p[def.key] = raw;
    } else {
      p[def.key] = raw;
    }
  }
  return p;
}
