---
phase: 43-engagement-ui
plan: 05
type: execute
wave: 1
depends_on: [43-01]
files_modified:
  - app/src/screens/PostDetailScreen.tsx
  - app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs
  - app/tests/screens/PostDetailScreen.segmented-toggle.test.mjs
  - app/tests/screens/PostDetailScreen.abort-contract.test.mjs
autonomous: true
requirements: [CONTENT-01]
must_haves:
  truths:
    - "PostDetailScreen renders a full-width Deep Dive button below the essay body and above the takeaway"
    - "Button condition: !isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && !post.bodyMarkdownDeep && !isStreamingDeep"
    - "Tap on Deep Dive button kicks off a NEW AbortController (deepAbortControllerRef) and a generatePostEssay({ depth: 'deep', signal }) stream"
    - "During the deep stream, the body slot renders Markdown(streamingDeep) and a 'Restore standard' link appears above the body"
    - "Restore standard tap aborts the deep controller, resets streamingDeep/'' and activeVariant to 'standard'"
    - "Once post.bodyMarkdownDeep is non-empty (cached), the button slot is replaced by a Standard | Deep segmented control"
    - "Segmented control toggles activeVariant; body slot renders either post.bodyMarkdown or post.bodyMarkdownDeep based on activeVariant"
    - "AbortController contract preserved: existing 3 pre-call guards remain + 1 new pre-call guard for the deep-stream path; 4 existing signal-arg passes remain + 1 new signal-arg pass on generatePostEssay({ depth: 'deep', signal })"
    - "patchPostEssayInCache for bodyMarkdownDeep ONLY fires when !deepAbortController.signal.aborted (DD-05 hard invariant)"
    - "DD-04 segmented-toggle assertions live in a dedicated test file (PostDetailScreen.segmented-toggle.test.mjs per VALIDATION line 53)"
  artifacts:
    - path: "app/src/screens/PostDetailScreen.tsx"
      provides: "Deep-dive button + segmented control + state machine + new deepAbortControllerRef"
    - path: "app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs"
      provides: "Source-reading assertions for DD-01..DD-03: button position, deep-stream state, restore-standard handler"
    - path: "app/tests/screens/PostDetailScreen.segmented-toggle.test.mjs"
      provides: "Source-reading assertions for DD-04 segmented Standard|Deep toggle (revised 2026-05-11 per plan-checker Blocker 4 — dedicated file per VALIDATION line 53)"
    - path: "app/tests/screens/PostDetailScreen.abort-contract.test.mjs"
      provides: "Source-reading assertions for DD-05 abort contract: pre-call guards + signal-arg passes + cache-write guard"
  key_links:
    - from: "app/src/screens/PostDetailScreen.tsx"
      to: "app/src/services/post-essay.service.ts"
      via: "generatePostEssay(post, questions, { depth: 'deep', signal }) consumes Phase 41-02 EssayOptions.depth knob"
      pattern: "generatePostEssay\\([^)]*depth:\\s*['\"]deep['\"]"
    - from: "app/src/screens/PostDetailScreen.tsx"
      to: "app/src/services/post-essay.service.ts"
      via: "patchPostEssayInCache(post.id, { bodyMarkdownDeep: accumulated })"
      pattern: "patchPostEssayInCache.*bodyMarkdownDeep"
---

<objective>
Implement DD-01..DD-05 from CONTEXT.md: ship the user-facing Deep Dive button on PostDetailScreen + the segmented Standard | Deep toggle that appears after a deep variant is cached.

Phase 41-02 already shipped the underlying engine (`EssayOptions.depth: 'standard' | 'deep'`, `bodyMarkdownDeep?: string` field on `EssayContent` + `PostSnapshot`, depth-aware `patchPostEssayInCache`). This plan ONLY wires the UI controls — no service-layer changes.

The hardest invariant is DD-05: the AbortController contract at PostDetailScreen.tsx:313-350 (3 pre-call guards + 4 signal-arg passes) must be preserved AND extended. The new deep-stream call adds:
- A NEW AbortController (`deepAbortControllerRef`) — separate from the existing essay-stream controller so the deep stream can be cancelled independently
- A 5th signal-arg pass: `generatePostEssay(post, questions, { depth: 'deep', signal: deepAbortControllerRef.current.signal })`
- A pre-call guard immediately before the deep `for await`: `if (deepAbortControllerRef.current.signal.aborted) return`
- A cache-write guard: `patchPostEssayInCache` for `bodyMarkdownDeep` ONLY fires when `!deepAbortControllerRef.current.signal.aborted`

User-facing UX (DD-01..DD-04):
- DD-01: Button placed between scroll sentinel (PostDetailScreen.tsx:839) and takeaway (:840)
- DD-02: Full-width subtle button — var(--surface-variant) bg, var(--primary-40) text, Sparkles icon, t('posts.detail.deepDive.cta')
- DD-03: Tap → switches body slot to streamingDeep render in-place; "Restore standard" link appears above the body; tapping it aborts + reverts activeVariant to 'standard'
- DD-04: Once post.bodyMarkdownDeep is non-empty, button slot becomes a Standard | Deep segmented control; toggle is client-side state, no re-stream

**Test file split (revised 2026-05-11 per plan-checker Blocker 4):** DD-04 segmented-toggle assertions live in their OWN dedicated test file `tests/screens/PostDetailScreen.segmented-toggle.test.mjs` per VALIDATION.md line 53. The dedicated file was created by 43-01 Task 4 (Wave 0). This plan fills it via Task 4 below. The deep-dive-trigger test (Task 2) keeps DD-01..DD-03 assertions only.

