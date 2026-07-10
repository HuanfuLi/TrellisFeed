# QuestionTrace — Claude Instructions

Project root instructions for Claude Code agents working on this repository.

> **Identity & lineage:** This is **QuestionTrace**, a research prototype for studying post-centered graph-memory learning feeds. It is a fork of the Trellis product prototype (renamed EchoLearn → Trellis 2026-05-07; forked as TrellisFeed_Research 2026-07-08; converted to QuestionTrace 2026-07-09). The fork is independent and never merges back.
>
> **Naming residue (temporary):** durable storage still uses `IDB_NAME = 'trellis'` and `trellis_*` localStorage keys, and in-app branding still says "Trellis". The full in-app rebrand + storage-key rename is **scheduled as ROADMAP Phase 1** (no data migration — operator confirmed nothing in storage needs preserving). Until that phase runs, don't rename keys piecemeal. The native bundle identifiers (`com.huanfuli.trellis` iOS, `com.trellis.app` Android) stay unchanged even after the rebrand — signing/data constraints, see the iOS section below.

## Authority documents

1. **`docs/research_system_design.md`** — THE implementation guide (v2.0). Feature questions, schemas, algorithms, study design all resolve here.
2. **`docs/SCOPE.md`** — quick in/out-of-scope contract, including framing language rules.
3. **`docs/prune_report.md`** — what was removed from the product prototype on 2026-07-09 and why.
4. **`.planning/ROADMAP.md`** — the live GSD roadmap: 5 coarse phases (0–4), locked, no finer splits. Phase 0 (rename/scope/prune) done 2026-07-09; next is Phase 1 (rebrand + research shell hardening). Root `ROADMAP.md` is only a human-readable summary. The product-era Trellis planning history is archived at `docs/planning_history/trellis/` — historical reference only, never live state.

## Project Overview

QuestionTrace is a mobile field-study system: participants browse a **curated pool of real multimedia posts**, ask AI questions **under posts**, and (experimental condition only) those questions become graph-memory traces that orchestrate the feed via Continue / Deepen / Contrast / Bridge / Echo strategies. Stack: React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + Capacitor 8. Local-first. Multi-provider LLM (OpenAI, Claude, Gemini, local endpoints), user-supplied keys.

**Working directory for the app:** `app/`

**Test framework:** Node.js built-in `node --test` (`npm test` from `app/`). Gates: `npm test`, `npm run lint`, `npm run build` (includes `tsc -b`).

### Research-scope hard rules

1. **Never resurrect pruned features** (design doc §15.3): podcast, flashcards/SRS, graph/mindmap UI, planner + trellis gamification/credits, global free-form chat, collections, token analytics, live web/news/YouTube search in the participant app, AI-generated posts as primary content. If a task seems to need one, stop and check `docs/SCOPE.md` first.
2. **Both study conditions get "Ask about this post."** The ONLY isolated variable is graph-memory feed orchestration (§6.6). Never gate Q&A features by condition.
3. **The control ranker must never consume user question history** (§11.7). Unit tests must enforce this once the rankers exist (§12.3).
4. **Framing language** (§22): "post-centered graph-memory feed orchestration", not "AI learning feed"; "contextual post-level Q&A as learner trace collection", not "AI tutor"; "latent learner memory graph", not "mind map".
5. **Transitional state:** the current home feed still generates AI posts (styles `image` / `text-art` / `suggestion`, weights 0.15/0.75/0.10 in `style-assignment.ts`) as a temporary shell. It gets replaced by the frozen content pool in Phases 2–3 — don't invest in polishing it, and don't build new features on top of it.

## Style Conventions

- **Inline styles with CSS variables** (NOT Tailwind classes for most UI)
- Key CSS vars: `--primary-40`, `--surface`, `--surface-variant`, `--muted-foreground`, `--radius-xl`, `--shadow-1/2/3`
- Services return `ServiceResult<T> = { success, data?, error? }`
- localStorage for all user preferences via `settingsService`
- Event bus (`src/lib/event-bus.ts`) for cross-screen notifications
- **Settings sub-page navigation:** SettingsScreen is a menu with 4 sub-pages at `/settings/{ai,content,features,data}`. Sub-screens live in `src/screens/settings/`; shared components in `settings/SettingsShared.tsx`.

