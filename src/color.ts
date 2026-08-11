/** Colour assignment for placed tiles. */

import { type Pt, angleOf, mulberry32 } from './geom.ts';
import { type Tile, LEAF_LABELS } from './spectre.ts';
import { type Params, PALETTES } from './params.ts';

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Emit `#rrggbb`, not `hsl(...)`. Browsers accept CSS Color 4 syntax happily,
 * but Illustrator's SVG parser rejects the whole file over it — and hex is
 * understood by every consumer.
 */
function hslToHex({ h, s, l }: Hsl): string {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = clamp01(s);
  const ll = clamp01(l);

  let r = ll;
  let g = ll;
  let b = ll;

  if (ss !== 0) {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p2 = 2 * ll - q;
    const hue = (t: number): number => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p2 + (q - p2) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p2 + (q - p2) * (2 / 3 - tt) * 6;
      return p2;
    };
    r = hue(hh + 1 / 3);
    g = hue(hh);
    b = hue(hh - 1 / 3);
  }

  const hex = (v: number): string =>
    Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function adjust(hsl: Hsl, p: Params): string {
  return hslToHex({
    h: hsl.h + (p.hueShift as number),
    s: hsl.s * (p.saturation as number),
    l: hsl.l * (p.lightness as number),
  });
}

/**
 * Assign a colour per tile. Returns CSS colour strings in tile order.
 * `centres` are the tile centroids in world space, used by the positional modes.
 */
export function colorTiles(tiles: Tile[], centres: Pt[], p: Params): string[] {
  const mode = p.colorMode as string;
  const palette = PALETTES[p.palette as string] ?? PALETTES.paper;
  const pal = palette.map(hexToHsl);
  const rnd = mulberry32(p.seed as number);

  if (mode === 'single') {
    const c = adjust(hexToHsl(p.singleColor as string), p);
    return tiles.map(() => c);
  }

  if (mode === 'mystic') {
    // Everything near-white except the two halves of each Mystic — the
    // quickest way to eyeball that Mystic pairs are placed correctly.
    const plain = adjust({ h: 40, s: 0.15, l: 0.95 }, p);
    const g1 = adjust({ h: 65, s: 0.18, l: 0.62 }, p);
    const g2 = adjust({ h: 65, s: 0.22, l: 0.38 }, p);
    return tiles.map((t) => (t.label === 'Gamma1' ? g1 : t.label === 'Gamma2' ? g2 : plain));
  }

  if (mode === 'label') {
    const idx = new Map(LEAF_LABELS.map((l, i) => [l, i]));
    return tiles.map((t) => adjust(pal[(idx.get(t.label) ?? 0) % pal.length], p));
  }

  if (mode === 'branch') {
    return tiles.map((t) => adjust(pal[t.branch % pal.length], p));
  }

  if (mode === 'rotation') {
    return tiles.map((t) => {
      let a = angleOf(t.xform);
      if (a < 0) a += 360;
      return adjust(pal[Math.round(a / 30) % pal.length], p);
    });
  }

  if (mode === 'random') {
    return tiles.map(() => adjust(pal[Math.floor(rnd() * pal.length)], p));
  }

  // Positional modes.
  const cx = centres.reduce((a, c) => a + c.x, 0) / (centres.length || 1);
  const cy = centres.reduce((a, c) => a + c.y, 0) / (centres.length || 1);
  const rs = centres.map((c) => Math.hypot(c.x - cx, c.y - cy));
  const rmax = Math.max(...rs, 1e-9);

  if (mode === 'angular') {
    return centres.map((c) => {
      const a = Math.atan2(c.y - cy, c.x - cx) / (2 * Math.PI) + 0.5;
      return adjust(pal[Math.floor(a * pal.length) % pal.length], p);
    });
  }

  // radial
  return rs.map((r) => {
    const t = r / rmax;
    return adjust(pal[Math.min(pal.length - 1, Math.floor(t * pal.length))], p);
  });
}
