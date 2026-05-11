---
phase: 43-engagement-ui
plan: 03
type: execute
wave: 1
depends_on: [43-01]
files_modified:
  - app/src/components/LongPressMenu.tsx
  - app/src/components/MasonryFeed.tsx
  - app/tests/components/LongPressMenu.test.mjs
  - app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs
autonomous: true
requirements: [ENGAGE-01, ENGAGE-02, ENGAGE-03]
must_haves:
  truths:
    - "LongPressMenu component exists, wraps BottomSheet with compact=true, renders 3 rows (Like/Save/Not interested)"
    - "Row labels and icons flip between active/inactive states based on engagementService.isSaved/isLiked when the menu opens"
    - "Like/Save row tap calls engagementService.likePost/savePost (or their unset counterparts) and emits ENGAGEMENT_CHANGED via the service"
    - "Dismiss row tap calls engagementService.dismissAnchor and emits ANCHOR_DISMISSED via the service"
    - "Toast confirmation fires for every row tap"
    - "LongPressMenu NEVER emits CONCEPT_EXPLORED (anti-wire invariant)"
    - "MasonryFeed.renderTile wraps tiles with useLongPress handlers + onClickCapture guard + corner-icon overlay"
    - "MasonryFeed wraps column tile lists in <AnimatePresence> so ANCHOR_DISMISSED triggers a 200ms fade exit on ALL same-anchor tiles"
    - "Corner state icon overlay renders Bookmark (saved) + Heart (liked) when engagementService.isSaved/isLiked returns true; subscribes to ENGAGEMENT_CHANGED for re-render"
    - "Tile click-after-long-press is suppressed via didLongPress ref + onClickCapture"
  artifacts:
    - path: "app/src/components/LongPressMenu.tsx"
      provides: "Bottom-sheet engagement menu with 3 state-aware rows + anti-wire invariant"
      min_lines: 120
      contains: "engagementService"
    - path: "app/src/components/MasonryFeed.tsx"
      provides: "Existing masonry feed extended with long-press wrapper + corner-icon overlay + AnimatePresence column wrapping"
      contains: "useLongPress"
    - path: "app/tests/components/LongPressMenu.test.mjs"
      provides: "Behavioral + anti-wire assertions for the engagement menu"
    - path: "app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs"
      provides: "Source-reading invariant: AnimatePresence + exit prop + onLongPress prop signature"
  key_links:
    - from: "app/src/components/LongPressMenu.tsx"
      to: "app/src/services/engagement.service.ts"
      via: "import { engagementService } + savePost/likePost/dismissAnchor calls"
      pattern: "engagementService\\.(savePost|likePost|dismissAnchor|removeSavedPost|unlikePost|isSaved|isLiked)"
    - from: "app/src/components/LongPressMenu.tsx"
      to: "app/src/components/ui/BottomSheet.tsx"
      via: "import { BottomSheet } + render with compact prop"
      pattern: "BottomSheet[^>]*compact"
    - from: "app/src/components/MasonryFeed.tsx"
      to: "app/src/hooks/useLongPress.ts"
      via: "import { useLongPress } + bind onto each tile wrapper"
      pattern: "useLongPress"
    - from: "app/src/components/MasonryFeed.tsx"
      to: "app/src/components/LongPressMenu.tsx"
      via: "onLongPress callback prop bubbled up to HomeScreen (43-06 host)"
      pattern: "onLongPress"
---

<objective>
Implement LP-01..LP-05 from CONTEXT.md by creating the LongPressMenu bottom-sheet component AND extending MasonryFeed.tsx with long-press handlers + corner-icon overlay + AnimatePresence column wrapping.

This is a SHIPABLE-IN-ISOLATION plan: the LongPressMenu is opened by a callback bubbled from MasonryFeed to its parent (HomeScreen). 43-06 hosts the actual sheet state at HomeScreen level and wires the callback. This plan defines the contract (MasonryFeed exposes `onLongPress?: (postId: string, anchorId: string) => void`) and ships the LongPressMenu component ready for HomeScreen consumption.

