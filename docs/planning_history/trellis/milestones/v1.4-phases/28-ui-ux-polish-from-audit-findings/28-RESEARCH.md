# Phase 28: UI/UX Polish from Audit Findings - Research

**Researched:** 2026-04-16
**Domain:** React 19 / Vite 7 / Tailwind 4 / Capacitor 8 mobile app — UI polish (SwipeTabContainer viewport-desync fix, nav hide, trellis interactions, i18n key swap, AskScreen polish)
**Confidence:** HIGH (source files directly inspected; 25 CONTEXT decisions are locked; Phase 27 i18n scaffold archived and stable)

## Summary

All 25 audit decisions were inspected against the live source tree. The most consequential finding is that the D-05 SwipeTabContainer desync has **two** stale-read vectors, not one — `screenWidthRef` is only refreshed inside `onPanStart`, while `useLayoutEffect` reads it directly for route-sync, and `swipeProgress`'s `useTransform` also reads it. Two separate stale reads need a single resize-listener fix plus one `useLayoutEffect` hardening.

Most other Wave decisions map cleanly onto existing code with minimal ambiguity:

- **D-04:** The section header already exists in code (`PlannerScreen.tsx:130` renders `<h2>{t('planner.suggestedMoves')}</h2>`). The audit finding must be about it *appearing invisible* (fontSize 1rem on a crowded surface) — this is a styling tweak, not a net-new heading.
- **D-14:** `graph.title = "Knowledge Graph"` already exists in `en.json:194`, but `graph.headerTitle = "Mind Map"` at line 195 is the key actually rendered by `GraphScreen.tsx:522`. The fix is a one-value edit in 4 bundles; NO new key needed.
- **D-10/D-11:** Leaves have NO click handler and `TrellisCanvas` sets `pointerEvents: 'none'` at SVG root — enabling taps requires both a handler in `TrellisLeaf` *and* a pointer-events change on either canvas or individual leaf `<g>` nodes.
- **D-06/D-08:** Existing CSS has `--border` not `--outline-variant`. BottomNavigation already has `borderTop: '1px solid var(--border)'` at line 147 — D-08 is a no-op or very-light polish, not a new feature.

**Primary recommendation:** Split into 2 plans (28-01 Waves A+B, 28-02 Waves C+D) per CONTEXT's default. Wave A's D-05 is the highest-risk item; gate it with a pure-logic test on the resize-handler `computeTargetX` helper and manual UAT on the visualViewport resize sequence.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Ship the full audit — Waves A + B + C + D in one phase.
- **D-02:** Withdrawn audit findings (Dev Mode default, Suggested-Moves debug labels, harvest chip count) are NOT part of this phase.
- **D-03:** Every finding must land with a visible, manually-verifiable before/after. UAT checklist = audit report.
- **D-04 (A-1):** Add a visible "Suggested Moves" section header above the Suggested Moves list on PlannerScreen.
- **D-05 (A-2):** Fix SwipeTabContainer transform desync. Root cause hypothesis: `screenWidthRef` is captured once and never refreshes on visualViewport changes. Fix: (1) add `resize` + `visualViewport.resize` listeners that update `screenWidthRef` and re-snap `stripX` when not mid-gesture; (2) on route sync, always recompute target X from current `screenWidthRef.current`; (3) dev-only invariant check with warning if drift > 2px.
- **D-06 (A-3):** Hide BottomNavigation on sub-screens via slide-down animation (~200ms spring matching existing `SPRING`). Pass `isTopLevelScreen` as prop, animate `y` translate between `0` and `88px + safe-area-bottom`.
- **D-07 (B-1):** Sub-screen Header scroll-aware shadow (`var(--shadow-1)` when scrollTop > 4px). Top-level screen headers stay flat.
- **D-08 (B-2):** BottomNavigation `borderTop: '1px solid var(--outline-variant)'` (or equivalent) for divider visibility.
- **D-09 (B-3):** P1 consistency-pass consolidated task; planner decides exact list.
- **D-10 (C-1):** Tap-to-shake leaf: 300ms rotate `0° → +4° → -4° → +2° → 0°` via Framer Motion variants. No tooltip/sheet/nav.
- **D-11 (C-2):** `hapticImpactLight()` at shake start. Web no-op, Capacitor fires.
- **D-12 (C-3):** Pulse-on-focus: scale `1 → 1.15 → 1` (~600ms) + `drop-shadow(0 0 8px var(--primary-40))` fading over ~2s when Suggested Move row anchor matches leaf anchorId. Clears on action. Pure ephemeral state. Data: PlannerScreen emits `focusedAnchorId` → TrellisHero props → TrellisLeaf `focused?: boolean`.
- **D-13 (C-4):** Perf guard when `leaves.length > 30`: shake/pulse only on viewport-visible leaves via `whileInView` or IntersectionObserver. Extends Phase 25 D-55.
- **D-14 (C-5):** "Mind Map" → "Knowledge Graph" via `t('graph.title')` in 4 locale bundles. Graceful degradation: direct string edit + `// TODO(phase-27)` if key-extraction hasn't run. Update AskScreen comment (line 234) for grep hygiene.
- **D-15 (D-1):** AskScreen recent-questions polish: remove hardcoded `• ` bullet, 2-line clamp via `WebkitLineClamp: 2`, tappable rows → `/ask/:id`, empty-state copy "No recent questions yet — ask your first one below.".
- **D-16 (D-2):** Suggested-Moves row chips get `transform: scale(0.96)` on press (use `active-squish` utility).
- **D-17 (D-3):** Empty-state copy consistency pass — planner decides list.
- **D-18 (D-4):** Graph screen micro-tweaks consolidated task.
- **D-19 (D-5):** Residual P2 "polish-leftovers" task, cap ≤4 items.
- **D-20:** No new components unless strictly required.
- **D-21:** Inline styles with CSS variables per project convention. No Tailwind classes introduced.
- **D-22:** All animations use Framer Motion. No new animation libraries.
- **D-23:** Event bus for cross-component focus acceptable if prop-drilling ugly — planner decides.
- **D-24:** i18n coordination — Phase 27 scaffold live; all new user-visible strings MUST go through `t(...)` in all 4 bundles.
- **D-25:** Regression safety — `npm run typecheck` + manual Chrome localhost:5173 UAT after each wave. No automated e2e.

### Claude's Discretion

- Exact spring values for nav slide-down.
- `focusedAnchorId` routing: props through TrellisHero vs. `eventBus.emit('SUGGESTED_MOVE_FOCUSED')` — planner picks.
- Pulse glow color/intensity — must use CSS variables.
- Scroll-aware header shadow: React state vs. CSS variable vs. context — planner picks.
- Whether to split phase into 1 or 2 plans (default: 2 — A+B, then C+D).
- Specific residual P2 items for D-17/D-18/D-19.

### Deferred Ideas (OUT OF SCOPE)

