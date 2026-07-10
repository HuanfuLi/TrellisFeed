# Phase 22: Swipe Navigation Between First-Level Screens - Research

**Researched:** 2026-04-07
**Domain:** Framer Motion v12 gesture handling, React router-dom v7, always-mounted component architecture
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All 5 screens participate in the swipe sequence: Home → Planner → Ask → Graph → Settings (matches bottom nav layout 1:1)
- **D-02:** Swipe navigation is disabled on sub-screens (Review, Podcast, PostDetail, AnchorDetail, ClusterDetail, QuestionDetail). User must be on a top-level screen to swipe.
- **D-03:** Bottom nav highlight tracks the swipe gesture in real-time (proportional to drag position), not just snapping after completion.
- **D-04:** Tapping a bottom nav tab triggers the same slide animation as swiping (not instant navigation).
- **D-05:** When tapping a non-adjacent tab (e.g., Home → Settings), slide directly from current to target — do not animate through intermediate screens.
- **D-06:** During a swipe drag, both the current screen and the adjacent screen are visible simultaneously (live peek / side-by-side sliding).
- **D-07:** Axis lock after ~10px of movement. Whichever axis dominates (horizontal or vertical) wins; the other is ignored until touch ends.
- **D-08:** Nav swipe is suppressed when touch starts inside a horizontal-draggable element (PostCarousel, mind-elixir graph canvas). Inner element handles its own drag.
- **D-09:** Swipe navigation is disabled when the soft keyboard is open (input focused on Ask screen). Prevents accidental screen switches mid-typing.
- **D-10:** On GraphScreen, swipe is disabled inside the mind-elixir container (graph panning takes priority). Swiping from outside the graph container (e.g., any chrome/header area) still navigates.
- **D-11:** All 5 top-level screens are always-mounted with `display:none` toggling (extending the existing Home/Ask pattern to Planner, Graph, Settings).
- **D-12:** GraphScreen is no longer lazy-loaded. Remove `React.lazy` — eager-load all 5 screens on app start to avoid loading flash during swipe.
- **D-13:** Rubber-band effect at edges (swiping right on Home, left on Settings). Screen resists and bounces back.
- **D-14:** Swipe threshold is ~20% of screen width (~75px on 375px phone). Below threshold, swipe cancels and screen snaps back.
- **D-15:** No haptic feedback on swipe commit. Silent transitions.
- **D-16:** Slide animation duration is ~250ms with spring easing. Matches the snappy feel of existing 200ms PageTransition.

### Claude's Discretion

- Spring curve parameters (stiffness, damping) — tune for best feel
- Exact axis-lock threshold (suggested ~10px but can adjust)
- How to detect keyboard-open state (focus events, visual viewport API, or Capacitor keyboard plugin)
- Implementation approach for suppressing nav swipe inside nested draggable elements (event delegation, data attributes, or context)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 22 replaces the current route-transition model for the 5 top-level tabs with a gesture-driven, always-mounted swipe container. The core machinery is Framer Motion v12 (already installed at 12.38.0), specifically `useMotionValue`, `useTransform`, and `onPan*` callbacks on a wrapping `motion.div`. The swipe container owns the translateX of all 5 screens laid out in a horizontal strip; the active screen index determines the resting position; dragging offsets from that position; on release, the container springs to the nearest committed index.

The BottomNavigation must receive a real-time `swipeProgress` signal (a fraction 0–4 representing fractional screen index position) so it can interpolate icon color/background between tab states without triggering React re-renders. The cleanest approach is a `useMotionValue`-derived value passed down as a prop or via a small context.

Keyboard detection is a moderate complexity area. `@capacitor/keyboard` is NOT installed. The recommended approach for this codebase is a global `focusin`/`focusout` listener on `document` that tracks whether any `<input>` or `<textarea>` is currently focused — this is purely web-side, platform-agnostic, and zero-dependency.

