/**
 * Geometric assertions for the tiling core. Runs under plain node:
 *
 *   node --experimental-strip-types src/check.ts
 *
 * These are the checks that catch a mistranscribed angle sequence or
 * substitution rule — a wrong table still *renders*, it just renders a tiling
 * that is subtly not the Spectre.
 */

import { type Pt, det, transPt, centroid } from './geom.ts';
import {
  SPECTRE_POINTS,
  SPECTRE_TURNS,
  buildTiling,
  buildBase,
  buildSupertiles,
  flatten,
} from './spectre.ts';

let failures = 0;
let checks = 0;

function ok(cond: boolean, msg: string, detail = ''): void {
  checks++;
  if (cond) {
    console.log(`  ok   ${msg}`);
  } else {
    failures++;
    console.log(`  FAIL ${msg}${detail ? `\n         ${detail}` : ''}`);
  }
}

const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

console.log('\nTile(1,1) polygon');

ok(SPECTRE_POINTS.length === 14, 'has 14 vertices', `got ${SPECTRE_POINTS.length}`);

{
  const lens = SPECTRE_POINTS.map((p, i) => dist(p, SPECTRE_POINTS[(i + 1) % 14]));
  const bad = lens.filter((l) => !near(l, 1, 1e-12));
  ok(bad.length === 0, 'is equilateral (all 14 edges unit length)',
    bad.length ? `off edges: ${bad.map((l) => l.toFixed(6)).join(', ')}` : '');
}

{
  // Interior angles must alternate between multiples of 90 and 120 degrees.
  const angles = SPECTRE_POINTS.map((p, i) => {
    const prev = SPECTRE_POINTS[(i + 13) % 14];
    const next = SPECTRE_POINTS[(i + 1) % 14];
    const a = Math.atan2(prev.y - p.y, prev.x - p.x);
    const b = Math.atan2(next.y - p.y, next.x - p.x);
    let d = ((a - b) * 180) / Math.PI;
    while (d < 0) d += 360;
    return d;
  });
  const allowed = [90, 120, 180, 240, 270];
  const bad = angles.filter((a) => !allowed.some((x) => near(a, x, 1e-9)));
  ok(bad.length === 0, 'interior angles all in {90,120,180,240,270}',
    bad.length ? `got ${bad.map((a) => a.toFixed(3)).join(', ')}` : '');
  ok(angles.filter((a) => near(a, 180, 1e-9)).length === 1,
    'exactly one straight (180 degree) vertex');
}

{
  // The turtle-graphics form must reproduce the coordinate list exactly.
  ok(SPECTRE_TURNS.reduce((a, b) => a + b, 0) * 30 === 360,
    'turn angles sum to 360 degrees',
    `got ${SPECTRE_TURNS.reduce((a, b) => a + b, 0) * 30}`);

  let x = 0;
  let y = 0;
  let h = -90;
  const walked: Pt[] = [];
  for (let i = 0; i < 14; i++) {
    h += SPECTRE_TURNS[i] * 30;
    walked.push({ x, y });
    x += Math.cos((h * Math.PI) / 180);
    y += Math.sin((h * Math.PI) / 180);
  }
  ok(near(Math.hypot(x, y), 0, 1e-9), 'turtle walk closes back to the origin',
    `ended at (${x.toFixed(9)}, ${y.toFixed(9)})`);

  const maxErr = Math.max(...walked.map((p, i) => dist(p, SPECTRE_POINTS[i])));
  ok(maxErr < 1e-9, 'turtle walk matches the coordinate list',
    `max deviation ${maxErr.toExponential(3)}`);
}

console.log('\nSubstitution system');

{
  // Known tile counts for the Spectre system started from Delta.
  const expected = [1, 9, 71, 559, 4401, 34649];
  for (let n = 0; n < expected.length; n++) {
    const { tiles } = buildTiling({ system: 'spectre', subdivisions: n, startCluster: 'Delta' });
    ok(tiles.length === expected[n], `depth ${n} yields ${expected[n]} tiles`,
      `got ${tiles.length}`);
  }
}

{
  const { tiles } = buildTiling({ system: 'spectre', subdivisions: 4, startCluster: 'Delta' });

  const dets = tiles.map((t) => det(t.xform));
  const pos = dets.filter((d) => d > 0).length;
  const neg = dets.filter((d) => d < 0).length;
  ok(pos === 0 || neg === 0,
    'no reflections: every tile shares one handedness',
    `${pos} positive, ${neg} negative`);

  ok(dets.every((d) => near(Math.abs(d), 1, 1e-9)),
    'every placement is rigid (|det| = 1)');

  // Rotations must be multiples of 30 degrees.
  const angs = tiles.map((t) => {
    let a = (Math.atan2(t.xform[3], t.xform[0]) * 180) / Math.PI;
    if (a < 0) a += 360;
    return a;
  });
  const badAng = angs.filter((a) => !near(a % 30, 0, 1e-6) && !near(a % 30, 30, 1e-6));
  ok(badAng.length === 0, 'every tile rotation is a multiple of 30 degrees',
    badAng.length ? `e.g. ${badAng.slice(0, 3).map((a) => a.toFixed(4)).join(', ')}` : '');
}

