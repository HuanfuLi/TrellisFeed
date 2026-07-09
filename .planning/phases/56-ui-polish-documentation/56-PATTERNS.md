# Phase 56: UI Polish & Documentation — Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 23 (18 screen files + 5 shared/infra files)
**Analogs found:** 23 / 23 (all files are their own primary analog — sweep/audit phase modifies existing files, not new ones)

---

## Phase Nature Note

Phase 56 is a sweep/audit + reconciliation phase. It does NOT create new files. Every target
file below is its OWN canonical reference. The "analog" for each is the existing convention
that must be PRESERVED or fixed-to-match — not a foreign pattern to copy in. The planner
assigns fixes against these anchors: inline-style + CSS-variable design system, load-bearing
invariant guards, and the concrete code excerpts below.

---

## File Classification

| File | Role | Data Flow | Fix Track | Match Quality |
|------|------|-----------|-----------|---------------|
| `app/src/index.css` | animation source | event-driven | POLISH-02 (add `prefers-reduced-motion`; fix jank keyframes) | self-analog |
| `app/src/components/ui/Header.tsx` | shared component | request-response | POLISH-03 (portal-vs-in-tree guard — do not regress) | self-analog |
| `app/src/App.tsx` | nav source | request-response | POLISH-03 (Android back handler, root overflow clip guard) | self-analog |
| `app/src/components/SwipeTabContainer.tsx` | shared component | event-driven | POLISH-03 (resync guard — do not regress) | self-analog |
| `app/src/components/PageTransition.tsx` | shared component | request-response | POLISH-02 (reference-only; already compositor-safe) | self-analog |
| `app/src/components/ChatInput.tsx` | shared component | request-response | POLISH-01/invariant guard (minWidth:0 must not regress) | self-analog |
| `app/src/screens/HomeScreen.tsx` | screen | CRUD + event-driven | POLISH-01 (visual audit), POLISH-03 (always-mounted resync pattern) | self-analog |
| `app/src/screens/AskScreen.tsx` | screen | request-response | POLISH-01 (visual audit), POLISH-02 (`bounce` inline keyframe — OK) | self-analog |
| `app/src/screens/PlannerScreen.tsx` | screen | CRUD | POLISH-01 (hardcoded hex color drift — `'#4CAF50'`, `'#66BB6A'`) | self-analog |
| `app/src/screens/GraphScreen.tsx` | screen | CRUD + event-driven | POLISH-01 (visual audit), POLISH-03 (resync verified) | self-analog |
| `app/src/screens/SettingsScreen.tsx` | screen | request-response | POLISH-03 (no `[location.pathname]` resync — audit if needed) | self-analog |
| `app/src/screens/PostDetailScreen.tsx` | screen | request-response | POLISH-01 (visual audit), POLISH-02 (`pulse` inline — OK), POLISH-03 (back via `navigate(-1)`) | self-analog |
| `app/src/screens/QuestionDetailScreen.tsx` | screen | request-response | POLISH-03 (back mismatch candidate: `backTo="/ask"` vs history) | self-analog |
| `app/src/screens/AnchorDetailScreen.tsx` | screen | CRUD | POLISH-01 (visual audit), POLISH-03 (inline `navigate(-1)`) | self-analog |
| `app/src/screens/ClusterDetailScreen.tsx` | screen | CRUD | POLISH-01 (visual audit), POLISH-03 (inline `navigate(-1)`) | self-analog |
| `app/src/screens/CollectionDrillInScreen.tsx` | screen | CRUD | POLISH-01 (visual audit), POLISH-03 (`backTo="/saved"`) | self-analog |
| `app/src/screens/ReviewScreen.tsx` | screen | CRUD | POLISH-01 (visual audit), POLISH-03 (`navigate(-1)` inline) | self-analog |
| `app/src/screens/PodcastScreen.tsx` | screen | CRUD + streaming | POLISH-01 (visual audit), POLISH-02 (`sub-screen-in` opacity-only — verify not regressed) | self-analog |
| `app/src/screens/SavedScreen.tsx` | screen | CRUD | POLISH-01 (visual audit), POLISH-02 (`saved-card-in` — transform+opacity, OK), POLISH-03 (`backTo="/home"` mismatch candidate) | self-analog |
| `app/src/screens/OnboardingScreen.tsx` | screen | request-response | POLISH-01 (visual audit), POLISH-03 (no back — gate screen) | self-analog |
| `app/src/screens/settings/SettingsAIScreen.tsx` | screen | request-response | POLISH-01 (visual audit), POLISH-03 (`backTo="/settings"`) | self-analog |
| `app/src/screens/settings/SettingsContentScreen.tsx` | screen | request-response | POLISH-01 (visual audit), POLISH-03 (`backTo="/settings"`) | self-analog |
| `app/src/screens/settings/SettingsFeaturesScreen.tsx` | screen | request-response | POLISH-01 (visual audit), POLISH-03 (`backTo="/settings"`) | self-analog |
| `app/src/screens/settings/SettingsDataScreen.tsx` | screen | request-response | POLISH-01 (visual audit), POLISH-03 (`backTo="/settings"`) | self-analog |
| `app/src/components/trellis/TrellisStatusPanel.tsx` | shared component | event-driven | POLISH-02 (`status-glow` inline keyframe — JANK: box-shadow infinite loop) | self-analog |
| `app/src/components/InfoFlow.tsx` | shared component | event-driven | POLISH-01 (hardcoded hex `'#f59e0b'`, `'#ffffff'`; tile simplicity bias), POLISH-02 (`glow-pulse`, `aha-pulse`, `glow-ring` jank candidates) | self-analog |
| `Documents/` (stale files) | doc | — | DOCS-01 (archive to `Documents/Legacy/`) | n/a |
| `.planning/` (stale milestones) | doc | — | DOCS-01 (archive to `.planning/milestones/`) | n/a |
| `CLAUDE.md` | doc | — | DOCS-02 (drift report; DR-01 SQLite claim, DR-02 localStorage key claim) | n/a |