- Leaf tap tooltip / inline caption — explicitly rejected; violates "no new mental model" directive.
- Trellis zoom/pan interactions.
- Accessibility sweep (ARIA labels for trellis SVG, focus rings, contrast audit).
- Automated visual regression (Percy / Chromatic).
- Keyboard-open visual viewport refinements beyond the desync fix.
- Sub-screen page transitions beyond `PageTransition`.
- Per-screen theme hints.
- Animated bottom-sheet dismissal residual polish.

## Project Constraints (from CLAUDE.md)

- **Working dir:** `app/` for all source ops.
- **Test framework:** `node --test` + esbuild tsx loader. Pattern: `app/tests/canonical-knowledge.test.mjs`. Phase 27 locale tests import `i18next` directly to avoid Node 25 JSON-import-attribute failures.
- **Inline styles with CSS variables** — NOT Tailwind classes for UI.
- **Event bus** (`src/lib/event-bus.ts`) for cross-screen notifications (e.g., `LOCALE_CHANGED`, `REVIEW_COMPLETED`).
- **Services return `ServiceResult<T>`.**
- **localStorage for user preferences via `settingsService`.**
- **i18n rule (absolute):** runtime LLM translation is PROHIBITED. Any new user-visible string must land in all 4 locale bundles (`en/zh/es/ja.json`) in the SAME PR. `bundle-parity.test.mjs` enforces identical key sets.
- **EN-first workflow:** add canonical value to `en.json` → run Sonnet subagent (or executor-inline per Phase 27 Plan 07 deviation) to fill zh/es/ja → human-review → commit 4 bundles in one PR.
- **Don't translate:** proper nouns (EchoLearn, OpenAI, Claude, Gemini, YouTube, Tavily, ZeroTier), model IDs, emoji prefixes (`'✓'`/`'✗'`), cross-locale branded labels (`Language / 语言 / Idioma / 言語`).

## Phase Requirements

No REQ-IDs tracked — polish phase is internally scoped per REQUIREMENTS.md traceability table. The UAT checklist in CONTEXT D-03 is the authoritative acceptance list.

## Standard Stack

### Core (already installed — DO NOT add new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `framer-motion` | 12.x | All animations (shake, pulse, slide, scroll) | D-22 locks this; existing `SPRING` constant reusable |
| `react-i18next` | 17.0.3 | User-visible string translation | D-24 requires; Phase 27 scaffold complete |
| `i18next` | 26.0.5 | Core i18n engine | Peer dep of react-i18next |
| `lucide-react` | — | Icon set (already in use on `PlannerScreen`) | Consistent iconography |
| `@capacitor/haptics` | 8.x | `hapticImpactLight` on native | D-11 consumer |
| `react-router-dom` | v7 | `useLocation`/`useNavigate` for Outlet wrapper / route watch | Already wired everywhere |

**No new packages are required for Phase 28.** Every decision maps to an API already in use.

### Framer Motion APIs used in this phase

| API | Where | Purpose |
|-----|-------|---------|
| `useMotionValue` | SwipeTabContainer.tsx:68 | `stripX` — primary strip position |
| `useTransform` | SwipeTabContainer.tsx:71 | `swipeProgress` derived from stripX (reads `screenWidthRef.current`) |
| `animate(value, target, transition)` | SwipeTabContainer.tsx:139,148 | Spring animation on commit / snap-back |
| `motion.g` + `animate` + `transition` | TrellisLeaf.tsx:516 | Existing ambient sway — new shake variant will sit on same motion.g |
| `motion.nav` + animate `y` | BottomNavigation.tsx (to be added) | Slide-down hide |
| `motion.div` onScroll | App.tsx Outlet wrapper | Sub-screen scroll detection for D-07 |
| `whileInView` / IntersectionObserver | TrellisLeaf wrapper | D-13 perf guard (>30 leaves) |

**Version verification:** Context7 was not consulted for these APIs because the project is locked to the versions already installed. `package.json` versions are the authoritative source; no changes advisable in a polish phase.

### Alternatives Considered (and rejected)

| Instead of | Could Use | Why Rejected |
|------------|-----------|---------------|
| Framer Motion shake | CSS `@keyframes` | Would require new inline CSS (D-21 prefers inline + CSS vars, and D-22 locks Framer Motion) |
| React Context for `focusedAnchorId` | eventBus vs. prop drill | Trellis path is PlannerScreen → TrellisHero → TrellisCanvas → TrellisLeaf (3 levels). eventBus is a wash; props are trivially manageable |
| `whileInView` | Dedicated `IntersectionObserver` hook | SVG children inside a parent SVG may confuse `whileInView` root detection — see Pitfall 3 below |

## Architecture Patterns

### Recommended Project Structure (Phase 28 edits only)

```
app/src/
├── App.tsx                              # + onScroll on Outlet wrapper; pass isTopLevelScreen to BottomNavigation
├── components/
│   ├── BottomNavigation.tsx             # + slide-down y animation on isTopLevelScreen=false
│   ├── SwipeTabContainer.tsx            # + resize/visualViewport listener; harden useLayoutEffect
│   ├── ui/Header.tsx                    # + scroll-aware shadow (reads CSS var --header-scrolled)
│   └── trellis/
│       ├── TrellisCanvas.tsx            # + pointerEvents: 'auto' on leaf <g>; pass focusedAnchorId
│       ├── TrellisHero.tsx              # + focusedAnchorId prop-through
│       └── TrellisLeaf.tsx              # + shake variant + pulse animate + haptic + IO perf guard
├── screens/
│   ├── AskScreen.tsx                    # D-15 recent-questions polish + comment cleanup (line 234)
│   ├── GraphScreen.tsx                  # D-14 headerTitle → title key swap
│   └── PlannerScreen.tsx                # D-04 header styling; focusedAnchorId state; row tap plumbing
├── lib/
│   └── swipe-tab-logic.ts               # (optional) new pure helper `computeTargetX(index, width)` for unit test
└── locales/
    └── {en,zh,es,ja}.json               # D-14: update graph.headerTitle values
```

### Pattern 1: Resize-aware MotionValue re-snap (D-05)

**What:** Keep `stripX` coherent with current viewport width across keyboard open/close, device rotation, and browser-chrome collapse.

**When to use:** Any MotionValue that encodes a pixel offset derived from viewport dimensions.

**Example (recommended patch shape — NOT code to commit):**

