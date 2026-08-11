/**
 * The Spectre aperiodic monotile and its substitution system.
 *
 * Reimplemented in TypeScript from the data published in "A chiral aperiodic
 * monotile" (Smith, Myers, Kaplan & Goodman-Strauss, arXiv:2305.17743, CC BY
 * 4.0) and the accompanying demo at https://cs.uwaterloo.ca/~csk/spectre/.
 * See README.md for attribution notes.
 *
 * Nothing in here touches the DOM — src/check.ts runs it under plain node.
 */

import {
  type Pt,
  type Xform,
  pt,
  ident,
  mul,
  trot,
  ttrans,
  transTo,
  transPt,
  psub,
  pframe,
} from './geom.ts';

const S3 = Math.sqrt(3);
const HR3 = S3 / 2;

/**
 * Tile(1,1): the equilateral member of the hat/turtle continuum. All 14 edges
 * are unit length; interior angles alternate between multiples of 90 and 120
 * degrees. Vertex 10 has a straight (180 degree) interior angle, so this is
 * geometrically a 13-gon — but it must stay in the list, because the curved
 * edges below alternate handedness and need an even edge count.
 */
export const SPECTRE_POINTS: Pt[] = [
  pt(0, 0),
  pt(1.0, 0.0),
  pt(1.5, -HR3),
  pt(1.5 + HR3, 0.5 - HR3),
  pt(1.5 + HR3, 1.5 - HR3),
  pt(2.5 + HR3, 1.5 - HR3),
  pt(3 + HR3, 1.5),
  pt(3.0, 2.0),
  pt(3 - HR3, 1.5),
  pt(2.5 - HR3, 1.5 + HR3),
  pt(1.5 - HR3, 1.5 + HR3),
  pt(0.5 - HR3, 1.5 + HR3),
  pt(-HR3, 1.5),
  pt(0.0, 1.0),
];

/** Turn angles in multiples of 30 degrees — the turtle-graphics form of the above. */
export const SPECTRE_TURNS = [3, -2, 3, 2, -3, 2, 3, 2, -3, 2, 0, 2, 3, -2];

const hexPt = (x: number, y: number): Pt => pt(x + 0.5 * y, -HR3 * y);

export const HAT_POINTS: Pt[] = [
  hexPt(-1, 2), hexPt(0, 2), hexPt(0, 3), hexPt(2, 2), hexPt(3, 0),
  hexPt(4, 0), hexPt(5, -1), hexPt(4, -2), hexPt(2, -1), hexPt(2, -2),
  hexPt(1, -2), hexPt(0, -2), hexPt(-1, -1), hexPt(0, 0),
];

export const TURTLE_POINTS: Pt[] = [
  hexPt(0, 0), hexPt(2, -1), hexPt(3, 0), hexPt(4, -1), hexPt(4, -2),
  hexPt(6, -3), hexPt(7, -5), hexPt(6, -5), hexPt(5, -4), hexPt(4, -5),
  hexPt(2, -4), hexPt(0, -3), hexPt(-1, -1), hexPt(0, -1),
];

export const HEX_POINTS: Pt[] = [
  pt(0, 0), pt(1.0, 0.0), pt(1.5, HR3), pt(1, 2 * HR3), pt(0, 2 * HR3), pt(-0.5, HR3),
];

/**
 * The four "key points" that form the entire interface between a tile and the
 * substitution system. For the 14-gons these are vertices 3, 5, 7 and 11.
 */
const KEYS_14 = [3, 5, 7, 11];
const KEYS_HEX = [1, 2, 3, 5];

const keysOf = (pts: Pt[], idx: number[]): Pt[] => idx.map((i) => pts[i]);

export const TILE_LABELS = [
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi',
] as const;
export type TileLabel = (typeof TILE_LABELS)[number];

/** Labels that can appear on an actual drawn tile (the Mystic splits in two). */
export const LEAF_LABELS = [
  'Gamma1', 'Gamma2', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi',
] as const;
export type LeafLabel = (typeof LEAF_LABELS)[number];

/** Which of the two outlines a leaf draws. Only hat/turtle uses 'B'. */
export type ShapeId = 'A' | 'B';

export interface ShapeNode {
  kind: 'shape';
  pts: Pt[];
  quad: Pt[];
  label: LeafLabel;
  shape: ShapeId;
}

export interface MetaNode {
  kind: 'meta';
  children: { geom: Node; xform: Xform }[];
  quad: Pt[];
}

export type Node = ShapeNode | MetaNode;
export type System = Record<string, Node>;

