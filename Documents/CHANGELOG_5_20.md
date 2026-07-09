# Changelog: May 20, 2026

Covers all work since the last changelog (April 16, `v1.3`) — three shipped
milestones: **v1.4** (Curiosity Feed Redesign + UI Polish), **v1.5** (Curiosity
Feed v2 + Tech-Debt Hardening), and **v1.6** (Control, Graph Trust, Retrieval,
and Ethical Engagement). The app was also renamed **EchoLearn → Trellis** in
this span.

---

## Control, Graph Trust, Retrieval & Ethical Engagement (`v1.6 Milestone`)

*Shipped 2026-05-20 · Phases 47–53. Driven by professor feedback on graph
correction, filter reliability, podcast control, engagement ethics, and
retrieval.*

### Filter Redesign — Off-Topic & Malicious Prompt Prevention (`phase-47`)
- **Hybrid classifier:** Replaced the brittle regex pattern library with a
  narrow-regex Layer 1 plus an embedding-similarity Layer 2. No LLM sits in the
  classifier path, keeping it fast and deterministic.
- **Pre-LLM gate:** Malicious prompts (jailbreak templates, disallowed-content
  requests, spam) are now rejected *before* any provider call — zero tokens
  spent, nothing reaches the model.
- **Dual-vector scoring:** Malicious intent is scored against the raw question
  vector while off-/on-topic uses the contextualized vector, closing a
  buried-payload jailbreak where a benign preamble diluted an attack below
  threshold.
- **Structural bracketing:** Provider-boundary input bracketing added as defense
  in depth.

### Graph Command Service & Trust Invariants (`phase-48`)
- **Seven-verb command boundary:** rename / move / merge / detach / prune /
  delete / undo routed through a single service with a per-process mutex.
- **Append-only edit journal:** Every mutation is recorded, enabling reliable
  reversal and reload survival.
- **One event per mutation:** Exactly one typed `GRAPH_UPDATED` fires per change;
  the LLM re-organization prompt now preserves manual corrections instead of
  overwriting them.

### Graph Correction UI (`phase-49`)
- **iOS-style direct manipulation:** Tap to inspect, long-press for a node menu,
  long-press-drag to re-parent with ghost + magnetic snap.
- **Preview / confirmation:** High-impact actions (merge, delete) show what will
  change before committing.
- **Persistent Undo:** A journal-derived Undo button reverses the last
  correction and survives app restart; corrections persist across reload.

### Retrieval, Library & Concept Dashboard (`phase-50`, `phase-51`)
- **Local-first Collections:** Save any post (and podcasts) into named
  collections; Saved / Liked / History views collect them.
- **Fuzzy search:** Debounced Fuse-backed search with match highlighting across
  saved content and concepts.
- **Concept dashboard:** Per-concept page (AnchorDetail) with leaf-state badge,
  "appears in" backlinks, and a one-tap recovery action that escalates a fading
  concept back into review / learn-as-post.
- **Live consistency:** All retrieval surfaces read the same canonical graph the
  corrections mutate, refreshing on `GRAPH_UPDATED` / `COLLECTIONS_CHANGED`.

### Podcast Quality Defaults & Learner Controls (`phase-52`)
- **Length × style controls:** Bounded selectors with educational defaults, a
  dirty-state badge, playback-rate control, and a Regenerate CTA; options persist
  in Settings.
- **Deterministic caching:** Generation keyed by an options hash, so identical
  settings reproduce the same episode instead of drifting.
- **Config-driven TTS:** TTS model un-hardcoded with a safe fallback if a chosen
  model is unavailable.
- **Per-provider API keys:** Switching LLM / embedding provider no longer wipes
  the previously entered key.

### Provider Privacy & Non-Pushy Guardrail (`phase-53`)
- **Payload privacy goldens:** Test-enforced proof that private local-first data
  (tags/collections, saved/liked/history, graph-correction log) never reaches
  any LLM or TTS request body.
- **Reward-based engagement, enforced in code:** A guardrail test fails the build
  if streaks, leaderboards, public likes, mandated daily goals, or stop cues are
  introduced. Mandated goals / forced reflection were deliberately rescoped *out*
  as conflicting with the non-coercive design (26 → 23 requirements).

