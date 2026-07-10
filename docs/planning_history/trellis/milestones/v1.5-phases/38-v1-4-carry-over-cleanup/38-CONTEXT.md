# Phase 38: v1.4 Carry-Over Cleanup - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Close 5 v1.4 carry-over items so v1.5 starts from a clean baseline:

- **TECHDEBT-02** — `34-VALIDATION.md` flipped from `draft` → `validated`; `35-VALIDATION.md` normalized from `approved` → `validated` (both files live in v1.4 archive)
- **TECHDEBT-03** — Archived `v1.4-ROADMAP.md` Phase 36 entry has 36-14 + 36-15 plan bullets appended (currently only mentioned in "Tech debt carried to v1.5" footer, not in the plan list)
- **TECHDEBT-04** — Phase 33's 2 deferred device-only verifications (touch-target feel + React.memo behavioral correctness) executed on physical device; results recorded in a UAT log
- **TECHDEBT-05** — `echolearn_*` references audited project-wide; intentional backwards-compat occurrences preserved with explicit brand-history annotation; pure doc-drift occurrences cleaned or annotated
- **TECHDEBT-06** — YouTube landscape-as-short bug fixed by **eliminating the short/video classification entirely** (since YouTube thumbnail aspect ≠ video orientation, and API quota is too tight for `videos.list` `contentDetails` calls); all YouTube content rendered as `video` type with thumbnail-driven sizing + hybrid feed interaction

We're clarifying HOW to implement what's scoped. New capabilities (engagement signals, source diversity, masonry) belong to other v1.5 phases.

</domain>

<decisions>
## Implementation Decisions

### Plan grouping (D-01)

- **D-01:** 3 plans, functional split:
  - `38-01-doc-cleanup-PLAN.md` — TECHDEBT-02 + 03 + 05 (all documentation/audit work; archive files + CLAUDE.md + project-wide grep)
  - `38-02-youtube-short-removal-PLAN.md` — TECHDEBT-06 (code change + tests, independently bisectable)
  - `38-03-device-uat-PLAN.md` — TECHDEBT-04 (operator-driven; persists `38-HUMAN-UAT.md` for `/gsd:verify-work`)
  - **Why:** Doc work and code work have different blast radius and verify cadence; bundling them together would make bisection of any YouTube regression noisy. The two doc plans + the code plan can run in parallel during execution; the device UAT plan waits for code to land.

### TECHDEBT-06 (YouTube short detection) — eliminated, not fixed (D-02)

- **D-02:** Drop the `short`/`video` distinction entirely. Render ALL YouTube content as `sourceType: 'video'` + `presentationStyle: 'video'`.
  - **Why:** Both proposed detection mechanisms are unviable in our constraints:
    - YouTube API `videos.list?part=contentDetails` would give us reliable duration/dimension data, but adds 1 quota unit per video; **API quota is very tight** (operator constraint) — non-starter.
    - Image-probe on `hq720.jpg` (current implementation) is unreliable: YouTube returns letterboxed thumbnails for landscape videos that look near-square, triggering false-positive short classification (the very bug TECHDEBT-06 reports).
  - The honest path is to acknowledge we cannot reliably classify without an API call AND drop the feature that requires the classification. Bug eliminated by removing the classifier.

### TECHDEBT-06 layout fallout (D-02a)

- **D-02a:** Video card uses `aspect-ratio: auto` driven by the thumbnail's natural dimensions (NOT a fixed 16:9 container).
  - **Why:** Without classification, vertical YouTube content (true 9:16 Shorts) would otherwise letterbox in a fixed 16:9 card with ugly black side bars. By sizing the card to whatever the thumbnail actually is, both orientations render naturally — landscape cards stay wide, vertical cards become tall. Aligns forward with Phase 42 MASONRY-01's variable-height tile direction.
  - **Implementation note:** This is a sizing hint, not a classifier. The post type stays `video` regardless. No re-introduction of "is this a Short" logic.

### TECHDEBT-06 interaction fallout (D-02b)

