/**
 * Builds the SVG. The live preview and the exported file are the same DOM —
 * export just serializes this node — so they cannot drift apart.
 */

import {
  type Pt,
  type Xform,
  pt,
  mul,
  trot,
  ttrans,
  transPt,
  centroid,
  insetPolygon,
  mulberry32,
} from './geom.ts';
import { type Tile, type ShapeId, buildTiling, curveOutline, type TileSystem } from './spectre.ts';
import { type Params } from './params.ts';
import { colorTiles } from './color.ts';

const NS = 'http://www.w3.org/2000/svg';

const el = <K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] =>
  document.createElementNS(NS, name);

/** Round to `prec` decimals and drop trailing zeros — keeps exported files small. */
const fmt = (n: number, prec: number): string => {
  const s = n.toFixed(prec);
  return s.replace(/\.?0+$/, '') || '0';
};

/** Rounded-corner polygon path, used in straight-edge mode. */
function roundedPolyPath(pts: Pt[], radius: number, prec: number): string {
  const f = (n: number) => fmt(n, prec);
  if (radius <= 0) {
    return `M${pts.map((p) => `${f(p.x)},${f(p.y)}`).join('L')}Z`;
  }
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const lenA = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const lenB = Math.hypot(next.x - cur.x, next.y - cur.y);
    const rA = Math.min(radius, lenA / 2);
    const rB = Math.min(radius, lenB / 2);
    const a = pt(cur.x + ((prev.x - cur.x) / lenA) * rA, cur.y + ((prev.y - cur.y) / lenA) * rA);
    const b = pt(cur.x + ((next.x - cur.x) / lenB) * rB, cur.y + ((next.y - cur.y) / lenB) * rB);
    d += i === 0 ? `M${f(a.x)},${f(a.y)}` : `L${f(a.x)},${f(a.y)}`;
    d += `Q${f(cur.x)},${f(cur.y)} ${f(b.x)},${f(b.y)}`;
  }
  return `${d}Z`;
}

function outlinePath(pts: Pt[], p: Params, prec: number): string {
  const f = (n: number) => fmt(n, prec);
  const shaped = insetPolygon(pts, p.tileInset as number);

  if (p.curved as boolean) {
    const { start, segments } = curveOutline(shaped, {
      amplitude: p.curveAmplitude as number,
      t1: p.curveT1 as number,
      t2: p.curveT2 as number,
    });
    let d = `M${f(start.x)},${f(start.y)}`;
    for (let i = 0; i < segments.length; i += 3) {
      const [a, b, c] = [segments[i], segments[i + 1], segments[i + 2]];
      d += `C${f(a.x)},${f(a.y)} ${f(b.x)},${f(b.y)} ${f(c.x)},${f(c.y)}`;
    }
    return `${d}Z`;
  }

  return roundedPolyPath(shaped, p.cornerRadius as number, prec);
}

export interface RenderResult {
  svg: SVGSVGElement;
  tileCount: number;
}