```typescript
// SwipeTabContainer.tsx — after existing keyboard useEffect (~line 91)
useEffect(() => {
  const resync = () => {
    screenWidthRef.current = getScreenWidth();
    // Only re-snap if not mid-gesture — don't fight animate() or user drag
    if (!animatingRef.current && lockAxisRef.current !== 'x') {
      stripX.set(-(activeIndexRef.current * screenWidthRef.current));
    }
  };
  window.addEventListener('resize', resync);
  window.visualViewport?.addEventListener('resize', resync);
  return () => {
    window.removeEventListener('resize', resync);
    window.visualViewport?.removeEventListener('resize', resync);
  };
}, [stripX]);

// Harden route-sync useLayoutEffect (existing ~lines 95-105):
useLayoutEffect(() => {
  const idx = routes.indexOf(location.pathname);
  if (idx !== -1 && idx !== activeIndexRef.current) {
    activeIndexRef.current = idx;
    screenWidthRef.current = getScreenWidth(); // ← refresh before read
    if (!animatingRef.current) {
      stripX.set(-(idx * screenWidthRef.current));
    }
  }
  // Dev-only invariant
  if (import.meta.env.DEV && !animatingRef.current) {
    const expected = -(activeIndexRef.current * screenWidthRef.current);
    if (Math.abs(stripX.get() - expected) > 2) {
      console.warn('[SwipeTabContainer] stripX drift', { actual: stripX.get(), expected });
    }
  }
}, [location.pathname, routes, stripX]);
```

### Pattern 2: Slide-down nav animation (D-06)

**What:** Hide BottomNavigation on sub-screens without unmounting (tab color state preserved).

**When to use:** Fixed-position elements that should disappear smoothly without layout thrash.

**Plumbing:** `App.tsx` RootLayout already computes `isTopLevelScreen` at line 40. Pass as prop:

```typescript
<BottomNavigation isTopLevelScreen={isTopLevelScreen} ... />
```

Then in BottomNavigation.tsx, wrap `<nav>` in `<motion.nav>` with:
```typescript
animate={{ y: isTopLevelScreen ? 0 : 'calc(88px + var(--safe-area-bottom))' }}
transition={SPRING} // import from '../lib/swipe-tab-context' or duplicate locally
```

**Note:** The `SPRING` constant `{ stiffness: 300, damping: 30, mass: 0.8 }` currently lives *inside* SwipeTabContainer.tsx:38 as a module-local const, not exported. Planner should either (a) export it from `SwipeTabContainer` or (b) duplicate it in BottomNavigation. Option (b) avoids circular-import risk.

**Pitfall:** `transform: translateY()` on a `position:fixed` element does NOT move its origin-coordinate system. The element stays anchored to `bottom: 0`; only the visible content translates. Good — no layout shift.

**Sub-screen padding question:** `App.tsx:222` has `paddingBottom: 'calc(80px + var(--safe-area-bottom))'` on the Outlet wrapper. With nav hidden, this padding becomes visible blank space. **Recommendation:** leave it unchanged — the cost is ~80px of bottom padding that preserves visual stability (no content shift when nav appears/disappears on back-navigation). Shrinking it would cause content to jump. Planner confirms.

### Pattern 3: Scroll-aware Header shadow via CSS variable (D-07)

**What:** Header displays `boxShadow: var(--shadow-1)` when sub-screen content scrolled > 4px.

**Which container scrolls:** `App.tsx:223` sets `overflow: 'auto'` on the sub-screen Outlet wrapper. `PostDetailScreen`, `AnchorDetailScreen`, `ClusterDetailScreen`, `QuestionDetailScreen` all rely on the wrapper's scroll — they render tall content and let the parent scroll. Confirmed by greping for `overflow.*auto` in each sub-screen: none set their own. So attach `onScroll` to the wrapper itself — one location, all sub-screens covered.

**Recommended approach (CSS variable — CONTEXT specifics):**

```typescript
// App.tsx Outlet wrapper — add state + handler
const [headerScrolled, setHeaderScrolled] = useState(0);
// on the wrapper div:
onScroll={(e) => {
  const scrolled = e.currentTarget.scrollTop > 4 ? 1 : 0;
  if (scrolled !== headerScrolled) setHeaderScrolled(scrolled);
}}
style={{ ..., '--header-scrolled': headerScrolled } as React.CSSProperties}
```

Then in `Header.tsx`:
```typescript
boxShadow: 'calc(var(--header-scrolled, 0) * 1) * var(--shadow-1)'  // invalid CSS, see below
```

**Correction:** CSS `calc()` cannot multiply `box-shadow` values. Two practical paths:

1. **Dual-value approach (cleaner):** Pass `scrolled` via React prop, read it, and switch:
   ```typescript
   boxShadow: scrolled ? 'var(--shadow-1)' : 'none'
   ```
2. **CSS var switching:** Define `--header-box-shadow: none` by default; override via `[style*="--header-scrolled: 1"] h1-parent { --header-box-shadow: var(--shadow-1); }` — messy.

**Recommendation:** React prop is cleaner than CSS var. The "avoid React context" goal in CONTEXT was avoidance of *context*, not *state* — prop from App.tsx → Header is one hop. Planner picks.

### Pattern 4: Trellis shake + pulse variants (D-10/D-12)

**What:** Tap-to-shake (any state) and pulse-on-focus (when focused prop true) on `TrellisLeaf`.

**Composing with existing ambient sway:** Current `motion.g` at TrellisLeaf.tsx:516 uses `animate={{ scale, opacity, rotate: [rotation, +3, -3, rotation] }}` with `transition.rotate: { duration: 3, repeat: Infinity }`. Adding shake/pulse while ambient sway is running requires either:

- **Variants + controls:** Use `useAnimationControls()` and call `.start({ rotate: [0, 4, -4, 2, 0], transition: { duration: 0.3 } })` on tap. The animation library will queue over ambient sway.
- **Discrete motion.g wrappers:** Nest a second `<motion.g>` that carries shake/pulse while the outer carries ambient sway. Cleaner separation of concerns.

**Recommendation:** Nest. Outer `motion.g` handles ambient sway (current behavior). Inner `motion.g` handles tap-driven shake + pulse + glow:

```typescript
<motion.g animate={{ rotate: ambientRotations }}>      {/* existing ambient sway */}
  <motion.g
    animate={shakeTrigger ? { rotate: [0, 4, -4, 2, 0] } : undefined}
    transition={{ duration: 0.3 }}
  >
    <motion.g
      animate={focused ? { scale: [1, 1.15, 1], filter: [...] } : { scale: 1, filter: 'none' }}
      transition={{ duration: 0.6 }}
    >
      {shape}
    </motion.g>
  </motion.g>
</motion.g>
```

**Tap handler:** SVG `<g>` accepts `onClick` / `onPointerDown` when `pointerEvents: 'auto'`. Currently `TrellisCanvas.tsx:32` sets `pointerEvents: 'none'` on the SVG root for entire canvas. Two options:

- Set `pointerEvents: 'auto'` on the leaves group `<g>` at TrellisCanvas.tsx:68 — keeps vines/stems non-interactive.
- Or set `pointerEvents: 'auto'` on each individual leaf `<g>` wrapper inside `TrellisLeaf`.

**Recommendation:** Set on individual leaves — more explicit and avoids accidentally intercepting taps that shouldn't hit the leaves group.

### Pattern 5: Pulse-on-focus plumbing (D-12)

**Current TrellisHero signature (`TrellisHero.tsx`):** No props — it sources `layout` from `useTrellisData()` internally. To plumb `focusedAnchorId`:

**Option A (props):** Add `focusedAnchorId?: string` to TrellisHero → pass to TrellisCanvas → pass to TrellisLeaf.

**Option B (eventBus):** `TrellisLeaf` subscribes to `SUGGESTED_MOVE_FOCUSED`. Each leaf checks payload.anchorId against its own. Self-clearing via setTimeout(fade, 2000).

**Analysis:**
- **Option A:** 3-level prop drill (PlannerScreen state → TrellisHero prop → TrellisCanvas prop → TrellisLeaf prop). Slightly verbose but transparent.
- **Option B:** No prop plumbing; TrellisLeaf owns its own pulse state. Adds a new AppEvent type. 30+ leaves each subscribe and pattern-match payload — slight overhead but eventBus is cheap.

**Recommendation:** Option A. Prop drilling 3 levels is minimal and makes the data flow obvious. The performance argument is moot — either way React re-renders on focus change. Phase 25/26 patterns lean prop-first; stick with it.

**PlannerScreen row-tap integration:** Currently at PlannerScreen.tsx:176 (dead) and :224 (dying), the onClick directly calls `handleReplant(node)` or `handleHeal(node)` which *immediately* navigates away. There's no intermediate step for the pulse to animate. For pulse-on-focus to be visible, the planner has two options:

1. **Emit focus on `onPointerDown`** (before nav), then navigate on `onClick`. ~100ms pulse-visible window on commit.
2. **Delay navigation by ~400ms** via setTimeout after emitting focus. Risks feeling laggy.
3. **Re-interpret decision:** pulse isn't visible on action-commit rows; only applies to a hypothetical "preview-then-act" UI. Since current design is single-tap, this may be vestigial.

**Recommendation:** Option 1 — emit `focusedAnchorId` on pointerDown of the row. User sees a brief pulse while release+navigate happen. Cleanest UX. D-12's "clears on action" wording fits this — the leaf pulses, user action fires, screen transitions.

### Pattern 6: Viewport perf guard (D-13)

**Framer Motion `whileInView` on SVG children:** `whileInView` uses IntersectionObserver under the hood. **IntersectionObserver requires a DOM element — SVG `<g>` elements work, but only when treated as SVGGraphicsElement with measurable bounding boxes.** Modern browsers (Chrome 58+, Safari 12.1+, Capacitor WebViews) support this. The caveat: IntersectionObserver `root` option expects a block-level Element; pass `null` (viewport) or a containing `<div>` (not the SVG itself).

**Recommended approach:**

```typescript
// TrellisLeaf.tsx — wrap the animate motion.g
const shakeRef = useRef<SVGGElement>(null);
const inView = useInView(shakeRef, { once: false, margin: '0px' });
// Skip shake/pulse when !inView AND layout.nodes.length > 30
```

Or, more idiomatic for Framer:
```typescript
<motion.g whileInView={{ /* no-op */ }} viewport={{ once: false }} ref={...}>
```

However, since the perf guard is not per-leaf but per-canvas, a simpler option exists: `TrellisCanvas` measures `layout.nodes.length`; if > 30, pass `perfGuard={true}` to each leaf, which short-circuits the shake/pulse animation to a no-op. This matches Phase 25 D-55's "reduce ambient animation complexity" pattern (already implemented in TrellisCanvas.tsx:13-24 as `AMBIENT_SWAY_THRESHOLD = 20`).

**Recommendation:** Follow Phase 25's existing pattern. Add a second threshold `TAP_ANIMATION_THRESHOLD = 30` and a `leafSwayMask`-like function that determines which leaves get full-fidelity animations. If really needed, layer IntersectionObserver on top for off-screen leaves; in a 30–50 anchor case, even all-on-screen is acceptable.

### Pattern 7: i18n key swap (D-14)

**Current state (verified on 2026-04-16):**
- `GraphScreen.tsx:522` renders `<Header title={t('graph.headerTitle')} />`.
- `en.json:194-195`: `"title": "Knowledge Graph", "headerTitle": "Mind Map"` — both keys exist; `title` already says "Knowledge Graph" but is not rendered.
- `zh.json:195`: `"headerTitle": "脑图"` (still "Mind Map")
- `es.json:195`: `"headerTitle": "Mapa mental"`
- `ja.json:195`: `"headerTitle": "マインドマップ"`

**Two valid fix paths:**

1. **Swap `headerTitle` values:** Change all 4 bundles' `graph.headerTitle` from "Mind Map" / 脑图 / Mapa mental / マインドマップ → "Knowledge Graph" / 知识图谱 / Grafo de conocimiento / ナレッジグラフ. One value per bundle. Code unchanged. Simplest.
2. **Swap key:** Change `GraphScreen.tsx:522` to `t('graph.title')`. `title` already says "Knowledge Graph" in en.json. Add `graph.title` to zh/es/ja (currently only in en.json). Delete `graph.headerTitle` from all 4 bundles.

**Recommendation:** Path 1 (swap values). Path 2 risks a compile/runtime error if `graph.title` isn't mirrored in zh/es/ja (bundle-parity test will catch, but extra churn). Path 1 is a 4-line diff in 4 files. The CONTEXT suggested translations map directly:
- en: "Knowledge Graph"
- zh: "知识图谱"
- es: "Grafo de conocimiento"
- ja: "ナレッジグラフ"

**Verification after edit:** `node --test tests/locales/bundle-parity.test.mjs` and visual confirmation at `/graph`.

**Comment cleanup:** `AskScreen.tsx:234` has comment `// feed into Mind Map, Review, and Podcast surfaces.` — D-14 specifies updating this for grep hygiene. One-line change.

### Anti-Patterns to Avoid

- **New hardcoded English strings** — D-24 forbids. Any new user-visible string (e.g., AskScreen empty-state "No recent questions yet…") MUST go through `t()` with an entry in all 4 bundles.
- **Tailwind utility classes** — D-21 forbids. Use inline styles + CSS variables.
- **Mutating `screenWidthRef.current` from inside a `useTransform` reader** — the reader runs every frame; side effects cause render loops.
- **`position: fixed` with `transform` that includes non-zero `translateZ`** — creates a containing block for descendants and can break `position:fixed` inside. SwipeTabContainer.tsx:207 already uses `translateZ(0)` intentionally; don't propagate to new elements carelessly.
- **Forgetting to remove `visualViewport` listener** — causes memory leak on hot-reload. Match the effect cleanup function pattern shown above.
- **Running shake/pulse on all 50+ leaves simultaneously on Capacitor** — GPU thrash on mid-tier Android. Respect perf guard.
- **Translating proper nouns** — "Knowledge Graph" is acceptable (common term); but never translate "EchoLearn", "OpenAI", "Claude", etc. (per CLAUDE.md allowlist).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Viewport resize detection | Manual `setInterval` polling for `window.innerWidth` | `window.addEventListener('resize')` + `visualViewport.addEventListener('resize')` | Native events fire immediately on keyboard/rotate/chrome-collapse; polling misses events or wastes cycles |
| Spring animation for nav | `setTimeout` chain with CSS transitions | Framer `animate()` + `SPRING` constant | Native spring physics; already tuned in SwipeTabContainer; no easing-curve guesswork |
| IntersectionObserver wiring | Manual `IntersectionObserver` constructor with cleanup | Framer `useInView()` hook | Handles cleanup, supports SSR, works on SVG children |
| Locale-aware strings | Conditional `if (locale === 'zh') return '脑图' else …` | `t('graph.headerTitle')` | Phase 27 scaffold already done; adding conditionals re-invents the wheel |
| Shake keyframes | CSS `@keyframes shake` | Framer variants | D-22 locks Framer; one animation engine in the app |
| Chip press feedback | New CSS class with `:active` rules | `className="active-squish"` | Already in index.css:336-342, already in use in 12+ components |