**Primary recommendation:** Implement a `SwipeTabContainer` component in `src/components/SwipeTabContainer.tsx` that wraps the 5 always-mounted screens, wires `onPan`/`onPanEnd` for gesture handling, exposes a `swipeProgress` motion value to BottomNavigation via context, and integrates with `useNavigate` + `useLocation` to keep the URL in sync.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| framer-motion | 12.38.0 (installed) | Gesture capture, spring animation, motion values | Already used for PageTransition and PostCarousel; no additional install needed |
| react-router-dom | 7.13.1 (installed) | URL sync on tab commit | Already the app router |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React context | Built-in | Share swipe progress motion value to BottomNavigation | Lightweight — avoid prop drilling through RootLayout |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| onPan callbacks | `drag="x"` on the strip | drag prop auto-commits on release with momentum — harder to implement custom threshold + rubber-band; onPan gives full control |
| Focus event detection | @capacitor/keyboard plugin | Plugin not installed; focus events work fine for web/Capacitor WebView and cover the actual use case (input focused on Ask screen) |
| useTransform for nav | Passing raw number via useState | useTransform updates every animation frame without re-render; setState would cause re-render on every pixel moved — unacceptable for 60fps tracking |

**Installation:** No new packages required. All needed libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── SwipeTabContainer.tsx   — new: owns strip layout, gesture, spring animation
│   └── BottomNavigation.tsx    — updated: accepts swipeProgress MotionValue
├── lib/
│   └── swipe-tab-context.ts   — new: context for swipeProgress MotionValue
└── App.tsx                     — updated: always-mount all 5, remove lazy/Suspense for Graph
```

### Pattern 1: Horizontal Strip with translateX

**What:** All 5 screens are rendered side by side in a `100vw * 5` wide strip. The active screen is shown by translating the strip to `-index * 100vw`. During drag, an additional `dragOffset` (a `useMotionValue`) is added on top.

**When to use:** When all screens must be simultaneously mounted (D-11) and a live-peek (D-06) is required — translating a single strip is the simplest way to achieve both.

**Example:**
```typescript
// Source: Framer Motion docs + established pattern
const SCREENS = ['/home', '/planner', '/ask', '/graph', '/settings'];

const dragOffset = useMotionValue(0);

// The strip's x = -(activeIndex * screenWidth) + dragOffset
// useTransform combines these into a single motion value:
const stripX = useTransform(
  dragOffset,
  (raw) => -(activeIndex * window.innerWidth) + raw
);

// <motion.div style={{ x: stripX, width: `${SCREENS.length * 100}vw`, display: 'flex' }}>
//   {SCREENS.map((_, i) => <div style={{ width: '100vw', flexShrink: 0 }}>{screens[i]}</div>)}
// </motion.div>
```

### Pattern 2: onPan for Axis-Lock and Threshold Control

**What:** Use `onPanStart`, `onPan`, and `onPanEnd` on the swipe container instead of `drag="x"`. This gives full control over axis locking, rubber-banding, and commit threshold without fighting Framer Motion's momentum defaults.

**When to use:** Any time custom commit logic is needed (threshold, rubber-band at edges, axis lock).

**Key onPan facts (HIGH confidence — official docs):**
- Fires when pointer presses and moves more than 3px (Framer Motion built-in dead zone)
- `info` object contains: `point` (page coords), `delta` (since last frame), `offset` (from gesture start), `velocity` (px/s)
- `touch-action: none` must be set on the container element for touch input to work
- `onPanStart` fires once; `onPanEnd` fires on pointer release with final `info`

**Axis lock implementation (Claude's Discretion — recommended approach):**
```typescript
// Inside onPanStart: record starting point, reset lock state
// Inside onPan: if lock not yet set and |offset.x| or |offset.y| > 10px,
//   set lockAxis to whichever is larger
// If lockAxis === 'y': do nothing (let page scroll)
// If lockAxis === 'x': call e.preventDefault() and update dragOffset
```

### Pattern 3: useMotionValue + useTransform for Real-Time Nav Tracking

**What:** Derive a `swipeProgress` motion value (range 0–4 for 5 tabs) from the strip's current x position. Pass this to BottomNavigation to interpolate tab colors/highlights without re-renders.

**When to use:** Any time a UI element needs to mirror gesture position at 60fps (D-03).

**Example:**
```typescript
// stripX is the current translated x of the whole strip (negative values)
// swipeProgress = -stripX / screenWidth  (0 = Home, 1 = Planner, 2 = Ask, ...)
const swipeProgress = useTransform(stripX, (x) => -x / window.innerWidth);

