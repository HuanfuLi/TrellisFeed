# Bug 6 Handoff — VineProgress dropdown concept-tap broken on Android Capacitor

> **Status:** UNSOLVED after 7 attempts. Operator stopped the cycle and asked for a handoff. Handing off to a fresh agent with clean context.

## TL;DR

On Android Capacitor WebView, tapping a concept item in the VineProgress dropdown should smoothly scroll the home feed so the matching tile is centered. **It works in a desktop browser. It does not work on device.** The current state (commit `b9cc9aa5`) closes the dropdown correctly and does NOT penetrate to the tile underneath, but the scroll itself never happens AND the operator observed a "horizontal flicker" after the tap.

Web works. Device does not. Don't trust any guess that hasn't been operator-confirmed on device.

## What the feature does

`VineProgress` (`app/src/components/VineProgress.tsx`) renders a progress bar with an expandable dropdown listing uncovered concepts. Tap a concept → home feed scrolls to that concept's tile.

- Tap target: `<div role="button">` rendered per `uncoveredConcepts.map(...)` inside an animated `max-height` wrapper.
- Wired through: `onPointerUp` → `fireConceptTap(id)` → calls prop `onConceptTap?.(id)` AND installs a one-shot capture-phase document click swallow AND `setExpanded(false)`.
- `onConceptTap` in `HomeScreen.tsx` = `handleConceptTap` which scrolls the `data-home-scroll` container to center the tile matching `[data-concept-id="${conceptId}"]`.

VineProgress mounts twice in HomeScreen:
- **Inline mode** — `mode="inline"`, inside the home-scroll container.
- **Compact mode** — `mode="compact"`, inside a `position: fixed` wrapper at top of viewport (outside the home-scroll container).

## Operator-confirmed diagnostic state (current truth)

Confirmed via explicit yes/no questions from attempt 7 round:

1. **Platform**: Android Capacitor (Chromium WebView).
2. **`ScrollToTopFAB` works on device** — `scrollRef.current?.scrollTo({top:0, behavior:'smooth'})` on the SAME `containerRef` smoothly scrolls to top.
3. **Tap-a-concept on device** = dropdown closes, **no scroll motion at all**.
4. **The target tile IS rendered** somewhere in the feed; operator scrolled manually and confirmed.
5. **Attempt 7 (rAF-based manual scroll)** still failed AND **introduced a horizontal flicker** after the tap.

The horizontal-flicker observation is new and may be the key clue we missed.

## Attempt chain (chronological)

All commits on `main`. First Bug-6 commit is `b45321f3`.

| # | Commit | Hypothesis | What changed | Outcome on device |
|---|--------|-----------|-------------|-------------------|
| 1 | `b45321f3` | Need device-parity for tap | `<div onClick>` → `<button>` + `stopPropagation` + `touchAction: 'manipulation'` | FAIL — items still inert |
| 2 | `a00c01df` | framer-motion pan capture stealing pointerdown | Added `data-no-swipe-nav="true"` + `onPointerDown` `stopPropagation` | FAIL — items still inert |
| 3 | `f45a75d5` | `overflow: auto + maxHeight + transition` scroll container allocates touch arbitration on WebView | Removed scroll container; conditional render `{expanded && (...)}` (lost the open/close animation) | FAIL — items still inert |
| 4 | `95fc3f4d` | Click synthesis unreliable on `<button>` under framer-motion pan ancestor — codebase uses `onPointerUp` elsewhere (BottomNavigation FAB, ChatMessage, SavedScreen) | `<button>` → `<div role="button">` + `onClick` → `onPointerUp` + 44px min tap target + close dropdown on tap | PARTIAL — touches now register, but click penetrated to the tile underneath → wrong-navigated to post detail |
| 5 | `b55cbdd8` | Synthesized click lands on the tile after dropdown unmounts | One-shot capture-phase `document` `click` swallow (`stopPropagation + preventDefault`), `{once:true}` + 300ms safety removal | Penetration FIXED. Dropdown closes cleanly. But scroll still doesn't happen. |
| 6 | `0ec7a302` | (a) `scrollIntoView({behavior:'smooth'})` unreliable on WebView; (b) lost animation from attempt 3 | (a) Replaced `scrollIntoView` with manual `getBoundingClientRect`-based target + `scrollTo({top, behavior:'smooth'})` on the home-scroll container; (b) Restored expand/collapse animation via `max-height` + `overflow: hidden` + 220ms transition, always-render items with `pointer-events: 'none'` guard when collapsed | Animation restored. Scroll still doesn't happen. |
| 7 | `b9cc9aa5` | WebView ignores `behavior:'smooth'` for non-zero offsets (Chromium 470360; MDN says UAs MAY ignore); FAB's `top:0` hits a different boundary-snap code path | rAF-based manual smooth scroll: direct `scrollContainer.scrollTop = ...` per frame, easeInOutCubic over 380ms. Defer one rAF after `setExpanded(false)` so React flushes the collapse before computing target. | **FAIL** — still no scroll. New regression: **horizontal flicker** after the tap. |

