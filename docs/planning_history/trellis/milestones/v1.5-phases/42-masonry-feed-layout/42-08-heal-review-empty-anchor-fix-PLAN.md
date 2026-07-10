---
phase: 42-masonry-feed-layout
plan: 08
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/screens/ReviewScreen.tsx
  - app/src/locales/en.json
  - app/src/locales/zh.json
  - app/src/locales/es.json
  - app/src/locales/ja.json
  - app/tests/screens/ReviewScreen.anchor-empty-state.test.mjs
autonomous: true
gap_closure: true
requirements:
  - MASONRY-02
user_setup: []

must_haves:
  truths:
    - "Tapping the Heal CTA on VineBloomCard for an anchor with ZERO extracted flashcards lands on /review and shows an anchor-scoped empty state naming that anchor — NOT today's full SM-2 due queue."
    - "Tapping the Heal CTA on VineBloomCard for an anchor WITH extracted flashcards still works as before (filtered queue renders normally)."
    - "When no nav-state filter is requested at all, /review still shows today's SM-2 due queue (existing default path is preserved)."
    - "Source-reading regression test asserts ReviewScreen.tsx uses the `filteredItems !== null` shape (NOT `Boolean(filteredItems && filteredItems.length > 0)`), so the fail-open form cannot be silently reintroduced."
    - "All 4 locale bundles (en/zh/es/ja) carry the new empty-state copy under matching key paths and bundle-parity.test.mjs still passes."
  artifacts:
    - path: "app/src/screens/ReviewScreen.tsx"
      provides: "Two-state isFiltered semantics + anchor-scoped empty-state branch"
      contains: "filteredItems !== null"
    - path: "app/src/locales/en.json"
      provides: "review.done.anchorEmptyHeading + review.done.anchorEmptyBody (canonical)"
      contains: "anchorEmptyHeading"
    - path: "app/src/locales/zh.json"
      provides: "review.done.anchorEmptyHeading + review.done.anchorEmptyBody (zh translation)"
      contains: "anchorEmptyHeading"
    - path: "app/src/locales/es.json"
      provides: "review.done.anchorEmptyHeading + review.done.anchorEmptyBody (es translation)"
      contains: "anchorEmptyHeading"
    - path: "app/src/locales/ja.json"
      provides: "review.done.anchorEmptyHeading + review.done.anchorEmptyBody (ja translation)"
      contains: "anchorEmptyHeading"
    - path: "app/tests/screens/ReviewScreen.anchor-empty-state.test.mjs"
      provides: "Source-reading regression test locking the isFiltered shape + empty-state branch wiring"
      contains: "filteredItems !== null"
  key_links:
    - from: "app/src/components/VineBloomCard.tsx (handleHeal nav-state)"
      to: "app/src/screens/ReviewScreen.tsx (anchorReview consumer)"
      via: "useLocation().state.anchorReview = { anchorId, qaIds, title }"
      pattern: "anchorReview"
    - from: "app/src/screens/ReviewScreen.tsx (line ~519 done-or-empty branch)"
      to: "app/src/locales/{en,zh,es,ja}.json (review.done.anchorEmpty*)"
      via: "t('review.done.anchorEmptyHeading') / t('review.done.anchorEmptyBody', { title })"
      pattern: "review\\.done\\.anchorEmpty"
---

<objective>
Fix the fail-open `isFiltered` boolean in `ReviewScreen.tsx` so the Heal CTA on VineBloomCard (and any other anchor/cluster/move filter caller) shows an anchor-scoped empty state when zero flashcards match — instead of silently dumping the user into today's full SM-2 due queue.

Purpose: Phase 42 Wave 4 promoted the Heal CTA into the always-on celebration UX. The latent fail-open bug at `ReviewScreen.tsx:299` (pre-existing in PlannerScreen heal/replant flow too) became user-visible: tapping Heal on an anchor with no extracted flashcards (statistically common — celebration targets dying/dead anchors the user has been ignoring) renders unrelated cards from other anchors. UAT-4 captured the operator's report verbatim: "I clicked Heal 'Feynman Technique' and I am navigated to review page correctly, but I see mock flashcards like 'What is dialectical materialism' and 'Quantum entanglement'." Diagnosis at `.planning/debug/heal-review-shows-mock-cards.md` confirmed: cards are real (codebase has zero mock-seed hits), but `isFiltered = Boolean(filteredItems && filteredItems.length > 0)` collapses "no matching cards" to "no filter requested" → reviewItems falls back to `items` (today's queue).

