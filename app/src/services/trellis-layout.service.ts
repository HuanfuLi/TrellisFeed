// Seeded deterministic layout utilities for the Phase 25 Trellis hero.
// All positions are in a 800x400 viewBox (2:1) matching UI-SPEC.

export const TRELLIS_VIEWBOX_W = 800;
export const TRELLIS_VIEWBOX_H = 400;

// mulberry32 — canonical 32-bit PRNG (per RESEARCH Pattern 1, source bryc/jshash/PRNGs.md)
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// String -> 32-bit seed (djb2-style, unsigned output)
export function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export interface VinePathSpec {
  d: string;         // SVG cubic bezier path string ("M x y C ...")
  // Control points stored explicitly per RESEARCH note (avoid string-parsing in getLeafPosition)
  p0x: number; p0y: number;
  p1x: number; p1y: number;
  p2x: number; p2y: number;
  p3x: number; p3y: number;
}

// One vine per branch: cubic bezier from canvas bottom climbing upward with seeded variation
export function generateVinePath(
  branchId: string,
  branchIndex: number,
  totalBranches: number,
  viewBoxW: number = TRELLIS_VIEWBOX_W,
  viewBoxH: number = TRELLIS_VIEWBOX_H,
): VinePathSpec {
  const rng = mulberry32(hashStr(branchId));
  const baseX = (viewBoxW / (totalBranches + 1)) * (branchIndex + 1);
  const startX = baseX + (rng() - 0.5) * 40;
  const startY = viewBoxH;
  const cp1x = startX + (rng() - 0.5) * 120;
  const cp1y = viewBoxH * 0.7 + rng() * viewBoxH * 0.1;
  const cp2x = startX + (rng() - 0.5) * 80;
  const cp2y = viewBoxH * 0.35 + rng() * viewBoxH * 0.1;
  const endX = startX + (rng() - 0.5) * 60;
  const endY = viewBoxH * 0.1 + rng() * viewBoxH * 0.05;
  const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
  return { d, p0x: startX, p0y: startY, p1x: cp1x, p1y: cp1y, p2x: cp2x, p2y: cp2y, p3x: endX, p3y: endY };
}

export function cubicBezierPoint(
  t: number, p0x: number, p0y: number, p1x: number, p1y: number,
  p2x: number, p2y: number, p3x: number, p3y: number,
): { x: number; y: number } {
  const mt = 1 - t;
  const x = mt*mt*mt*p0x + 3*mt*mt*t*p1x + 3*mt*t*t*p2x + t*t*t*p3x;
  const y = mt*mt*mt*p0y + 3*mt*mt*t*p1y + 3*mt*t*t*p2y + t*t*t*p3y;
  return { x, y };
}

export function getLeafPosition(anchorId: string, vineSpec: VinePathSpec): {
  x: number; y: number; t: number;
  vineX: number; vineY: number; stemAngle: number;
} {
  const rng = mulberry32(hashStr(anchorId));
  const t = 0.15 + rng() * 0.75; // avoid extreme vine ends
  const jitterX = (rng() - 0.5) * 30;
  const jitterY = (rng() - 0.5) * 20;
  const { x: vineX, y: vineY } = cubicBezierPoint(t,
    vineSpec.p0x, vineSpec.p0y,
    vineSpec.p1x, vineSpec.p1y,
    vineSpec.p2x, vineSpec.p2y,
    vineSpec.p3x, vineSpec.p3y);
  const leafX = vineX + jitterX;
  const leafY = vineY + jitterY;
  // Angle from leaf center back toward vine attachment point
  const stemAngle = Math.atan2(vineY - leafY, vineX - leafX) * (180 / Math.PI);
  return { x: leafX, y: leafY, t, vineX, vineY, stemAngle };
}

// Deterministic branch color: natural green/brown tones for organic vine look
export const VINE_COLOR_VARS = [
  '#6B8E5A', // sage green
  '#8B7355', // warm brown
  '#5C7A4A', // forest green
  '#A0845C', // light bark
  '#4A7043', // deep green
] as const;

export function getVineColor(branchId: string): string {
  return VINE_COLOR_VARS[hashStr(branchId) % VINE_COLOR_VARS.length];
}
