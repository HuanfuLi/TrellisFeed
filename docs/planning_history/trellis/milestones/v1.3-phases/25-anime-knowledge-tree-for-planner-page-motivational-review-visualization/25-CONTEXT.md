# Phase 25: Anime Knowledge Tree (Trellis) for Planner Page - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a motivational knowledge visualization hero section on PlannerScreen that reflects the user's review health as a trellis-and-vines garden. Anchor nodes appear as leaves whose color/state communicates review schedule status (green/yellow/falling/fallen). Mastered anchors bloom and bear fruit. Three rendering variants are built as prototypes for visual evaluation before locking in a single direction.

**Out of scope (deferred to future phases):**
- Harvest/collect mechanic (tapping fruit to collect)
- Cosmetic unlock system (seasonal themes, trellis materials, ambient creatures)
- Scene theme picker in Settings
- Milestone badges / fruit counter
- Replacing the existing GraphScreen mindmap

</domain>

<decisions>
## Implementation Decisions

### Metaphor & Visual Language
- **D-01:** Trellis + vines + leaves + blossoms + fruits metaphor (selected over tree to align with potential "Trellis" project rebrand)
- **D-02:** Classic garden trellis backdrop — faint lattice serves as soft atmospheric background only
- **D-03:** Vines flow freely with organic bezier curves — NOT constrained to lattice grid cells. Leaves/blossoms/fruits positioned along vine paths, not on grid intersections
- **D-04:** Ghibli-inspired soft watercolor aesthetic — warm palette, pastel colors, dreamy painterly quality, soft gradients, rounded shapes

### Lifecycle States (per anchor node)
- **D-05:** State progression: `bud 🌱` (new anchor) → `leaf 🍃` (reviewed ≥1 time) → `blossom 🌸` (mastered) → `fruit 🍎` (sustained mastery)
- **D-06:** Leaf color derived from aggregated child Q&A review health:
  - **Green:** all child Q&As `daysOverdue < 0` (on schedule)
  - **Yellow:** any child Q&A 1–7 days overdue
  - **Falling:** any child Q&A 7–14 days overdue
  - **Fallen:** any child Q&A 14+ days overdue OR aggregate `easeFactor < 1.5`
- **D-07:** State aggregation rule: **worst child state wins** (e.g., one 14-day-overdue Q&A causes the anchor leaf to fall, even if other Q&As are healthy)
- **D-08:** Blossom threshold: all child Q&As reviewed AND aggregate `easeFactor > 2.5`
- **D-09:** Fruit threshold: anchor has been in blossom state for 7+ consecutive days
- **D-10:** Fruits APPEAR on the tree in this phase but are NOT interactive — harvest mechanic deferred

### Data Mapping (Knowledge Graph → Trellis)
- **D-11:** Leaf = anchor node (`isAnchorNode === true`). Typical scale: 5–30 leaves per user
- **D-12:** Knowledge Branch → one vine per branch (color-coded)
- **D-13:** Cluster → fork/junction on parent vine
- **D-14:** Anchor → leaf at fork endpoint (parametric position along vine segment)
- **D-15:** Blossoms/fruits layered onto existing leaves when mastered, not additional nodes

### Layout Algorithm
- **D-16:** Seeded deterministic — vines and leaves stay in the same positions across reloads but feel organic (not grid-aligned)
- **D-17:** Per-branch: vine path = SVG cubic bezier starting at canvas bottom, climbing with seeded direction choices. Seed = `hash(branch.id)`
- **D-18:** Per-anchor: leaf position = parametric point along parent vine segment + small seeded perpendicular jitter. Seed = `hash(anchor.id)`
- **D-19:** 50+ anchors: leaves scale down proportionally, vines spread wider across the canvas. No hard cap / overflow UI in this phase