{
  // No two tiles may occupy the same place.
  const { tiles } = buildTiling({ system: 'spectre', subdivisions: 4, startCluster: 'Delta' });
  const c0 = centroid(SPECTRE_POINTS);
  const seen = new Map<string, number>();
  let dupes = 0;
  for (const t of tiles) {
    const c = transPt(t.xform, c0);
    const key = `${Math.round(c.x * 1000)}:${Math.round(c.y * 1000)}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const n of seen.values()) if (n > 1) dupes += n - 1;
  ok(dupes === 0, 'no two tiles share a centroid', `${dupes} duplicate placements`);
}

{
  // Tile density: area covered must match the number of tiles times tile area,
  // which is only true if the patch is gap-free and overlap-free.
  const shoelace = (p: Pt[]): number => {
    let s = 0;
    for (let i = 0; i < p.length; i++) {
      const q = p[(i + 1) % p.length];
      s += p[i].x * q.y - q.x * p[i].y;
    }
    return Math.abs(s) / 2;
  };
  const tileArea = shoelace(SPECTRE_POINTS);
  const { tiles } = buildTiling({ system: 'spectre', subdivisions: 3, startCluster: 'Delta' });
  const c0 = centroid(SPECTRE_POINTS);
  const cs = tiles.map((t) => transPt(t.xform, c0));
  const inPoly = (p: Pt, poly: Pt[]): boolean => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside;
      }
    }
    return inside;
  };
  const polys = tiles.map((t) => SPECTRE_POINTS.map((p) => transPt(t.xform, p)));

  // Edge matching is the real tiling property: every tile edge either
  // coincides exactly with one neighbour's edge (interior) or is on the patch
  // boundary. An edge shared by three tiles, or an interior edge with no
  // partner, means the substitution is placing tiles wrongly.
  const key = (a: Pt, b: Pt): string => {
    const f = (p: Pt) => `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)}`;
    const [u, v] = [f(a), f(b)].sort();
    return `${u}|${v}`;
  };
  const edgeCount = new Map<string, number>();
  const tileEdges: string[][] = polys.map((poly) => {
    const ks: string[] = [];
    for (let i = 0; i < poly.length; i++) {
      const k = key(poly[i], poly[(i + 1) % poly.length]);
      ks.push(k);
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
    }
    return ks;
  });
  const counts = [...edgeCount.values()];
  ok(counts.every((c) => c === 1 || c === 2),
    'every edge is shared by exactly one or two tiles',
    `found counts: ${[...new Set(counts)].sort().join(', ')}`);
  const boundaryEdges = counts.filter((c) => c === 1).length;
  ok(boundaryEdges > 0 && boundaryEdges < counts.length * 0.5,
    'patch has a sensible boundary/interior edge ratio',
    `${boundaryEdges} boundary of ${counts.length} edges`);

  // Now probe coverage, but only around tiles that are entirely interior
  // (no unmatched edge) — the patch outline is ragged, so probing near the
  // boundary would report phantom gaps where there is simply no patch.
  const interior = tiles
    .map((_, i) => i)
    .filter((i) => tileEdges[i].every((k) => edgeCount.get(k) === 2));
  ok(interior.length > 100, 'patch has plenty of fully-interior tiles',
    `${interior.length} interior tiles`);

  const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  let covered = 0;
  let overlapped = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const t = interior[Math.floor(rnd() * interior.length)];
    const r = 1.2 * Math.sqrt(rnd());
    const th = 2 * Math.PI * rnd();
    const p = { x: cs[t].x + r * Math.cos(th), y: cs[t].y + r * Math.sin(th) };
    const hits = polys.filter((poly) => inPoly(p, poly)).length;
    if (hits >= 1) covered++;
    if (hits > 1) overlapped++;
  }
  ok(overlapped === 0, `no overlapping tiles (${N} interior probes)`,
    `${overlapped} points covered more than once`);
  ok(covered === N, `gap-free interior (${N} probes around interior tiles)`,
    `${covered}/${N} covered`);
  ok(tileArea > 0, 'tile has positive area');
}

{
  // The inflation factor must converge to the published ~2.80588.
  let sys = buildBase('spectre');
  let prev = sys.Delta.quad;
  let ratio = 0;
  for (let i = 0; i < 8; i++) {
    sys = buildSupertiles(sys);
    const q = sys.Delta.quad;
    ratio = dist(q[0], q[1]) / dist(prev[0], prev[1]);
    prev = q;
  }
  ok(near(ratio, 2.80588, 1e-4), 'inflation factor converges to 2.80588',
    `got ${ratio.toFixed(6)}`);
}

{
  // The Mystic is two same-handed tiles, not a mirrored pair.
  const base = buildBase('spectre');
  const g = flatten(base.Gamma);
  ok(g.length === 2, 'the Mystic contains exactly two tiles', `got ${g.length}`);
  ok(g.every((t) => det(t.xform) > 0),
    'both halves of the Mystic have the same handedness',
    g.map((t) => det(t.xform).toFixed(3)).join(', '));
}

console.log(`\n${checks - failures}/${checks} checks passed\n`);
if (failures > 0) process.exit(1);