---

## Pattern Assignments

### Load-Bearing Invariants (MUST NOT REGRESS in any fix)

These patterns are the acceptance contract for every fix in Phase 56. A fix that violates
any of these is an automatic FAIL regardless of the polish improvement it delivers.

---

### 1. Header portal-vs-in-tree split

**Source:** `app/src/components/ui/Header.tsx` lines 154–155

```typescript
// Detection: SwipeTabContext is provided ONLY by SwipeTabContainer (strip slots).
// Sub-screens rendered through Outlet are siblings of SwipeTabContainer (ctx === null).
const insideSwipeTab = useContext(SwipeTabContext) !== null;
return insideSwipeTab ? headerNode : createPortal(headerNode, document.body);
```

**Rule:** Never add `transform` / `will-change` / `filter` / `contain` / `perspective` to
any ancestor of a `Header` component. Sub-screen Headers portal to `document.body`; swipe-tab
root Headers render in-tree anchored to the slot's `translateZ(0)` containing block.

**backTo prop pattern** (Header.tsx lines 61–65):
```typescript
const effectiveLeft = left ?? (backTo ? (
  <button onClick={() => navigate(backTo)} style={{ background: 'none', border: 'none',
    padding: '8px', marginLeft: '-8px', color: 'var(--primary-40)',
    display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
    <ArrowLeft size={20} />
  </button>
) : undefined);
```

**Sub-screen canonical usage** (SettingsAIScreen.tsx line 6, pattern applies to all settings sub-screens):
```typescript
import { Header } from '../../components/ui/Header';
// ...
<Header title={t('settings.titles.aiModels')} backTo="/settings" />
// Header auto-portals to document.body outside SwipeTabContext
// backTo navigates to the named route, not history
```

