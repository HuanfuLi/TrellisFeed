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

// ── Vine path: multi-segment organic curve ────────────────────────────────

export interface VineSegment {
  // cubic bezier: p0 → cp1 → cp2 → p3
  p0x: number; p0y: number;
  p1x: number; p1y: number;
  p2x: number; p2y: number;
  p3x: number; p3y: number;
}

export interface VinePathSpec {
  d: string;              // Full SVG path string
  segments: VineSegment[];
  totalLength: number;    // Approximate arc length
}

function cubicBezierPointSeg(t: number, s: VineSegment): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt*mt*mt*s.p0x + 3*mt*mt*t*s.p1x + 3*mt*t*t*s.p2x + t*t*t*s.p3x,
    y: mt*mt*mt*s.p0y + 3*mt*mt*t*s.p1y + 3*mt*t*t*s.p2y + t*t*t*s.p3y,
  };
}

function cubicBezierTangent(t: number, s: VineSegment): { dx: number; dy: number } {
  const mt = 1 - t;
  return {
    dx: 3*mt*mt*(s.p1x - s.p0x) + 6*mt*t*(s.p2x - s.p1x) + 3*t*t*(s.p3x - s.p2x),
    dy: 3*mt*mt*(s.p1y - s.p0y) + 6*mt*t*(s.p2y - s.p1y) + 3*t*t*(s.p3y - s.p2y),
  };
}

// Approximate segment length by sampling
function segmentLength(s: VineSegment, samples = 20): number {
  let len = 0;
  let prev = cubicBezierPointSeg(0, s);
  for (let i = 1; i <= samples; i++) {
    const cur = cubicBezierPointSeg(i / samples, s);
    len += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    prev = cur;
  }
  return len;
}

// Generate organic multi-segment vine: 3-5 cubic bezier curves with S-shape wobble
export function generateVinePath(
  branchId: string,
  branchIndex: number,
  totalBranches: number,
  viewBoxW: number = TRELLIS_VIEWBOX_W,
  viewBoxH: number = TRELLIS_VIEWBOX_H,
): VinePathSpec {
  const rng = mulberry32(hashStr(branchId));
  const baseX = (viewBoxW / (totalBranches + 1)) * (branchIndex + 1);

  // Number of segments: 3-5 for organic feel
  const numSegments = 3 + Math.floor(rng() * 3);
  const groundY = viewBoxH * 0.92;
  const topY = viewBoxH * 0.06 + rng() * viewBoxH * 0.08;

  // Generate waypoints from bottom to top
  const waypoints: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= numSegments; i++) {
    const frac = i / numSegments;
    const y = groundY - frac * (groundY - topY);
    // S-curve wobble: alternating left-right displacement
    const wobbleAmp = 40 + rng() * 60;
    const direction = (i % 2 === 0 ? 1 : -1) * (rng() > 0.5 ? 1 : -1);
    const x = baseX + direction * wobbleAmp * Math.sin(frac * Math.PI) + (rng() - 0.5) * 20;
    waypoints.push({ x, y });
  }

  // Build cubic bezier segments between waypoints with organic control points
  const segments: VineSegment[] = [];
  let d = `M ${waypoints[0].x.toFixed(1)} ${waypoints[0].y.toFixed(1)}`;

  for (let i = 0; i < numSegments; i++) {
    const p0 = waypoints[i];
    const p3 = waypoints[i + 1];
    const dy = p3.y - p0.y;
    const dx = p3.x - p0.x;

    // Control points: offset perpendicular to the segment direction for curvature
    const curvature = 0.3 + rng() * 0.4;
    const sideSign = rng() > 0.5 ? 1 : -1;
    const cp1x = p0.x + dx * 0.33 + sideSign * Math.abs(dy) * curvature * (0.2 + rng() * 0.3);
    const cp1y = p0.y + dy * 0.33;
    const cp2x = p0.x + dx * 0.66 - sideSign * Math.abs(dy) * curvature * (0.1 + rng() * 0.2);
    const cp2y = p0.y + dy * 0.66;

    segments.push({ p0x: p0.x, p0y: p0.y, p1x: cp1x, p1y: cp1y, p2x: cp2x, p2y: cp2y, p3x: p3.x, p3y: p3.y });
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p3.x.toFixed(1)} ${p3.y.toFixed(1)}`;
  }

  const totalLength = segments.reduce((sum, s) => sum + segmentLength(s), 0);

  return { d, segments, totalLength };
}

// ── Leaf positioning: place ON the vine with perpendicular offset ──────────

export interface LeafPosition {
  x: number;       // leaf center
  y: number;
  vineX: number;   // point on vine where stem attaches
  vineY: number;
  tangentAngle: number; // vine direction at attachment (degrees)
  side: number;    // +1 or -1 (which side of vine)
}

export function getLeafPosition(anchorId: string, vineSpec: VinePathSpec): LeafPosition {
  const rng = mulberry32(hashStr(anchorId));
  // Pick a position along the full vine (0.1 to 0.9 to avoid tips)
  const globalT = 0.1 + rng() * 0.8;

  // Map globalT to a specific segment + local t
  const targetDist = globalT * vineSpec.totalLength;
  let accum = 0;
  let seg = vineSpec.segments[0];
  let localT = 0;
  for (const s of vineSpec.segments) {
    const sLen = segmentLength(s);
    if (accum + sLen >= targetDist) {
      seg = s;
      localT = (targetDist - accum) / sLen;
      break;
    }
    accum += sLen;
  }

  const { x: vineX, y: vineY } = cubicBezierPointSeg(localT, seg);
  const { dx, dy } = cubicBezierTangent(localT, seg);
  const tangentAngle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Perpendicular offset: place leaf to one side of the vine
  const side = rng() > 0.5 ? 1 : -1;
  const offsetDist = 18 + rng() * 14; // 18-32px from vine center
  const perpAngle = Math.atan2(dy, dx) + side * Math.PI / 2;
  const leafX = vineX + Math.cos(perpAngle) * offsetDist;
  const leafY = vineY + Math.sin(perpAngle) * offsetDist;

  return { x: leafX, y: leafY, vineX, vineY, tangentAngle, side };
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