// In BottomNavigation, use useMotionValueEvent or subscribe:
// motionValue.on('change', (progress) => { /* update indicator */ })
// OR pass swipeProgress to motion.div style and use useTransform for color:
const homeColor = useTransform(swipeProgress, [0, 1], ['var(--primary-40)', 'var(--muted-foreground)']);
```

### Pattern 4: Spring Commit Animation

**What:** On `onPanEnd`, determine the target index (threshold check + rubber-band), then use Framer Motion `animate()` to spring the dragOffset back to 0 while simultaneously setting a new `activeIndex`. The strip x resolves to the committed position.

**Implementation:** After committing to a new index, set `dragOffset` to `(oldIndex - newIndex) * screenWidth` (the visual gap), then animate it to 0 using `animate(dragOffset, 0, { type: 'spring', stiffness: 300, damping: 30 })`. This gives the spring feel without a janky jump.

**Rubber-band (D-13):** When at index 0 (Home) and user drags right, allow `dragOffset` to go positive but with `dragOffset * 0.3` multiplier (resistance). Similarly for Settings swiping left. On release, animate back to 0.

### Anti-Patterns to Avoid

- **Using `drag="x"` on the strip:** Framer Motion's drag momentum fires a snap animation on release that conflicts with the custom spring commit. Use `onPan*` instead.
- **Setting `activeIndex` with `useState` during drag:** This triggers re-renders every pixel. Use a ref to track the visual index during gesture, only call `navigate()` and update state on commit.
- **Calling `useNavigate` on every pan frame:** Router updates are expensive. Navigate once, on `onPanEnd` commit. Keep URL as source of truth only for committed states.
- **Setting `ref.current` during render for the screen-width value:** Read `window.innerWidth` inside the event handlers or a `useEffect` — not during render. Consistent with project's ESLint rule on refs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spring animation physics | Custom requestAnimationFrame spring loop | `animate(motionValue, target, { type: 'spring' })` from framer-motion | Framer's spring integrates with interruptible gestures; custom loops don't handle mid-animation redirects cleanly |
| Real-time value interpolation without re-renders | useState + useEffect listeners | `useTransform` from framer-motion | useTransform subscribes at the motion value level — zero React re-renders, runs on the animation thread |
| Gesture dead-zone (3px jitter) | Manual threshold check in onPointerMove | framer-motion `onPan` built-in 3px threshold | Already handled; do not re-implement |

**Key insight:** Framer Motion v12's motion values are designed precisely for this use case — animated shared values that update at 60fps without triggering React's reconciler. Using them correctly is the key to smooth swipe performance.

---

## Keyboard Detection Strategy (Claude's Discretion — Recommendation)

`@capacitor/keyboard` is NOT installed (not in package.json). Three options exist:

| Approach | Works in Capacitor | Works in browser | Complexity | Recommendation |
|----------|-------------------|-----------------|------------|----------------|
| `focusin`/`focusout` on `document` | Yes | Yes | Low | **USE THIS** |
| `window.visualViewport` resize | Partially (known bugs in Capacitor) | Yes | Medium | Avoid |
| `@capacitor/keyboard` events | Yes | No (no-op on web) | Medium + install | Overkill |

**Recommended implementation:**

```typescript
// In SwipeTabContainer or a useKeyboardOpen hook:
const [keyboardOpen, setKeyboardOpen] = useState(false);

