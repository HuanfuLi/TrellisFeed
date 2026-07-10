# Phase 25: Anime Knowledge Tree (Trellis) for Planner Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `25-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 25-anime-knowledge-tree-for-planner-page-motivational-review-visualization
**Areas discussed:** Tree visual style (rendering + art + metaphor + assets), Data mapping, Planner placement, Interaction & animation, Layout algorithm, Empty state, Update cadence, Visual asset strategy, Prototype strategy

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Tree visual style | Rendering approach, art direction, metaphor | ✓ |
| Data mapping | What a leaf represents, state thresholds | ✓ |
| Planner placement | Where the tree lives on PlannerScreen | ✓ |
| Interaction & animation | Tap behavior, falling animation, celebrations | ✓ |

**User's choice:** All four areas selected.

---

## Rendering Approach (initial)

| Option | Description | Selected |
|--------|-------------|----------|
| Framer Motion + SVG | Zero bundle cost, native touch, soft gradients, spring physics | ✓ |
| React-Konva (Canvas) | Best touch support, filters, +120 KB | |
| PixiJS + React-Pixi (WebGL) | Particle effects, sprite textures, +80–100 KB | |
| SVG tree + PixiJS overlay | Hybrid, cinematic effects + clean DOM tap | |

**User's choice:** Framer Motion + SVG.
**Notes:** Leverages existing project dependency. Later expanded with AI background layer and video variant.

---

## Art Style

| Option | Description | Selected |
|--------|-------------|----------|
| Soft illustrated anime (Ghibli) | Pastel gradients, rounded shapes, warm palette | ✓ |
| Vibrant anime pop | Bold cel-shaded, sharp outlines, gamified | |
| Minimal watercolor | Zen ink-wash, abstract color blobs | |
| You decide | Claude picks | |

**User's choice:** Soft illustrated anime (Ghibli).

---

## Data Mapping (Leaf = ?)

| Option | Description | Selected |
|--------|-------------|----------|
| Anchor nodes (concepts) | 5–30 leaves, aggregate child Q&A stats | ✓ |
| Individual Q&As | 20–200+ leaves, precise per-item feedback | |
| Flashcards | Direct 1:1 with SM-2 schedule | |
| Mixed (anchors + flashcards) | Richer but more complex | |

**User's choice:** Anchor nodes (concepts).

---

## Planner Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Hero section at top | ~200–250px compact, scrolls with page | ✓ |
| Expandable card | Collapsed mini-summary, tap to expand | |
| Full-screen overlay | Separate route like GraphScreen | |
| Replace GraphScreen | Merge with existing mindmap | |

**User's choice:** Hero section at top.

---

## Leaf Tap Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to review directly | Tap → ReviewScreen filtered | |
| Show detail tooltip | Inline popover with stats | |
| Both (tooltip then navigate) | Tooltip with action buttons → navigate | ✓ |
| You decide | Claude picks | |

**User's choice:** Both (tooltip then navigate).

---

## Fall Animation

| Option | Description | Selected |
|--------|-------------|----------|
| Gentle drift down | Ghibli-style slow sway fall, 3–4s | ✓ |
| Quick tumble | Fast spin + bounce, urgent | |
| No fall animation | Color change in-place | |
| You decide | Claude picks | |

**User's choice:** Gentle drift down.

---

## State Thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| Based on due date | daysOverdue windows + easeFactor floor | ✓ |
| Percentage-based | % of Q&As on schedule | |
| You decide | Claude picks | |

**User's choice:** Based on due date.

---

## Positive Reinforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — blossoms/sparkles | Pulse + sparkles on review, bud → leaf on new anchor | ✓ |
| No — only status | Only review status reflected | |
| You decide | Claude picks | |

**User's choice:** Yes — blossoms/sparkles.

---

## Revisit: Metaphor Change (Tree → Trellis)

**User's input (free text):** "I also want to explore using Trellis and vine with leaves and blossom instead of tree since the project may be later rebranded as Trellis."

**Outcome:** Metaphor switched from tree to trellis + vines. All subsequent decisions use vine/trellis vocabulary.

---

## Trellis Metaphor Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Classic garden trellis | Rectangular wooden lattice, vines climb through | ✓ |
| Arched garden arbor | Curved pergola, organic silhouette | |
| Single vine on trellis panel | One main vine forking up a panel | |
| You decide | Claude picks | |

**User's choice:** Classic garden trellis.

---

## Vine Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| One vine per branch | Each Knowledge Branch = color-coded vine | ✓ |
| Single unified vine | Entire graph as one vine | |
| Vines grow dynamically | New branches sprout in real-time | |

**User's choice:** One vine per branch.

---

## Blossoms Meaning

| Option | Description | Selected |
|--------|-------------|----------|
| Mastered anchors | Reviewed + easeFactor > 2.5 → persistent blossom | ✓ |
| Recent review completion | Temporary blossom fade on review | |
| Seasonal/decorative only | Tied to garden health overall | |
| You decide | Claude picks | |

**User's choice:** Mastered anchors.

---

## Revisit: Trellis Grid Rigidity + Fruit Mechanic

**User's input (free text):** "Grid feels too rigid. Background should look like Trellis but leaves and blossoms can be placed on vines that may cross between grids. Also, not yet decided how to handle leaves when user has a lot of knowledge learned. Maybe we should let the mastered knowledge nodes to blossom and bear fruit and user can collect them."

