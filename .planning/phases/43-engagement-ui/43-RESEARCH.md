# Phase 43: Engagement UI — Research

**Researched:** 2026-05-11
**Domain:** React 19 + framer-motion v12 + lucide-react + inline CSS variables — UI integration layer wiring an existing engagement service into an existing masonry feed
**Confidence:** HIGH (all findings verified against live source files; no reliance on external docs for architecture decisions)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Long-press contextual menu (LP-*):**
- LP-01: Bottom sheet anchored to viewport. Slides up from bottom edge via framer-motion translateY. Backdrop dismiss + drag-down dismiss. NOT inline popover, NOT centered modal.
- LP-02: 3 stacked rows with leading icon + i18n label. Order: Like → Save → Not interested. Icons: Heart, Bookmark, EyeOff (lucide-react). NOT 3 horizontal icons, NOT 2×2 grid.
- LP-03: Toast + persistent corner icon overlay on tile. toast(t('engagement.toast.saved'), 'success') for immediate acknowledgement + small filled-heart / filled-bookmark corner icon that persists across re-renders.
- LP-04: Dynamic menu labels for active state. Menu reads engagementService.isSaved(postId) + engagementService.isLiked(postId) when opened. Label flips to Unsave/Unlike with filled icon. Single mental model.
- LP-05: Dismiss UX — fade ALL same-anchor tiles in current queue. 200ms framer-motion AnimatePresence fade-out, then removed from state. Inline Undo toast deferred.

**Saved-posts view (SV-*):**
- SV-01: Route `/saved`. Sub-screen via Outlet at zIndex 50.
- SV-02: Entry point: header icon on `/home`. Bookmark (lucide-react) icon button. Tap → navigate('/saved').
- SV-03: Single-column list mirroring PostHistoryScreen.tsx's compact card pattern.
- SV-04: Tabs inside /saved: Saved | Liked. Tab state: local useState<'saved' | 'liked'>('saved').

**Deep-dive UX (DD-*):**
- DD-01: Button placement: below essay body, above takeaway (between PostDetailScreen.tsx:837 and :840).
- DD-02: Full-width subtle button with leading icon. ~85% container width, var(--surface-variant) background, var(--primary-40) text + Sparkles or ArrowDownToLine icon.
- DD-03: Streaming UX: replace standard body in-place; show "Restore standard" affordance during stream. Tapping "Restore standard" aborts the deep AbortController + restores standard rendering.
- DD-04: Post-cache visual: Standard | Deep segmented control replaces the button once bodyMarkdownDeep is non-empty.
- DD-05: AbortController contract preserved: 3 pre-call guards + 4 signal-arg passes (extended to 5 for the deep stream call). patchPostEssayInCache only fires when !abortController.signal.aborted.

**Tile simplification (TS-*):**
- TS-01: Trim ONLY the presentation-style tag across all tile types. The tag in question is the "NEWS" span rendered via t('infoFlow.newsTag') in the news card. Other tile types (image, text-art, video, connection, milestone) have no equivalent style tag — scope is bounded to this one element.

**Descopes (DS-*):**
- DS-01: ENGAGE-04 → Out of Scope. Mechanical edits to ROADMAP.md (strike SC-4) and REQUIREMENTS.md (move ENGAGE-04 to Out of Scope, update traceability row).

### Claude's Discretion

- Bottom-sheet implementation: use existing `BottomSheet.tsx` component (already shipped in `app/src/components/ui/BottomSheet.tsx`).
- Long-press hook factoring: extract `useLongPress(ms, callback)` into `app/src/hooks/` — three consumers (ChatMessage, MasonryFeed tile wrapper, future surfaces) justify the hook.
- Long-press menu animation: 200-250ms slide-up, ease-out cubic-bezier; `<MotionConfig reducedMotion="user">` per Phase 42 D-03 precedent.
- Saved/Liked tab interaction: tap-only (swipe deferred — gesture conflict risk with parent SwipeTabContainer even though /saved is a sub-screen).
- Sort order: most-recent-saved-first (insertion order of engagement service already provides this).
- Empty state copy: hand-authored EN + Sonnet-translated zh/es/ja.
- Segmented-control implementation for DD-04: custom inline-styled component.
- "Restore standard" copy: t('posts.detail.deepDive.restoreStandard') or t('posts.detail.deepDive.cancel').
- HomeScreen ANCHOR_DISMISSED re-sync: in-place client filter (not refetch).
- Tile corner-icon overlay placement: top-right (away from concept tag at bottom-left). Vertical stack when both saved AND liked.
- Test file naming as listed in CONTEXT.md (planner can adjust).
- Force-New-Day reset granularity: full reset per Phase 39 D-08, no API extension.

### Deferred Ideas (OUT OF SCOPE)