useEffect(() => {
  const onFocusIn = (e: FocusEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
      setKeyboardOpen(true);
    }
  };
  const onFocusOut = () => setKeyboardOpen(false);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  return () => {
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('focusout', onFocusOut);
  };
}, []);
```

This works in Capacitor WebView because the WebView renders standard HTML inputs and fires standard focus events.

---

## Gesture Conflict Suppression (Claude's Discretion — Recommendation)

**D-08 / D-10 requirement:** Suppress swipe when touch starts inside PostCarousel or MindElixir canvas.

**Recommended approach: data attribute + check in onPanStart.**

Mark draggable child elements with `data-no-swipe-nav="true"`:
- PostCarousel container: add `data-no-swipe-nav="true"` to the outer div
- MindElixir container: add `data-no-swipe-nav="true"` to the `containerRef` div in MasterMap

In SwipeTabContainer's `onPanStart`:
```typescript
const onPanStart = (e: PointerEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest('[data-no-swipe-nav]')) {
    gestureBlocked.current = true;
    return;
  }
  gestureBlocked.current = false;
};
```

This avoids event context / React context complexity and is zero-cost for normal touches.

---

## Common Pitfalls

### Pitfall 1: touch-action Must Be Set on the Pan Container
**What goes wrong:** `onPan` fires for mouse but not touch on iOS/Android.
**Why it happens:** Browsers suppress custom gesture handling if `touch-action` allows browser scroll.
**How to avoid:** Set `touch-action: 'none'` on the `motion.div` that has `onPan*` props. However: this also blocks vertical scroll inside the container. The axis-lock pattern handles this — only suppress default scroll after locking to x-axis.
**Warning signs:** Swipe works in desktop Chrome but not on device.

**Nuance:** Set `touch-action: 'pan-y'` on the strip wrapper initially (allows vertical scroll), and override to `touch-action: 'none'` only after horizontal lock is detected. This requires imperative style update, or use CSS class toggle.

### Pitfall 2: URL sync Must Happen on Commit, Not During Drag
**What goes wrong:** Calling `navigate()` inside `onPan` causes route re-renders mid-gesture, destroying the always-mounted screen's scroll position and interrupting the animation.
**Why it happens:** react-router-dom v7's `navigate()` triggers a full location change.
**How to avoid:** Only call `navigate(SCREEN_ROUTES[newIndex])` inside `onPanEnd` after threshold is confirmed. Keep visual drag offset and route state decoupled during the gesture.

### Pitfall 3: React.lazy Removal for GraphScreen
**What goes wrong:** Forgetting to remove the `Suspense` wrapper and `lazy()` import for GraphScreen when converting to always-mounted.
**Why it happens:** D-12 requires eager loading. If Suspense remains, the GraphScreen will show a null fallback during the loading flash instead of the pre-mounted always-visible screen.
**How to avoid:** In App.tsx, import GraphScreen with a standard static import and include it in the always-mounted section alongside Home, Ask, Planner, and Settings.

### Pitfall 4: `display:none` Breaks MindElixir Initialization
**What goes wrong:** MindElixir initializes its canvas dimensions from the container element. If GraphScreen is hidden with `display:none` on first mount, `containerRef.current.offsetWidth` returns 0, causing the graph to render collapsed.
**Why it happens:** Hidden elements have no layout dimensions.
**How to avoid:** GraphScreen must be initialized at least once while visible. Two options: (a) use `visibility: hidden` + `pointer-events: none` instead of `display: none`, or (b) trigger a re-initialization of the mind-elixir instance when GraphScreen becomes visible for the first time. Option (a) is simpler but has memory/paint implications. Option (b) is safer — detect the transition from hidden to visible via a `useEffect` watching an `isVisible` prop.
**Warning signs:** Graph renders with 0 width, nodes collapsed to a point, or `mei.scale()` throws because `offsetWidth === 0`.

### Pitfall 5: BottomNavigation Color Animation Without Re-renders
**What goes wrong:** Implementing the real-time nav highlight (D-03) with `useState` causes 60fps re-renders of the whole nav, creating jank.
**Why it happens:** useState updates go through React's reconciler.
**How to avoid:** Use motion values and `useTransform` directly in BottomNavigation for color interpolation. Assign the color as `style={{ color: colorMotionValue }}` on a `motion.button`.

### Pitfall 6: Screen Width Must Be Read at Gesture Time, Not Render Time
**What goes wrong:** Hard-coding `375` or reading `window.innerWidth` during component initialization gives wrong value after orientation change or on different devices.
**How to avoid:** Read `window.innerWidth` inside `onPanStart` and store in a ref. Recalculate on each gesture start.

---

## Code Examples

Verified patterns from official sources and existing project code:

### useMotionValue + useTransform Strip x Calculation
```typescript
// Source: motion.dev docs + project PostCarousel pattern
import { useMotionValue, useTransform, animate } from 'framer-motion';

const dragOffset = useMotionValue(0);
// activeIndex is a ref, not state (to avoid re-renders during gesture)
const activeIndexRef = useRef(0);