### Placement on PlannerScreen
- **D-20:** Hero section at top of PlannerScreen, above existing `Suggested Moves` / portal cards / diagnostic chat sections
- **D-21:** Height: ~200–250px on mobile viewport
- **D-22:** Aspect: wide landscape (~2:1 ratio)
- **D-23:** Scrolls away naturally as the user scrolls down to action items (not sticky)

### Rendering Approach — Three Prototype Variants
Phase 25 builds all three variants side-by-side as switchable prototypes (dev-only toggle and/or Settings option). Final variant chosen via empirical comparison after implementation:

- **D-24 (Variant A — Static Image + SVG):** AI-generated trellis background PNG pre-shipped as project asset. SVG interactive overlay renders vines, leaves, blossoms, fruits, animations. Framer Motion for transitions.
- **D-25 (Variant C — Pure SVG):** No raster assets. Hand-crafted SVG with gradients, filters (`feGaussianBlur`, `feTurbulence`, `feDropShadow`), custom paths. Modern flat-illustration aesthetic.
- **D-26 (Variant V — Loop Video + SVG):** Short seamless MP4/WebM loop as background + SVG interactive overlay. **MUST pause via `IntersectionObserver` + `document.visibilitychange` when Planner not visible** (critical performance guard — other first-level screens stay mounted).
- **D-27:** All three variants share the same data layer, state computation, event subscriptions, and layout algorithm. They differ only in rendering components.

### Design Validation (Before Implementation)
- **D-28:** Generate screenshot mockups for all three variants BEFORE committing to implementation details. Reviewed during `/gsd:plan-phase`, not part of phase execution.
- **D-29:** Mockups allow visual reality-check and may eliminate a variant early (e.g., if Variant V feels too busy in still-frame form).

### Asset Strategy
- **D-30:** All background images and video loops pre-generated OUTSIDE the app by the user via an external Nano Banana / image service. Saved as static assets in the project directory.
- **D-31:** **Do NOT use the existing in-app Nano Banana / Gemini image pipeline** (imageGeneration.bootstrap, concept-feed image generation) for these backgrounds. Those are for runtime post images.
- **D-32:** No runtime image generation. Reasoning: performance (mobile/Capacitor), offline-first, no API dependency, predictable bundle cost.
- **D-33:** Asset location: `app/src/assets/planner-trellis/` (final path decided in planning).

### Tap Interaction (Leaves)
- **D-34:** Tap leaf → inline tooltip popover with: anchor name, Q&A count, reviewed count, overdue count, health summary
- **D-35:** Tooltip action buttons: `[Review]` (navigates to ReviewScreen filtered by anchor) and `[View Q&As]` (navigates to AnchorDetailScreen or equivalent)
- **D-36:** Dismiss tooltip: tap outside, tap X, or tap another leaf (single tooltip at a time)
- **D-37:** Fallen leaves on ground: decorative only, not interactive in this phase

### Animations
- **D-38:** **Leaf color transition:** 2s ease when state changes (green → yellow, etc.)
- **D-39:** **Falling leaf:** detaches from vine → `translateY` downward + sinusoidal horizontal drift + slow rotation → 3–4s duration. Triggered when anchor crosses from yellow to falling state.
- **D-40:** **Landing:** leaf shrinks slightly at ground level, settles as small fallen leaf at tree base. Persists as long as anchor is in fallen state.
- **D-41:** **Celebration — review completed:** corresponding leaf scale pulse (1 → 1.2 → 1) + brief sparkle particles (~6 small dots, fade out over 800ms)
- **D-42:** **Celebration — new anchor created:** small bud appears on vine → grows into leaf (scale 0 → 1, spring physics, ~600ms)
- **D-43:** **Celebration — all-green state:** subtle tree-wide bloom glow + gentle ambient sway (low-amplitude rotate loop on all leaves)
- **D-44:** **Celebration — blossom unlock:** leaf → blossom transition with petal-unfurl animation
- **D-45:** **Celebration — fruit appears:** blossom → fruit transition with scale-in and subtle glow
- **D-46:** **Mount animation:** vines draw on first appearance (SVG `stroke-dashoffset` animation, orchestrated per-branch)