**Key insight:** Every technical primitive needed for Phase 28 already exists in the codebase. The phase is pure composition, not invention.

## Runtime State Inventory

> Phase 28 is UI polish, not rename/refactor/migration. One minor i18n value edit (D-14) is the only data-like change, and it's dev-time only with no runtime state implications.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no localStorage/sessionStorage/ChromaDB/Mem0 state touched by any decision. `trellis_fruit_credits` localStorage key is unaffected. | None |
| Live service config | None — no n8n / Datadog / Cloudflare / Tailscale dependency. | None |
| OS-registered state | None — no Windows Task Scheduler / pm2 / launchd / systemd references. Native iOS/Android haptic use via `@capacitor/haptics` is a library API call, not OS registration. | None |
| Secrets and env vars | None — no new API keys, env vars, or SOPS references introduced. | None |
| Build artifacts / installed packages | None — no package.json changes, no new build scripts, no regenerated egg-info / compiled outputs. | None |

**Summary:** Phase 28 is stateless from a runtime-inventory perspective. After the PR lands, no caches, registries, or secrets need re-sync. The only "persistence" impact is the 4 locale bundle files (dev-time source, shipped in bundle, cached by browser with content-hash — automatic invalidation on deploy).

## Environment Availability

> Phase 28 is a code/config-only polish pass. No new external tools, runtimes, or services beyond those already required by the project.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runtime (`node --test`) | ✓ (Node 25 per STATE.md) | 25.x | — |
| npm | Dev server, build | ✓ | — | — |
| Chrome | Manual UAT per D-25 | Assumed ✓ on dev machine | — | Any evergreen browser |
| Capacitor iOS/Android (optional) | Native haptic validation | Not required for Wave 0; gate on physical device test in UAT | 8.x | Web platform is no-op per haptics.ts — tests pass without native |
| Framer Motion | D-10/D-12/D-06 animations | ✓ (existing) | 12.x | — |
| react-i18next | D-14 | ✓ (Phase 27) | 17.0.3 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

Phase 28 is fully executable in the current environment.

## Common Pitfalls

### Pitfall 1: Stale `screenWidthRef` during useTransform read (D-05)

**What goes wrong:** `useTransform` at SwipeTabContainer.tsx:71 reads `screenWidthRef.current` every animation frame. If a keyboard opens and width shrinks, but `screenWidthRef` wasn't refreshed, `swipeProgress` computes the wrong fractional index, and BottomNavigation's color interpolation jumps.

**Why it happens:** `screenWidthRef` is only updated inside `onPanStart` (line 115). Any non-gesture viewport change leaves it stale.

**How to avoid:** Resize listener (see Pattern 1). Also verify `swipeProgress` recomputes after the listener fires — MotionValue dependencies will re-derive on next read, but only if a read is triggered (e.g., next render). Forcing a `stripX.set(...)` in the resize handler triggers swipeProgress re-evaluation.

**Warning signs:** BottomNavigation active-tab color "snaps" during rotation or keyboard show. `stripX.get()` ≠ `-(activeIndexRef.current * window.innerWidth)` after any viewport change.

### Pitfall 2: onPan gesture fires with stale width after keyboard open

**What goes wrong:** User opens keyboard → width shrinks. User starts swipe — `onPanStart` refreshes `screenWidthRef` (line 115), good. But the threshold calc in `resolveCommitIndex` (line 144) uses the fresh `sw`, while any prior frame used stale width.

**Why it happens:** `onPan` runs at 60fps; one-time `onPanStart` refresh is enough IF `onPanStart` fires first. The framer-motion `onPanStart` always fires before `onPan`, so this is safe in practice — **but ONLY if the user releases and re-grabs.** If user's finger is already down when keyboard appears (rare but possible), onPanStart already fired with stale width.

**How to avoid:** Add resize-listener fix from Pattern 1; it covers the "finger already down" edge case by re-syncing while gesture is active is tricky — actually, the recommendation explicitly skips re-snap if `lockAxisRef.current === 'x'` (mid-gesture). Document this tradeoff: during an active horizontal gesture, keyboard state changes are ignored to avoid yanking the gesture mid-flight. Acceptable per UX.

**Warning signs:** Very rare; unlikely to surface in Chrome-desktop UAT.

### Pitfall 3: IntersectionObserver root on SVG fails silently

**What goes wrong:** `useInView(ref, { root: svgElement })` returns `true` for all children because SVGSVGElement isn't a valid IntersectionObserver root in all browsers.

**Why it happens:** Spec requires root to be a Document or Element with `overflow` → `SVG` elements don't have CSS `overflow` semantics the same way.

**How to avoid:** Use `root: null` (viewport) or a containing `<div>` (the TrellisHero outer div at TrellisHero.tsx:17). If a containing div is used, ensure it has `overflow: hidden` (already set via `borderRadius: 'var(--radius-xl)'` plus default block behavior at TrellisHero.tsx:24).

**Warning signs:** All leaves animate (no perf guard benefit). Profile shows 60fps+ CPU on Planner with 50 leaves.

### Pitfall 4: Nested `motion.g` re-mount on prop change

**What goes wrong:** Adding a new inner `<motion.g>` wrapper around existing leaf content may cause React to treat it as a new mount, resetting animation state every render.

**Why it happens:** React reconciles by element type + key. New wrapper without a stable key causes re-mount.

