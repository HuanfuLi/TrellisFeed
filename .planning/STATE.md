---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: gap closure)
status: Planning
stopped_at: Completed 31-03-PLAN.md
last_updated: "2026-04-18T01:43:32.606Z"
progress:
  total_phases: 21
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Phase 28 COMPLETE (all 3 plans executed)

## Current Milestone

Milestone v1.3 (pre-release) ✓ COMPLETE (2026-04-16). Phase 28 runs as the first phase of v1.4 (UI/UX polish from audit findings).

## Milestone Goal

Shipped: diagnostic dialogue (Phase 20), post streaming (21), swipe nav (22), incremental classification + rate limiter (23), retroactive verification close-out (24), anime Trellis visualization (25), harvest/heal/replant actions (26), i18n/L10n for EN/ZH/ES/JA (27). Audit: `.planning/v1.3-MILESTONE-AUDIT.md`.

## Current Phase

Phase 28 — UI/UX Polish from Audit Findings. All 3 plans COMPLETE 2026-04-16:

- Plan 01 (Wave A+B foundations): spacing tokens, desync fix, nav slide-down, scroll shadow, touch targets, padding unification
- Plan 02 (Wave C): trellis shake/haptic/pulse, perf guard, Mind Map → Knowledge Graph rename
- Plan 03 (Wave D): AskScreen recent-questions refactor (D-15), active-squish (D-16), D-28 deferral fix, D-17/D-18/D-19 audit (all no-op)

Next: run `/gsd:verify 28` for verifier pass, then proceed to Phase 29 or merge branch.

## Latest Decisions (Phase 28-03)

- [Phase 28-03] D-15 landed: AskScreen recent-question rows refactored to tappable `<button>` elements with `navigate('/ask/${q.id}')`, 2-line text clamp (`WebkitLineClamp: 2`), 44px minHeight touch target, 12px 16px padding, and `active-squish` press feedback via `buildRowClassName` helper. Empty state renders `t('ask.recentQuestionsEmpty')` via `renderRecentQuestionsMarker` pure helper. Bullet prefix removed.
- [Phase 28-03] D-16 landed: `className="active-squish"` applied to PlannerScreen dead row + dying row Suggested Moves, and AskScreen recent-question rows via `buildRowClassName`. PlannerScreen now has 3 active-squish sites (refresh + dead + dying).
- [Phase 28-03] D-28 AskScreen:607 deferred fix complete: `padding: '11px 16px'` replaced with `'12px 16px'` as part of D-15 button refactor. TODO marker removed.
- [Phase 28-03] i18n: `ask.recentQuestionsEmpty` key added to all 4 locale bundles — en "No recent questions yet — ask your first one below.", zh "暂无近期提问 — 先问一下吧。", es "Aun no hay preguntas recientes — haz la primera abajo.", ja "最近の質問はまだありません — 下から最初の質問をどうぞ。"
- [Phase 28-03] D-17 no-op: empty-state copy consistency audit found PlannerScreen emptyHint already em-dash + hint, GraphScreen heading + body appropriate for full-page context, ReviewScreen period + CTA appropriate for library context. No changes warranted.
- [Phase 28-03] D-18 no-op: GraphScreen toolbar audit found consistent padding (8px 12px), proper Header alignment, properly positioned expand/collapse button, display-only keyword chips. No tweaks needed.
- [Phase 28-03] D-19/D-09 no-op: Residual P2 pass found zero remaining off-grid padding values in target screens after Plans 28-01/28-02 cleanup.
- [Phase 28-03] Wave 0 tests: 9 tests in AskScreen.recent.test.mjs (4 inline-mirror contract + 5 source-side grep). All GREEN. Bundle parity GREEN. Vite build GREEN in 2.94s.
- [Phase 28-03] Commits: `9236c187` (test — RED Wave 0 scaffolds), `e9a94984` (feat — D-15/D-16/D-28/i18n GREEN). 4 minutes total; 2 tasks / 7 files (1 created + 6 modified).
- [Phase 28-03] PHASE 28 COMPLETE: All 19 audit findings (D-04 through D-19 + D-26 through D-30) addressed across 3 plans. 9 landed as code changes, 3 documented as no-op (D-17/D-18/D-19), 1 was already present (D-08). Total: 9 commits, 22 minutes, ~30 files.

## Latest Decisions (Phase 28-02)