## Navigation shape (post-prune)

Two top-level swipe tabs: **Home** and **Settings** (`SwipeTabContainer` is a 2-slot × 100vw strip). Sub-routes: `/posts/:id`, `/saved`, `/settings/{ai,content,features,data}`, `/onboarding`. Everything else was removed — see `docs/prune_report.md` for the exact route/service/component inventory.

---

## Agent Delegation Policy (operator preference — applies to every task)

Claude (Opus / Fable) is the **planner and reviewer**, not the primary implementer. Spend Claude tokens on planning, discussion, architecture, and judgment. Hand off bulk execution to the external CLI agents below via `Bash`, then review what comes back.

### Routing table

| Work type | Delegate to | Command | Why |
|---|---|---|---|
| Mass reads (codebase sweeps, docs, images), UI-SPEC generation, other frontend/reading tasks | **Antigravity** (Gemini 3.1 Pro) | `agy` | Strong at reading and frontend/visual work; weak reasoning |
| Complex coding, refactors, research, debugging | **Codex** (GPT) | `codex --yolo` | Strong reasoning and coding; weak UX logic and aesthetics |
| Planning, discussion, design decisions, final review | **Claude** (this agent) | — | Best overall judgment; keep tokens here |

### Hard rules

1. **Antigravity must NEVER mutate code.** Gemini models are unreliable at coding. Use `agy` for read-only analysis and document generation only. If a task requires edits, route it to Codex or do it yourself.
2. **Antigravity must use Gemini 3.1 Pro.** Never a Flash model (e.g. Gemini 3.5 Flash).
3. **Claude reviews everything either agent produces** before it lands. Codex writes correct-but-inelegant code and has poor UX instincts; Antigravity's prose and specs need a factual check.
4. **Avoid implementing directly in Claude** when a delegate can do it. Reserve Claude edits for small, load-bearing, or judgment-heavy changes (anything in the "load-bearing" sections of this file).
5. **When Codex hit usage limit mid-execution**, do: logout, record session ID, stop and report session ID to user, wait for user to switch account. After user finished, resume Codex work using command `codex --yolo resume <SESSION_ID>` and nodge Codex to continue. **When Codex hit usage limit right after a fresh session start:** Stop and prompt user to switch Codex account.

---

## Heavy stores live in IndexedDB — never touch the retired localStorage keys (load-bearing)

Phase 55 (pre-fork) moved every heavy store to IndexedDB. Legacy keys listed in `LEGACY_HEAVY_KEYS` (`db.service.ts`) are **deleted at every boot** by `clearLegacyHeavyLocalStorageKeys()`, called from `App.tsx` after hydration. Any direct `localStorage` read of one returns null; any direct write is discarded on next launch.

### Rules

1. **All question mutations go through `questionService`.** Use `insertNode()` for new anchor/cluster nodes and `replaceAll()` for bulk rebuilds — both write through to IndexedDB. Never write `trellis_questions` directly. `canonical-knowledge.service.ts` must not name that key at all; `tests/services/anchor-persistence.test.mjs` enforces this.
2. **Generated post bodies are costly assets.** `patchPostEssayInCache` persists via `conceptFeedService.patchPost` + `postHistoryService.patchPost` — both, unconditionally. Post-history is the only durable full-content store and keeps a body openable from `/saved` and history after the midnight daily-cache rejection.
3. **`LocalStorageBackend` and `IndexedDBBackend` must implement the same SQL subset.** They are the last-resort fallback and the real backend; a statement one handles and the other silently ignores is a live data bug.

### Testing this area

