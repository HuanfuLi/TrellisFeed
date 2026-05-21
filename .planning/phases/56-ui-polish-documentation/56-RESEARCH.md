# Phase 56: UI Polish & Documentation — Research

**Researched:** 2026-05-21
**Domain:** React 19 / Capacitor 8 / framer-motion 12 — cross-cutting audit, animation jank, navigation correctness, doc maintenance
**Confidence:** HIGH (all findings sourced directly from live source files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Polish Discovery & Triage (POLISH-01)**
- D-01: Discovery is hybrid — an agent visual audit (gsd-ui-auditor 6-pillar style) produces the candidate findings list; the operator triages (approve / cut / add) before any fix lands. Agents fix only approved items.
- D-02: Audit covers all screens at equal depth — 5 swipe-tab roots + every sub-screen: PostDetail, AnchorDetail, ClusterDetail, QuestionDetail, CollectionDrillIn, Review, Podcast, Saved, Onboarding, all settings/ sub-pages.
- D-03: Fresh audit from current code — do NOT use the Apr-16 Documents/UI_AUDIT_REPORT.md as baseline (predates i18n, masonry feed, SQLite migration, Trellis rework). Archive that old report to Documents/Legacy/.

**Animation (POLISH-02)**
- D-04: Fix-janky-only. Repair stutter/flicker/dropped-frame issues in EXISTING animations; add NO new motion or micro-interactions.
- D-05: When an existing animation cannot be made smooth within the WebView budget, the auditor proposes remove-vs-simplify case-by-case and the operator decides per animation during triage (not a blanket rule).

**Navigation (POLISH-03)**
- D-06: Full route-map audit — map every route and entry point (swipe tabs, sub-screen Outlets, back buttons, deep links, event-bus-driven navigations) and walk each path for wrong / dead-end / broken back behavior.
- D-07: Top concern is Android hardware/gesture back-button behavior across all screens. Audit must give back-button consistency special attention, especially sub-screen Outlets and settings sub-pages.

**Documentation (DOCS-01, DOCS-02)**
- D-08: Stale docs in Documents/ and .planning/ are moved to Legacy/, never deleted.
- D-09: For CLAUDE.md drift (DOCS-02): agent produces a drift report (doc claim vs actual code) and the operator approves each correction before it is written. CLAUDE.md is high-stakes/load-bearing — confirm-first, no silent auto-correction.

### Claude's Discretion
- The specific contents of the polish checklist / 6-pillar rubric (researcher + auditor define it).
- The exact WebView performance-budget measurement method.
- Whether a given CLAUDE.md drift indicates code regression vs stale doc — but the resolution direction is operator-approved per D-09.

### Deferred Ideas (OUT OF SCOPE)
None — adding new animation/motion language was explicitly declined per D-04; redesigns and new capabilities are out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLISH-01 | Screens swept against UI-polish checklist; spacing/alignment/visual-hierarchy issues fixed | Screen inventory (§Screen Inventory), 6-pillar rubric defined in UI-SPEC.md, hardcoded-hex candidates identified (§Color Drift Candidates) |
| POLISH-02 | Missing or janky animations identified and fixed within Android WebView budget | Full animation inventory (§Animation Inventory), jank candidates marked (§Jank Candidates), budget rules defined (§WebView Performance Budget) |
| POLISH-03 | Navigation audited end-to-end; wrong/dead-end/broken back-button paths fixed | Full route map (§Route Map), back-button pattern analysis per screen (§Back-Button Audit), event-bus-driven navigations (§Event-Bus Navigation) |
| DOCS-01 | Stale docs in Documents/ and .planning/ archived or updated | Doc inventory with staleness assessment (§Document Inventory) |
| DOCS-02 | CLAUDE.md load-bearing sections verified against code; drift corrected | Mechanical drift verification table (§CLAUDE.md Drift Verification), confirmed drifts flagged for operator approval |
</phase_requirements>

---

## Summary

Phase 56 is a sweep-and-reconcile phase over the existing Trellis codebase. No new product capability is introduced. The work falls into four tracks: (1) a 6-pillar visual-quality audit across all 18 screens producing a candidate-findings list for operator triage; (2) a fix-janky-only animation pass over the identified animation inventory; (3) a full back-button and route-map audit with special attention to Android hardware back across sub-screen Outlets; and (4) doc archival plus a mechanical CLAUDE.md drift report for operator approval.

The most actionable research findings for the planner are: the full screen-file inventory with route paths, a complete animation inventory across all 23 declared keyframe definitions and their call sites, a CLAUDE.md drift table with two confirmed drifts (`STORAGE_KEY_YESTERDAY` storage medium and `db.service.ts` connection name) plus several candidates to verify, and a doc staleness inventory with clear archive vs keep-live recommendations.

The discovery model mandates an audit-then-triage gate before any fix. Plans must be structured: Wave 0 = audit + produce findings lists, Wave 1 = operator triage (checkpoint), Wave 2 = fix approved items. CLAUDE.md drift corrections are a separate gated track (D-09: no silent edit).

**Primary recommendation:** Structure three concurrent audit streams (POLISH-01 visual, POLISH-02 animation, POLISH-03 navigation) as Wave 0 read-only passes that all produce findings lists. Hold a single operator triage checkpoint. Then execute approved fixes and doc operations in Wave 2.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Visual polish audit (spacing, color, typography) | Browser / Client | — | Inline-style + CSS-var design system; no server render |
| Animation correctness (compositor compliance) | Browser / Client | — | CSS keyframes + framer-motion in WebView render thread |
| Navigation / back-button behavior | Browser / Client | — | react-router-dom v7 + Capacitor `App.backButton` listener |
| Doc archival | Repository / FS | — | File-system move operations; no runtime impact |
| CLAUDE.md drift report | Repository / FS | — | Source-reading + grep audit; no runtime impact |

---

## Screen Inventory

All 18 screen files under `app/src/screens/`. Exact file paths for audit tasks.

### Swipe-Tab Roots (always-mounted, instant tab transport)

| Screen | File | Route |
|--------|------|-------|
| HomeScreen | `app/src/screens/HomeScreen.tsx` | `/home` |
| AskScreen | `app/src/screens/AskScreen.tsx` | `/ask` |
| PlannerScreen | `app/src/screens/PlannerScreen.tsx` | `/planner` |
| GraphScreen | `app/src/screens/GraphScreen.tsx` | `/graph` |
| SettingsScreen | `app/src/screens/SettingsScreen.tsx` | `/settings` |

### Sub-Screen Outlets (fullscreen overlay zIndex 50, Header portals to body)

| Screen | File | Route | Back Destination |
|--------|------|-------|-----------------|
| PostDetailScreen | `app/src/screens/PostDetailScreen.tsx` | `/posts/:id` | `navigate(-1)` |
| QuestionDetailScreen | `app/src/screens/QuestionDetailScreen.tsx` | `/ask/:id` | `backTo="/ask"` via Header |
| AnchorDetailScreen | `app/src/screens/AnchorDetailScreen.tsx` | `/anchor/:id` | `navigate(-1)` |
| ClusterDetailScreen | `app/src/screens/ClusterDetailScreen.tsx` | `/cluster/:id` | `navigate(-1)` |
| CollectionDrillInScreen | `app/src/screens/CollectionDrillInScreen.tsx` | `/collections/:id` | `backTo="/saved"` via Header |
| ReviewScreen | `app/src/screens/ReviewScreen.tsx` | `/review` | `navigate(-1)` |
| PodcastScreen | `app/src/screens/PodcastScreen.tsx` | `/podcast` | `navigate(-1)` |
| SavedScreen | `app/src/screens/SavedScreen.tsx` | `/saved` | `backTo="/home"` via Header |
| OnboardingScreen | `app/src/screens/OnboardingScreen.tsx` | `/onboarding` | no back (gate) |
| SettingsAIScreen | `app/src/screens/settings/SettingsAIScreen.tsx` | `/settings/ai` | `backTo="/settings"` via Header |
| SettingsContentScreen | `app/src/screens/settings/SettingsContentScreen.tsx` | `/settings/content` | `backTo="/settings"` via Header |
| SettingsFeaturesScreen | `app/src/screens/settings/SettingsFeaturesScreen.tsx` | `/settings/features` | `backTo="/settings"` via Header |
| SettingsDataScreen | `app/src/screens/settings/SettingsDataScreen.tsx` | `/settings/data` | `backTo="/settings"` via Header |

**Wildcard catch-all:** `path: '*'` → `<Navigate to="/home" replace />`

---

## Route Map

### React Router v7 Route Tree (App.tsx:306–336)

```
/onboarding         → OnboardingScreen (standalone, no Outlet)
/                   → RootLayout (ErrorBoundary)
  (index)           → HomeRedirect (checks onboardingCompleted)
  home              → null slot (always-mounted in SwipeTabContainer)
  ask               → null slot (always-mounted in SwipeTabContainer)
  planner           → null slot (always-mounted in SwipeTabContainer)
  graph             → null slot (always-mounted in SwipeTabContainer)
  settings          → null slot (always-mounted in SwipeTabContainer)
  posts/:id         → PageTransition > PostDetailScreen
  ask/:id           → PageTransition > QuestionDetailScreen
  anchor/:id        → PageTransition > AnchorDetailScreen
  cluster/:id       → PageTransition > ClusterDetailScreen
  collections/:id   → PageTransition > CollectionDrillInScreen
  review            → PageTransition > ReviewScreen
  saved             → PageTransition > SavedScreen
  podcast           → PageTransition > PodcastScreen
  settings/ai       → PageTransition > SettingsAIScreen
  settings/content  → PageTransition > SettingsContentScreen
  settings/features → PageTransition > SettingsFeaturesScreen
  settings/data     → PageTransition > SettingsDataScreen
  *                 → Navigate to /home (replace)
```

### Android Hardware Back-Button (App.tsx:414–425)

The global Capacitor `App.addListener('backButton')` handler fires `window.history.back()` when `window.history.length > 1`, else `App.exitApp()`. This means:
- All sub-screens naturally pop via browser history — works for `navigate(-1)` and `backTo` Header paths.
- **Risk:** A screen opened via `navigate('/x', { replace: true })` would be excluded from history; hardware back would skip it and go further. The nav audit must check all `replace: true` navigations.
- **Risk:** Event-bus-driven navigations (e.g. replant → `/posts/anchor-post-{id}`) push onto history; hardware back from those sub-screens should return the user to the Planner — verify this is the actual behavior.

### Event-Bus-Driven Navigations

These navigations are initiated from `trellis-actions.service.ts` returning a `navigateTo` intent consumed by `PlannerScreen.tsx`:

| Trigger | Destination | Back Target (expected) |
|---------|-------------|----------------------|
| Heal (dying node tap) | `/review` | PlannerScreen via history |
| Replant (dead node tap) | `/posts/anchor-post-{anchorId}` | PlannerScreen via history |

The navigation audit (POLISH-03) must walk both paths and confirm hardware back returns to Planner.

### Back-Button Consistency Concerns (for audit)

1. **PostDetailScreen** uses three separate inline `<button onClick={() => navigate(-1)}>` renders (loading state, error state, main render) — each bypasses the `Header` `backTo` mechanism. Hardware back and visual back arrow are both `navigate(-1)` so they agree, but the audit should verify these are consistent.
2. **AnchorDetailScreen** and **ClusterDetailScreen** both use inline `navigate(-1)` buttons (not `backTo`) — hardware back and visual agree, but deep-link entries (e.g. from event bus or graph tap) may have an unexpected `history[-1]`.
3. **QuestionDetailScreen** uses `backTo="/ask"` via Header — navigates to a named route, not `navigate(-1)`. Hardware back goes via history; visual back goes to `/ask` explicitly. If user navigated Ask → PostDetail → QuestionDetail, hardware back would go to PostDetail but visual back goes to `/ask` — mismatch candidate.
4. **SettingsScreen** uses `useNavigate()` but does NOT use `Header` with `backTo` — it is a root swipe-tab slot, so this is correct. Verify the 4 sub-pages all return to `/settings` (not back in history, which could be `/home` or another tab).
5. **ReviewScreen** and **PodcastScreen** use raw `navigate(-1)` inline buttons, not the `Header` component. The audit should verify Header is not missing entirely (may have custom header markup).

---

## Animation Inventory

### framer-motion usage (VERIFIED: live source)

| Location | Mechanism | Properties | Notes |
|----------|-----------|------------|-------|
| `SwipeTabContainer.tsx` | `useMotionValue` + `animate()` spring (stiffness 300, damping 30, mass 0.8) | `translateX` (transform) | Compositor-safe. BottomNavigation tap = `stripX.set()` instant, no animation. |
| `PageTransition.tsx` | `motion.div` variants | `opacity`, `y` (transform) | `initial: {opacity:0, y:24}` → `animate: {opacity:1, y:0}`. 250ms ease. Compositor-safe. |
| `MasonryFeed.tsx` | `<MotionConfig reducedMotion="user">` | Various | Respects `prefers-reduced-motion`. |

### CSS Keyframe Animations (VERIFIED: app/src/index.css)

All 23 `@keyframes` definitions and their call sites:

| Name | Properties Animated | Compositor-Safe? | Call Site |
|------|--------------------|--------------------|-----------|
| `mic-pulse` | transform: scale, opacity | YES | `ChatInput.tsx:129` |
| `spin` | transform: rotate | YES | `ChatInput.tsx:134`, `PlannerScreen.tsx:178`, `GraphScreen.tsx:1321`, `PostDetailScreen.tsx:812`, `PullUpHint.tsx:43` |
| `blink` | opacity | YES | (checked via CSS class) |
| `skeleton-pulse` | opacity | YES | `PostCarousel.tsx:197` |
| `fade-in` | opacity, transform: translateY(-4px) | YES | `ChatMessage.tsx`, `AskScreen.tsx:941`, multiple |
| `slide-in-left` | transform: translateX | YES | `AskScreen.tsx:958` |
| `slide-out-left` | transform: translateX | YES | `AskScreen.tsx:958` |
| `fade-out` | opacity | YES | `AskScreen.tsx:941` |
| `flashcard-flip-in` | opacity, transform: rotateY | YES | `Flashcard.tsx:54` |
| `flashcard-next` | opacity, transform: translateX | YES | `Flashcard.tsx:54` |
| `sub-screen-in` | opacity ONLY | YES (intentionally opacity-only — see inline comment warning not to add transform) | `PodcastScreen.tsx:400` |
| `sub-screen-out` | opacity | YES | CSS class |
| `slide-up` | transform: translateY, opacity | YES | CSS class |
| `shimmer` | transform: translateX | YES | CSS class |
| `glow-pulse` | transform: scale + box-shadow | **PARTIAL JANK** — `box-shadow` triggers paint on every frame | `ConceptCard` / feed tiles |
| `aha-pop` | opacity, transform: scale+rotate | YES | Connection cards |
| `glow-ring` | filter: drop-shadow | **JANK CANDIDATE** — `filter` triggers compositing layer promotion but can cause repaints | Connection card icon |
| `aha-pulse` | box-shadow | **JANK CANDIDATE** — `box-shadow` triggers paint | Connection cards |
| `drill-in-out` | opacity, transform: scale | YES | `.view-drill-in` CSS class |
| `drill-in-enter` | opacity, transform: scale | YES | `.view-drill-enter` CSS class |
| `milestone-pop` | opacity, transform: scale+translateY | YES | `InfoFlow.tsx:788` |
| `node-pop` | opacity + `r` (SVG radius attribute) | **SVG ATTRIBUTE** — `r` is an SVG presentation attribute, not CSS layout; does not trigger layout in Chromium but IS animatable via CSS; safe in SVG context | `app/src/index.css` (SVG use) |
| `edge-draw` | `stroke-dashoffset` | **SVG ATTRIBUTE** — triggers paint but in an SVG element (no layout reflow); acceptable for graph | SVG use |

### Inline-Defined Keyframes (defined in component `<style>` blocks)

| Name | Location | Properties | Compositor-Safe? |
|------|----------|------------|------------------|
| `toast-in` / `toast-out` | `Toast.tsx:122–123` | opacity, transform: translateY | YES |
| `btn-spin` | `Button.tsx:47` | transform: rotate | YES |
| `status-glow` | `TrellisStatusPanel.tsx:127` | box-shadow | **JANK CANDIDATE** — infinite ambient loop animating box-shadow |
| `fruit-fly` | `TrellisStatusPanel.tsx:131` | (check body) | See below |
| `vineLoadingPulse` | `HomeScreen.tsx:1112` | (check body) | Need to verify |
| `bounce` | `AskScreen.tsx:860` | transform: translateY | YES |
| `saved-card-in` | `SavedScreen.tsx:762` | (check body) | Need to verify |
| `pulse` | `PostDetailScreen.tsx:857` | opacity | YES |

### Jank Candidates (audit targets for POLISH-02)

These animations animate non-compositor properties. Each is a candidate finding for D-05 (remove-vs-simplify during operator triage):

1. **`glow-pulse`** — animates `box-shadow` on a per-frame loop. Used on concept cards / vine nodes. Box-shadow changes trigger paint. Simplification: replace with `transform: scale + opacity` only.
2. **`aha-pulse`** — animates `box-shadow` on connection card double-tap. Same issue as above.
3. **`glow-ring`** — animates `filter: drop-shadow` on Aha! icon. Filter forces GPU compositing layer; can jank on mid-tier devices.
4. **`status-glow`** — defined inline in `TrellisStatusPanel.tsx`, animates `box-shadow` in an infinite ambient loop when fruit nodes exist. Runs continuously while fruit is available.
5. **`glow-pulse`**, **`status-glow`**, and any other ambient loops — none verified to have `prefers-reduced-motion` guards. Only `MasonryFeed.tsx` has a `<MotionConfig reducedMotion="user">` wrapper; CSS animations in `index.css` have NO `@media (prefers-reduced-motion: reduce)` block. Flag all ambient loops missing this guard.

### prefers-reduced-motion Gap (VERIFIED: MISSING)

Grepping `app/src/index.css` for `prefers-reduced-motion` returns zero results. [VERIFIED: live source] The CSS animation system has NO reduced-motion media query. Ambient loops (`glow-pulse`, `skeleton-pulse`, `vineLoadingPulse`, `mic-pulse`, `status-glow`) all run regardless of the user's system preference. This is a POLISH-02 finding: add a `@media (prefers-reduced-motion: reduce)` block to index.css disabling or simplifying these.

---

## WebView Performance Budget

**Method (Claude's Discretion — research recommendation):**

No dedicated instrumentation is mandated. The auditor applies the property-class heuristic from the UI-SPEC.md Animation Contract:

1. **Compositor-only = safe:** `transform` (translate, scale, rotate, skew) and `opacity`. These run on the GPU compositor thread without touching the main thread layout or paint.
2. **Paint-triggering = jank on WebView:** `box-shadow`, `background-color`, `border-radius` (when animating), `filter`, `width`, `height`, `top`, `left`, `margin`, `padding`. Android Chromium WebView fires these on the main thread with no compositor bypass.
3. **SVG attributes (`r`, `stroke-dashoffset`):** Chromium handles these without layout reflow in SVG context; acceptable but monitor if used alongside complex paint.
4. **Practical measurement:** DevTools Performance panel in Android Chrome (USB debug) or `chrome://inspect`. Record a 5s window during the suspect animation. Drop below 60fps (frame time > 16ms) on a mid-tier Android device (or emulator at throttled 4x CPU slowdown) is the pass/fail bar.
5. **The "snappy beats janky" rule** (2026-04-15 precedent): when an animation cannot hit the budget, prefer instant (remove) over long/slow, which masks jank. D-05 defers the remove-vs-simplify decision to the operator per animation.

---

## Back-Button Audit Patterns

### Header Component Behavior (VERIFIED: Header.tsx)

The `Header` component uses `SwipeTabContext` to decide portal vs in-tree:
- **Inside SwipeTabContext (swipe-tab roots):** rendered in-tree. These screens have no `backTo` prop — they are root destinations.
- **Outside SwipeTabContext (sub-screens via Outlet):** portaled to `document.body`. Uses `backTo` prop for visual back-arrow, which calls `navigate(backTo)` — a named route, NOT `navigate(-1)`.

### Back-Button Pattern Comparison

| Screen | Visual Back | Hardware Back | Match? | Notes |
|--------|-------------|---------------|--------|-------|
| PostDetailScreen | `navigate(-1)` inline button | `window.history.back()` = `navigate(-1)` equivalent | YES | No Header `backTo` — uses custom back button |
| AnchorDetailScreen | `navigate(-1)` inline button | history.back() | YES | Same pattern as PostDetail |
| ClusterDetailScreen | `navigate(-1)` inline button | history.back() | YES | Same |
| QuestionDetailScreen | `navigate('/ask')` via Header `backTo` | history.back() | **POTENTIAL MISMATCH** | If user came from `/posts/:id` → `/ask/:id`, hardware back goes to `/posts/:id` but visual back goes to `/ask` |
| CollectionDrillInScreen | `navigate('/saved')` via Header `backTo` | history.back() | Depends on entry path | If always entered from SavedScreen, history[-1] = `/saved` → match. If entered from elsewhere (currently no other entry), fine. |
| SavedScreen | `navigate('/home')` via Header `backTo` | history.back() | **POTENTIAL MISMATCH** | SavedScreen is reachable from HomeScreen feed. Visual back always goes to `/home`. Hardware back goes to whatever was in history[-1]. |
| Settings sub-pages | `navigate('/settings')` via Header `backTo` | history.back() | YES if always entered from /settings | Verify no deep-link or event-bus path bypasses /settings as the prior route. |
| ReviewScreen | `navigate(-1)` inline buttons (3 locations) | history.back() | YES | Uses `navigate(-1)` not `backTo` |
| PodcastScreen | `navigate(-1)` inline button | history.back() | YES | |
| OnboardingScreen | No back (gate) | N/A — onboarding is a separate route outside RootLayout | N/A | No `backButton` listener applies; `App.exitApp()` if history.length ≤ 1 |

### Always-Mounted Resync Status (POLISH-03 Nav Audit Item)

| Screen | Has `[location.pathname]` resync? | Verified |
|--------|----------------------------------|---------|
| HomeScreen | YES — three separate resync effects at lines 276, 668, 706 | VERIFIED |
| PlannerScreen | YES — line 53 | VERIFIED |
| GraphScreen | YES — line 1062 | VERIFIED |
| AskScreen | YES — line 425 | VERIFIED |
| SettingsScreen | NOT VERIFIED in grep — no `location.pathname` resync found | NEEDS AUDIT |

SettingsScreen has no service state that changes dynamically (reads `settingsService.getSync()` which is sync), so missing resync may be intentional. The audit should confirm.

---

## CLAUDE.md Drift Verification

**Methodology:** Each load-bearing claim in CLAUDE.md was grep-verified against the live source. Confirmed drifts are flagged for operator approval (D-09). These are DOCS-02 candidates.

### Confirmed Drifts

| # | CLAUDE.md Claim | Actual Code | File | Drift Type |
|---|-----------------|-------------|------|------------|
| DR-01 | "The SQLite connection name `'echolearn'` (in `db.service.ts`)" | `db.service.ts` has been fully migrated to **IndexedDB** (Phase 55, 2026-05-21). `IDB_NAME = 'trellis'`. No SQLite connection exists. No `'echolearn'` string in db.service.ts. | `app/src/services/db.service.ts:190` | CLAUDE.md stale — the SQLite migration removed this; the Brand History note no longer matches the code. |
| DR-02 | "Yesterday-queue snapshot: `STORAGE_KEY_YESTERDAY = 'trellis_post_queue_yesterday'` written by `postQueueService.load()` on date-mismatch." | The yesterday snapshot is stored in **IndexedDB** under key `SQLITE_ROW_ID_YESTERDAY = 'queue_yesterday'` (a `const` at line 29 of post-queue.service.ts). The localStorage key `trellis_post_queue_yesterday` still appears in `db.service.ts:351` in the stale-key purge list — as a key to be DELETED, not written. | `app/src/services/post-queue.service.ts:29`, `db.service.ts:351` | CLAUDE.md stale — storage medium changed from localStorage to IndexedDB in Phase 55. |

### Verified Correct (no drift)

| # | CLAUDE.md Claim | Verified Value | Source |
|---|-----------------|----------------|--------|
| V-01 | `MAX_QUEUE_SIZE = 32` | `const MAX_QUEUE_SIZE = 32` | `post-queue.service.ts:50` |
| V-02 | `REFILL_THRESHOLD = 24` | `const REFILL_THRESHOLD = 24` | `post-queue.service.ts:49` |
| V-03 | `walker maxSteps = Math.max(count * 2, len)` | `const maxSteps = Math.max(count * 2, len)` | `post-queue.service.ts:517` |
| V-04 | `grep -c "enablejsapi=1" app/src/components/YouTubeEmbed.tsx` must return ≥1 | Returns 2 | `YouTubeEmbed.tsx:24` |
| V-05 | `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD = 0.82` | `const ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD = 0.82` | `canonical-knowledge.service.ts:51` |
| V-06 | `ANCHOR_BACKFILL_PER_CLASSIFICATION = 8` | `const ANCHOR_BACKFILL_PER_CLASSIFICATION = 8` | `canonical-knowledge.service.ts:58` |
| V-07 | `MALICIOUS_FLOOR_MIN = 0.35`, `MALICIOUS_FLOOR_MAX = 0.70`, `OFF_TOPIC_MARGIN = 0.02` | All match | `question-filter.service.ts:98–109` |
| V-08 | `html, body { overflow: hidden }` in index.css | Present | `index.css:301` |
| V-09 | `overflowX: 'hidden'` on App root div | Present | `App.tsx:137` |
| V-10 | `onFocusOut` resets `document.scrollingElement.scrollLeft = 0` | Present | `SwipeTabContainer.tsx` (within `onFocusOut`) |
| V-11 | `resync()` gates on `newWidth === screenWidthRef.current` | `if (newWidth === screenWidthRef.current) return;` | `SwipeTabContainer.tsx:132` |
| V-12 | `minWidth: 0` on ChatInput input | `minWidth: 0` at line 178 with load-bearing comment | `ChatInput.tsx:178` |
| V-13 | `USER_ACK_BEFORE_GRAPH_CONTEXT = 'Here is the knowledge graph context for this turn:'` byte-stable | Present as `const` | `useQuestions.ts:217` |
| V-14 | `WEB_SEARCH_TOOL_PROMPT` in system prompt | Present at line 15, used in system prompt at line 203 | `useQuestions.ts` |
| V-15 | Header portal-vs-in-tree split (SwipeTabContext detection) | `const insideSwipeTab = useContext(SwipeTabContext) !== null; return insideSwipeTab ? headerNode : createPortal(headerNode, document.body)` | `Header.tsx:154–155` |

### Candidates Needing Deeper Audit

| # | Claim | Status | Action |
|---|-------|--------|--------|
| C-01 | `postQueueService.load()` writes yesterday snapshot on date-mismatch | Mechanism now called `normalizeState()` not `load()`; function names in CLAUDE.md may be stale | Auditor should verify the CLAUDE.md function name against current code |
| C-02 | `BASE_ENTRIES_PER_CONCEPT` (4 entries per concept, 8 if important) | Referenced in post-queue.service.ts comment but actual constant in `concept-feed.service.ts`; need to grep that file | Low risk if still enforced in behavior |
| C-03 | CLAUDE.md "Concept Feed Generation Pipeline" pipeline and numeric defaults — multiple sub-claims | Broadly consistent with code but some comments in CLAUDE.md reference old function names post-Phase 55 refactor | Light audit scan recommended |
| C-04 | CLAUDE.md § "News post pipeline" — `bodyMarkdown: ''` and `newsMeta.sources[0].snippet` claims | Not verified in this research (out of scope for polish phase) | The polish phase need not verify these; defer to a content-pipeline phase if needed |

---

## Document Inventory

### Documents/ (active directory)

| File | Date | Status | Action |
|------|------|--------|--------|
| `Documents/UI_AUDIT_REPORT.md` | 2026-04-16 | **STALE** — predates i18n, masonry feed, SQLite/IndexedDB migration, Trellis rename | Archive to `Documents/Legacy/` per D-03 |
| `Documents/CHANGELOG_4_05.md` | 2026-04-05 | Historical record | Move to `Documents/Legacy/` — superseded by CHANGELOG_4_16 and CHANGELOG_5_20 |
| `Documents/CHANGELOG_SUMMARY_4_05.md` | 2026-04-05 | Historical summary | Move to `Documents/Legacy/` — same era as CHANGELOG_4_05 |
| `Documents/CHANGELOG_4_16.md` | 2026-04-16 | Historical record — v1.3 era | Move to `Documents/Legacy/` — superseded by CHANGELOG_5_20 |
| `Documents/CHANGELOG_5_20.md` | 2026-05-20 | **CURRENT** — covers v1.4–v1.6 | Keep live |
| `Documents/EMAIL-DRAFT-PROFESSOR.md` | 2026-05-20 | Active draft — recent date | Keep live (non-stale) |
| `Documents/LANDING-VIDEO-SCRIPT.md` | 2026-05-21 | Active draft — most recent date | Keep live |

### .planning/ top-level (stale milestone artifacts)

| File | Date | Status | Action |
|------|------|--------|--------|
| `.planning/v1.1-MILESTONE-AUDIT.md` | 2026-04-10 | v1.1 era — fully superseded | Move to `.planning/milestones/` archive subfolder (follow existing pattern) |
| `.planning/v1.3-INTEGRATION-CHECK.md` | 2026-04-16 | v1.3 era | Move to `.planning/milestones/` (v1.3-phases already has a directory there) |
| `.planning/v1.3-MILESTONE-AUDIT.md` | 2026-04-16 | v1.3 era | Move to `.planning/milestones/` |

### .planning/ codebase docs (live — recently updated)

| File | Date | Status |
|------|------|--------|
| `.planning/codebase/ARCHITECTURE.md` | 2026-05-20 | CURRENT |
| `.planning/codebase/STRUCTURE.md` | (in directory) | Appears current but CONVENTIONS.md still says "Tailwind CSS for UI styling" — may be stale vs CLAUDE.md "Inline styles with CSS variables" pattern |
| `.planning/codebase/CONVENTIONS.md` | (in directory) | **POTENTIAL STALE** — says "Styling: Tailwind CSS" but CLAUDE.md mandates inline styles with CSS vars. Planner should flag this for operator decision: update or note as aspirational. |
| `.planning/research/` (all 5 files) | 2026-05-20 | Scoped to v1.7 Rewards Shop — explicitly note scope exclusion at top of SUMMARY.md. Not stale for their purpose. |
| `.planning/notes/` (3 files) | Various | Active notes; keep live |

### .planning/milestones/ (legacy milestone artifacts now in subdirectory)

| Folder | Status |
|--------|--------|
| `v1.0-phases/`, `v1.1-phases/`, `v1.2-phases/`, `v1.3-phases/` | Historical; already in milestones/ subdirectory — no action needed |
| `v1.4-*`, `v1.5-*`, `v1.6-*` files | Active milestone records — keep |

---

## Color Drift Candidates

Hardcoded hex values in source files that may break dark-mode parity (candidates for the 6-pillar Color audit):

| Location | Value | Should Be |
|----------|-------|-----------|
| `PlannerScreen.tsx:214` | `color: '#4CAF50'` (Sprout icon) | `var(--primary-40)` (dark-mode remaps to `#4CAF50` so this is technically fine in dark mode but inconsistent with the token convention) |
| `PlannerScreen.tsx:264` | `color: '#66BB6A'` (Heart icon) | Closest var: `var(--primary-40)` or a node color |
| `InfoFlow.tsx:392,608` | `backgroundColor: '#f59e0b'` (amber dot) | `var(--secondary-40)` (FFD54F/amber) — note: `#f59e0b` is amber but not the exact token value |
| `InfoFlow.tsx:734,752` | `color: '#ffffff'` (text-art text) | `#ffffff` may be intentional (white on colored background); audit should check if dark-mode inverts the background color |
| `Flashcard.tsx:25–28` | `#FF8A65`, `#FFD54F`, `#9CCC65`, `#558B2F` | Flashcard rating colors — functional semantic colors. `#558B2F` = `--primary-40`; others may not have token equivalents. Audit should decide: add tokens or accept hardcoded functional colors. |
| `CollectionPickerSheet.tsx:414,452` | `color: '#fff'` | White on accent background — likely intentional; check dark mode. |
| `ConceptCard.tsx:12` | `color: '#ef4444'` in badge prop type comment | Just a type example in a comment, not a runtime value. No action. |

---

## Animation Issues: Missing Keyframe Definitions

The following `animation:` references use keyframe names defined outside `index.css` (inline `<style>` blocks in components). This pattern is valid but means the audit must check each inline block:

| Animation Name | Defined In | Risk |
|---------------|------------|------|
| `toast-in`, `toast-out` | `Toast.tsx:122–123` | OK — transform+opacity only |
| `btn-spin` | `Button.tsx:47` | OK — transform only |
| `status-glow` | `TrellisStatusPanel.tsx:127` | **JANK** — box-shadow infinite loop |
| `fruit-fly` | `TrellisStatusPanel.tsx:131` | Need to verify body — may use transform |
| `vineLoadingPulse` | `HomeScreen.tsx:1112` | Need to verify body — likely opacity/transform |
| `bounce` | `AskScreen.tsx:860` | OK — transform: translateY only |
| `saved-card-in` | `SavedScreen.tsx:762` | Need to verify body |
| `pulse` | `PostDetailScreen.tsx:857` | OK — opacity only |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sub-screen slide-in transition | Custom CSS keyframe with translate | `PageTransition.tsx` (already exists — framer-motion opacity+y) | Already solved; adding a new CSS transition risks Header ancestor violations |
| Tab strip animation | New spring config | Existing SPRING constant in SwipeTabContainer | 2026-04-15 revert precedent: "snappy beats janky" |
| prefers-reduced-motion | Per-component JS check | Single `@media (prefers-reduced-motion: reduce)` block in index.css | One place, covers all CSS animations |
| Hardware back override | Separate Capacitor listener per screen | Global App.tsx `backButton` listener + react-router history | Already wired; per-screen listeners create teardown race conditions |

---

## Common Pitfalls

### Pitfall 1: Header Ancestor Transform (recurring — 6+ times)
**What goes wrong:** Adding `transform`, `will-change`, `filter`, `contain`, or `perspective` to any ancestor of a `Header` component causes `position: fixed` to re-parent its containing block, making the Header scroll with the page or appear at wrong coordinates.
**Why it happens:** CSS spec: `position: fixed` is relative to the nearest containing block creator. Transform etc. create containing blocks.
**How to avoid:** Never add these properties to ancestors of Header when fixing animation jank. Fix at the animated element itself.
**Warning signs:** Header visually jumps or is positioned mid-screen.

### Pitfall 2: `navigate(-1)` vs `navigate(path)` Mismatch
**What goes wrong:** Visual back arrow (`navigate(path)` via `backTo`) and hardware back (`window.history.back()`) go to different destinations when the user arrived via an unusual path (e.g., event-bus push, deep link, or `replace: true`).
**Why it happens:** `navigate(path)` always resolves to the same logical parent; `history.back()` goes to whatever was before in the stack.
**How to avoid:** Use `backTo` (named path) for screens that always have a known parent. Use `navigate(-1)` only when the prior screen is always the correct parent.
**Warning signs:** User presses back and ends up on a different screen than the back-arrow would take them.

### Pitfall 3: Ambient Loop Jank on box-shadow
**What goes wrong:** `box-shadow` changes in keyframe animations run on the main thread. On a mid-tier Android WebView, an infinite loop animating `box-shadow` (e.g., `glow-pulse`, `status-glow`, `aha-pulse`) can cause steady dropped frames.
**Why it happens:** box-shadow forces paint (rasterization) on every frame; no compositor shortcut in Chromium WebView.
**How to avoid:** Replace `box-shadow` glow effects with `transform: scale + opacity` only, or `filter: drop-shadow` (which promotes to compositor layer). Alternatively, remove for `prefers-reduced-motion`.
**Warning signs:** Profiler shows consistent main-thread paint > 6ms coinciding with glow animations.

### Pitfall 4: Always-Mounted Screens Not Re-Reading State
**What goes wrong:** A swipe-tab root shows stale data after returning from a sub-screen that mutated service state.
**Why it happens:** `useState(() => svc.get())` initializers run once at mount; always-mounted screens never remount.
**How to avoid:** Every always-mounted screen must add a `useEffect` with `[location.pathname]` dep that re-reads relevant service state.
**Warning signs:** UI shows pre-navigation values after returning to a tab.

### Pitfall 5: prefers-reduced-motion Gap
**What goes wrong:** Users with vestibular disorders / reduced-motion OS settings still see all ambient loop animations.
**Why it happens:** index.css has no `@media (prefers-reduced-motion: reduce)` block at all.
**How to avoid:** Add one media query block in index.css that sets `animation: none` for ambient loops. framer-motion's `MasonryFeed` already uses `<MotionConfig reducedMotion="user">` — match this for CSS animations.
**Warning signs:** WCAG 2.3.3 / platform accessibility audit flags spinning/pulsing animations.

---

## Code Examples

### Pattern: Correct Header Usage (Sub-Screen)
```typescript
// Source: app/src/screens/settings/SettingsAIScreen.tsx
<Header title={t('settings.titles.aiModels')} backTo="/settings" />
// Header auto-portals to document.body outside SwipeTabContext
// backTo navigates to named route, not history
```

### Pattern: Incorrect Header Ancestor Usage (DO NOT DO)
```typescript
// WRONG — adding transform to a Header ancestor breaks portal positioning
<div style={{ transform: 'translateZ(0)' }}>
  <Header ... />   // position:fixed will re-parent to this div
</div>
```

### Pattern: resync on navigation (always-mounted canonical)
```typescript
// Source: app/src/screens/HomeScreen.tsx:276
useEffect(() => {
  if (location.pathname !== '/home') return;
  const posts = conceptFeedService.getCachedDailyPosts() ?? postQueueService.getYesterdayQueue();
  setDailyPosts(posts);
}, [location.pathname]);
```

### Pattern: prefers-reduced-motion (to add)
```css
/* Source: app/src/index.css — currently MISSING, needs to be added */
@media (prefers-reduced-motion: reduce) {
  .mic-pulse,
  .skeleton-pulse,
  .glow-pulse,
  .vineLoadingPulse,
  /* etc — ambient loops */ {
    animation: none;
  }
}
```

### Pattern: compositor-safe glow (replace box-shadow with transform+opacity)
```css
/* BEFORE (jank) */
@keyframes glow-pulse {
  50% { box-shadow: 0 0 0 6px ...; transform: scale(1.25); }
}
/* AFTER (compositor-safe) */
@keyframes glow-pulse {
  50% { transform: scale(1.25); opacity: 0.6; }  /* no box-shadow */
}
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` with esbuild tsx loader |
| Config file | `app/package.json` `scripts.test` |
| Quick run command | `cd app && node --test tests/layout/root-horizontal-clip.test.mjs tests/components/ChatInput.flex-shrink.test.mjs tests/components/SwipeTabContainer.resize-guard.test.mjs` |
| Full suite command | `cd app && npm test` (215 test files) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POLISH-01 | 6-pillar visual audit | manual | n/a (agent visual audit produces findings list) | N/A |
| POLISH-02 | Animation compositor compliance | manual + source-reading | `node --test tests/layout/root-horizontal-clip.test.mjs` guards the Header ancestor invariant | Partial — existing tests guard load-bearing invariants; no test for animation property choices |
| POLISH-03 | Back-button consistency | manual + source-reading | `node --test tests/components/SwipeTabContainer.resize-guard.test.mjs` | Partial |
| DOCS-01 | Stale docs archived | manual | n/a (file-system check) | N/A |
| DOCS-02 | CLAUDE.md drift corrected | source-reading + grep | see Drift Verification table above | N/A |

**Load-bearing test guards (must stay green throughout):**
- `tests/layout/root-horizontal-clip.test.mjs` — guards overflow:hidden on both axes + App root overflowX + onFocusOut scrollLeft reset
- `tests/components/ChatInput.flex-shrink.test.mjs` — guards `minWidth: 0` on ChatInput input
- `tests/components/SwipeTabContainer.resize-guard.test.mjs` — guards width-change early return in resync()
- `tests/components/InfoFlow.video-tap-emit.test.mjs` — negative invariants for inline-play; must stay passing

### Sampling Rate
- **Per task commit:** `cd app && node --test tests/layout/root-horizontal-clip.test.mjs tests/components/ChatInput.flex-shrink.test.mjs tests/components/SwipeTabContainer.resize-guard.test.mjs`
- **Per wave merge:** `cd app && npm test && tsc -b --noEmit`
- **Phase gate:** Full suite + `tsc` green before `/gsd:verify-work`

### Wave 0 Gaps
None — this phase produces findings lists and source-reading reports, not new code. No new test files are expected in Wave 0. Fix waves (Wave 2+) may need source-guard tests for specific animation property corrections.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | test suite | ✓ | (system) | — |
| framer-motion | SwipeTabContainer, PageTransition, MasonryFeed | ✓ | 12.38.0 (package.json) | — |
| react-router-dom | All navigation | ✓ | 7.15.0 (package.json) | — |
| Capacitor App plugin | Android back-button handler | ✓ | 8.0.1 (package.json) | Gracefully skipped on non-native |

**Missing dependencies:** None for this phase. Phase is code audit + doc operations only.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fruit-fly`, `vineLoadingPulse`, `saved-card-in` keyframe bodies not fully verified (body content assumed from name) | Animation Inventory | Could be jank-free or jank-triggering; auditor must read inline style blocks during Wave 0 |
| A2 | SettingsScreen has no `[location.pathname]` resync because it reads only sync `settingsService.getSync()` | Back-Button Audit | If SettingsScreen displays dynamic data (credits, active provider) that can change while away, it may show stale state |
| A3 | `.planning/codebase/CONVENTIONS.md` is genuinely stale (says "Tailwind CSS") | Document Inventory | Could be intentionally aspirational; operator must confirm archive vs update |
| A4 | `normalizeState()` is the current function handling yesterday snapshot (was `load()` per CLAUDE.md) | CLAUDE.md Drift | Low risk — behavior is same, name drift is doc-only |

---

## Open Questions

1. **Should `Documents/CHANGELOG_4_05.md` and `CHANGELOG_SUMMARY_4_05.md` move to Legacy/, or are they kept for historical record?**
   - What we know: They predate CHANGELOG_4_16 and CHANGELOG_5_20. The Legacy/ convention exists.
   - What's unclear: Whether the operator wants all older changelogs preserved at top level or only the most recent.
   - Recommendation: Move to Documents/Legacy/ per D-08 (stale = archive). Keep CHANGELOG_5_20 live.

2. **DR-01 drift resolution: is the CLAUDE.md "Brand History" note about `'echolearn'` SQLite connection a code regression (should IndexedDB use `'echolearn'` for backwards compat?) or a stale doc (IDB uses `'trellis'` and that's correct)?**
   - What we know: `IDB_NAME = 'trellis'` in db.service.ts:190. The old `'echolearn'` SQLite database was a separate Capacitor-SQLite plugin database. IndexedDB is a different storage mechanism and starting fresh with `'trellis'` is the correct choice for a migration.
   - Recommendation: This is a stale doc — the backwards compat note was about the SQLite connection (now gone); the IndexedDB name `'trellis'` is correct and needs no preservation. Present to operator per D-09 to confirm.

3. **Is `glow-ring` (filter: drop-shadow) actually jank on mid-tier Android, or does GPU compositing handle it acceptably?**
   - What we know: `filter` forces compositing layer promotion (GPU work, not CPU paint) but costs VRAM bandwidth. On mid-tier Android it may be fine at 250ms bursts but problematic if run frequently.
   - Recommendation: Flag as candidate finding; leave remove-vs-keep to operator per D-05.

---

## Sources

### Primary (HIGH confidence)
- `app/src/App.tsx` — route definitions, Android back-button handler
- `app/src/components/ui/Header.tsx` — portal-vs-in-tree split, backTo prop
- `app/src/components/SwipeTabContainer.tsx` — framer-motion spring, resync() guard
- `app/src/components/PageTransition.tsx` — sub-screen transition
- `app/src/index.css` — all CSS keyframe animation definitions
- `app/src/services/post-queue.service.ts` — MAX_QUEUE_SIZE, REFILL_THRESHOLD, SQLITE_ROW_ID_YESTERDAY
- `app/src/services/db.service.ts` — IDB_NAME='trellis', storage backend (IndexedDB, not SQLite)
- `app/src/services/question-filter.service.ts` — MALICIOUS_FLOOR constants
- `app/src/services/canonical-knowledge.service.ts` — ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD
- `app/src/components/YouTubeEmbed.tsx` — enablejsapi count
- `app/src/state/useQuestions.ts` — USER_ACK_BEFORE_GRAPH_CONTEXT, WEB_SEARCH_TOOL_PROMPT
- `app/tests/layout/root-horizontal-clip.test.mjs` — what the layout test actually guards
- `app/package.json` — dependency versions (framer-motion 12.38, react-router-dom 7.15)
- All screen files in `app/src/screens/` and `app/src/screens/settings/`

### Secondary (MEDIUM confidence)
- CLAUDE.md — load-bearing section claims (verified against code above)
- `.planning/phases/56-ui-polish-documentation/56-CONTEXT.md` — locked decisions
- `.planning/phases/56-ui-polish-documentation/56-UI-SPEC.md` — design system tokens, animation contract
- `.planning/REQUIREMENTS.md` — requirement definitions

---

## Metadata

**Confidence breakdown:**
- Screen inventory: HIGH — all files directly enumerated from filesystem
- Route map: HIGH — read directly from App.tsx router definition
- Animation inventory: HIGH for keyframe names/properties; MEDIUM for 3 inline-defined keyframe bodies not fully read (fruit-fly, vineLoadingPulse, saved-card-in)
- Back-button audit patterns: HIGH for structure; MEDIUM for untested edge cases (deep-link entries)
- CLAUDE.md drift: HIGH for DR-01 and DR-02 (confirmed); MEDIUM for C-01..C-04 (candidates)
- Document staleness: HIGH (file dates checked directly)

**Research date:** 2026-05-21
**Valid until:** 2026-06-20 (stable codebase; 30-day window before Phase 57 starts rewiring storage/service layer)
