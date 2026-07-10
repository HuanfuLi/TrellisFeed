---
phase: 41-pipeline-wiring-essay-depth
plan: 02
type: execute
wave: 2
depends_on: ["01"]
files_modified:
  - app/src/types/index.ts
  - app/src/services/post-essay.service.ts
  - app/src/services/concept-feed.service.ts
  - app/src/screens/PostDetailScreen.tsx
  - app/src/components/Markdown.tsx
  - app/tests/services/post-essay-depth.test.mjs
  - app/tests/screens/PostDetailScreen-abort-threading.test.mjs
  - app/tests/components/Markdown-citation-overrides.test.mjs
autonomous: true
requirements: [CONTENT-01, CONTENT-03, CONTENT-04]
must_haves:
  truths:
    - "EssayContent and PostSnapshot interfaces both have bodyMarkdownDeep?: string field (back-compat additive per RESEARCH Pitfall 9)"
    - "EssayOptions interface has depth?: 'standard' | 'deep' field"
    - "All 4 essay generators (generateStandardEssay, generateVideoEssay, generateNewsEssay, generateTextArtEssay) read options?.depth and switch their system prompt's word-count instruction"
    - "Standard depth (default) preserves existing word-count bands (200-350w / 200-400w / 150-250w / 80-120w per generator)"
    - "Deep depth uses 350-600w instruction string"
    - "generateNewsEssay system prompt contains the footnote instruction string with [^1] / [^2] / [^3] markers and footnote section emission"
    - "generateNewsEssay consumes sources.slice(0, 3) for multi-snippet grounding (was sources only)"
    - "generateEssayMeta body slice cap raised from 2000 to 4000 chars"
    - "generateConnectionPost and generateDiscoverPost in concept-feed.service.ts accept trailing options?: { signal?: AbortSignal } and propagate to chatStream's signal field"
    - "All 3 async branches in PostDetailScreen.tsx essay useEffect have if (abortController.signal.aborted) return BEFORE the for await call"
    - "All 3 async branches pass { signal: abortController.signal } to the generator (connection / discover / generatePostEssay)"
    - "patchPostEssayInCache handles bodyMarkdownDeep merge correctly (only updates the field passed; existing standard bodyMarkdown preserved when only deep is patched)"
    - "Markdown.tsx has components={{ sup: ..., a: ..., section: ... }} prop on ReactMarkdown"
    - "Markdown.tsx sanitize schema attributes.sup spreads defaultSchema.attributes?.['sup'] (RESEARCH Pitfall 4 regression guard)"
  artifacts:
    - path: "app/src/types/index.ts"
      provides: "EssayContent and PostSnapshot extended with bodyMarkdownDeep?: string"
      contains: "bodyMarkdownDeep?: string"
    - path: "app/src/services/post-essay.service.ts"
      provides: "EssayOptions.depth + 4 depth-aware generators + multi-snippet news grounding + footnote prompt + 4000-char meta cap + patchPostEssayInCache merge"
      contains: "depth?: 'standard' | 'deep'"
    - path: "app/src/services/concept-feed.service.ts"
      provides: "generateConnectionPost + generateDiscoverPost extended with options?: { signal?: AbortSignal }"
      contains: "options?: { signal?: AbortSignal }"
    - path: "app/src/screens/PostDetailScreen.tsx"
      provides: "All 3 async essay branches thread signal AND have pre-call abort guard"
      contains: "if (abortController.signal.aborted) return"
    - path: "app/src/components/Markdown.tsx"
      provides: "ReactMarkdown components prop with sup/a/section overrides + sanitize sup spread fix"
      contains: "components={{"
    - path: "app/tests/services/post-essay-depth.test.mjs"
      provides: "SC-3 + SC-4 + SC-5(a) + SC-6 source-reading + behavioral assertions"
    - path: "app/tests/screens/PostDetailScreen-abort-threading.test.mjs"
      provides: "SC-7(a) + SC-7(b) + SC-7(c) source-reading assertions"
    - path: "app/tests/components/Markdown-citation-overrides.test.mjs"
      provides: "SC-5(b) + SC-5(c) source-reading assertions"
  key_links:
    - from: "app/src/services/post-essay.service.ts:generateNewsEssay"
      to: "post.newsMeta.sources.slice(0, 3) + footnote prompt instruction"
      via: "string concatenation in system message content"
      pattern: "sources\\.slice\\(0, 3\\)"
    - from: "app/src/services/post-essay.service.ts:generateEssayMeta"
      to: "bodyMarkdown.slice(0, 4000) — raised from 2000"
      via: "user content slice"
      pattern: "bodyMarkdown\\.slice\\(0, 4000\\)"
    - from: "app/src/screens/PostDetailScreen.tsx:essay useEffect"
      to: "generateConnectionPost / generateDiscoverPost / generatePostEssay all receive { signal: abortController.signal }"
      via: "trailing options bag"
      pattern: "\\{ signal: abortController\\.signal \\}"
    - from: "app/src/components/Markdown.tsx:<ReactMarkdown>"
      to: "components={{ sup, a, section }} overrides"
      via: "JSX prop"
      pattern: "components=\\{"
    - from: "app/src/components/Markdown.tsx:sanitizeSchema"
      to: "defaultSchema.attributes?.['sup'] spread"
      via: "spread in attributes.sup array"
      pattern: "defaultSchema\\.attributes\\?\\.\\['sup'\\]"
---

<objective>
Lengthen the essay path with a `depth: 'standard' | 'deep'` knob across all 4 essay generators (standard / video / news / text-art); widen news grounding to `sources.slice(0, 3)` with footnote-aware prompt; raise `generateEssayMeta` body slice cap from 2000 to 4000; audit `PostDetailScreen.tsx`'s essay `useEffect` so all 3 async branches both pass `{ signal: abortController.signal }` AND have a pre-call `if (signal.aborted) return` guard; extend `generateConnectionPost` + `generateDiscoverPost` with a trailing options bag that threads signal to `chatStream`; add `bodyMarkdownDeep?: string` field to BOTH `EssayContent` AND `PostSnapshot` (back-compat additive per Pitfall 9); add ReactMarkdown `components={{ sup, a, section }}` overrides to `Markdown.tsx` with a sanitize-schema spread fix on `<sup>` attributes.

Purpose: Closes CONTENT-01 (deep dive API), CONTENT-03 (multi-snippet grounding), CONTENT-04 (citation rendering) — Phase 41's essay-depth + UI-rendering deliverable. Phase 43 owns the user-facing "Deep dive" button that calls this API; Plan 41-02 ships only the API + types + tests + rendering.

Output: 5 source files modified + 3 new test files. ~6-7 atomic commits. Sequenced after Plan 41-01 in Wave 2 because both plans touch `concept-feed.service.ts` (Plan 41-01 owns news creation loops + loadCache; Plan 41-02 Task 4 owns generateConnectionPost/generateDiscoverPost signal threading at ~lines 1785/1914). Logical scopes are disjoint; execution order avoids parallel-write file corruption.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md
@.planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md
@.planning/phases/41-pipeline-wiring-essay-depth/41-VALIDATION.md
@CLAUDE.md

# Source files that this plan modifies (executor MUST read before editing)
@app/src/types/index.ts
@app/src/services/post-essay.service.ts
@app/src/services/concept-feed.service.ts
@app/src/screens/PostDetailScreen.tsx
@app/src/components/Markdown.tsx

<interfaces>
<!-- Key contracts the executor needs. Extracted from live source. -->
<!-- Use these directly — no codebase exploration needed. -->

From app/src/services/post-essay.service.ts CURRENT shape (Plan 41-02 EXTENDS this):
```typescript
export interface EssayOptions {
  signal?: AbortSignal;
  // Plan 41-02 ADDS: depth?: 'standard' | 'deep';
}

export interface EssayContent {
  bodyMarkdown: string;
  whyCare: string;
  takeaway: string;
  quickAskPrompts: string[];
  // Plan 41-02 ADDS: bodyMarkdownDeep?: string;
}

// Generator dispatch (post-essay.service.ts:27-37):
export async function* generatePostEssay(post, questions, options?: EssayOptions): AsyncGenerator<string>
async function* generateStandardEssay(post, questions, options?): AsyncGenerator<string>  // 200-350w default
async function* generateVideoEssay(post, options?): AsyncGenerator<string>                 // 200-400w default
async function* generateNewsEssay(post, options?): AsyncGenerator<string>                  // 150-250w default
async function* generateTextArtEssay(post, questions, options?): AsyncGenerator<string>    // 80-120w default

export async function generateEssayMeta(post, bodyMarkdown, options?): Promise<...>
// CURRENT: content: `Title: ${post.title}\nHook: ${post.teaser.hook}\n\nEssay:\n${bodyMarkdown.slice(0, 2000)}`
// Plan 41-02 raises 2000 → 4000.

export function patchPostEssayInCache(postId: string, essay: EssayContent): void
// CURRENT: posts[idx] = { ...posts[idx], ...essay }
// Spread already preserves existing bodyMarkdown when essay omits it (Pitfall 9 — already correct
// as long as caller passes { bodyMarkdownDeep } when only deep is generated, NOT a partial that
// includes empty bodyMarkdown). Plan 41-02 confirms by adding test coverage.
```