The Node suite is a **false-green risk here** — much of it reads source text rather than executing writes. In Node there is no `indexedDB`, so `db.service` falls back to `LocalStorageBackend`, a real backend behind the same `dbQuery`/`dbExecute` seam: assert durability *through `dbQuery`*, not through the in-memory mirror. See `tests/services/anchor-persistence.test.mjs`. A source-reading test that asserts a retired key is *present* actively pins the bug in place. Persistence/platform changes additionally need in-browser UAT — the Node suite has shipped false-greens here before.

---

## Concept Feed Generation Pipeline (load-bearing — read before touching `concept-feed.service.ts` or `post-queue.service.ts`)

> Transitional subsystem: serves AI-generated placeholder posts until the frozen content pool replaces it (Phases 2–3). Its invariants still apply while it lives.

The home feed is driven by THREE LISTS in a strict pipeline. **Do not invent a fourth, do not collapse two into one, do not bypass any step.**

```
1. DAILY CONCEPT LIST  — anchor nodes (q.isAnchorNode === true). Post-prune: ALL
                          unexplored anchors are eligible (SM-2 due-date filtering
                          removed with the SRS system).
            │ derived from
            ▼
2. DERIVED LIST  — per concept: assign post style AND multiplicity. APPEND-ONLY
                   when new questions arrive (rebuild loses cycle position).
                   postQueueService.appendToDerivedList(ids[]) — dedups by
                   conceptId. Removal: on read (CONCEPT_EXPLORED →
                   dailyReadService.getExploredAnchors()); the walker
                   (walkDerivedList) LAZILY skips explored ids at walk time;
                   physical splice would corrupt cyclePosition.
            │ feeds
            ▼
3. QUEUE  — cyclic walker over the derived list, maintains CYCLE POSITION.
            Swipe-for-more pops → walker advances → refills. Empty derived list
            (all read) → "No more posts" state is correct, not an error.
```

### Numeric defaults

- `MAX_QUEUE_SIZE` = **32**, `REFILL_THRESHOLD` = **24** (`post-queue.service.ts`), paired with `walkDerivedList(24, ...)` in `concept-feed.service.ts`.
- Posts served per swipe-for-more: **8** (`loadNextBatch` default `limit = 8`, `generateMorePosts` default `count = 8`).
- Refill mutex: `createPromiseMutex()` (`refill-mutex.ts`) wraps `refillQueue`'s body; in-flight callers await the same Promise; `try/finally` clears the in-flight reference on success AND error. Tests at `tests/services/refill-mutex.test.mjs`.
- Style weights: `style-assignment.ts` — `image` 0.15, `text-art` 0.75, `suggestion` 0.10; stratified largest-remainder + Fisher–Yates sampling (±1 of `round(N×weight)` per style).
- Walker termination guard: `maxSteps = Math.max(count * 2, len)`. **Do not regress to `len * 2`** (Phase 36 GAP-B bug). Tests at `derived-list.test.mjs` + `refill-queue-integration.test.mjs`.
- Yesterday-queue snapshot in IndexedDB under `SQLITE_ROW_ID_YESTERDAY`; new-day rehydration re-populates today's queue from yesterday's UNSERVED posts, then `spreadByConcept` BEFORE `spreadByStyle` (`feed-spread.ts`). `loadCache()` returns `null` on date mismatch so yesterday's SERVED posts don't render across midnight.
- **Always-mounted screens must explicitly re-read service state on navigation.** Home and Settings are always-mounted slots in `SwipeTabContainer`; `useState(() => svc.get())` initializers fire once at boot. Any screen reading state that can change while backgrounded MUST re-read in a `location.pathname` effect — HomeScreen.tsx has the canonical pattern. Related: a dev affordance simulating a wall-clock event (Force-New-Day) must call every service `reset()` AND mutate every date-stamped storage key.

### When in doubt

Derived list is **append-only** (grows on new question, shrinks on read). Queue is **cyclic** over that list. Implement what the design says.

---

## Feed cold start — an empty feed is not an error (load-bearing)

`getDailyPosts()` returns `[]` on a cold start **by design**: refill runs in the background and can take minutes against a local endpoint. `refillQueue` emits **`FEED_REFILL_COMPLETED`** `{ added, error? }` exactly once per cycle that actually runs.

