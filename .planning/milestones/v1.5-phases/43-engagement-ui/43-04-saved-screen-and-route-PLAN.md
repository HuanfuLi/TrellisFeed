---
phase: 43-engagement-ui
plan: 04
type: execute
wave: 1
depends_on: [43-01]
files_modified:
  - app/src/screens/SavedScreen.tsx
  - app/src/App.tsx
  - app/tests/screens/SavedScreen.test.mjs
autonomous: true
requirements: [ENGAGE-01, ENGAGE-03]
must_haves:
  truths:
    - "SavedScreen.tsx exists and exports a default React component"
    - "Route '/saved' is registered in App.tsx router children, rendering <PageTransition><SavedScreen/></PageTransition>"
    - "SavedScreen lists posts from engagementService.getSavedPosts() on Saved tab"
    - "SavedScreen lists posts from engagementService.getLikedPosts() on Liked tab"
    - "SavedScreen subscribes to ENGAGEMENT_CHANGED for in-place re-sync (un-save / un-like from a parallel surface refreshes the visible list)"
    - "Empty state renders an icon + heading + body when active tab's list is empty (i18n keys: saved.empty.savedTitle/savedBody/likedTitle/likedBody)"
    - "Header uses backTo='/home' for sub-screen back navigation"
    - "Tap on a row navigates to /posts/:id"
  artifacts:
    - path: "app/src/screens/SavedScreen.tsx"
      provides: "Saved/Liked tabbed archive screen with empty state + Header portal"
      min_lines: 150
      contains: "engagementService"
    - path: "app/src/App.tsx"
      provides: "Router child entry for /saved route"
      contains: "SavedScreen"
    - path: "app/tests/screens/SavedScreen.test.mjs"
      provides: "Source-reading + behavioral assertions for SavedScreen + route registration"
  key_links:
    - from: "app/src/screens/SavedScreen.tsx"
      to: "app/src/services/engagement.service.ts"
      via: "engagementService.getSavedPosts() / .getLikedPosts() / subscribe('ENGAGEMENT_CHANGED', ...)"
      pattern: "engagementService\\.(getSavedPosts|getLikedPosts)"
    - from: "app/src/App.tsx"
      to: "app/src/screens/SavedScreen.tsx"
      via: "import SavedScreen + route children entry"
      pattern: "path: 'saved'"
    - from: "app/src/screens/SavedScreen.tsx"
      to: "app/src/components/ui/Header.tsx"
      via: "Header backTo='/home' for sub-screen portal pattern"
      pattern: "Header[^>]*backTo"
---

<objective>
Implement SV-01..SV-04 from CONTEXT.md: ship a `/saved` sub-screen route with Saved | Liked tabs, mirroring `PostHistoryScreen.tsx`'s compact-card archive layout.

What this plan ships:
1. New file `app/src/screens/SavedScreen.tsx` — sub-screen rendered via Outlet at zIndex 50, NOT always-mounted (per RESEARCH Pitfall 7). Header uses `backTo='/home'` so it portals to `document.body` (Phase 32.1 pattern).
2. Top-of-screen tab bar (Saved | Liked) — operator-chosen tabs (SV-04) over private-only Like model. Active tab gets `var(--primary-40)` color + underline; inactive `var(--muted-foreground)`. Tab state is local `useState<'saved' | 'liked'>('saved')` — no route param.
3. Single-column list (SV-03) mirroring `PostHistoryScreen.tsx` HistoryPostCard pattern verbatim: 52×52 thumbnail + title + contextLabel + tap-to-navigate.
4. Empty state per tab — `<Bookmark size={40}>` (Saved) or `<Heart size={40}>` (Liked) + i18n-keyed heading + body.
5. ENGAGEMENT_CHANGED subscription — re-reads active tab's list whenever the user un-saves / un-likes from any surface (PostDetail, LongPressMenu, future surfaces).
6. Router registration in `App.tsx:294-322`: insert `{ path: 'saved', element: <PageTransition><SavedScreen /></PageTransition> }` between `/review` and `/podcast` (alphabetical reasonable position).