### Update Cadence
- **D-47:** Compute state on PlannerScreen mount (full pass over all anchors)
- **D-48:** Subscribe to eventBus events for targeted in-session updates:
  - `REVIEW_COMPLETED` → recompute affected anchor, animate color transition
  - `CLASSIFICATION_COMPLETED` → add new bud with grow animation
  - `ANCHOR_DELETED` → leaf fades out and detaches
- **D-49:** No polling (battery-friendly). Date-boundary crossings (e.g., Q&A flipping from on-time to overdue at midnight) refresh on next mount.

### Empty State
- **D-50:** When user has 0 anchors: render empty trellis backdrop (same as Variant A/C/V background) + `🌱` seed illustration on the ground
- **D-51:** Empty-state copy: "Plant your first seed by asking a question"
- **D-52:** CTA button: "Ask a question →" navigates to `/ask`

### Performance Guards (All Variants)
- **D-53:** When PlannerScreen is not the active route, all animations pause (already handled by React unmount for non-first-level screens; must be verified for Variant V video playback specifically)
- **D-54:** Variant V video: `muted playsInline loop preload="metadata"`, ≤2s seamless loop, ≤500 KB bundle, 480p max
- **D-55:** SVG leaf count > 50 → reduce ambient animation complexity (e.g., only sway a random subset each frame)

### Claude's Discretion
- Exact spring physics values (stiffness, damping) for animations
- Specific color hex values (should derive from existing CSS variables: `--primary-40`, `--node-mint`, `--node-peach`, etc.)
- Tooltip popover styling details (should match existing `Card` + `Badge` patterns)
- Seed hash function choice (any deterministic hash is fine)
- Initial leaf detach threshold within the 7–14 day window (tunable)
- Variant picker UI (dev-only toggle vs Settings entry)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase context (design continuity)
- `.planning/phases/13-planner-redesign/13-01-CONTEXT.md` — PlannerScreen baseline layout, chunk cards, signal dot colors
- `.planning/phases/14-knowledge-graph-classification-and-anchor-nodes/` — anchor node model (`isAnchorNode`, `anchorId`, `clusterNodeId`), classification pipeline
- `.planning/phases/15-knowledge-cluster-navigation-and-reflection/` — cluster/anchor hierarchy, `buildAnchorReflectionTree` semantics
- `.planning/phases/23-incremental-mindmap-classification-with-kv-cache-and-ask-rate-limiter/23-CONTEXT.md` — current classification pipeline producing branches/clusters/anchors

### Relevant code paths (for researcher/planner to study)
- `app/src/services/canonical-knowledge.service.ts` — `buildAnchorReflectionTree` returns the branch → cluster → anchor → Q&As structure this phase visualizes
- `app/src/services/review.service.ts` — SM-2 interval calculation and `submitReview` event emission
- `app/src/screens/PlannerScreen.tsx` (632 lines) — hero insertion point above existing `SectionHeader` calls
- `app/src/screens/GraphScreen.tsx` — existing mind-elixir rendering of the same hierarchy (reference for data shape, NOT rendering)
- `app/src/types/index.ts` — `Question`, `ReviewSchedule`, `FlashCard` types (`nextReviewDate`, `reviewCount`, `easeFactor`)
- `app/src/lib/event-bus.ts` — eventBus for `REVIEW_COMPLETED`, `CLASSIFICATION_COMPLETED`, `ANCHOR_DELETED` subscriptions
- `app/src/state/useQuestions.ts` — how classification events are emitted today

### Design system references
- `app/src/index.css` — CSS variables: `--node-mint`, `--node-salmon`, `--node-lilac`, `--node-peach`, `--node-sky`, `--primary-40`, `--surface`, `--surface-variant`
- `app/src/components/ui/Card.tsx`, `Badge.tsx` — tooltip popover style baseline