### Rules

1. **Never treat an empty `getDailyPosts()` result as an error.** Stay in the loading state; `FEED_REFILL_COMPLETED` decides.
2. **Emit from inside the mutex body, in a `finally`** — covers the "nothing to do" early returns; emitting outside the mutex fires once per concurrent caller.
3. **`attempted > 0 && generated === 0` is the only signal of a broken API key.** `attempted === 0` is a normal empty state.
4. **The HomeScreen subscriber must no-op when the feed already has posts** (else: infinite refill loop).
5. No timer-based recovery. The event is the signal.

Tests: `tests/screens/HomeScreen.empty-questions-no-error.test.mjs`.

---

## PostDetail exploration detectors (load-bearing)

`PostDetailScreen.tsx` owns the CONCEPT_EXPLORED signals: **A** — scroll-70% IntersectionObserver sentinel; **B** — 30s dwell timer; **C** — Q&A follow-up submit. (Detector D / YouTube postMessage died with the video pipeline.) Don't introduce new event types for exploration — reuse `CONCEPT_EXPLORED`, one signal per semantic event. These detectors are also the seed of the study's interaction logging (design doc §9.8/§14) — extend, don't fork.

---

## Header positioning (load-bearing, do not regress)

The `Header` component (`app/src/components/ui/Header.tsx`) auto-portals based on context:

- **Inside `SwipeTabContext`** (Home, Settings) → renders **in-tree**, anchored to the slot's `transform: translateZ(0)` containing block.
- **Outside `SwipeTabContext`** (PostDetail, settings sub-pages, Saved) → renders via **`createPortal(headerNode, document.body)`** — immune to ancestor `transform`/`overflow`/`will-change`/`filter`/`contain`.

**Why:** `position: fixed` headers inside `overflow: auto` ancestors flicker on Android Chromium WebView. Recurred across 6+ commits pre-fork; the portal-vs-in-tree split makes regression structurally impossible.

### Rules

1. **Don't add `transform`/`will-change`/`filter`/`contain`/`perspective`** to any ancestor of an in-tree Header.
2. **Don't render a Header inside a screen that's both always-mounted AND always-visible.**
3. **Don't move `Header.tsx` out of the portal-vs-in-tree pattern** ("always portal" makes top-level Headers globally visible; "always in-tree" reintroduces sub-screen flicker).

---

## iOS device build, gestures, and app assets (load-bearing)

### WKWebView cancels a touch sequence if you preventDefault the first touchmove

`HomeScreen.tsx`'s pull-to-load gesture must resolve direction over `DIRECTION_SLOP` (4px) before claiming the gesture. **Never `preventDefault()` a touchmove before you know the gesture is yours** — on iOS it kills native scrolling for the entire touch. Android tolerating it is not evidence.

### Back-swipe is commit-on-release, not a drag

`App.tsx`'s sub-screen overlay detects a left-edge touch (28px zone) travelling 70px rightward, then `navigate(-1)`. **Don't convert to a finger-following drag** — sub-screen Headers portal to `document.body` and would not move with the overlay.

### `assets/icon.png` and `assets/icon-foreground.png` MUST differ

`icon.png`: full-bleed, RGB (iOS rejects alpha; iOS applies no zoom). `icon-foreground.png`: ~25% inset (Android adaptive launcher zooms ~1.5×). A single padded source ships a shrunken iOS icon. **Don't edit `ios/App/App/Assets.xcassets/` directly** — `npx capacitor-assets generate` reverts it; fix the source. `assets/splash.png` + `splash-dark.png` must exist or the tool synthesizes placeholders. Delete the stray top-level `icons/` dir the tool emits.

### Signing