// Derived strip x on every animation frame — no React re-render
const stripX = useTransform(dragOffset, (raw) => {
  return -(activeIndexRef.current * window.innerWidth) + raw;
});
```

### onPan Axis-Lock Pattern
```typescript
// Source: official motion.dev gesture docs + axis lock pattern
const lockAxisRef = useRef<'x' | 'y' | null>(null);
const gestureBlockedRef = useRef(false);

const onPanStart = (e: PointerEvent) => {
  lockAxisRef.current = null;
  if ((e.target as HTMLElement).closest('[data-no-swipe-nav]')) {
    gestureBlockedRef.current = true;
    return;
  }
  gestureBlockedRef.current = false;
};

const onPan = (_e: PointerEvent, info: PanInfo) => {
  if (gestureBlockedRef.current || keyboardOpen) return;

  if (!lockAxisRef.current && (Math.abs(info.offset.x) > 10 || Math.abs(info.offset.y) > 10)) {
    lockAxisRef.current = Math.abs(info.offset.x) >= Math.abs(info.offset.y) ? 'x' : 'y';
  }

  if (lockAxisRef.current !== 'x') return;

  const index = activeIndexRef.current;
  const raw = info.offset.x;
  const MAX = SCREENS.length - 1;

  // Rubber-band at edges
  if ((index === 0 && raw > 0) || (index === MAX && raw < 0)) {
    dragOffset.set(raw * 0.25); // resistance
  } else {
    dragOffset.set(raw);
  }
};

const onPanEnd = (_e: PointerEvent, info: PanInfo) => {
  if (gestureBlockedRef.current || lockAxisRef.current !== 'x') {
    dragOffset.set(0);
    return;
  }
  const THRESHOLD = window.innerWidth * 0.2;
  const offset = info.offset.x;
  const index = activeIndexRef.current;
  let newIndex = index;

  if (offset < -THRESHOLD && index < SCREENS.length - 1) newIndex = index + 1;
  if (offset > THRESHOLD && index > 0) newIndex = index - 1;

  activeIndexRef.current = newIndex;
  // Animate strip to rest position (spring)
  animate(dragOffset, -(newIndex - index) * window.innerWidth + dragOffset.get() - dragOffset.get(), {
    // Simpler: just animate dragOffset to 0 after updating activeIndexRef
  });
  dragOffset.set(0); // Actually: spring animate to 0
  animate(dragOffset, 0, { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 });
  navigate(SCREENS[newIndex]);
};
```

### Committed Tab Navigation with Slide Animation (D-04 / D-05)
```typescript
// Tap on nav tab → same animation as swipe
const navigateToTab = (targetIndex: number) => {
  const currentIndex = activeIndexRef.current;
  if (targetIndex === currentIndex) return;
  // Jump dragOffset to simulate starting from current screen
  // then animate to committed position
  activeIndexRef.current = targetIndex;
  animate(dragOffset, 0, { type: 'spring', stiffness: 300, damping: 30 });
  navigate(SCREENS[targetIndex]);
};
```

### PostCarousel: Add data-no-swipe-nav
```tsx
// In PostCarousel.tsx — add data attribute to outer container
<div
  data-no-swipe-nav="true"  // add this
  style={{ position: 'relative', width: '100%', height: '350px', ... }}
>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| framer-motion npm package | Rebranded to `motion` package; `framer-motion` still works as alias | 2025 | Package name `framer-motion` still valid at v12; no action needed |
| Pointer capture on pan | Removed in framer-motion 12.4.12 | 2025 | Gesture events more reliable on iOS WebView |
| `AnimatePresence` for tab transitions | Strip-based translate (no mount/unmount) | Phase 22 | Always-mounted approach replaces page-level AnimatePresence for top-level screens |

---

## Open Questions

1. **MindElixir initialization in hidden state (display:none)**
   - What we know: MindElixir reads `containerRef.current.offsetWidth` during `mei.init()` and `mei.scale()`. If the div is `display:none`, offsetWidth = 0.
   - What's unclear: Whether lazy init on first-visible is sufficient or whether the existing `requestAnimationFrame` workaround in GraphScreen handles it gracefully.
   - Recommendation: Test this explicitly in Wave 1 before declaring the pattern complete. Plan should include a task to verify GraphScreen renders correctly when first shown via swipe (not just on direct navigation).