- [Phase 28-02] D-10 landed: Trellis leaves respond to taps with ~300ms shake via `useAnimationControls` + `shakeControls.start({ rotate: [0, 4, -4, 2, 0], ... })`. Nested inner motion.g wrapper carries shakeControls; outer motion.g ambient sway (Phase 25) preserved untouched. `pointerEvents:'auto'` on inner motion.g (SVG root stays 'none') routes taps to individual leaves.
- [Phase 28-02] D-11 landed + Nyquist-tested: `hapticImpactLight` fires exactly once per non-perf-guarded tap via `handleTap` → `onLeafTap` pure helper. `TrellisLeaf.shake.test.mjs` asserts `mock.fn().mock.callCount() === 1` by injecting a haptic spy into the exported `onLeafTap({ perfGuardActive, shakeControls, haptic })` factory — this satisfies the D-11 Nyquist requirement without DOM render.
- [Phase 28-02] D-12 landed: `PlannerScreen` tracks `focusedAnchorId` via `useState` + `focusClearTimerRef` with 2000ms auto-clear. `onPointerDown={() => focusAnchor(node.anchor.id)}` on dead + dying Suggested Moves rows fires BEFORE the existing `onClick` navigation. Prop threads through `TrellisHero` → `TrellisCanvas` → `TrellisLeaf`; matched leaf animates scale [1, 1.15, 1] + drop-shadow(0 0 8px var(--primary-40)) glow over 2s. `key={`pulse-${anchorId}-${focusCounter}`}` re-mounts the pulse wrapper on repeat taps so the animation fires anew (D-12 explicit requirement).
- [Phase 28-02] D-13 landed: `TAP_ANIMATION_THRESHOLD=30` + `leafAnimationMask({ totalCount, inView })` predicate in new `app/src/services/trellis-perf-mask.ts`. Distinct from Phase 25 D-55 `AMBIENT_SWAY_THRESHOLD=20` — documented side-by-side in TrellisCanvas.tsx header comment: continuous (repeat-forever) animations have a lower perf ceiling than event-driven (one-shot) animations. `perfGuardActive` prop threads through TrellisCanvas → TrellisLeaf; `onLeafTap` and pulse animate both short-circuit when true.
- [Phase 28-02] D-13 IntersectionObserver deferral: count-only gate shipped (`inView=true` conservative default until IO lands). Code path wired so future phase can drop in IO derivation without touching call sites. Graceful degradation — leaves above 30 still animate until IO layered.
- [Phase 28-02] D-14 landed: graph.headerTitle value-swapped across 4 locale bundles per UI-SPEC Copywriting Contract — en "Mind Map" → "Knowledge Graph", zh "脑图" → "知识图谱", es "Mapa mental" → "Grafo de conocimiento", ja "マインドマップ" → "ナレッジグラフ". Executor-inline translation (no Sonnet subagent needed — values were locked in UI-SPEC). GraphScreen.tsx renders via existing `t('graph.headerTitle')` — zero code change.
- [Phase 28-02] D-14 regression gate: `bundle-parity.test.mjs` extended with value-level assertion "graph.headerTitle values match expected per locale (D-14)" that iterates 4 locales and asserts exact-string match to UI-SPEC Copywriting Contract. Started RED end of Task 1 (Mind Map ≠ Knowledge Graph), flipped GREEN in Task 3. Future translators who re-translate the key in isolation get a failing test.
- [Phase 28-02] D-14 scope boundary: `review.library.shapeMapDescription` narrative references to "mindmap"/"脑图"/"マインドマップ" deliberately NOT renamed — plan's acceptance-criteria grep patterns use quoted-full-value matches (`! grep -q '"Mind Map"'` etc.), confirming D-14 is scoped to the graph screen header title, not every narrative mention of the concept.
- [Phase 28-02] Pattern: inline-mirror test for .tsx-resident helpers — `TrellisLeaf.shake.test.mjs` and `TrellisCanvas.focus.test.mjs` define JS mirrors of `SHAKE_KEYFRAMES` / `onLeafTap` / `isLeafFocused` to avoid Node 25 TSX loader fragility. Source-side exports grep-verified in acceptance_criteria. Same precedent as Phase 28-01 `BottomNavigation.slide.test.mjs`. For pure `.ts` modules (`trellis-perf-mask.test.mjs`), direct import works (Node 25 loads TS natively).
- [Phase 28-02] AskScreen.tsx line 234 comment-only edit for grep hygiene: "feed into Mind Map, Review, and Podcast surfaces" → "feed into Knowledge Graph, Review, and Podcast surfaces". No user-visible change.
- [Phase 28-02] Deviation [Rule 3 - Blocking]: Initial `OnLeafTapDeps.shakeControls` type `{ start: (animate: unknown) => unknown }` failed tsc (contravariant check rejects `unknown` vs framer-motion's `AnimationDefinition`). Widened to `{ start: (animate: any) => any }` with eslint-disable + clarifying JSDoc. Test contract unchanged.
- [Phase 28-02] `TrellisHero` prop made optional with default `{}` — `export function TrellisHero({ focusedAnchorId }: TrellisHeroProps = {})` — so hypothetical non-Planner consumers who don't pass the prop still work.
- [Phase 28-02] All 18 Wave 0 + locale tests green (3 new files = 15 tests + bundle-parity + missing-key). vite build green in 3.00s. Zero new tsc errors in touched files (8 pre-existing errors unchanged).
- [Phase 28-02] Commits: `867f5d1b` (test — Wave 0 trellis tests + pure helpers hoisted), `7c349015` (feat — D-10/D-11/D-12/D-13 trellis interactions), `bfe2dd0f` (feat — D-14 Mind Map → Knowledge Graph rename across 4 locales). 7 minutes total; 3 tasks / 14 files (4 created + 10 modified).

## Latest Decisions (Phase 28-01)

- [Phase 28-01] 9 CSS custom properties landed on `:root` in `app/src/index.css` — `--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 12px`, `--space-lg: 16px`, `--space-xl: 20px`, `--space-2xl: 24px`, `--space-3xl: 32px`, `--bottom-nav-safe: calc(80px + var(--safe-area-bottom))`, `--section-gap: 24px`. Additive (zero existing tokens modified) — foundation for Wave B-spacing consumers (D-27/D-28/D-30).
- [Phase 28-01] SwipeTabContainer desync fix (D-05) — new `useEffect` installs `window.resize` + `window.visualViewport?.resize` listeners that refresh `screenWidthRef` and re-snap `stripX` when not mid-gesture/mid-animation. Existing `useLayoutEffect` route-sync now refreshes `screenWidthRef` BEFORE reading (previously captured once at mount). Dev invariant logs `[SwipeTabContainer] stripX drift` warning when `|stripX - expected| > 2px` — `import.meta.env.DEV` branch stripped in production.
- [Phase 28-01] Pure helper `computeTargetX(index, width) = -index * width` exported from `swipe-tab-logic.ts`. Consumed by the resize listener + useLayoutEffect + new Wave 0 test (5 viewport/index pairs asserted). Node 25 `-0 ≠ 0` quirk handled in the zero-input test via `Math.abs`.
- [Phase 28-01] BottomNavigation (D-06) — `<nav>` → `<motion.nav>` with `initial={{ y: 0 }}` (prevents first-mount flash), `animate={{ y: getNavYTarget(isTopLevelScreen) }}`, `transition=SLIDE_SPRING` where `SLIDE_SPRING = { stiffness: 300, damping: 30, mass: 0.8 }` matches SwipeTabContainer's SPRING. Pure helper `getNavYTarget(isTop)` exported; new Wave 0 test asserts `true → 0`, `false → '100%'`.
- [Phase 28-01] Header scroll-shadow (D-07) — new `scrolled?: boolean` prop; falls back to `useContext(HeaderScrollContext)?.scrolled ?? false` when prop omitted. Paints `boxShadow: var(--shadow-1)` with `transition: 'box-shadow 150ms ease-out'` when scrolled. 4px scroll threshold (natural hysteresis). HeaderScrollContext extracted to `app/src/lib/header-scroll-context.ts` (single-purpose module) to avoid `Header ↔ App.tsx` circular import.
- [Phase 28-01] App.tsx RootLayout — `headerScrolled` state; sub-screen Outlet wrapper gains `onScroll={(e) => { ... scrollTop > 4 }}` handler; Outlet wrapped in `<HeaderScrollContext.Provider value={{ scrolled: headerScrolled }}>`; `isTopLevelScreen={isTopLevelScreen}` passed to BottomNavigation.
- [Phase 28-01] D-08 verified no-op: BottomNavigation already had `borderTop: '1px solid var(--border)'` — no change needed, retained explicitly in the motion.nav style prop.
- [Phase 28-01] PlannerScreen Suggested Moves h2 (D-04) restyled with explicit `fontSize: '1rem', fontWeight: 600, lineHeight: 1.4, color: 'var(--foreground)', letterSpacing: '-0.01em'` + marginTop `var(--section-gap)` on parent row. Copy untouched (UI-SPEC D-04 is styling-only per D-24 i18n coordination).
- [Phase 28-01] Sub-screen paddingBottom (D-27) migrated to `var(--bottom-nav-safe)` on 10 screens: HomeScreen, PlannerScreen, SettingsScreen, GraphScreen (fixed 16px bug → content no longer scrolls under nav), PostDetailScreen (unified three inline paddings: 104px main + 24px loading + 24px not-found), AnchorDetailScreen, ClusterDetailScreen, ReviewScreen (3 branches: library + done + active), PodcastScreen (2 branches), QuestionDetailScreen. Combined `padding: '… … …'` shorthand split into explicit properties so bottom padding is controlled independently.
- [Phase 28-01] Deviation [Rule 1 — Bug]: HomeScreen original `paddingBottom: 'calc(96px + var(--safe-area-top) + var(--safe-area-bottom))'` incorrectly included `--safe-area-top` (belongs in paddingTop). Plan D-27 text called it out; fixed inline during migration.
- [Phase 28-01] Off-grid normalization (D-28) — PlannerScreen dead+dying rows `11px 0` → `12px 0` (2 sites); AskScreen suggested-prompt button `11px 16px` → `12px 16px`; AskScreen recent-question row LEFT with TODO comment (deferred to Plan 28-03 D-15 `<button>` refactor); PostDetailScreen text-art card `32px 28px` → `32px 24px`; ReviewScreen flashcard Q row `16px 16px 12px` → `16px` uniform; ReviewScreen flashcard A row `12px 16px 16px` → `16px` uniform.
- [Phase 28-01] Touch targets (D-29) → WCAG 2.5.8 minimum 44×44 — Header component-level fix: left + right slots wrap children in `<div style={{ minWidth: '44px', minHeight: '44px', ... }}>` for BOTH centered and non-centered code paths, so all consumer back buttons benefit without per-screen edits. PlannerScreen scissors (dead + dying rows): 32×32 → 44×44. AskScreen flag button: ~34×24 → 44×44 (minWidth/minHeight + justifyContent:'center'). Badge.tsx: added `onClick?: MouseEventHandler<HTMLSpanElement>` + `style?: CSSProperties` props; when `onClick` present, merges `{ minWidth: '44px', minHeight: '44px', justifyContent: 'center', cursor: 'pointer' }` into the span's style. Non-interactive Badge stays visually compact.
- [Phase 28-01] Section rhythm (D-30) — PlannerScreen TrellisHero ↔ TrellisStatusPanel: `marginTop: '16px', marginBottom: '8px'` → `marginTop: 'var(--section-gap)', marginBottom: 'var(--section-gap)'` (symmetric 24px). PlannerScreen TrellisStatusPanel ↔ Suggested Moves: `marginTop: '24px'` → `marginTop: 'var(--section-gap)'`. Intra-section `marginBottom: '12px'` (title-to-content) preserved as intentional typographic hierarchy.
- [Phase 28-01] All 18 Wave 0 tests green (swipe-tab-logic 14 + BottomNavigation.slide 3 + bundle-parity 1); `npx vite build` green in 3.03s; zero new tsc errors in touched files (8 pre-existing errors in GraphScreen/canonical-knowledge/review/trellis-state unchanged per deferred-items.md).
- [Phase 28-01] gsd-tools `verify key-links` reports false negatives on all 4 links due to a YAML escape bug (kvMatch regex captures `"pattern: \\\\{...\\\\}"` literally, producing a regex that matches `\{` instead of `{`). All patterns manually verified via grep — present in source as expected. Tool issue, not a plan issue.
- [Phase 28-01] Commits: `38e64309` (feat — D-26 tokens + D-05 desync fix + Wave 0 tests), `efbb2f7f` (feat — D-06 nav slide-down + D-07 scroll shadow + D-04 heading), `58cfec24` (feat — D-27 padding unification + D-28 off-grid + D-29 touch targets + D-30 rhythm). 11 minutes total; 3 tasks / 16 files (13 modified + 3 created).

## Latest Decisions (Phase 27-07)

- [Phase 27-07] Project-root `CLAUDE.md` authored fresh (187 lines) — Project Overview + Style Conventions + 10-subsection i18n Workflow. Lists all 4 bundle paths, EN-first rule, Sonnet-subagent workflow, no-runtime-LLM-translation rule, namespace list (common/home/planner/ask/review/graph/podcast/posts/settings/onboarding/questionDetail), validation commands, proper-noun allowlist (D-09 complete).
- [Phase 27-07] `app/scripts/translate-locales.md` authored — copy-paste-ready Sonnet subagent prompt template with 8 priority-ordered rules (preserve existing translations, preserve interpolation placeholders, do-not-translate proper nouns, tone, length awareness, pluralization, structure, output format) + developer workflow + validation checklist. Template shaped for future Task-tool subagent spawning when available.
- [Phase 27-07] zh.json translated: 558/602 leaves differ from EN = 92.7% coverage. Simplified Chinese; uses short-form app UX conventions (首页/计划/提问/图谱/设置); natural-sounding UI chrome; greetings 早上好/下午好/晚上好; 保持 polite register for error/toast messages.
- [Phase 27-07] es.json translated: 543/602 leaves = 90.2%. Spanish (European register, `tú` informality throughout); concise synonyms chosen to counter Spanish's ~20% length bloat (Guardar, Cancelar, Enviar); occasional register-optimized verbs (Actualizar vs Volver a cargar).
- [Phase 27-07] ja.json translated: 556/602 leaves = 92.4%. Japanese (です/ます polite form); 半角 spaces around `{{placeholders}}` where grammatically natural; greetings おはようございます/こんにちは/こんばんは.
- [Phase 27-07] Remaining ~8-10% non-translated leaves are ALL deliberate: proper nouns (EchoLearn, OpenAI, Claude, Gemini, YouTube, Tavily, Nano Banana, ZeroTier), provider model IDs (gpt-4o, claude-sonnet-4-6, gemini-3.1-flash-image-preview, llama3), URL/localhost placeholder strings, API key samples (sk-..., sk-ant-..., AIza..., nb-...), emoji prefixes on Settings test results (✓/✗) — downstream color logic depends on .startsWith('✓'), EN LLM system prompts (ask.titleSystemPrompt, ask.titleUserPrompt, settings.test.testPrompt) per D-07, cross-locale branded labels (Language / 语言 / Idioma / 言語; Choose your language · 选择语言 · Elige tu idioma · 言語を選択) per D-18/D-19.
- [Phase 27-07] Deviation: executor-inline translation instead of Task-tool Sonnet subagent spawn. This executor environment exposes only Read/Write/Edit/Bash/Grep/Glob — no Task tool. The D-07 constraint (runtime LLM translation PROHIBITED inside the app) is satisfied identically: dev-time human-in-the-loop translation via executor-inline authorship, validated by 4 automated gates (bundle-parity, interpolation preservation, proper-noun grep, >50% coverage threshold). The Task-tool-shaped prompt template in translate-locales.md remains ready for future re-runs.
- [Phase 27-07] Deviation: UAT walkthrough template authored rather than physical screenshot capture. Physical operator action (npm run dev, localStorage clear, 16-screen × 4-locale navigation, screenshot capture) cannot be executor-automated. The `uat-screenshots/README.md` codifies the walkthrough and is the Task 3 checkpoint:human-verify gate. A `.gitkeep` marker preserves the empty archive; actual PNGs land during Task 3.
- [Phase 27-07] 27-VALIDATION.md frontmatter updated: status=ready, nyquist_compliant=true, wave_0_complete=true, validated=2026-04-16.
- [Phase 27-07] 40/40 Wave 0 tests green (bundle-parity, missing-key, data-locale-attr, settings-locale, locale-detect, date.locale, llm-locale-injection, tts-locale, youtube-locale, web-search-no-locale); `npx vite build` green (3.08s).
- [Phase 27-07] Interpolation-placeholder preservation check across all keys × all 3 non-EN locales: zero mismatches. Proper-noun presence grep: 8/8 (EchoLearn, OpenAI, Claude, Gemini, YouTube, Tavily, Nano Banana, ZeroTier) positive in every non-EN bundle.
- [Phase 27-07] Trellis domain vocabulary chosen for consistency: dying/dead/fruits/harvest/prune = 凋零中/枯萎/果实/收获/修剪 (ZH), Marchitos/Muertos/Frutos/Cosechar/Podar (ES), 衰弱中/枯死/果実/収穫/剪定 (JA).
- [Phase 27-07] Pluralization preserves Plan 05's countOne/countOther ternary pattern: JA and ZH use identical form (no grammatical plural), ES uses genuine singular/plural. Zero code changes required downstream.
- [Phase 27-07] Commits: `bfe989d6` (docs — CLAUDE.md + scripts/translate-locales.md), `6015baba` (feat — zh/es/ja translations), `6edd8da5` (docs — validation frontmatter + UAT template).

## Latest Decisions (Phase 27-04)

- [Phase 27-04] SettingsScreen gains a 4-language picker at the TOP of the rendered tree (before first SectionHeader), inside a dedicated Card. Select triggers `handleLocaleChange` which awaits `i18nInstance.changeLanguage(next)`, persists `preferences.locale` (+ legacy `preferences.language` back-compat), then `eventBus.emit({ type: 'LOCALE_CHANGED', payload: { locale: next } })`. 5 always-mounted screens re-render instantly via useTranslation subscribers — D-19 complete.
- [Phase 27-04] Row LABEL hardcoded as `Language / 语言 / Idioma / 言語` per D-18/D-19 (cross-locale affordance — findable from any locale state); description translated via `t('settings.language.description')` seeded by Plan 01; per-option labels stay in native scripts (English / 简体中文 / Español / 日本語).
- [Phase 27-04] `CompletionOptions.signal?: AbortSignal` added to `providers/llm/index.ts` — caller-supplied abort surface on both chatCompletion and chatStream.
- [Phase 27-04] `composeSignal(callerSignal, ms)` helper composes caller abort with per-call timeout via `AbortSignal.any` (modern Chromium 116+ / Safari 17.4+ / Node 20+) with manual-forwarder fallback for older runtimes. Signal threaded through all 7 fetch call sites (localPost, openAI completion/stream, claude completion/stream, gemini completion/stream) — up from the plan's assumed 6 because localPost also required plumbing (Android-local streaming path).
- [Phase 27-04] `useQuestions.askStreaming` creates ONE `AbortController` per call (declared before the `try`), subscribes to LOCALE_CHANGED inside the try, passes the SAME `abortController.signal` to BOTH Pass 1 and Pass 2 chatStream calls — a single LOCALE_CHANGED event aborts whichever pass is live (the plan called this out as the most common executor mistake; followed the annotated template verbatim).
- [Phase 27-04] 6 aborted-guards in useQuestions: Pass 1 loop entry + post-Pass-1 guard + Pass 2 loop entry + post-Pass-2 guard + final pre-persistence guard + catch-level abort check. Every buildAndSave path preceded by a guard; catch block short-circuits AbortError to the clean toast path instead of NETWORK_ERROR.
- [Phase 27-04] Toast on abort uses `i18n.t('ask.localeChangedDiscarded')` (seeded by Plan 01 canonical en.json). Function returns `null` without calling `questionService.buildAndSave` — the half-English / half-Japanese partial never reaches storage.
- [Phase 27-04] `finally { unsubLocale(); }` ensures the LOCALE_CHANGED subscription is cleaned up on every path (success, abort, throw) — prevents leak across repeated askStreaming calls.
- [Phase 27-04] TDD cadence: RED commit (`c93ecf46`) introduced 4 failing assertions first; GREEN commit (`7e301831`) landed provider + useQuestions implementation making them pass. Plus Task 1 implementation (`da5c69b5`).
- [Phase 27-04] Deviation: used direct `settingsService.getSync/.set` instead of the `useSettings` hook the plan illustrated — every other row in SettingsScreen uses the direct pattern, so introducing the hook just for locale would create two parallel settings-snapshot sources inside one component. Documented inline in the code comment and SUMMARY.
- [Phase 27-04] Deviation: added `callerSignal?` param to `localPost` helper (not explicitly in the plan's Step 1(c) scope) because openAICompletion's native/local branch goes through it — otherwise LOCALE_CHANGED would silently not cancel Android-local completions. Total `signal: composeSignal(...)` call sites rose from the plan's assumed 6 to 7.
- [Phase 27-04] Deviation: removed dead `void options;` statements from claudeStream + geminiStream — now that `options?.signal` is actually consumed, the silencer lines became dead code.
- [Phase 27-04] All 48 Wave 0 tests green (bundle-parity, missing-key, data-locale-attr, settings-locale, locale-detect, date.locale, llm-locale-injection, tts-locale, youtube-locale, web-search-no-locale, types.appevent, useQuestions-locale-abort). `npx vite build` green (3.0s). Zero new tsc errors in touched files — 8 pre-existing errors in GraphScreen/canonical-knowledge/review/trellis-state persist per Plan 01 deferred-items.md.
- [Phase 27-04] `AbortSignal.any` available in test runtime (Node 25) — the modern compositor branch is what shipped during tests; manual-forwarder fallback retained for older native WebViews (mostly iOS 17.3 and earlier).

## Roadmap

- **Phase 7:** Post Feed Redesign & Image Integration (COMPLETE)
- **Phase 8:** Post Detail & Infinite Scroll (COMPLETE — 08-01-PLAN.md)
- **Phase 9:** Image Regeneration & Error Handling (SKIPPED)
- **Phase 10:** Planner Auto-Suggestions Engine (COMPLETE)
- **Phase 11:** Planner Retry & Milestone Card Variety (COMPLETE)
- **Phase 12:** Portal Navigation & Rich Moves Linking (12-01-PLAN.md — COMPLETE, 12-02-PLAN.md — COMPLETE)
- **Phase 13:** Planner Redesign (13-01-PLAN.md — COMPLETE)
- **Phase 14:** Knowledge Graph Classification & Anchor Nodes (14-01-PLAN.md — COMPLETE, 14-02-PLAN.md — COMPLETE, 14-03-PLAN.md — COMPLETE, 14-04-PLAN.md — COMPLETE)

## Latest Decisions (Phase 27-05)

- [Phase 27-05] All 13 `.tsx` files in `app/src/screens/` now import `useTranslation()` and render user-visible strings via `t()` — completes D-10 screen-layer extraction (complement to Plan 06's components + service-layer extraction)
- [Phase 27-05] 464 new flattened keys added to en.json (138 → 602 total): home.bento.*, planner.toast.*, ask.* (drawer, history, welcome, suggestedPrompts, rateLimit, postThread), review.library.*/miniMap.*/session.*/done.*, graph.* (reorganizeModal, selected, toast, anchor, cluster), podcast.* (player, generateCard, knowledgeToday, insertBanner, toast), settings.* (14 sub-namespaces: sections, fields, descriptions, placeholders, providerLabels, voices, themes, toast, confirm, test, planner, buttons, cacheStats, usageTable, zerotier, about), onboarding.welcome/consent/llm.*, posts.detail/qa/connection/image.*, questionDetail.*
- [Phase 27-05] zh/es/ja bundles mirrored with EN-duplicate values for all 464 new keys — bundle-parity test green; Plan 07 Sonnet subagent translates
- [Phase 27-05] Cross-locale branded labels in OnboardingScreen language step (Plan 03 output) preserved verbatim per D-18/D-19: "Language / 语言 / Idioma / 言語" header, "Continue · 继续 · Continuar · 続ける" button, 4 per-option autonyms (English/简体中文/Español/日本語), and "Choose your language · 选择语言 · Elige tu idioma · 言語を選択" subheader — NEVER enter en.json
- [Phase 27-05] Pluralization via explicit countOne/countOther key pairs selected by ternary at call site — cleaner for Plan 07 translators than i18next plural suffix system, downstream code idiomatic JS (9 pluralization sites)
- [Phase 27-05] Imperative `i18n.t()` used in 3 module-scope / outside-hook contexts: (a) AskScreen toast inside useCallback with `[]` deps (avoids stale-closure), (b) GraphScreen buildMindElixirData root label (function called during effect setup), (c) PostDetailScreen skeleton post construction inside useEffect (before first render)
- [Phase 27-05] HomeScreen local `const t = today()` renamed to `todayDate` to avoid collision with useTranslation's `t`
- [Phase 27-05] AskScreen SUGGESTED_PROMPTS converted to SUGGESTED_PROMPT_KEYS (module-scope array of key paths); component renders via `t(key)` at mount for translation reactivity
- [Phase 27-05] HomeScreen MILESTONE_POOL (5 static trivia/milestone content cards) deliberately left hardcoded — content blurbs vs UI chrome distinction; documented deferral to future content-localization phase
- [Phase 27-05] AskScreen LLM system prompts in generateSessionTitle hardcoded in EN per D-07 — EN prompts give LLM better instruction comprehension; ask.titleSystemPrompt keys exist in en.json as future option but code uses literal for LLM-quality stability
- [Phase 27-05] Provider model names (e.g., gpt-4o, claude-sonnet-4-6, gemini-3.1-flash-image-preview, llama3) left hardcoded — proper-noun technical identifiers
- [Phase 27-05] SettingsScreen test-result strings keep '✓'/'✗' emoji prefix — downstream color logic `.startsWith('✓')` depends on it; only trailing "Failed"/"Empty vector"/"No API keys configured" fallbacks translated
- [Phase 27-05] Interpolation placeholders: {{count}} (14 sites for plurals), {{minutes/progress/ms}} (timing), {{revealed}}+{{total}} (mini map), {{reviewed}}+{{total}} (session), {{title}}+{{concept}} (move breadcrumbs + learn-as-post titles), {{error}}+{{message}} (error passthroughs), {{limit}}+{{resetDate}} (rate limits), {{mb}}+{{size}} (cache stats), {{server}} (zerotier blurb), {{anchorCount}}+{{qaCount}} (graph selected), {{clusterCount}}+{{anchorCount}} (graph reorganize toast), {{summary}} (settings planner check-in), {{date}} (usage table)
- [Phase 27-05] Wave 3 solo executor — ran after Plan 03 (Onboarding language step) was committed; no file-level coordination conflicts
- [Phase 27-05] Pre-existing tsc errors (8, from Plan 01 deferred-items.md) remain — zero new tsc errors introduced; `npx vite build` green; `node --test` on all 5 locale-related test files (bundle-parity, missing-key, data-locale-attr, settings-locale, locale-detect) passes 15/15
- [Phase 27-05] Plan met acceptance: (a) all 13 screen files contain `useTranslation` import + at least one `t(` call, (b) bundle-parity test green, (c) OnboardingScreen cross-locale labels grep-positive, (d) vite build green

## Latest Decisions (Phase 27-02)

- [Phase 27-02] `applyLocaleDirective` extracted to `app/src/providers/llm/locale-directive.ts` (standalone module) — `providers/llm/index.ts` re-exports it for backward-compat; called once at top of `chatCompletion` and `chatStream` (2 sites). Extraction driven by Node 25 JSON-import-attribute failure chain: the provider index transitively imports `token-usage.service` → JSON bundles which Node 25 rejects without `with { type: 'json' }`; standalone module imports `i18next` directly and can be node:test-loaded.
- [Phase 27-02] `LOCALE_NAMES` duplicated inside `locale-directive.ts` (4 entries) to avoid importing `src/locales/index.ts` (same JSON-chain reason). Documented "keep in lockstep" comment. Literal `'Simplified Chinese'` used (not `'Chinese'` or `'zh-CN'`) to steer LLMs away from Traditional/Cantonese defaults.
- [Phase 27-02] Idempotency: `applyLocaleDirective` uses `existing.content.includes(directive)` substring check; prevents double-inject when called twice (asserted by Task 1 test 3).
- [Phase 27-02] Same extraction pattern applied to YouTube: `buildYoutubeSearchUrl` in `app/src/services/youtube-locale-url.ts` with `YOUTUBE_LOCALE_PARAMS` map; `youtube.service.ts` delegates URL construction via 1-line call. Enables `youtube-locale.test.mjs` to run under `node --test` directly.
- [Phase 27-02] TTS `LOCALE_VOICE_FALLBACK` kept INLINE in `providers/tts/index.ts` (not extracted) — TTS module is NOT in the JSON-import failure chain so no extraction needed; inline map is simplest. Voice map: en=alloy, zh/es/ja=nova.
- [Phase 27-02] TTS user-override respect: `config.voice && config.voice !== 'alloy'` → honor user's Settings pick as-is regardless of locale; only the default `'alloy'` gets locale-remapped. Prevents surprise-override when user explicitly picked a voice in Settings.
- [Phase 27-02] YouTube locale params: en→hl=en-US/regionCode=US/relevanceLanguage=en; zh→hl=zh-CN/CN/zh; es→hl=es/ES/es; ja→hl=ja/JP/ja. Transcript-fetch Accept-Language header left unchanged (documented known limitation per RESEARCH.md — out of scope).
- [Phase 27-02] Tavily web-search.service.ts has ZERO diff — D-15 neutrality enforced by `app/tests/services/web-search-no-locale.test.mjs` with 10-marker FORBIDDEN list + URL param guard. Test asserts that under `i18n.language='zh'` AND `i18n.language='ja'`, the Tavily request body contains none of `'Simplified Chinese'|'Spanish'|'Japanese'|'"locale"'|'"hl"'|'"regionCode"'|'"relevanceLanguage"'|'"lang"'|'"language"'|'zh-CN'|'ja-JP'|'es-ES'` and URL has no `[?&](hl|locale|lang|regionCode|relevanceLanguage)=` params.
- [Phase 27-02] `date.ts` imports `i18next` directly (not `'../locales'`) — same Node 25 JSON-chain reason; runtime behavior identical (singleton instance configured at app startup). Exports `currentIntlLocale()` helper consumed by `ask-rate-limiter.service.ts` to replace hardcoded `'en-US'`.
- [Phase 27-02] INTL_LOCALE map in date.ts: en→en-US, zh→zh-CN, es→es-ES, ja→ja-JP. Unknown locale (e.g. 'ko') falls back to 'en' → 'en-US'.
- [Phase 27-02] `formatDate` + `formatDateLabel` use `Intl.DateTimeFormat` via `toLocaleDateString(currentIntlLocale(), …)`; `formatDateLabel` today-case uses `i18next.t('common.today')`; `getGreeting()` uses `i18next.t('common.greeting.morning|afternoon|evening')`.
- [Phase 27-02] 5 Wave 0 skeletons filled with live tests: llm-locale-injection (5 cases), tts-locale (3), youtube-locale (5), web-search-no-locale (3), date.locale (6). 40-test Wave 0 suite green.
- [Phase 27-02] Executor continuity: Task 3 (D-11) work was present in working tree after a prior executor was interrupted post-Task-2; continuation agent verified tests + committed as `dc8455a7` with explicit file paths (no `-A`) to avoid capturing parallel Plan 27-06 files.
- [Phase 27-02] Pre-existing tsc errors (8, from Plan 01 deferred-items.md) remain — zero new errors in files touched by this plan.

## Latest Decisions (Phase 27-06)

- [Phase 27-06] D-10 structural extraction complete for components layer — 18 tsx files + 6 service-layer toast() call sites + 1 React hook (usePlannerAutoGen) now t()/i18n.t()-driven
- [Phase 27-06] Non-React module i18n pattern: `import i18n from '../locales'; toast(i18n.t('common.toast.X'))` — applied to session/flashcard/podcast/question/scheduler services and ErrorBoundary class component; reads `i18next` singleton so locale switches propagate immediately
- [Phase 27-06] React-hook i18n pattern: `useTranslation()` + include `t` in useCallback deps (usePlannerAutoGen.accept, .refresh) — prevents stale-closure locale after runtime language switch
- [Phase 27-06] components/ui/* (Button, Card, Header, Badge, ProgressBar, Skeleton, BottomSheet, Toast) audited: NO hardcoded user-visible strings — primitives accept labels via props, parents own translation. Zero extraction needed.
- [Phase 27-06] Brand "EchoLearn" deliberately NOT translated (CONTEXT Pitfall 5) — preserved as-is everywhere
- [Phase 27-06] 118 new flattened keys added to en.json (20 → 138 total): common.nav.*, common.action.*, common.toast.* + 13 new component sub-namespaces (chatInput, chatMessage, conceptCard, flashcard, infoFlow, portalCard, postCarousel, pullUpHint, youTubeEmbed, errorBoundary, feedPostImage, detailMenu, planner.trellis)
- [Phase 27-06] zh/es/ja bundles parity-mirrored with EN-duplicate values — Plan 07 Sonnet subagent replaces values; bundle-parity test green today
- [Phase 27-06] Interpolation placeholders: {{count}} for pluralization (harvestAria, pruned), {{label}} for contextual nouns (confirmPrompt), {{message}} for error passthroughs (transcriptionFailed), {{channel}} (infoFlow.byChannel), {{current}}/{{total}} (postCarousel), {{count}} (postsWaiting/conceptsCount/etc.)
- [Phase 27-06] TrellisStatusPanel padding tweak (12px 16px → 12px 0) carried over from pre-existing working tree edit (Phase 28 UI audit session orphan) — absorbed into Task 2 commit rather than reverting to avoid cross-plan file contention; flagged in SUMMARY
- [Phase 27-06] Executor interruption recovery: Task 1 (commit `21e87579`) landed before interruption; Task 2 work was present in uncommitted working tree and verified via tsc + vite build + bundle-parity before committing as `b7ac54cf`

## Latest Decisions (Phase 27-03)

- [Phase 27-03] CSS `--font-sans` CSS variable added alongside legacy `--font-family` (non-breaking); body font-family in `@layer base` now reads `var(--font-sans)` so locale cascade flows to body + inherited descendants
- [Phase 27-03] `:root[data-locale="zh"]` / `:root[data-locale="ja"]` overrides kept UN-LAYERED (outside any @layer directive) so Tailwind 4's cascade always resolves them over `@layer base` defaults — mitigates RESEARCH.md Pitfall 4 without !important
- [Phase 27-03] zh font stack: `system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`; ja: `system-ui, -apple-system, 'Hiragino Sans', 'Yu Gothic', Meiryo, sans-serif`; es reuses :root default (Latin stack); no webfont downloads
- [Phase 27-03] `LOCALE_CHANGED` added to `AppEvent` union at line 663 of `types/index.ts` (between `TTS_CONFIG_CHANGED` and `ZEROTIER_STATUS_CHANGED` — settings-subsystem grouping); payload `{ locale: SupportedLocale }` — Plan 04 mid-stream abort dependency
- [Phase 27-03] OnboardingScreen Step union extended: `'welcome' | 'language' | 'consent' | 'llm'`; language step inserted between welcome and consent
- [Phase 27-03] LOCALE_OPTIONS readonly tuple hoisted to module scope — autonym labels: English / 简体中文 / Español / 日本語
- [Phase 27-03] Header shown in all 4 scripts (`Language / 语言 / Idioma / 言語`) so user recognizes step regardless of current i18n state
- [Phase 27-03] `selectedLocale` state seeded via `useState` lazy initializer from `i18n.language` (synchronous) + refined via `useEffect(detectDeviceLocale)` (async) — first paint highlights a real option, no 1-frame FOUC
- [Phase 27-03] `handleConfirmLanguage`: `i18n.changeLanguage(locale)` awaited → `eventBus.emit LOCALE_CHANGED` → `setStep('consent')` — event emit AFTER i18n state coherent
- [Phase 27-03] NO mid-step localStorage write in handleConfirmLanguage (single write path via handleSkip/handleContinue) — avoids orphaned preferences if user force-quits mid-onboarding
- [Phase 27-03] handleSkip + handleContinue write both `locale: selectedLocale` AND `language: selectedLocale` (legacy back-compat per Plan 01 migration contract) to preferences
- [Phase 27-03] Consent step back button routes to `language` (not `welcome`) — user who picked a language can revisit without reseeing splash
- [Phase 27-03] Types test expanded: added `LOCALE_CHANGED` subscribe/emit test to `tests/types.appevent.test.mjs` (mirrors existing REVIEW_COMPLETED/CLASSIFICATION_COMPLETED/ANCHOR_DELETED tests)
- [Phase 27-03] Ran in parallel with 27-02 and 27-06 executors using `--no-verify` commits; only staged files touched by this plan

## Latest Decisions (Phase 27-01)

- [Phase 27-01] i18next@26.0.5 + react-i18next@17.0.3 + @capacitor/device@8.0.2 installed; sync init from main.tsx (side-effect `import './locales'` before createRoot) — no Suspense flash
- [Phase 27-01] Static-imported 4 JSON bundles (en canonical, zh/es/ja parity stubs duplicating EN values — Plan 07's Sonnet subagent replaces values); bundle-parity test green today
- [Phase 27-01] Type-safe t() via module augmentation (Option A from RESEARCH.md) — typo in `t('home.titlee')` fails tsc compile
- [Phase 27-01] TDD inversion: lib/locale.ts landed in Task 1 (not Task 2) because locales/index.ts imports it and Task 1 acceptance requires tsc/build exits 0; Task 2 retrofits TDD test coverage
- [Phase 27-01] UserPreferences.locale staged optional (Task 1) → required (Task 3) so each task commit compiles standalone; legacy `language` kept as @deprecated for one-time migration only
- [Phase 27-01] Legacy migration in settings.service.load(): if stored `preferences.language` exists and `locale` is missing, normalize (toLowerCase, split-'-', allowlist check) to 'en'/'zh'/'es'/'ja'; unsupported → 'en'
- [Phase 27-01] SUPPORTED_LOCALES duplicated in lib/locale.ts to break circular import with locales/index.ts (per plan Task 2 NOTE)
- [Phase 27-01] SupportedLocale inlined in types/index.ts (no cross-module dependency from types/ to locales/)
- [Phase 27-01] resolveJsonModule + allowSyntheticDefaultImports added to tsconfig.app.json for JSON imports under strict verbatimModuleSyntax
- [Phase 27-01] Node 25 globalThis.navigator is a read-only getter; tests use Object.defineProperty with configurable:true for shimming (also applied to globalThis.localStorage)
- [Phase 27-01] Wave 0 suite: 11 test files total (4 live + 6 Plan-02/04 skeletons + 1 TDD via Task 2); 21 live cases pass in ~280ms; 6 skeletons have placeholder assertions with TODO markers
- [Phase 27-01] Pre-existing Node 25 TS-stripping failures (affecting tests that transitively import src/providers/llm/index.ts → token-usage.service) logged to deferred-items.md, out of scope
- [Phase 27-01] Pre-existing 8 tsc errors in GraphScreen/canonical-knowledge/review/trellis-state files — not introduced by Phase 27-01; logged to deferred-items.md

## Latest Decisions (Phase 28)

- [Phase 28 Amendment A — 2026-04-16] Dedicated padding audit identified MAJOR spacing inconsistency; user locked 4 new decisions D-26..D-30 expanding Wave B scope
- [Phase 28 D-26] Introduce 8 CSS custom properties in index.css: --space-xs/sm/md/lg/xl/2xl/3xl (4/8/12/16/20/24/32px 4-grid) + --bottom-nav-safe (calc(80px + safe-area-bottom)) + --section-gap (24px alias)
- [Phase 28 D-27] All sub-screens migrate to paddingBottom: var(--bottom-nav-safe) — fixes iOS notch/Android gesture-zone failures on 7 screens that hardcode 96px; fixes GraphScreen 16px bug; unifies PostDetailScreen dual-value bug
- [Phase 28 D-28] Surgical off-grid fixes: 11px→12px (PlannerScreen:179,:225, AskScreen:570,:607), 32px 28px→32px 24px (PostDetailScreen card), flashcard asymmetric→uniform 16px (ReviewScreen:57,:141). No mass refactor — only co-located with already-touched files.
- [Phase 28 D-29] WCAG 2.5.8 touch-target fix for 4 failing elements: Header back button, PlannerScreen:205 scissors, AskScreen:718 flag, Badge (conditional when onClick present). Broader a11y sweep stays deferred.
- [Phase 28 D-30] Section vertical rhythm locked to symmetric var(--section-gap) (24px); intra-section title-to-content stays at 12px (intentional typographic hierarchy). Card default 20px preserved; new overrides require justification comment.
- [Phase 28] Scope = full audit (Waves A+B+C+D) per user selection; P0 showstoppers, visual chrome, trellis interaction + naming, P2 micro-polish all included
- [Phase 28] A-2 SwipeTabContainer desync root cause hypothesis: screenWidthRef captured once, never refreshes on visualViewport resize (keyboard/rotation/browser chrome); fix = resize + visualViewport.resize listeners + re-snap stripX when not mid-gesture + dev invariant
- [Phase 28] Sub-screen bottom nav hides via slide-down animation (~200ms spring, reusing SwipeTabContainer SPRING constant) when isTopLevelScreen=false; 5 screens stay mounted per Phase 22 D-11
- [Phase 28] Sub-screen Header gets scroll-aware shadow (--shadow-1 when scrollTop > 4px); background already opaque --surface, no border needed
- [Phase 28] Trellis leaf shake = 300ms rotate variant (0° → +4° → -4° → +2° → 0°) + hapticImpactLight on tap (any state); purely decorative, no tooltip/nav/sheet — preserves "no new mental model"
- [Phase 28] Trellis pulse-on-focus = scale 1→1.15→1 (600ms) + drop-shadow glow (--primary-40, 2s fade) when Suggested Move row tap matches anchorId; clears on action or navigate
- [Phase 28] Leaf animation perf guard: when leaves.length > 30, shake/pulse run only on viewport-visible leaves (IntersectionObserver or whileInView) — extends Phase 25 D-55 convention
- [Phase 28] "Mind Map" → "Knowledge Graph" rename via graph.title key in all 4 locale bundles (en/zh/es/ja) using Phase 27 Sonnet-subagent workflow; graceful degradation to direct string edit + TODO comment if Phase 27 key-extraction hasn't run
- [Phase 28] Withdrawn audit findings (Dev Mode default, Suggested Moves debug labels, harvest chip decrement) NOT in scope — were Dev-Mode-enabled artifacts, not bugs
- [Phase 28] Depends on Phase 27 (i18n scaffold); planner may split into 2 plans (A+B, then C+D)

## Latest Decisions (Phase 26-04)

- [Phase 26-04] PlannerScreen Suggested Moves refactored to trellis-first ordering: dead (Re-plant) → dying (Heal) → filtered autoGen; suggestedChunks/ChunkCard system deleted entirely (D-22)
- [Phase 26-04] dyingDeadIds Set built per render filters autoMoves by conceptId — deterministic dedup (D-23) without service-layer changes to plannerAutoGen
- [Phase 26-04] deadNodes/dyingNodes/filteredAutoMoves derived as plain const (no useMemo) — cheap filters on small layout.nodes list, correct re-derivation on every render
- [Phase 26-04] visibleAutoMoves uses `Math.max(0, TOP_N - trellisCount)` to keep TOP_N total visible across priority groups (never negative)
- [Phase 26-04] usePlanner hook marked @deprecated (not deleted) — retains compatibility for lingering imports while signalling removal intent
- [Phase 26-04] Skip-all button gated on filteredAutoMoves.length (not autoMoves.length) so it hides when only trellis rows remain — trellis rows require explicit Heal/Prune/Re-plant per D-11..D-18
- [Phase 26-04] Ripe fruits (leafState === 'fruit') excluded from Suggested Moves by filter construction — harvesting remains exclusive to TrellisStatusPanel (D-21)

## Latest Decisions (Phase 26-03)

- [Phase 26-03] heal()/replant() return navigation intents ({ navigateTo, state }) instead of calling navigate() — keeps service pure, component owns sheet-close timing
- [Phase 26-03] replant() resets BOTH flashcard schedules (authoritative per fcMap in computeLeafState) AND Question.lastReviewedAt (fallback signal) so anchor can return to 'bud' state
- [Phase 26-03] replant() awaits conceptFeedService.generateMorePosts wrapped in try/catch so post generation never blocks review navigation
- [Phase 26-03] prune() reuses existing ANCHOR_DELETED event instead of defining PRUNE_COMPLETED — same trellis recompute path, reversible via unpruneQuestion
- [Phase 26-03] unpruneQuestion() emits CLASSIFICATION_COMPLETED with empty anchorName — subscriber only uses event type for recompute, payload is cosmetic
- [Phase 26-03] Prune animation delays flagged flip by 800ms (300ms scissors cut + 500ms leaf fall) so visual completes before row disappears
- [Phase 26-03] Pruned archive lives below the 3-column panel (not inside a sheet) so archive count is always visible
- [Phase 26-03] Two-button row layout (primary action + Prune) extracted as renderActionableItem closure — shared between dying and dead sheets

## Latest Decisions (Phase 26-02)

- [Phase 26-02] Dying bucket = leafState yellow ∪ falling (D-08) — merged into a single "needs attention" column
- [Phase 26-02] Fruit glow pulses via scoped `<style>` + status-glow keyframe; only active when fruitNodes.length > 0
- [Phase 26-02] Fly-to-counter vector measured at click time (getBoundingClientRect on both panel and counter refs) so layout shifts don't strand particles
- [Phase 26-02] Particle count capped at Math.min(count, 8) to avoid visual noise on large harvests
- [Phase 26-02] Celebration choreography unified per D-03: 1s fly-to-counter → 1.2s delay → 3.5s confetti
- [Phase 26-02] Computed-key cast `['--fly-dx' as string]` preferred over `@ts-expect-error` (noUnusedLocals flags the directive as unused when the `as CSSProperties` cast already widens the type)
- [Phase 26-02] Header counter is a `<span ref={counterRef}>` inside a pill div so getBoundingClientRect targets the number glyph, not pill padding

## Latest Decisions (Phase 26-01)

- [Phase 26-01] Credits service stores plain integer strings in localStorage (not JSON) for single-counter simplicity
- [Phase 26-01] BottomSheet overlay uses zIndex 500 to clear app Header at zIndex 190; inline-styles-only convention preserved
- [Phase 26-01] getPrunedQuestions requires both flagged && isAnchorNode so off-topic Q&A flag does not pollute pruned anchor archive
- [Phase 26-01] trellisCreditsService.add clamps to non-negative integers via Math.floor+Math.max to defend against bad callers
- [Phase 26-01] HARVEST_COMPLETED placed after ANCHOR_DELETED in AppEvent union for logical grouping with trellis events

## Latest Decisions

- Redesign Home Feed to image-forward (Rednote-style) with emoji/text overlays
- Generate multiple image styles per post (infograph, illustration, photo-style)
- Multi-provider image integration (Nano Banana + Gemini)
- Scroll-release (explicit action) to load more posts
- Post detail page with image carousel (multiple generated images)
- Auto-generate Planner suggestions when Knowledge Graph has 5+ nodes AND Planner is empty
- Daily auto-refresh after podcast time
- 3+ distinct milestone card designs with rotation
- All image generation failures handled gracefully with retry options
- [Phase 7] NanoBanana provider is a structurally complete placeholder with mock SVG fallback
- [Phase 7] Image cache uses localStorage LRU (50MB/30d TTL), no SQLite (consistent with app-wide pattern)
- [Phase 7] ConceptCard owns image generation lifecycle (useEffect) rather than HomeScreen
- [Phase 8] PostCarousel uses Framer Motion drag=x with 50px threshold (no custom touch listeners)
- [Phase 8] infiniteScrollService wraps conceptFeedService.generateMorePosts() (no new batch API)
- [Phase 8] HomeScreen wrapped in 100dvh scroll container for containerRef attachment
- [Phase 8] questionsRef pattern for stable onLoadMore callback (prevents scroll listener reset)
- [Phase 10-02] useDailyRefresh called without return capture in PlannerScreen to satisfy noUnusedLocals TypeScript config
- [Phase 10-02] savePlannerRefreshEnabled/Time wrappers persist settings immediately to localStorage on every change

## Latest Decisions (Phase 10-03)

- [Phase 10-03] totalSuggestions hoisted to component level (not IIFE) so CTA can reference it outside the section block
- [Phase 10-03] handleSkipAll wraps skipAll() + toast so UAT Test 6 Skip All toast is verifiable
- [Phase 10-03] Refresh button always rendered (no autoMoves.length guard) so UAT Test 7 Refresh is always accessible
- [Phase 12-01] Centralized move routing in moveNavigator.ts utility (not inline in components)
- [Phase 12-01] MoveNavigationState passed via location.state (React Router 7 pattern)
- [Phase 12-01] ReviewScreen filters items by linkedResource.id (nodeId match) when from move navigation
- [Phase 12-01] PostDetailScreen back button navigates to -1 when moveState present (returns to Planner)
- [Phase 12-02] deepdive moves route to PostDetailScreen at /posts/:id (not AskScreen at /ask/:id)
- [Phase 12-02] NAV-01 and NAV-02 registered in REQUIREMENTS.md as checked [x] — implemented in Phase 12

## Last Session

Completed Phase 28 Plan 01 (28-01-PLAN.md) — Wave A/B/B-spacing UI/UX polish foundation. Landed 9 CSS custom properties (D-26: `--space-xs..3xl` + `--bottom-nav-safe` + `--section-gap`) on `:root`; SwipeTabContainer desync fix (D-05: `window.resize` + `window.visualViewport.resize` listeners re-snap `stripX`, hardened useLayoutEffect refreshes `screenWidthRef` before reading, dev invariant warns on >2px drift); BottomNavigation slide-down via `motion.nav` + SLIDE_SPRING matching SwipeTabContainer's SPRING (D-06: `isTopLevelScreen` prop toggles y: 0 ↔ '100%', `initial={{y:0}}` prevents first-mount flash); Header scroll-shadow via `HeaderScrollContext` published from App.tsx Outlet `onScroll` (D-07: 4px threshold, 150ms ease-out transition); 10 sub-screens' paddingBottom unified on `var(--bottom-nav-safe)` (D-27: fixed GraphScreen 16px bug, PostDetailScreen dual-value bug, HomeScreen safe-area-top-in-paddingBottom bug); 7 off-grid pixel values normalized (D-28: 11→12 row padding on Planner + Ask, 32×28→32×24 on PostDetail card, Review flashcard Q/A asymmetry → uniform 16px); 4 touch targets to WCAG 44×44 (D-29: Header slots component-level — benefits all back buttons; Planner scissors; Ask flag; Badge conditional on onClick); PlannerScreen section rhythm (D-30: symmetric `var(--section-gap)` boundaries, 12px intra-section preserved) + Suggested Moves h2 visual polish (D-04: 1rem/600 weight, letterSpacing -0.01em). Pure helpers `computeTargetX` + `getNavYTarget` exported for node --test coverage (Wave 0). 18/18 Wave 0 tests green; `npx vite build` green in 3.03s; zero new tsc errors. 2 auto-fixes: HomeScreen paddingBottom arithmetic bug (Rule 1), Node 25 `-0` assert.equal quirk in test (Rule 3). Commits: `38e64309`, `efbb2f7f`, `58cfec24`. Plans 28-02 + 28-03 remain pending.

### Previous session

Completed Phase 27 Plan 07 autonomous tasks (27-07-PLAN.md) — Task 1 landed project-root `CLAUDE.md` with durable i18n Workflow section (D-09: namespaces, bundle paths, EN-first rule, Sonnet subagent workflow, no-runtime-LLM-translation rule, what-NOT-to-translate allowlist) + `app/scripts/translate-locales.md` copy-paste-ready Sonnet subagent prompt template. Task 2 translated zh.json (92.7%), es.json (90.2%), ja.json (92.4%) leaf coverage — remaining ~8-10% are proper nouns / URLs / model IDs / emoji prefixes / EN LLM system prompts / cross-locale branded labels, all deliberate per D-07/D-18 and `what NOT to translate`. All 602 keys parity-intact; bundle-parity test green; 40/40 Wave 0 tests green; `npx vite build` green (3.08s); interpolation placeholders preserved verbatim across all keys × all 3 locales; proper nouns (EchoLearn, OpenAI, Claude, Gemini, YouTube, Tavily, Nano Banana, ZeroTier) grep-positive in every non-EN bundle. Also marked 27-VALIDATION.md frontmatter status=ready, nyquist_compliant=true, wave_0_complete=true. Authored UAT walkthrough template at `uat-screenshots/README.md` (16-screen × 4-locale coverage matrix + walkthrough instructions + flags-to-file list + known-safe notes). Deviations: (1) executor-inline translation instead of Task-tool Sonnet subagent spawn — environment has no Task tool, D-07 constraint satisfied identically by dev-time human-in-the-loop executor translation with 4 automated validation gates, template remains Task-tool-shaped for future re-runs; (2) UAT walkthrough template authored instead of physical screenshot capture — physical operator action cannot be executor-automated, `uat-screenshots/README.md` codifies the walkthrough as Task 3's checkpoint:human-verify gate awaiting `approved` reply. Commits: `bfe989d6` (docs — CLAUDE.md + scripts/translate-locales.md), `6015baba` (feat — zh/es/ja translations), `6edd8da5` (docs — validation frontmatter + UAT template).

---

## Previous Session

Completed Phase 27 Plan 04 (27-04-PLAN.md) — Locale switcher + mid-stream abort. SettingsScreen gains a 4-language picker at the top (D-19) that calls `i18n.changeLanguage`, persists `preferences.locale` (+ legacy `language` back-compat), and emits `LOCALE_CHANGED`. Row LABEL hardcoded as `Language / 语言 / Idioma / 言語` for cross-locale affordance. `providers/llm/index.ts` gains `CompletionOptions.signal?: AbortSignal` + a `composeSignal(callerSignal, ms)` helper that uses `AbortSignal.any` (Chromium 116+ / Safari 17.4+ / Node 20+) with manual-forwarder fallback; signal threaded through all 7 fetch call sites (openAI completion/stream, claude completion/stream, gemini completion/stream, plus localPost for Android-local streaming). `useQuestions.askStreaming` declares ONE shared AbortController at the top of the try, subscribes to LOCALE_CHANGED once, passes the same signal to BOTH Pass 1 and Pass 2 chatStream calls, and guards every buildAndSave path with 6 aborted-checks (loop entries, post-loop, pre-persistence, catch-level AbortError short-circuit) — toasts `ask.localeChangedDiscarded` and returns null on abort so partial half-English/half-Japanese output never persists (D-22). TDD cadence: RED commit landed failing test first, GREEN commit made all 4 assertions pass. 48 Wave 0 tests green; `npx vite build` green (3.0s); zero new tsc errors. Deviations: used direct `settingsService.getSync/.set` instead of `useSettings` hook (matches existing SettingsScreen convention); added `callerSignal?` param to `localPost` (LOCALE_CHANGED was silently not cancelling Android-local completions otherwise); removed dead `void options;` statements from claudeStream + geminiStream. Commits: `da5c69b5` (Task 1 — locale switcher), `c93ecf46` (Task 2 RED — failing test), `7e301831` (Task 2 GREEN — provider plumbing + useQuestions abort).
**Stopped At:** Completed 31-03-PLAN.md
**Date:** 2026-04-16

## Latest Decisions (Phase 25)

- [Phase 25-00] questionService imported at top-level in review.service.ts (already present), no dynamic import needed for anchor resolution
- [Phase 25-00] REVIEW_COMPLETED emitted synchronously after REVIEW_SUBMITTED using existing questionService.getAll() for anchor lookup
- [Phase 25-00] Blossom date service uses trellis_blossom_dates localStorage key, separate from review schedule storage
- [Phase 25] Variant V (video background) removed — user decided against video background variant; only A (image) and C (SVG) remain
- [Phase 25] Learning Check-In section removed from PlannerScreen — redundant with Ask screen; users go there to explore topics
- [Phase 25] Leaf state reads FlashCard review data (via flashcardService.getAll()) as authoritative source — Question.reviewSchedule is never updated by the review flow
- [Phase 25] Legacy questions (not classified as anchors) rendered as standalone trellis leaves with their own state
- [Phase 25] Vine colors use natural green/brown hex tones (#6B8E5A, #8B7355, etc.) not rainbow --node-* CSS vars
- [Phase 25] Background Variant C: diamond cross-hatch lattice with wooden rails, not rectangular grid
- [Phase 25] Leaf shapes are Ghibli-style botanical silhouettes (pointed leaves with veins, sakura blossom, apple fruit) — not colored dots
- [Phase 25] Leaf stems connect to vine via branch lines and rotate toward vine attachment point (stemAngle from layout service)
- [Phase 25] Leaf shapes scaled 1.8x for visibility in 800x400 viewBox

## Latest Decisions (Phase 16-03)

- [Phase 16-03] serviceName tags across all 15 LLM call sites: ask(x3 — useQuestions, question.service, post-context-qa), filter(x1), classification(x2, preserving maxTokens:8192 on reorganization call), posts(x4 — concept-feed), planner(x2), podcast(x1), flashcards(x1), title(x1 — AskScreen generateSessionTitle)
- [Phase 16-03] Token Usage state initialized via useState lazy initializer (not useEffect) — loads once at mount; explicit Refresh button for re-pull pattern
- [Phase 16-03] handleClearTokenUsage sets local state to {} immediately after tokenUsageReporter.clear() for instant UI feedback without re-reading localStorage

## Latest Decisions (Phase 16-02)

- [Phase 16-02] LocalTokenUsageReporter uses FIFO eviction at 500 records — prevents unbounded localStorage growth
- [Phase 16-02] Usage recording conditional on serviceName — no-op for existing callers; serviceName tagging happens in Plan 03
- [Phase 16-02] Streaming functions accept options pass-through (void options) for future SSE usage extraction
- [Phase 16-02] tokenUsageReporter singleton exported from token-usage.service.ts — swap LocalTokenUsageReporter for remote implementation without touching call sites

## Latest Decisions (Phase 15-03)

- [Phase 15-03] ClusterDetailScreen child anchor lookup uses clusterNodeId primary + branchLabel/clusterLabel fallback for legacy anchors
- [Phase 15-03] clusterReview state passed via navigate for ReviewScreen to filter cards across all child anchor Q&As
- [Phase 15-03] Priority chain in ReviewScreen: anchorFilteredItems ?? clusterFilteredItems ?? moveFilteredItems
- [Phase 15-03] AnchorDetailScreen cluster breadcrumb is tappable only when clusterNodeId exists; legacy anchors stay static span

## Latest Decisions (Phase 15-02)

- [Phase 15-02] buildMindElixirData uses cluster.clusterEntity?.id as NodeObj id (falls back to synthetic ID for clusters without stored entity)
- [Phase 15-02] Bottom panel onClick checks isClusterNode first before isAnchorNode — navigates to /cluster/:id
- [Phase 15-02] Cluster bottom panel shows child anchor names as summary instead of raw cluster label
- [Phase 15-02] childAnchorCount computed inline via IIFE to avoid hoisting to component scope

## Latest Decisions (Phase 15-01)

- [Phase 15-01] Cluster nodes stored as Question entities with isClusterNode=true, mirroring isAnchorNode pattern
- [Phase 15-01] clusterNodeId field added to anchor/Q&A nodes pointing to parent cluster entity ID
- [Phase 15-01] freshQuestions local variable refreshed after cluster creation so anchor resolution sees new cluster
- [Phase 15-01] Cluster entity creation occurs before anchor creation in classifyAndAnchor
- [Phase 15-01] Cluster qaCount aggregated from child anchors filtered by clusterNodeId after anchor update
- [Phase 15-01] buildAnchorReflectionTree skips isClusterNode nodes in both loops; returns clusterEntity per group

## Latest Decisions (Phase 14-04)

- [Phase 14-04] classifyAndAnchor imported directly in useQuestions.ts — no circular dependency since useQuestions.ts is not in canonical-knowledge.service.ts import chain
- [Phase 14-04] questionService.getAll() called at classification time in askStreaming for freshest snapshot (includes just-saved question)
- [Phase 14-04] Fire-and-forget pattern with .catch(console.warn) mirrors question.service.ts ask() exactly

## Latest Decisions (Phase 14-03)

- [Phase 14-03] buildAnchorReflectionTree added alongside buildReflectionTree — mindmap renders anchors as collapsed cluster leaves with Q&A children
- [Phase 14-03] Anchor NodeObj uses expanded=false; mind-elixir built-in expand/collapse requires no extra code
- [Phase 14-03] Legacy Q&As without anchor parents rendered directly as cluster leaves — full backward compatibility
- [Phase 14-03] Detail panel cursor:default and no 'View details' chevron for anchor nodes to signal non-navigable

## Latest Decisions (Phase 14-02)

- [Phase 14-02] classifyAndAnchor lazy-imports questionService via dynamic import to prevent circular dependency
- [Phase 14-02] Second classification call fire-and-forget after flagged check — labels patched asynchronously
- [Phase 14-02] Anchor creation writes directly to localStorage (same echolearn_questions key) to avoid re-entrant ask() logic
- [Phase 14-02] loadStore() called fresh at classifyAndAnchor invocation time for most current snapshot
- [Phase 14-02] Anchor-first resolution: by anchorId → by name+cluster match → create new

## Latest Decisions (Phase 14-01)

- [Phase 14-01] IngestionDecision stripped to outcome+targetNodeId only — labels come from dedicated second call (Plan 02)
- [Phase 14-01] First LLM call schema now requests shortSummary (<=80 words) instead of knowledgeDecision
- [Phase 14-01] formatCandidateContextPack feedback loop removed from ask() system prompt — was source of vague branch names
- [Phase 14-01] Anchor nodes excluded from projectQuestionsToKnowledgeNodes via isAnchorNode===true guard
- [Phase 14-01] ClassificationResult interface exported with anchorName+anchorId for Plan 02 consumption

## Latest Decisions (Phase 13-01)

- [Phase 13-01] PlannerThread interface deleted — chunks are the single source of truth for all learning actions
- [Phase 13-01] Signal-aware chunk creation: confusion→repair, curiosity→connect, connection→connect, revisit→retrieve
- [Phase 13-01] sourceSignal + sourceText fields added to PlannerChunk for full provenance tracking
- [Phase 13-01] Weak area boost increased from +15 to +30; detection expanded to 3 signals (easeFactor<2.0, overdue+declining, never-reviewed)
- [Phase 13-01] Top 5 suggestions shown by default with Show All toggle in PlannerScreen
- [Phase 13-01] Priority badges (WEAK AREA/OVERDUE/ACTIVE/EXPLORE) derived from relevanceScore thresholds 75/60/45

### Phase 12: NEW

- Requirement: PLANNER-06 (Rich Moves linking) — moved from Phase 11
- Purpose: Navigate suggested moves to target content (flashcards, posts, questions)
- Architecture: moveNavigator utility + SuggestedMovesSection integration
- Effort: 8-12 hours (4 waves)
- Removed from Phase 11: PLANNER-06; Phase 11 now covers only PLANNER-04 + CARDS-01/02/03

## Latest Decisions (Phase 16-01)

- [Phase 16-01] sessionHistory parameter is optional — all existing callers not passing it continue to work unchanged
- [Phase 16-01] priorMessages uses slice(0,-1) to exclude just-appended user message preventing LLM duplication
- [Phase 16-01] historyMessages conversion maps SessionMessage type field (user/ai) to ChatMessage role field (user/assistant) for KV-cache threading

## Latest Decisions (Phase 25-02)

- [Phase 25-02] Anchor display name uses title ?? content ?? 'anchor' fallback (Question type has no name field)
- [Phase 25-02] esbuild-based tsx loader hooks for unit testing pure functions from .tsx files with node --test
- [Phase 25-02] TrellisHero renders as topmost content in PlannerScreen above Review Banner
- [Phase 25-02] Ambient sway threshold set to 20 leaves; above threshold only 1-in-3 leaves sway

## Accumulated Context

### Roadmap Evolution

- Phase 16 added: token optimization
- Phase 18 added: Feed Redesign, Short Videos & Text-Art Posts
- Phase 19 added: Web Search Integration for Ask and Feed
- Phase 20 added: Orchestration Strategy & Diagnostic Dialogue (from original Milestone 2 ROADMAP.md Phases 17-18, renumbered)
- Phase 22 added: Swipe navigation between first-level screens
- Phase 26 added: Trellis harvest panel, dying/dead node actions, and suggested moves refactor to reflect trellis status
- Phase 27 added: Add i18n/L10n support
- Phase 28 added: UI/UX polish from audit findings
- Phase 30 added: Redesign curiosity feed as scroll progress bar with daily reading quota credits