`PRODUCT_BUNDLE_IDENTIFIER = com.huanfuli.trellis` (iOS), `DEVELOPMENT_TEAM = ZW465WJST3` — correct despite the keychain identity reading `SH8YLS6UMQ` (**don't "fix" the team**; that team has no Xcode account). Android `applicationId` stays `com.trellis.app` — renaming orphans the installed app's data. Bundle id is **asymmetric across platforms by design**.

---

## ChatInput flex shrink (load-bearing)

`app/src/components/ChatInput.tsx`: the text input MUST keep `minWidth: 0` alongside `flex: 1`, or Android WebView refuses to shrink it and the Send button overflows. `tests/components/ChatInput.flex-shrink.test.mjs` enforces. Don't grow ChatInput buttons past 44px without re-checking the overflow math.

---

## Root overflow clip — both axes (load-bearing)

`html, body { overflow: hidden }` is load-bearing on BOTH axes; every screen owns its own `overflow: auto` container.

**Horizontal:** the SwipeTabContainer strip is 2 slots × 100vw; without the clip the document scrolls horizontally and Android keyboard-focus `scrollIntoView` drifts the app. **Vertical:** `body { min-height: 100vh }` doesn't shrink with the keyboard; body becoming scrollable creates a second scroll container that breaks input positioning.

Three layers: (1) `html, body { overflow: hidden }` in `index.css`; (2) `overflowX: 'hidden'` on the App root div; (3) `document.scrollingElement.scrollLeft = 0` in `SwipeTabContainer.onFocusOut`. `tests/layout/root-horizontal-clip.test.mjs` enforces all three. **Never rely on body scroll** — no `window.scrollTo` / `document.body.scrollTop`.

## SwipeTabContainer resize + keyboard (load-bearing)

1. **`resync()` gates on width change** — returns early when `getScreenWidth()` equals `screenWidthRef.current`. Height-only resizes (keyboard) must be no-ops. `tests/components/SwipeTabContainer.resize-guard.test.mjs` enforces.
2. **Focus-out forces a re-snap** (deferred one frame) AND resets `scrollLeft`.
3. **Don't install `@capacitor/keyboard` with `resize: 'none'`** — users rely on `adjustResize`.

---

## Event bus — unified GRAPH_UPDATED

There is **ONE event for graph mutations**: `GRAPH_UPDATED`, emitted by `commitClassificationResult` and any future code mutating anchors/clusters/questions. `useQuestions.ts` reloads from store on it (load-bearing — without this, fresh-install home stays empty after the first question). **Don't add a parallel event for the same semantic moment** — extend `GRAPH_UPDATED` with a payload field instead. (CLASSIFICATION_COMPLETED was deleted pre-fork for exactly this.)

---

## Anchor name normalization (guard at the data layer)

Anchor titles MUST be clean concept noun phrases, not question paraphrases. `canonical-knowledge.service.ts` enforces at two layers: prompt-side GOOD/BAD examples, and the defensive `normalizeAnchorName()` in `commitClassificationResult` BEFORE any anchor lookup or persistence (strips question prefixes, trailing clauses, truncates, title-cases). **Route any new classification path through `normalizeAnchorName()` before persistence.**

## Classification dedup — embedding pre-check (load-bearing)

`classifyAndAnchorIncremental` runs an **O(N_anchors) cosine pre-check BEFORE the tree descent**: embed the question, compare against every anchor's `embeddingVector`, reuse on cosine ≥ 0.82 (adopting its branch/cluster labels; zero LLM tokens on match). Opportunistic backfill embeds up to 8 legacy anchors per call. Both sides of anchor lookup go through `normalizeAnchorName`; case-insensitive NEW-coercion guards at steps 1–2.

Rules: don't remove the pre-check (`tests/services/classification-dedup.test.mjs` enforces order); keep threshold within [0.75, 0.95]; don't bypass normalization; tuning is empirical (0.78 if missed dedups, 0.85 if wrong merges).

---

## Question filter — RAW-ARGMAX gate + dual-vector scoring (load-bearing, security-critical)

`question-filter.service.ts:layer2Embedding` embeds **two query vectors**: raw content, and contextualized (`priorAnswer.slice(0, 240) + ' ' + content`; aliases the raw vector when no prior answer).

- **Malicious gate:** argmax over the **RAW** vectors only — malicious iff `rawMal ≥ floor && rawMal ≥ rawOff && rawMal ≥ rawOn`. Context NEVER enters this comparison (structural buried-payload defense). `floor` from `resolveMaliciousFloor`: validated per-model table, else auto-calibration clamped to **[0.35, 0.70]**.
- **Benign off/on split:** relative comparison on contextualized vectors — off-topic iff `ctxOff − ctxOn ≥ 0.02`, else on-topic.

### Rules

1. **Never let context enter the malicious decision.** Test 18d + the golden buried-payload fixture are the load-bearing guards.
2. **Don't reintroduce absolute off-topic/malicious cosine thresholds** (scale-invariance is the point). Never widen the [0.35, 0.70] floor clamp.
3. **Don't drop the contextVec → rawVec aliasing** when no priorAnswer.
4. New models: add a measured floor via `app/scripts/tune-decision-rule.mjs`. The anchor-dedup classifier is SEPARATE and keeps its own [0.78, 0.85] band.

This filter is also the mechanism behind the design doc's §7.6 gentle-redirect requirement for off-topic questions — extend it there, don't parallel it.

---

## Best practices (inherited lessons — avoid repeat mistakes)

1. **Search for dead code BEFORE assuming "two parallel paths."** Verify both ARE called before factoring out a shared helper.
2. **Tests must guard the LIVE code path**, not aspirational/dead code.
3. **`position: fixed` + `overflow: auto` + Android WebView = bug class.** Portal to body or rely on the slot's translateZ(0).
4. **Async classification needs an explicit re-read trigger** (event → store reload), or UI shows pre-async state forever.
5. **Posts deferring body generation to on-open MUST set `bodyMarkdown: ''`** — a "preview" snippet makes PostDetail skip the streamer.
6. **One signal per semantic event.**
7. **Don't ship hypothesis-only fixes for device-only bugs** — add diagnostic logs instead.
8. **When the operator says "I've explained this 5+ times," document in three places:** CLAUDE.md, auto-memory, inline comment at the load-bearing site.
9. **Delegated work needs a call-site sweep on review:** grep every reader/writer of anything retired; delegates orphan callers.
10. **Capacitor users cannot refresh.** UI must reactively re-read from services via event bus on every mutation.

---

## i18n Workflow

4 locales: **English** (canonical), **Simplified Chinese**, **Spanish**, **Japanese**. Bundles at `app/src/locales/{en,zh,es,ja}.json`; infra in `app/src/locales/index.ts`, `i18n.d.ts`, `app/src/lib/locale.ts`, `app/src/providers/llm/locale-directive.ts`.

### The ONE rule (no exceptions)

**Runtime LLM translation is PROHIBITED.** The app's `llmProvider` must NEVER be invoked to translate UI copy at runtime. `applyLocaleDirective` tells the LLM what locale to *respond* in during Q&A; it is not a translation mechanism.

### Adding a new UI string — EN-first workflow

Every PR adding a user-visible string lands all 4 locale bundles in the SAME PR:

1. Add canonical EN value to `en.json` under the right namespace.
2. Run the Sonnet subagent (prompt at `app/scripts/translate-locales.md`) once per non-EN locale.
3. Human-review: proper nouns untranslated, `{{placeholders}}` verbatim, Spanish length (~20% longer).
4. `bundle-parity.test.mjs` blocks merges where key sets diverge. Note: the prune left some unused legacy namespaces in place across all 4 bundles — harmless; if you remove keys, remove identically from all 4.

### What NOT to translate

Proper nouns (Trellis/QuestionTrace, OpenAI, Claude, Gemini, API, LLM, iOS, Android, Capacitor, SQLite); LLM system prompts (English; user-facing response localized via `applyLocaleDirective`); provider/model identifiers; cross-locale branded labels ("Language / 语言 / Idioma / 言語" — must never enter `en.json`); the Settings test-result `'✓'`/`'✗'` prefix (color logic depends on it).

### Validation (run from `app/`)

```bash
node --test tests/locales/bundle-parity.test.mjs
node --test tests/locales/missing-key.test.mjs
tsc -b --noEmit
npm test
```
