/**
 * Points and 2x3 affine transforms.
 *
 * A transform is stored row-major as [a, b, tx, c, d, ty], representing
 *
 *   | a b tx |
 *   | c d ty |
 *   | 0 0  1 |
 */

export interface Pt {
  x: number;
  y: number;
}

export type Xform = [number, number, number, number, number, number];

export const pt = (x: number, y: number): Pt => ({ x, y });

export const ident: Xform = [1, 0, 0, 0, 1, 0];

export function mul(A: Xform, B: Xform): Xform {
  return [
    A[0] * B[0] + A[1] * B[3],
    A[0] * B[1] + A[1] * B[4],
    A[0] * B[2] + A[1] * B[5] + A[2],

    A[3] * B[0] + A[4] * B[3],
    A[3] * B[1] + A[4] * B[4],
    A[3] * B[2] + A[4] * B[5] + A[5],
  ];
}

export function trot(ang: number): Xform {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [c, -s, 0, s, c, 0];
}

export const ttrans = (tx: number, ty: number): Xform => [1, 0, tx, 0, 1, ty];

export const transTo = (p: Pt, q: Pt): Xform => ttrans(q.x - p.x, q.y - p.y);

export function transPt(M: Xform, P: Pt): Pt {
  return pt(M[0] * P.x + M[1] * P.y + M[2], M[3] * P.x + M[4] * P.y + M[5]);
}

/** Determinant of the linear part. Negative means the transform mirrors. */
export const det = (M: Xform): number => M[0] * M[4] - M[1] * M[3];

/** Rotation angle of the linear part, in degrees, in [-180, 180). */
export const angleOf = (M: Xform): number => (Math.atan2(M[3], M[0]) * 180) / Math.PI;

export const psub = (a: Pt, b: Pt): Pt => pt(a.x - b.x, a.y - b.y);

/** o + a*p + b*q — a point in the frame spanned by p and q at origin o. */
export function pframe(o: Pt, p: Pt, q: Pt, a: number, b: number): Pt {
  return pt(o.x + a * p.x + b * q.x, o.y + a * p.y + b * q.y);
}

export function centroid(pts: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return pt(x / pts.length, y / pts.length);
}

/** Shrink a polygon toward its centroid by `t` (0 = unchanged, 1 = collapsed). */
export function insetPolygon(pts: Pt[], t: number): Pt[] {
  if (t === 0) return pts;
  const c = centroid(pts);
  return pts.map((p) => pt(p.x + (c.x - p.x) * t, p.y + (c.y - p.y) * t));
}

/** Deterministic PRNG (mulberry32), so `seed` reproduces a tiling exactly. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
