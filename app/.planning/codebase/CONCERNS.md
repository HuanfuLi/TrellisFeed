# Codebase Concerns

**Analysis Date:** 2026-03-31

## Tech Debt

**Hybrid Storage (localStorage + SQLite dual-write):**
- Issue: Questions and planner data are written to both localStorage (primary) and SQLite (secondary), creating sync complexity and potential data divergence.
- Files: `src/services/question.service.ts` (lines 21-26), `src/services/db.service.ts` (entire abstraction)
- Impact: If localStorage and SQLite go out of sync, data consistency breaks. Unclear which system is source-of-truth on different platforms. Mobile reloads may load partial data if one backend fails during hydration.
- Fix approach: Choose single source-of-truth per platform (SQLite on native via Capacitor, localStorage on web). Implement one-way migration from old backend on first load, then delete dual-write code.

**localStorage as Primary Data Store:**
- Issue: 17 services write directly to localStorage (~5MB quota). No overflow handling beyond toast notification.
- Files: `src/services/podcast.service.ts` (line 124), `src/services/session.service.ts` (lines 28-34), `src/services/question.service.ts` (lines 85-92), `src/services/planner.service.ts` (localStorage writes), and 13 others.
- Impact: When quota exceeds ~5MB, data is silently dropped. No fallback mechanism. Podcast metadata persists but audio blobs fail silently to save. Long-term data loss on heavy users.
- Fix approach: Migrate critical application data (questions, sessions, planner) to SQLite. Keep localStorage only for UI preferences. Implement quota monitoring with aggressive cleanup warnings.

**Fire-and-Forget Async Chains:**
- Issue: Background operations like podcast generation, classification, and auto-gen are started with `void (async () => { ... })()` without waiting for results or handling failures.
- Files: `src/services/podcast.service.ts` (lines 190-268), `src/state/useQuestions.ts` (lines 136-139), `src/state/usePlannerAutoGen.ts` (lines 46-52)
- Impact: Race conditions if user navigates away or closes app mid-operation. No visibility into generation failures. Failed podcast audio is silently lost. Users don't know if something broke or just hasn't finished yet.
- Fix approach: Implement job queue with persistent status tracking. Track background operations in a persisted jobs table. Show progress/completion UI with retry capability.

**Large Component Files (800+ lines):**
- Issue: `SettingsScreen.tsx` (1059 lines), `AskScreen.tsx` (872 lines), `GraphScreen.tsx` (941 lines) bundle unrelated concerns.
- Files: `src/screens/SettingsScreen.tsx`, `src/screens/AskScreen.tsx`, `src/screens/GraphScreen.tsx`
- Impact: Hard to locate specific logic. Refactoring requires understanding entire file. Testing is coarse-grained. Form state management in SettingsScreen is verbose and repetitive.
- Fix approach: Split into feature-specific subcomponents. Extract settings sections (LLM settings, TTS settings, storage, etc.) into separate component files. Break AskScreen into ChatPanel, SessionHistory, and ChatInput composition.

**Manual ID Generation with Module Counters:**
- Issue: IDs generated using `Date.now()` + module-level counter (e.g., `let idCounter = Date.now()`). Can collide if two instances init at same millisecond.
- Files: `src/services/question.service.ts` (lines 70-72), `src/services/podcast.service.ts` (lines 12-15), `src/services/session.service.ts` (lines 9-11), `src/screens/AskScreen.tsx` (lines 34-37)
- Impact: Multi-tab scenarios where two windows init at same time could generate duplicate IDs. On mobile with multiple processes, more likely.
- Fix approach: Use crypto.randomUUID() or library like `nanoid`. ID collisions become cryptographically impossible.

**Missing Error Recovery Patterns:**
- Issue: API calls timeout after 60-120 seconds, but no retry logic, exponential backoff, or resumable streams.
- Files: `src/providers/llm/index.ts` (lines 21-22 timeout constants), `src/providers/tts/index.ts` (line 24), `src/providers/embedding/index.ts` (no retry logic)
- Impact: On slow networks (mobile), users see stalled requests with no recovery. Podcast audio generation can fail silently mid-stream. Users must refresh manually to retry.
- Fix approach: Implement retry helper with exponential backoff (1s, 2s, 4s, 8s). Add resumable streaming for podcast generation. Display retry UI to users with backoff countdown.