## What's load-bearing and MUST NOT be reverted

These are operator-confirmed working pieces. A handoff agent should preserve them:

- **`<div role="button">` instead of `<button>`** (attempt 4). `<button>` + onClick was inert on device.
- **`onPointerUp` instead of `onClick`** (attempt 4). Codebase precedent: `BottomNavigation.tsx:204-205`, `ChatMessage.tsx:247`, `SavedScreen.tsx:1383`. Synthesized click events are unreliable on Capacitor WebView under framer-motion pan ancestors.
- **One-shot capture-phase document click swallow** (attempt 5). Without it, the synthesized click penetrates to the masonry tile underneath after the dropdown unmounts and navigates the user to post detail.
- **`max-height` + `overflow: hidden` + `pointer-events: none` guard** (attempt 6 part b). Operator approved the restored animation.
- **`data-no-swipe-nav="true"`** on both the dropdown wrapper and each item. SwipeTabContainer's `onPanStart` checks this via `closest()` to set `gestureBlockedRef.current` and avoid horizontal-strip navigation.

## Architectural context the next agent MUST read first

1. **`CLAUDE.md` → "Header positioning"** — explains that top-level swipe-tab screens (HomeScreen, etc.) live as always-mounted slots in `SwipeTabContainer`, each with `transform: translateZ(0)` creating a per-slot containing block.
2. **`CLAUDE.md` → "Root overflow clip — both axes"** — `html, body { overflow: hidden }` is load-bearing. App scroll lives inside each screen's own `overflow: auto` container. NEVER rely on body scroll.
3. **`CLAUDE.md` → "SwipeTabContainer resize + keyboard"** — `resync()` gates on width change. The strip is `500vw` wide (5 slots × 100vw).
4. **`HomeScreen.tsx:794`** — `<div ref={containerRef} data-home-scroll>` is the home feed scroll container. Has `overflowY: 'auto'`, `WebkitOverflowScrolling: 'touch'`, `overscrollBehavior: 'contain'`, `touchAction: 'pan-y'`, `height: 'calc(100dvh - var(--safe-area-top))'`.
5. **`ScrollToTopFAB.tsx`** — proven-working scroll-to-top button. Uses `scrollRef.current?.scrollTo({top:0, behavior:'smooth'})` on the SAME `containerRef`. Operator confirms it works on device.
6. **`MasonryFeed.tsx:462, :489`** — `data-concept-id={post.sourceQuestionIds?.[0]}` set on each concept tile. Tiles are inside framer-motion `<motion.div>` with `AnimatePresence` per column. Tiles have `position: relative` + tile-enter `variants` (scale/opacity).

## The "horizontal flicker" — new clue worth investigating FIRST

The operator's final observation (attempt 7): tapping a concept causes a **horizontal flicker** even though there's no visible scroll. Hypotheses worth testing:

- **`stripX` is being perturbed.** `SwipeTabContainer.tsx` controls `stripX` via framer-motion `useMotionValue`. If the rAF scroll touches `scrollLeft` somehow, or if framer-motion's pan detection is being triggered on `onPointerUp` of the dropdown item, the strip might briefly animate then snap back. **Check**: does `gestureBlockedRef.current` in SwipeTabContainer actually get set to `true` when tapping the dropdown item? `data-no-swipe-nav` is on the item, but framer-motion calls `onPanStart` with `_e.target` — is this fired at all for a pure tap (no movement)? If `onPanStart` doesn't fire on a tap, `gestureBlockedRef` stays at its previous value (could be `false`).
- **The rAF scroll is actually running on the wrong axis.** Unlikely — code assigns `scrollTop` not `scrollLeft`. But worth confirming via Chrome DevTools remote debugging.
- **Re-render after `setExpanded(false)` is causing a layout shift that affects the strip.** Inline mode dropdown lives inside home-scroll. Collapse shrinks home-scroll content height. Maybe causes a brief horizontal layout disruption? Less plausible but cheap to rule out.
- **`onPointerUp` event reaches SwipeTabContainer's pan handler.** The dropdown item has `data-no-swipe-nav`, so `onPanStart` (when it fires) sets `gestureBlockedRef = true`. But `onPanEnd` ALSO checks `gestureBlockedRef.current || lockAxisRef.current !== 'x'` and calls `animate(stripX, ...)` — even when blocked, it animates the strip back to its current slot. That's normally a no-op (target = current position), BUT if anything has perturbed `stripX` between `onPanStart` and `onPanEnd`, this would visibly snap. Worth checking whether onPanStart/onPanEnd actually fire for a tap on the dropdown item.

## What the next agent should do

1. **Do not propose another code change without operator-confirmed evidence.** The cycle of "hypothesis fix → operator retest → fail" has burned 7 attempts. Burn-rate is unacceptable.
2. **Get Chrome DevTools remote debugging working** (`chrome://inspect` while device USB-connected with Capacitor app running). This is the only way to see device-side console logs, network requests, and inspect DOM state during the tap.
3. **Add temporary `console.log` to BOTH** the rAF step function in `HomeScreen.tsx:handleConceptTap` AND `SwipeTabContainer.tsx:onPanStart/onPanEnd`. Have the operator screenshot or copy the console output during a failing tap. Specifically check:
   - Is `handleConceptTap` even being called?
   - Is `postElement` non-null?
   - What are `containerRect.top`, `tileRect.top`, `scrollTop`, `targetScrollTop` at the moment of the tap?
   - Is `scrollContainer.scrollTop` actually changing each frame inside the rAF loop?
   - Is `SwipeTabContainer.onPanStart` firing on the tap? Is `gestureBlockedRef.current` set to true?
   - Is `SwipeTabContainer.onPanEnd` firing? Is it calling `animate(stripX, ...)`?
4. **Reproduce the horizontal flicker in DevTools** (Device Mode or actual device via remote debug). The flicker is a visible artifact — it must be observable in the Animations panel or via Performance recording.
5. **Only propose a fix once the device-side telemetry confirms the failure mode.** No more speculative fixes.

## Things ruled out (don't re-try these)

- ✗ Pointer capture by framer-motion (attempt 2)
- ✗ Scroll-container touch arbitration (attempt 3)
- ✗ Synthesized click on `<button>` (attempt 4 — FIXED the underlying tap reception, but exposed penetration)
- ✗ Click penetration to tile underneath (attempt 5 — FIXED via doc-capture click swallow; that part stays)
- ✗ `scrollIntoView({behavior:'smooth'})` (attempt 6 — replaced)
- ✗ `scrollContainer.scrollTo({behavior:'smooth'})` with non-zero target (attempt 6 — silently no-ops on this device)
- ✗ rAF + direct `scrollTop` assignment (attempt 7 — STILL no scroll; introduced horizontal flicker)

## Things to investigate that have NOT been ruled out