**How to avoid:** No key on the new `motion.g` (it's not in a list). Ensure the component memoizes props that haven't changed (`React.memo(TrellisLeaf)` if necessary — already looks lean, prob not needed).

**Warning signs:** Ambient sway resets every time `focused` changes. User taps Suggested Moves row → all leaves flicker.

### Pitfall 5: Scroll event throttling misses the 4px threshold

**What goes wrong:** `onScroll` fires at browser's discretion. On iOS momentum scroll, events may fire every 100ms+. User scrolls fast past 4px — handler receives `scrollTop: 50`, sets `scrolled: 1` — fine. But in slow scroll, fires at 3, 5, 6, 4, 3 — toggles rapidly.

**Why it happens:** Raw `onScroll` without debounce.

**How to avoid:** The 4px threshold has natural hysteresis: below 4 → 0, above 4 → 1. Rapid toggle happens only near threshold boundary. Acceptable in practice; avoid debouncing (introduces lag). If visual flicker observed, raise threshold to 8px or add 2px hysteresis band.

**Warning signs:** Header shadow flickering during momentum scroll near top. Unlikely with threshold = 4px.

### Pitfall 6: Nav slide-down + safe-area-bottom sum

**What goes wrong:** `translateY(88px + var(--safe-area-bottom))` — if `--safe-area-bottom` is defined as `env(safe-area-inset-bottom)`, on iOS with home indicator it's ~34px, web it's `0px`. Expected max translate = 122px. If nav's visible height differs from 88px (current ~64px content + 16px pad + safe-area), visually odd.

**Why it happens:** Magic number 88px estimate vs. actual fixed-element height.

**How to avoid:** Measure `nav.offsetHeight` or set explicit `height: 88px`. Current nav's computed height = `8px padding-top + 64px content + calc(8px + safe-area-bottom) padding-bottom + 1px border-top = 81px + safe-area-bottom`. So `translateY('calc(100% + 4px)')` is cleaner than a magic number — `100%` reads the nav's own height.

**Recommendation to planner:** Use `translateY('100%')` for the hidden state — mathematically correct for any height, survives safe-area changes, no magic numbers.

**Warning signs:** Nav's top edge peeks above screen bottom after slide-down; or nav hides too aggressively (cuts off part of safe area).

### Pitfall 7: i18n bundle-parity test fails on a new key with English-only value

**What goes wrong:** Developer adds `graph.title = "Knowledge Graph"` to `en.json` only. `bundle-parity.test.mjs` (at `app/tests/locales/`) compares key sets and fails.

**Why it happens:** CLAUDE.md rule: every new key in all 4 bundles in the SAME PR.

**How to avoid:** For D-14, we're editing existing keys (`graph.headerTitle` values), so parity is preserved. For D-15 (new empty-state copy), the new key MUST land in all 4 bundles.

**Warning signs:** CI / test failure with diff of key sets. `react-i18next` fallback renders English at runtime (invisible to user), but test blocks merge.

## Code Examples

### Example 1: Resize re-sync (D-05)

```typescript
// app/src/components/SwipeTabContainer.tsx — NEW useEffect after line 91
// Source: Pattern 1 above; based on visualViewport MDN docs + Framer Motion v12 useMotionValue semantics
useEffect(() => {
  const resync = () => {
    screenWidthRef.current = getScreenWidth();
    const midGesture = lockAxisRef.current === 'x';
    if (!animatingRef.current && !midGesture) {
      stripX.set(-(activeIndexRef.current * screenWidthRef.current));
    }
  };
  window.addEventListener('resize', resync);
  window.visualViewport?.addEventListener('resize', resync);
  return () => {
    window.removeEventListener('resize', resync);
    window.visualViewport?.removeEventListener('resize', resync);
  };
}, [stripX]);
```

### Example 2: Leaf shake with nested motion.g (D-10)

```typescript
// app/src/components/trellis/TrellisLeaf.tsx — new inner wrapper around `{shape}`
// Source: Pattern 4 + Framer Motion useAnimationControls docs
const controls = useAnimationControls();
const handleTap = () => {
  void hapticImpactLight();
  void controls.start({
    rotate: [0, 4, -4, 2, 0],
    transition: { duration: 0.3, ease: 'easeInOut' },
  });
};

// inside the render, inside the existing outer motion.g:
<motion.g
  onClick={handleTap}
  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
  animate={controls}
>
  {shape}
</motion.g>
```

### Example 3: Pulse-on-focus (D-12)

```typescript
// app/src/components/trellis/TrellisLeaf.tsx — prop + inner variant
interface TrellisLeafProps {
  // ...existing props
  focused?: boolean;
}

// inside render:
<motion.g
  animate={focused
    ? { scale: [1, 1.15, 1], filter: ['drop-shadow(0 0 0px transparent)', 'drop-shadow(0 0 8px var(--primary-40))', 'drop-shadow(0 0 0px transparent)'] }
    : { scale: 1, filter: 'drop-shadow(0 0 0px transparent)' }
  }
  transition={{ duration: focused ? 0.6 : 0, repeat: 0 }}
>
```

### Example 4: Nav slide-down (D-06)

```typescript
// app/src/components/BottomNavigation.tsx — wrap existing <nav> as motion.nav
import { motion } from 'framer-motion';

const SLIDE_SPRING = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 };

// ...
return (
  <motion.nav
    id="bottom-navigation"
    animate={{ y: isTopLevelScreen ? 0 : '100%' }}
    transition={SLIDE_SPRING}
    style={{ ...existing fixed-position styles... }}
  >
    {/* existing content */}
  </motion.nav>
);
```

### Example 5: AskScreen recent-question row (D-15)

```typescript
// app/src/screens/AskScreen.tsx — replace lines 601-632 content
{questions.slice(0, 3).map((q) => (
  <button
    key={q.id}
    onClick={() => navigate(`/ask/${q.id}`)}
    className="active-squish"  // D-16 applies here too
    style={{
      textAlign: 'left',
      padding: '11px 16px',
      borderRadius: '18px',
      border: '1.5px solid var(--border)',
      backgroundColor: 'var(--card)',
      color: 'var(--foreground)',
      fontSize: '0.875rem',
      cursor: 'pointer',
      lineHeight: 1.4,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
    }}
  >
    <span style={{
      fontWeight: 500,
      overflow: 'hidden',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      flex: 1,
      minWidth: 0,
    }}>
      {q.content}  {/* bullet removed */}
    </span>
    <span style={{ fontSize: '1.2rem', color: 'var(--muted-foreground)', flexShrink: 0 }}>→</span>
  </button>
))}

// Empty state (NEW — needs new i18n key in all 4 bundles):
{questions.length === 0 && (
  <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', paddingLeft: '4px' }}>
    {t('ask.recentQuestionsEmpty')}  {/* "No recent questions yet — ask your first one below." */}
  </p>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Animated multi-tab jump on BottomNavigation tap | Instant `stripX.set()` snap (reverted 2026-04-15) | Phase 22 post-release | D-06 nav slide-down is orthogonal; doesn't affect tab-tap snap |
| Runtime LLM translation for UI | Static bundles + dev-time Sonnet subagent | Phase 27 (complete) | D-14 and any new strings MUST follow this — no exceptions |
| `useEffect` for pre-paint DOM sync | `useLayoutEffect` (already in SwipeTabContainer) | Phase 22 | Pattern 1's resync should use `useEffect` (no layout-sync need); route sync stays `useLayoutEffect` |
| Sub-screen lazy-loading | All 5 first-level screens eagerly mounted | Phase 22 D-11/D-12 | Nav hide must NOT unmount — slide-down only |

**Deprecated/outdated:**
- `usePlanner` hook (PlannerScreen.tsx): marked `@deprecated` per STATE.md Phase 26-04. Don't add new code paths through it.
- `Trellis Dev Mode default state` audit note: withdrawn per D-02.

## Open Questions

1. **Should BottomNavigation also hide during the swipe-strip's initial load flash?**
   - What we know: `isTopLevelScreen` is computed from `location.pathname`; during app boot before route sync, `location.pathname` might be `/` briefly, causing `isTopLevelScreen=false` momentarily.
   - What's unclear: Does the nav slide-down animate on first mount?
   - Recommendation: Planner adds `initial={{ y: 0 }}` on `motion.nav` to suppress first-mount animation; only animate on subsequent `animate` prop changes.

2. **Does the D-12 pulse-on-focus need a "clear" signal from PlannerScreen to the leaf?**
   - What we know: CONTEXT says "pulse clears on action, fades on navigate away."
   - What's unclear: Whether PlannerScreen tracks `focusedAnchorId` as ephemeral (cleared on row click after 300ms) or sticky (cleared by parent unmount).
   - Recommendation: `focusedAnchorId` in PlannerScreen state; set on row pointerDown, cleared via `setTimeout(() => setFocusedAnchorId(null), 2000)` to match glow duration. If row click triggers navigation before timeout, component unmounts and state is gone anyway.

3. **D-13 perf guard threshold — keep at 30 or match Phase 25's 20?**
   - What we know: Phase 25 uses 20-leaf threshold for ambient sway reduction. CONTEXT says 30 for tap animations.
   - What's unclear: Whether 30 is the right threshold for shake/pulse specifically or if unification is preferred.
   - Recommendation: Keep 30 per CONTEXT — shake/pulse are triggered events (not continuous like ambient sway), so higher threshold is acceptable. But planner should document both thresholds side-by-side.

4. **Does the D-07 scroll-aware shadow need to reset when sub-screen unmounts?**
   - What we know: Outlet wrapper is conditionally rendered — React unmounts it when returning to top-level. State resets to 0 automatically.
   - What's unclear: Does scroll position persist across sub-screen navigations within the same session?
   - Recommendation: Not an issue — each sub-screen's Outlet render is fresh. Header starts unshadowed, scroll event fires shadow as needed. Move on.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` + esbuild tsx loader (via `tests/components/_trellis-tsx-loader.mjs`) |
| Config file | Per-test-file; pattern: `import.meta.resolve` + esbuild register |
| Quick run command | `cd app && node --test tests/locales/bundle-parity.test.mjs` |
| Full suite command | `cd app && npm test` |
| Pre-existing suite size | 40+ Wave 0 tests (per Phase 27 Plan 07); 48+ after Phase 27-04 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-05-LOGIC | `computeTargetX(index, width)` pure helper returns `-index * width` | unit | `node --test tests/lib/swipe-tab-logic.test.mjs` (existing; may need new case) | ✅ existing file (Phase 22); add case |
| D-05-INTEGRATION | `stripX` updates on simulated `resize` event | integration | N/A — requires DOM + MotionValue; manual UAT only | ❌ Manual |
| D-06-LOGIC | Nav `y` target derivable from `isTopLevelScreen` (pure bool→string) | unit | new `tests/components/BottomNavigation.slide.test.mjs` | ❌ Wave 0 |
| D-07-LOGIC | `scrollTop > 4` predicate yields correct boolean | unit | inline pure helper or skip (trivial) | — |
| D-10-LOGIC | Leaf variant map returns correct rotate array for 'shake' | unit | new `tests/components/TrellisLeaf.shake.test.mjs` | ❌ Wave 0 |
| D-11 | `hapticImpactLight` invoked on leaf tap | behavioral | mock `@capacitor/haptics` import; assert called | ❌ Wave 0 (optional — trivial consumer) |
| D-12-LOGIC | `focusedAnchorId === leaf.anchor.id` → `focused={true}` prop | unit | new `tests/components/TrellisCanvas.focus.test.mjs` | ❌ Wave 0 |
| D-13-LOGIC | `leafAnimationMask(count, index)` returns `true` only when count ≤ 30 OR in-view | unit | new `tests/services/trellis-perf-mask.test.mjs` | ❌ Wave 0 |
| D-14-BUNDLE | `graph.headerTitle` value equals expected per locale | unit | extend existing `bundle-parity.test.mjs` with value assertion | ✅ existing; add values test |
| D-14-RUNTIME | GraphScreen Header title matches `t('graph.headerTitle')` | manual | Open `/graph` in each locale, screenshot | ❌ Manual UAT |
| D-15-LOGIC | Empty-state path triggers when `questions.length === 0` | unit | assert `questions.slice(0,3)` empty state rendered | ❌ Wave 0 (small) |
| D-15-RUNTIME | Row tap navigates to `/ask/:id` | manual + integration | manual UAT; optional testing-library test | ❌ Manual |
| D-16 | `active-squish` class applied to chip | unit | DOM assertion on rendered output | ❌ Wave 0 (small) |

### Sampling Rate

- **Per task commit:** `cd app && node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` (quick — <1s)
- **Per wave merge:** `cd app && npm test` (full Wave 0 + phase-specific tests)
- **Phase gate:** Full suite green + `npx vite build` green + manual UAT checklist per D-03/D-25 before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `app/tests/lib/swipe-tab-logic.test.mjs` — extend with resize-handler `computeTargetX` case (file exists; add assertion)
- [ ] `app/tests/components/TrellisLeaf.shake.test.mjs` — assert shake variant rotate array exported/computable (Wave 0 skeleton + live case)
- [ ] `app/tests/components/TrellisCanvas.focus.test.mjs` — assert focused prop propagation given `focusedAnchorId`
- [ ] `app/tests/components/BottomNavigation.slide.test.mjs` — assert y-target derivation
- [ ] Extend `app/tests/locales/bundle-parity.test.mjs` — add value-level assertion for `graph.headerTitle` in each locale (currently only key-set parity)
- [ ] No framework install needed — `node --test` + esbuild tsx loader already in use

**Manual UAT (not automatable — matches audit report ritual):**

- Navigate to /planner → swipe to Home → swipe to Ask (keyboard open) → swipe back. Verify `stripX` ≠ stale after each transition.
- Open Chrome DevTools Device Toolbar → toggle between 375px and 768px viewports on /planner → verify no strip drift.
- Navigate to /posts/:id → confirm nav slides down, header grows shadow on scroll, back button re-shows nav smoothly.
- Tap each leaf on trellis → confirm shake (300ms) + haptic (feels on device; silent on web).
- Tap a Suggested Move row → confirm corresponding leaf pulses briefly before navigation commits.
- Tap Graph tab → header reads "Knowledge Graph" in current locale (verify all 4 via Settings locale switcher).
- Tap a recent question on AskScreen → navigates to QuestionDetail; 2-line ellipsis on long questions verified.
- Chip press shows 0.96 scale squish.

## Sources

### Primary (HIGH confidence)

- `app/src/App.tsx` — Directly inspected. RootLayout structure, isTopLevelScreen at line 40, Outlet wrapper at lines 212-227.
- `app/src/components/SwipeTabContainer.tsx` — Directly inspected. screenWidthRef capture sites at lines 49, 115 (only refresh). stripX init at line 68. useTransform at line 71.
- `app/src/components/BottomNavigation.tsx` — Directly inspected. Already has `borderTop: '1px solid var(--border)'` at line 147.
- `app/src/components/ui/Header.tsx` — Directly inspected. Fixed position, `zIndex: 190`, opaque bg at line 33-34. Ready for scroll shadow injection.
- `app/src/components/trellis/TrellisLeaf.tsx` — Directly inspected. Existing motion.g at line 516. No current onClick. Ready for nested wrapper.
- `app/src/components/trellis/TrellisCanvas.tsx` — Directly inspected. `pointerEvents: 'none'` at line 32 (important — must change). Leaves iterated in `<g>` at line 68.
- `app/src/components/trellis/TrellisHero.tsx` — Directly inspected. No current props (self-sources layout from hook).
- `app/src/screens/PlannerScreen.tsx` — Directly inspected. Section header already exists at line 130 with `t('planner.suggestedMoves')`. Row taps at lines 176, 224. Prune buttons with stopPropagation at lines 200, 248.
- `app/src/screens/GraphScreen.tsx` — Directly inspected. Line 522 renders `t('graph.headerTitle')`.
- `app/src/screens/AskScreen.tsx` — Directly inspected. Line 629: `• {q.content}` hardcoded bullet. Line 234: "Mind Map" in comment. Rows already in `<button>` wrappers.
- `app/src/locales/en.json` — Lines 194-195 confirm `graph.title` = "Knowledge Graph" exists, `graph.headerTitle` = "Mind Map" is the rendered value.
- `app/src/lib/haptics.ts` — Directly inspected. `hapticImpactLight` no-ops on web.
- `app/src/lib/swipe-tab-context.ts` — Directly inspected. `SwipeTabContextValue` currently exposes `swipeProgress` + `navigateToTab` only.
- `app/src/index.css` — Directly inspected. `--border` exists, `--outline-variant` does NOT. `.active-squish` defined lines 336-342 with `scale(0.96)`.
- `.planning/phases/28-ui-ux-polish-from-audit-findings/28-CONTEXT.md` — Primary decisions source.
- `.planning/STATE.md` — Phase 27 completion confirmed (all 7 plans, 40 Wave 0 tests green, 602 en keys in all 4 bundles).
- `CLAUDE.md` — Project-root i18n rules + EN-first workflow + proper-noun allowlist.
- `.planning/milestones/v1.3-phases/22-*/22-CONTEXT.md` — Phase 22 decisions D-11 (always-mounted), D-16 (spring duration).
- `.planning/milestones/v1.3-phases/25-*/25-CONTEXT.md` — Phase 25 D-55 perf guard convention (sway subset).
- `.planning/milestones/v1.3-phases/27-*/27-CONTEXT.md` — Phase 27 D-08 Sonnet subagent workflow.

### Secondary (MEDIUM confidence)

- Framer Motion v12 `useTransform` semantics — inferred from existing code + docs cached knowledge; Context7 not consulted because project version is locked.
- `window.visualViewport` API — MDN documents `visualViewport.addEventListener('resize')` as stable since Chrome 61 / Safari 13; usage pattern verified in SwipeTabContainer-adjacent code.
- IntersectionObserver root-element support on SVG — documented behavior across browsers; inferred from Framer Motion `useInView` hook source not consulted directly but well-known.

### Tertiary (LOW confidence — flagged for validation)

- **Exact spring tuning for nav slide-down:** CONTEXT allows Claude's discretion. Recommend reusing existing SPRING `{ stiffness: 300, damping: 30, mass: 0.8 }` — tune only if feel is off on first UAT.
- **D-13 perf-guard threshold of 30 leaves:** CONTEXT asserts 30 vs. Phase 25's 20 — untested empirically on target Capacitor devices. Planner should validate on physical Android device before locking.
- **Whether IntersectionObserver adds meaningful perf benefit at 30 leaves:** Skipped measurement — at 30 leaves, full-fidelity animation may be acceptable. Planner may opt out of IO complexity and just gate on count.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs already in production, no new deps.
- Architecture: HIGH — all integration points directly verified in source.
- Pitfalls: MEDIUM-HIGH — most derived from direct code inspection; Pitfall 3 (IntersectionObserver on SVG) is well-documented but the *specific* Framer `useInView` ref type behavior is LOW-confidence; planner should prototype.
- i18n: HIGH — Phase 27 complete per STATE.md; bundle-parity test enforces correctness.

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days) — stable polish phase, no fast-moving upstream deps.