Output: Two surgical edits to `ReviewScreen.tsx` (line 299 + the done-or-empty branch ~line 519), four locale bundles updated with the new empty-state copy, and one source-reading regression test under `app/tests/screens/`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/42-masonry-feed-layout/42-HUMAN-UAT.md
@.planning/debug/heal-review-shows-mock-cards.md
@CLAUDE.md
@app/src/screens/ReviewScreen.tsx
@app/src/locales/en.json
@app/scripts/translate-locales.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from the codebase. -->
<!-- The executor MUST use these directly — no additional codebase exploration needed for these surfaces. -->

From `app/src/screens/ReviewScreen.tsx` (CURRENT STATE — to be patched):

```typescript
// Line 281-284 — anchorReview filter (UNCHANGED — keep verbatim)
const anchorReview = (location.state as { anchorReview?: { anchorId: string; qaIds: string[]; title: string } } | null)?.anchorReview;
const anchorFilteredItems = anchorReview
  ? dedupeCards(allCards.filter((card) => anchorReview.qaIds.some((qaId) => card.nodeId === qaId)))
  : null;

// Line 287-290 — clusterReview filter (UNCHANGED — keep verbatim)
const clusterReview = (location.state as { clusterReview?: { clusterId: string; qaIds: string[]; title: string } } | null)?.clusterReview;
const clusterFilteredItems = clusterReview
  ? dedupeCards(allCards.filter((card) => clusterReview.qaIds.some((qaId) => card.nodeId === qaId)))
  : null;

// Line 293-295 — moveReview filter (UNCHANGED — keep verbatim)
const moveFilteredItems = linkedResource?.type === 'review' && linkedResource.id
  ? items.filter((card) => card.nodeId === linkedResource.id)
  : null;

// Line 297-299 — THE BUG SITE
const filteredItems = anchorFilteredItems ?? clusterFilteredItems ?? moveFilteredItems;
const isFiltered = Boolean(filteredItems && filteredItems.length > 0);  // ← fail-open
```

From `app/src/screens/ReviewScreen.tsx` (CURRENT STATE — done-or-empty branch ~line 519):

```typescript
// Line 519 — single branch covers BOTH "user finished reviewing" AND "queue was empty from the start"
if (done || reviewItems.length === 0) {
  const avgRating = reviewed > 0 ? (totalRatings / reviewed).toFixed(1) : '—';
  const finishedMessage = reviewed > 0
    ? (reviewed === 1 ? t('review.done.finishedOne', { count: reviewed }) : t('review.done.finishedOther', { count: reviewed }))
    : t('review.done.noneDue');
  return (
    <div ...>
      ...
      <h2 style={{ marginBottom: '8px' }}>{t('review.done.heading')}</h2>
      <p style={{ color: 'var(--muted-foreground)', marginBottom: '24px' }}>{finishedMessage}</p>
      ...
    </div>
  );
}
```

From `app/src/locales/en.json` (CURRENT review.done shape — line 207-215):

```json
"done": {
  "heading": "All Done!",
  "finishedOne": "Great work! You reviewed {{count}} card today.",
  "finishedOther": "Great work! You reviewed {{count}} cards today.",
  "noneDue": "No cards due today — come back tomorrow!",
  "reviewed": "Reviewed",
  "avgRating": "Avg rating",
  "allFlashcardsCta": "All Flashcards"
}
```

From `app/src/services/trellis-actions.service.ts:54-72` (UNCHANGED — confirms the nav payload shape):

```typescript
heal(anchorId, anchorName, qaIds): { navigateTo: '/review', state: { anchorReview: { anchorId, qaIds, title: anchorName } } }
```