- **D-02b:** Hybrid video interaction in the feed:
  - **Tap on the thumbnail/iframe area** → inline tap-to-play (5-15s preview), reuses Phase 36 GAP-C's `setVideoPlaying(post.id)` + `markExplored` + `CONCEPT_EXPLORED` emit logic
  - **Tap on title / teaser / explicit "open" affordance** → navigate to `PostDetailScreen` (current `video` behavior — full embed + Q&A follow-up + Detector D postMessage completion signal)
  - **Why:** Killing the `short` type would otherwise force ALL videos through a tap-and-navigate flow, losing the low-friction inline preview that Phase 36 GAP-C established. Generalizing the inline-play affordance to all videos preserves UX.
  - **Implementation note:** Phase 36 GAP-C's tap emit at `InfoFlow.tsx` (currently fires only when `sourceType === 'short'`) generalizes to fire when `sourceType === 'video'` AND tap target was the thumbnail/iframe area. Detector D in `PostDetailScreen.tsx` stays unchanged (still handles deep-engagement video completion).
  - **Click-target dispatch:** Use `onClick` on the thumbnail container (inline play) vs `onClick` on the title/teaser containers (navigate). Avoid event-bubble traps — the existing InfoFlow click handlers will need a small refactor.

### TECHDEBT-04 device UAT mechanics (D-03)

