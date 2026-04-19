# EchoLearn — Claude Instructions

Project root instructions for Claude Code agents working on this repository.

## Project Overview

EchoLearn is an AI-powered personalized learning platform (React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + Capacitor 8). Local-first, privacy-preserving. Multi-provider LLM support (OpenAI, Claude, Gemini, local endpoints like LM Studio). See `.planning/PROJECT.md` for full vision.

**Working directory for the app:** `app/`

**Test framework:** Node.js built-in `node --test` with esbuild tsx loader — see `app/tests/canonical-knowledge.test.mjs` for the pattern. Phase 27 locale tests avoid the JSON-import-attribute failure chain by importing `i18next` directly; follow the same pattern for any new pure-logic helpers.

## Style Conventions

- **Inline styles with CSS variables** (NOT Tailwind classes for most UI)
- Key CSS vars: `--primary-40`, `--surface`, `--surface-variant`, `--muted-foreground`, `--radius-xl`, `--shadow-1/2/3`
- Services return `ServiceResult<T> = { success, data?, error? }`
- localStorage for all user preferences via `settingsService`
- Event bus (`src/lib/event-bus.ts`) for cross-screen notifications (LOCALE_CHANGED, REVIEW_COMPLETED, etc.)
- **Settings sub-page navigation:** SettingsScreen is a menu with 4 sub-pages at `/settings/ai`, `/settings/content`, `/settings/features`, `/settings/data`. Sub-screens live in `src/screens/settings/`. Shared components (SectionHeader, SettingRow, MaterialSwitch, SelectInput, TextInput with password reveal) in `settings/SettingsShared.tsx`. Each sub-screen manages its own state from `settingsService.getSync()`. Header `backTo` prop renders a back-arrow that navigates to the specified path.

---

## Concept Feed Generation Pipeline (load-bearing — read before touching `concept-feed.service.ts` or `post-queue.service.ts`)

The home feed is driven by THREE LISTS in a strict pipeline. **Do not invent a fourth, do not collapse two into one, do not bypass any step.** This architecture has been re-explained to agents 5+ times — it must not be drifted from.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. DAILY CONCEPT LIST  (source of truth — same as flashcards/podcasts) │
│     Anchor nodes (q.isAnchorNode === true) filtered by SM-2 due dates.  │
│     Updated when: new question creates a new anchor (via classification).│
│     Same source consumed by flashcard service + podcast service.        │
└─────────────────────────────────────────────────────────────────────────┘
                              │ derived from
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. DERIVED LIST  (post-style + count assignments, weighted)            │
│     For each concept in (1): assign post style (image / text-art /      │
│     video / short / news / suggestion) AND multiplicity (more entries   │
│     for important/overdue concepts).                                    │
│     Update mode: APPEND-ONLY when new questions arrive. Don't rebuild   │
│     from scratch — that loses cycle position.                           │
│     Removal trigger: when user READS a post of a concept                │
│     (CONCEPT_EXPLORED event), REMOVE that concept's remaining entries   │
│     from the derived list so the next loop doesn't re-suggest it.       │
└─────────────────────────────────────────────────────────────────────────┘
                              │ feeds
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. QUEUE  (length 8, cyclic walker over the derived list)              │
│     Walks through the derived list to fill 8 posts. Maintains a CYCLE   │
│     POSITION (index into derived list).                                 │
│     User swipes for more → pops 4 posts → walker advances → generates   │
│     more posts to refill toward 8.                                      │
│     End of derived list reached → wraps to start (cyclic).              │
│     If derived list is empty (all concepts read) → "No more posts"      │
│     toast is appropriate.                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Numeric defaults

- Queue length: **8**
- Posts served per swipe-for-more: **4** (NOT 1 — operator confirmed the desired UX)
- Style weights: see `app/src/services/style-assignment.ts:9-16` (`STYLE_WEIGHTS`)
- Daily generation cap: `dailyGenerationCapMultiplier × max(dueConcepts.length, 3)` per `concept-feed.service.ts:937-938` (D-38, with the floor-3 fix from Phase 32.1-02)

### Files