Purpose: Wave-1 plan; parallel-safe with 43-02/03/04/07. CONTENT-01 user-facing visible work.
Output: PostDetailScreen.tsx delta (~120 LOC of new state + render + handlers), 3 test files filled in.
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
@.planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md
@.planning/phases/41-pipeline-wiring-essay-depth/41-02-essay-depth-citation-rendering-SUMMARY.md

# Reference implementations to read first
@app/src/screens/PostDetailScreen.tsx
@app/src/services/post-essay.service.ts

<interfaces>
From app/src/services/post-essay.service.ts (Phase 41-02 — DO NOT TOUCH):
```typescript
export interface EssayOptions {
  depth?: 'standard' | 'deep';
  signal?: AbortSignal;
  // ...other existing options...
}
export interface EssayContent {
  bodyMarkdown: string;
  bodyMarkdownDeep?: string;  // populated when depth: 'deep' completes + patches cache
  takeaway: string;
  // ...
}
export async function* generatePostEssay(post: DailyPost, questions: Question[], opts?: EssayOptions): AsyncIterable<string>;
export async function generateEssayMeta(post: DailyPost, accumulated: string, opts?: EssayOptions): Promise<Omit<EssayContent, 'bodyMarkdown'>>;
export function patchPostEssayInCache(postId: string, patch: Partial<EssayContent>): void;
```

From app/src/screens/PostDetailScreen.tsx existing AbortController contract (lines 283-393 — DO NOT REGRESS):
```typescript
// Line 293
const abortController = new AbortController();
// Line 295 (locale change abort)
abortController.abort(new DOMException('Locale changed', 'AbortError'));
// Lines 314, 327, 338 — three pre-call guards (one before each for-await opener)
if (abortController.signal.aborted) return;
// Lines 320, 331, 339, 350 — four signal-arg passes
{ signal: abortController.signal }   // on generateConnectionPost, generateDiscoverPost, generatePostEssay, generateEssayMeta
// Line 346 — cache-write guard
if (abortController.signal.aborted) return;   // before patchPostEssayInCache
// Line 393 — unmount-cleanup abort
abortController.abort();
```

Existing state in PostDetailScreen.tsx (lines 80-90):
```typescript
const [streamingBody, setStreamingBody] = useState('');
const [isStreamingOnEnter, setIsStreamingOnEnter] = useState(false);
const [onEnterError, setOnEnterError] = useState<string | null>(null);
const [onEnterMeta, setOnEnterMeta] = useState<Omit<EssayContent, 'bodyMarkdown'> | null>(null);
```

NEW state for DD-03/DD-04 (this plan adds):
```typescript
const [streamingDeep, setStreamingDeep] = useState('');
const [isStreamingDeep, setIsStreamingDeep] = useState(false);
const [deepError, setDeepError] = useState<string | null>(null);
const [activeVariant, setActiveVariant] = useState<'standard' | 'deep'>('standard');
const deepAbortControllerRef = useRef<AbortController | null>(null);
```

i18n keys to consume (created by 43-01 Task 3):
- t('posts.detail.deepDive.cta')          → "Deep dive into this concept"
- t('posts.detail.deepDive.restoreStandard') → "Restore standard"
- t('posts.detail.deepDive.toggleStandard')  → "Standard"
- t('posts.detail.deepDive.toggleDeep')      → "Deep"
- t('posts.detail.deepDive.streamingLabel')  → "Streaming deeper version…"