**No Request Deduplication:**
- Issue: Multiple hooks can trigger identical LLM/embedding requests simultaneously. No deduplication or request coalescing.
- Files: `src/providers/embedding/index.ts`, `src/services/canonical-knowledge.service.ts` (calls embedText for every question), `src/state/useQuestions.ts` (async filtering)
- Impact: Wasted API calls and quota consumption. Race conditions where two embedding requests resolve in different order, causing stale data overwrites.
- Fix approach: Add a request cache keyed by (provider, model, input hash). Coalesce identical in-flight requests. Return same Promise to multiple callers.

## Known Bugs

**Podcast Audio Persistence Race Condition:**
- Symptoms: Podcast generated but audio not playable after page reload. "No audio available. Regenerate to get audio."
- Files: `src/services/podcast.service.ts` (lines 230-236, 39-53)
- Trigger: Generate podcast → user closes tab before `saveAudioBlob()` completes → reload page. Audio blob URL in memory is gone, IndexedDB save may still be pending.
- Workaround: Regenerate podcast. Audio will regenerate and save.
- Fix approach: Make `saveAudioBlob()` awaited before marking podcast `status: 'ready'`. Move progress to 90% before saving, 100% after confirmed save. Add persistence confirmation toast.

**Planner Auto-Gen Signal Error (Recently Fixed):**
- Symptoms: Planner auto-suggestions fail to generate; error in console about missing planner signals.
- Files: `src/state/usePlannerAutoGen.ts` (lines 40-48)
- Status: Partially mitigated in recent commits (git log: "Fixed Planner signal error"). But underlying architecture of signalling from other services to planner is fragile.
- Fix approach: Add integration test that mocks planner state, triggers data changes, and verifies auto-gen runs without errors. Centralize signal broadcast.

**Image Generation Cache Metadata Mismatch:**
- Symptoms: User sees blank space where image should be; image exists in cache but metadata says it's missing.
- Files: `src/services/imageGeneration.service.ts` (cache metadata management), `src/components/InfoFlow.tsx` (lines 48-50 check cache sync)
- Trigger: Image generation completes but cache metadata write fails (quota exceeded). Reload page.
- Fix approach: Make cache metadata writes transactional. Verify image binary exists before marking ready. Implement cache garbage collection.

**Off-Topic Question Classification May Not Persist:**
- Symptoms: Question flagged as off-topic in one hook instance, but other instances still show it unflagged.
- Files: `src/state/useQuestions.ts` (lines 124-131), `src/services/question.service.ts` (question patching)
- Trigger: Two AskScreen tabs open. Classify question in one tab. Other tab may have cached the unflagged version before patch broadcasts.
- Fix approach: On flagging, immediately emit UPDATE event with flagged status, not just re-emit QUESTION_ASKED. Other hook instances should subscribe to UPDATE event separately.

## Security Considerations

**Hardcoded API Keys in Browser Memory:**
- Risk: API keys (Claude, Gemini, OpenAI, TTS) stored in localStorage as plaintext. Any XSS vulnerability exposes all keys.
- Files: `src/services/mock/settings.mock.ts` (stores full LLMConfig with apiKey), `src/screens/SettingsScreen.tsx` (displays key input)
- Current mitigation: None. Encryption of stored keys not implemented.
- Recommendations:
  1. Use Capacitor Preferences (encrypted on native) instead of localStorage for sensitive settings.
  2. Consider proxy approach: mobile app has embedded credentials, web version requires server-side proxy for API calls.
  3. Add warning on Settings screen: "API keys stored locally. Anyone with access to this device can use your credits."
  4. Implement credential rotation: allow users to invalidate keys without losing data.

**No CORS/CSRF Protection on LLM Calls:**
- Risk: LLM providers allow requests from browser with `anthropic-dangerous-direct-browser-access: true` header. Vulnerable to CSRF attacks from malicious websites.
- Files: `src/providers/llm/index.ts` (lines 139, 165 hardcoded header)
- Current mitigation: Header exists but is explicitly labeled as unsafe.
- Recommendations:
  1. Migrate LLM calls to server-side proxy that validates origin and rate-limits.
  2. If staying browser-direct, implement CORS origins whitelist and SRI for scripts.
  3. Rate-limit by user IP at provider level (if available via Anthropic/Google/OpenAI admin).