**Critical warning in index.css** (lines 486–492) — `sub-screen-in` keyframe comment:
```css
/* Opacity-only — DO NOT add `transform` here. The wrapper that runs this
   animation hosts position:fixed Header descendants; a transformed ancestor
   re-parents their containing block (CSS spec) and causes Header to flicker
   from mid-screen to top edge during the 200ms window. */
@keyframes sub-screen-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

---

### 2. Root overflow clip — both axes

**Source:** `app/src/index.css` lines 300–302 (primary layer):
```css
html, body {
  overflow: hidden;
}
```

**Source:** `app/src/App.tsx` line 137 (React-layer belt):
```typescript
<div style={{ minHeight: '100vh', backgroundColor: 'var(--surface)', overflowX: 'hidden' }}>
```

**Source:** `app/src/components/SwipeTabContainer.tsx` — `onFocusOut` resets `document.scrollingElement.scrollLeft = 0` (recovery path — must not be removed).

---

### 3. SwipeTabContainer resync() width-change gate

**Source:** `app/src/components/SwipeTabContainer.tsx` lines 130–132:
```typescript
const resync = () => {
  const newWidth = getScreenWidth();
  if (newWidth === screenWidthRef.current) return; // height-only (e.g. keyboard) → no-op
  screenWidthRef.current = newWidth;
  // ...
};
```

**Spring constant** (SwipeTabContainer.tsx line 39):
```typescript
const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 };
```

BottomNavigation tap uses `stripX.set()` (instant, no animation) — the "snappy beats janky" precedent.

---

### 4. ChatInput flex shrink — minWidth:0

**Source:** `app/src/components/ChatInput.tsx` lines 169–178:
```typescript
style={{
  flex: 1,
  // Phase 33 UAT-4 fix (2026-04-20): minWidth: 0 is load-bearing.
  // Without it, the input's flex-basis: auto defaults to intrinsic
  // content width, which Android WebView refuses to shrink below.
  // The flexShrink:0 send button then overflows off-screen.
  // Do NOT remove without replacing the flex-shrink guarantee.
  minWidth: 0,
  background: 'transparent',
  color: 'var(--foreground)',
}}
```

---

### 5. Always-mounted resync on navigation

**Source:** `app/src/screens/HomeScreen.tsx` lines 275–303 (canonical pattern):
```typescript
useEffect(() => {
  if (location.pathname !== '/home') return;
  const cached = conceptFeedService.getCachedDailyPosts();
  if (cached.length > 0) {
    setDailyPosts(cached);
    infiniteScrollService.seedSeen(cached.map(p => p.id));
    return;
  }
  // Tier-2 fallback: yesterday's UNSERVED queue
  postQueueService.loadQueue();
  const yesterdayQueue = postQueueService.getYesterdayQueue();
  if (yesterdayQueue.length > 0) {
    const slice = yesterdayQueue.slice(0, 8);
    setDailyPosts(slice);
    // ...
    return;
  }
  // Both tiers empty — set to empty
  setDailyPosts([]);
}, [location.pathname]);
```

**Verified resync coverage:**
- HomeScreen: three resync effects at lines 276, 668, 706 — VERIFIED
- PlannerScreen: line 53 — VERIFIED
- GraphScreen: line 1062 — VERIFIED
- AskScreen: line 425 — VERIFIED
- SettingsScreen: no `[location.pathname]` resync found — AUDIT TARGET (may be intentional; reads only sync `settingsService.getSync()`)

---

## Shared Patterns

### Inline-Style + CSS-Variable Design System

**Source:** `app/src/index.css` `:root` block (lines 1–141) and component files throughout.

This is the locked standard for all polish fixes. Never introduce raw hex where a token exists.
Never use Tailwind utility classes for layout/color/spacing (CLAUDE.md mandate).

**Spacing tokens** (index.css lines 104–118):
```css
--space-xs: 4px;   /* icon gaps, inline padding */
--space-sm: 8px;   /* compact element spacing */
--space-md: 12px;  /* tight element spacing */
--space-lg: 16px;  /* default element spacing */
--space-xl: 20px;  /* card / row padding */
--space-2xl: 24px; /* section padding (= --section-gap) */
--space-3xl: 32px; /* layout gaps / major section breaks */
--section-gap: 24px;
--bottom-nav-safe: calc(80px + var(--safe-area-bottom));
```

**Color tokens** (index.css lines 9–80, partial):
```css
--primary-40: #558B2F;       /* Trellis green — CTAs, active states, progress */
--secondary-40: #FFD54F;     /* amber — fruit credits, harvest reward */
--surface: #FFFBF5;          /* app background */
--surface-variant: #F5F0E8;  /* cards, rows, nav, settings panels */
--muted-foreground: #6B6B6B; /* secondary text */
--danger: #E53935;           /* destructive actions ONLY */
--shadow-1/2/3: ...          /* named shadow tiers; never ad-hoc box-shadow */
```

**Token-only rule for polish fixes:** Replace any hardcoded hex that has a token equivalent.
Identified drift candidates:
- `PlannerScreen.tsx:214` `color: '#4CAF50'` → `var(--primary-40)` (dark-mode remaps to `#4CAF50`, consistent)
- `PlannerScreen.tsx:264` `color: '#66BB6A'` → nearest: `var(--primary-40)` or node color
- `InfoFlow.tsx:392,608` `backgroundColor: '#f59e0b'` → `var(--secondary-40)` (`#FFD54F` amber)