Five LP decisions implemented:
- LP-01: bottom-sheet anchored to viewport (reuses 43-01's BottomSheet compact prop)
- LP-02: 3 stacked rows (Like → Save → Not interested), icons Heart/Bookmark/EyeOff
- LP-03: corner-icon overlay (Bookmark filled + Heart filled) on each tile when saved/liked
- LP-04: dynamic Save/Unsave + Like/Unlike labels based on engagementService.isSaved/isLiked read at open
- LP-05: dismiss UX fades ALL same-anchor tiles in the queue (AnimatePresence wraps column lists; actual state filter lives in HomeScreen in 43-06 — this plan provides the AnimatePresence infrastructure)

Anti-wire invariant (CONTEXT.md canonical_refs): LongPressMenu MUST NOT emit CONCEPT_EXPLORED. Source-reading test guards.

Tile click-after-long-press suppression (RESEARCH Pitfall 2): `onClickCapture` + `didLongPress.current` check prevents accidental navigation when the sheet opens.

Purpose: Wave-1 plan; parallel-safe with 43-02/04/05/07. Output: 1 new component (~150 LOC), MasonryFeed extension (~40 LOC delta), 2 test files filled in.
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
@app/src/components/MasonryFeed.tsx
@app/src/components/ui/BottomSheet.tsx
@app/src/components/InfoFlow.tsx
@app/src/hooks/useLongPress.ts
@app/src/services/engagement.service.ts
@app/src/components/ChatMessage.tsx
@app/src/lib/toast.ts

<interfaces>
From app/src/services/engagement.service.ts (Phase 39 — DO NOT TOUCH this contract):
```typescript
export const engagementService = {
  savePost(postId: string): void,       // emits ENGAGEMENT_CHANGED { kind: 'save', id }
  removeSavedPost(postId: string): void, // emits { kind: 'unsave', id }
  likePost(postId: string): void,        // emits { kind: 'like', id }
  unlikePost(postId: string): void,      // emits { kind: 'unlike', id }
  dismissAnchor(anchorId: string): void, // emits ANCHOR_DISMISSED { anchorId }
  isSaved(postId: string): boolean,
  isLiked(postId: string): boolean,
  isDismissed(anchorId: string): boolean,
  // ...full surface at engagement.service.ts:83+
};
```

From app/src/hooks/useLongPress.ts (43-01 Task 1):
```typescript
export function useLongPress(ms: number, onLongPress: () => void): {
  didLongPress: React.MutableRefObject<boolean>;
  bind: { onPointerDown: () => void; onPointerUp: () => void; onPointerLeave: () => void; onPointerMove: () => void };
};
```

From app/src/components/ui/BottomSheet.tsx (43-01 Task 2):
```typescript
export function BottomSheet({ open, onClose, title?, children, compact? }: BottomSheetProps): JSX.Element;
// compact=true overrides minHeight to 'auto', maxHeight to '50vh'
```

From app/src/lib/toast.ts:
```typescript
export function toast(message: string, type?: 'success' | 'error' | 'info'): void;
```

From app/src/components/MasonryFeed.tsx (existing — Phase 42):
- renderTile at lines 387-453 wraps each tile body in either <motion.div> (newly-appended) or <div> (pre-existing). Both have position: relative.
- Columns at lines 455+ render colA + colB tile lists side-by-side.
- This plan ADDS: long-press handlers on tile wrappers; corner-icon overlay (absolute position inside the relative wrapper); AnimatePresence around column tile lists for LP-05 fade.

From CONTEXT.md LP-04 (state-flip rule):
- isSaved(postId) === false → label "Save" + Bookmark fill="none" + onClick savePost
- isSaved(postId) === true → label "Unsave" + Bookmark fill="currentColor" + onClick removeSavedPost
- isLiked(postId) === false → label "Like" + Heart fill="none" + onClick likePost
- isLiked(postId) === true → label "Unlike" + Heart fill="currentColor" color="var(--node-salmon)" + onClick unlikePost
- Dismiss always: label "Not interested" + EyeOff + onClick dismissAnchor(anchorId)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create LongPressMenu.tsx component</name>
  <files>app/src/components/LongPressMenu.tsx</files>
  <read_first>
    - app/src/services/engagement.service.ts (full file — full method surface; verify savePost/removeSavedPost/likePost/unlikePost/dismissAnchor/isSaved/isLiked signatures)
    - app/src/components/ui/BottomSheet.tsx (post-43-01 — confirm compact prop landed)
    - app/src/lib/toast.ts (toast helper API)
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (Sections LP-01 through LP-04 verbatim)
    - .planning/phases/43-engagement-ui/43-UI-SPEC.md (Section "Component Specs §1 Long-press bottom-sheet menu" lines 182-258 — VERBATIM visual + state-flip contract)
    - .planning/phases/43-engagement-ui/43-RESEARCH.md (Section 2 + Section 3 + Section 8 — bottom sheet, hit targets, anti-wire)
    - app/src/components/InfoFlow.tsx (lines 165-180 for example of using t() + lucide-react icons inline-styled)
    - CLAUDE.md "Style Convention" (inline styles + CSS variables — NOT Tailwind)
  </read_first>
  <behavior>
    - Test 1: app/src/components/LongPressMenu.tsx exists and exports LongPressMenu
    - Test 2: Component props: { open: boolean; onClose: () => void; postId: string | null; anchorId: string | null }
    - Test 3: Renders <BottomSheet open={open} onClose={onClose} compact> when postId is non-null
    - Test 4: Renders exactly 3 <button> rows inside the sheet (Like / Save / Not interested)
    - Test 5: Row order top-to-bottom: Like → Save → Not interested (Heart → Bookmark → EyeOff icons)
    - Test 6: Each row has minHeight 56px (LP-02 — ≥44px floor; UI-SPEC 56px hit target)
    - Test 7: Each row label is rendered via t() — i18n keys engagement.menu.like|unlike|save|unsave|dismiss
    - Test 8: Save row label flips based on engagementService.isSaved(postId) read at open
    - Test 9: Like row label flips based on engagementService.isLiked(postId) read at open
    - Test 10: Save row onClick calls engagementService.savePost(postId) or removeSavedPost(postId) based on current state, then toast(t('engagement.toast.saved' | 'unsaved'), variant), then onClose()
    - Test 11: Like row onClick calls engagementService.likePost(postId) or unlikePost(postId), then toast, then onClose()
    - Test 12: Dismiss row onClick calls engagementService.dismissAnchor(anchorId), then toast(t('engagement.toast.dismissed'), 'info'), then onClose()
    - Test 13: NEGATIVE: source contains 0 occurrences of 'CONCEPT_EXPLORED' (anti-wire invariant per CONTEXT canonical_refs + RESEARCH Pitfall 8)
    - Test 14: NEGATIVE: source contains 0 occurrences of 'eventBus.emit' (engagement service owns emits; this component must NOT bypass)
    - Test 15: NEGATIVE: source does not directly call 'dailyReadService.markExplored' (read-only role; CONCEPT_EXPLORED lives in PostDetail detectors, not engagement)
    - Test 16: Toast variant mapping: save/like = 'success'; unsave/unlike/dismiss = 'info'
    - Test 17: tsc -b --noEmit exits 0
  </behavior>
  <action>
    Create app/src/components/LongPressMenu.tsx with this exact structure (inline-styled per project convention; no Tailwind):

    ```typescript
    import { useTranslation } from 'react-i18next';
    import { Heart, Bookmark, EyeOff } from 'lucide-react';
    import { BottomSheet } from './ui/BottomSheet';
    import { engagementService } from '../services/engagement.service';
    import { toast } from '../lib/toast';

    interface LongPressMenuProps {
      open: boolean;
      onClose: () => void;
      postId: string | null;
      anchorId: string | null;
    }

    /**
     * LP-01..LP-04: Bottom-sheet contextual menu for feed tile engagement actions.
     *
     * State is read SYNCHRONOUSLY on render via engagementService.isSaved/isLiked
     * (no subscription needed — the menu is opened fresh each time with current state).
     *
     * Anti-wire invariant (CONTEXT canonical_refs + RESEARCH Pitfall 8):
     * - This component MUST NEVER emit CONCEPT_EXPLORED.
     * - Only emits via engagementService.* methods, which fire ANCHOR_DISMISSED (dismiss)
     *   or ENGAGEMENT_CHANGED (save/like/unsave/unlike) per Phase 39 D-05.
     * - Source-reading test enforces zero occurrences of 'CONCEPT_EXPLORED' or 'eventBus.emit'.
     */
    export function LongPressMenu({ open, onClose, postId, anchorId }: LongPressMenuProps) {
      const { t } = useTranslation();

      // Bail if menu opens without context (defensive — host should not call this state)
      if (!postId || !anchorId) {
        return <BottomSheet open={false} onClose={onClose} compact>{null}</BottomSheet>;
      }

      const isSaved = engagementService.isSaved(postId);
      const isLiked = engagementService.isLiked(postId);

      const handleSave = () => {
        if (isSaved) {
          engagementService.removeSavedPost(postId);
          toast(t('engagement.toast.unsaved'), 'info');
        } else {
          engagementService.savePost(postId);
          toast(t('engagement.toast.saved'), 'success');
        }
        onClose();
      };

      const handleLike = () => {
        if (isLiked) {
          engagementService.unlikePost(postId);
          toast(t('engagement.toast.unliked'), 'info');
        } else {
          engagementService.likePost(postId);
          toast(t('engagement.toast.liked'), 'success');
        }
        onClose();
      };

      const handleDismiss = () => {
        engagementService.dismissAnchor(anchorId);
        toast(t('engagement.toast.dismissed'), 'info');
        onClose();
      };

      const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minHeight: '56px',
        padding: '0 16px',
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '15px',
        fontWeight: 500,
        color: 'var(--foreground)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      };

      return (
        <BottomSheet open={open} onClose={onClose} compact>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Row 1: Like / Unlike */}
            <button type="button" style={rowStyle} onClick={handleLike}>
              <Heart
                size={22}
                fill={isLiked ? 'currentColor' : 'none'}
                color={isLiked ? 'var(--node-salmon)' : 'var(--foreground)'}
              />
              <span>{isLiked ? t('engagement.menu.unlike') : t('engagement.menu.like')}</span>
            </button>

            {/* Row 2: Save / Unsave */}
            <button type="button" style={rowStyle} onClick={handleSave}>
              <Bookmark
                size={22}
                fill={isSaved ? 'currentColor' : 'none'}
                color={isSaved ? 'var(--primary-40)' : 'var(--foreground)'}
              />
              <span>{isSaved ? t('engagement.menu.unsave') : t('engagement.menu.save')}</span>
            </button>

            {/* Row 3: Not interested (always one state — dismiss is non-destructive but irreversible-in-current-UI) */}
            <button
              type="button"
              style={{ ...rowStyle, color: 'var(--muted-foreground)' }}
              onClick={handleDismiss}
            >
              <EyeOff size={22} color="var(--muted-foreground)" fill="none" />
              <span>{t('engagement.menu.dismiss')}</span>
            </button>
          </div>
        </BottomSheet>
      );
    }
    ```

    KEY INVARIANTS (load-bearing):
    - File contains 0 occurrences of CONCEPT_EXPLORED (anti-wire — source-reading test enforces)
    - File contains 0 occurrences of eventBus.emit (engagement service owns all emits)
    - File contains 0 occurrences of dailyReadService.markExplored (separation of concerns)
    - All 5 i18n keys reachable: engagement.menu.{like,unlike,save,unsave,dismiss}
    - All 5 toast keys reachable: engagement.toast.{saved,unsaved,liked,unliked,dismissed}
    - Row min-height 56px (UI-SPEC §1 — exceeds 44px WCAG floor)
    - BottomSheet rendered with compact prop (43-01 Task 2 dependency)
    - Inline styles + CSS variables only (NO Tailwind classes per project convention)
    - isSaved/isLiked READS happen at render time (synchronous), not on a subscription — menu is short-lived and opened fresh each time

    Atomic commit message: feat(43): add LongPressMenu component (LP-01..LP-04) with anti-wire invariant
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && test -f src/components/LongPressMenu.tsx && grep -q "export function LongPressMenu" src/components/LongPressMenu.tsx && grep -q "engagementService" src/components/LongPressMenu.tsx && grep -q "BottomSheet" src/components/LongPressMenu.tsx && grep -q "compact" src/components/LongPressMenu.tsx && [ "$(grep -c 'CONCEPT_EXPLORED' src/components/LongPressMenu.tsx)" = "0" ] && [ "$(grep -c 'eventBus.emit' src/components/LongPressMenu.tsx)" = "0" ] && [ "$(grep -c 'dailyReadService.markExplored' src/components/LongPressMenu.tsx)" = "0" ] && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File app/src/components/LongPressMenu.tsx exists with at least 120 lines
    - grep -c "^export function LongPressMenu" app/src/components/LongPressMenu.tsx returns 1
    - grep -c "engagementService\\.\\(savePost\\|removeSavedPost\\|likePost\\|unlikePost\\|dismissAnchor\\|isSaved\\|isLiked\\)" app/src/components/LongPressMenu.tsx returns at least 7
    - grep -c "BottomSheet" app/src/components/LongPressMenu.tsx returns at least 2 (import + render)
    - grep -c "compact" app/src/components/LongPressMenu.tsx returns at least 1 (passed to BottomSheet)
    - grep -c "engagement.menu" app/src/components/LongPressMenu.tsx returns at least 5 (one per i18n key reference)
    - grep -c "engagement.toast" app/src/components/LongPressMenu.tsx returns at least 5
    - grep -c "Heart\\|Bookmark\\|EyeOff" app/src/components/LongPressMenu.tsx returns at least 3 (imports + renders)
    - grep -c "minHeight: '56px'" app/src/components/LongPressMenu.tsx returns at least 1
    - grep -c "CONCEPT_EXPLORED" app/src/components/LongPressMenu.tsx returns 0 (anti-wire invariant)
    - grep -c "eventBus.emit" app/src/components/LongPressMenu.tsx returns 0
    - grep -c "dailyReadService.markExplored" app/src/components/LongPressMenu.tsx returns 0
    - cd app && npx tsc -b --noEmit exits 0
  </acceptance_criteria>
  <done>LongPressMenu component shipped with state-aware labels + anti-wire invariant; ready for HomeScreen mount in 43-06.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fill assertions in tests/components/LongPressMenu.test.mjs scaffold</name>
  <files>app/tests/components/LongPressMenu.test.mjs</files>
  <read_first>
    - app/tests/components/LongPressMenu.test.mjs (43-01 Task 4 scaffold — read TODOs)
    - app/tests/components/InfoFlow.video-tap-emit.test.mjs (canonical source-reading invariant test — readFileSync + grep counts)
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (line 47-49 — expected assertions)
    - app/src/components/LongPressMenu.tsx (the file under test — confirm exact source strings to assert)
  </read_first>
  <action>
    Replace the skip-style scaffold with real source-reading + structural assertions:

    ```javascript
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');

    function readSrc(rel) {
      return readFileSync(path.join(appRoot, rel), 'utf8');
    }

    test('LP-01: LongPressMenu renders BottomSheet with compact prop', () => {
      const src = readSrc('src/components/LongPressMenu.tsx');
      assert.match(src, /<BottomSheet[\s\S]*?compact/, 'LongPressMenu must render <BottomSheet compact>');
    });

    test('LP-02: 3 rows with Heart, Bookmark, EyeOff icons', () => {
      const src = readSrc('src/components/LongPressMenu.tsx');
      assert.match(src, /\bHeart\b/, 'Must import/render Heart icon');
      assert.match(src, /\bBookmark\b/, 'Must import/render Bookmark icon');
      assert.match(src, /\bEyeOff\b/, 'Must import/render EyeOff icon');
      // 3 button rows (rough heuristic — each handler should exist)
      assert.match(src, /handleLike/, 'Must have handleLike row handler');
      assert.match(src, /handleSave/, 'Must have handleSave row handler');
      assert.match(src, /handleDismiss/, 'Must have handleDismiss row handler');
    });

    test('LP-04: Save/Like row labels flip via engagementService.isSaved / isLiked', () => {
      const src = readSrc('src/components/LongPressMenu.tsx');
      assert.match(src, /engagementService\.isSaved\(postId\)/, 'Must read isSaved(postId)');
      assert.match(src, /engagementService\.isLiked\(postId\)/, 'Must read isLiked(postId)');
      assert.match(src, /engagement\.menu\.unsave/, 'Must reference engagement.menu.unsave i18n key for active state');
      assert.match(src, /engagement\.menu\.unlike/, 'Must reference engagement.menu.unlike i18n key for active state');
    });

    test('LP: row tap calls engagementService method + emits toast + closes sheet', () => {
      const src = readSrc('src/components/LongPressMenu.tsx');
      assert.match(src, /engagementService\.savePost\(postId\)/);
      assert.match(src, /engagementService\.removeSavedPost\(postId\)/);
      assert.match(src, /engagementService\.likePost\(postId\)/);
      assert.match(src, /engagementService\.unlikePost\(postId\)/);
      assert.match(src, /engagementService\.dismissAnchor\(anchorId\)/);
      assert.match(src, /toast\(t\('engagement\.toast\.saved'\)/);
      assert.match(src, /toast\(t\('engagement\.toast\.dismissed'\)/);
      // onClose called on every row tap
      const onCloseCalls = (src.match(/onClose\(\)/g) || []).length;
      assert.ok(onCloseCalls >= 3, `Expected onClose() called from each of 3 row handlers; found ${onCloseCalls}`);
    });

    test('Anti-wire: LongPressMenu MUST NOT emit CONCEPT_EXPLORED or call eventBus.emit', () => {
      const src = readSrc('src/components/LongPressMenu.tsx');
      const conceptExplored = (src.match(/CONCEPT_EXPLORED/g) || []).length;
      const eventBusEmit = (src.match(/eventBus\.emit/g) || []).length;
      const markExplored = (src.match(/dailyReadService\.markExplored/g) || []).length;
      assert.strictEqual(conceptExplored, 0, 'Anti-wire: LongPressMenu must not reference CONCEPT_EXPLORED (engagementService owns all emits)');
      assert.strictEqual(eventBusEmit, 0, 'Anti-wire: LongPressMenu must not call eventBus.emit directly');
      assert.strictEqual(markExplored, 0, 'Anti-wire: LongPressMenu must not call dailyReadService.markExplored');
    });

    test('LP: row minHeight 56px (≥44px WCAG floor; UI-SPEC §1)', () => {
      const src = readSrc('src/components/LongPressMenu.tsx');
      assert.match(src, /minHeight:\s*['"]56px['"]/);
    });
    ```

    Atomic commit message: test(43): fill LP-01..LP-04 + anti-wire assertions into LongPressMenu.test.mjs
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/components/LongPressMenu.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file no longer uses skip: option — all test() blocks run real assertions
    - Test count >= 6
    - cd app && node --test tests/components/LongPressMenu.test.mjs exits 0
  </acceptance_criteria>
  <done>LongPressMenu test scaffold filled in; all behavioral + anti-wire assertions green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Extend MasonryFeed.tsx with long-press wrapper, corner-icon overlay, and AnimatePresence column wrapping</name>
  <files>app/src/components/MasonryFeed.tsx</files>
  <read_first>
    - app/src/components/MasonryFeed.tsx (read FULL file — understand the current renderTile shape at lines 387-453, the column rendering at lines 455+; the position: relative outer wrapper is the corner-icon overlay anchor)
    - app/src/hooks/useLongPress.ts (43-01 Task 1 — the hook API)
    - app/src/services/engagement.service.ts (verify isSaved/isLiked are synchronous getters)
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (LP-03 + LP-05 verbatim)
    - .planning/phases/43-engagement-ui/43-UI-SPEC.md (Section "2. Tile corner state icon overlay" lines 261-291; Section "4. Dismiss fade animation (LP-05)" lines 317-340)
    - .planning/phases/43-engagement-ui/43-RESEARCH.md (Section 4 corner icons; Pitfall 2 click-after-long-press; Section "Architecture Patterns: Long-press wrapper in MasonryFeed.renderTile")
    - CLAUDE.md "Video post completion signals" — feed video tiles remain NAVIGATION-ONLY; long-press must coexist with this contract
    - CLAUDE.md "Header positioning" — do NOT add transform/will-change/filter to MasonryFeed ancestors
  </read_first>
  <behavior>
    - Test 1: MasonryFeedProps gains an optional `onLongPress?: (postId: string, anchorId: string) => void` prop
    - Test 2: MasonryFeedProps gains an optional `engagementVersion?: number` prop (parent-controlled re-render trigger when ENGAGEMENT_CHANGED fires; HomeScreen-owned subscription in 43-06)
    - Test 3: Source imports useLongPress from '../hooks/useLongPress'
    - Test 4: Source imports Heart, Bookmark from 'lucide-react' (for corner overlay)
    - Test 5: Source imports engagementService from '../services/engagement.service'
    - Test 6: Source imports AnimatePresence from 'framer-motion' (LP-05 fade)
    - Test 7: Each column tile list is wrapped in <AnimatePresence initial={false}>
    - Test 8: Both column tile containers use <motion.div> (not <div>) so AnimatePresence exit fires; the existing newPostIds-driven motion.div stays AND the else-branch <div> also upgrades to <motion.div> per UI-SPEC §4
    - Test 9: Each tile wrapper has motion.div with exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }} 
    - Test 10: Long-press handlers spread onto outer tile wrapper: useLongPress hook is called once per tile (or once per renderTile) returning bind {onPointerDown/Up/Leave/Move} + didLongPress ref; the hook callback invokes props.onLongPress(postId, anchorId)
    - Test 11: onClickCapture handler on outer wrapper checks didLongPress.current and calls e.stopPropagation() (RESEARCH Pitfall 2)
    - Test 12: Corner-icon overlay div rendered inside outer wrapper at position: absolute; top: 8px; right: 8px; zIndex: 10; pointerEvents: none
    - Test 13: Corner overlay renders <Bookmark size=14 filled> when engagementService.isSaved(itemId) returns true (concept tiles only — connection/milestone tiles have no postId to query)
    - Test 14: Corner overlay renders <Heart size=14 filled> when engagementService.isLiked(itemId) returns true
    - Test 15: Both icons stack vertically with gap: 4px when both states present (UI-SPEC §2)
    - Test 16: engagementVersion prop appears in the dependency array of any useMemo/useEffect that re-reads engagement state (forces re-render on ENGAGEMENT_CHANGED bubble from HomeScreen)
    - Test 17: NEGATIVE invariants preserved from Phase 42: no column-count, no will-change, no transform on outer wrapper, no CONCEPT_EXPLORED emit
    - Test 18: tsc -b --noEmit exits 0
  </behavior>
  <action>
    Modify app/src/components/MasonryFeed.tsx with these additive edits (preserve all Phase 42 invariants from CLAUDE.md + 42-01 PLAN):

    1. Add imports at top:
       ```typescript
       import { Heart, Bookmark } from 'lucide-react';
       import { AnimatePresence } from 'framer-motion';   // motion already imported
       import { useLongPress } from '../hooks/useLongPress';
       import { engagementService } from '../services/engagement.service';
       ```

    2. Extend MasonryFeedProps interface (in-place):
       ```typescript
       interface MasonryFeedProps {
         items: InfoFlowItem[];
         onOpenConnection: (idA: string, idB: string) => void;
         showConnectionScores?: boolean;
         onOpenPost: (postId: string, post: DailyPost) => void;
         allExplored: boolean;
         onLongPress?: (postId: string, anchorId: string) => void;  // LP — HomeScreen owns menu state in 43-06
         engagementVersion?: number;                                  // HomeScreen-bumped on ENGAGEMENT_CHANGED so corner icons re-render
       }
       ```

    3. Refactor `renderTile` to use the long-press hook. Since `useLongPress` is a React hook, it cannot be called inside the renderTile loop directly. Use one of these two patterns:

       Pattern A (preferred — extract tile wrapper into a component):
       Create a new internal component `TileWrapper` defined inside MasonryFeed.tsx (or as a sibling memoized component above the MasonryFeed function) that:
       - Receives: tileBody (children), itemId, conceptId/anchorId, isConcept (boolean), shouldAnimate (boolean), onLongPress callback, engagementVersion
       - Calls useLongPress(480, () => onLongPress?.(itemId, anchorId)) at the top level
       - Renders <motion.div> with: variants, initial, animate, exit, transition (existing logic from 42-01 + new exit prop), position: relative, data-feed-id, data-concept-id, {...bind}, onClickCapture
       - onClickCapture: if (didLongPress.current) { didLongPress.current = false; e.stopPropagation(); }
       - Inside the motion.div, renders {tileBody} + the corner-icon overlay (absolute, top: 8px, right: 8px, zIndex: 10, pointerEvents: 'none')
       - Corner-icon visibility derived from engagementService.isSaved(itemId) / isLiked(itemId) — these are synchronous getters
       - useMemo or just direct read with engagementVersion in the dep array forces re-render when HomeScreen bumps the version

       Pattern B (only if Pattern A is hard to retrofit): keep renderTile but factor out per-tile state and pass useLongPress's bind via a per-tile component still.

       Required shape for the corner-icon overlay block (rendered ONLY for kind === 'concept' tiles — connection + milestone tiles have no postId for engagement service):

       ```jsx
       {isConcept && (isSaved || isLiked) && (
         <div
           aria-hidden="true"
           style={{
             position: 'absolute',
             top: '8px',
             right: '8px',
             zIndex: 10,
             display: 'flex',
             flexDirection: 'column',
             gap: '4px',
             pointerEvents: 'none',
           }}
         >
           {isSaved && (
             <Bookmark
               size={14}
               fill="var(--primary-40)"
               color="var(--primary-40)"
               style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
             />
           )}
           {isLiked && (
             <Heart
               size={14}
               fill="var(--node-salmon)"
               color="var(--node-salmon)"
               style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
             />
           )}
         </div>
       )}
       ```

       isSaved / isLiked computed with engagementVersion in the dep array:
       ```typescript
       const isSaved = useMemo(() => isConcept ? engagementService.isSaved(itemId) : false, [itemId, isConcept, engagementVersion]);
       const isLiked = useMemo(() => isConcept ? engagementService.isLiked(itemId) : false, [itemId, isConcept, engagementVersion]);
       ```

    4. Wrap each column's tile list in `<AnimatePresence initial={false}>`:
       ```jsx
       <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
         <AnimatePresence initial={false}>
           {colATiles.map((item, idx) => renderTile(item, idx))}
         </AnimatePresence>
       </div>
       <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
         <AnimatePresence initial={false}>
           {colBTiles.map((item, idx) => renderTile(item, idx))}
         </AnimatePresence>
       </div>
       ```

    5. Upgrade the else-branch (non-newly-appended) wrapper from `<div>` to `<motion.div>` so AnimatePresence detects its exit. Keep its `variants` undefined or omitted so it does NOT re-enter on layout shifts; only the `exit` prop is needed.

       For every tile wrapper (newly-appended motion.div AND previously-existing motion.div), add:
       ```typescript
       exit={{ opacity: 0, scale: 0.96 }}
       transition={{ ...existing transition for entrance..., duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
       ```
       For exit specifically (separate from entrance transition), wrap inside `exit={{ ... transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } }}` per framer-motion v12 API.

    6. Inside the new TileWrapper component, integrate the long-press hook:
       ```typescript
       const { didLongPress, bind } = useLongPress(480, () => {
         if (onLongPress && itemId && anchorId) onLongPress(itemId, anchorId);
       });
       ```
       Spread `{...bind}` onto the motion.div alongside other props.

       Add `onClickCapture` to the motion.div:
       ```typescript
       onClickCapture={(e: React.MouseEvent) => {
         if (didLongPress.current) {
           didLongPress.current = false;
           e.stopPropagation();
         }
       }}
       ```

    7. PRESERVE all Phase 42 invariants:
       - No column-count / columnCount / break-inside / breakInside
       - No will-change / willChange / perspective:
       - No position: 'fixed' on column wrappers
       - No dailyReadService.markExplored or CONCEPT_EXPLORED literal in MasonryFeed.tsx
       - 3 video useEffects (visibilitychange, swipeProgress, location.pathname, IntersectionObserver) UNTOUCHED — these stay verbatim from 42-01
       - MotionConfig reducedMotion="user" wrapper still wraps the entire return

    Atomic commit message: feat(43): MasonryFeed long-press wrapper + corner-icon overlay + AnimatePresence column wrapping (LP-03 + LP-05)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "import { useLongPress" src/components/MasonryFeed.tsx && grep -q "AnimatePresence" src/components/MasonryFeed.tsx && grep -q "engagementService" src/components/MasonryFeed.tsx && grep -q "onLongPress" src/components/MasonryFeed.tsx && grep -q "engagementVersion" src/components/MasonryFeed.tsx && grep -q "onClickCapture" src/components/MasonryFeed.tsx && grep -q "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" src/components/MasonryFeed.tsx && [ "$(grep -c 'CONCEPT_EXPLORED' src/components/MasonryFeed.tsx)" = "0" ] && [ "$(grep -c 'dailyReadService.markExplored' src/components/MasonryFeed.tsx)" = "0" ] && [ "$(grep -c -E 'column-count|columnCount|break-inside|breakInside' src/components/MasonryFeed.tsx)" = "0" ] && [ "$(grep -c -E 'will-change|willChange|perspective:' src/components/MasonryFeed.tsx)" = "0" ] && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "import { useLongPress" app/src/components/MasonryFeed.tsx returns 1
    - grep -c "AnimatePresence" app/src/components/MasonryFeed.tsx returns at least 3 (import + colA wrap + colB wrap)
    - grep -c "import { engagementService" app/src/components/MasonryFeed.tsx returns 1
    - grep -c "onLongPress" app/src/components/MasonryFeed.tsx returns at least 2 (prop type + usage)
    - grep -c "engagementVersion" app/src/components/MasonryFeed.tsx returns at least 2 (prop type + usage in dep array)
    - grep -c "onClickCapture" app/src/components/MasonryFeed.tsx returns at least 1
    - grep -c "didLongPress" app/src/components/MasonryFeed.tsx returns at least 2
    - grep -c "engagementService.isSaved" app/src/components/MasonryFeed.tsx returns at least 1
    - grep -c "engagementService.isLiked" app/src/components/MasonryFeed.tsx returns at least 1
    - grep -c "Bookmark" app/src/components/MasonryFeed.tsx returns at least 2 (import + corner render)
    - grep -c "Heart" app/src/components/MasonryFeed.tsx returns at least 2 (import + corner render)
    - grep -c "exit:" app/src/components/MasonryFeed.tsx OR grep -c "exit=" returns at least 1
    - grep -c "scale: 0.96" app/src/components/MasonryFeed.tsx returns at least 1
    - All Phase 42 negative invariants preserved (column-count, will-change, perspective, CONCEPT_EXPLORED, dailyReadService.markExplored — all 0)
    - grep -c "MotionConfig" app/src/components/MasonryFeed.tsx returns at least 1 (still wraps return)
    - grep -c "visibilitychange" app/src/components/MasonryFeed.tsx returns at least 1 (video state useEffect 1 still present)
    - grep -c "IntersectionObserver" app/src/components/MasonryFeed.tsx returns at least 1 (video state useEffect 3 still present)
    - cd app && npx tsc -b --noEmit exits 0
  </acceptance_criteria>
  <done>MasonryFeed gains long-press wrapper, corner-icon overlay, AnimatePresence for fade exits; Phase 42 invariants preserved.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Fill assertions in tests/components/MasonryFeed.dismiss-fade-all.test.mjs scaffold</name>
  <files>app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs</files>
  <read_first>
    - app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs (43-01 Task 4 scaffold)
    - app/src/components/MasonryFeed.tsx (post-Task 3 — confirm exact source strings)
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (line 49 — expected assertions)
  </read_first>
  <action>
    Replace the scaffold with real source-reading assertions:

    ```javascript
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const src = readFileSync(path.join(appRoot, 'src/components/MasonryFeed.tsx'), 'utf8');

    test('LP-03/05: MasonryFeed integrates useLongPress hook', () => {
      assert.match(src, /import\s+\{\s*useLongPress\s*\}\s+from\s+['"]\.\.\/hooks\/useLongPress['"]/);
      assert.match(src, /useLongPress\s*\(\s*480/, 'Must invoke useLongPress with 480ms (codebase-wide long-press timer)');
    });

    test('LP-03: corner icon overlay reads engagement state per tile', () => {
      assert.match(src, /engagementService\.isSaved/);
      assert.match(src, /engagementService\.isLiked/);
      assert.match(src, /\bBookmark\b/);
      assert.match(src, /\bHeart\b/);
    });

    test('LP-05: each column tile list is wrapped in AnimatePresence', () => {
      assert.match(src, /import\s+\{[^}]*AnimatePresence[^}]*\}\s+from\s+['"]framer-motion['"]/);
      const apCount = (src.match(/<AnimatePresence/g) || []).length;
      assert.ok(apCount >= 2, `Expected at least 2 <AnimatePresence> tags (one per column), found ${apCount}`);
    });

    test('LP-05: tile wrappers have exit prop with opacity 0 + scale 0.96', () => {
      assert.match(src, /opacity:\s*0[^}]*scale:\s*0\.96|scale:\s*0\.96[^}]*opacity:\s*0/);
    });

    test('LP: click-after-long-press suppression via onClickCapture + didLongPress', () => {
      assert.match(src, /onClickCapture/);
      assert.match(src, /didLongPress\.current/);
    });

    test('LP: onLongPress prop bubbled up to host (HomeScreen owns menu state in 43-06)', () => {
      assert.match(src, /onLongPress\?\s*:\s*\(/, 'Must declare onLongPress?: (...) => void prop type');
      assert.match(src, /engagementVersion\?\s*:\s*number/, 'Must declare engagementVersion?: number prop type');
    });

    test('Phase 42 invariants preserved (load-bearing CLAUDE.md rules)', () => {
      assert.strictEqual((src.match(/CONCEPT_EXPLORED/g) || []).length, 0, 'CONCEPT_EXPLORED must not be re-introduced into MasonryFeed (single-emit invariant)');
      assert.strictEqual((src.match(/dailyReadService\.markExplored/g) || []).length, 0, 'dailyReadService.markExplored must not be added to MasonryFeed (single-emit invariant)');
      assert.strictEqual((src.match(/\bcolumn-count\b|\bcolumnCount\b|\bbreak-inside\b|\bbreakInside\b/g) || []).length, 0, 'D-02: height-accumulating split, not CSS column-count');
      assert.strictEqual((src.match(/\bwill-change\b|\bwillChange\b|\bperspective:\b/g) || []).length, 0, 'CLAUDE.md Header positioning: no will-change/perspective on Header ancestors');
      assert.match(src, /MotionConfig/, 'MotionConfig reducedMotion="user" must still wrap MasonryFeed return');
      assert.match(src, /visibilitychange/, 'Phase 36 GAP-C: visibilitychange video state handler preserved');
      assert.match(src, /IntersectionObserver/, 'Phase 36 GAP-C: IntersectionObserver scroll-out cleanup preserved');
    });
    ```

    Atomic commit message: test(43): fill LP-03/05 + Phase 42 invariants into MasonryFeed.dismiss-fade-all.test.mjs
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/components/MasonryFeed.dismiss-fade-all.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file no longer uses skip: option
    - Test count at least 7
    - cd app && node --test tests/components/MasonryFeed.dismiss-fade-all.test.mjs exits 0
  </acceptance_criteria>
  <done>MasonryFeed long-press/corner-icon/AnimatePresence source-reading invariants locked in tests.</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0