**Unvalidated LocalStorage JSON Parsing:**
- Risk: Questions, sessions, planner chunks parsed from localStorage without schema validation. Corrupted/malicious JSON could cause runtime errors.
- Files: `src/services/question.service.ts` (lines 75-82), `src/services/session.service.ts` (lines 14-24), `src/services/podcast.service.ts` (lines 91-98)
- Current mitigation: try/catch blocks return empty arrays, but no type validation.
- Recommendations:
  1. Use schema validation library (zod, io-ts) to validate localStorage data on load.
  2. Add data versioning: bump version on Question type changes, migrate old data.
  3. Implement localStorage data integrity check (CRC or hash) on write.

**Service Worker Cache Poisoning (if used):**
- Risk: If service worker caches LLM responses, malicious API response (e.g., injected script) could be served offline indefinitely.
- Files: Not found — no service worker detected, but if added later.
- Recommendations:
  1. Never cache LLM responses that contain user-generated or untrusted content.
  2. Cache only metadata (dates, IDs). Fetch content fresh.

## Performance Bottlenecks

**Embedding Vector Storage in localStorage:**
- Problem: Questions store full embedding vectors (1536+ dimensions for OpenAI). Serialized JSON is hundreds of bytes per question. With 50+ questions, becomes 10+ MB.
- Files: `src/types/index.ts` (line 31 `embeddingVector?: number[]`), `src/services/question.service.ts` (persists vectors)
- Cause: Vectors stored in localStorage to support offline similarity search. But most similarity work happens server-side during canonical classification.
- Improvement path:
  1. Store embedding vectors in IndexedDB only (not localStorage).
  2. Lazy-load vectors on demand (when user opens similarity view).
  3. Consider quantized embeddings (8-bit instead of float32) to reduce size.

**Canonical Knowledge Service O(n²) Complexity:**
- Problem: `canonical-knowledge.service.ts` (1166 lines) performs embedding similarity search on every question ingestion. With 50 questions, requires 50 embedding calls + 50² cosine similarity checks.
- Files: `src/services/canonical-knowledge.service.ts` (lines 1-100+ examined, full service is 1166 lines)
- Cause: No spatial indexing (e.g., FAISS, Annoy). Linear search through all existing questions for each new question.
- Improvement path:
  1. Implement spatial index (ball tree or HNSW) for embedding search.
  2. Cache embedding search results. Mark dirty on new question, refresh in background.
  3. For MVP: limit similarity search to last 20 questions only.

**Concept Feed Generation on Every App Start:**
- Problem: `concept-feed.service.ts` regenerates daily posts on every homescreen load, even if already generated today.
- Files: `src/services/concept-feed.service.ts` (build logic), `src/screens/HomeScreen.tsx` (loads feed)
- Cause: No date-stamped cache invalidation. Re-runs LLM calls for post generation even if fingerprint matches.
- Improvement path:
  1. Cache generated posts keyed by (date, fingerprint). Return cached version if date==today.
  2. Only regenerate if new questions were asked since last generation.
  3. Implement background refresh: precompute tomorrow's feed in the evening.

**Image Generation Blocks Rendering:**
- Problem: `InfoFlow.tsx` (lines 48-50) synchronously checks cache; if miss, blocks card render until async image generation completes.
- Files: `src/components/InfoFlow.tsx` (lines 41-71)
- Cause: `imageResolved` state keeps card hidden until fetch completes.
- Improvement path:
  1. Show placeholder/skeleton while generating, not blank space.
  2. Pregenerate images for next ~5 posts in feed in background.
  3. Use lower resolution images for feed preview; full resolution on detail view.

**SessionStorage Not Used for Transient State:**
- Problem: Chat streaming overlay, form inputs, scroll position stored in React state. Lost on tab reload.
- Files: `src/screens/AskScreen.tsx` (StreamingOverlay state on line 99)
- Cause: No sessionStorage usage. Every field is ephemeral.
- Improvement path: Persist transient UI state to sessionStorage (survives reload, cleared on tab close). Restore on mount.

## Fragile Areas