---

### SettingsShared.tsx — Sub-Screen Component Pattern

**Source:** `app/src/screens/settings/SettingsShared.tsx` lines 1–80

All 4 settings sub-pages use this shared component library. Fixes to settings sub-screens
must stay consistent with these components.

**SectionHeader pattern** (lines 5–11):
```typescript
export function SectionHeader({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px',
      marginBottom: '12px', marginTop: '24px' }}>
      <div style={{ color: 'var(--primary-40)' }}>{icon}</div>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
    </div>
  );
}
```

**SettingRow pattern** (lines 14–24):
```typescript
export function SettingRow({ label, description, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: '16px',
      padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500, marginBottom: description ? '2px' : 0 }}>{label}</p>
        {description && <p style={{ fontSize: '0.75rem',
          color: 'var(--muted-foreground)' }}>{description}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
```

---

### PageTransition — Sub-Screen Enter Animation

**Source:** `app/src/components/PageTransition.tsx` lines 1–36

Compositor-safe (opacity + y transform only). This is the reference for any sub-screen
transition fix — do not add new CSS keyframes for sub-screen slide-in; use this.

```typescript
const variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
};
// transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }
```

---

### Android Back-Button Handler

**Source:** `app/src/App.tsx` lines 413–425:
```typescript
// Android hardware back button — navigate back in history, or exit app at root
useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;
  let listenerHandle: Awaited<ReturnType<typeof CapApp.addListener>> | null = null;
  void CapApp.addListener('backButton', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      void CapApp.exitApp();
    }
  }).then((handle) => { listenerHandle = handle; });
  return () => { void listenerHandle?.remove(); };
}, []);
```

**Rule:** There is ONE global `backButton` listener in App.tsx. Per-screen listeners create
teardown race conditions. Do not add per-screen Capacitor `backButton` listeners.

**Back-button consistency concerns (audit targets):**
1. `QuestionDetailScreen` uses `backTo="/ask"` via Header; hardware back uses `history.back()`. If user path was `/ask` → `/posts/:id` → `/ask/:id`, hardware back goes to `/posts/:id` but visual back goes to `/ask` — mismatch candidate.
2. `SavedScreen` uses `backTo="/home"` via Header. If user entered from non-home path, visual and hardware back disagree — mismatch candidate.
3. `PostDetailScreen`, `AnchorDetailScreen`, `ClusterDetailScreen`, `ReviewScreen`, `PodcastScreen` all use inline `navigate(-1)` — hardware and visual agree; verify history entries from event-bus navigations.

---

## Animation Patterns (POLISH-02)

### Compositor-Safe Keyframe Reference

All safe patterns animate only `transform` and `opacity`. These are the reference:

**Safe — in `app/src/index.css`:**
```css
@keyframes mic-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.8; } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slide-in-left { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes milestone-pop { 0% { opacity: 0; transform: scale(0.92) translateY(12px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
```