**No external ADRs or specs** — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Framer Motion** — already a project dependency (Phase 8 carousel, Phase 22 swipe). Zero bundle cost for Variants A and C.
- **`buildAnchorReflectionTree`** (`canonical-knowledge.service.ts`) — returns exactly the hierarchy this phase needs (branches → clusters → anchors → Q&As). Do NOT rebuild the tree from scratch.
- **`eventBus`** — existing pub/sub for cross-component updates. Subscribe for targeted leaf animations.
- **`Card`, `Badge`** components — tooltip popover should reuse these for visual consistency.
- **SM-2 fields on `ReviewSchedule`** — `nextReviewDate`, `reviewCount`, `easeFactor` provide all state computation inputs.

### Established Patterns
- **Inline styles with CSS variables** — project does NOT use Tailwind for most UI. Colors should pull from `--node-*` and `--primary-*` variables.
- **`display: none` toggling for always-mounted screens** — HomeScreen and AskScreen stay mounted. Variant V video MUST handle visibility to avoid decoding while hidden.
- **Service result pattern** — `ServiceResult<T> = { success, data?, error? }` for any new planner-trellis service.
- **localStorage persistence** — all user state persists locally (Phase 0 decision, reinforced throughout).

### Integration Points
- **PlannerScreen.tsx hero insertion** — new `TrellisHero` component mounted above existing sections
- **Event subscriptions** — add to existing eventBus subscription pattern (see `HomeScreen.tsx` `NEWS_POSTS_READY` subscriber)
- **Settings toggle (if variant picker is user-facing)** — add to `useSettings` + `SettingsScreen`
- **Assets** — new directory `app/src/assets/planner-trellis/` holding static backgrounds/videos

</code_context>

<specifics>
## Specific Ideas / Visual References

- User noted potential project rebrand to **"Trellis"** — metaphor chosen to align
- User wants to **prototype multiple pathways** rather than lock in one rendering approach early
- Studio Ghibli watercolor aesthetic — dreamy, warm, inviting (not gamified/vibrant)
- "The trellis is the scaffolding; vines are the user's growing knowledge winding through it"
- Always-mounted first-level screens constraint: video variant MUST pause when hidden

## Image & Video Asset Prompts

The user will generate these assets via an **external** Nano Banana / image service. Save to `app/src/assets/planner-trellis/` (or equivalent). Recommended output: PNG/WebP for images, MP4 H.264 or WebM VP9 for video.

### Asset 1 — Variant A primary background (empty trellis)
**Target file:** `trellis-bg-default.webp` (or .png)
**Aspect ratio:** 2:1 landscape (recommend 2048×1024 for retina)

> A Studio Ghibli-inspired soft watercolor illustration of an empty wooden garden trellis standing in a peaceful backyard garden. The trellis is a simple square lattice of warm-brown weathered bamboo or wooden posts, centered in the scene. Morning golden sunlight filters through with soft bokeh and dappled light. The ground at the base is gentle grass with a hint of pebbled earth. A dreamy pastel sky gradient — peach to warm cream — fills the background, fading into soft atmospheric haze. Low contrast, warm palette, painterly watercolor style, subtly textured like hand-painted animation backgrounds. **No leaves on the trellis, no vines, no people, no characters, no text, no borders.** Landscape orientation, wide 2:1 aspect ratio.

### Asset 2 — Variant V loop video
**Target file:** `trellis-loop.mp4` and `trellis-loop.webm` (both encodings)
**Spec:** 480p (960×480 or similar 2:1), ≤2s seamless loop, ≤500 KB total, H.264 / VP9, muted
**Tool suggestion:** generate a base still with Nano Banana using the prompt below, then animate with an image-to-video service (Runway, Kling, Luma, or similar)

Base still prompt:
> Same scene as Asset 1 (Studio Ghibli watercolor empty wooden trellis in morning garden), reserved for atmospheric motion. Identical composition to Asset 1.