**Event Bus Singleton (EventBus):**
- Files: `src/lib/event-bus.ts`, subscribed to by 12+ services/hooks
- Why fragile: Untyped event payload. No validation that subscribers exist. If a service emits an event no one listens to, silent loss. If two services emit same event type with different payload shapes, runtime crash.
- Safe modification:
  1. Add TypeScript payload union type validation: `type AppEvent = { type: 'QUESTION_ASKED'; payload: Question } | { type: 'SESSION_UPDATED'; payload: { id: string } } | ...`
  2. Make eventBus.emit() and subscribe() generic with strict type checking.
  3. Add test that all emitted events have at least one subscriber (or are intentionally broadcast-only).
- Test coverage: No tests for event ordering or multiple subscribers to same event.

**Flashcard Service Session Processing:**
- Files: `src/services/flashcard.service.ts`, called from `src/screens/AskScreen.tsx` (lines 68-84)
- Why fragile: Concurrent call guard (`processingSessionIds` Set) is application-level, not per-session. If user has two tabs open with different sessions, second tab's processing may be skipped.
- Safe modification:
  1. Make guard keyed by sessionId, not global.
  2. Add test with two sessions processing simultaneously.
  3. Ensure extraction doesn't skip flashcards if second session finishes before first.
- Test coverage: No tests for concurrent session processing.

**Question Filter Service (Off-Topic Classification):**
- Files: `src/services/question-filter.service.ts`, called from `src/state/useQuestions.ts` (line 121)
- Why fragile: Depends on session context to determine if follow-up should be flagged. If context is undefined (first question in session), uses fallback logic that may differ from intended behavior.
- Safe modification:
  1. Document fallback behavior clearly.
  2. Add tests for both context-present and context-absent paths.
  3. Add debug logging to track classification decisions.
- Test coverage: Uncertain — filter classification logic not obviously tested.

**Planner Check-In Score Calculations:**
- Files: `src/services/plannerAutoGen.service.ts`, `src/services/trajectoryAnalyzer.service.ts`
- Why fragile: Scoring logic uses hardcoded weights and thresholds. If one signal (e.g., `reviewPerformance`) is missing from trajectory, score calculation may NaN or silently default.
- Safe modification:
  1. Implement safe accessors: `trajectory.weakAreas ?? []` for all arrays.
  2. Add validation at service entry: check all expected signals present before scoring.
  3. Add test suite covering missing/zero signals.
- Test coverage: No visible tests for score calculation with edge-case trajectory data.

## Scaling Limits

**localStorage ~5MB Quota (Hard Limit):**
- Current capacity: ~2-3MB in active use (50 questions + sessions + planner + podcasts).
- Limit: At ~5MB, all writes start failing silently.
- Scaling path: Migrate to SQLite (native) + server backend (web). Implement incremental sync.

**IndexedDB Audio Blob Storage:**
- Current capacity: ~50MB practical (depends on device).
- Limit: On phones with tight storage, IndexedDB quota may be revoked by OS.
- Scaling path: Implement cloud sync for audio blobs. Keep only last 7 days locally. Stream older podcasts from server.

**Embedding Vector Search O(n) Complexity:**
- Current capacity: ~100 questions before similarity search becomes noticeable (>500ms).
- Limit: At 1000+ questions, every new question takes 5+ seconds to classify.
- Scaling path: Implement HNSW index for embedding search. Paginate results.

**EventBus Subscription Memory:**
- Current capacity: Likely 20-30 active subscriptions. Each accumulates in memory.
- Limit: Unmaintained listeners leak memory. Hot-reloading in dev can accumulate stale subscribers.
- Scaling path: Add WeakMap tracking. Implement unsubscribe-on-unmount pattern. Add memory leak detector.

## Dependencies at Risk

**Capacitor Community SQLite (Unmaintained Risk):**
- Risk: Package `@capacitor-community/sqlite` is community-maintained, not backed by core Capacitor team. Updates may lag behind Capacitor major versions.
- Impact: Breaking changes in Capacitor 6+ may leave SQLite behind. Mobile builds fail.
- Migration plan: Monitor releases. If unmaintained >6 months, switch to `capacitor-sqlite` (official) or `better-sqlite3` (Node via native bridge).