From app/src/types/index.ts CURRENT shape (Plan 41-02 EXTENDS this):
```typescript
export interface PostSnapshot {
  id: string;
  date: string;
  title: string;
  teaser: FeedTeaser;
  bodyMarkdown: string;
  whyCare: string;
  takeaway: string;
  quickAskPrompts: string[];
  // ... other fields ...
  // Plan 41-02 ADDS: bodyMarkdownDeep?: string;
}

export interface DailyPost extends PostSnapshot {
  generatedAt: number;
  origin: 'ai';
  videoMeta?: VideoMetadata;
  textArtContent?: string;
  presentationStyle?: PresentationStyle;
  newsMeta?: { sources: SourceCitation[]; fetchedAt: number; imageUrl?: string; };
}
```

From app/src/services/concept-feed.service.ts CURRENT shape (Plan 41-02 EXTENDS):
```typescript
async *generateConnectionPost(
  questionA: Question,
  questionB: Question,
  conceptNounA: string,
  conceptNounB: string,
  // Plan 41-02 ADDS: options?: { signal?: AbortSignal },
): AsyncGenerator<string> { ... yield* chatStream(..., { serviceName: 'posts' }); }

async *generateDiscoverPost(
  concept: string,
  title: string,
  // Plan 41-02 ADDS: options?: { signal?: AbortSignal },
): AsyncGenerator<string> { ... yield* chatStream(..., { serviceName: 'posts' }); }
```

From app/src/screens/PostDetailScreen.tsx CURRENT essay useEffect shape (lines 282-390):
```typescript
useEffect(() => {
  if (!post) return;
  if (post.bodyMarkdown && post.bodyMarkdown.trim() !== '') return;
  const abortController = new AbortController();
  const unsubLocale = eventBus.subscribe('LOCALE_CHANGED', () => {
    abortController.abort(new DOMException('Locale changed', 'AbortError'));
  });
  // ... setup ...
  void (async () => {
    let accumulated = '';
    try {
      const connectionMeta = connectionMetaRef.current;
      const discoverMeta = discoverMetaRef.current;

      // BRANCH 1 — connection (currently MISSING pre-guard AND signal arg)
      if (post.sourceType === 'connection' && connectionMeta) {
        for await (const chunk of conceptFeedService.generateConnectionPost(
          connectionMeta.questionA, connectionMeta.questionB,
          connectionMeta.conceptNounA, connectionMeta.conceptNounB,
        )) {
          if (abortController.signal.aborted) return;
          accumulated += chunk;
          setStreamingBody(accumulated);
        }
      } else if (discoverMeta && post.id.includes('-post-')) {
        // BRANCH 2 — discover (currently MISSING pre-guard AND signal arg)
        for await (const chunk of conceptFeedService.generateDiscoverPost(
          discoverMeta.concept, discoverMeta.title,
        )) {
          if (abortController.signal.aborted) return;
          // ...
        }
      } else {
        // BRANCH 3 — generatePostEssay (currently has signal arg, MISSING pre-guard)
        for await (const chunk of generatePostEssay(post, questionsRef.current, { signal: abortController.signal })) {
          if (abortController.signal.aborted) return;
          // ...
        }
      }
      // ...
    } catch (err) { /* ... */ }
    finally { /* ... */ }
  })();
  return () => { abortController.abort(); };
}, [post?.id, post?.bodyMarkdown]);
```

From app/src/components/Markdown.tsx CURRENT shape (Plan 41-02 EXTENDS):
```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'sup'],
  attributes: {
    ...defaultSchema.attributes,
    sup: ['dataCite', 'style'],  // Plan 41-02 FIXES — spread defaultSchema sup attrs (Pitfall 4)
    span: [...(defaultSchema.attributes?.['span'] ?? []), 'className', 'style'],
    div: [...(defaultSchema.attributes?.['div'] ?? []), 'className', 'style'],
  },
};

export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="md-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
        // Plan 41-02 ADDS: components={{ sup, a, section }}
      >
        {normalizeMarkdownText(children)}
      </ReactMarkdown>
    </div>
  );
}
```