**Outcome:** Two follow-up decisions:
1. Vine layout decoupled from grid (trellis = backdrop only)
2. Fruit/harvest lifecycle introduced for mastered anchors

---

## Vines vs. Trellis Grid

| Option | Description | Selected |
|--------|-------------|----------|
| Trellis as backdrop only | Faint lattice, vines curve freely across | ✓ |
| Trellis as soft guide | Vines mostly follow grid, occasional deviation | |
| No trellis — just vines | Drop lattice entirely | |
| You decide | Claude picks | |

**User's choice:** Trellis as backdrop only.

---

## Fruit Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Mastered → bloom → fruit → harvest | Full lifecycle with collect mechanic | |
| Fruit = cosmetic only | Visual richness, no state to manage | |
| Fruit unlocks something | Game-like progression | ✓ |
| You decide | Claude picks | |

**User's choice:** Fruit unlocks something (but then deferred rewards to future phase).

---

## Fruit Rewards Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Garden cosmetics | Themes, materials, creatures | |
| Streak/milestone counter | Simple progress stat | |
| Defer to future phase | Scope to fruit APPEARANCE only | ✓ |
| You decide | Claude picks | |

**User's choice:** Defer to future phase. Fruit appears on tree in Phase 25; harvest/collect mechanic in future phase.

---

## Empty State

| Option | Description | Selected |
|--------|-------------|----------|
| Empty trellis + seed hint | Seed on ground + "Ask a question" CTA | ✓ |
| Hidden entirely | Don't render until ≥1 anchor | |
| Animated sprout teaser | Decorative loop with atmospheric copy | |

**User's choice:** Empty trellis + seed hint.

---

## Update Cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Mount + event-driven | No polling, subscribe to eventBus | ✓ |
| Mount + interval polling | 60s interval catches date boundaries | |
| You decide | Claude picks | |

**User's choice:** Mount + event-driven.

---

## Layout Algorithm

| Option | Description | Selected |
|--------|-------------|----------|
| Organic, seeded deterministic | Consistent across loads, organic feel | ✓ |
| Manual curated layout | Hardcoded for first N branches | |
| You decide | Claude picks | |

**User's choice:** Organic, seeded deterministic.

---

## Revisit: Visual Richness Concern

**User's input (free text):** "I want to discuss more about visuals. We may try several pathways, creating several branches. I guess SVG will not look organic and rich, so we may use AI-generated image background?"

**Outcome:** Expanded rendering scope to include AI background option and multi-variant prototyping strategy.

---

## Visual Source

| Option | Description | Selected |
|--------|-------------|----------|
| AI background + SVG interactive layer | Rich PNG backdrop + SVG overlay | ✓ (Variant A) |
| AI tiled pattern + SVG foreground | SVG `<pattern>` fills from AI tiles | |
| Pure SVG, stylized | Gradients + filters, no raster | ✓ (Variant C) |
| Multiple AI scene variants | 3–5 full scenes user can pick | |

**User's choice:** Try BOTH A and C as prototypes.

---

## Prototype Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — plan 2-3 variants | Multiple switchable variants built | ✓ |
| No — commit to one | Pick one, iterate if wrong | |
| Screenshot mockups first | AI mockups before committing | ✓ |

**User's choice:** Both — mockups first AND build variants.

---

## Revisit: Video Background Consideration

**User's input (free text):** "Will it be better to make the background a loop video? Note that all first-level screens are always mounted, will this cause dramatic performance overhead?"

**Claude's response:** Video is risky due to always-mounted first-level screens (battery, decode cost, bundle size). Recommended static image + SVG ambient animation as the default; offered video as optional third prototype variant with IntersectionObserver pause guard.

**User's decision:** Keep video as a prototype variant (Variant V).

**Outcome:** Three prototype variants finalized: A (static image), C (pure SVG), V (loop video). All three share data/event/layout layer.

---

## Asset Sourcing Clarification

**User's input (free text):** "We don't use the nano banana API already built in the project, but I will use outside service to provide images. Background images should not be generated during user's usage but should be pre-filled in project directory. For each image, please provide prompts so I call nano banana in a separate outside service."

**Outcome:**
- Do NOT use in-app Nano Banana/Gemini pipeline for these backgrounds
- Assets generated externally by user, pre-filled in project directory
- CONTEXT.md includes explicit image/video prompts for:
  - Asset 1: Variant A primary background (empty trellis)
  - Asset 2: Variant V loop video (base still + motion prompt)
  - Mockup 1–3: design review visuals for all three variants

---

## Claude's Discretion

Areas left for Claude/planner to decide during implementation:
- Exact spring physics (stiffness, damping) for animations
- Specific color hex values (derive from existing CSS variables)
- Tooltip popover styling details (match existing `Card` + `Badge`)
- Seed hash function choice
- Initial leaf detach threshold within the 7–14 day window
- Variant picker UI (dev toggle vs Settings entry)

---

## Deferred Ideas

- Harvest/collect mechanic (tap fruit to collect into basket)
- Cosmetic unlock system (seasonal themes, trellis materials, ambient creatures)
- Scene theme picker in Settings
- Milestone badges / fruit counter
- Replacing the existing GraphScreen mindmap
- Multiple branches overflow handling (10+ branches needs layout polish)