export type TileSystem = 'spectre' | 'hat-turtle' | 'hexagon';

/**
 * The nine base clusters. Eight are a single tile; `Gamma` is the Mystic — a
 * two-tile compound. In the Spectre system both halves of the Mystic are the
 * same handedness (the second is rotated 30 degrees, not reflected), which is
 * exactly what makes the system reflection-free.
 */
export function buildBase(system: TileSystem): System {
  const ret: System = {};

  const mk = (pts: Pt[], quad: Pt[], label: LeafLabel, shape: ShapeId): ShapeNode => ({
    kind: 'shape', pts, quad, label, shape,
  });

  if (system === 'hexagon') {
    const quad = keysOf(HEX_POINTS, KEYS_HEX);
    for (const lab of TILE_LABELS) {
      if (lab !== 'Gamma') ret[lab] = mk(HEX_POINTS, quad, lab as LeafLabel, 'A');
    }
    // The abstract hexagon system has no compound Mystic — Gamma is one hexagon.
    ret.Gamma = mk(HEX_POINTS, quad, 'Gamma1', 'A');
    return ret;
  }

  const primary = system === 'spectre' ? SPECTRE_POINTS : HAT_POINTS;
  const secondary = system === 'spectre' ? SPECTRE_POINTS : TURTLE_POINTS;
  const quad = keysOf(primary, KEYS_14);

  for (const lab of TILE_LABELS) {
    if (lab !== 'Gamma') ret[lab] = mk(primary, quad, lab as LeafLabel, 'A');
  }

  // The Mystic: first tile at the identity, second translated to vertex 8 and
  // rotated 30 degrees. In hat/turtle mode the partner is the turtle.
  const mystic: MetaNode = { kind: 'meta', children: [], quad };
  mystic.children.push({
    geom: mk(primary, quad, 'Gamma1', 'A'),
    xform: ident,
  });
  mystic.children.push({
    geom: mk(secondary, keysOf(secondary, KEYS_14), 'Gamma2', system === 'spectre' ? 'A' : 'B'),
    xform: mul(ttrans(primary[8].x, primary[8].y), trot(Math.PI / 6)),
  });
  ret.Gamma = mystic;

  return ret;
}

/** Which children each cluster expands into, in placement order 0..7. */
const SUPER_RULES: Record<TileLabel, (TileLabel | null)[]> = {
  Gamma:  ['Pi',  'Delta', null,  'Theta', 'Sigma', 'Xi',  'Phi',    'Gamma'],
  Delta:  ['Xi',  'Delta', 'Xi',  'Phi',   'Sigma', 'Pi',  'Phi',    'Gamma'],
  Theta:  ['Psi', 'Delta', 'Pi',  'Phi',   'Sigma', 'Pi',  'Phi',    'Gamma'],
  Lambda: ['Psi', 'Delta', 'Xi',  'Phi',   'Sigma', 'Pi',  'Phi',    'Gamma'],
  Xi:     ['Psi', 'Delta', 'Pi',  'Phi',   'Sigma', 'Psi', 'Phi',    'Gamma'],
  Pi:     ['Psi', 'Delta', 'Xi',  'Phi',   'Sigma', 'Psi', 'Phi',    'Gamma'],
  Sigma:  ['Xi',  'Delta', 'Xi',  'Phi',   'Sigma', 'Pi',  'Lambda', 'Gamma'],
  Phi:    ['Psi', 'Delta', 'Psi', 'Phi',   'Sigma', 'Pi',  'Phi',    'Gamma'],
  Psi:    ['Psi', 'Delta', 'Psi', 'Phi',   'Sigma', 'Psi', 'Phi',    'Gamma'],
};

/** [rotation delta in degrees, source quad index, target quad index] */
const T_RULES: [number, number, number][] = [
  [60, 3, 1], [0, 2, 0], [60, 3, 1], [60, 3, 1], [0, 2, 0], [60, 3, 1], [-120, 3, 3],
];

/**
 * One round of inflation.
 *
 * The eight placement matrices are derived afresh each round from the current
 * `Delta` quad — the system is combinatorially self-similar but only
 * geometrically self-similar in the limit, so these must NOT be cached across
 * generations. Every placement is finally mirrored by R, so all tiles in a
 * generation share one handedness and flip together at the next level.
 */