What this plan does NOT do:
- HomeScreen header bookmark icon (SV-02 entry point) — lives in 43-06 along with all other HomeScreen edits to avoid file-touch conflicts with 43-03's MasonryFeed-host wiring.
- LongPressMenu host state — lives in 43-06.

Purpose: Wave-1 plan; parallel-safe with 43-02/03/05/07.
Output: 1 new screen (~180 LOC), 2 lines added to App.tsx, 1 test file filled in.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/43-engagement-ui/43-CONTEXT.md
@.planning/phases/43-engagement-ui/43-RESEARCH.md
@.planning/phases/43-engagement-ui/43-UI-SPEC.md

# Reference implementations to read first
@app/src/screens/PostHistoryScreen.tsx
@app/src/services/engagement.service.ts
@app/src/components/ui/Header.tsx
@app/src/App.tsx
@app/src/lib/event-bus.ts

<interfaces>
From app/src/services/engagement.service.ts:
```typescript
export const engagementService = {
  getSavedPosts(): DailyPost[];   // returns full post objects (resolved via postHistoryService)
  getLikedPosts(): DailyPost[];   // ditto
  // ...
};
```

From app/src/lib/event-bus.ts:
```typescript
export const eventBus: EventBusImpl;
eventBus.subscribe('ENGAGEMENT_CHANGED', (event) => { /* event.payload.kind, event.payload.id */ });
```

From app/src/screens/PostHistoryScreen.tsx (VERBATIM template for layout):
- Container: <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
- Header: <Header backTo="/home" title={t('...')} />
- Scroll container: flex: 1; overflowY: auto; padding: 16px; paddingTop: HEADER_HEIGHT + 16; maxWidth: 448px; margin: 0 auto
- HistoryPostCard row: 52×52 thumbnail (fallback emoji), title (fontSize 14, lineClamp 2), contextLabel (fontSize 12, muted)
- Press state: transform scale(0.98) + background var(--surface-variant) on pointerDown
- Empty state: centered AlertCircle/icon + i18n text

From app/src/components/ui/Header.tsx:
- Props: { title: string; backTo?: string; ...right-slot? }
- With backTo, the back-arrow appears as the left button
- Header sub-screen pattern: outside SwipeTabContext → portals to document.body via createPortal