- **D-03:** UAT file design:
  - **Location:** `38-HUMAN-UAT.md` in `.planning/phases/38-v1-4-carry-over-cleanup/` (matches Phase 37's `37-HUMAN-UAT.md` pattern; `/gsd:verify-work 38` finds it automatically)
  - **OS matrix:** Both iOS + Android. Each test marked with which OS it was verified on. Capacitor WebView differences between OSes can be material (Android Chromium WebView has the long-standing `position: fixed` quirks documented in CLAUDE.md), and React.memo behavioral correctness is more likely to surface a regression on Android.
  - **Granularity:** One `result:` field per test. Test 2 has 4 sub-checkpoints (8-card render / swipe-for-more / image-gen toggle / VineProgress full-width) but they're documented in the `expected:` block, not split across YAML entries. If a sub-checkpoint fails, operator describes which one in the failure note.
  - **Why:** Keeps the UAT shape consistent with Phase 37's proven flow. Prevents semi-archived state mutation (we don't touch the v1.4 archive's Phase 33 directory).

### TECHDEBT-05 echolearn_* scope (D-04)

- **D-04:** Project-wide sweep + selective handling, not just CLAUDE.md.
  - Run `grep -rn "echolearn" .planning/ app/src/ app/tests/ scripts/ docs/` (and any other top-level dirs)
  - Bucket each occurrence:
    - **Bucket A — intentional backwards-compat (preserve):** SQLite connection name in `db.service.ts`; auto-memory directory path (`~/.claude/projects/-Users-Code-EchoLearn/`); v1.0–v1.4 archive files (immutable historical record). No edits.
    - **Bucket B — pure doc drift (fix):** Comments / docstrings / planning files that mention `echolearn_*` without a brand-history annotation. Either annotate or rename per item-by-item judgment.
    - **Bucket C — surprises:** Anything that doesn't fit A or B (e.g., a stray test fixture or a leftover localStorage key). Logged for case-by-case decision in plan 38-01.
  - **Audit table goes into 38-01-SUMMARY.md** so the bucket A vs B decisions are auditable.
  - **Why:** Current ROADMAP success criterion ("no longer contains stale `echolearn_*` references OR they carry an explicit brand-history annotation") is technically satisfiable by reading only CLAUDE.md (where 3 mentions all carry the annotation), but that's narrow. A wider sweep catches occurrences that may have drifted in elsewhere and prevents future operators from being surprised.

### Claude's Discretion

- Whether the YouTube post-type removal needs a follow-up to clean up `style-assignment.ts` `STYLE_WEIGHTS` (which currently includes `short` as a separate bucket) — Claude decides whether to fold this into 38-02 or defer to a separate plan based on grep findings. Default: fold into 38-02 since the change is small and bisection-grouped.
- The exact OS test order in the device UAT (iOS first vs Android first) — operator preference, not pre-locked.
- Whether to use `git mv` vs delete-and-create when renaming any echolearn-named file in TECHDEBT-05 sweep — pick whichever preserves git blame.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project state + roadmap
- `.planning/PROJECT.md` — vision, brand-history paragraph (line 5 area), Phase 37 close-out narrative
- `.planning/ROADMAP.md` §"Phase 38: v1.4 Carry-Over Cleanup" (lines 1084–1094) — success criteria source-of-truth
- `.planning/REQUIREMENTS.md` — TECHDEBT-02..06 acceptance language

### CLAUDE.md load-bearing sections
- `CLAUDE.md` §"Brand history" (top of file) — confirms which `echolearn_*` strings are intentionally preserved
- `CLAUDE.md` §"Concept Feed Generation Pipeline" — describes the 3-list + style-assignment architecture; relevant for confirming that removing `short` from `STYLE_WEIGHTS` doesn't break the stratification math
- `CLAUDE.md` §"Video & short post completion signals (Phase 36 GAP-C — load-bearing)" — describes Detector A/B/C/D + InfoFlow short tap emit; D-02b generalization MUST preserve all 4 detectors and the tap-emit semantics

### Source-of-truth files for code change (TECHDEBT-06)
- `app/src/services/youtube.service.ts` lines 121–135 (`probePortrait` to be removed) and lines 508–510 (`videoType = isPortrait ? 'short' : 'video'` to become unconditional `'video'`)
- `app/src/services/concept-feed.service.ts` lines 85 (`VALID_SOURCE_TYPES` — drop `'short'`), 1097–1110 (short post construction branch — to be removed or merged into video branch)
- `app/src/services/style-assignment.ts` `STYLE_WEIGHTS` (drop `short` weight, redistribute or accept fewer styles)
- `app/src/components/InfoFlow.tsx` — short tap-to-play emit (Phase 36 GAP-C) generalizes to all video posts
- `app/src/screens/PostDetailScreen.tsx` — Detector D postMessage logic stays unchanged

### Source-of-truth files for doc work (TECHDEBT-02/03)
- `.planning/milestones/v1.4-phases/34-v1-4-close-out-verification-debt-and-cleanup/34-VALIDATION.md` (frontmatter `status:` flip)
- `.planning/milestones/v1.4-phases/35-fix-the-dynamic-system-prompt-issue/35-VALIDATION.md` (frontmatter `status:` flip)
- `.planning/milestones/v1.4-ROADMAP.md` Phase 36 entry — append 36-14 + 36-15 plan bullets in the plan list (not just the carry-over footer)

### Phase 33 source for TECHDEBT-04
- `.planning/milestones/v1.4-phases/33-phase-29-regression-and-phase-31-code-hygiene/33-VERIFICATION.md` `human_verification` section — verbatim source of the 2 device tests (touch-target feel + React.memo behavioral correctness)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase 37 `38-HUMAN-UAT.md` shape** — single test entry, OS-aware result line, structured Current Test for `gsd-tools uat render-checkpoint`. Direct reuse (rename to phase 38).
- **`InfoFlow.tsx` short tap-to-play handler** (Phase 36 GAP-C) — the `setVideoPlaying(post.id)` + `markExplored` + `eventBus.emit({type: 'CONCEPT_EXPLORED', ...})` chain already exists. D-02b generalization is "remove the `sourceType === 'short'` filter, gate by `sourceType === 'video'` AND tap target = thumbnail container."
- **`PostDetailScreen.tsx` Detector D postMessage listener** (Phase 36 GAP-C) — already handles YouTube IFrame ENDED + 80% heartbeat. Stays untouched; navigation path from feed (D-02b "tap title/teaser") is the existing `video` flow.
- **`youtube.service.ts:97 helper `sleep`** + existing `videos.list` retry/cache pattern — reusable for any future probing if needed (NOT used by D-02 since we're removing classification, not adding probes).

### Established Patterns

- **Atomic per-file commits + paired source+test** (Phase 37 D-03) — applies project-wide. Plan 38-02 (YouTube fix) commits source change + test update + style-weight cleanup as 2-3 atomic commits.
- **`'../lib/i18n-leaf.ts'` with explicit `.ts` extension** (Phase 37) — any new code added in this phase must follow this for `node --test` compatibility.
- **Source-reading invariant tests** (Phase 27 web-search-no-locale + Phase 37 leaf-imports) — for D-02, after removing `short`, add an invariant test asserting no source file references `sourceType === 'short'` or `presentationStyle === 'short'` (drift guard).
- **`MAX_QUEUE_SIZE = 32`, `REFILL_THRESHOLD = 16`** — unchanged. Removing `short` from `STYLE_WEIGHTS` slightly shifts post-mix proportions but doesn't change queue mechanics.

### Integration Points

- **Phase 42 (MASONRY-01) future work** — D-02a's `aspect-ratio: auto` thumbnail-driven sizing is a stepping stone to masonry. Don't over-engineer here; just accept variable card heights.
- **Phase 36 GAP-3 stratified style allocation** (`assignStylesStratified`) — operates on whatever weights `STYLE_WEIGHTS` contains. Removing `short` reduces N from 6 to 5 styles; Hamilton's largest-remainder math still works for any N. Spot-check after removal that small-N batches still distribute reasonably.
- **EventBus / `CONCEPT_EXPLORED` semantic** — D-02b reuses the same event for both inline-play and detail-navigate paths. Don't introduce a new event (CLAUDE.md best practice rule 6).

</code_context>

<specifics>
## Specific Ideas

- The honest framing for TECHDEBT-06 (eliminate, don't fix) was operator-driven during discussion. Operator explicitly rejected hybrid API approaches because of API quota constraints AND rejected thumbnail-based approaches because YouTube thumbnail aspect ratio is uncorrelated with video orientation. The "drop the classifier" path emerged as the only non-bullshit answer.
- The interaction generalization (D-02b) was an operator-raised concern after the type-removal decision: "feed 内嵌播放 + 详情页 Q&A 都要保留." The hybrid (thumbnail = inline, title/teaser = navigate) preserves both modes for ALL videos, not just shorts.
- The OS-matrix decision (iOS + Android both) reflects operator's awareness that the 33-VERIFICATION.md test 2 (React.memo) is more likely to surface issues on Android Chromium WebView.

</specifics>

<deferred>
## Deferred Ideas

- **Server-side YouTube short detection proxy** — would unblock URL-redirect probing (HEAD on `/shorts/{videoId}`) but adds backend infra. Out of v1.5 scope (local-first constraint).
- **Style-weight tuning post-removal** — D-02 removes `short` as a style. After execution, the post mix proportions shift slightly (image / text-art / video / news / suggestion redistribute). If feedback indicates the mix feels wrong, revisit `STYLE_WEIGHTS` in a future phase. Not folded into Phase 38 — operator can flag in a v1.5.x follow-up.
- **Vertical-video thumbnail letterbox detection** — could in theory detect "this thumbnail has padding bars" and infer the original video aspect, but adds image-processing complexity for marginal gain. Deferred indefinitely.
- **iOS-specific UI bugs surfaced during TECHDEBT-04 device UAT** — if operator finds iOS-only regressions, they get logged as separate v1.5 phase items, NOT folded into Phase 38 (which is scoped to closing 2 specific Phase 33 deferrals).

### Reviewed Todos (not folded)

- `.planning/notes/2026-05-09-fix-youtube-landscape-listed-as-short-in-feed.md` (if exists from `/gsd:note` capture earlier this session) — already covered by TECHDEBT-06 / D-02 in this phase. Note can be marked addressed when Plan 38-02 lands.

</deferred>

---

*Phase: 38-v1-4-carry-over-cleanup*
*Context gathered: 2026-05-09*