**Resolved prompt questions (summary):**

1. **D-05 root cause:** Confirmed + refined. Stale `screenWidthRef` has TWO stale-read sites (useTransform + useLayoutEffect), not one. Patch in Pattern 1.
2. **D-06 plumbing:** Prop from App.tsx → BottomNavigation is cleanest. Use `y: '100%'` not magic 88px. Sub-screen padding unchanged.
3. **D-04 header:** Already exists at PlannerScreen.tsx:130. Finding is likely styling tweak (low margin, small text) — planner clarifies.
4. **D-07 scroll shadow:** Outlet wrapper at App.tsx:223 is sole scroll container for all sub-screens. React prop cleaner than CSS var (calc multiplication limitation).
5. **D-08 border:** Already present at BottomNavigation.tsx:147 (`1px solid var(--border)`). May be no-op.
6. **D-10 shake variant:** Nest new motion.g inside existing ambient-sway motion.g. Use `useAnimationControls`.
7. **D-12 focus plumbing:** Prop-through (3 levels). Emit focus on pointerDown of row, before nav.
8. **D-13 perf guard:** Follow Phase 25 pattern (count threshold), IO optional.
9. **D-14 i18n:** `graph.headerTitle` is the rendered key; swap values in 4 bundles. `graph.title` already exists in en.json only.
10. **D-15 AskScreen:** Row already in `<button>` wrapper. Remove `• ` prefix at line 629. Add empty-state key to 4 bundles.
11. **D-16 chip squish:** `active-squish` class exists and ready. Apply to PortalCard chips (already applied to `active-squish` there) — planner confirms scope.
12. **Phase 27 completion:** Confirmed complete; 40/40 Wave 0 tests green; all 4 bundles at 90%+ coverage.
13. **Capacitor perf:** No known Framer gotchas in codebase. `translateZ(0)` trick already in use (SwipeTabContainer.tsx:207). Continue pattern.
14. **Test coverage:** Pure-logic helpers (resize target, shake variant array, focus-match predicate) → `node --test`. Visual/animation → manual UAT.
15. **Validation Architecture:** Table above; 5 Wave 0 test files to add, 1 existing to extend.