- **Is `containerRef.current` the wrong element at handler time?** Verify with `console.log(containerRef.current)` during the tap. Expected: the `data-home-scroll` div. If null or different, something has remounted the home-scroll.
- **Is the rAF loop actually running?** `console.log(progress, scrollContainer.scrollTop)` inside the `step` function.
- **Is `scrollTop` assignment being silently reverted by something else** on the same tick — e.g., another scroll handler, or a layout-effect snapping scroll back? Search `containerRef` / `scrollRef` / `scrollTop` writes across `HomeScreen.tsx` and child components.
- **`useEffect` at HomeScreen.tsx:707-743** (cardHidden tracker) fires on every scroll, calls `setCardHidden`. That triggers re-render. Re-render during scroll shouldn't cancel scroll, but worth eliminating as a variable.
- **Stale closure**: `handleConceptTap` is a `useCallback` with deps `[]`. Captures `containerRef` (stable). But if anything captured a stale value of the tile element or the conceptId, weird things could happen.
- **The dropdown item's onPointerUp is firing twice?** Add `console.log` at the top of `onPointerUp`.
- **Capacitor `@capacitor/keyboard` plugin?** Sometimes intercepts pointer events. Not directly related but worth a `grep` to confirm config.

## Files to read in order for a new agent

1. `app/src/components/VineProgress.tsx` — entire file, ~510 lines. Current state has all 7 attempt fixes applied.
2. `app/src/screens/HomeScreen.tsx:625-689` — `handleConceptTap` (rAF-based scroll). And `:707-743` (scroll listener for `cardHidden`).
3. `app/src/components/ScrollToTopFAB.tsx` — entire file (~55 lines). Proven-working scroll on the same container.
4. `app/src/components/SwipeTabContainer.tsx:170-265` — pan handlers + strip animation. The horizontal flicker likely originates here.
5. `app/src/components/MasonryFeed.tsx:560-690` — masonry layout and tile rendering. Confirms `data-concept-id` is rendered.
6. `CLAUDE.md` sections cited above.

## First commit ID (Bug-6 attempt chain start)

**`b45321f3`** — "fix(51-01): device-parity for badge tap + VineProgress dropdown (UAT Bug 5/6)"

Most recent: **`b9cc9aa5`** — "fix(home): rAF-based manual scroll for concept tap on Android WebView"

## Lessons learned (for the next agent and operator)

1. **The codebase's `onPointerUp` precedent (BottomNavigation FAB, ChatMessage, SavedScreen) was the correct base pattern from the start.** Attempts 1–3 should have skipped to attempt 4 directly. Whenever a tap fails on Capacitor WebView, default to `onPointerUp` + capture-phase document click swallow as the FIRST hypothesis, not the fourth.
2. **Hypothesis fixes for device-only bugs without device-side telemetry burn many cycles.** CLAUDE.md "Best practices learned in Phase 32.1 #7" explicitly says this: "Don't ship hypothesis-only fixes for device-only bugs. Add diagnostic logs over confident-but-untested fixes." Attempts 1–7 violated this rule.
3. **`scrollTo({behavior:'smooth'})` is NOT universally reliable on Capacitor WebView for non-zero offsets** — Chromium bug 470360, MDN says UAs are allowed to ignore the behavior flag. **BUT** rAF-with-direct-`scrollTop`-assignment ALSO failed in this case, so the rabbit hole is deeper than the smooth-scroll layer alone.
4. **The fact that `ScrollToTopFAB` works on the same container while `handleConceptTap` doesn't is the most important clue.** Any further work should start by enumerating ALL differences (call stack, timing relative to `setState`, presence of other concurrent effects, target value being 0 vs N) and isolating which one matters.
5. **Each attempt added a new layer (button → div → onPointerUp → swallow → manual scroll → rAF).** The current code is a stack of defenses — none should be reverted without understanding why it's there. Read the inline comments in `VineProgress.tsx` (lines 220-258 for `fireConceptTap`, 423-441 for the dropdown wrapper).

## Reproducibility

- Repo: `/Users/Code/EchoLearn`
- Branch: `main`
- Build: `cd app && npm run build && npx cap sync android && npx cap open android`
- Then build/install through Android Studio and reproduce on a connected Android device.
- Web reproduction (works correctly): `cd app && npm run dev`, open in Chrome desktop, scroll the feed, expand VineProgress (the green progress bar above the masonry), tap a concept.

## Test/build status at handoff

- `npx tsc -b --noEmit` — CLEAN
- `npm test` — 1335 main + 149 actions = 1484 tests pass

---

Generated 2026-05-19. Operator: huanfuli@. Handoff prepared after attempt 7.