- cd app && node --test tests/components/LongPressMenu.test.mjs exits 0
- cd app && node --test tests/components/MasonryFeed.dismiss-fade-all.test.mjs exits 0
- cd app && node --test tests/components/InfoFlow.video-tap-emit.test.mjs exits 0 (counterweight — Phase 36 GAP-C signal site untouched)
- cd app && node --test tests/components/MasonryFeed.tile-padding.test.mjs OR similar Phase 42 test still passes (no regression)
- cd app && npm test full suite passes (or only TODO tests still in 43-04/05/06/07 scaffolds skip)
</verification>

<success_criteria>
- LongPressMenu.tsx ships as a usable React component consumed by HomeScreen in 43-06
- MasonryFeed.tsx gains long-press wrapper, corner-icon overlay, AnimatePresence for dismiss-fade
- All Phase 42 invariants (no column-count, no will-change, MotionConfig wrap, video useEffects, single-emit GAP-C) preserved
- Anti-wire invariant in LongPressMenu: 0 CONCEPT_EXPLORED, 0 eventBus.emit, 0 markExplored — source-reading test enforces
- Long-press onLongPress prop bubbled up to MasonryFeed parent for HomeScreen to host the sheet state in 43-06
- engagementVersion prop allows HomeScreen to bump re-renders on ENGAGEMENT_CHANGED without subscribing in every tile
- 4 atomic commits (LongPressMenu code, LongPressMenu test, MasonryFeed code, MasonryFeed test)
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-03-SUMMARY.md documenting:
- LongPressMenu.tsx final LOC count
- MasonryFeed.tsx delta LOC (lines added vs Phase 42 baseline)
- Confirmation of all 4 source-reading invariants:
  1. CONCEPT_EXPLORED count = 0 in LongPressMenu.tsx
  2. CONCEPT_EXPLORED count = 0 in MasonryFeed.tsx
  3. column-count count = 0 in MasonryFeed.tsx
  4. will-change count = 0 in MasonryFeed.tsx
- 4 atomic commit hashes
- Note: the LongPressMenu is component-only; HomeScreen hosts the sheet's open state + postId/anchorId in 43-06.
</output>
