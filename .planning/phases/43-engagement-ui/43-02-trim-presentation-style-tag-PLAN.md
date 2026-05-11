---
phase: 43-engagement-ui
plan: 02
type: execute
wave: 1
depends_on: [43-01]
files_modified:
  - app/src/components/InfoFlow.tsx
  - app/src/locales/en.json
  - app/src/locales/zh.json
  - app/src/locales/es.json
  - app/src/locales/ja.json
  - app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs
autonomous: true
requirements: [ENGAGE-01]
must_haves:
  truths:
    - "The 'NEWS' presentation-style chip is removed from news tile cards"
    - "Other tile types (image, text-art, video, connection, milestone) are NOT touched — TS-01 scope is bounded to one element"
    - "infoFlow.newsTag locale key is removed from all 4 bundles in the same commit"
    - "bundle-parity.test.mjs exits 0 after key removal"
    - "Source-reading invariant test exits 0 (grep newsTag in InfoFlow.tsx returns 0)"
  artifacts:
    - path: "app/src/components/InfoFlow.tsx"
      provides: "News card without presentation-style tag — bottom-tags flex row now contains only sourceQuestionTitles chip"
    - path: "app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs"
      provides: "Source-reading invariant: newsTag absent from InfoFlow.tsx AND all 4 locale bundles"
  key_links:
    - from: "app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs"
      to: "app/src/components/InfoFlow.tsx"
      via: "negative grep on 'infoFlow.newsTag'"
      pattern: "infoFlow.newsTag"
---

<objective>
Implement TS-01 from CONTEXT.md (folded operator-request 2026-05-11): trim the "NEWS" presentation-style chip from news tile cards. This is the operator's first concrete instance of acting on the "tiles already too rich; should simplify" feedback that also motivated descoping ENGAGE-04 (DS-01 — handled in 43-07).

Scope is **bounded to exactly one rendering element** and its locale key. RESEARCH §10 audited the codebase and confirmed:
- The "NEWS" pill is the ONLY presentation-style tag in the feed
- Image, text-art, video, connection, milestone tiles have NO equivalent tag
- The pill is rendered at InfoFlow.tsx:252-264 inside the news card's "Bottom tags" flex row

What this plan does:
1. Delete the entire `<span style={{...}}>{t('infoFlow.newsTag')}</span>` element (InfoFlow.tsx:252-264). The surrounding flex container at line 251 stays — it still renders `sourceQuestionTitles` chips.
2. Remove `"newsTag": "..."` key from all 4 locale bundles (en/zh/es/ja line 743) in the same commit — bundle-parity.test.mjs is the gate.
3. Fill in the assertions inside the Wave-0 scaffold `tests/components/InfoFlow.no-presentation-style-tag.test.mjs` (created by 43-01 Task 4) — negative grep on `newsTag` in both code + locale bundles.

What this plan does NOT do (out of scope):
- Trim news source attribution (the domain hostname chip at InfoFlow.tsx:205-219) — operator explicitly preserves this.
- Trim news date stamp — preserved.
- Trim video channel byline (`infoFlow.byChannel`) — preserved.
- Audit any other tile type for redundant metadata — operator bounded TS-01 to this single element. Future polish phase can reopen.

Purpose: Folded operator scope addition. Single targeted cut. Parallel-safe with 43-03/04/05/07.
Output: One JSX element deleted, one locale key deleted from 4 bundles, one test assertion filled in. ~12 lines of code + 4 lines per bundle removed.
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
@.planning/phases/43-01-shared-infra-and-locales-SUMMARY.md

# Reference implementations to read first
@app/src/components/InfoFlow.tsx
@app/src/locales/en.json

<interfaces>
Element to remove (verbatim from InfoFlow.tsx lines 252-264):
```jsx
<span style={{
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--news-card-tag-text)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  backgroundColor: 'var(--news-card-tag-bg)',
  padding: '3px 8px',
  borderRadius: '100px',
}}>
  {t('infoFlow.newsTag')}
</span>
```

Locale keys to remove (line 743 in each bundle):
- en.json: "newsTag": "NEWS",
- zh.json: "newsTag": "新闻",
- es.json: "newsTag": "NOTICIAS",
- ja.json: "newsTag": "ニュース",

Surrounding flex row that STAYS (InfoFlow.tsx line 251):
<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
  ...sourceQuestionTitles?.slice(0, 1).map(...) chip stays...