Motion prompt (for image-to-video tool):
> Subtle seamless 2-second loop. Gentle wind moves faint dust motes and pollen particles diagonally across the scene, catching the golden morning light. Very soft light shimmer on the trellis wood. Slow atmospheric drift only — no new objects appearing, no camera movement, no people, no text. Last frame must blend seamlessly with first frame. Avoid dramatic changes; aim for ambient, barely-perceptible life.

### Mockup 1 — Variant A rendered state (design review, not shipped)
**Purpose:** Visualize what the finished Variant A will look like with SVG overlay in place. Used during `/gsd:plan-phase` to validate direction.
**Target file:** `mockup-variant-a.png` (discard after review or keep in `.planning/` for reference)

> The same Ghibli watercolor wooden trellis scene as Asset 1, now with lush green vines climbing up and through the lattice. Vines curve organically, crossing grid cells freely with bezier-like paths. Several rounded pastel mint-green leaves are scattered along the vines. A handful of soft pink cherry-blossom petals cluster at 2–3 vine tips (representing mastered concepts). One or two small red apples hang near those blossoms (representing sustained mastery). A couple of yellowed autumn leaves drift partway down in mid-fall, and 3–4 fallen leaves rest at the base of the trellis on the gentle grass. Morning golden light, warm palette, dreamy painterly quality. **No text, no people, no borders.** Landscape 2:1.

### Mockup 2 — Variant C rendered state (design review, not shipped)
**Target file:** `mockup-variant-c.png`

> Flat vector illustration of a wooden garden trellis with green vines winding through it. Vines curve organically, not confined to grid lines. Rounded pastel mint-green leaves along the vines, a few soft pink blossoms at vine tips, one or two small red fruits hanging from the vines. A couple of yellowed leaves mid-fall, and a few fallen leaves at the base. Clean geometric shapes, limited pastel palette — mint green, warm brown, soft pink, amber, cream. No shading or photorealistic textures — just clean flat fills with subtle gradients. Modern high-end illustration aesthetic like a premium indie game UI or Figma illustration. Rounded shapes with soft 1.5px outlines. **No text, no people, no borders.** Landscape 2:1.

### Mockup 3 — Variant V still frame (design review, not shipped)
**Target file:** `mockup-variant-v.png`

> Same composition as Mockup 1 (Ghibli watercolor trellis with vines, leaves, blossoms, fruits) with added subtle atmospheric motion cues implied by the still — faint light dust motes floating through sunbeams, very gentle leaf-sway implied by slight motion blur on 2–3 leaves, one small firefly or butterfly somewhere in the composition. Everything else static. This is a representative frame from a 2-second looping atmosphere video. **No text, no people, no borders.** Landscape 2:1.

</specifics>

<deferred>
## Deferred Ideas

These came up during discussion and are captured so they aren't lost — but explicitly out of scope for Phase 25:

- **Harvest/collect mechanic** — tap fruit to collect it into a basket. Would remove fruit from tree, freeing space as knowledge base grows. Phase 26+ candidate.
- **Cosmetic unlock system** — fruits unlock seasonal themes (spring/summer/autumn/winter), trellis materials (wood/bamboo/iron), ambient creatures (butterfly/songbird/firefly). Requires shop/picker UI.
- **Scene theme picker in Settings** — user-facing toggle for chosen variant/theme. Only a dev toggle in Phase 25 if user needs to evaluate variants post-launch.
- **Milestone badges / fruit counter** — "10 harvested", "seasoned gardener" — requires defining milestones and notifications.
- **Replacing the existing GraphScreen mindmap** — Phase 25 keeps both (GraphScreen for analytical knowledge view, Trellis for motivational hero). Merging is a future decision.
- **Multiple branches handling when user has 10+ branches** — current layout handles 1–5 cleanly. More branches may need a carousel or condensed form in a later polish phase.

</deferred>

---

*Phase: 25-anime-knowledge-tree-for-planner-page-motivational-review-visualization*
*Context gathered: 2026-04-14*