**Safe — inline in components:**
- `bounce` (AskScreen.tsx:860): `transform: translateY` only — OK
- `saved-card-in` (SavedScreen.tsx:762): `opacity + transform: translateY` — OK
- `vineLoadingPulse` (HomeScreen.tsx:1112): `opacity` only — OK
- `pulse` (PostDetailScreen.tsx:857): `opacity` only — OK
- `fruit-fly` (TrellisStatusPanel.tsx:131): `transform: translate + scale`, `opacity` — OK

### Jank Candidates (fix targets — operator triage required per D-05)

**`glow-pulse` — JANK** (`app/src/index.css` lines 512–521):
```css
/* CURRENT — animates box-shadow on every frame */
@keyframes glow-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary-40) 50%, transparent);
  }
  50% {
    transform: scale(1.25);
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--primary-40) 0%, transparent);
  }
}
/* FIX PATTERN — remove box-shadow, keep transform+opacity */
@keyframes glow-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.25); opacity: 0.6; }
}
```

**`aha-pulse` — JANK** (`app/src/index.css` lines 538–542):
```css
/* CURRENT — animates box-shadow only */
@keyframes aha-pulse {
  0%   { box-shadow: 0 0 0 0   color-mix(in srgb, var(--primary-40) 70%, transparent); }
  50%  { box-shadow: 0 0 0 20px color-mix(in srgb, var(--primary-40) 0%,  transparent); }
  100% { box-shadow: 0 0 0 0   color-mix(in srgb, var(--primary-40) 0%,  transparent); }
}
/* FIX PATTERN — replace with scale+opacity ring simulation */
@keyframes aha-pulse {
  0%   { transform: scale(1); opacity: 0.7; }
  50%  { transform: scale(1.15); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}
```

**`glow-ring` — JANK CANDIDATE** (`app/src/index.css` lines 532–535):
```css
/* Animates filter: drop-shadow — forces compositing layer, can cause repaints on mid-tier */
@keyframes glow-ring {
  0%, 100% { filter: drop-shadow(0 0 0 transparent); }
  40%       { filter: drop-shadow(0 0 18px rgba(76,175,80,0.9)); }
}
/* FIX PATTERN (if decided): use opacity on the glow layer instead */
```

**`status-glow` — JANK** (`app/src/components/trellis/TrellisStatusPanel.tsx` lines 127–129):
```typescript
// Inline <style> in TrellisStatusPanel.tsx
@keyframes status-glow {
  0%, 100% { box-shadow: 0 2px 8px rgba(232,168,56,0.3); }
  50%      { box-shadow: 0 2px 18px rgba(232,168,56,0.55); }
}
// Used as: animation: fruitNodes.length > 0 ? 'status-glow 3s ease-in-out infinite' : undefined
// JANK: box-shadow infinite ambient loop
// FIX PATTERN: animate via transform: scale + opacity on a pseudo or overlay element
```

### prefers-reduced-motion Gap — Missing Block

**Source:** `app/src/index.css` — currently ZERO `prefers-reduced-motion` entries (VERIFIED).

**Fix target:** Add a single `@media (prefers-reduced-motion: reduce)` block in `index.css`
covering ALL ambient loops. This is the one-place solution — no per-component JS checks needed.

```css
/* TO ADD — at end of animation section in index.css */
@media (prefers-reduced-motion: reduce) {
  /* Disable ambient loops for users with vestibular/motion sensitivity */
  *[style*="mic-pulse"],
  *[style*="glow-pulse"],
  *[style*="skeleton-pulse"],
  *[style*="status-glow"],
  *[style*="blink"] {
    animation: none !important;
  }
  /* CSS class-applied ambient animations */
  .mic-pulse,
  .skeleton-pulse,
  .glow-pulse {
    animation: none !important;
  }
}
```

Note: framer-motion ambient animations in `MasonryFeed.tsx` already use
`<MotionConfig reducedMotion="user">` (verified) — match this for CSS animations.

---

## Documentation Patterns (DOCS-01, DOCS-02)

### Archive Convention

**Source:** `Documents/Legacy/` (existing directory — confirmed by git status showing archived files).