2. **Scroll position preservation for Planner and Settings**
   - What we know: Home and Ask already use always-mounted pattern and preserve scroll.
   - What's unclear: PlannerScreen and SettingsScreen are currently not always-mounted, so they use the Outlet pattern. Their scroll position resets on every navigation away. With always-mounted + display:none, scroll position will be preserved — this may or may not be the desired behavior for Settings.
   - Recommendation: Accept scroll preservation as a natural consequence of always-mounted; no special handling needed.

3. **Android back button interaction**
   - What we know: App.tsx has a `CapApp.addListener('backButton')` handler that calls `window.history.back()` or `CapApp.exitApp()`.
   - What's unclear: After swipe navigation changes the URL via `navigate()`, does the history stack grow correctly? Does swiping Home → Planner → back-button return to Home as expected?
   - Recommendation: The plan should include a verification task that covers Android back button behavior after swipe navigation.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is entirely code changes to existing React/Framer Motion stack, all packages already installed).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | none — run via `node --test tests/**/*.test.mjs` |
| Quick run command | `node --test tests/**/*.test.mjs` |
| Full suite command | `node --test tests/**/*.test.mjs` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SWIPE-01 | Axis lock: after 10px horizontal movement, dragOffset updates; after 10px vertical, drag is blocked | unit | `node --test tests/components/SwipeTabContainer.test.mjs` | ❌ Wave 0 |
| SWIPE-02 | Threshold: offset < 20% screenWidth snaps back; offset >= 20% commits to adjacent index | unit | `node --test tests/components/SwipeTabContainer.test.mjs` | ❌ Wave 0 |
| SWIPE-03 | Rubber-band: at index 0 swiping right, dragOffset = rawOffset * 0.25 (not full) | unit | `node --test tests/components/SwipeTabContainer.test.mjs` | ❌ Wave 0 |
| SWIPE-04 | Keyboard guard: when keyboardOpen=true, onPan does not update dragOffset | unit | `node --test tests/components/SwipeTabContainer.test.mjs` | ❌ Wave 0 |
| SWIPE-05 | data-no-swipe-nav guard: onPanStart with target inside [data-no-swipe-nav] sets gestureBlocked | unit | `node --test tests/components/SwipeTabContainer.test.mjs` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/components/SwipeTabContainer.test.mjs`
- **Per wave merge:** `node --test tests/**/*.test.mjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/components/SwipeTabContainer.test.mjs` — covers SWIPE-01 through SWIPE-05 (pure logic tests — extract axis-lock, threshold, rubber-band, keyboard guard, and gesture-block functions as pure functions for testability, same pattern as useInfiniteScroll.test.mjs)

---

## Sources

### Primary (HIGH confidence)
- motion.dev official docs — pan gesture API (`onPan`, `onPanStart`, `onPanEnd`, `PanInfo` shape), `useMotionValue`, `useTransform`
- Framer Motion v12.38.0 installed package — verified version via `node -e "require('./node_modules/framer-motion/package.json').version"`
- App.tsx (direct read) — current RootLayout always-mounted pattern, route definitions, GraphScreen lazy loading
- BottomNavigation.tsx (direct read) — current tab layout, navigate usage
- PostCarousel.tsx (direct read) — existing `drag="x"` pattern, `dragElastic`, `touchAction: 'pan-y'`
- GraphScreen.tsx (direct read) — MindElixir container structure, touchstart/touchend listeners, `containerRef`
- package.json (direct read) — confirmed framer-motion 12.38.0, no @capacitor/keyboard

### Secondary (MEDIUM confidence)
- Capacitor Keyboard docs (capacitorjs.com) — confirmed @capacitor/keyboard events API, confirmed it is NOT installed
- motion.dev `useTransform` docs — range mapping, clamp behavior

### Tertiary (LOW confidence)
- Community patterns for tab-swipe with useMotionValue — implementation structure cross-verified against project's own PostCarousel pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — framer-motion 12.38.0 confirmed installed; no new deps needed
- Architecture (strip pattern): HIGH — well-established pattern verified against existing PostCarousel code
- Pitfall (display:none + MindElixir): MEDIUM — known DOM behavior but exact MindElixir interaction untested
- Keyboard detection: HIGH — focus events approach verified as platform-agnostic; no install required
- Gesture conflict suppression: HIGH — data attribute approach is simple, precedent in existing codebase

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable deps, pattern is framework-stable)