</div>
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete NEWS chip from InfoFlow.tsx + delete newsTag key from 4 locale bundles</name>
  <files>app/src/components/InfoFlow.tsx, app/src/locales/en.json, app/src/locales/zh.json, app/src/locales/es.json, app/src/locales/ja.json</files>
  <read_first>
    - app/src/components/InfoFlow.tsx (read lines 245-285 — verify the exact span boundaries before/after the news chip; surrounding flex container at line 251 and trailing sourceQuestionTitles chip at line 265+ must remain intact)
    - app/src/locales/en.json (read lines 740-748 — locate "newsTag": "NEWS",)
    - app/src/locales/zh.json, es.json, ja.json (verify line 743 parity)
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (Section "Tile simplification (TS-*)" — operator rationale "tiles already too rich" + bounded scope mandate)
    - .planning/phases/43-engagement-ui/43-UI-SPEC.md (Section "10. Tile presentation-style tag removal (TS-01)" lines 532-556 — verbatim deletion spec)
    - .planning/phases/43-engagement-ui/43-RESEARCH.md (Section 10 lines 401-444 — audit confirmation that newsTag is the ONLY presentation-style tag; other tile types untouched)
    - app/tests/locales/bundle-parity.test.mjs (existing infrastructure — verifies after-edit parity)
  </read_first>
  <action>
    Step 1 — Delete the news-tag <span> from app/src/components/InfoFlow.tsx (lines 252-264):

    BEFORE (line 251-265):
    ```jsx
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      <span style={{
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--news-card-tag-text)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: 'var(--news-card-tag-bg)',
        padding: '3px 8px',
        borderRadius: '100px',
      }}>
        {t('infoFlow.newsTag')}
      </span>
      {post.sourceQuestionTitles?.slice(0, 1).map((title, idx) => (
    ```

    AFTER (line 251 + 252+):
    ```jsx
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {post.sourceQuestionTitles?.slice(0, 1).map((title, idx) => (
    ```

    Verify the surrounding `<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>` at line 251 STAYS. The closing `</div>` of that flex container at the bottom of the chip block ALSO stays. The flex gap: '6px' is consumed only when items > 1 — with only the sourceQuestionTitles chip remaining, no visual gap regression.

    Step 2 — Remove "newsTag" key from all 4 locale bundles. In each of en/zh/es/ja.json (line 743 area):

    Delete the line:
    - en.json: `"newsTag": "NEWS",`
    - zh.json: `"newsTag": "新闻",`
    - es.json: `"newsTag": "NOTICIAS",`
    - ja.json: `"newsTag": "ニュース",`

    Be careful to also delete the trailing comma if the line being removed is in the middle of the object, OR add a trailing comma to the new "last" key if the previous adjacent line lacked one. Use the existing infoFlow namespace structure as guide (en.json lines 742-762).

    Step 3 — Update app/src/locales/i18n.d.ts if it explicitly typed `newsTag` (likely yes per CLAUDE.md i18n type augmentation). Remove the `newsTag` field from the typed infoFlow interface so `tsc -b --noEmit` won't allow t('infoFlow.newsTag') anywhere in the codebase post-removal.

    Atomic commit message: refactor(43): remove NEWS presentation-style chip from news tiles (TS-01)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && [ "$(grep -c 'infoFlow.newsTag' src/components/InfoFlow.tsx)" = "0" ] && for f in en zh es ja; do [ "$(grep -c '"newsTag"' "src/locales/$f.json")" = "0" ] || exit 1; done && node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "infoFlow.newsTag" app/src/components/InfoFlow.tsx returns 0
    - grep -c "newsTag" app/src/components/InfoFlow.tsx returns 0
    - grep -c "\"newsTag\"" app/src/locales/en.json returns 0
    - grep -c "\"newsTag\"" app/src/locales/zh.json returns 0
    - grep -c "\"newsTag\"" app/src/locales/es.json returns 0
    - grep -c "\"newsTag\"" app/src/locales/ja.json returns 0
    - The surrounding flex container at InfoFlow.tsx line 251 (or its new line number) still exists — grep "display: 'flex', flexWrap: 'wrap', gap: '6px'" returns at least 1
    - The sourceQuestionTitles chip code path still exists — grep "sourceQuestionTitles?.slice" returns at least 1
    - cd app && node --test tests/locales/bundle-parity.test.mjs exits 0
    - cd app && node --test tests/locales/missing-key.test.mjs exits 0
    - cd app && npx tsc -b --noEmit exits 0
  </acceptance_criteria>
  <done>NEWS chip gone from rendered news tiles; locale key removed everywhere; bundle parity green; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fill in assertions in InfoFlow.no-presentation-style-tag.test.mjs scaffold</name>
  <files>app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs</files>
  <read_first>
    - app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs (the Wave-0 scaffold created by 43-01 Task 4 — read TODOs at top)
    - app/tests/components/InfoFlow.video-tap-emit.test.mjs (canonical source-reading invariant test pattern; readFileSync + assert.strictEqual on grep-style count)
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (line 56 — expected assertions for this test surface)
  </read_first>
  <behavior>
    - Test asserts: file InfoFlow.tsx contains 0 occurrences of "infoFlow.newsTag"
    - Test asserts: file InfoFlow.tsx contains 0 occurrences of "newsTag"
    - Test asserts: each of 4 locale bundles contains 0 occurrences of "newsTag"
    - Test asserts: file InfoFlow.tsx STILL contains the surrounding flex container ("display: 'flex'" with flexWrap+gap nearby) — proves we didn't accidentally delete the wrapper
    - Test asserts: file InfoFlow.tsx STILL contains the sourceQuestionTitles chip rendering — proves we didn't delete adjacent content
    - All assertions pass (test exits 0)
  </behavior>
  <action>
    Replace the skip-style scaffold inside app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs with a real source-reading test. Use the InfoFlow.video-tap-emit.test.mjs pattern verbatim:

    ```javascript
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');

    function readSource(rel) {
      return readFileSync(path.join(appRoot, rel), 'utf8');
    }

    test('TS-01: infoFlow.newsTag is removed from InfoFlow.tsx', () => {
      const src = readSource('src/components/InfoFlow.tsx');
      const newsTagRefs = (src.match(/infoFlow\.newsTag/g) || []).length;
      assert.strictEqual(newsTagRefs, 0, 'InfoFlow.tsx must not reference infoFlow.newsTag (TS-01 — operator-bounded simplification)');

      const bareNewsTagRefs = (src.match(/\bnewsTag\b/g) || []).length;
      assert.strictEqual(bareNewsTagRefs, 0, 'InfoFlow.tsx must not contain the string "newsTag" anywhere');
    });

    test('TS-01: surrounding "Bottom tags" flex container preserved', () => {
      const src = readSource('src/components/InfoFlow.tsx');
      // The flex container that previously held the news chip + sourceQuestionTitles chip
      // must STILL exist. Without this, we deleted too much.
      assert.match(
        src,
        /display:\s*['"]flex['"][^}]*flexWrap:\s*['"]wrap['"]/,
        'Flex container that held the news-tag (and still holds sourceQuestionTitles chip) must survive TS-01',
      );
    });

    test('TS-01: sourceQuestionTitles chip rendering preserved', () => {
      const src = readSource('src/components/InfoFlow.tsx');
      assert.match(
        src,
        /sourceQuestionTitles\?\.slice/,
        'sourceQuestionTitles chip code path must remain (TS-01 only removes the NEWS pill, not adjacent chips)',
      );
    });

    test('TS-01: newsTag key removed from all 4 locale bundles', () => {
      for (const locale of ['en', 'zh', 'es', 'ja']) {
        const src = readSource(`src/locales/${locale}.json`);
        const refs = (src.match(/"newsTag"/g) || []).length;
        assert.strictEqual(refs, 0, `${locale}.json must not contain "newsTag" key (TS-01)`);
      }
    });
    ```

    Atomic commit message: test(43): fill TS-01 source-reading assertions into InfoFlow.no-presentation-style-tag.test.mjs
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/components/InfoFlow.no-presentation-style-tag.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - The test file no longer uses `{ skip: ... }` — all 4 test() blocks run real assertions
    - cd app && node --test tests/components/InfoFlow.no-presentation-style-tag.test.mjs exits 0
    - Test count is at least 4 (TS-01 in code; flex container preserved; sourceQuestionTitles preserved; key removed from 4 bundles)
    - File line count is at least 30
  </acceptance_criteria>
  <done>TS-01 source-reading invariant locked in tests; any future regression that re-adds the NEWS chip OR the locale key fails this test.</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0 (no orphan i18n.d.ts typings, no orphan t() calls)
- cd app && node --test tests/components/InfoFlow.no-presentation-style-tag.test.mjs exits 0
- cd app && node --test tests/locales/bundle-parity.test.mjs exits 0
- cd app && node --test tests/locales/missing-key.test.mjs exits 0
- cd app && node --test tests/components/InfoFlow.video-tap-emit.test.mjs exits 0 (unrelated existing test; confirms no collateral damage)
</verification>

<success_criteria>
- NEWS pill removed from news tile bottom-tags flex row
- newsTag key removed from all 4 locale bundles in one commit
- Surrounding flex container + sourceQuestionTitles chip preserved
- TS-01 source-reading invariant test locks the absence in code + locales
- Other tile types (image, text-art, video, connection, milestone) UNCHANGED — TS-01 bounded scope honored
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-02-SUMMARY.md documenting:
- Confirmation of which lines were removed from InfoFlow.tsx (line numbers before/after)
- Confirmation that 4 bundles all dropped the newsTag key
- Confirmation that i18n.d.ts dropped any newsTag typing
- 2 atomic commit hashes (one for code+bundles, one for test assertion fill-in)
- Bundle-parity test pass screenshot/output
- Negative grep result: 0 hits for "newsTag" across InfoFlow.tsx and all 4 locale JSONs
</output>