**Rule (D-08):** Move stale docs to `Legacy/`, never delete. Copy the existing hierarchy:
- `Documents/` stale files → `Documents/Legacy/`
- `.planning/` stale milestone files → `.planning/milestones/` (follow existing v1.0–v1.3 subdirectory pattern)

**Confirmed archive targets:**
- `Documents/UI_AUDIT_REPORT.md` (Apr 16) → `Documents/Legacy/` (D-03 locked)
- `Documents/CHANGELOG_4_05.md` → `Documents/Legacy/`
- `Documents/CHANGELOG_SUMMARY_4_05.md` → `Documents/Legacy/`
- `Documents/CHANGELOG_4_16.md` → `Documents/Legacy/`
- `.planning/v1.1-MILESTONE-AUDIT.md` → `.planning/milestones/`
- `.planning/v1.3-INTEGRATION-CHECK.md` → `.planning/milestones/`
- `.planning/v1.3-MILESTONE-AUDIT.md` → `.planning/milestones/`

**Keep live:** `Documents/CHANGELOG_5_20.md`, `Documents/EMAIL-DRAFT-PROFESSOR.md`, `Documents/LANDING-VIDEO-SCRIPT.md`

### CLAUDE.md Drift Report Pattern (DOCS-02)

Confirmed drifts — operator must approve before any edit (D-09):

| ID | CLAUDE.md Claim | Actual Code | File | Resolution |
|----|-----------------|-------------|------|------------|
| DR-01 | "SQLite connection name `'echolearn'` (in `db.service.ts`)" | `IDB_NAME = 'trellis'` — fully migrated to IndexedDB in Phase 55; no SQLite | `db.service.ts:190` | CLAUDE.md stale; doc should update Brand History note to reference IndexedDB not SQLite |
| DR-02 | "`STORAGE_KEY_YESTERDAY = 'trellis_post_queue_yesterday'` written by `postQueueService.load()` on date-mismatch" | Key is `SQLITE_ROW_ID_YESTERDAY = 'queue_yesterday'` in IndexedDB; old localStorage key appears in `db.service.ts:351` ONLY in the stale-key purge list (deleted on boot, not written) | `post-queue.service.ts:29`, `db.service.ts:351` | CLAUDE.md stale; storage medium and key both changed in Phase 55 |

Candidates for deeper audit (not confirmed drifts):
- C-01: CLAUDE.md says `postQueueService.load()` writes yesterday snapshot; current function may be `normalizeState()`
- C-02: `BASE_ENTRIES_PER_CONCEPT` constant location (comment vs actual def)
- C-03: Post-Phase-55 function name drift in Concept Feed Pipeline section
- C-04: `.planning/codebase/CONVENTIONS.md` says "Tailwind CSS" but CLAUDE.md mandates inline styles + CSS vars — confirm update vs archive intent with operator

---

## No Analog Found

Not applicable — Phase 56 has no new files. All files modified are existing files whose
patterns are documented above.

---

## Metadata

**Analog search scope:** `app/src/screens/`, `app/src/screens/settings/`, `app/src/components/`, `app/src/index.css`, `app/src/App.tsx`, `Documents/`, `.planning/`
**Files scanned:** 23 source files + 10 doc files
**Pattern extraction date:** 2026-05-21

**Test guards that must remain green through all fixes:**
- `app/tests/layout/root-horizontal-clip.test.mjs` — overflow:hidden both axes + App root overflowX + onFocusOut scrollLeft reset
- `app/tests/components/ChatInput.flex-shrink.test.mjs` — minWidth:0 on ChatInput input
- `app/tests/components/SwipeTabContainer.resize-guard.test.mjs` — width-change early return in resync()
- `app/tests/components/InfoFlow.video-tap-emit.test.mjs` — negative invariants for inline-play (must stay passing)

**Per-task smoke check command:**
```bash
cd app && node --test tests/layout/root-horizontal-clip.test.mjs tests/components/ChatInput.flex-shrink.test.mjs tests/components/SwipeTabContainer.resize-guard.test.mjs
```

**Per-wave merge check:**
```bash
cd app && npm test && tsc -b --noEmit
```