From `app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs` (REFERENCE PATTERN — source-reading invariant test):

```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET_PATH = resolve(__dirname, '../../src/screens/<file>.tsx');
const source = readFileSync(TARGET_PATH, 'utf-8');

describe('<scope> (Phase <N> <ID>)', () => {
  it('<positive presence>', () => { ... });
  it('does NOT contain <bad pattern>', () => { ... });
});
```
</interfaces>

<scope_boundary>
DO NOT TOUCH (out of scope — explicit per gap_summary):
- `app/src/components/VineBloomCard.tsx` (its nav payload is correct per debug session)
- `app/src/components/MasonryFeed.tsx` (Phase 42 layout work — separate concern)
- `app/src/services/trellis-actions.service.ts` (heal() service contract is correct)
- `app/src/services/flashcard.service.ts` (the optional follow-up "seed flashcards from QA records on heal" is plan-gated future work — deferred per gap_summary)
- `app/src/screens/PlannerScreen.tsx` (same fail-open bug pre-exists there but per gap_summary scope-discipline this fix is ReviewScreen-only; the ReviewScreen patch closes the bug for BOTH callers since both go through the same screen)
- ANY new methods on `trellisActionsService` (would violate the Phase 42 "ZERO new methods" invariant locked at decision time)

DO NOT BUNDLE:
- Seeding flashcards from QA records on heal() (the optional follow-up at `heal-review-shows-mock-cards.md:67`). Plan-gated future work — keep this PR scope-pure.
- Fixing the same bug surface in PlannerScreen (no PlannerScreen.tsx code change; this fix sits at the consumer/ReviewScreen boundary which is shared).
</scope_boundary>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write source-reading regression test for the new isFiltered shape (RED)</name>
  <files>app/tests/screens/ReviewScreen.anchor-empty-state.test.mjs</files>
  <behavior>
    - Test 1 (counterweight — proves the test reads the right file): assert `ReviewScreen.tsx` source contains the substring `anchorReview` (existing line 281). Without this, the negative-grep tests below would silently pass against a missing/renamed file.
    - Test 2 (positive presence — locks the fix): assert `ReviewScreen.tsx` source contains `filteredItems !== null` somewhere. This is the new isFiltered shape.
    - Test 3 (negative grep — locks the fail-open form OUT): assert `ReviewScreen.tsx` source does NOT contain `Boolean(filteredItems && filteredItems.length > 0)`. The exact pre-fix form (and minor whitespace variants — match on `Boolean\(\s*filteredItems\s*&&\s*filteredItems\.length\s*>\s*0\s*\)` regex) MUST be absent so a future refactor can't silently regress to it.
    - Test 4 (empty-state branch wiring — locks the i18n key reference): assert `ReviewScreen.tsx` source contains the substring `review.done.anchorEmptyHeading` AND `review.done.anchorEmptyBody`. Both keys must be referenced from the screen so the bundle-parity test catches missing translations and the empty-state branch can't be removed without test failure.
    - Test 5 (i18n bundle parity — quick sanity): for each of the 4 locale files (en, zh, es, ja), assert the parsed JSON has `review.done.anchorEmptyHeading` AND `review.done.anchorEmptyBody` as non-empty strings. (`bundle-parity.test.mjs` covers structural parity in CI; this test gives us a fast-failing local signal during the RED→GREEN cycle.)
  </behavior>
  <action>
    Create `app/tests/screens/ReviewScreen.anchor-empty-state.test.mjs` following the source-reading invariant pattern from `app/tests/screens/HomeScreen.no-more-posts-toast.test.mjs`.

    Skeleton:

    ```js
    // Phase 42 plan 42-08 — Heal CTA renders anchor-scoped empty state, not today's queue.
    //
    // Locks the fix for Gap 2 (UAT-4): ReviewScreen.tsx:299 used to be
    //   `const isFiltered = Boolean(filteredItems && filteredItems.length > 0);`
    // which collapsed "filter requested but zero matches" into "no filter
    // requested" and fell back to today's full SM-2 due queue.
    //
    // The fix: `const isFiltered = filteredItems !== null;` — distinguishes the
    // two states, and the done-or-empty branch renders an anchor-scoped empty
    // message ("No flashcards yet for {{title}} ...") when the filter yields zero.
    //
    // Pattern: Pattern A (counterweight + positive presence + negative grep on
    // ReviewScreen.tsx) plus a parsed-JSON sanity check across all 4 locale bundles.

    import assert from 'node:assert/strict';
    import { describe, it } from 'node:test';
    import { readFileSync } from 'node:fs';
    import { fileURLToPath } from 'node:url';
    import { dirname, resolve } from 'node:path';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const REVIEW_SCREEN_PATH = resolve(__dirname, '../../src/screens/ReviewScreen.tsx');
    const source = readFileSync(REVIEW_SCREEN_PATH, 'utf-8');

    const LOCALE_PATHS = ['en', 'zh', 'es', 'ja'].map((code) => ({
      code,
      path: resolve(__dirname, `../../src/locales/${code}.json`),
    }));

    describe('ReviewScreen anchor-scoped empty state (Phase 42 Gap 2 / UAT-4)', () => {
      it('still references anchorReview from location.state (counterweight — proves test reads the right file)', () => {
        assert.ok(
          /anchorReview/.test(source),
          'ReviewScreen.tsx must still reference anchorReview from location.state — the heal-CTA filter consumer.',
        );
      });

      it('uses `filteredItems !== null` to distinguish "no filter" from "filter matched zero"', () => {
        assert.ok(
          /filteredItems\s*!==\s*null/.test(source),
          'ReviewScreen.tsx must use `filteredItems !== null` (the new shape) — distinguishes "no filter requested" from "filter requested but zero matches" so the heal CTA does NOT silently fall back to today\'s SM-2 queue.',
        );
      });

      it('does NOT use the fail-open `Boolean(filteredItems && filteredItems.length > 0)` form', () => {
        // Match the exact pre-fix form plus whitespace variants.
        assert.ok(
          !/Boolean\s*\(\s*filteredItems\s*&&\s*filteredItems\.length\s*>\s*0\s*\)/.test(source),
          'ReviewScreen.tsx must NOT use Boolean(filteredItems && filteredItems.length > 0) — that form is fail-open: an anchor with zero matching flashcards collapses to "no filter" and dumps the user into today\'s full queue (Gap 2 / UAT-4 root cause). Use `filteredItems !== null` instead.',
        );
      });

      it('references review.done.anchorEmptyHeading and anchorEmptyBody for the empty-state branch', () => {
        assert.ok(
          /review\.done\.anchorEmptyHeading/.test(source),
          'ReviewScreen.tsx must call t("review.done.anchorEmptyHeading") in the done-or-empty branch — anchor-scoped empty state heading.',
        );
        assert.ok(
          /review\.done\.anchorEmptyBody/.test(source),
          'ReviewScreen.tsx must call t("review.done.anchorEmptyBody", { title: ... }) in the done-or-empty branch — anchor-scoped empty state body using the title from nav state.',
        );
      });
    });

    describe('Locale bundles carry review.done.anchorEmpty* keys (Phase 42 Gap 2 i18n)', () => {
      for (const { code, path } of LOCALE_PATHS) {
        it(`${code}.json has non-empty review.done.anchorEmptyHeading + anchorEmptyBody`, () => {
          const bundle = JSON.parse(readFileSync(path, 'utf-8'));
          const heading = bundle?.review?.done?.anchorEmptyHeading;
          const body = bundle?.review?.done?.anchorEmptyBody;
          assert.ok(
            typeof heading === 'string' && heading.trim().length > 0,
            `locales/${code}.json must define review.done.anchorEmptyHeading as a non-empty string — anchor-scoped empty state heading for the heal CTA.`,
          );
          assert.ok(
            typeof body === 'string' && body.trim().length > 0,
            `locales/${code}.json must define review.done.anchorEmptyBody as a non-empty string — anchor-scoped empty state body, must contain {{title}} interpolation.`,
          );
          assert.ok(
            body.includes('{{title}}'),
            `locales/${code}.json review.done.anchorEmptyBody must contain the {{title}} interpolation marker — uses the title from nav state.`,
          );
        });
      }
    });
    ```

    Run this RED-style — the new file MUST exist BEFORE the implementation is touched, and the test MUST fail at this point (the i18n keys don't exist; the source still has the Boolean(...) form). Commit AS-IS with `test(42-08): add failing regression test for ReviewScreen anchor-scoped empty state`.
  </action>
  <verify>
    <automated>cd app && node --test tests/screens/ReviewScreen.anchor-empty-state.test.mjs</automated>
    Expected: test FAILS at this point (no implementation yet). The failure messages should clearly point at: missing `filteredItems !== null`, presence of `Boolean(filteredItems && ...)`, missing i18n keys. This is the RED step — failure here is correct.
  </verify>
  <done>
    File `app/tests/screens/ReviewScreen.anchor-empty-state.test.mjs` exists with 5 `it()` cases under 2 `describe()` blocks. Running the test produces a failure naming the missing pieces. Committed as a `test(42-08): ...` commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Patch ReviewScreen.tsx — fix isFiltered + add anchor-scoped empty-state branch (GREEN)</name>
  <files>app/src/screens/ReviewScreen.tsx</files>
  <behavior>
    After this task:
    - Line ~299 reads `const isFiltered = filteredItems !== null;` (NOT `Boolean(filteredItems && filteredItems.length > 0)`).
    - The done-or-empty branch (~line 519) detects the case `isFiltered && reviewItems.length === 0 && reviewed === 0` (i.e., filter was requested AND yielded zero matches AND user has not reviewed anything yet — to avoid clobbering the post-completion celebration view) and renders an anchor-scoped empty state using `t('review.done.anchorEmptyHeading')` + `t('review.done.anchorEmptyBody', { title: <title> })`.
    - The `<title>` value used is `anchorReview?.title ?? clusterReview?.title ?? 'this concept'` (English literal fallback acceptable here — the i18n bundle's `anchorEmptyBody` interpolation handles the localized framing; the literal is only a defensive null-coalesce that should never trigger because by definition `isFiltered === true` means at least one of anchor/cluster/move filter was set).
    - The existing "All Done" / "noneDue" finished-message path remains intact for the no-filter case AND for the post-completion case (`reviewed > 0`).
    - No other behavior changes — `reviewItems`, `total`, `progress`, `currentItem`, the active-review-session JSX, etc., all stay byte-identical.
  </behavior>
  <action>
    Open `app/src/screens/ReviewScreen.tsx`. Apply TWO surgical edits.

    **Edit 1 — line 299** (the bug site):

    Find:
    ```typescript
      const isFiltered = Boolean(filteredItems && filteredItems.length > 0);
    ```

    Replace with:
    ```typescript
      // Phase 42 Gap 2 / UAT-4 fix: distinguish "no filter requested" (filteredItems === null)
      // from "filter requested but zero matches" (filteredItems.length === 0). Previously this
      // was Boolean(filteredItems && filteredItems.length > 0), which collapsed the zero-match
      // case to "no filter" and dumped the user into today's full SM-2 due queue. The Heal CTA
      // on VineBloomCard surfaced this because heal-from-celebration commonly targets anchors
      // whose QAs have no LLM-extracted flashcards (no chat sessions referencing them).
      // See .planning/debug/heal-review-shows-mock-cards.md.
      const isFiltered = filteredItems !== null;
    ```

    **Edit 2 — done-or-empty branch (~line 519)**:

    Find the existing block:
    ```typescript
      // ── All Done ────────────────────────────────────────────────────────────────
      if (done || reviewItems.length === 0) {
        const avgRating = reviewed > 0 ? (totalRatings / reviewed).toFixed(1) : '—';
        const finishedMessage = reviewed > 0
          ? (reviewed === 1 ? t('review.done.finishedOne', { count: reviewed }) : t('review.done.finishedOther', { count: reviewed }))
          : t('review.done.noneDue');
        return (
          <div ...>
    ```

    Insert a NEW guarded branch IMMEDIATELY BEFORE the existing `if (done || reviewItems.length === 0)` block, like so:

    ```typescript
      // ── Filter requested but zero matches ───────────────────────────────────────
      // Phase 42 Gap 2 / UAT-4 — anchor-scoped empty state.
      // When VineBloomCard's Heal CTA (or any other anchor/cluster/move filter
      // caller) navigates to /review and the requested filter yields zero
      // flashcards, render an explicit anchor-scoped empty state. This avoids the
      // pre-fix fail-open behavior where the user landed on today's full SM-2
      // queue and saw cards from unrelated anchors. Only fire when the user has
      // not reviewed anything yet (reviewed === 0) — once they've completed at
      // least one card, the standard "All Done" celebration view takes over.
      if (isFiltered && reviewItems.length === 0 && reviewed === 0) {
        const filterTitle = anchorReview?.title ?? clusterReview?.title ?? 'this concept';
        return (
          <div style={{ paddingTop: '24px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(24px + var(--safe-area-bottom))', maxWidth: '448px', margin: '0 auto' }}>
            <button
              onClick={() => navigate(-1)}
              style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', marginBottom: '24px' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                backgroundColor: 'var(--card)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-2)',
                marginBottom: '16px',
              }}
            >
              <p style={{ fontSize: '3rem', marginBottom: '16px' }}>🌱</p>
              <h2 style={{ marginBottom: '8px' }}>{t('review.done.anchorEmptyHeading')}</h2>
              <p style={{ color: 'var(--muted-foreground)', marginBottom: '24px' }}>
                {t('review.done.anchorEmptyBody', { title: filterTitle })}
              </p>
            </div>
            {allCards.length > 0 && (
              <button
                onClick={() => setShowLibrary(true)}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: 'var(--primary-40)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <BookOpen size={18} />
                {t('review.done.allFlashcardsCta')}
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {allCards.length}
                </span>
              </button>
            )}
          </div>
        );
      }

      // ── All Done ────────────────────────────────────────────────────────────────
      if (done || reviewItems.length === 0) {
        // ... existing block UNCHANGED
    ```

    Important details:
    - The new branch must come BEFORE the existing `if (done || reviewItems.length === 0)` because the existing branch's predicate ALSO covers `reviewItems.length === 0` and would otherwise capture the empty-filtered case first.
    - The `🌱` emoji (sprout) intentionally differs from the existing `🎉` (party-popper) so the empty state visually reads as "nothing here yet, plant something" rather than "you finished".
    - `filterTitle`'s `'this concept'` literal is a defensive null-coalesce. In practice, `isFiltered === true` ⇒ at least one of anchor/cluster/move filter is non-null. The anchor and cluster filters carry a `title`. The moveFilteredItems path (linkedResource) does NOT carry a title; if a future moveReview path ever yields zero matches with no title, the literal renders. Acceptable defensive default; do NOT add a new i18n key for it.
    - DO NOT touch any other line in the file. Verify by running `git diff --stat app/src/screens/ReviewScreen.tsx` after the edit — should show ~70 lines added (the new branch) + 1 line modified (line 299) + a comment block on line 299.

    After editing, the source-reading test from Task 1 should now pass on tests 1-4. Tests 5+ (locale-bundle JSON) will still fail until Task 3.

    Commit with `fix(42-08): use filteredItems !== null + anchor-scoped empty state in ReviewScreen`.
  </action>
  <verify>
    <automated>cd app && node --test tests/screens/ReviewScreen.anchor-empty-state.test.mjs 2>&1 | grep -E "(pass|fail|ok|not ok)" | head -20</automated>
    Expected: tests under the first `describe('ReviewScreen anchor-scoped empty state ...')` block all PASS (4 tests). Tests under the second `describe('Locale bundles ...')` block STILL FAIL (4 tests — i18n keys not yet added). Also run `cd app && tsc -b --noEmit` and confirm the file compiles cleanly (no TS errors in ReviewScreen.tsx).
  </verify>
  <done>
    `app/src/screens/ReviewScreen.tsx` line 299 reads `const isFiltered = filteredItems !== null;` (with the explanatory comment block above). A new branch sits BEFORE the existing `if (done || reviewItems.length === 0)` rendering the anchor-scoped empty state when `isFiltered && reviewItems.length === 0 && reviewed === 0`. tsc passes. The 4 source-reading tests in the first describe block pass. Committed as `fix(42-08): ...`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add review.done.anchorEmptyHeading + anchorEmptyBody to all 4 locale bundles (GREEN — i18n)</name>
  <files>app/src/locales/en.json, app/src/locales/zh.json, app/src/locales/es.json, app/src/locales/ja.json</files>
  <behavior>
    After this task:
    - `en.json` `review.done` object has 2 NEW keys appended: `anchorEmptyHeading` and `anchorEmptyBody` (with `{{title}}` interpolation).
    - `zh.json`, `es.json`, `ja.json` each have the same 2 keys with locale-appropriate translations preserving the `{{title}}` placeholder verbatim.
    - All other keys in all 4 bundles are byte-identical to before this task (no reordering, no whitespace shifts elsewhere).
    - `bundle-parity.test.mjs` continues to pass (key sets match across all 4 locales).
    - The 4 i18n parity tests in `ReviewScreen.anchor-empty-state.test.mjs` (the second describe block) all pass.
  </behavior>
  <action>
    **Step 1 — en.json (canonical, hand-authored):**

    Open `app/src/locales/en.json`. Locate the `review.done` object (line 207-215). Append 2 keys AFTER `allFlashcardsCta` and BEFORE the closing `}`:

    Final shape:
    ```json
    "done": {
      "heading": "All Done!",
      "finishedOne": "Great work! You reviewed {{count}} card today.",
      "finishedOther": "Great work! You reviewed {{count}} cards today.",
      "noneDue": "No cards due today — come back tomorrow!",
      "reviewed": "Reviewed",
      "avgRating": "Avg rating",
      "allFlashcardsCta": "All Flashcards",
      "anchorEmptyHeading": "No flashcards yet",
      "anchorEmptyBody": "No flashcards yet for {{title}} — start a chat about it to generate cards."
    },
    ```

    **Step 2 — zh.json, es.json, ja.json (translations):**

    Per CLAUDE.md i18n rule: any new user-visible string MUST land in all 4 bundles in the SAME PR. Use the Sonnet subagent prompt at `app/scripts/translate-locales.md` if available (Task tool with `subagent_type: 'general-purpose'`). For this 2-key delta the translations are short enough to author directly with care — both options are acceptable. The required outputs:

    `zh.json` `review.done` adds:
    ```json
      "anchorEmptyHeading": "暂无闪卡",
      "anchorEmptyBody": "{{title}} 暂无闪卡 — 与它聊一聊以生成卡片。"
    ```

    `es.json` `review.done` adds:
    ```json
      "anchorEmptyHeading": "Aún no hay fichas",
      "anchorEmptyBody": "Aún no hay fichas para {{title}} — empieza una conversación sobre este concepto para generar fichas."
    ```

    `ja.json` `review.done` adds:
    ```json
      "anchorEmptyHeading": "フラッシュカードはまだありません",
      "anchorEmptyBody": "{{title}} のフラッシュカードはまだありません — チャットを始めてカードを生成しましょう。"
    ```

    Translation rules (verbatim from CLAUDE.md i18n workflow):
    - Preserve `{{title}}` placeholder verbatim in every locale.
    - Do NOT translate proper nouns (none in this delta).
    - Spanish runs ~20% longer — the body above is acceptable; do NOT pad further.
    - Japanese can be shorter — do NOT pad for symmetry.
    - Tone: empathetic but action-oriented (matches the encouraging Review namespace voice).

    **Step 3 — JSON validity check:**

    After all 4 edits, parse each file with `node -e "JSON.parse(require('fs').readFileSync('app/src/locales/<code>.json', 'utf-8'))"` to confirm valid JSON. Trailing commas WILL break the bundle.

    Commit with `i18n(42-08): add review.done.anchorEmpty* across 4 locales for ReviewScreen empty state`.
  </action>
  <verify>
    <automated>cd app && node --test tests/screens/ReviewScreen.anchor-empty-state.test.mjs tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs</automated>
    Expected:
    - All 4 tests in the first describe block of `ReviewScreen.anchor-empty-state.test.mjs` pass (Task 2's GREEN).
    - All 4 tests in the second describe block (locale bundle parity for the new keys) pass.
    - `bundle-parity.test.mjs` passes (all 4 bundles have identical key sets).
    - `missing-key.test.mjs` passes (no orphaned references).
  </verify>
  <done>
    All 4 locale bundles have `review.done.anchorEmptyHeading` and `review.done.anchorEmptyBody` (with `{{title}}` interpolation in the body). All 8 tests in `ReviewScreen.anchor-empty-state.test.mjs` pass. `bundle-parity.test.mjs` and `missing-key.test.mjs` pass. Committed as `i18n(42-08): ...`.
  </done>
</task>

</tasks>

<verification>
1. **Targeted test passes:** `cd app && node --test tests/screens/ReviewScreen.anchor-empty-state.test.mjs` — all 8 tests pass.
2. **i18n parity preserved:** `cd app && node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` — both pass; key sets identical across en/zh/es/ja.
3. **TypeScript clean:** `cd app && tsc -b --noEmit` exits 0. No new errors in ReviewScreen.tsx (the file compiled cleanly before the patch and must continue to compile cleanly after).
4. **Full test baseline holds:** `cd app && npm test` shows the same baseline (~680 passing, 2 known pre-existing failures unchanged: `concept-feed.test.mjs` ERR_MODULE_NOT_FOUND + `trellis-layout.test.mjs:64` date-dependent assertion). The new `ReviewScreen.anchor-empty-state.test.mjs` adds 8 passing tests on top.
5. **Manual smoke (operator UAT — performed at /gsd:verify-phase --uat-gap step, not in this plan):** Tap Heal on a VineBloomCard for an anchor known to have zero extracted flashcards → /review renders the anchor-scoped empty state with the anchor's title interpolated, not today's queue. Tap Heal on an anchor with extracted flashcards → /review renders the filtered queue normally. Navigate directly to /review without nav state → today's SM-2 queue renders as before.
</verification>

<success_criteria>
1. `ReviewScreen.tsx:299` (post-edit) uses `filteredItems !== null` shape; the fail-open `Boolean(...)` form is gone.
2. A new conditional branch in `ReviewScreen.tsx` (before line ~519) renders an anchor-scoped empty state with the anchor title interpolated when the filter yields zero matches and the user has not reviewed anything yet.
3. All 4 locale bundles carry `review.done.anchorEmptyHeading` and `review.done.anchorEmptyBody` (with `{{title}}` interpolation); `bundle-parity.test.mjs` and `missing-key.test.mjs` pass.
4. `app/tests/screens/ReviewScreen.anchor-empty-state.test.mjs` exists with 5 source-reading + 3 i18n parity tests (8 total `it()` cases under 2 describe blocks); all pass.
5. `tsc -b --noEmit` exits 0; `npm test` baseline equals or improves vs. pre-patch (no regressions; +8 new passing tests).
6. Three atomic commits land in order: `test(42-08): ...` (RED), `fix(42-08): ...` (GREEN — code), `i18n(42-08): ...` (GREEN — locales).
</success_criteria>

<output>
After completion, create `.planning/phases/42-masonry-feed-layout/42-08-heal-review-empty-anchor-fix-SUMMARY.md` recording:
- The 3 commit SHAs (RED + 2 GREEN)
- Test counter delta (+8 passing tests)
- Confirmation that scope discipline was honored (no touch to VineBloomCard / MasonryFeed / trellis-actions / flashcard-service / PlannerScreen)
- Any deviations from the planned literal copy (e.g., Sonnet subagent's exact translations if they differ from the inline drafts in Task 3)
- The known follow-up: "Optional out-of-scope — seed flashcards from QA records on heal() so celebration UX always has reviewable cards. Plan-gated future work; NOT closed by 42-08."
</output>