export function buildSupertiles(sys: System): System {
  const quad = sys.Delta.quad;
  const R: Xform = [-1, 0, 0, 0, 1, 0];

  const Ts: Xform[] = [ident];
  let totalAng = 0;
  let rot: Xform = ident;
  const tquad = [...quad];

  for (const [ang, from, to] of T_RULES) {
    totalAng += ang;
    if (ang !== 0) {
      rot = trot((totalAng * Math.PI) / 180);
      for (let i = 0; i < 4; ++i) tquad[i] = transPt(rot, quad[i]);
    }
    const ttt = transTo(tquad[to], transPt(Ts[Ts.length - 1], quad[from]));
    Ts.push(mul(ttt, rot));
  }

  for (let i = 0; i < Ts.length; ++i) Ts[i] = mul(R, Ts[i]);

  const superQuad = [
    transPt(Ts[6], quad[2]),
    transPt(Ts[5], quad[1]),
    transPt(Ts[3], quad[2]),
    transPt(Ts[0], quad[1]),
  ];

  const ret: System = {};
  for (const lab of TILE_LABELS) {
    const subs = SUPER_RULES[lab];
    const sup: MetaNode = { kind: 'meta', children: [], quad: superQuad };
    for (let idx = 0; idx < 8; ++idx) {
      const child = subs[idx];
      if (child === null) continue;
      // Stores a reference, not a copy: the structure is a DAG, so memory
      // stays O(9 * levels) even though expansion is O(9^n).
      sup.children.push({ geom: sys[child], xform: Ts[idx] });
    }
    ret[lab] = sup;
  }
  return ret;
}

export interface Tile {
  label: LeafLabel;
  shape: ShapeId;
  xform: Xform;
  /** Index 0..7 of the top-level supertile this tile descends from. */
  branch: number;
}

/** Expand the DAG into a flat list of placed tiles. */
export function flatten(node: Node, base: Xform = ident): Tile[] {
  const out: Tile[] = [];
  const walk = (n: Node, xf: Xform, branch: number, depth: number): void => {
    if (n.kind === 'shape') {
      out.push({ label: n.label, shape: n.shape, xform: xf, branch });
      return;
    }
    n.children.forEach((c, i) => {
      walk(c.geom, mul(xf, c.xform), depth === 0 ? i : branch, depth + 1);
    });
  };
  walk(node, base, 0, 0);
  return out;
}

export interface BuildOptions {
  system: TileSystem;
  subdivisions: number;
  startCluster: TileLabel;
}

export interface Tiling {
  tiles: Tile[];
  /** Outline A (and B, in hat/turtle mode) in tile-local coordinates. */
  outlines: Record<ShapeId, Pt[]>;
}

export function buildTiling(opts: BuildOptions): Tiling {
  let sys = buildBase(opts.system);
  for (let i = 0; i < opts.subdivisions; ++i) sys = buildSupertiles(sys);

  // Each round mirrors every placement, so an odd number of rounds leaves the
  // whole patch mirrored. Flip it back so handedness does not depend on depth.
  const base: Xform = opts.subdivisions % 2 === 1 ? [-1, 0, 0, 0, 1, 0] : ident;

  const primary =
    opts.system === 'hexagon' ? HEX_POINTS
    : opts.system === 'spectre' ? SPECTRE_POINTS
    : HAT_POINTS;
  const secondary = opts.system === 'hat-turtle' ? TURTLE_POINTS : primary;

  return {
    tiles: flatten(sys[opts.startCluster], base),
    outlines: { A: primary, B: secondary },
  };
}

/**
 * Replace each straight edge with a cubic Bezier S-curve, alternating which
 * side the control points fall on. Because the edge count is even and the
 * handedness alternates, a mirrored copy presents bulges where its neighbour
 * needs dents — this is the geometry that enforces reflection-freeness without
 * having to forbid reflections by fiat.
 */
export interface CurveOptions {
  amplitude: number;
  t1: number;
  t2: number;
}

export interface CurvedOutline {
  start: Pt;
  /** Flat list of cubic segments: [c1, c2, end] repeated. */
  segments: Pt[];
}

export function curveOutline(pts: Pt[], opts: CurveOptions): CurvedOutline {
  const segments: Pt[] = [];
  let side = true;
  let prev = pts[pts.length - 1];
  for (const p of pts) {
    const v = psub(p, prev);
    const w = pt(-v.y, v.x);
    const b = side ? opts.amplitude : -opts.amplitude;
    segments.push(pframe(prev, v, w, opts.t1, b));
    segments.push(pframe(prev, v, w, opts.t2, b));
    segments.push(p);
    side = !side;
    prev = p;
  }
  return { start: pts[pts.length - 1], segments };
}