- `app/src/services/concept-feed.service.ts` — `buildConceptBatch` (currently produces a thin version of the derived list), `refillQueue` (wraps the queue), `generateMorePosts` (serves from queue)
- `app/src/services/post-queue.service.ts` — `_state.posts` is the queue; cycle position is currently NOT tracked (gap vs. design)
- `app/src/services/style-assignment.ts` — `assignStyles` weights
- `app/src/services/dailyRead.service.ts` — `getExploredAnchors` (consumed by VineProgress; should also drive derived-list removal)
- `app/src/hooks/useInfiniteScroll.ts` + `app/src/services/infiniteScroll.service.ts` — swipe-for-more entry point

### Known divergences from design (gaps to close, not to drift further)

- Derived list is currently rebuilt every refill (not append-only with cycle position).
- Each concept gets at most 2 entries (1 + isImportant), not weighted by style mix.
- Removal on read is NOT wired — `dailyReadService.getExploredAnchors()` only filters rendering, doesn't remove concepts from the derived list before generation.
- Queue serves variable count (whatever's available) instead of strictly 4 per swipe.

These gaps are why operator sees "swipe pops 1 post, then No more posts" on a fresh-install device with one anchor.

### When in doubt

The derived list is **append-only** (grows on new question, shrinks on read). The queue is **cyclic** over that list. The queue serves **4 per swipe**. Don't re-architect this — implement what the design says.

---

## Header positioning (Phase 32.1 — load-bearing, do not regress)

The `Header` component (`app/src/components/ui/Header.tsx`) auto-portals based on context:

- **Inside `SwipeTabContext`** (top-level swipe-tab screens: Settings, Planner, Graph, Ask) → renders **in-tree**, anchored to the slot's `transform: translateZ(0)` containing block (`SwipeTabContainer.tsx:245`). Each tab's header floats with its slot when the slot is off-screen.
- **Outside `SwipeTabContext`** (sub-screens via Outlet wrapper: PostDetail, settings sub-pages, Question/Anchor/Cluster detail, etc.) → renders via **`createPortal(headerNode, document.body)`**. Anchors to the viewport, immune to any ancestor's `transform`/`overflow`/`will-change`/`filter`/`contain`.

### Why this exists

`position: fixed` Headers inside `overflow: auto` ancestors flicker on Android Chromium WebView (a known long-standing quirk where fixed children become scroll-relative). This bug class has recurred multiple times — past commits `8df7980c`, `a7203a65`, `2dcef5d7`, `73d657a0`, `b4965feb`, `808c6e85` all touched it. The portal-vs-in-tree split makes regression structurally impossible:

- Sub-screen Headers cannot have a flickering ancestor because they aren't inside any React-tree ancestor (rendered to `document.body`).
- Top-level swipe Headers cannot leak across tabs because they stay in their slot's translateZ(0) containing block.

### Rules

1. **Don't add `transform`/`will-change`/`filter`/`contain`/`perspective` to any ancestor of a `Header` in the React tree.** This is mostly belt-and-suspenders since portalled Headers are immune, but in-tree Headers (top-level swipe screens) still depend on the slot's translateZ(0) being the only containing-block creator in the chain.
2. **Don't render a Header inside a screen that's both always-mounted AND always-visible.** SwipeTabContainer's slots are always-mounted but only ONE is visible at a time (others off-screen via translateX). If you create a new layout where multiple Headers could be visible at once, they'll stack.
3. **Don't move `Header.tsx` out of the portal-vs-in-tree pattern.** Rewriting it as "always in-tree" reintroduces sub-screen flicker. Rewriting as "always portal" makes top-level swipe Headers globally visible (operator-caught regression at commit `808c6e85`).

---

## Event bus — unified GRAPH_UPDATED (Phase 32.1)

There is **ONE event for graph mutations**: `GRAPH_UPDATED`. Used by:
- `commitClassificationResult` after every classification (canonical-knowledge.service.ts)
- `trellisActionsService.replant` and `unpruneQuestion`
- (Future) any code that mutates anchors/clusters/questions in storage

Subscribers must use `GRAPH_UPDATED` only:
- `useTrellisData.ts` — recomputes trellis on graph mutations
- `useQuestions.ts` — reloads from store so HomeScreen/PlannerScreen pick up new anchors created asynchronously by classification (load-bearing — without this, home/planner stay empty after the first question on a fresh-install device)
- `PrunedSection.tsx` — refreshes pruned-archive list

### Don't reintroduce CLASSIFICATION_COMPLETED

The `CLASSIFICATION_COMPLETED` event was deleted from the AppEvent union in commit `b2061554`. It was a semantic duplicate of `GRAPH_UPDATED` — both fired at identical moments. Two events for one signal let subscribers desync from emitters: only `useTrellisData`/`PrunedSection` listened to `CLASSIFICATION_COMPLETED`, while the actual classification path emitted `GRAPH_UPDATED`. Result: trellis didn't recompute after new questions.

If you need a more specific signal in the future, **extend `GRAPH_UPDATED` with a payload field** (e.g., `{ kind: 'classification' | 'replant' | 'prune', anchorId?: string }`) instead of adding a parallel event.

---

## News post pipeline — defer body to on-open streaming (Phase 32.1)

News posts (`sourceType: 'news'`, `presentationStyle: 'news'`) follow a **two-phase content model**:

| Phase | Where | What | LLM? |
|---|---|---|---|
| **Creation** (refillQueue news branch) | `concept-feed.service.ts:892-925` | Tavily web-search + construct DailyPost shell with `bodyMarkdown: ''` | NO |
| **Display** (user opens post) | `post-essay.service.ts:133` `generateNewsEssay` | Stream a 150-250 word LLM essay grounded in `sources[0].snippet` | YES — `chatStream` |

### Invariants (test-enforced at `tests/services/post-essay.service.test.mjs`)

The news creation block in `concept-feed.service.ts` MUST:
- Set `bodyMarkdown: ''` (an empty string literal — anything else makes `PostDetailScreen.tsx:237` skip the streamer and render whatever's stored as the body)
- Populate `newsMeta.sources[0].snippet` with the Tavily content blob (so the streamer has article text to ground on)
- NOT call `chatCompletion` / `chatStream` eagerly (LLM is deferred to on-open)
- NOT assign `result.content` to `bodyMarkdown` (the exact 2026-04-19 regression we just fixed at commit `3263af4e`)

### Don't recreate `news.service.ts`

There used to be an orphan `news.service.ts` (deleted in `db918264`) that nothing imported. It was a parallel implementation of news-post construction that diverged in field defaults. The presence of two paths confused investigation when bugs landed. **All news post construction lives in `concept-feed.service.ts`'s news branch.** Don't add a second path.

---

## Anchor name normalization (Phase 32.1 — guard at the data layer)

Per the mindmap design: `Knowledge → Branch (discipline) → Cluster (domain) → Concept Anchor (concept noun) → QAs`. Anchor titles MUST be **clean concept noun phrases**, not question paraphrases.

`canonical-knowledge.service.ts` enforces this at TWO layers:

1. **Prompt-side (best-effort):** `buildStepPrompt('anchor', ...)` adds an explicit GOOD/BAD examples constraint when the LLM creates new anchors. See commit `93162265`.
2. **Post-LLM guard (defensive):** `normalizeAnchorName()` runs in `commitClassificationResult` BEFORE any anchor lookup or persistence. Strips question prefixes (`what is`, `why does`, ...), trailing `and (why|how|...)` clauses, truncates to 3 words if still too long, title-cases. See commit `b2061554`.

Examples it transforms:
- `"Spaced repetition and why does it work"` → `"Spaced Repetition"`
- `"What is spaced repetition?"` → `"Spaced Repetition"`
- `"How do transformers handle attention?"` → `"Transformers Handle Attention"`

### Don't bypass the guard

If you add a new classification path or a new anchor-creation site, route the `anchorName` through `normalizeAnchorName()` before persistence. The legacy `classifyAndAnchor` path and the incremental pipeline both go through `commitClassificationResult` — keep it that way.

### Existing wrong-named anchors

Anchors created BEFORE `b2061554` keep their old question-paraphrase names. There is **no migration** — operator can manually rename or Clear-All-Data + re-classify. Document this if/when a migration becomes needed.

---

## Best practices learned in Phase 32.1 (avoid the same mistakes)

These are meta-rules distilled from session pain. Read before refactoring or chasing a regression:

1. **Search for dead code BEFORE assuming "two parallel paths."** When you see duplicated logic, first verify both ARE called. The `news.service.ts` saga happened because I assumed both paths were live; deleting the dead one was the right answer all along, not factoring out a shared helper.
2. **Tests must guard the LIVE code path, not aspirational/dead code.** A test that checks an unreachable file is worse than no test — it gives false confidence. When you encounter a regression that "should have been caught by a test," check WHICH file the test was guarding.
3. **`position: fixed` + `overflow: auto` + Android Chromium WebView = bug class.** Don't put `position: fixed` children inside scrollable React subtrees. Use Portal to `document.body` (sub-screens) or rely on the parent's `translateZ(0)` containing block (top-level swipe slots).
4. **Async classification needs an explicit re-read trigger.** When you create new anchors/clusters asynchronously (e.g., after a question is asked), you MUST emit an event that `useQuestions` (and any other store consumer) subscribes to and reloads from store. Otherwise the UI shows pre-async state forever.
5. **Hardcoded fallbacks vs. defer-to-streamer.** When a post type defers content to on-open generation (news, video, AI-text), the creation step MUST set `bodyMarkdown: ''`. Storing a "preview" or "snippet" in `bodyMarkdown` makes `PostDetailScreen` skip the streamer.
6. **One signal per semantic event.** Don't emit two events for the same outcome — subscribers will drift between them and one camp will silently break.
7. **Don't ship fixes by hypothesis without verification when device-only bugs are involved.** Multiple of my Bug 2 attempts were wrong because I couldn't reproduce on web. When a bug is platform-specific, prefer adding diagnostic logs over confident-but-untested fixes.
8. **When the operator says "I've explained this 5+ times," document it in three places:** CLAUDE.md (project-level), auto-memory (cross-conversation), and an inline comment at the load-bearing code site. One location is too easy to miss.

---

## i18n Workflow (Phase 27+)

EchoLearn supports 4 locales: **English** (canonical/source), **Simplified Chinese**, **Spanish**, **Japanese**.

### Bundle files

All translation bundles live at:

- `app/src/locales/en.json` — **canonical** (source of truth, hand-authored)
- `app/src/locales/zh.json` — Simplified Chinese
- `app/src/locales/es.json` — Spanish
- `app/src/locales/ja.json` — Japanese

Related infrastructure:

- `app/src/locales/index.ts` — i18next init, `SUPPORTED_LOCALES`, `LOCALE_NAMES`, data-locale listener
- `app/src/locales/i18n.d.ts` — module augmentation for type-safe `t()` keys
- `app/src/lib/locale.ts` — `normalizeLocale`, `detectInitialLocale`, `detectDeviceLocale`
- `app/src/providers/llm/locale-directive.ts` — central `applyLocaleDirective` for LLM calls (D-12)
- `app/src/services/youtube-locale-url.ts` — `buildYoutubeSearchUrl` with locale params (D-14)

### The ONE rule (no exceptions)

**Runtime LLM translation is PROHIBITED.** The app's `llmProvider` (`app/src/providers/llm/index.ts`) must NEVER be invoked to translate UI copy at runtime. Any code path that calls `chatCompletion` / `chatStream` for translation is a bug. This rule is enforced by:

- `app/tests/services/web-search-no-locale.test.mjs` — guards Tavily neutrality (D-15)
- The central `applyLocaleDirective` in `providers/llm/locale-directive.ts` is for TELLING the LLM what locale to respond in during normal Q&A, NOT for translating UI copy

See `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_i18n_translation.md` for the durable rule and rationale.

### Adding a new UI string — the EN-first workflow

Every PR that adds a user-visible string MUST land all 4 locale bundles in the SAME PR. No exceptions.

1. **Add the canonical EN value** to `app/src/locales/en.json` (nested under the right namespace — see list below).
2. **Run the Sonnet subagent** (see prompt template at `app/scripts/translate-locales.md`) three times — once per non-EN locale — to fill in zh/es/ja values. Prompt the subagent with: the full current `en.json`, the existing target locale file, and the translation rules.
3. **Review the generated translations.** Never commit raw subagent output — always human-review. Pay special attention to: proper nouns (don't translate "EchoLearn", "OpenAI", "Claude", etc.), interpolation placeholders (`{{name}}`, `{{count}}` must appear verbatim), and length (Spanish runs ~20% longer; watch for overflow).
4. **Commit all 4 bundles + code in one PR.** The `bundle-parity.test.mjs` test will block merges where key sets diverge.

### Namespaces (as of Phase 27)

Flat nested JSON. Top-level groups:

- `common.*` — shared across screens: buttons, nav labels (`common.nav.*`), toast messages (`common.toast.*`), greetings (`common.greeting.*`), actions (`common.action.*`)
- `home.*` — HomeScreen (includes `home.bento.*`, `home.toast.*`)
- `planner.*` — PlannerScreen (includes `planner.trellis.*` for trellis panel, `planner.toast.*`)
- `ask.*` — AskScreen and AskScreen sub-flows (includes `ask.drawer`, `ask.history`, `ask.welcome`, `ask.suggestedPrompts`, `ask.rateLimit`, `ask.postThread`)
- `review.*` — ReviewScreen (includes `review.library.*`, `review.miniMap.*`, `review.session.*`, `review.done.*`)
- `graph.*` — GraphScreen (includes `graph.anchor.*`, `graph.cluster.*`, `graph.reorganizeModal`, `graph.selected`, `graph.toast`)
- `podcast.*` — PodcastScreen (includes `podcast.player.*`, `podcast.generateCard.*`, `podcast.knowledgeToday.*`, `podcast.insertBanner.*`, `podcast.toast.*`)
- `posts.*` — Post feed and detail (includes `posts.detail.*`, `posts.qa.*`, `posts.connection.*`, `posts.image.*`)
- `settings.*` — SettingsScreen + sub-screens (16 sub-namespaces: `menu`, `titles`, `sections`, `fields`, `descriptions`, `placeholders`, `providerLabels`, `voices`, `themes`, `toast`, `confirm`, `test`, `planner`, `buttons`, `cacheStats`, `usageTable`, `zerotier`, `about`)
- `onboarding.*` — OnboardingScreen (includes `onboarding.welcome.*`, `onboarding.consent.*`, `onboarding.llm.*`)
- `questionDetail.*` — QuestionDetailScreen (promoted to top-level)

### Validation

Run from `app/`:
```bash
node --test tests/locales/bundle-parity.test.mjs   # asserts identical key sets across 4 bundles
node --test tests/locales/missing-key.test.mjs     # asserts missing-key handler fires + fallback renders EN
tsc -b --noEmit                                    # typos in t('...') keys fail compilation (via module augmentation)
npm test                                           # full suite
```

### Subagent prompt template

See `app/scripts/translate-locales.md` for the copy-paste-ready prompt.

### What NOT to translate

- **Proper nouns:** EchoLearn, OpenAI, Claude, Gemini, YouTube, Tavily, API, TTS, LLM, SM-2, iOS, Android, Capacitor, GPT, SQLite, Nano Banana, ZeroTier
- **LLM system prompts** (in services that call `chatCompletion`) — those stay English so the LLM understands; the user-facing RESPONSE is what gets translated, via the central locale directive in `applyLocaleDirective`
- **Tavily web-search queries** — intentionally English for broader coverage (D-15). The test `web-search-no-locale.test.mjs` enforces this.
- **Cross-locale branded labels** — "Language / 语言 / Idioma / 言語" in SettingsScreen + OnboardingScreen language pickers stay hardcoded so users in any locale can recognize them. Also: "Continue · 继续 · Continuar · 続ける" and "Choose your language · 选择语言 · Elige tu idioma · 言語を選択" in the Onboarding language step. These MUST NEVER enter `en.json`.
- **Provider/model identifiers:** `gpt-4o`, `claude-sonnet-4-6`, `gemini-3.1-flash-image-preview`, `llama3`, etc. — technical identifiers, not user-facing content.
- **Emoji prefix on Settings test results:** `'✓'` / `'✗'` — downstream color logic (`.startsWith('✓')`) depends on it.
- **Static content blurbs:** HomeScreen `MILESTONE_POOL` (5 trivia/milestone cards) deliberately left hardcoded — content vs UI-chrome distinction; deferred to a future content-localization phase.

### Reference docs

- `.planning/phases/27-add-i18n-l10n-support/27-CONTEXT.md` — all 24 locked decisions (D-01..D-24)
- `.planning/phases/27-add-i18n-l10n-support/27-RESEARCH.md` — technical research, versions, patterns, pitfalls
- `.planning/phases/27-add-i18n-l10n-support/27-VALIDATION.md` — Nyquist test contract
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_i18n_translation.md` — durable rule, rationale