- Broader tile-metadata audit beyond TS-01 (news source attribution, news date stamp, video channel byline).
- Like-based feed re-ranking.
- Dismiss cooldown.
- Cross-device engagement sync.
- Undo toast for dismiss.
- Bulk operations on Saved / Liked.
- Search / filter inside Saved + Liked tabs.
- `/liked` as a separate route.
- Tile-metadata simplification follow-up phase.
- `resetDismissedOnly()` API method.
- N connections / familiarity micro-label (Out of Scope per DS-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGAGE-01 | User can save / bookmark a post; saved posts persist across days; saved-posts view accessible | SV-01..SV-04 covers the view; LP-01..LP-04 covers the save action; engagement.service.savePost/getSavedPosts already shipped |
| ENGAGE-02 | User can dismiss / mark "not interested" a concept via long-press contextual menu; dismissed anchors skip in subsequent walker calls | LP-05 + HomeScreen ANCHOR_DISMISSED re-sync; walker third-arg already wired (Phase 39/41) |
| ENGAGE-03 | User can like / heart a post; likes persist locally | LP-01..LP-04 covers the like action; Liked tab in SV-04 surfaces the list |
| ENGAGE-04 (DS-01) | Out of Scope per 2026-05-11 operator decision | Mechanical edit only: ROADMAP.md SC-4 struck, REQUIREMENTS.md row moved to Out of Scope section |
</phase_requirements>

---

## Goal Re-statement

Phase 43 wires the Phase 39 engagement service (`engagementService.savePost / likePost / dismissAnchor`) into visible UI surfaces: a long-press bottom-sheet on every masonry feed tile, a `/saved` archive screen, a "Deep dive" button on `PostDetailScreen`, and two housekeeping wires (HomeScreen ANCHOR_DISMISSED re-sync + SettingsDataScreen Force-New-Day `engagementService.reset()`). Additionally, TS-01 trims the presentation-style tag from feed tiles, and DS-01 descopes ENGAGE-04 via mechanical doc edits.

---

## Open Implementation Choices

### 1. Long-press timing + cross-platform feel

**Existing pattern found (HIGH confidence):**
`ChatMessage.tsx:119-140` implements the canonical 480ms long-press with:
```typescript
const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const didLongPress = useRef(false);
const startLongPress = () => {
  didLongPress.current = false;
  longPressTimer.current = setTimeout(() => {
    didLongPress.current = true;
    setShowActions(true);
  }, 480);
};
const cancelLongPress = () => {
  if (longPressTimer.current) {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }
};
const handlePointerDown = () => startLongPress();
const handlePointerUp = () => cancelLongPress();
const handlePointerLeave = () => cancelLongPress();
const handlePointerMove = () => cancelLongPress();
```

**Recommended approach:**
Extract a shared `useLongPress(ms: number, onLongPress: () => void)` hook at `app/src/hooks/useLongPress.ts`. Returns `{ onPointerDown, onPointerUp, onPointerLeave, onPointerMove, didLongPress }`. ChatMessage migrates to this hook opportunistically (or is left for a later cleanup pass — Claude's call). MasonryFeed tile wrapper uses it for the feed long-press.

**Cross-platform gotchas:**
- On Android WebView, `contextmenu` events fire on long-press and can surface the native text-selection menu. The existing `ChatMessage.tsx` approach uses pointer events (not touch events) and does not attach `contextmenu` listeners — this is intentional. The new tile wrapper should similarly avoid `onContextMenu` and rely solely on pointer events + a timer.
- `touch-action: pan-y` is already set on the HomeScreen scroll container (`containerRef` div). The tile wrapper does not need to add `touch-action: none` — doing so would block vertical scrolling when a finger is held on a tile. The 480ms timer fires before the swipe gesture completes normally, so the menu opens on a deliberate hold rather than accidentally during scroll.
- `didLongPress.current` ref prevents the `onClick` from also firing after a long-press. The tile wrapper must check this ref in its click handler: `if (didLongPress.current) { didLongPress.current = false; return; }`. MasonryFeed's `renderTile` currently calls `onOpenPost` via the card's own `onClick` — the wrapper must intercept the click phase when a long-press occurred. The simplest pattern: the wrapper renders as `position: relative` over the card and sets `pointerEvents: none` on the card when long-press is active, or more simply, uses a transparent overlay that captures taps while the sheet is open.

**CONTEXT.md settled this:** 480ms, pointer event pattern from `ChatMessage.tsx`. Extract to hook. Confidence: HIGH.

---

### 2. Bottom sheet implementation

**Existing component found (HIGH confidence):**
`app/src/components/ui/BottomSheet.tsx` is ALREADY SHIPPED. It has:
- `open: boolean` + `onClose: () => void` props
- Fixed-position overlay at zIndex 500 (above Header's 190)
- `rgba(0,0,0,0.45)` backdrop, transitions `background-color` on open/close
- `onClick={onClose}` on backdrop for tap-outside dismiss
- `onClick={stop}` (`e.stopPropagation()`) on sheet body
- `transform: translateY(0)` ↔ `translateY(100%)` with `transition: 0.3s cubic-bezier(0.32,0.72,0,1)`
- `borderRadius: '20px 20px 0 0'`, padding 20px/16px/40px
- Optional `title` prop renders a drag-handle pill + h3

**Recommended approach:**
Use `BottomSheet` as-is. Create `LongPressMenu.tsx` that renders a `<BottomSheet open={menuOpen} onClose={closeMenu}>` containing 3 `<button>` rows (Like, Save, Not interested). `LongPressMenu` reads engagement state inside the component via `engagementService.isSaved(postId)` + `engagementService.isLiked(postId)` when rendered (reads on open, not pre-open).

**`BottomSheet.tsx` notes:**
- Current `minHeight: '45vh'` and `maxHeight: '75vh'` are appropriate for a general-purpose sheet but oversized for a 3-row engagement menu. The `LongPressMenu` should either override these via a `style` prop on `BottomSheet` OR `BottomSheet` should gain a `compact` variant prop. Recommend: add a `compact?: boolean` prop that sets `minHeight: 'auto'` and `maxHeight: '45vh'`. This is a two-line change to `BottomSheet.tsx` itself.
- No framer-motion inside `BottomSheet.tsx` currently — it uses raw CSS transitions. The existing animation is consistent with the project; no need to add framer-motion inside the sheet unless the planner wants reducedMotion support there. The wrapping `<MotionConfig reducedMotion="user">` from MasonryFeed does NOT propagate into the portal (portals are DOM siblings, not React subtree children). Recommend: `LongPressMenu` wraps its own `<MotionConfig reducedMotion="user">` if any motion is added inside the sheet; for v1, the CSS transition in `BottomSheet.tsx` is sufficient.
- zIndex 500 clears the Header at 190 and the compact VineProgress bar at 190. Correct.

**Alternatives considered:**
- Custom sheet from scratch: no benefit; `BottomSheet.tsx` exactly matches the need.
- Drag-to-dismiss: `BottomSheet.tsx` does not implement drag. Tap-outside is sufficient per CONTEXT.md LP-01 note. Do NOT add framer-motion drag to `BottomSheet.tsx` in this phase.

---

### 3. Tap-outside / hit-target patterns

**Pattern (HIGH confidence — direct code inspection):**
`BottomSheet.tsx` uses `onClick={onClose}` on the outer overlay div and `onClick={(e) => e.stopPropagation()}` on the sheet body. This is the correct pattern. `LongPressMenu.tsx` does not need additional backdrop logic — it defers entirely to `BottomSheet`.

**Row hit targets:**
Each row button needs `minHeight: 44px` (per CLAUDE.md ChatInput convention for 44px touch targets). Pattern from `TrellisStatusPanel`:
```typescript
style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px', padding: '0 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius)' }}
```

---

### 4. Toast + corner state icon

**Toast API (HIGH confidence — direct code inspection):**
```typescript
// app/src/lib/toast.ts
export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  globalAddToast?.({ message, type });
}
```
Three variants only: `'success'`, `'error'`, `'info'`. No `duration` parameter — uses global default. For LP-03: `toast(t('engagement.toast.saved'), 'success')`.

**Corner state icon:**
The tile wrapper (`position: relative` div wrapping `tileBody` in `MasonryFeed.renderTile`) already has `style={{ position: 'relative' }}` (lines 436 and 448). The corner icon overlay is `position: absolute; top: 8px; right: 8px; zIndex: 10; display: 'flex'; flexDirection: 'column'; gap: '4px'; pointerEvents: 'none'`.

Icon rendering: small filled `<Heart>` (size 14, fill with `var(--node-salmon)`) and/or filled `<Bookmark>` (size 14, fill with `var(--primary-40)`). Vertical stack when both saved AND liked.

**When to re-read engagement state for corner icons:**
The tile wrapper reads `engagementService.isSaved(postId)` + `engagementService.isLiked(postId)` via a local `useState` initialized on mount + re-synced via `eventBus.subscribe('ENGAGEMENT_CHANGED', ...)` inside a `useEffect`. Since `ENGAGEMENT_CHANGED` fires on every save/unsave/like/unlike/undismiss, the icon will update within one event tick. This is a NEW subscription pattern; the tile wrapper must unsubscribe in cleanup.

Alternative: use a single re-render trigger — listen to `ENGAGEMENT_CHANGED` and call a `setVersion(v => v + 1)` state bump, then re-read `isSaved`/`isLiked` synchronously on each render. This avoids storing engagement state in component state and is simpler.

---

### 5. Saved-posts screen (SavedScreen.tsx)

**Layout pattern (HIGH confidence — direct code inspection of PostHistoryScreen.tsx):**

`PostHistoryScreen.tsx` is the canonical reference:
- `<Header backTo="/home" title={t('...')} />` — portals to `document.body` since `/history` is a sub-screen outside SwipeTabContext.
- Scroll container: `flex: 1; overflowY: 'auto'` with `paddingTop: HEADER_HEIGHT + 16`
- Card row: `display: flex; alignItems: center; gap: 12px` — 52×52px thumbnail, title, contextLabel

**SavedScreen mirrors this exactly, plus adds:**
- Tab switcher at top of scroll area (below `paddingTop`): two full-width-split buttons `Saved | Liked`, active tab highlighted with `var(--primary-40)` underline or background tint.
- Tab state: `const [activeTab, setActiveTab] = useState<'saved' | 'liked'>('saved')`.
- List data: `engagementService.getSavedPosts()` or `engagementService.getLikedPosts()` — read on mount + re-read on `ENGAGEMENT_CHANGED` event.
- NOT always-mounted (sub-screen via Outlet, not a swipe-tab slot) — BUT needs to re-read on `ENGAGEMENT_CHANGED` to stay in sync when user un-saves from PostDetailScreen.

**Route registration in App.tsx:**
Insert between `history` and `review` (alphabetically reasonable):
```typescript
{ path: 'saved', element: <PageTransition><SavedScreen /></PageTransition> }
```
Add the import alongside other screen imports.

**Empty state pattern:**
PostHistoryScreen uses `<AlertCircle>` + text for error state. For empty state, use a centered `<Bookmark size={40} color="var(--muted-foreground)">` or `<Heart>` + i18n copy. Pattern matches `HomeScreen.tsx:740-762` empty state visual.

---

### 6. Tab pattern (Saved | Liked)

**Existing tab pattern (HIGH confidence — ReviewScreen.tsx inspection):**
ReviewScreen has session/library tabs but they're implemented as a `<button>` toggling `showLibrary` state, not a generic tab component. The visual is a simple row of two buttons with a bottom-border or background-tint on the active one.

**Recommended implementation for SavedScreen:**
```typescript
// Inline tab bar — no new component needed for 2 tabs
<div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
  <button
    onClick={() => setActiveTab('saved')}
    style={{
      flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
      fontSize: '0.9rem', fontWeight: activeTab === 'saved' ? 700 : 400,
      color: activeTab === 'saved' ? 'var(--primary-40)' : 'var(--muted-foreground)',
      borderBottom: activeTab === 'saved' ? '2px solid var(--primary-40)' : '2px solid transparent',
      marginBottom: '-1px',
    }}
  >
    {t('saved.tabs.saved')}
  </button>
  <button
    onClick={() => setActiveTab('liked')}
    style={{
      flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
      fontSize: '0.9rem', fontWeight: activeTab === 'liked' ? 700 : 400,
      color: activeTab === 'liked' ? 'var(--primary-40)' : 'var(--muted-foreground)',
      borderBottom: activeTab === 'liked' ? '2px solid var(--primary-40)' : '2px solid transparent',
      marginBottom: '-1px',
    }}
  >
    {t('saved.tabs.liked')}
  </button>
</div>
```

**Tab state vs route param:** Local `useState` (not `/saved?tab=liked`). Route param would require parsing on mount and adds navigation complexity for no user benefit — the saved screen is ephemeral.

---

### 7. Deep-dive trigger UX

**PostDetailScreen state region (lines 80-84, HIGH confidence — direct code inspection):**
```typescript
const [streamingBody, setStreamingBody] = useState('');
const [isStreamingOnEnter, setIsStreamingOnEnter] = useState(false);
const [onEnterError, setOnEnterError] = useState<string | null>(null);
const [onEnterMeta, setOnEnterMeta] = useState<Omit<EssayContent, 'bodyMarkdown'> | null>(null);
```

**New state needed for DD-03/DD-04:**
```typescript
const [streamingDeep, setStreamingDeep] = useState('');        // deep stream accumulator
const [isStreamingDeep, setIsStreamingDeep] = useState(false); // streaming in progress
const [deepError, setDeepError] = useState<string | null>(null);
const [activeVariant, setActiveVariant] = useState<'standard' | 'deep'>('standard');
```

**Button insertion site (DD-01 — verified via direct code inspection):**
Between `PostDetailScreen.tsx:837` (closing `</div>` of essay body) and `:840` (`{post.sourceType !== 'video' && (post.takeaway...)`):
```typescript
{/* Scroll 70% sentinel — line 838 */}
<div ref={scrollSentinelRef} style={{ height: '1px' }} />
{/* DD-01: Deep-dive button OR segmented toggle, between sentinel + takeaway */}
{!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()}
{post.sourceType !== 'video' && (post.takeaway || onEnterMeta?.takeaway) && (
```
The condition `!isStreamingOnEnter && (post.bodyMarkdown || streamingBody)` ensures the deep-dive UI only appears after the standard essay exists (no deep-dive on blank essay or before streaming completes).

**Body render swap for DD-03:**
The existing render at lines 818-835 switches on `isStreamingOnEnter` / `post.bodyMarkdown`. For deep-dive, add a layer:
- When `activeVariant === 'deep'` AND `post.bodyMarkdownDeep`: render `<Markdown>{post.bodyMarkdownDeep}</Markdown>`
- When `activeVariant === 'deep'` AND `isStreamingDeep`: render `<Markdown>{streamingDeep}</Markdown>` (with skeleton fallback when empty)
- Otherwise: existing standard render logic unchanged

The slot to modify is the `post.bodyMarkdown ?` branch at line 832-836 — add `activeVariant` discrimination there.

**AbortController contract (DD-05 — verified at PostDetailScreen.tsx:313-350):**
Three pre-call guards before each `for await` opener:
- `:314` before `generateConnectionPost`
- `:327` before `generateDiscoverPost`
- `:338` before `generatePostEssay`

Four signal-arg passes:
- `{ signal: abortController.signal }` on `generateConnectionPost` (line 320)
- `{ signal: abortController.signal }` on `generateDiscoverPost` (line 331)
- `{ signal: abortController.signal }` on `generatePostEssay` (line 339)
- `{ signal: abortController.signal }` on `generateEssayMeta` (line 350)

**Deep-stream call adds a 5th signal-arg pass** to a new `generatePostEssay(post, questionsRef.current, { depth: 'deep', signal: abortController.signal })` invocation. The pre-call guard pattern: `if (abortController.signal.aborted) return;` immediately before the `for await`. The "Restore standard" button calls `abortController.abort()` and sets `isStreamingDeep(false)` + `setActiveVariant('standard')`.

**Key invariant:** `patchPostEssayInCache` for `bodyMarkdownDeep` only fires when `!abortController.signal.aborted` — same guard as the existing `bodyMarkdown` patch at line 346. The deep stream writes to `post.bodyMarkdownDeep` (new field from Phase 41-02); standard `post.bodyMarkdown` is NEVER overwritten by the deep stream.

**Segmented control (DD-04):**
Once `post.bodyMarkdownDeep` is non-empty (from `post` object which reflects cached state), the deep-dive button slot is replaced by a two-segment control:
```typescript
function renderDeepDiveControls() {
  const deepCached = !!post.bodyMarkdownDeep;
  if (deepCached) {
    return <SegmentedControl active={activeVariant} onChange={setActiveVariant} />;
  }
  if (isStreamingDeep) {
    return <RestoreStandardButton onRestore={handleRestoreStandard} />;
  }
  return <DeepDiveButton onTap={handleStartDeepDive} />;
}
```
Custom inline-styled `SegmentedControl` — two adjacent pill buttons with active segment getting `var(--primary-40)` background + white text, inactive getting `var(--surface-variant)` + `var(--muted-foreground)`.

**Accessing `post.bodyMarkdownDeep`:**
`PostDetailScreen` receives `post` as state that is updated when `patchPostEssayInCache` writes back. The existing pattern at line 353-367 updates `savedPost` and calls `setPost(savedPost)` after essay generation. The deep-stream path must similarly call `setPost(updatedPost)` after patching — verify `patchPostEssayInCache` returns the updated post or re-fetch from cache.

---

### 8. Engagement service event integration

**ANCHOR_DISMISSED consumer for HomeScreen (CONTEXT.md + direct code inspection):**

HomeScreen currently subscribes to `PLANNER_UPDATED`, `POST_DELETED`, `CONCEPT_EXPLORED`, `REVIEW_COMPLETED` (and others) via `eventBus.subscribe(...)` inside the main `useEffect([questions, questionsLoading])`. The `[location.pathname]` re-sync effect at lines 182-202 is the canonical pattern per Phase 36-14.

**New ANCHOR_DISMISSED re-sync must join the `[location.pathname]` effect neighborhood** (not the main questionsLoading effect). The handler:
```typescript
useEffect(() => {
  if (location.pathname !== '/home') return;
  // Re-sync explored anchors (existing pattern from Phase 36-14)
  const explored = dailyReadService.getExploredAnchors();
  setExploredAnchors(explored);
  // ...warm-start fallback logic (existing)
}, [location.pathname]);
```
The ANCHOR_DISMISSED re-sync adds an in-place filter of `dailyPosts`:
```typescript
useEffect(() => {
  const unsub = eventBus.subscribe('ANCHOR_DISMISSED', (event) => {
    const { anchorId } = event.payload;
    setDailyPosts(prev => prev.filter(p =>
      (p.sourceQuestionIds?.[0] !== anchorId)  // concept posts
    ));
  });
  return unsub;
}, []); // stable subscription — empty deps; no questionsRef needed for filter
```
This is a SEPARATE effect from the `[location.pathname]` effect (different cleanup lifecycle). The re-read on navigation sits in `[location.pathname]`; the live event listener sits in `[]`. Both coexist.

**ENGAGEMENT_CHANGED consumer locations:**
- `LongPressMenu.tsx`: reads state on open (one-time synchronous read via `engagementService.isSaved/isLiked`), no subscription needed since menu is opened fresh each time.
- MasonryFeed tile wrapper / corner icon: subscribe to `ENGAGEMENT_CHANGED` to re-render corner icons.
- `SavedScreen.tsx`: subscribe to `ENGAGEMENT_CHANGED` to re-read saved/liked lists when the user modifies state while on that screen.

**No new event types needed.** Existing `ANCHOR_DISMISSED` and `ENGAGEMENT_CHANGED { kind, id }` (Phase 39 D-05) cover all cases.

---

### 9. Force-New-Day integration

**`handleForceNewDay` current structure (verified at SettingsDataScreen.tsx:77-140):**
```typescript
const handleForceNewDay = () => {
  try {
    // 1. Roll back post-queue date
    const raw = localStorage.getItem('trellis_post_queue');
    // ...mutate date...
    postQueueService.loadQueue();
    // 2. Roll back daily-posts cache date
    // ...mutate date...
    // 3. Reset vine progress
    dailyReadService.reset();
    toast('...', 'success');
    navigate('/home');
  } catch (err) {
    toast('Force new day failed.', 'error');
  }
};
```

**Insertion point for `engagementService.reset()`:**
After `dailyReadService.reset()` at line 133, before the toast. Order matters: all service resets should complete before the toast fires and before navigation.

**Assertion for source-reading test:** After this change, `SettingsDataScreen.tsx` must contain both `dailyReadService.reset()` and `engagementService.reset()` inside `handleForceNewDay`. The test greps for both call sites within the function scope.

---

### 10. Tile presentation-style tag trim (TS-01)

**Audit result (HIGH confidence — direct code inspection):**

The ONLY presentation-style tag in the codebase is:
- `InfoFlow.tsx:263`: `{t('infoFlow.newsTag')}` — renders "NEWS" pill on news cards.

Other tile types:
- Image cards: NO explicit "IMAGE" label.
- Text-art cards: NO explicit "TEXT-ART" label.
- Video cards: NO explicit "VIDEO" label (only channel attribution via `t('infoFlow.byChannel', { channel })`).
- Connection cards (`ConnectionCard`): NO style tag.
- Milestone cards (`MilestoneCard`): NO style tag.

**The `infoFlow.newsTag` pill (lines 252-279 in InfoFlow.tsx):**
```typescript
<span style={{
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--news-card-tag-text)',
  backgroundColor: 'var(--news-card-tag-bg)',
  padding: '3px 8px',
  borderRadius: '100px',
}}>
  {t('infoFlow.newsTag')}
</span>
```
This is rendered inside the news card's "Bottom tags" flex row (line 251) alongside `sourceQuestionTitles`.

**TS-01 scope: DELETE this `<span>` entirely.** Also delete the `infoFlow.newsTag` key from all 4 locale bundles:
- `app/src/locales/en.json` line 743: `"newsTag": "NEWS"`
- `app/src/locales/zh.json` line 743: `"newsTag": "新闻"`
- `app/src/locales/es.json` line 743: `"newsTag": "NOTICIAS"`
- `app/src/locales/ja.json` line 743: `"newsTag": "ニュース"`

**Note:** The news card still retains:
- Source attribution (domain hostname, line 205-219) — NOT trimmed per TS-01 scope.
- `sourceQuestionTitles` concept chips (lines 265-279) — NOT trimmed.
The "NEWS" label is the ONLY item TS-01 removes.

**Negative-grep source-reading test:** After this change, `grep 'infoFlow.newsTag' app/src/components/InfoFlow.tsx` must return 0 results.

---

### 11. i18n bundle work

**New namespaces required (4 locales, land all in same PR):**

**`engagement.menu.*` (LongPressMenu labels):**
```json
"engagement": {
  "menu": {
    "like": "Like",
    "unlike": "Unlike",
    "save": "Save",
    "unsave": "Unsave",
    "dismiss": "Not interested"
  },
  "toast": {
    "liked": "Liked",
    "unliked": "Like removed",
    "saved": "Saved",
    "unsaved": "Removed from saved",
    "dismissed": "Got it — you won't see this again"
  }
}
```

**`saved.*` (SavedScreen):**
```json
"saved": {
  "title": "Saved",
  "tabs": {
    "saved": "Saved",
    "liked": "Liked"
  },
  "empty": {
    "savedTitle": "Nothing saved yet",
    "savedBody": "Long-press any tile to save a post",
    "likedTitle": "No liked posts yet",
    "likedBody": "Long-press any tile to like a post"
  }
}
```

**`posts.detail.deepDive.*` (PostDetailScreen deep-dive controls):**
```json
"posts": {
  "detail": {
    "deepDive": {
      "cta": "Deep dive into this concept",
      "restoreStandard": "Restore standard",
      "toggleStandard": "Standard",
      "toggleDeep": "Deep"
    }
  }
}
```
These nest under the existing `posts.detail.*` namespace. Verify the `posts.detail` namespace exists in `en.json` before adding (it does — `posts.detail.videoAiSummary` is referenced at PostDetailScreen.tsx:798).

**Keys to REMOVE (TS-01):** `infoFlow.newsTag` from all 4 bundles.

**Translation workflow:** EN canonical hand-authored → run Sonnet subagent at `app/scripts/translate-locales.md` for zh, es, ja. Human review of proper nouns (Trellis, YouTube not translated), interpolation placeholders (none in these keys), Spanish length (~20% longer).

**`bundle-parity.test.mjs` enforcement:** Removing `infoFlow.newsTag` from all 4 bundles simultaneously passes parity. Adding new keys only to EN would fail. Both operations must land in the same commit/PR.

**HomeScreen Bookmark icon:** Uses lucide-react `<Bookmark>` — no new locale key needed (icon-only button). Accessibility: `aria-label={t('saved.title')}` on the button.

---

### 12. Tests to write

Following the source-reading invariant test pattern from Phases 27/35/37/39/40/41/42:

| Test File | Type | What It Asserts |
|-----------|------|-----------------|
| `tests/components/LongPressMenu.behavior.test.mjs` | Behavioral | Opens on 480ms hold; dismisses on backdrop tap; calls correct service method; does NOT emit CONCEPT_EXPLORED |
| `tests/components/InfoFlow.no-style-tag.test.mjs` | Source-reading (negative grep) | `grep 'infoFlow.newsTag'` in `InfoFlow.tsx` returns 0 |
| `tests/screens/SavedScreen.tabs.test.mjs` | Behavioral | Lists persisted posts; Saved tab shows saved, Liked tab shows liked; empty state renders |
| `tests/screens/PostDetailScreen.deep-dive.test.mjs` | Source-reading + behavioral | Deep-dive button position (after essay, before takeaway); replace-in-place during stream; Restore standard aborts; segmented toggle once cached; AbortController 3 pre-call guards + 5 signal-arg passes |
| `tests/screens/HomeScreen.anchor-dismissed-resync.test.mjs` | Behavioral | ANCHOR_DISMISSED event removes same-anchor tiles from dailyPosts; tiles for other anchors unaffected |
| `tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` | Source-reading | `grep 'engagementService.reset'` inside `handleForceNewDay` function scope in `SettingsDataScreen.tsx` returns ≥1 |
| `tests/locales/bundle-parity.test.mjs` | Existing gate | Passes with new keys added + newsTag removed from all 4 bundles |
| `tests/locales/missing-key.test.mjs` | Existing gate | Passes with all new i18n keys present in fallback chain |

**Anti-wire invariant (from CONTEXT.md canonical_refs):**
- `LongPressMenu.tsx` MUST NOT emit `CONCEPT_EXPLORED` (only `ANCHOR_DISMISSED` from the dismiss row + `ENGAGEMENT_CHANGED` from save/like rows).
- Source-reading test: grep `CONCEPT_EXPLORED` in `LongPressMenu.tsx` → 0 results.

**Corner icon overlay test (LP-03):**
- After `ENGAGEMENT_CHANGED { kind: 'save' }`, the tile wrapper renders the `<Bookmark>` corner icon.
- After `ENGAGEMENT_CHANGED { kind: 'unsave' }`, the icon disappears.

**Dismiss fade animation (LP-05):**
- After `ANCHOR_DISMISSED { anchorId }`, `setDailyPosts` removes all tiles with matching `sourceQuestionIds[0] === anchorId`.
- Behavioral test can assert state update without testing framer-motion AnimatePresence (which is presentation-layer).

---

### 13. HomeScreen SV-02 entry point

**Header architecture for HomeScreen (HIGH confidence — verified):**
HomeScreen does NOT currently use a `<Header>` component. It renders an inline `<h1>` greeting at line 634 (inside the scroll container). HomeScreen IS inside `SwipeTabContext`, so any `position: fixed` element uses the slot's `translateZ(0)` as its containing block (correct behavior per CLAUDE.md Phase 32.1 rules).

**Options for Bookmark icon placement:**
1. **Add to the compact VineProgress bar** (existing fixed element at zIndex 190): Place a `<Bookmark>` icon button in the top-right corner of the compact bar's `<div>`. The compact bar slides in when the inline card scrolls away — this means the icon is hidden when at the top of the screen. **Not ideal — icon disappears on initial load.**
2. **Add a persistent fixed-position icon button** at `top: var(--safe-area-top); right: 16px; zIndex: 195` (above the compact bar's 190 so it's not covered). This is always visible. **Recommended.**
3. **Add `<Header>` to HomeScreen**: Would be the cleanest long-term pattern but HomeScreen's greeting-based scroll UX was intentionally designed without a fixed header. Adding a Header now could require scroll-offset adjustments across the screen. **Not recommended for this phase.**

**Recommended approach (Option 2):**
```typescript
<button
  onClick={() => navigate('/saved')}
  aria-label={t('saved.title')}
  style={{
    position: 'fixed',
    top: 'calc(var(--safe-area-top) + 8px)',
    right: '16px',
    zIndex: 195,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    color: 'var(--muted-foreground)',
  }}
>
  <Bookmark size={22} />
</button>
```
This is inside `SwipeTabContext` (HomeScreen is a swipe-tab slot), so `position: fixed` is scoped to the slot's `translateZ(0)` containing block. The icon moves off-screen with the HomeScreen slot when the user swipes to another tab — correct behavior.

**Import addition:** Add `Bookmark` to the lucide-react import in `HomeScreen.tsx`.

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| framer-motion | 12.38.0 | Bottom-sheet animation, tile fade-out AnimatePresence | Already installed Phase 42 |
| lucide-react | current | Heart, Bookmark, EyeOff, Sparkles icons for menu + corner icons | Already installed |
| react-i18next | current | `t()` for all new user-visible strings | Already installed |
| react-router-dom | 7.x | `navigate('/saved')`, route registration | Already installed |

**No new dependencies required.** All Phase 43 work is pure component + hook authoring using existing infrastructure.

---

## Architecture Patterns

### Long-press wrapper in MasonryFeed.renderTile

`renderTile` currently wraps `tileBody` in either `<motion.div>` or `<div>`. The long-press wrapper injects between these containers and `tileBody`:

```
renderTile:
  shouldAnimate → <motion.div key=... ref=... data-* style={position:'relative'}>
    <TileLongPressWrapper postId={itemId} anchorId={conceptId}>
      {tileBody}
    </TileLongPressWrapper>
  </motion.div>

  !shouldAnimate → <div key=... ref=... data-* style={position:'relative'}>
    <TileLongPressWrapper postId={itemId} anchorId={conceptId}>
      {tileBody}
    </TileLongPressWrapper>
  </div>
```

OR the long-press handlers are injected directly onto the outer `motion.div`/`div` via spread props from `useLongPress`. The corner icon overlay is positioned absolutely inside the same outer div. The `<LongPressMenu>` is rendered at the MasonryFeed level (one instance, controlled by `{ open, postId, anchorId }` state) — not per-tile, to avoid 20+ portal/backdrop instances.

### Deep-dive state machine in PostDetailScreen

```
State: isStreamingOnEnter=false, post.bodyMarkdown present
  → Show: standard essay body
  → Show: DeepDiveButton (if post.bodyMarkdownDeep absent, not streaming)
  
User taps DeepDiveButton:
  → setIsStreamingDeep(true), setActiveVariant('deep')
  → for await (generatePostEssay depth:'deep')
  → Show: deep streaming body in slot, RestoreStandardButton above
  
User taps RestoreStandard:
  → abortController.abort()
  → setIsStreamingDeep(false), setActiveVariant('standard')
  → body slot reverts to post.bodyMarkdown

Deep stream completes:
  → patchPostEssayInCache(postId, { bodyMarkdownDeep: accumulated })
  → setPost(updated)
  → setIsStreamingDeep(false)
  → bodyMarkdownDeep now non-empty

Post-cache state (bodyMarkdownDeep non-empty):
  → Show: segmented control Standard | Deep
  → Toggle is instant client-side state change, no re-stream
```

### Dismiss animation in HomeScreen

```typescript
// In HomeScreen, ANCHOR_DISMISSED subscription:
eventBus.subscribe('ANCHOR_DISMISSED', ({ payload }) => {
  const { anchorId } = payload;
  // In-place client filter — do NOT refetch
  setDailyPosts(prev =>
    prev.filter(p => p.sourceQuestionIds?.[0] !== anchorId)
  );
});
```

The framer-motion `AnimatePresence` fade (200ms) wraps the tile list in `MasonryFeed`. This requires `MasonryFeed` to use `<AnimatePresence>` around each tile OR `HomeScreen` handles the fade before removing from state. The simpler approach: `HomeScreen` sets a "dismissedIds" Set in state, `MasonryFeed` uses `<AnimatePresence>` on the tile array (each tile is already a `<motion.div>` or can be), and items are removed from state after the AnimatePresence exit completes. For v1: direct state removal + rely on framer-motion `AnimatePresence` with `exit={{ opacity: 0 }}` + `transition={{ duration: 0.2 }}` on tiles.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Bottom sheet surface | Custom overlay + CSS transitions from scratch | `BottomSheet.tsx` (already shipped) |
| Long-press timer | Per-component setTimeout pattern | `useLongPress(ms, callback)` hook (extract from ChatMessage.tsx pattern) |
| Toast notifications | Custom toast renderer | `toast()` helper in `app/src/lib/toast.ts` |
| Sub-screen routing + back navigation | Custom history stack | React Router `useNavigate` + `<Header backTo="/home">` |
| Locale management | String concatenation or runtime LLM | `t()` + 4-bundle parity; Sonnet subagent for non-EN translation |
| Framer-motion reducedMotion | Custom `prefers-reduced-motion` media query | `<MotionConfig reducedMotion="user">` (already used in MasonryFeed) |

---

## Common Pitfalls

### Pitfall 1: BottomSheet minHeight too tall for 3-row menu

**What goes wrong:** Default `minHeight: '45vh'` shows excessive empty space for a 3-action menu.
**How to avoid:** Add `compact?: boolean` prop to `BottomSheet.tsx`: when true, set `minHeight: 'auto'` on the inner sheet div. The `LongPressMenu` passes `compact`.
**Warning signs:** Menu visually looks half-height of screen with lots of whitespace.

### Pitfall 2: Long-press and onClick both fire

**What goes wrong:** User holds for 480ms → menu opens → pointer-up fires → onClick on tile fires → navigation to PostDetailScreen.
**How to avoid:** The `useLongPress` hook sets `didLongPress.current = true` before calling the callback. The tile wrapper (or the existing `MemoizedConceptCard` / `ConnectionCard`'s onClick) must check `didLongPress.current` and bail. Pattern from `ChatMessage.tsx`: `didLongPress.current` prevents the short-tap action from firing. The tile wrappers (`MemoizedConceptCard`, `ConnectionCard`) use `onOpen(post.id, post)` in their `onClick` — the wrapper must intercept this.

The recommended approach: inject `onPointerDown`, `onPointerUp`, `onPointerLeave`, `onPointerMove` onto the outer `motion.div`/`div` in `renderTile` (which wraps the card). The card's `onClick` still fires, but the wrapper adds a `onClick` capture on the outer div that checks `didLongPress.current` and calls `e.stopPropagation()` if true. Since the outer div comes first in DOM, capture phase interception works:
```typescript
// On the outer wrapper div:
onClickCapture={(e) => {
  if (didLongPress.current) {
    didLongPress.current = false;
    e.stopPropagation();
  }
}}
```

### Pitfall 3: Deep-dive AbortController re-use across depth-switches

**What goes wrong:** The existing AbortController from the on-enter essay stream may have already been used (or aborted). If the user navigates away mid-standard-stream then comes back, the controller is in an aborted state and the deep-dive call immediately returns.
**How to avoid:** The existing `useEffect` cleanup in PostDetailScreen calls `abortController.abort()` on unmount and `postId` change (line ~285). The deep-dive flow should create a NEW AbortController per deep-dive tap OR reuse the same controller but check that it's not already aborted before starting the deep stream. Simplest: create a new `AbortController` specifically for the deep stream, stored in a `deepAbortControllerRef`.

### Pitfall 4: `position: fixed` Bookmark icon not scoped to HomeScreen slot

**What goes wrong:** If `position: fixed` is used without `transform` on the HomeScreen slot, the icon anchors to the viewport and remains visible when the user swipes to other tabs.
**How to avoid:** SwipeTabContainer wraps each slot in `transform: translateZ(0)` (line 245). This is the containing block for `position: fixed` within HomeScreen. The Bookmark icon will float with the HomeScreen slot. This is the CORRECT behavior per Phase 32.1. **Do NOT add `transform`/`will-change`/`filter` to any HomeScreen ancestor beyond what SwipeTabContainer already has.**

### Pitfall 5: `bodyMarkdownDeep` field absent on older cached posts

**What goes wrong:** `post.bodyMarkdownDeep` is `undefined` on posts generated before Phase 41. The segmented control must NOT appear for these posts (no cached deep version). The DeepDiveButton should appear.
**How to avoid:** Condition: `const deepCached = typeof post.bodyMarkdownDeep === 'string' && post.bodyMarkdownDeep.length > 0`. Only show segmented control when this is true.

### Pitfall 6: TS-01 — `newsTag` locale key removed breaks bundle-parity test

**What goes wrong:** If `newsTag` is removed from some but not all locale bundles, `bundle-parity.test.mjs` fails.
**How to avoid:** Delete `infoFlow.newsTag` from all 4 bundles (`en.json`, `zh.json`, `es.json`, `ja.json`) in the same commit. The rendering code in `InfoFlow.tsx` (the `{t('infoFlow.newsTag')}` span) is deleted in the same commit.

### Pitfall 7: SavedScreen always-mounted concern

**What goes wrong:** Developer treats `/saved` as always-mounted (like swipe-tab screens) and doesn't add ENGAGEMENT_CHANGED subscription.
**How to avoid:** `/saved` is a SUB-SCREEN via `<Outlet>` — it DOES unmount when navigated away. It mounts fresh on each navigate('/saved'). Re-reading engagement service on mount is sufficient (`useEffect(() => { setItems(engagementService.getSavedPosts()); }, [activeTab])`). A live `ENGAGEMENT_CHANGED` subscription is only needed for keeping the list in-sync while the user is on the screen (e.g., un-saving from another surface simultaneously — unlikely but possible). Recommend: subscribe AND re-read on `ENGAGEMENT_CHANGED` for correctness.

### Pitfall 8: Dismiss affects ENGAGEMENT_CHANGED subscribers

**What goes wrong:** `dismissAnchor` emits `ANCHOR_DISMISSED` only (NOT `ENGAGEMENT_CHANGED` per Phase 39 D-05/D-06 anti-wire). Any subscriber that only listens to `ENGAGEMENT_CHANGED` will not see the dismiss.
**How to avoid:** HomeScreen subscribes to `ANCHOR_DISMISSED` directly (not via ENGAGEMENT_CHANGED). `SavedScreen` only needs ENGAGEMENT_CHANGED (it lists saved/liked posts, not dismissed anchors). `LongPressMenu` reads state synchronously on open — no subscription needed. These are separate subscribers for separate semantic events; do NOT consolidate.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` with esbuild tsx loader |
| Config file | `app/tests/` directory with `.test.mjs` suffix pattern |
| Quick run command | `node --test tests/components/LongPressMenu.behavior.test.mjs` (run from `app/`) |
| Full suite command | `npm test` (run from `app/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGAGE-01 | Saved posts accessible via /saved, persist | behavioral | `node --test tests/screens/SavedScreen.tabs.test.mjs` | ❌ Wave 0 |
| ENGAGE-01 | Save action via long-press commits to engagementService | behavioral | `node --test tests/components/LongPressMenu.behavior.test.mjs` | ❌ Wave 0 |
| ENGAGE-02 | Dismiss hides same-anchor tiles | behavioral | `node --test tests/screens/HomeScreen.anchor-dismissed-resync.test.mjs` | ❌ Wave 0 |
| ENGAGE-02 | dismissAnchor does NOT emit CONCEPT_EXPLORED | source-reading | `node --test tests/components/LongPressMenu.behavior.test.mjs` | ❌ Wave 0 |
| ENGAGE-03 | Like action via long-press commits to engagementService | behavioral | `node --test tests/components/LongPressMenu.behavior.test.mjs` | ❌ Wave 0 |
| CONTENT-01 | Deep-dive button renders below essay, above takeaway | source-reading | `node --test tests/screens/PostDetailScreen.deep-dive.test.mjs` | ❌ Wave 0 |
| CONTENT-01 | AbortController 3 guards + 5 signal passes preserved | source-reading | `node --test tests/screens/PostDetailScreen.deep-dive.test.mjs` | ❌ Wave 0 |
| CONTENT-01 | engagementService.reset() in handleForceNewDay | source-reading | `node --test tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` | ❌ Wave 0 |
| TS-01 | infoFlow.newsTag not present in InfoFlow.tsx | source-reading (neg) | `node --test tests/components/InfoFlow.no-style-tag.test.mjs` | ❌ Wave 0 |
| all | Bundle parity (4 locales) | existing gate | `node --test tests/locales/bundle-parity.test.mjs` | ✅ exists |
| all | Missing-key fallback | existing gate | `node --test tests/locales/missing-key.test.mjs` | ✅ exists |

### Sampling Rate

- **Per task commit:** Quick test for the file changed (e.g., `node --test tests/components/LongPressMenu.behavior.test.mjs` after LongPressMenu.tsx commit).
- **Per wave merge:** `npm test` full suite.
- **Phase gate:** Full suite green before `/gsd:verify-work`.

### Wave 0 Gaps

All 8 new test files must be created before or alongside the implementation commits:

- [ ] `tests/components/LongPressMenu.behavior.test.mjs` — ENGAGE-01/02/03 anti-wire + service call assertions
- [ ] `tests/components/InfoFlow.no-style-tag.test.mjs` — TS-01 negative grep
- [ ] `tests/screens/SavedScreen.tabs.test.mjs` — ENGAGE-01 saved/liked list rendering
- [ ] `tests/screens/PostDetailScreen.deep-dive.test.mjs` — CONTENT-01 button position + AbortController contract
- [ ] `tests/screens/HomeScreen.anchor-dismissed-resync.test.mjs` — ENGAGE-02 dismiss filter
- [ ] `tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` — engagementService.reset() call site
- [ ] `tests/components/MasonryFeed.corner-icons.test.mjs` — LP-03 corner icon visibility after ENGAGEMENT_CHANGED
- [ ] `tests/hooks/useLongPress.test.mjs` — 480ms hook fires correctly; cancel on pointer-leave

Existing gates passing after TS-01: `bundle-parity.test.mjs`, `missing-key.test.mjs`.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Long-press + onClick double-fire on tile | HIGH (known gotcha) | Medium — accidental navigation | `onClickCapture` + `didLongPress.current` check on wrapper; test LP-02 behavioral |
| `BottomSheet.tsx` `minHeight: 45vh` too tall for 3-row menu | HIGH | Low (cosmetic) | Add `compact` prop; 2-line change to BottomSheet.tsx |
| Deep AbortController reuse across depth-switches | MEDIUM | High — partial stream cached | Create dedicated `deepAbortControllerRef`; patchPostEssayInCache guard preserved |
| Corner icon z-index conflict with existing tile elements | LOW | Low (cosmetic) | `zIndex: 10` on corner overlay; `pointerEvents: none` so tile taps still register |
| TS-01 removes newsTag from some but not all bundles | LOW | Medium — bundle-parity test failure | Single commit removes key from all 4 bundles + code |
| AnimatePresence fade for dismiss requires MasonryFeed refactor | MEDIUM | Medium — scope creep | Can simplify to instant removal (no AnimatePresence) for v1; LP-05 framing says "200ms fade-out" but defer complexity if needed |

---

## Open Questions for Operator

None that block planning. All implementation choices are resolvable from the source code + CONTEXT.md decisions.

**Planner-level decisions remaining (not blocking):**
1. `useLongPress` hook: should ChatMessage.tsx also migrate to the new hook in this phase, or stay as-is with a future cleanup note?
2. `BottomSheet.tsx` `compact` prop: add inline in this phase as part of LongPressMenu.tsx's plan, or patch BottomSheet.tsx separately?
3. Deep-dive AbortController: reuse existing or new `deepAbortControllerRef`? (Research recommends new ref.)
4. MasonryFeed AnimatePresence for dismiss fade: add `<AnimatePresence>` wrapper around tile list in Phase 43 (required for LP-05 200ms fade), or ship instant removal + add animation in a follow-up? Phase 43 scope suggests adding it; MasonryFeed already uses framer-motion.

---

## Sources

### Primary (HIGH confidence — direct source code inspection)

- `app/src/components/ui/BottomSheet.tsx` — already shipped; complete API surface documented above
- `app/src/components/ChatMessage.tsx:119-140` — 480ms long-press pattern (canonical)
- `app/src/components/MasonryFeed.tsx:387-453` — `renderTile` contract; `position: relative` outer wrapper confirmed
- `app/src/components/InfoFlow.tsx:250-283` — `infoFlow.newsTag` render site confirmed; only style tag in codebase
- `app/src/screens/PostDetailScreen.tsx:75-90, 300-367, 790-855` — state region, AbortController contract, essay body + takeaway location
- `app/src/screens/HomeScreen.tsx:1-70, 155-203, 580-615` — existing `[location.pathname]` effect pattern; compact bar fixed positioning; MasonryFeed props
- `app/src/screens/PostHistoryScreen.tsx` — SavedScreen layout template
- `app/src/screens/settings/SettingsDataScreen.tsx:77-140` — `handleForceNewDay` insertion point
- `app/src/services/engagement.service.ts` — complete API (savePost, likePost, dismissAnchor, isSaved, isLiked, reset, etc.)
- `app/src/lib/toast.ts` — toast API (3 variants, no duration param)
- `app/src/components/ui/Header.tsx` — portal-vs-in-tree pattern; `backTo` prop
- `app/src/App.tsx:294-322` — router children; insertion point for `/saved` route
- `app/src/locales/en.json:742-762` — `infoFlow.newsTag` confirmed; no existing engagement/saved/deepDive keys

### Secondary (HIGH confidence — upstream CONTEXT.md files)

- `.planning/phases/43-engagement-ui/43-CONTEXT.md` — all locked decisions LP/SV/DD/TS/DS
- `.planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md` — D-03..D-08 service contract
- `.planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md` — D-03 `bodyMarkdownDeep` schema; D-08 AbortController contract
- `.planning/phases/42-masonry-feed-layout/42-CONTEXT.md` — D-01..D-11 MasonryFeed tile contract; MotionConfig reducedMotion

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against installed `node_modules`; no new deps needed
- Architecture patterns: HIGH — all patterns traced to live source files
- Pitfalls: HIGH — cross-referenced against existing test patterns and CLAUDE.md load-bearing rules
- i18n keys: HIGH — en.json inspected; existing namespace structure confirmed

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable codebase; no external API dependency)

---

## RESEARCH COMPLETE

**Phase:** 43 - Engagement UI
**Confidence:** HIGH

### Key Findings

1. **`BottomSheet.tsx` already exists** at `app/src/components/ui/BottomSheet.tsx` — fully functional, backdrop dismiss, CSS transition animation. Needs only a `compact` prop for the 3-row engagement menu use case (currently `minHeight: 45vh` is too tall).

2. **Long-press 480ms pattern is in `ChatMessage.tsx:119-140`** — extract to `useLongPress(ms, callback)` hook in `app/src/hooks/`. Three consumers justify the extraction.

3. **TS-01 scope is exactly one element** — `infoFlow.newsTag` span on news cards (InfoFlow.tsx:263). No other tile type has a presentation-style label. The key exists in all 4 locale bundles. Remove code + all 4 keys in one commit.

4. **Deep-dive insertion site confirmed** — PostDetailScreen.tsx:838 (after scroll sentinel, before takeaway). New state needed: `streamingDeep`, `isStreamingDeep`, `deepError`, `activeVariant: 'standard' | 'deep'`. AbortController contract at lines 313-350 must extend to a 5th signal-arg pass for the deep stream.

5. **HomeScreen has NO `<Header>` component** — Bookmark icon for SV-02 is best placed as a separate `position: fixed` button at `zIndex: 195` (above compact bar at 190). Inside SwipeTabContext, so it correctly floats with the HomeScreen slot.

6. **`engagementService.reset()` insertion site** — SettingsDataScreen.tsx:133, after `dailyReadService.reset()`, before the success toast.

### Files Created

`/Users/Code/EchoLearn/.planning/phases/43-engagement-ui/43-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All libraries verified in live source; no new deps |
| Architecture | HIGH | All patterns traced to live source files; no speculation |
| Pitfalls | HIGH | Cross-referenced CLAUDE.md load-bearing rules + prior phase test patterns |
| i18n | HIGH | en.json inspected; existing namespace structure confirmed |

### Open Questions

None that block planning. Four planner-level discretion choices documented in "Open Questions for Operator" section above.

### Ready for Planning

Research complete. Planner can create PLAN.md files using this document as the primary reference.