export function render(p: Params, size: number): RenderResult {
  const prec = p.precision as number;
  const f = (n: number) => fmt(n, prec);

  const { tiles, outlines } = buildTiling({
    system: p.system as TileSystem,
    subdivisions: p.subdivisions as number,
    startCluster: p.startCluster as never,
  });

  // Per-tile noise, applied before anything measures the layout.
  const rnd = mulberry32(p.seed as number);
  const jp = p.jitterPosition as number;
  const jr = p.jitterRotation as number;
  const placed: Tile[] = tiles.map((t) => {
    if (jp === 0 && jr === 0) return t;
    const c = centroid(outlines[t.shape]);
    // Jitter about the tile's own centre so it spins in place.
    const local = mul(
      ttrans(c.x + (rnd() * 2 - 1) * jp, c.y + (rnd() * 2 - 1) * jp),
      mul(trot(((rnd() * 2 - 1) * jr * Math.PI) / 180), ttrans(-c.x, -c.y)),
    );
    return { ...t, xform: mul(t.xform, local) };
  });

  const centres = placed.map((t) => transPt(t.xform, centroid(outlines[t.shape])));
  const colors = colorTiles(placed, centres, p);

  // Fit the patch to the viewport, then apply the user's view transform.
  const corners: Pt[] = [];
  for (const t of placed) {
    for (const q of outlines[t.shape]) corners.push(transPt(t.xform, q));
  }
  const minx = Math.min(...corners.map((c) => c.x));
  const maxx = Math.max(...corners.map((c) => c.x));
  const miny = Math.min(...corners.map((c) => c.y));
  const maxy = Math.max(...corners.map((c) => c.y));
  const w = Math.max(maxx - minx, 1e-6);
  const h = Math.max(maxy - miny, 1e-6);
  const fit = (size / Math.max(w, h)) * 0.92 * (p.zoom as number);

  const view: Xform = mul(
    mul(ttrans(size / 2 + (p.panX as number) * size, size / 2 + (p.panY as number) * size),
      mul(trot(((p.rotation as number) * Math.PI) / 180), [fit, 0, 0, 0, fit, 0])),
    ttrans(-(minx + maxx) / 2, -(miny + maxy) / 2),
  );

  const svg = el('svg');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));

  const defs = el('defs');
  svg.appendChild(defs);

  // One reusable outline per distinct shape; each tile is a <use> with its own
  // transform and fill. Keeps both the DOM and the exported file small.
  const shapeIds: ShapeId[] = p.system === 'hat-turtle' ? ['A', 'B'] : ['A'];
  for (const sid of shapeIds) {
    const path = el('path');
    path.setAttribute('id', `tile-${sid}`);
    path.setAttribute('d', outlinePath(outlines[sid], p, Math.max(prec, 3)));
    defs.appendChild(path);
  }

  if (p.clipMode !== 'none') {
    const clip = el('clipPath');
    clip.setAttribute('id', 'view-clip');
    const inset = (p.clipInset as number) * size;
    const a = inset;
    const b = size - inset;
    if (p.clipMode === 'rect') {
      const r = el('rect');
      r.setAttribute('x', f(a));
      r.setAttribute('y', f(a));
      r.setAttribute('width', f(b - a));
      r.setAttribute('height', f(b - a));
      clip.appendChild(r);
    } else if (p.clipMode === 'circle') {
      const c = el('circle');
      c.setAttribute('cx', f(size / 2));
      c.setAttribute('cy', f(size / 2));
      c.setAttribute('r', f((b - a) / 2));
      clip.appendChild(c);
    } else {
      const poly = el('polygon');
      const r = (b - a) / 2;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const th = (Math.PI / 3) * i - Math.PI / 2;
        return `${f(size / 2 + r * Math.cos(th))},${f(size / 2 + r * Math.sin(th))}`;
      });
      poly.setAttribute('points', pts.join(' '));
      clip.appendChild(poly);
    }
    defs.appendChild(clip);
  }

  if (!(p.transparent as boolean)) {
    const bg = el('rect');
    bg.setAttribute('width', String(size));
    bg.setAttribute('height', String(size));
    bg.setAttribute('fill', p.background as string);
    svg.appendChild(bg);
  }

  const g = el('g');
  if (p.clipMode !== 'none') g.setAttribute('clip-path', 'url(#view-clip)');
  // Stroke width is in tile units. Each <use> transform already carries the
  // view scale, and stroke is drawn in the used element's local space, so it
  // must NOT be pre-multiplied by `fit` here.
  const sw = p.strokeWidth as number;
  g.setAttribute('stroke', p.strokeColor as string);
  g.setAttribute('stroke-width', fmt(sw, 4));
  g.setAttribute('stroke-opacity', String(p.strokeOpacity));
  g.setAttribute('stroke-linejoin', p.strokeLinejoin as string);
  g.setAttribute('fill-opacity', String(p.fillOpacity));
  if (sw === 0) g.setAttribute('stroke', 'none');
  svg.appendChild(g);

  placed.forEach((t, i) => {
    const m = mul(view, t.xform);
    const use = el('use');
    use.setAttribute('href', `#tile-${t.shape}`);
    use.setAttribute(
      'transform',
      `matrix(${f(m[0])} ${f(m[3])} ${f(m[1])} ${f(m[4])} ${f(m[2])} ${f(m[5])})`,
    );
    use.setAttribute('fill', colors[i]);
    g.appendChild(use);
  });

  return { svg, tileCount: placed.length };
}