From app/src/App.tsx router (lines 294-322 — read for insertion point):
- Existing children render via <PageTransition><...Screen /></PageTransition>
- Insert new entry alphabetically reasonable; suggested between 'review' and 'podcast' (alphabetical 's' between 'r' and 'p' is awkward; put after 'review' so the new entry lives near the engagement-related screens)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create SavedScreen.tsx</name>
  <files>app/src/screens/SavedScreen.tsx</files>
  <read_first>
    - app/src/screens/PostHistoryScreen.tsx (read FULL file — verbatim template for: scroll container dims, HistoryPostCard layout, empty state, Header usage, animation keyframes)
    - app/src/services/engagement.service.ts (verify getSavedPosts / getLikedPosts return shapes — DailyPost[])
    - app/src/lib/event-bus.ts (subscribe API)
    - app/src/components/ui/Header.tsx (Header props)
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (SV-01..SV-04 + Claude's Discretion: tab interaction tap-only, sort most-recent-first, empty state copy, no badge counts)
    - .planning/phases/43-engagement-ui/43-UI-SPEC.md (Section "6. /saved screen layout (SavedScreen.tsx)" lines 370-430 — VERBATIM visual contract: tab bar, list row, empty state)
    - .planning/phases/43-engagement-ui/43-RESEARCH.md (Section 5 lines 192-216 — layout pattern; Section 6 lines 219-256 — tab pattern; Pitfall 7 — subscription cleanup)
  </read_first>
  <behavior>
    - Test 1: File exists and exports default React component
    - Test 2: Component renders <Header backTo="/home" title={t('saved.title')}>
    - Test 3: Component renders 2 tab buttons with i18n labels t('saved.tabs.saved') and t('saved.tabs.liked')
    - Test 4: Tab state managed via useState<'saved' | 'liked'>('saved')
    - Test 5: Active tab applies var(--primary-40) color + 2px solid var(--primary-40) borderBottom; inactive uses var(--muted-foreground) + transparent borderBottom
    - Test 6: List source: when activeTab === 'saved', engagementService.getSavedPosts(); when 'liked', engagementService.getLikedPosts()
    - Test 7: Each row is a <button> with 52×52 thumbnail (or fallback emoji per presentationStyle), title (lineClamp 2), contextLabel as meta
    - Test 8: Row tap calls navigate(`/posts/${post.id}`)
    - Test 9: ENGAGEMENT_CHANGED event subscription in useEffect; re-reads the active tab's list on emit
    - Test 10: useEffect cleanup unsubscribes on unmount
    - Test 11: Empty state renders Bookmark (Saved) or Heart (Liked) icon size 40, color var(--muted-foreground), + t('saved.empty.savedTitle' | 'likedTitle') heading + t('saved.empty.savedBody' | 'likedBody') body
    - Test 12: NEGATIVE: source does NOT add transform/will-change/filter/contain/perspective to any ancestor of Header (Phase 32.1 invariant)
    - Test 13: tsc -b --noEmit exits 0
  </behavior>
  <action>
    Create app/src/screens/SavedScreen.tsx mirroring PostHistoryScreen.tsx verbatim where possible. Recommended structure:

    ```typescript
    import { useEffect, useState, useCallback } from 'react';
    import { useNavigate } from 'react-router-dom';
    import { useTranslation } from 'react-i18next';
    import { Bookmark, Heart } from 'lucide-react';
    import { Header, HEADER_HEIGHT } from '../components/ui/Header';
    import { engagementService } from '../services/engagement.service';
    import { eventBus } from '../lib/event-bus';
    import type { DailyPost } from '../types';

    type Tab = 'saved' | 'liked';

    export default function SavedScreen() {
      const { t } = useTranslation();
      const navigate = useNavigate();
      const [activeTab, setActiveTab] = useState<Tab>('saved');
      const [savedPosts, setSavedPosts] = useState<DailyPost[]>(() => engagementService.getSavedPosts());
      const [likedPosts, setLikedPosts] = useState<DailyPost[]>(() => engagementService.getLikedPosts());

      const refresh = useCallback(() => {
        setSavedPosts(engagementService.getSavedPosts());
        setLikedPosts(engagementService.getLikedPosts());
      }, []);

      // Re-sync on ENGAGEMENT_CHANGED (Pitfall 7 — sub-screen lifecycle handles unsubscribe automatically)
      useEffect(() => {
        const unsub = eventBus.subscribe('ENGAGEMENT_CHANGED', () => refresh());
        return unsub;
      }, [refresh]);

      const list = activeTab === 'saved' ? savedPosts : likedPosts;
      const isEmpty = list.length === 0;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <Header backTo="/home" title={t('saved.title')} />
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              paddingTop: `calc(${HEADER_HEIGHT}px + 16px)`,
              paddingBottom: 'var(--bottom-nav-safe, 16px)',
              maxWidth: '448px',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
              <TabButton active={activeTab === 'saved'} onClick={() => setActiveTab('saved')}>
                {t('saved.tabs.saved')}
              </TabButton>
              <TabButton active={activeTab === 'liked'} onClick={() => setActiveTab('liked')}>
                {t('saved.tabs.liked')}
              </TabButton>
            </div>

            {/* List or empty state */}
            {isEmpty ? (
              <EmptyState tab={activeTab} t={t} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {list.map((post, idx) => (
                  <SavedRow
                    key={post.id}
                    post={post}
                    indexInList={idx}
                    onOpen={() => navigate(`/posts/${post.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
      return (
        <button
          type="button"
          role="tab"
          aria-selected={active}
          onClick={onClick}
          style={{
            flex: 1,
            padding: '12px 0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: active ? 700 : 500,
            color: active ? 'var(--primary-40)' : 'var(--muted-foreground)',
            borderBottom: active ? '2px solid var(--primary-40)' : '2px solid transparent',
            marginBottom: '-1px',
            minHeight: '44px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {children}
        </button>
      );
    }

    function SavedRow({ post, indexInList, onOpen }: { post: DailyPost; indexInList: number; onOpen: () => void }) {
      // Mirror PostHistoryScreen HistoryPostCard verbatim — 52×52 thumb + title + meta + press state.
      // (Copy press-state pattern lines 27-36, layout lines 38-83 from PostHistoryScreen.tsx.)
      // ... full implementation per UI-SPEC §6 "List rows" ...
    }

    function EmptyState({ tab, t }: { tab: Tab; t: ReturnType<typeof useTranslation>['t'] }) {
      const Icon = tab === 'saved' ? Bookmark : Heart;
      const titleKey = tab === 'saved' ? 'saved.empty.savedTitle' : 'saved.empty.likedTitle';
      const bodyKey = tab === 'saved' ? 'saved.empty.savedBody' : 'saved.empty.likedBody';
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            gap: '8px',
          }}
        >
          <Icon size={40} color="var(--muted-foreground)" />
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--muted-foreground)', margin: 0 }}>{t(titleKey)}</p>
          <p
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              margin: 0,
              textAlign: 'center',
              maxWidth: '280px',
            }}
          >
            {t(bodyKey)}
          </p>
        </div>
      );
    }
    ```

    For SavedRow, copy the HistoryPostCard from PostHistoryScreen.tsx verbatim:
    - 52×52 thumbnail with fallback emoji ('✎' for text-art, '📄' otherwise) per presentationStyle
    - Title: fontSize 14, fontWeight 500, color var(--foreground), WebkitLineClamp 2
    - Meta: post.contextLabel rendered fontSize 12, fontWeight 500, color var(--muted-foreground), marginTop 3px
    - Press state: transform scale(0.98) + background var(--surface-variant) on onPointerDown
    - Entrance animation per UI-SPEC: opacity 0 → 1, translateY 8px → 0, duration 300ms, delay indexInList * 40ms

    INVARIANTS:
    - DO NOT add transform/will-change/filter/contain/perspective to the outer container or any Header ancestor (Phase 32.1 load-bearing)
    - DO NOT mount this screen in SwipeTabContainer — it lives in <Outlet> via App.tsx route registration
    - DO NOT add CONCEPT_EXPLORED or eventBus.emit calls — read-only screen
    - All user-visible strings go through t() — no hardcoded fallbacks

    Atomic commit message: feat(43): add SavedScreen with Saved/Liked tabs (SV-01..SV-04)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && test -f src/screens/SavedScreen.tsx && grep -q "export default function SavedScreen" src/screens/SavedScreen.tsx && grep -q "engagementService.getSavedPosts" src/screens/SavedScreen.tsx && grep -q "engagementService.getLikedPosts" src/screens/SavedScreen.tsx && grep -q "ENGAGEMENT_CHANGED" src/screens/SavedScreen.tsx && grep -q "backTo=\"/home\"" src/screens/SavedScreen.tsx && [ "$(grep -c -E 'transform:\\s*translateZ|will-change:|filter:|perspective:' src/screens/SavedScreen.tsx)" = "0" ] && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File app/src/screens/SavedScreen.tsx exists with at least 150 lines
    - grep -c "export default function SavedScreen" app/src/screens/SavedScreen.tsx returns 1
    - grep -c "engagementService.getSavedPosts" returns at least 1
    - grep -c "engagementService.getLikedPosts" returns at least 1
    - grep -c "ENGAGEMENT_CHANGED" returns at least 1 (subscription)
    - grep -c "eventBus.subscribe" returns at least 1
    - grep -c "backTo=\"/home\"" returns 1
    - grep -c "useState<Tab>\\|useState<'saved' | 'liked'>" returns at least 1
    - grep -c "saved.tabs.saved\\|saved.tabs.liked\\|saved.empty.savedTitle\\|saved.empty.likedTitle\\|saved.title" returns at least 5 (all 5 i18n keys referenced)
    - grep -c "Bookmark\\|Heart" returns at least 2 (icons for empty state)
    - grep -c "navigate" returns at least 1 (row tap nav to /posts/:id)
    - grep -c "transform: translateZ\\|will-change:\\|perspective:" returns 0 (Phase 32.1 invariant)
    - cd app && npx tsc -b --noEmit exits 0
  </acceptance_criteria>
  <done>SavedScreen ships as a self-contained sub-screen; awaits route registration in Task 2.</done>
</task>

<task type="auto">
  <name>Task 2: Register /saved route in App.tsx</name>
  <files>app/src/App.tsx</files>
  <read_first>
    - app/src/App.tsx (read lines 1-100 to find existing screen imports; lines 290-325 for router children block)
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (SV-01 — route name + Outlet pattern)
    - app/src/screens/PostHistoryScreen.tsx (existing imported sibling pattern — match import style)
  </read_first>
  <action>
    Make two additive edits to app/src/App.tsx:

    1. Add the import for SavedScreen alongside other screen imports (look for the cluster around PostHistoryScreen / ReviewScreen / PodcastScreen imports near the top of the file):
       ```typescript
       import SavedScreen from './screens/SavedScreen';
       ```
       Use the SAME import style as adjacent screen imports (default import; relative path; no alias).

    2. Add the route entry in the router children array at the existing insertion point around line 294-322. Insert AFTER 'review' and BEFORE 'podcast' (between lines containing `{ path: 'review', ... }` and `{ path: 'podcast', ... }`):
       ```typescript
       { path: 'saved', element: <PageTransition><SavedScreen /></PageTransition> },
       ```

    Do NOT touch any other route entry. Do NOT add SavedScreen to BottomNavigation (per CONTEXT.md SV-02 — NOT a 6th tab; SwipeTabContainer is locked at 5 slots).

    Atomic commit message: feat(43): register /saved sub-screen route (SV-01)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "import SavedScreen" src/App.tsx && grep -q "path: 'saved'" src/App.tsx && grep -q "<SavedScreen />" src/App.tsx && npx tsc -b --noEmit && npm run build 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "import SavedScreen" app/src/App.tsx returns 1
    - grep -c "path: 'saved'" app/src/App.tsx returns 1
    - grep -c "<SavedScreen" app/src/App.tsx returns 1
    - The new route entry is rendered inside <PageTransition>...</PageTransition> (matches existing pattern)
    - The new route entry sits between existing 'review' and 'podcast' entries (or adjacent — order-flexible if cleaner)
    - cd app && npx tsc -b --noEmit exits 0
    - cd app && npm run build exits 0 (the route reachable in production)
  </acceptance_criteria>
  <done>/saved route registered; manual nav to /saved renders SavedScreen.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Fill assertions in tests/screens/SavedScreen.test.mjs scaffold</name>
  <files>app/tests/screens/SavedScreen.test.mjs</files>
  <read_first>
    - app/tests/screens/SavedScreen.test.mjs (43-01 Task 4 scaffold)
    - app/src/screens/SavedScreen.tsx (post-Task 1)
    - app/src/App.tsx (post-Task 2)
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (line 50 — expected assertions)
  </read_first>
  <action>
    Replace scaffold with real source-reading assertions:

    ```javascript
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const readSrc = (rel) => readFileSync(path.join(appRoot, rel), 'utf8');

    test('SV-01: /saved route registered in App.tsx with PageTransition wrapper', () => {
      const app = readSrc('src/App.tsx');
      assert.match(app, /import SavedScreen/);
      assert.match(app, /path:\s*['"]saved['"]/);
      assert.match(app, /<SavedScreen\s*\/>/);
      assert.match(app, /<PageTransition>\s*<SavedScreen/);
    });

    test('SV-03/04: SavedScreen exports default + reads saved/liked from engagementService', () => {
      const src = readSrc('src/screens/SavedScreen.tsx');
      assert.match(src, /export default function SavedScreen/);
      assert.match(src, /engagementService\.getSavedPosts\(\)/);
      assert.match(src, /engagementService\.getLikedPosts\(\)/);
    });

    test('SV-04: tabs use local useState (not route param) + 4 i18n empty keys', () => {
      const src = readSrc('src/screens/SavedScreen.tsx');
      assert.match(src, /useState<['"]?(Tab|saved\s*\|\s*liked)['"]?>/, 'Tab state via useState<Tab> or equivalent');
      assert.match(src, /saved\.tabs\.saved/);
      assert.match(src, /saved\.tabs\.liked/);
      assert.match(src, /saved\.empty\.savedTitle/);
      assert.match(src, /saved\.empty\.likedTitle/);
      assert.match(src, /saved\.empty\.savedBody/);
      assert.match(src, /saved\.empty\.likedBody/);
    });

    test('SV: ENGAGEMENT_CHANGED subscription for in-place re-sync', () => {
      const src = readSrc('src/screens/SavedScreen.tsx');
      assert.match(src, /eventBus\.subscribe\(['"]ENGAGEMENT_CHANGED['"]/);
      assert.match(src, /return unsub|return\s*\(\)\s*=>/);  // cleanup
    });

    test('SV: Header uses backTo="/home" (sub-screen portal pattern; Phase 32.1)', () => {
      const src = readSrc('src/screens/SavedScreen.tsx');
      assert.match(src, /<Header\s+backTo=["']\/home["']/);
    });

    test('Phase 32.1 invariant: no transform/will-change/filter/contain/perspective on Header ancestors', () => {
      const src = readSrc('src/screens/SavedScreen.tsx');
      assert.strictEqual((src.match(/transform:\s*translateZ/g) || []).length, 0, 'No translateZ on Header ancestor');
      assert.strictEqual((src.match(/will-change:|willChange:/g) || []).length, 0, 'No will-change');
      assert.strictEqual((src.match(/perspective:|perspective\s*:/g) || []).length, 0, 'No perspective');
      // 'filter:' check exempted because lucide-react icons may use filter for drop-shadow inside leaf nodes (not Header ancestors)
    });

    test('SV: row tap navigates to /posts/:id', () => {
      const src = readSrc('src/screens/SavedScreen.tsx');
      assert.match(src, /navigate\(`\/posts\/\$\{post\.id\}`\)|navigate\(\s*['"`]\/posts\//);
    });
    ```

    Atomic commit message: test(43): fill SV-01..SV-04 assertions into SavedScreen.test.mjs
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/screens/SavedScreen.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file no longer uses skip: option
    - Test count at least 7
    - cd app && node --test tests/screens/SavedScreen.test.mjs exits 0
  </acceptance_criteria>
  <done>SavedScreen + route registration source-reading invariants locked in tests.</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0
- cd app && node --test tests/screens/SavedScreen.test.mjs exits 0
- cd app && npm run build exits 0 (route reachable in production build)
- Manual smoke (deferred to 43-06): navigate to /saved with no engagement state → both tabs render empty state with correct icons.
</verification>

<success_criteria>
- /saved route exists, renders SavedScreen via Outlet
- Tabs Saved/Liked switch lists via local useState
- Empty state shows icon + i18n heading + body per active tab
- ENGAGEMENT_CHANGED subscription keeps list in-sync with parallel surface mutations
- Header backTo='/home' portal pattern preserved (Phase 32.1 invariant)
- Phase 32.1 negative invariants enforced via source-reading test
- 3 atomic commits (SavedScreen code, App.tsx route, test fill-in)
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-04-SUMMARY.md documenting:
- SavedScreen.tsx final LOC
- App.tsx delta (2 lines: import + route entry)
- Confirmation: tabs flip via local state; both lists read from engagementService synchronous getters
- Confirmation: ENGAGEMENT_CHANGED subscribe + cleanup correct
- 3 atomic commit hashes
- Note: HomeScreen bookmark icon entry point lives in 43-06 (file-touch separation)
</output>