remark-gfm v4 footnote output shape (Plan 41-02 component overrides target this):
```html
<sup><a href="#user-content-fn-1" id="user-content-fnref-1"
        data-footnote-ref aria-describedby="footnote-label">1</a></sup>
<section data-footnotes class="footnotes">
  <h2 class="sr-only" id="footnote-label">Footnotes</h2>
  <ol>
    <li id="user-content-fn-1">...</li>
  </ol>
</section>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add bodyMarkdownDeep field to EssayContent (post-essay.service.ts) AND PostSnapshot (types/index.ts)</name>
  <files>app/src/types/index.ts, app/src/services/post-essay.service.ts</files>
  <read_first>
    - app/src/types/index.ts lines 481-496 (PostSnapshot interface)
    - app/src/services/post-essay.service.ts lines 11-20 (EssayOptions + EssayContent interfaces)
    - app/src/services/post-essay.service.ts lines 192-213 (patchPostEssayInCache — verify spread shape preserves existing fields)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md § Pitfall 9 (bodyMarkdownDeep on BOTH EssayContent + PostSnapshot)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md § D-03 (parallel cache via additive field)
  </read_first>
  <behavior>
    - Test 1: PostSnapshot interface contains `bodyMarkdownDeep?: string` (source-reading)
    - Test 2: EssayContent interface contains `bodyMarkdownDeep?: string` (source-reading)
    - Test 3: EssayOptions interface contains `depth?: 'standard' | 'deep'` (source-reading)
    - Test 4: tsc compiles cleanly (back-compat additive — old cached posts without the field still satisfy the type)
  </behavior>
  <action>
    1. Edit `app/src/types/index.ts` — find the `PostSnapshot` interface at line 481. Add `bodyMarkdownDeep?: string` as a new optional field. Suggested placement: immediately after `bodyMarkdown: string` (line 486):
       ```typescript
       export interface PostSnapshot {
         id: string;
         date: string;
         title: string;
         teaser: FeedTeaser;
         bodyMarkdown: string;
         /** Phase 41 D-03 — optional 350-600w deep variant. Generated on demand,
          *  lives alongside the standard bodyMarkdown teaser. Back-compat additive:
          *  old cached posts without this field remain valid. */
         bodyMarkdownDeep?: string;
         whyCare: string;
         // ... rest unchanged
       }
       ```
    2. Edit `app/src/services/post-essay.service.ts` — find `EssayOptions` at lines 11-13 and `EssayContent` at lines 15-20. Extend both:
       ```typescript
       export interface EssayOptions {
         signal?: AbortSignal;
         /** Phase 41 D-03 — 'standard' (default, 150-250w teaser) or 'deep' (350-600w expansion). */
         depth?: 'standard' | 'deep';
       }

       export interface EssayContent {
         bodyMarkdown: string;
         /** Phase 41 D-03 — populated when generator was called with depth: 'deep'.
          *  patchPostEssayInCache merges this field-by-field; standard cache stays intact. */
         bodyMarkdownDeep?: string;
         whyCare: string;
         takeaway: string;
         quickAskPrompts: string[];
       }
       ```
    3. Run `cd app && tsc -b --noEmit` — must exit 0.
    4. Commit atomically with `(41-02)` scope. Suggested message: `feat(41-02): add bodyMarkdownDeep field to PostSnapshot + EssayContent; depth knob on EssayOptions`.
  </action>
  <verify>
    <automated>cd app && tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "bodyMarkdownDeep?: string" app/src/types/index.ts` returns 1
    - `grep -c "bodyMarkdownDeep?: string" app/src/services/post-essay.service.ts` returns 1
    - `grep -c "depth?: 'standard' | 'deep'" app/src/services/post-essay.service.ts` returns 1
    - `cd app && tsc -b --noEmit` exits 0
    - Existing fields preserved (regression check): `grep -c "bodyMarkdown: string" app/src/types/index.ts` returns ≥ 1; `grep -c "bodyMarkdown: string" app/src/services/post-essay.service.ts` returns ≥ 1
  </acceptance_criteria>
  <done>EssayOptions has depth knob; EssayContent + PostSnapshot have bodyMarkdownDeep additive field; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Depth-aware prompts in all 4 essay generators + multi-snippet news grounding + footnote prompt</name>
  <files>app/src/services/post-essay.service.ts, app/tests/services/post-essay-depth.test.mjs</files>
  <read_first>
    - app/src/services/post-essay.service.ts (full file — generators at :27, :81, :104, :133, :162; meta at :43)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md § Pattern 4 (depth-conditional generator prompts) AND § Pitfall 5 (word-count test strategy — dual approach: source-reading + behavioral)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md § D-03 (additive bodyMarkdownDeep) AND § D-04 (footnote markdown syntax)
    - CLAUDE.md "Other one-shot LLM call sites" — confirms Phase 35 KV-cache rule does NOT apply, free to interpolate dynamic content
  </read_first>
  <behavior>
    - Test 1 (source-reading): post-essay.service.ts source contains all 4 generator names (generateStandardEssay, generateVideoEssay, generateNewsEssay, generateTextArtEssay)
    - Test 2 (source-reading): each generator's source contains both depth band strings — '350-600' (deep) AND its standard band ('200-350' / '200-400' / '150-250' / '80-120')
    - Test 3 (source-reading): each generator reads `options?.depth` and branches on `'deep'` discriminator
    - Test 4 (source-reading): generateNewsEssay source contains `sources.slice(0, 3)` (multi-snippet grounding)
    - Test 5 (source-reading): generateNewsEssay system prompt contains the footnote instruction string `[^1]` AND `[^2]` AND `[^3]` AND footnote section emission instruction
    - Test 6 (source-reading): generateEssayMeta body slice raised to `bodyMarkdown.slice(0, 4000)` (was 2000) — SC-6
    - Test 7 (behavioral): mock chatStream to capture the constructed messages array; call generatePostEssay with { depth: 'deep' } — assert system content contains '350-600' word-count instruction
    - Test 8 (behavioral): same, with default options — assert system content contains the standard band instruction string
  </behavior>
  <action>
    1. Edit `app/src/services/post-essay.service.ts`. Apply depth-conditional prompts to all 4 generators.

    **generateStandardEssay (~lines 81-101):** add depth branch. Suggested shape:
       ```typescript
       async function* generateStandardEssay(post: DailyPost, questions: Question[], options?: EssayOptions): AsyncGenerator<string> {
         const settings = settingsService.getSync();
         // ... existing context block construction unchanged ...

         const depth = options?.depth ?? 'standard';
         const wordCountInstruction = depth === 'deep'
           ? 'Write a substantial, in-depth essay (350-600 words) in markdown.'
           : 'Write a vivid, engaging essay (200-350 words) in markdown.';

         const systemContent = [
           'You are a world-class educational writer.',
           wordCountInstruction,
           // ... rest of existing system content lines ...
         ].join(' ');

         yield* chatStream(
           [{ role: 'system', content: systemContent }, /* ... */],
           settings.llm,
           { serviceName: 'posts', signal: options?.signal },
         );
       }
       ```
       Preserve the existing system prompt structure — INSERT `wordCountInstruction` as the second line, REMOVE the hardcoded "200-350 words" string from wherever it currently appears in that prompt.

    **generateVideoEssay (~lines 104-131):** same pattern — depth-conditional swap of the "200-400 words" band:
       ```typescript
       const depth = options?.depth ?? 'standard';
       const wordCountInstruction = depth === 'deep'
         ? 'Write a substantial educational summary (350-600 words) in markdown.'
         : 'Write a focused educational summary (200-400 words) in markdown.';
       ```

    **generateNewsEssay (~lines 133-160):** apply depth + multi-snippet + footnote. Replace the entire generator body:
       ```typescript
       async function* generateNewsEssay(post: DailyPost, options?: EssayOptions): AsyncGenerator<string> {
         const settings = settingsService.getSync();
         const sources = post.newsMeta?.sources ?? [];
         // Phase 41 SC-4 — multi-snippet grounding (was: sources.map across all sources;
         // pre-Phase-41 only 1 source existed because Tavily maxResults was 1).
         const sourceText = sources
           .slice(0, 3)
           .map(s => {
             const head = `[${s.index}] ${s.title} — ${s.url}`;
             return s.snippet ? `${head}\n${s.snippet}` : head;
           })
           .join('\n\n');

         const depth = options?.depth ?? 'standard';
         const wordCountInstruction = depth === 'deep'
           ? 'Create a substantial educational news summary (350-600 words)'
           : 'Create a short educational news summary (150-250 words)';

         // Phase 41 D-04 — footnote prompt instruction. remark-gfm parses [^N] markers
         // into <sup>/<section> automatically; Markdown.tsx components prop styles them.
         const systemContent = [
           'You are a learning digest writer.',
           wordCountInstruction + ' from the following web search results.',
           'Write it as a clear, engaging markdown essay.',
           'Cite each factual claim with [^1], [^2], [^3] markers tied to the source list above.',
           'Emit a footnotes section at the end of the essay using `[^1]: <Source title>` for each cited source.',
           'Output the essay text only — no JSON.',
         ].join(' ');

         yield* chatStream(
           [
             { role: 'system', content: systemContent },
             {
               role: 'user',
               content: `Headline: ${post.title}\nSources:\n${sourceText}\n\nConcept context: ${post.keywords.join(', ')}`,
             },
           ],
           settings.llm,
           { serviceName: 'news', signal: options?.signal },
         );
       }
       ```

    **generateTextArtEssay (~lines 162-184):** same depth pattern; replace "80-120 words" band:
       ```typescript
       const depth = options?.depth ?? 'standard';
       const wordCountInstruction = depth === 'deep'
         ? 'Write an in-depth social media thread (350-600 words) about the concept.'
         : 'Write a short, punchy post (80-120 words) about the concept.';
       ```

    2. Edit `generateEssayMeta` (~line 54) — change `bodyMarkdown.slice(0, 2000)` → `bodyMarkdown.slice(0, 4000)` (SC-6). Single-line edit.

    3. CREATE `app/tests/services/post-essay-depth.test.mjs`. Cover SC-3 + SC-4 + SC-5(a) + SC-6 via dual-test strategy (source-reading + behavioral mock). Pseudo-shape:
       ```javascript
       import { test } from 'node:test';
       import assert from 'node:assert/strict';
       import { readFileSync } from 'node:fs';

       const SRC = readFileSync(new URL('../../src/services/post-essay.service.ts', import.meta.url), 'utf8');

       // ─── SC-3 source-reading ────────────────────────────────────────────────────
       test('SC-3: all 4 generators present', () => {
         for (const name of ['generateStandardEssay', 'generateVideoEssay', 'generateNewsEssay', 'generateTextArtEssay']) {
           assert.ok(SRC.includes(name), `generator ${name} must exist`);
         }
       });

       test('SC-3: depth knob branched in each generator', () => {
         // 4 generators × `options?.depth ?? 'standard'` pattern
         const matches = [...SRC.matchAll(/options\?\.depth \?\? 'standard'/g)];
         assert.ok(matches.length >= 4, `expected ≥4 depth branches, got ${matches.length}`);
       });

       test('SC-3: deep band 350-600 referenced in all 4 generators', () => {
         // Count "350-600" occurrences — should appear once per generator
         const matches = [...SRC.matchAll(/350-600/g)];
         assert.ok(matches.length >= 4, `expected ≥4 occurrences of 350-600, got ${matches.length}`);
       });

       test('SC-3: standard bands preserved per generator', () => {
         assert.match(SRC, /200-350/);  // standard
         assert.match(SRC, /200-400/);  // video
         assert.match(SRC, /150-250/);  // news
         assert.match(SRC, /80-120/);   // text-art
       });

       // ─── SC-4 source-reading ────────────────────────────────────────────────────
       test('SC-4: generateNewsEssay consumes sources.slice(0, 3)', () => {
         const newsBlock = SRC.slice(SRC.indexOf('async function* generateNewsEssay'), SRC.indexOf('async function* generateTextArtEssay'));
         assert.match(newsBlock, /sources\.slice\(0, 3\)/);
       });

       // ─── SC-5(a) source-reading ─────────────────────────────────────────────────
       test('SC-5(a): generateNewsEssay system prompt contains footnote instruction', () => {
         const newsBlock = SRC.slice(SRC.indexOf('async function* generateNewsEssay'), SRC.indexOf('async function* generateTextArtEssay'));
         assert.match(newsBlock, /\[\^1\]/);
         assert.match(newsBlock, /\[\^2\]/);
         assert.match(newsBlock, /\[\^3\]/);
         assert.match(newsBlock, /footnotes section/i);
       });

       // ─── SC-6 source-reading ────────────────────────────────────────────────────
       test('SC-6: generateEssayMeta body slice cap raised to 4000', () => {
         assert.match(SRC, /bodyMarkdown\.slice\(0, 4000\)/);
         // Counterweight: old cap 2000 must be gone
         assert.ok(!SRC.includes('bodyMarkdown.slice(0, 2000)'), 'old 2000 cap must be removed');
       });

       // ─── SC-3 behavioral (optional — if mocking infra available) ───────────────
       // Mock chatStream to capture the system message; call generateStandardEssay with
       // { depth: 'deep' } — assert system content contains '350-600'. With default
       // options — assert system content contains '200-350'. If mocking is too heavy,
       // source-reading tests above are sufficient per RESEARCH § Pitfall 5 dual-test guidance.
       ```
       NOTE: behavioral mock is OPTIONAL if it requires too much fixture setup. Source-reading suite above already locks the contract (Pitfall 5 dual-test recommendation). If a neighboring test (e.g., `app/tests/state/useQuestions-system-prompt-stability.test.mjs`) provides a chatStream mock pattern, mirror it. Otherwise, source-reading is the established Phase 39/40 fallback.

    4. Run `node --test app/tests/services/post-essay-depth.test.mjs` — must exit 0.
    5. Run `cd app && tsc -b --noEmit` — must exit 0.
    6. Run `cd app && npm test` — full suite green; pass count ≥ pre-Plan-41-02 baseline + ~7 new assertions.
    7. Commit atomically with `(41-02)` scope. Suggested message: `feat(41-02): depth-aware essay prompts; multi-snippet news grounding; footnote instruction; meta cap 4000`.
  </action>
  <verify>
    <automated>node --test app/tests/services/post-essay-depth.test.mjs && cd app && tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/services/post-essay-depth.test.mjs` exists
    - `grep -c "350-600" app/src/services/post-essay.service.ts` returns ≥ 4 (one per generator)
    - `grep -c "options?.depth ?? 'standard'" app/src/services/post-essay.service.ts` returns ≥ 4
    - `grep -c "sources.slice(0, 3)" app/src/services/post-essay.service.ts` returns ≥ 1
    - `grep -c "\[\^1\]" app/src/services/post-essay.service.ts` returns ≥ 1
    - `grep -c "bodyMarkdown.slice(0, 4000)" app/src/services/post-essay.service.ts` returns 1
    - `! grep -q "bodyMarkdown.slice(0, 2000)" app/src/services/post-essay.service.ts` (old cap removed)
    - Standard bands preserved: `grep -c "200-350" app/src/services/post-essay.service.ts` returns ≥ 1; `grep -c "200-400" app/src/services/post-essay.service.ts` returns ≥ 1; `grep -c "150-250" app/src/services/post-essay.service.ts` returns ≥ 1; `grep -c "80-120" app/src/services/post-essay.service.ts` returns ≥ 1
    - `node --test app/tests/services/post-essay-depth.test.mjs` exits 0
    - `cd app && tsc -b --noEmit` exits 0
    - `cd app && npm test` pass count preserved + new assertions
  </acceptance_criteria>
  <done>All 4 generators depth-aware; news grounding multi-snippet; footnote prompt instruction lands; meta cap raised; SC-3 + SC-4 + SC-5(a) + SC-6 tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Extend patchPostEssayInCache to handle bodyMarkdownDeep merge correctly</name>
  <files>app/src/services/post-essay.service.ts, app/tests/services/post-essay-depth.test.mjs</files>
  <read_first>
    - app/src/services/post-essay.service.ts lines 192-213 (patchPostEssayInCache current shape — `posts[idx] = { ...posts[idx], ...essay }`)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md § Pitfall 9 (bodyMarkdownDeep on EssayContent → patchPostEssayInCache merge)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md § D-03 implementation note (when EssayOptions.depth === 'deep', generators write to bodyMarkdownDeep field; cache merge must NOT clobber existing standard bodyMarkdown)
  </read_first>
  <behavior>
    - Test 1: Calling patchPostEssayInCache with essay = { bodyMarkdownDeep: '<deep text>', bodyMarkdown: '', whyCare: '', takeaway: '', quickAskPrompts: [] } MUST NOT clobber the existing standard bodyMarkdown in cache (only the populated fields update — empty bodyMarkdown does NOT overwrite)
    - Test 2: Calling patchPostEssayInCache with essay = { bodyMarkdown: '<standard>', bodyMarkdownDeep: '<deep>' } updates BOTH fields
    - Test 3: Round-trip: patch standard → patch deep → verify both fields preserved in localStorage
  </behavior>
  <action>
    1. Inspect `patchPostEssayInCache` body at lines 192-213. Current shape is `posts[idx] = { ...posts[idx], ...essay }`. Per RESEARCH Pitfall 9, this CORRECTLY preserves existing fields IF the caller omits empty fields from `essay`. However, `EssayContent` requires `bodyMarkdown: string` — so any caller with only deep generated would have to pass `bodyMarkdown: ''`, which WOULD overwrite.

       Fix by guarding the merge to skip empty-string-or-undefined `bodyMarkdown` and `bodyMarkdownDeep`:
       ```typescript
       export function patchPostEssayInCache(postId: string, essay: EssayContent): void {
         const cacheKeys = ['trellis_daily_posts', 'trellis_video_cache', 'trellis_news_posts'];
         for (const key of cacheKeys) {
           try {
             const raw = localStorage.getItem(key);
             if (!raw) continue;
             const cached = JSON.parse(raw);
             const posts: DailyPost[] = cached?.posts ?? (Array.isArray(cached) ? cached : []);
             const idx = posts.findIndex((p: DailyPost) => p.id === postId);
             if (idx >= 0) {
               // Phase 41 D-03 + Pitfall 9 — selective merge so partial essays don't clobber.
               // When generator was called with depth: 'deep' it returns bodyMarkdownDeep populated
               // but bodyMarkdown empty; that empty string MUST NOT overwrite the existing standard.
               // Symmetric for the standard path.
               const merged: DailyPost = { ...posts[idx] };
               if (essay.bodyMarkdown && essay.bodyMarkdown.trim() !== '') merged.bodyMarkdown = essay.bodyMarkdown;
               if (essay.bodyMarkdownDeep && essay.bodyMarkdownDeep.trim() !== '') merged.bodyMarkdownDeep = essay.bodyMarkdownDeep;
               // Meta fields — preserve existing if new is empty (whyCare/takeaway are 1-sentence;
               // quickAskPrompts is an array — empty array is meaningful, replace it).
               if (essay.whyCare) merged.whyCare = essay.whyCare;
               if (essay.takeaway) merged.takeaway = essay.takeaway;
               if (essay.quickAskPrompts) merged.quickAskPrompts = essay.quickAskPrompts;
               posts[idx] = merged;
               if (cached?.posts) {
                 cached.posts = posts;
                 localStorage.setItem(key, JSON.stringify(cached));
               } else {
                 localStorage.setItem(key, JSON.stringify(posts));
               }
               return;
             }
           } catch { /* ignore */ }
         }
       }
       ```
       PRESERVE the existing comment block above the function (Phase 38 / TECHDEBT-06 historical context).

    2. Add a test case to `app/tests/services/post-essay-depth.test.mjs` covering the merge semantics. Pseudo-shape:
       ```javascript
       import { patchPostEssayInCache } from '../../src/services/post-essay.service.ts';

       test('SC-3 merge: patching bodyMarkdownDeep does NOT clobber existing bodyMarkdown', () => {
         // Setup: install a daily-posts cache blob with one post having a populated standard bodyMarkdown
         const seed = {
           date: '2026-05-09',
           fingerprint: 'test',
           posts: [{
             id: 'test-post-1',
             date: '2026-05-09',
             title: 't', teaser: { hook: 'h', preview: 'p' },
             bodyMarkdown: 'STANDARD ESSAY TEXT',
             whyCare: 'wc', takeaway: 'tk', quickAskPrompts: [],
             narrativeMode: 'mechanism-breakdown',
             contextLabel: 'L', sourceType: 'recent',
             sourceQuestionIds: [], sourceQuestionTitles: [], keywords: [],
             generatedAt: 0, origin: 'ai',
           }],
           connectionCards: [],
         };
         globalThis.localStorage.setItem('trellis_daily_posts', JSON.stringify(seed));

         // Patch only the deep field
         patchPostEssayInCache('test-post-1', {
           bodyMarkdown: '',  // empty — should NOT clobber
           bodyMarkdownDeep: 'DEEP ESSAY TEXT',
           whyCare: '',
           takeaway: '',
           quickAskPrompts: [],
         });

         const after = JSON.parse(globalThis.localStorage.getItem('trellis_daily_posts'));
         assert.equal(after.posts[0].bodyMarkdown, 'STANDARD ESSAY TEXT', 'standard preserved');
         assert.equal(after.posts[0].bodyMarkdownDeep, 'DEEP ESSAY TEXT', 'deep updated');
       });
       ```
       Use whatever localStorage shim the existing test infra provides (Phase 39/40 tests should have a pattern — look for `globalThis.localStorage` setup in `app/tests/services/engagement.service.test.mjs` or similar).

    3. Run `node --test app/tests/services/post-essay-depth.test.mjs` — must exit 0.
    4. Run `cd app && tsc -b --noEmit` — must exit 0.
    5. Commit atomically with `(41-02)` scope. Suggested message: `feat(41-02): patchPostEssayInCache selective merge for bodyMarkdownDeep (Pitfall 9)`.
  </action>
  <verify>
    <automated>node --test app/tests/services/post-essay-depth.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "if (essay.bodyMarkdownDeep" app/src/services/post-essay.service.ts` returns ≥ 1
    - `grep -c "merged.bodyMarkdown =" app/src/services/post-essay.service.ts` returns ≥ 1
    - Existing patchPostEssayInCache cache key list preserved: `grep -c "trellis_daily_posts" app/src/services/post-essay.service.ts` returns ≥ 1
    - Phase 38 TECHDEBT-06 historical comment preserved: `grep -c "Phase 38 / TECHDEBT-06" app/src/services/post-essay.service.ts` returns ≥ 1
    - `node --test app/tests/services/post-essay-depth.test.mjs` exits 0 (including the new merge test)
    - `cd app && tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>patchPostEssayInCache merge selective — partial essays preserve existing fields; bodyMarkdownDeep can be patched without clobbering standard bodyMarkdown; round-trip test green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Add options bag with signal to generateConnectionPost + generateDiscoverPost</name>
  <files>app/src/services/concept-feed.service.ts</files>
  <read_first>
    - app/src/services/concept-feed.service.ts lines 1780-1822 (generateConnectionPost current shape)
    - app/src/services/concept-feed.service.ts lines 1910-1940 (generateDiscoverPost current shape)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md § Pattern 5 (generator-side change shape) AND § Pitfall 6 (positional vs options bag — use trailing options bag for back-compat)
    - app/src/providers/llm/index.ts CompletionOptions (verify signal field threaded into chatStream — already wired per RESEARCH § "AbortController + signal threading end-to-end")
  </read_first>
  <behavior>
    - Test 1 (source-reading): generateConnectionPost signature ends with `options?: { signal?: AbortSignal }` parameter
    - Test 2 (source-reading): generateDiscoverPost signature ends with `options?: { signal?: AbortSignal }` parameter
    - Test 3 (source-reading): both generators' chatStream call includes `signal: options?.signal` in the options bag
    - Test 4: Existing 4-arg call (generateConnectionPost(qa, qb, ca, cb) without options) still type-checks (back-compat — options is optional)
  </behavior>
  <action>
    1. Edit `app/src/services/concept-feed.service.ts` lines ~1785-1822 — `generateConnectionPost`. Add trailing options bag:
       ```typescript
       async *generateConnectionPost(
         questionA: Question,
         questionB: Question,
         conceptNounA: string,
         conceptNounB: string,
         options?: { signal?: AbortSignal },  // Phase 41 SC-7 — abort threading
       ): AsyncGenerator<string> {
         const settings = settingsService.getSync();
         if (!settings.preferences.aiConsentGiven || !settings.llm.isConfigured) return;

         // ... existing system + prompt construction unchanged ...

         yield* chatStream(
           [{ role: 'system', content: system }, { role: 'user', content: prompt }],
           settings.llm,
           { serviceName: 'posts', signal: options?.signal },  // Phase 41 SC-7 — propagate signal
         );
       },
       ```

    2. Edit `app/src/services/concept-feed.service.ts` lines ~1914-1940 — `generateDiscoverPost`. Same pattern:
       ```typescript
       async *generateDiscoverPost(
         concept: string,
         title: string,
         options?: { signal?: AbortSignal },  // Phase 41 SC-7
       ): AsyncGenerator<string> {
         const settings = settingsService.getSync();
         if (!settings.preferences.aiConsentGiven || !settings.llm.isConfigured) return;

         // ... existing system + prompt construction unchanged ...

         yield* chatStream(
           [{ role: 'system', content: system }, { role: 'user', content: prompt }],
           settings.llm,
           { serviceName: 'posts', signal: options?.signal },  // Phase 41 SC-7
         );
       },
       ```

    3. Run `cd app && tsc -b --noEmit` — must exit 0 (back-compat additive parameter).
    4. Run `cd app && npm test` — full suite green; pass count preserved.
    5. Commit atomically with `(41-02)` scope. Suggested message: `feat(41-02): thread AbortSignal through generateConnectionPost + generateDiscoverPost`.
  </action>
  <verify>
    <automated>cd app && tsc -b --noEmit && npm test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -A1 "generateConnectionPost(" app/src/services/concept-feed.service.ts | grep -c "options?: { signal?: AbortSignal }"` returns ≥ 1 (signature has trailing options bag)
    - `grep -A1 "generateDiscoverPost(" app/src/services/concept-feed.service.ts | grep -c "options?: { signal?: AbortSignal }"` returns ≥ 1
    - In the body of both generators, chatStream is called with `signal: options?.signal` — verify via: `grep -c "signal: options?.signal" app/src/services/concept-feed.service.ts` returns ≥ 2
    - `cd app && tsc -b --noEmit` exits 0
    - `cd app && npm test` pass count preserved
  </acceptance_criteria>
  <done>Both generators accept optional signal-bearing options bag; chatStream receives signal; tsc + tests green; back-compat preserved.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Audit PostDetailScreen essay useEffect — pre-call abort guards + signal threading on all 3 branches</name>
  <files>app/src/screens/PostDetailScreen.tsx, app/tests/screens/PostDetailScreen-abort-threading.test.mjs</files>
  <read_first>
    - app/src/screens/PostDetailScreen.tsx lines 282-390 (essay useEffect — 3 async branches)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md § Pattern 5 (abort-signal-before-async guard shape)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md § Integration Points (PostDetailScreen.tsx:312-339 — branches 1/2/3 detail)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-VALIDATION.md § Per-Task Verification Map (SC-7(a)/(b)/(c))
  </read_first>
  <behavior>
    - Test 1 (source-reading): all 3 branches have `if (abortController.signal.aborted) return` BEFORE the for-await loop opener (count ≥ 3 distinct sites)
    - Test 2 (source-reading): branch 1 (connection) calls generateConnectionPost with `{ signal: abortController.signal }` as the trailing arg
    - Test 3 (source-reading): branch 2 (discover) calls generateDiscoverPost with `{ signal: abortController.signal }`
    - Test 4 (source-reading): branch 3 (else) already calls generatePostEssay with the signal — verify still present
    - Test 5 (counterweight): existing AbortController + LOCALE_CHANGED subscribe pattern preserved (regression guard)
  </behavior>
  <action>
    1. Edit `app/src/screens/PostDetailScreen.tsx` lines ~312-339. Apply the 3-branch fix per RESEARCH Pattern 5. Add pre-guard + signal arg to each:

       ```typescript
       // BRANCH 1 — connection
       if (post.sourceType === 'connection' && connectionMeta) {
         if (abortController.signal.aborted) return;  // Phase 41 SC-7 — pre-call guard
         for await (const chunk of conceptFeedService.generateConnectionPost(
           connectionMeta.questionA,
           connectionMeta.questionB,
           connectionMeta.conceptNounA,
           connectionMeta.conceptNounB,
           { signal: abortController.signal },  // Phase 41 SC-7 — generator-API signal
         )) {
           if (abortController.signal.aborted) return;
           accumulated += chunk;
           setStreamingBody(accumulated);
         }
       } else if (discoverMeta && post.id.includes('-post-')) {
         // BRANCH 2 — discover
         if (abortController.signal.aborted) return;  // Phase 41 SC-7
         for await (const chunk of conceptFeedService.generateDiscoverPost(
           discoverMeta.concept,
           discoverMeta.title,
           { signal: abortController.signal },  // Phase 41 SC-7
         )) {
           if (abortController.signal.aborted) return;
           accumulated += chunk;
           setStreamingBody(accumulated);
         }
       } else {
         // BRANCH 3 — generatePostEssay (already has signal arg; ADD pre-guard)
         if (abortController.signal.aborted) return;  // Phase 41 SC-7 — pre-call guard
         for await (const chunk of generatePostEssay(post, questionsRef.current, { signal: abortController.signal })) {
           if (abortController.signal.aborted) return; // D-08
           accumulated += chunk;
           setStreamingBody(accumulated);
         }
       }
       ```

       Update the existing `// D-15 scope:` comment block above the branches to reflect Phase 41 SC-7's expansion (or replace it):
       ```typescript
       // D-15 scope (extended Phase 41 SC-7): all 3 branches now thread the AbortSignal
       // AND have a pre-call abort guard. Walker termination + LOCALE_CHANGED mid-stream
       // cancel + unmount cleanup all funnel through the same single AbortController.
       ```

    2. PRESERVE all surrounding code: the LOCALE_CHANGED subscribe, the try/catch/finally, the patchPostEssayInCache call, the unsubLocale cleanup, the `return () => abortController.abort()` cleanup. ONLY add the 3 pre-guards + 2 signal args.

    3. CREATE `app/tests/screens/PostDetailScreen-abort-threading.test.mjs`. Source-reading approach (no jsdom per VALIDATION.md). Pseudo-shape:
       ```javascript
       import { test } from 'node:test';
       import assert from 'node:assert/strict';
       import { readFileSync } from 'node:fs';

       const SRC = readFileSync(new URL('../../src/screens/PostDetailScreen.tsx', import.meta.url), 'utf8');
       const FEED_SRC = readFileSync(new URL('../../src/services/concept-feed.service.ts', import.meta.url), 'utf8');

       // ─── SC-7(a) ────────────────────────────────────────────────────────────────
       test('SC-7(a): all 3 essay branches have pre-call if (abortController.signal.aborted) return', () => {
         // Find the essay useEffect block — bounded by 'On-enter essay generation' marker
         // and the closing of the useEffect (next useEffect or end of file).
         const start = SRC.indexOf('On-enter essay generation');
         assert.ok(start >= 0, 'essay useEffect marker found');
         const end = SRC.indexOf('useEffect(', start + 100);
         const block = SRC.slice(start, end > 0 ? end : start + 6000);

         // Count pre-call guards. The mid-stream guard inside the for-await body
         // also matches; we expect ≥3 PRE-CALL + N mid-stream. To narrow to pre-call,
         // count occurrences immediately PRECEDING `for await` openers.
         const preGuardPattern = /if \(abortController\.signal\.aborted\) return[^;]*;\s*\n\s*for await/g;
         const matches = [...block.matchAll(preGuardPattern)];
         assert.ok(matches.length >= 3, `expected ≥3 pre-call abort guards, got ${matches.length}`);
       });

       // ─── SC-7(b) ────────────────────────────────────────────────────────────────
       test('SC-7(b): all 3 branches pass { signal: abortController.signal } to the generator', () => {
         const start = SRC.indexOf('On-enter essay generation');
         const end = SRC.indexOf('useEffect(', start + 100);
         const block = SRC.slice(start, end > 0 ? end : start + 6000);

         // generateConnectionPost call gets the signal options bag
         assert.match(block, /generateConnectionPost\([\s\S]*?\{ signal: abortController\.signal \}/);
         // generateDiscoverPost call gets the signal options bag
         assert.match(block, /generateDiscoverPost\([\s\S]*?\{ signal: abortController\.signal \}/);
         // generatePostEssay call already has the signal — verify still present
         assert.match(block, /generatePostEssay\([\s\S]*?\{ signal: abortController\.signal \}/);
       });

       // ─── SC-7(c) ────────────────────────────────────────────────────────────────
       test('SC-7(c): generateConnectionPost and generateDiscoverPost accept options?.signal and propagate to chatStream', () => {
         // generateConnectionPost signature has the options bag
         assert.match(FEED_SRC, /generateConnectionPost\(\s*questionA[\s\S]*?options\?\: \{ signal\?: AbortSignal \}/);
         // generateDiscoverPost signature has the options bag
         assert.match(FEED_SRC, /generateDiscoverPost\(\s*concept[\s\S]*?options\?\: \{ signal\?: AbortSignal \}/);
         // Both bodies thread signal: options?.signal into chatStream
         const connStart = FEED_SRC.indexOf('async *generateConnectionPost');
         const connEnd = FEED_SRC.indexOf('saveConnectionPost', connStart);
         const connBlock = FEED_SRC.slice(connStart, connEnd);
         assert.match(connBlock, /signal: options\?\.signal/);

         const discStart = FEED_SRC.indexOf('async *generateDiscoverPost');
         const discEnd = FEED_SRC.indexOf('saveDiscoverPost', discStart);
         const discBlock = FEED_SRC.slice(discStart, discEnd);
         assert.match(discBlock, /signal: options\?\.signal/);
       });

       // ─── Counterweight ──────────────────────────────────────────────────────────
       test('counterweight: existing AbortController + LOCALE_CHANGED subscribe pattern preserved', () => {
         assert.match(SRC, /eventBus\.subscribe\('LOCALE_CHANGED'/);
         assert.match(SRC, /abortController\.abort\(new DOMException\('Locale changed', 'AbortError'\)\)/);
         assert.match(SRC, /return \(\) => \{[\s\S]*?abortController\.abort\(\);[\s\S]*?\};/);
       });
       ```
       Adjust the regex windows if needed — the goal is to lock SC-7(a)/(b)/(c) without false-positiving on the existing mid-stream guards (which are inside the for-await body, NOT before it). The `for await` lookahead in the SC-7(a) regex is the discriminator.

    4. Run `node --test app/tests/screens/PostDetailScreen-abort-threading.test.mjs` — must exit 0.
    5. Run `cd app && tsc -b --noEmit` — must exit 0.
    6. Run `cd app && npm test` — full suite green.
    7. Commit atomically with `(41-02)` scope. Suggested message: `feat(41-02): SC-7 abort threading — pre-call guards + signal args on all 3 essay branches`.
  </action>
  <verify>
    <automated>node --test app/tests/screens/PostDetailScreen-abort-threading.test.mjs && cd app && tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/screens/PostDetailScreen-abort-threading.test.mjs` exists
    - `grep -c "if (abortController.signal.aborted) return" app/src/screens/PostDetailScreen.tsx` returns ≥ 6 (3 pre-call guards + 3 mid-stream guards minimum; existing post-stream guards may add more)
    - `grep -c "{ signal: abortController.signal }" app/src/screens/PostDetailScreen.tsx` returns ≥ 3 (one per branch generator call)
    - `grep -c "generateConnectionPost" app/src/screens/PostDetailScreen.tsx` returns ≥ 1
    - `grep -c "generateDiscoverPost" app/src/screens/PostDetailScreen.tsx` returns ≥ 1
    - `node --test app/tests/screens/PostDetailScreen-abort-threading.test.mjs` exits 0
    - `cd app && tsc -b --noEmit` exits 0
    - LOCALE_CHANGED + abort cleanup pattern preserved: `grep -c "eventBus.subscribe('LOCALE_CHANGED'" app/src/screens/PostDetailScreen.tsx` returns ≥ 1
  </acceptance_criteria>
  <done>All 3 essay branches in PostDetailScreen.tsx have pre-call abort guards + thread {signal: abortController.signal}; SC-7(a)/(b)/(c) source-reading tests green; LOCALE_CHANGED + cleanup patterns preserved.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: ReactMarkdown components prop (sup/a/section overrides) + sanitize sup-attributes spread fix</name>
  <files>app/src/components/Markdown.tsx, app/tests/components/Markdown-citation-overrides.test.mjs</files>
  <read_first>
    - app/src/components/Markdown.tsx (full file — 44 lines)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md § Pattern 3 (ReactMarkdown components prop with default-schema footnotes — full citation chip + footnote link + footnote section component code) AND § Pitfall 4 (sanitize sup attribute spread fix)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md § D-04 (citation prompting + rendering shape)
    - app/src/components/ChatMessage.tsx (existing chip pattern — reusable inline-style starting point)
  </read_first>
  <behavior>
    - Test 1 (source-reading): Markdown.tsx imports `type { Components } from 'react-markdown'` (or equivalent shape)
    - Test 2 (source-reading): Markdown.tsx defines 3 components — sup citation chip, a footnote link, section footnote section (visible by name or by inline definition)
    - Test 3 (source-reading): `<ReactMarkdown>` JSX has `components={...}` prop AND the prop object has `sup:`, `a:`, `section:` keys
    - Test 4 (source-reading SC-5(c)): sanitizeSchema attributes.sup spreads `defaultSchema.attributes?.['sup']` (Pitfall 4 regression guard) — mirror the existing span/div pattern at lines 19-20
    - Test 5 (counterweight): existing 'sup' tag in tagNames preserved; defaultSchema spread preserved; existing span/div spreads preserved
  </behavior>
  <action>
    1. Edit `app/src/components/Markdown.tsx`. Apply BOTH changes:

       **Change A — sanitize sup attribute spread fix (SC-5(c) / Pitfall 4):** at line 17, change:
       ```typescript
       sup: ['dataCite', 'style'],
       ```
       to:
       ```typescript
       // Phase 41 SC-5(c) / RESEARCH Pitfall 4 — spread defaultSchema sup attrs so future
       // schema additions (e.g. data-footnotes) survive. Mirrors span/div pattern below.
       sup: [...(defaultSchema.attributes?.['sup'] ?? []), 'dataCite', 'style'],
       ```

       **Change B — components prop (SC-5(b)):** Import the `Components` type and add 3 component overrides. New top-of-file:
       ```typescript
       import ReactMarkdown, { type Components } from 'react-markdown';
       import remarkGfm from 'remark-gfm';
       import remarkMath from 'remark-math';
       import rehypeKatex from 'rehype-katex';
       import rehypeRaw from 'rehype-raw';
       import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
       import 'katex/dist/katex.min.css';
       import { normalizeMarkdownText } from '../lib/text-normalization';

       // ... existing sanitizeSchema (with the SC-5(c) sup fix applied) ...

       // Phase 41 SC-5(b) — citation chip + footnote link + footnote section overrides.
       // Targets remark-gfm v4's footnote output shape:
       //   <sup><a data-footnote-ref ...>N</a></sup>
       //   <section data-footnotes class="footnotes">...</section>
       const citationComponents: Components = {
         sup: ({ children, ...rest }) => (
           <sup
             {...rest}
             style={{
               fontSize: '0.7em',
               padding: '1px 4px',
               borderRadius: '4px',
               background: 'var(--surface-variant)',
               color: 'var(--muted-foreground)',
               margin: '0 1px',
               verticalAlign: 'super',
             }}
           >
             {children}
           </sup>
         ),
         a: ({ href, children, ...rest }) => {
           // Discriminate footnote refs/backrefs by data attribute — survives DOM-clobber prefix changes.
           const isFootnoteRef = (rest as Record<string, unknown>)['data-footnote-ref'];
           const isFootnoteBackref = (rest as Record<string, unknown>)['data-footnote-backref'];
           if (isFootnoteRef || isFootnoteBackref) {
             return (
               <a
                 {...rest}
                 href={href}
                 style={{ color: 'var(--primary-40)', textDecoration: 'none' }}
               >
                 {children}
               </a>
             );
           }
           return <a {...rest} href={href}>{children}</a>;
         },
         section: ({ children, className, ...rest }) => {
           if (className?.includes('footnotes')) {
             return (
               <section
                 {...rest}
                 className={className}
                 style={{
                   marginTop: '24px',
                   paddingTop: '12px',
                   borderTop: '1px solid var(--surface-variant)',
                   fontSize: '0.85em',
                   color: 'var(--muted-foreground)',
                 }}
               >
                 {children}
               </section>
             );
           }
           return <section {...rest} className={className}>{children}</section>;
         },
       };

       interface MarkdownProps {
         children: string;
       }

       export function Markdown({ children }: MarkdownProps) {
         return (
           <div className="md-prose">
             <ReactMarkdown
               remarkPlugins={[remarkGfm, remarkMath]}
               rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
               components={citationComponents}
             >
               {normalizeMarkdownText(children)}
             </ReactMarkdown>
           </div>
         );
       }
       ```

    2. CREATE `app/tests/components/Markdown-citation-overrides.test.mjs`. Source-reading (per VALIDATION.md — no jsdom; visual rendering deferred to operator UAT). Pseudo-shape:
       ```javascript
       import { test } from 'node:test';
       import assert from 'node:assert/strict';
       import { readFileSync } from 'node:fs';

       const SRC = readFileSync(new URL('../../src/components/Markdown.tsx', import.meta.url), 'utf8');

       // ─── SC-5(b) ────────────────────────────────────────────────────────────────
       test('SC-5(b): Markdown.tsx imports Components type from react-markdown', () => {
         assert.match(SRC, /import ReactMarkdown,\s*\{\s*type Components\s*\}\s*from 'react-markdown'/);
       });

       test('SC-5(b): Markdown.tsx defines components object with sup, a, section keys', () => {
         // Components: Components = { sup: ..., a: ..., section: ... }
         assert.match(SRC, /:\s*Components\s*=\s*\{/);
         // Each key as a property of the components object
         const compsBlock = SRC.slice(SRC.indexOf(': Components ='));
         assert.match(compsBlock, /sup:\s*\(/);
         assert.match(compsBlock, /a:\s*\(/);
         assert.match(compsBlock, /section:\s*\(/);
       });

       test('SC-5(b): ReactMarkdown JSX has components prop wired', () => {
         assert.match(SRC, /<ReactMarkdown[\s\S]*?components=\{/);
       });

       test('SC-5(b): footnote discriminators (data-footnote-ref / data-footnote-backref) consumed in <a> override', () => {
         assert.match(SRC, /data-footnote-ref/);
         assert.match(SRC, /data-footnote-backref/);
       });

       test('SC-5(b): section override discriminates by className.includes("footnotes")', () => {
         assert.match(SRC, /className\?\.includes\('footnotes'\)/);
       });

       // ─── SC-5(c) Pitfall 4 regression guard ─────────────────────────────────────
       test('SC-5(c): sanitizeSchema attributes.sup spreads defaultSchema.attributes?.["sup"]', () => {
         assert.match(SRC, /sup:\s*\[\s*\.\.\.\(defaultSchema\.attributes\?\.\['sup'\]\s*\?\?\s*\[\]\)/);
       });

       // ─── Counterweight ──────────────────────────────────────────────────────────
       test('counterweight: existing tagNames sup + dataCite + span/div spread preserved', () => {
         assert.match(SRC, /tagNames:\s*\[\.\.\.\(defaultSchema\.tagNames\s*\?\?\s*\[\]\),\s*'sup'\]/);
         assert.match(SRC, /'dataCite'/);
         assert.match(SRC, /span:\s*\[\.\.\.\(defaultSchema\.attributes\?\.\['span'\]/);
         assert.match(SRC, /div:\s*\[\.\.\.\(defaultSchema\.attributes\?\.\['div'\]/);
       });
       ```

    3. Run `node --test app/tests/components/Markdown-citation-overrides.test.mjs` — must exit 0.
    4. Run `cd app && tsc -b --noEmit` — must exit 0 (Components type from react-markdown v10 is exported).
    5. Run `cd app && npm test` — full suite green.
    6. Commit atomically with `(41-02)` scope. Suggested message: `feat(41-02): ReactMarkdown sup/a/section overrides for footnote chips + sanitize sup-attr spread fix`.
  </action>
  <verify>
    <automated>node --test app/tests/components/Markdown-citation-overrides.test.mjs && cd app && tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/components/Markdown-citation-overrides.test.mjs` exists
    - `grep -c "type Components" app/src/components/Markdown.tsx` returns ≥ 1
    - `grep -c "components={" app/src/components/Markdown.tsx` returns ≥ 1 (or `components=` with citationComponents identifier)
    - `grep -c "data-footnote-ref" app/src/components/Markdown.tsx` returns ≥ 1
    - `grep -c "className?.includes('footnotes')" app/src/components/Markdown.tsx` returns ≥ 1
    - Pitfall 4 fix: `grep -c "...(defaultSchema.attributes?.\['sup'\]" app/src/components/Markdown.tsx` returns ≥ 1
    - Existing dataCite + span/div spreads preserved: `grep -c "dataCite" app/src/components/Markdown.tsx` returns ≥ 1; `grep -c "...(defaultSchema.attributes?.\['span'\]" app/src/components/Markdown.tsx` returns ≥ 1
    - `node --test app/tests/components/Markdown-citation-overrides.test.mjs` exits 0
    - `cd app && tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>Markdown.tsx renders sup/a/section overrides for footnote chips; sanitize schema sup attributes spread defaultSchema (Pitfall 4 fix); SC-5(b)/(c) tests green; existing span/div/dataCite preserved; tsc clean.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 7: Plan close-out (full suite green check + state updates)</name>
  <files>.planning/STATE.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/phases/41-pipeline-wiring-essay-depth/41-02-essay-depth-citation-rendering-SUMMARY.md</files>
  <read_first>
    - .planning/STATE.md (current position + last decisions section formats)
    - .planning/REQUIREMENTS.md (CONTENT-01, CONTENT-03, CONTENT-04 status promotion)
    - .planning/ROADMAP.md (Phase 41 plan list — mark 41-02 done)
    - .planning/phases/40-source-diversity-leaf-module/40-01-source-diversity-service-SUMMARY.md (template for SUMMARY.md frontmatter shape)
  </read_first>
  <action>
    1. Run `cd app && npm test` and `cd app && tsc -b --noEmit` to capture final baseline.
    2. CREATE `.planning/phases/41-pipeline-wiring-essay-depth/41-02-essay-depth-citation-rendering-SUMMARY.md` following the Phase 40 SUMMARY frontmatter shape. Include:
       - tags, dependency graph (requires Phase 40 multi-snippet news shape from Plan 41-01), provides, affects (Phase 43 Deep dive button consumes EssayOptions.depth), key-files, key-decisions, patterns-established
       - requirements-completed: [CONTENT-01, CONTENT-03, CONTENT-04]
       - duration, completed date, commit hashes, deviations, test baselines
    3. Update `.planning/REQUIREMENTS.md`:
       - CONTENT-01: change `[ ]` to `[x]` (deep dive API + bodyMarkdownDeep field shipped — Phase 43 ships button)
       - CONTENT-03: change `[ ]` to `[x]` (multi-snippet grounding lands; Plan 41-01 ships shape, Plan 41-02 ships consumption)
       - CONTENT-04: change `[ ]` to `[x]` (sup/a/section overrides shipped)
       - Update traceability table accordingly
    4. Update `.planning/ROADMAP.md` Phase 41 plan list — mark `[x] 41-02-essay-depth-citation-rendering-PLAN.md`.
    5. Update `.planning/STATE.md`:
       - Frontmatter: increment completed_plans counter
       - Add a "Last decisions (Plan 41-02 close, 2026-05-09)" section with key in-execution decisions
       - Update Stopped at: "Plan 41-02 complete — Phase 41 ready for verify-work"
    6. Commit atomically with `(41-02)` scope. Suggested message: `docs(41-02): close-out — CONTENT-01/03/04 complete; Phase 43 unblocked for deep-dive button + UI`.
  </action>
  <verify>
    <automated>cd app && tsc -b --noEmit && npm test</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/41-pipeline-wiring-essay-depth/41-02-essay-depth-citation-rendering-SUMMARY.md` exists with valid frontmatter
    - `.planning/REQUIREMENTS.md` shows CONTENT-01, CONTENT-03, CONTENT-04 as `[x]` Complete
    - `.planning/ROADMAP.md` Phase 41 plan list has `[x]` for 41-02
    - `.planning/STATE.md` has new "Last decisions (Plan 41-02 close)" section
    - `cd app && tsc -b --noEmit` exits 0
    - `cd app && npm test` pass count ≥ pre-Plan-41-02 baseline + new assertions across 3 new test files (post-essay-depth + PostDetailScreen-abort-threading + Markdown-citation-overrides)
    - Pre-existing carry-over failures unchanged
  </acceptance_criteria>
  <done>SUMMARY.md committed; REQUIREMENTS + ROADMAP + STATE updated; CONTENT-01 + CONTENT-03 + CONTENT-04 promoted to complete; baseline preserved; Phase 43 unblocked.</done>
</task>

</tasks>

<verification>
After all 7 tasks complete:

1. `cd app && tsc -b --noEmit` exits 0
2. `cd app && npm test` pass count ≥ (pre-Plan-41-02 baseline + new assertions across 3 new test files: post-essay-depth + PostDetailScreen-abort-threading + Markdown-citation-overrides)
3. The 2 pre-existing carry-over failures remain unchanged (concept-feed.test.mjs ERR_MODULE_NOT_FOUND + trellis-layout date assertion)
4. `grep -c "depth?: 'standard' | 'deep'" app/src/services/post-essay.service.ts` returns 1
5. `grep -c "bodyMarkdownDeep" app/src/types/index.ts` returns ≥ 1
6. `grep -c "bodyMarkdownDeep" app/src/services/post-essay.service.ts` returns ≥ 2 (interface field + merge guard)
7. `grep -c "[^1]" app/src/services/post-essay.service.ts` returns ≥ 1 (footnote prompt instruction)
8. `grep -c "{ signal: abortController.signal }" app/src/screens/PostDetailScreen.tsx` returns ≥ 3 (one per branch)
9. `grep -c "components=" app/src/components/Markdown.tsx` returns ≥ 1
10. Each task = one atomic commit with `(41-02)` scope
</verification>

<success_criteria>
- SC-3 (depth: 'deep' produces 350-600w; standard 150-250w / 200-350w / 200-400w / 80-120w preserved) — Tasks 1 + 2 + 3 (interface + generators + merge)
- SC-4 (essay prompt receives sources.slice(0, 3) for grounding) — Task 2
- SC-5(a) (LLM news prompt contains footnote instruction string) — Task 2
- SC-5(b) (Markdown.tsx has components={{ sup, a, section }} overrides) — Task 6
- SC-5(c) (sanitize schema attributes.sup spreads defaultSchema — Pitfall 4 regression guard) — Task 6
- SC-6 (generateEssayMeta body slice cap raised 2000→4000) — Task 2
- SC-7(a) (all 3 async branches have pre-call if (signal.aborted) return) — Task 5
- SC-7(b) (all 3 branches pass { signal: abortController.signal } to generator) — Tasks 4 + 5
- SC-7(c) (generateConnectionPost + generateDiscoverPost accept and thread signal) — Task 4
- CONTENT-01 + CONTENT-03 + CONTENT-04 promoted from `[ ]` to `[x]` in REQUIREMENTS.md
- bodyMarkdownDeep additive to EssayContent + PostSnapshot (Pitfall 9 — back-compat preserved)
- patchPostEssayInCache merge handles partial essays correctly (Pitfall 9 — empty bodyMarkdown does NOT clobber)
- Phase 43 unblocked: Deep dive button can call `generatePostEssay(post, questions, { depth: 'deep' })` and patch via `patchPostEssayInCache(postId, { bodyMarkdownDeep, ...meta })`
- Sequenced after Plan 41-01 in Wave 2 — both plans touch concept-feed.service.ts (Plan 41-01 owns news loops + loadCache at ~lines 1083-1131/1280-1313/186; Plan 41-02 Task 4 owns generateConnectionPost/generateDiscoverPost signal threading at ~lines 1785/1914). Logical scopes disjoint; execution order avoids parallel-write file corruption.
</success_criteria>

<output>
After completion, create `.planning/phases/41-pipeline-wiring-essay-depth/41-02-essay-depth-citation-rendering-SUMMARY.md` with:
- Frontmatter (tags, dependency graph, provides, affects, key-files, key-decisions, patterns-established, requirements-completed [CONTENT-01, CONTENT-03, CONTENT-04], duration, completed)
- Sections: Performance, Accomplishments, Task Commits, Files Created/Modified, Test Baselines, Decisions Made, Deviations from Plan (auto-fixed issues), Issues Encountered, User Setup Required, Next Phase Readiness, Self-Check
</output>