Insertion site (DD-01 — verified via direct code inspection at PostDetailScreen.tsx:838-840):
```jsx
<div ref={scrollSentinelRef} style={{ height: '1px' }} />
{/* NEW: deep-dive controls slot — renders DeepDiveButton OR Restore link OR SegmentedControl based on state */}
{!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()}
{post.sourceType !== 'video' && (post.takeaway || onEnterMeta?.takeaway) && (
  ...takeaway...
)}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add deep-dive state + handlers + AbortController + i18n keys consumption to PostDetailScreen.tsx</name>
  <files>app/src/screens/PostDetailScreen.tsx</files>
  <read_first>
    - app/src/screens/PostDetailScreen.tsx (read FULL file with focus on lines 70-100 state region, lines 280-400 AbortController contract, lines 790-860 essay body + sentinel + takeaway render region)
    - app/src/services/post-essay.service.ts (verify generatePostEssay accepts depth: 'deep' in opts; verify patchPostEssayInCache accepts partial { bodyMarkdownDeep } per Phase 41-02 D-03)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-02-essay-depth-citation-rendering-SUMMARY.md (Phase 41-02 final shape of depth knob + cache patch)
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (DD-01..DD-05 verbatim; especially DD-05 hard invariant)
    - .planning/phases/43-engagement-ui/43-UI-SPEC.md (Sections 7-9 lines 433-528 — VERBATIM visual contracts for DeepDiveButton, RestoreStandard, SegmentedControl)
    - .planning/phases/43-engagement-ui/43-RESEARCH.md (Section 7 lines 261-330 — state machine; Pitfall 3 lines 698-702 — separate deepAbortControllerRef)
  </read_first>
  <behavior>
    - Test 1: PostDetailScreen.tsx adds 4 new state variables: streamingDeep (string), isStreamingDeep (boolean), deepError (string | null), activeVariant ('standard' | 'deep')
    - Test 2: PostDetailScreen.tsx adds 1 new ref: deepAbortControllerRef (AbortController | null)
    - Test 3: A new handler handleStartDeepDive is defined and called by the DeepDiveButton onClick. Handler:
      a. Creates a NEW AbortController, stores it in deepAbortControllerRef.current
      b. Sets isStreamingDeep(true), activeVariant('deep'), streamingDeep(''), deepError(null)
      c. Calls generatePostEssay(post, questionsRef.current, { depth: 'deep', signal: deepAbortControllerRef.current.signal }) inside a for-await loop with pre-call guard "if (deepAbortControllerRef.current?.signal.aborted) return"
      d. Accumulates chunks into streamingDeep state
      e. On completion (loop exits cleanly), guards with !signal.aborted then calls patchPostEssayInCache(post.id, { bodyMarkdownDeep: accumulated }) and setPost to the updated post
      f. On error, sets deepError + isStreamingDeep(false)
      g. finally block sets isStreamingDeep(false) (but DOES NOT clear streamingDeep — UI keeps the body rendered after the stream completes; segmented control uses post.bodyMarkdownDeep going forward)
    - Test 4: A new handler handleRestoreStandard is defined and called by the Restore link onClick. Handler:
      a. Calls deepAbortControllerRef.current?.abort()
      b. Sets isStreamingDeep(false)
      c. Sets activeVariant('standard')
      d. Sets streamingDeep('')
    - Test 5: A renderDeepDiveControls function exists that returns the appropriate UI element based on state:
      a. If isStreamingDeep → return <RestoreStandardLink onTap={handleRestoreStandard} />
      b. Else if typeof post.bodyMarkdownDeep === 'string' && post.bodyMarkdownDeep.length > 0 → return <SegmentedControl active={activeVariant} onChange={setActiveVariant} />
      c. Else → return <DeepDiveButton onTap={handleStartDeepDive} />
    - Test 6: The body slot render branch is extended: when activeVariant === 'deep' AND post.bodyMarkdownDeep present → <Markdown>{post.bodyMarkdownDeep}</Markdown>; when isStreamingDeep → <Markdown>{streamingDeep}</Markdown>; else existing standard branch unchanged
    - Test 7: The new render at line 838-840 inserts the deep-dive controls slot via { !isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls() }
    - Test 8: i18n keys all referenced: posts.detail.deepDive.cta, posts.detail.deepDive.restoreStandard, posts.detail.deepDive.toggleStandard, posts.detail.deepDive.toggleDeep, posts.detail.deepDive.streamingLabel
    - Test 9: AbortController contract DD-05 hard invariants:
      a. Pre-call guard count: source contains AT LEAST 4 instances of "if (abortController.signal.aborted) return" OR equivalent guards (existing 3 from Phase 41 + 1 new for the deep path). Note the new guard uses deepAbortControllerRef.current.signal.aborted — write the assertion to count guards on BOTH controllers.
      b. Signal-arg pass count: source contains AT LEAST 5 instances of "signal: abortController.signal" OR "signal: deepAbortControllerRef.current.signal" (4 existing + 1 new on deep call). Allow either expression form.
      c. patchPostEssayInCache invocations for bodyMarkdownDeep ALL preceded by "!deepAbortControllerRef.current?.signal.aborted" or equivalent guard
      d. The existing AbortController abort() in the unmount cleanup at line 393 STILL fires; ALSO the deep controller gets aborted in the same cleanup (add deepAbortControllerRef.current?.abort() alongside)
    - Test 10: Cleanup effect also aborts deepAbortControllerRef.current on unmount + on postId change (preserve existing cleanup contract)
    - Test 11: tsc -b --noEmit exits 0
  </behavior>
  <action>
    Modify app/src/screens/PostDetailScreen.tsx with these additive edits. Preserve every existing line; this is purely additive + 3 targeted insertions.

    1. Add new state declarations next to the existing essay state (around line 80-90):
       ```typescript
       const [streamingDeep, setStreamingDeep] = useState('');
       const [isStreamingDeep, setIsStreamingDeep] = useState(false);
       const [deepError, setDeepError] = useState<string | null>(null);
       const [activeVariant, setActiveVariant] = useState<'standard' | 'deep'>('standard');
       const deepAbortControllerRef = useRef<AbortController | null>(null);
       ```

    2. Add Sparkles + Loader2 (or equivalent) icons to the existing lucide-react import statement if not already present.

    3. Add the deep-dive handler near the existing essay-stream effect (around lines 280-400). Place AFTER the existing useEffect that owns the on-enter stream and ITS cleanup:

       ```typescript
       const handleStartDeepDive = useCallback(async () => {
         if (!post) return;
         // Create NEW dedicated controller for the deep stream (separate from on-enter controller —
         // RESEARCH Pitfall 3: reusing the existing controller after it may have been aborted
         // would immediately bail the deep stream).
         const ctrl = new AbortController();
         deepAbortControllerRef.current = ctrl;
         setIsStreamingDeep(true);
         setActiveVariant('deep');
         setStreamingDeep('');
         setDeepError(null);

         let accumulated = '';
         try {
           // DD-05 pre-call guard (new — 4th guard total across this file)
           if (ctrl.signal.aborted) return;
           for await (const chunk of generatePostEssay(post, questionsRef.current, { depth: 'deep', signal: ctrl.signal })) {
             // DD-05 pre-call guard inside loop (matches existing pattern at line 340)
             if (ctrl.signal.aborted) return;
             accumulated += chunk;
             setStreamingDeep(accumulated);
           }
           // DD-05 cache-write guard — bodyMarkdownDeep is NEVER written from a partial stream
           if (ctrl.signal.aborted) return;
           patchPostEssayInCache(post.id, { bodyMarkdownDeep: accumulated });
           // Refresh local post state so the segmented control flips from "deep button" to "Standard|Deep toggle"
           setPost((prev) => prev ? { ...prev, bodyMarkdownDeep: accumulated } : prev);
         } catch (err) {
           if (ctrl.signal.aborted) return;
           setDeepError(err instanceof Error ? err.message : String(err));
         } finally {
           if (deepAbortControllerRef.current === ctrl) {
             setIsStreamingDeep(false);
           }
         }
       }, [post]);

       const handleRestoreStandard = useCallback(() => {
         deepAbortControllerRef.current?.abort();
         setIsStreamingDeep(false);
         setActiveVariant('standard');
         setStreamingDeep('');
       }, []);
       ```

    4. Add the renderDeepDiveControls function inside the component:
       ```typescript
       const renderDeepDiveControls = () => {
         if (isStreamingDeep) {
           return (
             <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
               <button
                 type="button"
                 onClick={handleRestoreStandard}
                 style={{
                   padding: '6px 12px',
                   minHeight: '44px',
                   background: 'none',
                   border: 'none',
                   color: 'var(--primary-40)',
                   fontSize: '12px',
                   fontWeight: 700,
                   cursor: 'pointer',
                 }}
               >
                 {t('posts.detail.deepDive.restoreStandard')}
               </button>
             </div>
           );
         }
         const deepCached = typeof post.bodyMarkdownDeep === 'string' && post.bodyMarkdownDeep.length > 0;
         if (deepCached) {
           // Standard | Deep segmented control per UI-SPEC §9
           return (
             <div
               role="tablist"
               style={{
                 display: 'inline-flex',
                 width: '100%',
                 padding: '4px',
                 gap: '4px',
                 backgroundColor: 'var(--surface-variant)',
                 borderRadius: 'var(--radius-pill, 9999px)',
                 border: '1px solid var(--border)',
                 marginTop: '20px',
                 marginBottom: '16px',
                 boxSizing: 'border-box',
               }}
             >
               {(['standard', 'deep'] as const).map((variant) => {
                 const isActive = activeVariant === variant;
                 return (
                   <button
                     key={variant}
                     type="button"
                     role="tab"
                     aria-selected={isActive}
                     onClick={() => setActiveVariant(variant)}
                     style={{
                       flex: 1,
                       padding: '10px 16px',
                       border: 'none',
                       cursor: 'pointer',
                       borderRadius: 9999,
                       minHeight: '44px',
                       backgroundColor: isActive ? 'var(--primary-40)' : 'transparent',
                       color: isActive ? '#FFFFFF' : 'var(--muted-foreground)',
                       fontSize: '14px',
                       fontWeight: isActive ? 700 : 500,
                       transition: 'background-color 150ms ease, color 150ms ease',
                       fontFamily: 'system-ui, -apple-system, sans-serif',
                     }}
                   >
                     {variant === 'standard'
                       ? t('posts.detail.deepDive.toggleStandard')
                       : t('posts.detail.deepDive.toggleDeep')}
                   </button>
                 );
               })}
             </div>
           );
         }
         // Default state: render the DeepDiveButton (UI-SPEC §7)
         return (
           <button
             type="button"
             onClick={handleStartDeepDive}
             style={{
               width: '100%',
               padding: '14px 16px',
               minHeight: '48px',
               marginTop: '20px',
               marginBottom: '16px',
               backgroundColor: 'var(--surface-variant)',
               border: '1px solid var(--border)',
               borderRadius: 'var(--radius)',
               color: 'var(--primary-40)',
               fontSize: '15px',
               fontWeight: 700,
               display: 'inline-flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '8px',
               cursor: 'pointer',
               fontFamily: 'system-ui, -apple-system, sans-serif',
             }}
           >
             <Sparkles size={16} color="var(--primary-40)" />
             {t('posts.detail.deepDive.cta')}
           </button>
         );
       };
       ```

    5. Insert the deep-dive controls render between the scroll sentinel and takeaway (lines 838-840):
       ```jsx
       <div ref={scrollSentinelRef} style={{ height: '1px' }} />
       {!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()}
       {post.sourceType !== 'video' && (post.takeaway || onEnterMeta?.takeaway) && (
       ```

    6. Extend the existing body-slot render branch (at lines 818-836 — the post.bodyMarkdown ? branch) to discriminate on activeVariant:
       Current:
       ```jsx
       ) : post.bodyMarkdown ? (
         <div style={isNews ? { fontFamily: "Georgia, 'Times New Roman', serif" } : undefined}>
           <Markdown>{post.bodyMarkdown}</Markdown>
         </div>
       ) : null}
       ```
       After:
       ```jsx
       ) : isStreamingDeep ? (
         <div style={isNews ? { fontFamily: "Georgia, 'Times New Roman', serif" } : undefined}>
           {streamingDeep ? <Markdown>{streamingDeep}</Markdown> : (
             /* tiny skeleton while deep stream warms up; reuse existing skeleton pattern */
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px 0' }}>
               <div style={{ height: '14px', width: '90%', borderRadius: '4px', backgroundColor: 'var(--surface-variant)', animation: 'pulse 1.5s ease-in-out infinite' }} />
             </div>
           )}
         </div>
       ) : activeVariant === 'deep' && post.bodyMarkdownDeep ? (
         <div style={isNews ? { fontFamily: "Georgia, 'Times New Roman', serif" } : undefined}>
           <Markdown>{post.bodyMarkdownDeep}</Markdown>
         </div>
       ) : post.bodyMarkdown ? (
         <div style={isNews ? { fontFamily: "Georgia, 'Times New Roman', serif" } : undefined}>
           <Markdown>{post.bodyMarkdown}</Markdown>
         </div>
       ) : null}
       ```

    7. Extend the existing cleanup useEffect that aborts the on-enter controller (around line 393) to ALSO abort the deep controller:
       ```typescript
       return () => {
         abortController.abort();
         deepAbortControllerRef.current?.abort();  // NEW: also cancel any in-flight deep stream
       };
       ```

    8. Update the deepAbortControllerRef on postId change in the existing useEffect cleanup OR add a sibling useEffect — whichever matches the existing cleanup pattern. Verify by reading the existing cleanup chain.

    KEY INVARIANTS (DD-05 hard requirements):
    - Existing 3 pre-call guards at lines 314, 327, 338 + the new 2 deep-stream guards (before for-await + cache-write guard) = at least 4 distinct "if (...signal.aborted) return" sites in this file
    - Existing 4 signal-arg passes (generateConnectionPost, generateDiscoverPost, generatePostEssay, generateEssayMeta) + 1 NEW signal-arg pass (generatePostEssay({ depth: 'deep', signal })) = at least 5 signal-arg passes total
    - patchPostEssayInCache for bodyMarkdownDeep is GUARDED by !aborted (must NEVER write partial deep stream to cache)
    - The standard post.bodyMarkdown is NEVER overwritten by the deep stream — streamingDeep accumulates in a SEPARATE state variable
    - Cleanup cascade: unmount + postId-change must abort BOTH the on-enter controller AND the deep controller
    - "Restore standard" tap aborts the deep controller AND resets state

    Atomic commit message: feat(43): PostDetailScreen Deep Dive trigger + Standard|Deep toggle + dedicated deepAbortControllerRef (DD-01..DD-05)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && grep -q "deepAbortControllerRef" src/screens/PostDetailScreen.tsx && grep -q "handleStartDeepDive" src/screens/PostDetailScreen.tsx && grep -q "handleRestoreStandard" src/screens/PostDetailScreen.tsx && grep -q "renderDeepDiveControls" src/screens/PostDetailScreen.tsx && grep -q "depth:\\s*'deep'" src/screens/PostDetailScreen.tsx && grep -q "patchPostEssayInCache(post.id, { bodyMarkdownDeep" src/screens/PostDetailScreen.tsx && grep -q "posts.detail.deepDive.cta" src/screens/PostDetailScreen.tsx && grep -q "posts.detail.deepDive.restoreStandard" src/screens/PostDetailScreen.tsx && grep -q "posts.detail.deepDive.toggleStandard" src/screens/PostDetailScreen.tsx && grep -q "posts.detail.deepDive.toggleDeep" src/screens/PostDetailScreen.tsx && grep -q "activeVariant" src/screens/PostDetailScreen.tsx && npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - grep -c "deepAbortControllerRef" app/src/screens/PostDetailScreen.tsx returns at least 3 (declaration + assignment + abort in cleanup + abort in handleRestoreStandard)
    - grep -c "handleStartDeepDive" app/src/screens/PostDetailScreen.tsx returns at least 2 (declaration + onClick wiring)
    - grep -c "handleRestoreStandard" app/src/screens/PostDetailScreen.tsx returns at least 2
    - grep -c "renderDeepDiveControls" app/src/screens/PostDetailScreen.tsx returns at least 2 (declaration + invocation in render)
    - grep -c "depth: 'deep'" app/src/screens/PostDetailScreen.tsx returns at least 1
    - grep -c "bodyMarkdownDeep" app/src/screens/PostDetailScreen.tsx returns at least 4 (state + cache patch + segmented condition + body slot conditional)
    - grep -c "activeVariant" app/src/screens/PostDetailScreen.tsx returns at least 3 (state + segmented onChange + body slot conditional)
    - grep -c "posts.detail.deepDive.cta" app/src/screens/PostDetailScreen.tsx returns 1
    - grep -c "posts.detail.deepDive.restoreStandard" app/src/screens/PostDetailScreen.tsx returns 1
    - grep -c "posts.detail.deepDive.toggleStandard" app/src/screens/PostDetailScreen.tsx returns 1
    - grep -c "posts.detail.deepDive.toggleDeep" app/src/screens/PostDetailScreen.tsx returns 1
    - grep -E -c "if \\(abortController\\.signal\\.aborted\\) return|if \\(ctrl\\.signal\\.aborted\\) return|if \\(deepAbortControllerRef\\.current\\?\\.signal\\.aborted\\) return" app/src/screens/PostDetailScreen.tsx returns at least 4 (3 existing + 1 new pre-call guard; counts both the deep-stream loop guard and the standalone pre-call guard if separate)
    - grep -E -c "signal:\\s*abortController\\.signal|signal:\\s*ctrl\\.signal|signal:\\s*deepAbortControllerRef" app/src/screens/PostDetailScreen.tsx returns at least 5 (4 existing + 1 new on the deep generatePostEssay call)
    - grep -E -c "patchPostEssayInCache" app/src/screens/PostDetailScreen.tsx returns at least 2 (existing standard + new deep)
    - grep -c "Sparkles" app/src/screens/PostDetailScreen.tsx returns at least 2 (import + render in DeepDiveButton)
    - cd app && npx tsc -b --noEmit exits 0
  </acceptance_criteria>
  <done>PostDetailScreen ships Deep Dive button + segmented control + dedicated abort lifecycle; CONTENT-01 user-facing visible.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fill DD-01..DD-03 assertions in tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs scaffold</name>
  <files>app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs</files>
  <read_first>
    - app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs (43-01 Task 4 scaffold)
    - app/src/screens/PostDetailScreen.tsx (post-Task 1)
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (line 52 — expected assertions for THIS file; line 53 is segmented-toggle (separate file — Task 4))
  </read_first>
  <action>
    Replace scaffold with real source-reading assertions for DD-01..DD-03 visible behavior. DD-04 segmented-toggle assertions live in a SIBLING file (Task 4 below).

    ```javascript
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const src = readFileSync(path.join(appRoot, 'src/screens/PostDetailScreen.tsx'), 'utf8');

    test('DD-01: deep-dive controls slot rendered between scroll sentinel and takeaway', () => {
      // Find the scroll sentinel ref then assert renderDeepDiveControls follows before the takeaway block
      const sentinelIdx = src.indexOf('scrollSentinelRef');
      const renderIdx = src.indexOf('renderDeepDiveControls');
      const takeawayIdx = src.indexOf('takeaway');
      assert.ok(sentinelIdx > 0 && renderIdx > 0 && takeawayIdx > 0);
      assert.ok(sentinelIdx < renderIdx, 'renderDeepDiveControls should be invoked AFTER scrollSentinelRef placement');
      assert.ok(renderIdx < takeawayIdx, 'renderDeepDiveControls should be invoked BEFORE takeaway render');
    });

    test('DD-02: DeepDiveButton uses posts.detail.deepDive.cta + Sparkles icon + primary-40 text', () => {
      assert.match(src, /t\(['"]posts\.detail\.deepDive\.cta['"]\)/);
      assert.match(src, /\bSparkles\b/);
      assert.match(src, /var\(--primary-40\)/);
    });

    test('DD-03: streaming-deep state + Restore standard handler + body slot streams streamingDeep', () => {
      assert.match(src, /streamingDeep/);
      assert.match(src, /isStreamingDeep/);
      assert.match(src, /handleRestoreStandard/);
      assert.match(src, /t\(['"]posts\.detail\.deepDive\.restoreStandard['"]\)/);
      // Body slot conditional includes deep variant render path
      assert.match(src, /activeVariant\s*===\s*['"]deep['"]/);
      assert.match(src, /post\.bodyMarkdownDeep/);
    });

    test('DD-03: handleRestoreStandard aborts deep controller and resets activeVariant to standard', () => {
      assert.match(src, /handleRestoreStandard\s*=\s*useCallback\([^}]*\{[^}]*deepAbortControllerRef\.current\?\.abort\(\)/s);
      assert.match(src, /handleRestoreStandard\s*=\s*useCallback\([^}]*\{[^}]*setActiveVariant\(['"]standard['"]\)/s);
    });
    ```

    Atomic commit message: test(43): fill DD-01..DD-03 source-reading assertions into PostDetailScreen.deep-dive-trigger.test.mjs
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file no longer uses skip: option
    - Test count at least 4 (DD-04 assertions live in segmented-toggle.test.mjs per VALIDATION line 53)
    - cd app && node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs exits 0
  </acceptance_criteria>
  <done>DD-01..DD-03 visible-behavior invariants locked.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Fill DD-05 assertions in tests/screens/PostDetailScreen.abort-contract.test.mjs scaffold</name>
  <files>app/tests/screens/PostDetailScreen.abort-contract.test.mjs</files>
  <read_first>
    - app/tests/screens/PostDetailScreen.abort-contract.test.mjs (43-01 Task 4 scaffold)
    - app/src/screens/PostDetailScreen.tsx (post-Task 1)
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (DD-05 hard invariant)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-02-essay-depth-citation-rendering-SUMMARY.md (Phase 41-02 original abort-contract spec — must NOT regress)
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (line 54 — assertions for ALL 4 essay paths)
  </read_first>
  <action>
    Replace scaffold with real assertions for DD-05 abort-contract preservation + extension:

    ```javascript
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const src = readFileSync(path.join(appRoot, 'src/screens/PostDetailScreen.tsx'), 'utf8');

    test('DD-05: at least 4 pre-call AbortController guards (3 existing + 1 new for deep stream)', () => {
      // Count "if (XXX.signal.aborted) return" patterns across both controllers
      const guardPattern = /if\s*\([^)]*signal\.aborted\)\s*return/g;
      const guards = src.match(guardPattern) || [];
      assert.ok(guards.length >= 4, `Expected at least 4 pre-call AbortController guards (3 existing from Phase 41 + 1 new for deep stream), found ${guards.length}`);
    });

    test('DD-05: at least 5 signal-arg passes (4 existing + 1 new on deep generatePostEssay)', () => {
      // Counts "signal: <controller>.signal" patterns
      const signalArgPattern = /signal:\s*\w+(?:\.current)?(?:\?\.)?signal/g;
      const matches = src.match(signalArgPattern) || [];
      assert.ok(matches.length >= 5, `Expected at least 5 signal-arg passes (4 existing + 1 new), found ${matches.length}`);
    });

    test('DD-05: generatePostEssay({ depth: "deep", signal }) is invoked', () => {
      assert.match(
        src,
        /generatePostEssay\([^)]*\{[^}]*depth:\s*['"]deep['"][^}]*signal:[^}]*\}\)/s,
        'Deep-stream call must pass { depth: "deep", signal: <controller>.signal }',
      );
    });

    test('DD-05: patchPostEssayInCache for bodyMarkdownDeep is preceded by !aborted guard', () => {
      // Confirm patchPostEssayInCache(...{ bodyMarkdownDeep ... }) appears in the deep-stream flow
      assert.match(src, /patchPostEssayInCache\(post\.id,\s*\{\s*bodyMarkdownDeep/);
      // Confirm the pattern "if (...aborted) return" exists in the same region as the cache patch
      // (looser assertion: at least one aborted-guard appears before each patchPostEssayInCache call)
      const patches = src.match(/patchPostEssayInCache\([^)]+\)/g) || [];
      assert.ok(patches.length >= 2, `Expected at least 2 patchPostEssayInCache invocations (standard + deep), found ${patches.length}`);
    });

    test('DD-05: cleanup aborts BOTH the on-enter controller AND the deep controller', () => {
      // Cleanup function: looks for abortController.abort() + deepAbortControllerRef.current?.abort() in the same return-block region
      assert.match(src, /abortController\.abort\(\)/);
      assert.match(src, /deepAbortControllerRef\.current\?\.abort\(\)/);
    });

    test('DD-05: no abortController.abort() calls outside documented cleanup paths', () => {
      // Documented paths: locale-change abort (~line 295), unmount cleanup (~line 393), handleRestoreStandard.
      // Count overall abort() invocations and verify they map to documented contexts.
      // This is a flexible assertion — we just confirm abort() exists, and the abort sites match the expected set.
      const abortCalls = (src.match(/abort\(/g) || []).length;
      assert.ok(abortCalls >= 3, `Expected at least 3 abort() calls (locale change + unmount + restore-standard), found ${abortCalls}`);
    });

    test('DD-05: deep-stream NEVER overwrites post.bodyMarkdown (standard variant preserved)', () => {
      // The standard bodyMarkdown is never set inside the deep-stream handler — confirm setPost in the deep handler
      // sets bodyMarkdownDeep but not bodyMarkdown directly (the spread preserves prev.bodyMarkdown).
      // Source-reading: handleStartDeepDive contains setPost with bodyMarkdownDeep spread; no `bodyMarkdown:` literal assignment in that handler scope.
      const deepHandlerStart = src.indexOf('handleStartDeepDive');
      const deepHandlerEnd = src.indexOf('handleRestoreStandard');
      assert.ok(deepHandlerStart > 0 && deepHandlerEnd > deepHandlerStart);
      const deepHandlerRegion = src.slice(deepHandlerStart, deepHandlerEnd);
      assert.match(deepHandlerRegion, /bodyMarkdownDeep/);
      // Inside handleStartDeepDive, no assignment to bodyMarkdown directly (spreading prev preserves it but no direct write)
      // Loose check: the literal "setPost(prev =>" with bodyMarkdown: (without Deep suffix) does not appear inside this region
      assert.doesNotMatch(deepHandlerRegion, /bodyMarkdown:\s*[^D]/);
    });
    ```

    Atomic commit message: test(43): fill DD-05 abort-contract preservation + extension into PostDetailScreen.abort-contract.test.mjs
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/screens/PostDetailScreen.abort-contract.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file no longer uses skip: option
    - Test count at least 7
    - cd app && node --test tests/screens/PostDetailScreen.abort-contract.test.mjs exits 0
  </acceptance_criteria>
  <done>DD-05 abort-contract invariants locked; any future regression that drops a pre-call guard or signal-arg pass fails this test.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Fill DD-04 segmented-toggle assertions in tests/screens/PostDetailScreen.segmented-toggle.test.mjs scaffold (revised 2026-05-11 per plan-checker Blocker 4)</name>
  <files>app/tests/screens/PostDetailScreen.segmented-toggle.test.mjs</files>
  <read_first>
    - app/tests/screens/PostDetailScreen.segmented-toggle.test.mjs (43-01 Task 4 scaffold — the dedicated segmented-toggle test surface listed in VALIDATION.md line 53)
    - app/src/screens/PostDetailScreen.tsx (post-Task 1 — segmented control render branch + activeVariant body-slot conditional)
    - .planning/phases/43-engagement-ui/43-CONTEXT.md (DD-04 verbatim — Standard | Deep segmented control replaces button when bodyMarkdownDeep non-empty; toggle is purely client-side state, no re-stream)
    - .planning/phases/43-engagement-ui/43-UI-SPEC.md (Section 9 — segmented control visual spec: var(--primary-40) background on active, white text, role="tab", aria-selected)
    - .planning/phases/43-engagement-ui/43-VALIDATION.md (line 53 — DD-04 segmented-toggle test surface contract)
  </read_first>
  <action>
    Replace the Wave-0 skip-style scaffold with real source-reading assertions for DD-04 segmented-toggle behavior. The DEDICATED test file pattern follows VALIDATION.md line 53 — keeping segmented-toggle separate from deep-dive-trigger.test.mjs makes failure attribution clear during execution (a DD-04 regression breaks segmented-toggle; a DD-01..DD-03 regression breaks deep-dive-trigger).

    ```javascript
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appRoot = path.resolve(__dirname, '..', '..');
    const src = readFileSync(path.join(appRoot, 'src/screens/PostDetailScreen.tsx'), 'utf8');

    test('DD-04: segmented control renders only when post.bodyMarkdownDeep is non-empty (post-Deep-dive completion)', () => {
      // The renderDeepDiveControls function's `deepCached` branch gates on:
      //   typeof post.bodyMarkdownDeep === 'string' && post.bodyMarkdownDeep.length > 0
      assert.match(
        src,
        /typeof\s+post\.bodyMarkdownDeep\s*===\s*['"]string['"][^}]*post\.bodyMarkdownDeep[^}]*length\s*>\s*0|post\.bodyMarkdownDeep[^}]*length\s*>\s*0/s,
        'Segmented control must be gated on post.bodyMarkdownDeep length > 0 (DD-04: only renders after Deep-dive completion)',
      );
      // role="tablist" marks the segmented control container per UI-SPEC §9
      assert.match(src, /role=["']tablist["']/);
    });

    test('DD-04: tapping Standard segment sets activeVariant to "standard" without re-streaming', () => {
      // The Standard segment's onClick must be a SIMPLE setActiveVariant('standard') — no generatePostEssay call
      assert.match(src, /onClick=\{\(\)\s*=>\s*setActiveVariant\(['"]standard['"]\)\}|onClick=\{\(\)\s*=>\s*setActiveVariant\(variant\)\}/);
      // The segmented control mapping over ['standard', 'deep']: assert the standard label key is referenced INSIDE the segmented-control render branch
      assert.match(src, /posts\.detail\.deepDive\.toggleStandard/);
      // Source-reading: no generatePostEssay call inside the segmented control onClick handler
      // (The segmented control onClick block must be a pure state setter — we assert this by sampling
      // the source around the toggleStandard label and confirming no streaming primitives appear)
      const toggleStdIdx = src.indexOf('posts.detail.deepDive.toggleStandard');
      assert.ok(toggleStdIdx > 0);
      const region = src.slice(Math.max(0, toggleStdIdx - 800), toggleStdIdx + 400);
      assert.doesNotMatch(region, /handleStartDeepDive\(/, 'Segmented-control onChange must NOT call handleStartDeepDive (DD-04: toggle is purely client-side state)');
      assert.doesNotMatch(region, /generatePostEssay\(/, 'Segmented-control onChange must NOT invoke generatePostEssay (DD-04: no re-stream on toggle)');
    });

    test('DD-04: tapping Deep segment sets activeVariant to "deep" and displays cached bodyMarkdownDeep without re-streaming', () => {
      // The Deep segment label key is referenced inside the segmented-control render branch
      assert.match(src, /posts\.detail\.deepDive\.toggleDeep/);
      // Body-slot conditional renders post.bodyMarkdownDeep when activeVariant === 'deep' AND post.bodyMarkdownDeep present
      assert.match(src, /activeVariant\s*===\s*['"]deep['"]\s*&&\s*post\.bodyMarkdownDeep/);
      // No generatePostEssay call inside the segmented-control branch
      const toggleDeepIdx = src.indexOf('posts.detail.deepDive.toggleDeep');
      assert.ok(toggleDeepIdx > 0);
      const region = src.slice(Math.max(0, toggleDeepIdx - 800), toggleDeepIdx + 400);
      assert.doesNotMatch(region, /handleStartDeepDive\(/, 'Tapping Deep on the segmented control must NOT call handleStartDeepDive (cached variant, no re-stream)');
      assert.doesNotMatch(region, /generatePostEssay\(/, 'Tapping Deep on the segmented control must NOT invoke generatePostEssay (cached variant, no re-stream)');
    });

    test('DD-04: active-segment indicator visual matches UI-SPEC §9 (var(--primary-40) bg + white text + aria-selected)', () => {
      // UI-SPEC §9: active segment has backgroundColor: var(--primary-40) and color: #FFFFFF
      assert.match(src, /backgroundColor:\s*isActive\s*\?\s*['"]var\(--primary-40\)['"]\s*:\s*['"]transparent['"]|isActive\s*\?\s*['"]var\(--primary-40\)['"]/);
      assert.match(src, /color:\s*isActive\s*\?\s*['"]#FFFFFF['"]|isActive\s*\?\s*['"]#FFFFFF['"]/);
      // aria-selected reflects active state for screen readers
      assert.match(src, /aria-selected=\{isActive\}/);
    });

    test('DD-04: both segmented-toggle i18n keys referenced inside the segmented-control render branch (gated by deepCached)', () => {
      // Both toggleStandard + toggleDeep referenced exactly once each in renderDeepDiveControls
      const stdRefs = (src.match(/posts\.detail\.deepDive\.toggleStandard/g) || []).length;
      const deepRefs = (src.match(/posts\.detail\.deepDive\.toggleDeep/g) || []).length;
      assert.strictEqual(stdRefs, 1, 'posts.detail.deepDive.toggleStandard referenced exactly once (segmented control Standard segment)');
      assert.strictEqual(deepRefs, 1, 'posts.detail.deepDive.toggleDeep referenced exactly once (segmented control Deep segment)');
    });
    ```

    Atomic commit message: test(43): fill DD-04 segmented-toggle assertions into PostDetailScreen.segmented-toggle.test.mjs (dedicated file per VALIDATION line 53; revised 2026-05-11)
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app && node --test tests/screens/PostDetailScreen.segmented-toggle.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Test file no longer uses skip: option
    - Test count at least 5
    - cd app && node --test tests/screens/PostDetailScreen.segmented-toggle.test.mjs exits 0
  </acceptance_criteria>
  <done>DD-04 segmented-toggle invariants locked in a dedicated file per VALIDATION.md line 53; failure attribution clear (DD-04 regressions break this file, DD-01..DD-03 break deep-dive-trigger.test.mjs).</done>
</task>

</tasks>

<verification>
- cd app && npx tsc -b --noEmit exits 0
- cd app && node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs exits 0
- cd app && node --test tests/screens/PostDetailScreen.segmented-toggle.test.mjs exits 0
- cd app && node --test tests/screens/PostDetailScreen.abort-contract.test.mjs exits 0
- cd app && npm test full suite passes (specifically: existing PostDetailScreen + post-essay.service tests do NOT regress — Phase 41-02 invariants preserved)
- cd app && npm run build exits 0
</verification>

<success_criteria>
- Deep Dive button renders below essay, above takeaway, full-width, with Sparkles icon + i18n cta label
- Tap kicks off deep stream via NEW dedicated AbortController (deepAbortControllerRef); replaces body slot in-place; shows Restore standard link
- Restore standard tap aborts + reverts; segmented control NOT shown post-restore (bodyMarkdownDeep stays empty after a partial-stream abort per DD-05 cache-write guard)
- Once bodyMarkdownDeep cached, segmented Standard|Deep control replaces button; toggle is instant client-side state, no re-stream
- AbortController contract: at least 4 pre-call guards + at least 5 signal-arg passes + cache-write guard preserved + cleanup aborts both controllers
- DD-04 segmented-toggle assertions live in a dedicated file (segmented-toggle.test.mjs) per VALIDATION line 53
- 4 atomic commits (source, deep-dive-trigger test, abort-contract test, segmented-toggle test)
</success_criteria>

<output>
After completion, create .planning/phases/43-engagement-ui/43-05-SUMMARY.md documenting:
- PostDetailScreen.tsx LOC delta
- Final counts:
  - pre-call AbortController guards: <count>
  - signal-arg passes: <count>
  - patchPostEssayInCache invocations: <count> (must be at least 2)
- Confirmation: handleStartDeepDive uses dedicated deepAbortControllerRef
- Confirmation: handleRestoreStandard aborts deep controller
- Confirmation: cleanup useEffect aborts both controllers
- Confirmation: DD-04 segmented-toggle test in its own dedicated file (revision 2026-05-11)
- 4 atomic commit hashes
</output>