**react-router-dom v7 (Recent Major):**
- Risk: Just released (Feb 2025). Limited real-world testing in production. Breaking changes from v6 possible in patch releases.
- Impact: Navigation edge cases may appear. useNavigate() or useLocation() hooks could behave unexpectedly.
- Migration plan: Pin version `^7.0.0`. Monitor GitHub issues. Plan upgrade path to v8 when it stabilizes.

**Gemini API v1beta (Non-Stable):**
- Risk: Using `v1beta` endpoint for Gemini. May change without warning. No SLA.
- Impact: Requests could fail if Google deprecates beta endpoint.
- Migration plan: Monitor Google AI docs. Plan migration to stable endpoint when available. Add provider fallback (use Claude if Gemini fails).

**imageProvider (Internal, Ad-Hoc):**
- Risk: Image generation uses multiple providers (NanoBanana, Gemini, nanoBanana) with inconsistent error handling.
- Impact: Provider outages cause feed to load slowly or with missing images.
- Migration plan: Implement provider abstraction with retry + fallback. Default to one provider, fallback to others on failure.

## Missing Critical Features

**Offline Sync Strategy:**
- Problem: App works offline (reads from localStorage). But changes made offline don't sync to server when online. No server backend exists.
- Blocks: Can't share learning progress. Can't backup data. Can't sync across devices.
- Recommendation: Implement server-side sync with conflict resolution (CRDT or last-write-wins). Use Capacitor to detect online/offline status and queue changes.

**Data Backup & Export:**
- Problem: No export functionality. User data trapped in localStorage/IndexedDB.
- Blocks: Users can't migrate to another app. Data loss is unrecoverable.
- Recommendation: Add "Export as JSON" feature in Settings. Export questions, planner, settings. Allow import from previous export.

**Batch Embedding Operations:**
- Problem: Embeddings generated one-at-a-time in classification. No batch endpoint used.
- Blocks: Performance suffers on large question sets. API quota consumed inefficiently.
- Recommendation: Batch 10-50 texts per embedding call if provider supports it (e.g., OpenAI's batch API).

**Rollback/Undo for Destructive Operations:**
- Problem: Deleting podcast, question, or planner chunk is permanent with no undo.
- Blocks: User mistakes are costly. No recovery path.
- Recommendation: Implement soft delete. Keep deleted items for 30 days in "Trash" before permanent removal.

## Test Coverage Gaps

**Question Filtering & Classification:**
- What's not tested: `question-filter.service.ts` logic for off-topic detection with various session contexts.
- Files: `src/services/question-filter.service.ts`
- Risk: Classification logic silently breaks if question structure changes. Off-topic thresholds drift.
- Priority: High — classification affects user experience directly.

**Podcast Generation Pipeline:**
- What's not tested: Full flow from generation request → script generation → TTS → audio persistence → reload → playback.
- Files: `src/services/podcast.service.ts`, `src/state/usePodcast.ts`
- Risk: Audio persistence race conditions go undetected until user reports missing audio.
- Priority: High — podcast is core feature.

**Event Bus & EventEmission Ordering:**
- What's not tested: Multiple rapid emissions of same event. Subscription order effects. Unsubscribe during emission.
- Files: `src/lib/event-bus.ts`
- Risk: Race conditions in event-driven state updates.
- Priority: Medium — fragile but used extensively.

**Storage Quota Exceeded Scenarios:**
- What's not tested: Behavior when localStorage quota exceeded. Partial writes, recovery, user notification.
- Files: `src/services/` (all storage services)
- Risk: Data corruption in edge cases.
- Priority: Medium — affects long-term data retention.

**Multi-Tab/Multi-Window Scenarios:**
- What's not tested: Two tabs open, one modifies data, other tab stale. SessionId conflicts. Simultaneous API calls.
- Files: `src/screens/AskScreen.tsx`, `src/services/session.service.ts`
- Risk: Data inconsistency, silent failures in secondary tabs.
- Priority: High — real user scenario.

**LLM Streaming Interruption:**
- What's not tested: User cancels streaming response mid-way. Stream cleanup, error handling, state consistency.
- Files: `src/providers/llm/index.ts` (streaming generator), `src/state/useQuestions.ts` (askStreaming)
- Risk: Orphaned streams consume resources. Partial answers persisted.
- Priority: Medium — affects user responsiveness.

---

*Concerns audit: 2026-03-31*