---

## Curiosity Feed v2 + Tech-Debt Hardening (`v1.5 Milestone`)

*Shipped 2026-05-13 · Phases 37–46.*

### Curiosity Feed v2 (`phase-37`–`phase-42`)
- **Masonry feed:** Pinterest-style two-column masonry layout replacing the
  single-column flow, with richer essays and source diversity.
- **Vine-bloom end state:** Feed completion now resolves into a blooming vine
  rather than a dead-end "no more posts."
- **Local-first engagement signals:** Save, like, and dismiss with Saved / Liked
  views, a long-press menu, and read-boundary dismiss filtering.
- **Force-New-Day reset:** Dismissed posts reset on a new day while saved/liked
  archives are preserved.

### Essay & Content Pipeline (`phase-43`–`phase-46`)
- **Deep Dive variant + grounded essays:** Multi-snippet Tavily grounding, inline
  citation rendering, and source-domain rotation for diversity.
- **Queued-news prefetch:** Multi-source news prefetch closure (CONTENT-03).

### Tech-Debt Hardening
- **v1.4 carry-overs closed:** i18n leaf-module refactor, validation drift fixes,
  roadmap polish, device retests, and YouTube short-classification removal.
- **Code-quality & dependency sweep:** Safe in-major dependency updates,
  strictness/lint/dead-code/TODO cleanup, GraphScreen Android drag mitigation,
  and final verification.

---

## Curiosity Feed Redesign + UI Polish + Rebrand (`v1.4 Milestone`)

*Shipped 2026-05-08 · Phases 28, 30–36.*

### EchoLearn → Trellis Rebrand
- **Full rename:** Source, native config (Capacitor bundle ID), localStorage keys
  (`echolearn_*` → `trellis_*` via a runtime legacy migration), and all
  user-facing copy. On-disk directory and SQLite connection name `'echolearn'`
  intentionally preserved for backwards compatibility.

### VineProgress Curiosity Feed Redesign (`phase-30`, `phase-31`, `phase-36`)
- **Organic vine progress:** Replaced the rigid concept-progress card with a
  horizontal vine + expandable concept checklist.
- **Exploration detectors:** Concept exploration tracked via scroll-70%, 30s
  dwell, follow-up question, plus a YouTube IFrame postMessage detector for video
  completion.
- **Pipeline aligned with design:** Persistent derived list with cycle position,
  cyclic walker with lazy-skip of explored anchors, stratified style allocation
  (largest-remainder + Fisher-Yates), spread-by-concept-before-style mixer,
  Promise-mutex refill, and a durable yesterday-queue snapshot with a dev
  "Force new day" affordance.

### Ask-Chat KV-Cache Preservation (`phase-35`)
- **Byte-stable system prompt:** `askStreaming` keeps a byte-stable prompt across
  turns; per-turn graph context moved to a tail-position assistant message so the
  provider KV-cache prefix stays warm. Added a user-ack constant for
  strict-alternation chat templates (e.g. Qwen via LM Studio).

### UI/UX Audit (`phase-28`)
- **Polish pass:** 9 CSS spacing tokens, BottomNavigation slide-down on
  sub-screens, Header scroll-shadow, SwipeTabContainer resize re-sync, WCAG 2.5.8
  44×44 touch targets, trellis shake/haptic/pulse feedback, "Knowledge Graph"
  rename across 4 locales, iOS-style Settings sub-page navigation (4 sub-screens),
  and 13 dark-theme CSS variables.

### Code Hygiene & v1.3 Gap Closure (`phase-29`, `phase-33`, `phase-34`)
- **Cleanup:** Concept-feed-strategy supersession, orphan-export and dead-i18n-key
  removal, LeafState rename (`yellow→dying` / `fallen→dead`), React.memo
  memoization, and new leaf modules (`feed-spread.ts`, `refill-mutex.ts`) for
  testability.
- **Gap closure:** Curiosity-signal wiring, AbortSignal plumbing through
  PostDetail / post-essay / classification, Node-version `.ts`-extension sweep,
  and 25 UAT checkpoints flipped to passed across phases 20–26.
