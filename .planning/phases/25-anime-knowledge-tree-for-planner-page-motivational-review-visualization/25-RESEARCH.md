# Phase 25: Anime Knowledge Tree (Trellis) — Research

**Researched:** 2026-04-10
**Domain:** SVG generative layout, Framer Motion ambient animation, React video lifecycle, seeded PRNG, event-bus state synchronization
**Confidence:** HIGH (code verified from project sources; algorithm math verified from MDN + official docs; framer-motion from motion.dev docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Trellis + vines + leaves + blossoms + fruits metaphor
- **D-02:** Faint lattice serves as soft atmospheric background only
- **D-03:** Vines flow freely with organic bezier curves — NOT constrained to lattice grid cells
- **D-04:** Ghibli-inspired soft watercolor aesthetic — warm palette, pastel colors, dreamy painterly quality
- **D-05:** State progression: bud → leaf → blossom → fruit
- **D-06:** Leaf color from aggregated child Q&A review health: Green (all overdue < 0), Yellow (1–7 days), Falling (7–14 days), Fallen (14+ OR easeFactor < 1.5)
- **D-07:** Worst-child-wins aggregation rule
- **D-08:** Blossom threshold: all Q&As reviewed AND aggregate easeFactor > 2.5
- **D-09:** Fruit threshold: blossom state for 7+ consecutive days
- **D-10:** Fruits appear but are NOT interactive in Phase 25
- **D-11 through D-15:** Knowledge mapping — branch → vine, cluster → fork, anchor → leaf at parametric position
- **D-16 through D-19:** Seeded-deterministic layout; vine = cubic bezier from canvas bottom; leaf = parametric point + seeded perpendicular jitter; 50+ anchors: leaves scale down
- **D-20 through D-23:** Hero at PlannerScreen top, 200–250px tall, 2:1 aspect, NOT sticky
- **D-24:** Variant A — AI PNG background + SVG overlay
- **D-25:** Variant C — Pure SVG with gradients and filters
- **D-26:** Variant V — Loop video + SVG; MUST pause via IntersectionObserver + document.visibilitychange
- **D-27:** All three variants share data layer, state computation, event subscriptions, layout algorithm
- **D-28/D-29:** Mockups reviewed in plan-phase, not phase execution
- **D-30 through D-33:** Assets pre-generated externally, stored in `app/src/assets/planner-trellis/`, NO runtime generation
- **D-34 through D-37:** Tap leaf → tooltip; Review + View Q&As actions; dismiss: tap outside / X / another leaf; fallen leaves decorative only
- **D-38 through D-46:** Animation specs (leaf color 2s ease; falling 3–4s; celebration pulses; vine draw-on stroke-dashoffset staggered)
- **D-47 through D-49:** State computed on mount; eventBus subscriptions for REVIEW_COMPLETED, CLASSIFICATION_COMPLETED, ANCHOR_DELETED; no polling
- **D-50 through D-52:** Empty state: trellis backdrop + seed illustration + copy + "Ask a question →" CTA
- **D-53 through D-55:** Animation pauses when not active route; Variant V video constraints (muted playsInline loop preload="metadata", ≤2s, ≤500KB, 480p); leaf count > 50 reduces ambient animation complexity

### Claude's Discretion
- Exact spring physics values (stiffness, damping) for animations
- Specific color hex values (derive from existing CSS variables)
- Tooltip popover styling details (match Card + Badge patterns)
- Seed hash function choice (any deterministic hash)
- Initial leaf detach threshold within 7–14 day window (tunable)
- Variant picker UI (dev-only toggle vs Settings entry)

### Deferred Ideas (OUT OF SCOPE)
- Harvest/collect mechanic
- Cosmetic unlock system
- Scene theme picker in Settings
- Milestone badges / fruit counter
- Replacing the existing GraphScreen mindmap
- Multiple branches handling when user has 10+ branches (carousel/condensed form)
</user_constraints>

---

## Summary

Phase 25 builds a Ghibli-aesthetic "Trellis" hero section on PlannerScreen visualizing the user's review health as a vine garden. The hero is 220px tall, 2:1 aspect, rendered in three switchable prototype variants (A: static PNG + SVG, C: pure SVG, V: video loop + SVG). All three variants share one data pipeline: `buildAnchorReflectionTree` → state aggregation (worst-child-wins daysOverdue) → seeded deterministic vine/leaf layout → Framer Motion animations.

The core implementation complexity is in two areas. First, the seeded vine generator: each knowledge branch gets a cubic bezier vine climbing from canvas bottom using a mulberry32 PRNG seeded from `hash(branch.id)`, with leaves placed at parametric t-positions along vine segments (seeded per anchor). Second, the video lifecycle for Variant V: the `<video>` element must pause via an IntersectionObserver + `document.visibilitychange` combined hook because PlannerScreen stays mounted with `display:none` when other tabs are active — the browser will not GC it.

Critical integration point: three new `AppEvent` types (`REVIEW_COMPLETED`, `CLASSIFICATION_COMPLETED`, `ANCHOR_DELETED`) do not yet exist in `types/index.ts`. They must be added before the trellis event subscriptions can compile. Existing event `REVIEW_SUBMITTED` is close but carries different semantics and payload shape.

**Primary recommendation:** Implement in four waves — (1) data layer + seeded layout algorithm + state aggregation unit-testable core, (2) TrellisCanvas + TrellisLeaf + tooltip, (3) TrellisBackgroundA/C/V + mount/celebration animations, (4) event subscriptions + variant picker + PlannerScreen integration.

---

## Standard Stack

### Core (already in project — zero new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| framer-motion | 12.38.0 | SVG path draw-on, leaf sway, scale pulses, sparkles | Already in project (Phase 8 carousel, Phase 22 swipe). `motion.path`, `pathLength`, `useAnimation`, `AnimationPlaybackControls` all available |
| react | 19.2.0 | Component model, hooks | Project baseline |
| lucide-react | project dep | Tooltip close (X icon 16px) | Already in project |
| react-router-dom v7 | project dep | navigate() calls from tooltip actions | Already in project |

### Supporting (already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| IntersectionObserver | Web API | Detect when hero leaves viewport (Variant V video pause) | Built into browser/Capacitor WebView, no package needed |
| document.visibilitychange | Web API | Detect tab backgrounding (Variant V video pause) | Built in |

### No New Dependencies Required

All animation, SVG, and layout capabilities needed by Phase 25 are covered by existing project deps. Do NOT add d3, gsap, react-spring, or any SVG path library. The seeded PRNG, bezier math, and parametric point calculation are all 5–15 line utility functions.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

```
app/src/
├── assets/
│   └── planner-trellis/          # Pre-generated externally by user (D-33)
│       ├── trellis-bg-default.webp   # ≤200KB — Variant A bg + Variant V poster
│       ├── trellis-loop.mp4          # ≤300KB — Variant V loop (H.264 480p)
│       └── trellis-loop.webm         # ≤200KB — Variant V loop (VP9 480p)
├── components/
│   └── trellis/
│       ├── TrellisHero.tsx           # Shell: mounts on PlannerScreen, picks variant
│       ├── TrellisCanvas.tsx         # SVG overlay — vines, leaves, blossoms, fruits, sparkles
│       ├── TrellisLeaf.tsx           # Single leaf: state color, animations, 44×44 hit target
│       ├── TrellisTooltip.tsx        # Inline popover anchored to leaf (Card + Badge + Button)
│       ├── TrellisEmptyState.tsx     # 0-anchors view: bud illustration + CTA
│       ├── TrellisVariantPicker.tsx  # Dev-only floating pill (import.meta.env.DEV gated)
│       └── variants/
│           ├── TrellisBackgroundA.tsx    # <img> WebP/PNG
│           ├── TrellisBackgroundC.tsx    # Pure SVG hand-crafted trellis
│           └── TrellisBackgroundV.tsx    # <video> with IntersectionObserver hook
└── services/
    └── trellis-state.service.ts      # State aggregation (daysOverdue, leafState), seeded layout
```

### Pattern 1: Seeded Deterministic Vine Layout

**What:** Hash a branch/anchor ID string into a 32-bit integer seed, feed into mulberry32 PRNG, generate vine bezier control points and leaf positions that are fully reproducible across reloads.

**When to use:** Vine path generation (`generateVinePath`) and leaf position calculation (`getLeafPosition`).

**mulberry32 implementation (no external dep, ~8 lines):**
```typescript
// Source: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
// Verified: mulberry32 is a fast, high-quality 32-bit PRNG suitable for JS/TS
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// String → 32-bit seed (djb2-style, sufficient for layout)
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0; // force unsigned
}
```

**Vine path generation:**
```typescript
// Source: MDN SVG Paths + math verified
// viewBox assumed 800×400 (matches UI-SPEC responsive note)
interface VinePathSpec {
  d: string;         // SVG cubic bezier path string
  segments: Array<{ t0: number; t1: number; startX: number; startY: number; endX: number; endY: number }>;
}

function generateVinePath(branchId: string, branchIndex: number, totalBranches: number, viewBoxW = 800, viewBoxH = 400): VinePathSpec {
  const rng = mulberry32(hashStr(branchId));
  // Space branches evenly across canvas width with seeded lateral variation
  const baseX = (viewBoxW / (totalBranches + 1)) * (branchIndex + 1);
  const startX = baseX + (rng() - 0.5) * 40;
  const startY = viewBoxH; // grow from bottom
  // Control points create organic upward curve
  const cp1x = startX + (rng() - 0.5) * 120;
  const cp1y = viewBoxH * 0.7 + rng() * viewBoxH * 0.1;
  const cp2x = startX + (rng() - 0.5) * 80;
  const cp2y = viewBoxH * 0.35 + rng() * viewBoxH * 0.1;
  const endX = startX + (rng() - 0.5) * 60;
  const endY = viewBoxH * 0.1 + rng() * viewBoxH * 0.05;
  const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
  // Store segment bounds for leaf placement parametric lookup
  return { d, segments: [{ t0: 0, t1: 1, startX, startY, endX, endY }] };
}
```

**Parametric point on cubic bezier (for leaf placement):**
```typescript
// Source: standard bezier math, verified via MDN + SitePoint references
// P(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
function cubicBezierPoint(t: number, p0x: number, p0y: number, p1x: number, p1y: number,
  p2x: number, p2y: number, p3x: number, p3y: number): { x: number; y: number } {
  const mt = 1 - t;
  const x = mt*mt*mt*p0x + 3*mt*mt*t*p1x + 3*mt*t*t*p2x + t*t*t*p3x;
  const y = mt*mt*mt*p0y + 3*mt*mt*t*p1y + 3*mt*t*t*p2y + t*t*t*p3y;
  return { x, y };
}

function getLeafPosition(anchorId: string, vineSpec: VinePathSpec): { x: number; y: number } {
  const rng = mulberry32(hashStr(anchorId));
  const t = 0.15 + rng() * 0.75; // avoid very bottom/top of vine
  const jitterX = (rng() - 0.5) * 30; // perpendicular jitter
  const jitterY = (rng() - 0.5) * 20;
  // For single-segment vines (Phase 25 simple case):
  // parse vine d string for control points — or pass them explicitly
  const { x, y } = cubicBezierPoint(t, /* control points from vine spec */
    0, 0, 0, 0, 0, 0, 0, 0); // placeholder — real implementation parses VinePathSpec
  return { x: x + jitterX, y: y + jitterY };
}
```

**Implementation note:** For Phase 25 simplicity, store the four control points directly in `VinePathSpec` (not just the `d` string) so `getLeafPosition` can call `cubicBezierPoint` without string-parsing. This is a zero-cost design choice at data structure level.

### Pattern 2: State Aggregation (Worst-Child-Wins)

**What:** Compute per-anchor leaf state from child Q&A `ReviewSchedule` fields. Pure function, no side effects.

**Source:** CONTEXT.md D-06/D-07 + verified `ReviewSchedule` type from `app/src/types/index.ts` (`nextReviewDate: string`, `reviewCount: number`, `easeFactor: number`) + `today()` from `app/src/lib/date.ts`.

```typescript
// Source: app/src/types/index.ts (ReviewSchedule shape) + app/src/lib/date.ts (today())
export type LeafState = 'bud' | 'green' | 'yellow' | 'falling' | 'fallen' | 'blossom' | 'fruit';

function computeDaysOverdue(nextReviewDate: string): number {
  // Uses local-time date arithmetic matching existing parseDateLocal pattern in date.ts
  const today = new Date();
  const [y, m, d] = nextReviewDate.split('-').map(Number);
  const reviewDate = new Date(y, m - 1, d);
  return Math.floor((today.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeLeafState(
  anchor: Question,
  qaChildren: Question[],
  blossomSinceDate?: string // ISO string, stored per-anchor in trellis state
): LeafState {
  if (anchor.reviewCount === 0 && qaChildren.every(q => q.reviewSchedule.reviewCount === 0)) {
    return 'bud';
  }
  // Blossom/fruit: checked first (these are "better" states)
  if (blossomSinceDate) {
    const daysBlossom = computeDaysOverdue(blossomSinceDate) * -1; // daysOverdue is negative when in future
    // actually: days since blossom = today - blossomSinceDate
    const dSince = Math.floor((Date.now() - new Date(blossomSinceDate).getTime()) / 86400000);
    if (dSince >= 7) return 'fruit';
  }
  const allReviewed = qaChildren.length > 0 && qaChildren.every(q => q.reviewSchedule.reviewCount > 0);
  const aggregateEase = qaChildren.length > 0
    ? qaChildren.reduce((sum, q) => sum + q.reviewSchedule.easeFactor, 0) / qaChildren.length
    : anchor.reviewSchedule.easeFactor;
  if (allReviewed && aggregateEase > 2.5) return 'blossom';

  // Worst-child-wins for overdue states
  let maxOverdue = -Infinity;
  for (const q of qaChildren.length > 0 ? qaChildren : [anchor]) {
    const d = computeDaysOverdue(q.reviewSchedule.nextReviewDate);
    if (d > maxOverdue) maxOverdue = d;
  }
  if (maxOverdue >= 14 || aggregateEase < 1.5) return 'fallen';
  if (maxOverdue >= 7) return 'falling';
  if (maxOverdue >= 1) return 'yellow';
  return 'green';
}
```

**IMPORTANT gap:** `blossomSinceDate` (the date when an anchor first reached blossom state) is not stored anywhere in the current data model. The trellis service will need a lightweight localStorage key (e.g., `trellis_blossom_dates: Record<anchorId, string>`) to track this. This is a new persistence concern the planner must create.

### Pattern 3: Framer Motion SVG Draw-On Animation

**What:** Vines draw on from bottom to top on mount using `pathLength` animated from 0 to 1 (Framer Motion's normalized path animation — no `getTotalLength()` needed). Stagger branches 200ms apart.

**Confidence:** HIGH — verified at [motion.dev/docs/react-svg-animation](https://motion.dev/docs/react-svg-animation)

```typescript
// Source: motion.dev/docs/react-svg-animation — pathLength is native Motion feature
// motion.path handles stroke-dasharray/stroke-dashoffset internally
import { motion } from 'framer-motion';

// Per-vine draw-on (staggerDelay per branch index)
<motion.path
  d={vine.d}
  stroke={branchColor}
  strokeWidth={2}
  fill="none"
  opacity={0.85}
  initial={{ pathLength: 0 }}
  animate={{ pathLength: 1 }}
  transition={{ duration: 1.2, delay: branchIndex * 0.2, ease: 'easeInOut' }}
/>
```

**Safari note (2025):** Motion fixed a Safari bug where unit-bearing `stroke-dasharray` values did not scale correctly on zoom. Using Motion's `pathLength` (unitless internally) avoids this — do NOT manually set `stroke-dasharray`/`stroke-dashoffset` when using `pathLength`.

### Pattern 4: Looping Ambient Leaf Sway

**What:** Continuous low-amplitude rotate animation on leaves. Controlled via `AnimationPlaybackControls` so it can be paused (D-55 leafCount > 50 guard).

**Confidence:** HIGH — `AnimationPlaybackControls` verified used in project at `SwipeTabContainer.tsx` line 22.

```typescript
// Source: motion.dev/docs/react-animation + project SwipeTabContainer pattern
import { animate, AnimationPlaybackControls } from 'framer-motion';
import { useEffect, useRef } from 'react';

function useSwaySway(leafRef: React.RefObject<SVGGElement>, enabled: boolean) {
  const controlsRef = useRef<AnimationPlaybackControls | null>(null);
  useEffect(() => {
    if (!leafRef.current || !enabled) return;
    const controls = animate(
      leafRef.current,
      { rotate: [0, 2, -2, 0] },
      { duration: 3, repeat: Infinity, ease: 'easeInOut' }
    );
    controlsRef.current = controls;
    return () => controls.stop();
  }, [leafRef, enabled]);
  return controlsRef;
}
```

**Performance guard for D-55 (>50 leaves):** Compute `const shouldSway = leafIndex % 3 === 0` (animate only 1 in 3 leaves when count > 50). This is deterministic (not random), so it does not change across renders.

### Pattern 5: Variant V Video Lifecycle (IntersectionObserver + visibilitychange)

**What:** Combined hook that pauses/resumes a `<video>` element when PlannerScreen is not visible.

**Why:** PlannerScreen is NOT always-mounted (only Home and Ask are — see MEMORY.md). However, PlannerScreen may be left as a rendered but display:none subtree in some navigation states. `IntersectionObserver` alone does not fire for `display:none` changes. Combined with `visibilitychange`, both cases are covered.

**Confidence:** HIGH — IntersectionObserver and visibilitychange are standard Web APIs, pattern verified in multiple sources.

```typescript
// Source: IntersectionObserver MDN + visibilitychange MDN + standard React useEffect cleanup pattern
import { useEffect, useRef } from 'react';

export function useVideoLifecycle(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      if (document.visibilityState === 'hidden') return;
      video.play().catch(() => { /* autoplay blocked — ignore */ });
    };

    const tryPause = () => video.pause();

    // Intersection: pause when hero is fully off-screen (ratio === 0)
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.intersectionRatio === 0) tryPause();
        else tryPlay();
      },
      { threshold: 0 }
    );
    observer.observe(video);

    // Page Visibility: pause when tab is backgrounded
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') tryPause();
      else tryPlay();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  return videoRef;
}
```

**Capacitor note:** Capacitor iOS/Android wraps a WKWebView/WebView. Both support IntersectionObserver and visibilitychange. No polyfill needed. The `playsInline` attribute is required for iOS inline video (`<video muted playsInline loop preload="metadata">`).

### Pattern 6: EventBus Subscription (Matches HomeScreen Pattern)

**What:** Subscribe to three trellis-relevant events on mount, unsubscribe on unmount.

**Critical gap:** `REVIEW_COMPLETED`, `CLASSIFICATION_COMPLETED`, and `ANCHOR_DELETED` do NOT exist in the current `AppEvent` union in `app/src/types/index.ts`. The existing `REVIEW_SUBMITTED` event has payload `{ questionId: string; rating: number }` — insufficient (does not carry anchorId). The planner MUST add these three events to `AppEvent`.

**Recommended payload shapes:**
```typescript
// To be added to AppEvent union in app/src/types/index.ts
| { type: 'REVIEW_COMPLETED'; payload: { questionId: string; anchorId?: string } }
| { type: 'CLASSIFICATION_COMPLETED'; payload: { anchorId: string; anchorName: string } }
| { type: 'ANCHOR_DELETED'; payload: { anchorId: string } }
```

**Subscription pattern (matches HomeScreen.tsx lines 72-92):**
```typescript
// Source: app/src/screens/HomeScreen.tsx (NEWS_POSTS_READY pattern)
useEffect(() => {
  const unsubReview = eventBus.subscribe('REVIEW_COMPLETED', (event) => {
    // recompute state for event.payload.anchorId; animate color transition
  });
  const unsubClassify = eventBus.subscribe('CLASSIFICATION_COMPLETED', (event) => {
    // insert new bud at vine endpoint
  });
  const unsubDelete = eventBus.subscribe('ANCHOR_DELETED', (event) => {
    // fade + detach leaf for event.payload.anchorId
  });
  return () => { unsubReview(); unsubClassify(); unsubDelete(); };
}, []);
```

**Emission points:** The planner must also identify WHERE these events are currently emitted:
- `REVIEW_SUBMITTED` fires from `review.service.ts` → the trellis service should subscribe to this and emit `REVIEW_COMPLETED` with the resolved `anchorId` (Q&A → anchor lookup), OR the review service should emit `REVIEW_COMPLETED` directly.
- `CLASSIFICATION_COMPLETED` should fire from `canonical-knowledge.service.ts` `classifyAndAnchor` after anchor creation.
- `ANCHOR_DELETED` should fire from wherever question deletion resolves to an anchor node (existing `QUESTION_DELETED` event could be extended, or a new emit added).

### Pattern 7: Tooltip Anchoring in SVG Coordinate Space

**What:** Tooltip positioned relative to leaf SVG coordinates, converted to screen coordinates for absolute positioning.

**Approach:** Use `SVGElement.getBoundingClientRect()` in the leaf's pointer event handler to get screen-space coordinates, then position the `Card` tooltip absolutely within the hero container.

```typescript
// Source: standard DOM API — getBoundingClientRect() for SVG elements
const handleLeafTap = (event: React.PointerEvent<SVGGElement>, anchor: AnchorNode) => {
  const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
  const heroRect = heroRef.current!.getBoundingClientRect();
  setTooltipAnchor({
    anchorId: anchor.id,
    x: rect.left - heroRect.left + rect.width / 2, // center of leaf in hero-local coords
    y: rect.top - heroRect.top,                     // top of leaf in hero-local coords
  });
};
```

**Tooltip popover positioning:** Position with `position: absolute` in the hero container, clamped to stay within hero bounds (`Math.min(x, heroWidth - tooltipWidth - 8)`). Uses existing `Card` component (verified: `app/src/components/ui/Card.tsx` — uses `var(--card)` bg + `var(--radius-xl)` + `var(--shadow-1)`).

### Pattern 8: Variant Picker (Dev Toggle)

**What:** A floating pill component gated on `import.meta.env.DEV` that cycles through A/C/V. Persists to `localStorage` key `trellis_variant_dev`.

```typescript
// Source: Vite docs — import.meta.env.DEV is boolean true in dev, false in prod
// Confirmed: project uses Vite 7 (package.json)
const VARIANT_KEY = 'trellis_variant_dev';
type TrellisVariant = 'A' | 'C' | 'V';

function TrellisVariantPicker({ variant, onChange }: { variant: TrellisVariant; onChange: (v: TrellisVariant) => void }) {
  if (!import.meta.env.DEV) return null;
  const cycle = () => {
    const next: Record<TrellisVariant, TrellisVariant> = { A: 'C', C: 'V', V: 'A' };
    const v = next[variant];
    localStorage.setItem(VARIANT_KEY, v);
    onChange(v);
  };
  return (
    <button
      onClick={cycle}
      style={{
        position: 'absolute', top: 8, right: 8, zIndex: 60,
        padding: '2px 8px', borderRadius: 'var(--radius-pill)',
        background: 'var(--surface-variant)', fontSize: '11px', border: '1px solid var(--border)',
      }}
    >
      Variant: {variant}
    </button>
  );
}
```

**Initial value:** `(localStorage.getItem(VARIANT_KEY) as TrellisVariant | null) ?? 'A'`

### Pattern 9: SVG Accessibility — Hit Target + ARIA

**What:** Leaf visual element is ~24–32px, but hit area is 44×44px via a transparent `<rect>` positioned relative to the leaf center. Screen reader label via `aria-label` on the group.

```typescript
// Source: UI-SPEC.md + WCAG 2.5.5 (44×44 minimum touch target)
// pointer-events="fill" on rect with fill="transparent" makes it clickable but invisible
<g
  role="button"
  tabIndex={0}
  aria-label={`${anchor.name} — ${leafState} health, ${qaChildren.length} Q&As`}
  onPointerDown={handleLeafTap}
  onKeyDown={(e) => e.key === 'Enter' && handleLeafTap(e as unknown)}
>
  {/* Invisible 44×44 hit target centered on leaf */}
  <rect
    x={leafX - 22} y={leafY - 22}
    width={44} height={44}
    fill="transparent"
    stroke="none"
    style={{ pointerEvents: 'all', cursor: 'pointer' }}
  />
  {/* Visual leaf (24–32px) */}
  <TrellisLeaf x={leafX} y={leafY} state={leafState} />
</g>
```

### Anti-Patterns to Avoid

- **Do NOT parse the SVG `d` string to extract control points.** Store control points in `VinePathSpec` explicitly so `getLeafPosition` can call `cubicBezierPoint` without string-parsing.
- **Do NOT use CSS `@keyframes` for leaf sway.** Use Framer Motion `animate()` imperative API with `AnimationPlaybackControls` so animations can be paused programmatically (D-55 performance guard).
- **Do NOT use `Math.random()` anywhere in layout generation.** All positions must be seeded for determinism (D-16/D-17/D-18).
- **Do NOT register `IntersectionObserver` on the whole PlannerScreen element.** Register it on the `<video>` element directly — smallest scope, fires correctly when the video enters/leaves the scroll viewport.
- **Do NOT use `getTotalLength()` for vine draw-on animation.** Use Framer Motion's `pathLength` (normalized 0→1) which handles it internally and avoids the Safari zoom bug.
- **Do NOT block leaf taps during animations** (UI-SPEC Interaction Contract: "leaves remain tappable throughout").
- **Do NOT add shadcn or new registry packages.** Project is explicitly non-shadcn (UI-SPEC Registry Safety section).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Seeded RNG | Custom LCG or `Math.random()` tricks | mulberry32 (5-line inline) | Statistically higher quality, no period cliffs at 5–30 items |
| SVG path draw-on | Manual `stroke-dasharray` + `getTotalLength()` | Framer Motion `pathLength: 0→1` on `motion.path` | Motion handles unit-less normalization + Safari compat |
| Video pause on hidden | `setInterval` polling visibility | `IntersectionObserver` + `visibilitychange` event | Zero-cost push model; no polling battery drain |
| Tooltip positioning | Manual pixel math on SVG coordinates | `getBoundingClientRect()` delta from hero container | Handles scroll, zoom, device pixel ratio automatically |
| Animation pause/resume | `React.useState(playing)` + conditional rendering | Framer Motion `AnimationPlaybackControls.stop()/play()` | Already imported (SwipeTabContainer uses same type) |

**Key insight:** The 5–30 anchor scale makes hand-rolled solutions viable on desktop but risky on Capacitor mobile where CPU/GPU budgets are lower. Use the provided primitives and keep SVG filter complexity in Variant C minimal (blur only, no feTurbulence displacement maps on leaves).

---

## Runtime State Inventory

> This is a new feature phase — no rename/refactor involved. However, one new persistence concern exists.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `trellis_blossom_dates: Record<anchorId, string>` — new, not yet stored | Create in trellis-state.service.ts; write on first blossom; read on mount |
| Stored data | `trellis_variant_dev` localStorage key — dev-only | Write in TrellisVariantPicker; read in TrellisHero initial state |
| Live service config | None — no external service state | N/A |
| OS-registered state | None | N/A |
| Secrets/env vars | None — no new API keys; assets are static files | N/A |
| Build artifacts | `app/src/assets/planner-trellis/` — must exist before Variant A/V tests run | Create directory; add placeholder or real asset before build |

---

## Common Pitfalls

### Pitfall 1: AppEvent Missing New Event Types (Compile Error)

**What goes wrong:** TrellisHero tries to subscribe to `REVIEW_COMPLETED`, `CLASSIFICATION_COMPLETED`, `ANCHOR_DELETED` but these are not in the `AppEvent` union — TypeScript compile error.
**Why it happens:** These events are locked in CONTEXT.md D-48 but the existing `AppEvent` union (verified: `app/src/types/index.ts` line 642) only has `REVIEW_SUBMITTED` (different shape), `QUESTION_DELETED` (anchor deletion not covered), and `REORG_COMPLETED` (not the right granularity).
**How to avoid:** Wave 0 task must add all three event types to `AppEvent` and add emit calls at their respective origin points.
**Warning signs:** TypeScript error `Argument of type '"REVIEW_COMPLETED"' is not assignable to parameter of type 'AppEvent["type"]'`.

### Pitfall 2: Vine Layout Produces Overlapping Leaves on Wide Viewports

**What goes wrong:** All vines generate from a fixed `viewBox="0 0 800 400"` but the hero is 100% wide. At >800px physical width, SVG scales up fine. At <400px physical width, leaves may overlap with each other or clipped vine endpoints.
**Why it happens:** Seeded layout uses absolute viewBox positions; small screens compress these.
**How to avoid:** Use `viewBox="0 0 800 400"` with `preserveAspectRatio="xMidYMid meet"` or `slice` depending on desired behavior. UI-SPEC specifies `clamp(200px, 50vw, 250px)` height — at 320px wide mobile, aspect becomes 320:200 = 1.6:1 (not 2:1). Layout algorithm should use normalized positions (0..1) that are multiplied by actual viewBox at render time rather than hardcoded pixel values. This is a design decision the planner must resolve.
**Warning signs:** Leaves visually outside the visible canvas area, or clipped at SVG edge.

### Pitfall 3: SVG Filters (Variant C) Performance on Capacitor iOS

**What goes wrong:** `feDisplacementMap` and animated `feTurbulence` are extremely expensive on iOS WebView. Even `feGaussianBlur` with large `stdDeviation` on many elements can drop frames.
**Why it happens:** SVG filter rasterization is CPU-bound on mobile WebViews; GPU compositing is not used for SVG filter primitives the same way as CSS transforms.
**How to avoid:** Variant C must use filters ONLY for:
- Static `feGaussianBlur` (small stdDeviation ≤4) on the BACKGROUND SVG (one DOM element, cached)
- `feDropShadow` on leaf group (CSS `filter: drop-shadow()` is often faster than SVG filter)
- NO `feTurbulence`, NO `feDisplacementMap` on leaves or vines
**Warning signs:** Janky scroll when hero is visible on iPhone (Capacitor test), CPU > 70% in Safari profiler.

### Pitfall 4: Blossom Since-Date Not Persisted → Fruit Never Appears

**What goes wrong:** Anchor reaches blossom state, but fruit threshold (7+ consecutive days in blossom) never triggers because `blossomSinceDate` is not stored.
**Why it happens:** Nothing in the existing `Question.reviewSchedule` tracks the date a blossom state was first reached.
**How to avoid:** On each state computation pass, if state === 'blossom' and no `blossomSinceDate` stored, write today's date to `trellis_blossom_dates[anchorId]`. If state drops below blossom, clear it.
**Warning signs:** Mastered anchors never show fruit even after a week.

### Pitfall 5: Video Autoplay Blocked on Initial Load

**What goes wrong:** `video.play()` throws a `DOMException: play() request was interrupted` on mobile because autoplay requires user gesture.
**Why it happens:** Capacitor iOS requires `playsInline` AND `muted` for autoplay to work without gesture. Also, calling `play()` on a freshly-loaded video before `canplay` event fires causes a race condition.
**How to avoid:** Set `muted playsInline loop preload="metadata"` on `<video>`. Call `video.play()` only after `video.readyState >= 2` (HAVE_CURRENT_DATA). In the `useVideoLifecycle` hook, call `tryPlay()` on `canplay` event as well as on IntersectionObserver entry.
**Warning signs:** `Unhandled Promise rejection: play() failed` in Capacitor logs.

### Pitfall 6: Tooltip Outside Hero Bounds on Small Leaves at Canvas Edges

**What goes wrong:** Tapping a leaf near the top-right corner of the hero opens a tooltip that overflows outside the hero div (or the screen).
**Why it happens:** Simple `x = leafX` positioning without clamping.
**How to avoid:** Clamp tooltip position: `left = Math.min(Math.max(0, x - tooltipWidth/2), heroWidth - tooltipWidth - 8)` and `top = y < tooltipHeight + 8 ? y + 40 : y - tooltipHeight - 8` (flip above/below based on available space).
**Warning signs:** Tooltip extends below/beyond hero, creating scrollable overflow.

### Pitfall 7: `buildAnchorReflectionTree` Returns Legacy Nodes as Direct Leaves

**What goes wrong:** Legacy Q&As (questions without an anchor parent) are returned in `legacyNodes` arrays in the cluster structure. If the trellis treats these as anchor leaves, they render as leaf nodes without proper anchor metadata (no `isAnchorNode === true`).
**Why it happens:** `buildAnchorReflectionTree` at line 989–1004 of `canonical-knowledge.service.ts` inserts `legacyQAs` into clusters as `legacyNodes`, not as anchor entries.
**How to avoid:** In the trellis state service, process only `anchors` arrays (not `legacyNodes`) from the returned tree. Document this explicitly. Legacy nodes are rendered on GraphScreen but NOT on Trellis.
**Warning signs:** Leaf count inflated beyond anchor count; some leaves lack proper anchor name/Q&A child data.

---

## Code Examples

### State aggregation full flow

```typescript
// Source: app/src/services/canonical-knowledge.service.ts (buildAnchorReflectionTree return shape)
// Source: app/src/types/index.ts (Question, ReviewSchedule)
// Verified shape: { rootLabel, branches[].clusters[].anchors[]{anchor, qaChildren} }

import { buildAnchorReflectionTree } from './canonical-knowledge.service';

export interface TrellisAnchorNode {
  anchor: Question;
  qaChildren: Question[];
  leafState: LeafState;
  branchLabel: string;
  branchIndex: number;
  vinePosition: { t: number }; // parametric position along vine
  layoutPosition: { x: number; y: number }; // computed by seeded layout
  blossomSinceDate?: string;
}

export function buildTrellisState(questions: Question[]): TrellisAnchorNode[] {
  const tree = buildAnchorReflectionTree(questions);
  const blossomDates: Record<string, string> = JSON.parse(
    localStorage.getItem('trellis_blossom_dates') ?? '{}'
  );
  const nodes: TrellisAnchorNode[] = [];
  tree.forEach((root, rootIdx) => {
    root.branches.forEach((branch, branchIdx) => {
      branch.clusters.forEach((cluster) => {
        cluster.anchors.forEach(({ anchor, qaChildren }) => {
          const state = computeLeafState(anchor, qaChildren, blossomDates[anchor.id]);
          // Update blossom persistence
          if (state === 'blossom' || state === 'fruit') {
            if (!blossomDates[anchor.id]) {
              blossomDates[anchor.id] = new Date().toISOString().split('T')[0];
            }
          } else {
            delete blossomDates[anchor.id];
          }
          nodes.push({
            anchor, qaChildren, leafState: state,
            branchLabel: branch.branchLabel, branchIndex: branchIdx,
            vinePosition: { t: 0 }, // filled by layout engine
            layoutPosition: { x: 0, y: 0 }, // filled by layout engine
            blossomSinceDate: blossomDates[anchor.id],
          });
        });
      });
    });
  });
  localStorage.setItem('trellis_blossom_dates', JSON.stringify(blossomDates));
  return nodes;
}
```

### Tooltip with Card/Badge primitives

```typescript
// Source: app/src/components/ui/Card.tsx + Badge.tsx — verified component APIs
// Card accepts style prop; Badge accepts color prop ('green'|'yellow'|'red'|'gray')
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

const STATE_BADGE_COLOR: Record<LeafState, string> = {
  bud: 'gray', green: 'green', yellow: 'yellow', falling: 'yellow', fallen: 'red',
  blossom: 'green', fruit: 'green',
};

<Card
  padding="12px 14px"
  style={{
    position: 'absolute', zIndex: 50,
    left: clampedX, top: clampedY,
    minWidth: 200, maxWidth: 260,
    pointerEvents: 'auto',
  }}
>
  <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 4 }}>{anchor.name}</div>
  <Badge color={STATE_BADGE_COLOR[leafState]}>{healthCopy}</Badge>
  <div style={{ fontSize: '0.875rem', marginTop: 6, color: 'var(--muted-foreground)' }}>
    {reviewedCount} / {totalCount} reviewed · {overdueCount} overdue
  </div>
  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
    <Button size="sm" variant="primary" onClick={handleReview}>Review</Button>
    <Button size="sm" variant="secondary" onClick={handleViewQAs}>View Q&As</Button>
  </div>
</Card>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `stroke-dasharray`/`getTotalLength()` for SVG draw-on | Framer Motion `pathLength` (normalized 0→1) | Motion v5+ | No Safari zoom bug; no DOM measurement side effect |
| `useAnimation()` + `controls.start()` for loops | Imperative `animate()` returning `AnimationPlaybackControls` | Motion v10+ | Cleaner stop/pause, refs over hook state |
| CSS `filter: blur()` for glow effects | `color-mix(in srgb, var(--primary-40) X%, transparent)` for box-shadow glows | CSS Color Level 5 (2023+) | Project already uses this pattern in `glow-pulse` keyframe |
| `feDisplacementMap` for organic wobble on mobile | Skip on mobile; use CSS transform rotate for sway | Ongoing perf practice | Avoids iOS WebView CPU spike |

**Deprecated/outdated:**
- `framer-motion` package name: The library has rebranded to `motion` (`motion.dev`), but the npm package `framer-motion` still resolves to it (v12.x). The existing project imports `from 'framer-motion'` — keep this unchanged, no migration needed.

---

## Open Questions

1. **Vine fork/junction for clusters (D-13)**
   - What we know: D-13 says "Cluster → fork/junction on parent vine"
   - What's unclear: A vine per branch (D-12) is clear. But if one branch has 3 clusters, do the 3 clusters share one vine with 3 fork-off branches? Or are there 3 separate vines per branch? The layout algorithm description (D-17) says "one vine per branch" — implying clusters share a vine with leaf placements scattered along it (not explicit forks). The planner should clarify whether a visual fork (path branching) is required for clusters, or if clusters are just semantic groupings for leaf placement.
   - Recommendation: Implement simple version first (leaves spaced along vine by cluster group, no visual fork) — adds visual fork as enhancement if evaluation shows it's needed.

2. **`daysOverdue` computation for legacy Q&As (no reviewCount)**
   - What we know: `ReviewSchedule.nextReviewDate` is always initialized (even for new questions). New questions have `reviewCount === 0`.
   - What's unclear: For Q&As that have NEVER been reviewed, `nextReviewDate` may be a date in the past (set at creation) or a future date (SM-2 schedules first review after 1 day). If newly created Q&A has `nextReviewDate` = today or past, it will be computed as overdue immediately, making new anchors show as "yellow" instead of "bud".
   - Recommendation: Guard: if `reviewCount === 0`, always return 'bud' state regardless of `nextReviewDate`. This matches D-05 ("bud = new anchor") and D-06 (overdue logic applies to reviewed Q&As). Verify `reviewCount` field is non-zero only after first review submission.

3. **`REVIEW_COMPLETED` vs `REVIEW_SUBMITTED` — emit strategy**
   - What we know: `REVIEW_SUBMITTED` fires from `review.service.ts` with `{ questionId, rating }`. The trellis needs anchorId to know which leaf to update.
   - What's unclear: Should we (a) add a new `REVIEW_COMPLETED` event with `anchorId` emitted from `review.service.ts`, or (b) subscribe to `REVIEW_SUBMITTED` in the trellis and look up the anchor from the questionId? Option (b) avoids modifying `review.service.ts` but requires a lookup.
   - Recommendation: Option (b) — subscribe to `REVIEW_SUBMITTED`, resolve anchorId via `questions.find(q => q.id === questionId)?.parentId`. Lower blast radius. Add comment noting the indirection.

4. **50+ anchor performance threshold (D-55) — what is the practical upper bound?**
   - What we know: D-55 says "reduce ambient animation complexity when leafCount > 50".
   - What's unclear: Users in early phases typically have 5–30 anchors. 50 is an upper bound for MVP. But 50 SVG `motion.g` elements with individual sway animations may still be heavier than desired on older devices.
   - Recommendation: Apply the 1-in-3 sway subset rule at > 20 anchors (not 50) as a conservative guard. Document as tunable constant. 20 is still "all-green celebration" plausible territory.

5. **Asset availability at build time (Variants A and V)**
   - What we know: Assets are pre-generated externally and stored in `app/src/assets/planner-trellis/`.
   - What's unclear: If assets don't exist at build time, Vite will throw a build error on static imports. The planner must decide: (a) use conditional/dynamic import that degrades gracefully, or (b) require assets to be committed before wave that implements Variants A/V.
   - Recommendation: Option (b) — commit placeholder 1×1 WebP and 1s silent MP4 as stubs before implementing Variant A/V. Replace with real assets later. This keeps builds green during development.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| framer-motion | All variants — vine draw-on, leaf animations, sparkles | YES | 12.38.0 | — |
| IntersectionObserver | Variant V video pause | YES (Capacitor WKWebView iOS 12.2+, Android 5+) | Web API | — |
| document.visibilitychange | Variant V tab backgrounding | YES (all modern browsers/WebViews) | Web API | — |
| `app/src/assets/planner-trellis/` directory | Variants A and V | NOT YET CREATED | — | Stub assets required before Vite import |
| `trellis_blossom_dates` localStorage key | Fruit state | Created at first blossom | — | Initialized to `{}` if missing |
| AppEvent `REVIEW_COMPLETED` etc. | TrellisHero event subscriptions | NOT YET IN TYPES | — | Blocking — must be added in Wave 0 |

**Missing dependencies with no fallback:**
- `AppEvent` union missing `REVIEW_COMPLETED`, `CLASSIFICATION_COMPLETED`, `ANCHOR_DELETED` — must be added to `app/src/types/index.ts` before trellis event subscriptions compile.
- `app/src/assets/planner-trellis/` directory does not exist — must be created with stub assets before Vite imports in Variants A/V.

**Missing dependencies with fallback:**
- Real AI-generated background assets — Variant C (pure SVG) works with zero assets; Variants A/V use stubs initially.

---

## Validation Architecture

> `workflow.nyquist_validation: true` — validation section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (project uses Vite 7; standard companion) — if not yet installed, Wave 0 adds it |
| Config file | `app/vitest.config.ts` (to be created if absent) |
| Quick run command | `npx vitest run --reporter=verbose app/src/services/trellis-state.service.test.ts` |
| Full suite command | `npx vitest run` |

**Note:** Check if Vitest is already in `devDependencies` before adding:

```bash
cat app/package.json | grep vitest
```

If absent, Wave 0 installs `vitest @vitest/ui` as dev deps.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRELLIS-STATE-01 | `computeLeafState` returns correct state for each overdue threshold (green/yellow/falling/fallen) | unit | `npx vitest run app/src/services/trellis-state.service.test.ts` | Wave 0 |
| TRELLIS-STATE-02 | Worst-child-wins: one 14-day-overdue child causes anchor to be 'fallen' even with other healthy Q&As | unit | `npx vitest run app/src/services/trellis-state.service.test.ts` | Wave 0 |
| TRELLIS-STATE-03 | Bud state: `reviewCount === 0` always returns 'bud' regardless of `nextReviewDate` | unit | `npx vitest run app/src/services/trellis-state.service.test.ts` | Wave 0 |
| TRELLIS-LAYOUT-01 | `generateVinePath` is deterministic: same branchId → identical `d` string across 100 calls | unit | `npx vitest run app/src/services/trellis-layout.test.ts` | Wave 0 |
| TRELLIS-LAYOUT-02 | `getLeafPosition` is deterministic: same anchorId → identical {x,y} across 100 calls | unit | `npx vitest run app/src/services/trellis-layout.test.ts` | Wave 0 |
| TRELLIS-LAYOUT-03 | mulberry32 seeded RNG: seed 12345 → first value matches known golden output | unit | `npx vitest run app/src/services/trellis-layout.test.ts` | Wave 0 |
| TRELLIS-BLOSSOM-01 | `buildTrellisState` persists `blossomSinceDate` on first blossom; clears on state drop | unit | `npx vitest run app/src/services/trellis-state.service.test.ts` | Wave 0 |
| TRELLIS-BLOSSOM-02 | Fruit threshold: anchor shows 'fruit' state only after 7+ days in blossom | unit | same | Wave 0 |
| TRELLIS-EMPTY-01 | `buildTrellisState([])` returns empty array; TrellisHero renders EmptyState (smoke) | smoke/visual | manual + Vitest component render | Wave 1 |
| TRELLIS-EVENT-01 | REVIEW_SUBMITTED event → leaf state recomputed for correct anchor (via parentId lookup) | unit | `npx vitest run app/src/components/trellis/TrellisHero.test.ts` | Wave 3 |
| TRELLIS-VIDEO-01 | `useVideoLifecycle` hook calls `video.pause()` when IntersectionObserver ratio === 0 | unit (mock IntersectionObserver) | `npx vitest run app/src/components/trellis/TrellisBackgroundV.test.ts` | Wave 2 |
| TRELLIS-VIDEO-02 | `useVideoLifecycle` hook calls `video.pause()` when `document.visibilityState === 'hidden'` | unit (mock document.visibilityState) | same | Wave 2 |
| TRELLIS-TOOLTIP-01 | Tooltip shows correct anchor name, stats line (N/M reviewed · K overdue), health copy | smoke/visual | manual in dev + Vitest component render | Wave 1 |

### Sampling Rate
- **Per task commit:** `npx vitest run app/src/services/` (state + layout unit tests only — fast)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `app/src/services/trellis-state.service.test.ts` — covers TRELLIS-STATE-01 through 03, TRELLIS-BLOSSOM-01/02
- [ ] `app/src/services/trellis-layout.test.ts` — covers TRELLIS-LAYOUT-01 through 03
- [ ] `app/src/components/trellis/TrellisBackgroundV.test.ts` — covers TRELLIS-VIDEO-01/02 (with IntersectionObserver mock)
- [ ] `app/src/components/trellis/TrellisHero.test.ts` — covers TRELLIS-EVENT-01 (may need vitest-dom)
- [ ] Vitest install: `npm install -D vitest @vitest/ui` in `app/` if not present
- [ ] `app/vitest.config.ts` — configure jsdom environment for component tests, include `app/src/**`
- [ ] `app/src/assets/planner-trellis/.gitkeep` — create directory so Wave 1 can add stub asset imports without Vite build error

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md does not exist at `/Users/Code/EchoLearn/CLAUDE.md` — all project conventions are captured in the MEMORY.md auto-memory instead. The following directives are operative:

- **Inline styles with CSS variables, NOT Tailwind classes** — all trellis components must use `style={{ color: 'var(--node-mint)' }}` etc.
- **Service result pattern** — any new service functions should return `ServiceResult<T> = { success, data?, error? }` (or pure functions for layout utilities)
- **No ref.current during render** — use `useEffect` for syncing state to refs (e.g., the `videoRef` population in `useVideoLifecycle`)
- **`react-hooks/set-state-in-effect` rule disabled** — `setState` inside `useEffect` after async data is acceptable
- **localStorage persistence** — all new user state persists locally (blossom dates, variant dev key)
- **No runtime image generation** — assets are static; no calls to NanoBanana/Gemini pipeline for trellis backgrounds (D-31/D-32)
- **`import.meta.env.DEV`** for dev-only features (TrellisVariantPicker)

---

## Sources

### Primary (HIGH confidence)
- `app/src/types/index.ts` — `AppEvent` union (verified: REVIEW_COMPLETED not present; REVIEW_SUBMITTED is), `ReviewSchedule` shape, `Question` fields
- `app/src/services/canonical-knowledge.service.ts` lines 931–1004 — `buildAnchorReflectionTree` return shape, legacyNodes handling
- `app/src/lib/event-bus.ts` — subscribe/emit pattern
- `app/src/screens/HomeScreen.tsx` lines 72–92 — canonical eventBus subscription pattern
- `app/src/lib/date.ts` — `today()`, `addDays()`, `parseDateLocal()` (local-time date arithmetic)
- `app/src/index.css` — CSS variable values for all color tokens
- `app/src/components/ui/Card.tsx` — Card API (style prop, padding, CSS var usage)
- `app/src/components/SwipeTabContainer.tsx` — `AnimationPlaybackControls` import and usage pattern
- [motion.dev/docs/react-svg-animation](https://motion.dev/docs/react-svg-animation) — `pathLength` native Motion feature, no getTotalLength needed
- [motion.dev/docs/react-animation](https://motion.dev/docs/react-animation) — `repeat: Infinity`, `animate()` imperative returns `AnimationPlaybackControls` with `.stop()`
- [github.com/bryc/code/blob/master/jshash/PRNGs.md](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) — mulberry32 canonical implementation
- [MDN feTurbulence](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence) — filter primitive spec
- [MDN pointer-events](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/pointer-events) — `pointer-events="fill"` on transparent rect

### Secondary (MEDIUM confidence)
- [4rknova.com/blog/2026/03/01/mulberry32-rng](https://www.4rknova.com/blog/2026/03/01/mulberry32-rng) — mulberry32 description (2026 post, corroborates canonical gist)
- [gsap.com community thread on feTurbulence mobile performance](https://gsap.com/community/forums/topic/33075-gsap-and-feturbulence-mobile-performance/) — confirmed feTurbulence + feDisplacementMap is sluggish on iOS; verified by multiple developer reports
- [SVG AI SVG animation encyclopedia 2025](https://www.svgai.org/blog/research/svg-animation-encyclopedia-complete-guide) — stroke-dashoffset best practices

### Tertiary (LOW confidence — noted for awareness)
- GitHub issues `framer/motion#2392` and `#2046` — requests for `useAnimationControls.pause()` (the imperative `animate()` `AnimationPlaybackControls.stop()` is the official path, not `useAnimationControls`)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — framer-motion 12.38.0 verified in package.json; no new deps needed
- Architecture (vine algorithm): HIGH — math is standard cubic bezier, mulberry32 is well-documented; layout structure derived from CONTEXT.md locked decisions
- Architecture (state aggregation): HIGH — derived from verified `ReviewSchedule` type and `buildAnchorReflectionTree` return shape
- Architecture (event bus): HIGH — HomeScreen pattern verified in source
- Architecture (Variant V video): HIGH — IntersectionObserver + visibilitychange are stable Web APIs; Capacitor WebView compat confirmed
- Pitfalls: HIGH for AppEvent gap and blossom persistence (verified from code); MEDIUM for iOS SVG filter performance (corroborated but not Capacitor-specific test)
- Validation architecture: MEDIUM — Vitest presence in project not confirmed (check `app/package.json` in Wave 0)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable domain; framer-motion 12.x active development — re-verify if version bumps above 12.38)
