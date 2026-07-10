# Phase 25 — Manual QA Checklist

Run this list after all automated waves pass. Tick items as they are verified on a real device + desktop Chrome.

## Environment

- [ ] `npm --prefix app run build` succeeds
- [ ] App loaded in Chrome desktop at http://localhost:5173
- [ ] App loaded on real iOS device via Capacitor (if available)
- [ ] Real AI asset present in `app/src/assets/planner-trellis/trellis-bg-default.png`

## Variant A (Static Image + SVG)

- [ ] Set `localStorage.setItem('trellis_variant_dev', 'A')`; reload PlannerScreen
- [ ] Ghibli watercolor background renders full-bleed behind SVG canvas
- [ ] If asset absent, warm gradient fallback renders without console errors
- [ ] Vine draw-on animation visible over background on first mount
- [ ] Leaves pop in staggered after vines finish, stems oriented toward vine
- [ ] Tap a leaf — tooltip appears with correct copy per state

## Variant C (Pure SVG)

- [ ] Set variant to 'C'; reload
- [ ] Diamond cross-hatch lattice with wooden rails renders; no image network requests
- [ ] Vine draw-on visible with natural green/brown colors
- [ ] Leaves pop in as botanical silhouettes (pointed leaves, sakura blossoms, apple fruits)
- [ ] Branch lines connect vine to each leaf position

## Leaf Shapes (both variants)

- [ ] Bud: small teardrop sprout with stem
- [ ] Green: pointed leaf with central + side veins
- [ ] Yellow: curling leaf with fold line
- [ ] Falling: tilted leaf with crease
- [ ] Fallen: small crumpled shape, dashed vein
- [ ] Blossom: 5-petal sakura flower with yellow pistil
- [ ] Fruit: apple with stem, leaf accent, white highlight
- [ ] All leaves visibly sized (~1.8x scale) and stems point toward vine attachment

## Interaction

- [ ] Tap leaf — tooltip opens (no recursive trigger of underlying buttons)
- [ ] Tap outside tooltip — closes
- [ ] Tap close x button — closes
- [ ] Tap another leaf while tooltip open — previous closes, new opens (no overlap)
- [ ] Tap Review — navigates to /review with anchorReview filter (flashcards filtered to this anchor's Q&As)
- [ ] Tap View Q&As — navigates to /anchor/{id}
- [ ] Tooltip never overflows hero bounds even on corner-positioned leaves
- [ ] Aria-label on hero root reads "Knowledge garden — your review health visualization"

## States

- [ ] Empty state (fresh localStorage): `Plant your first seed` + seed emoji + `Ask a question` CTA. Tap CTA — navigates to /ask.
- [ ] Populated state: leaf states reflect actual FlashCard review data (not all buds)
- [ ] Mixed health visible: green, yellow, falling, fallen states with correct colors
- [ ] If a blossom-eligible anchor exists: sakura petal shape renders in lavender
- [ ] If a fruit-eligible anchor exists (blossom date >= 7 days ago): apple fruit shape renders

## Review loop (closes the real pipeline)

- [ ] With a falling/yellow anchor visible, navigate to /review, submit a 4-star review on one of its child Q&As
- [ ] Return to Planner — the leaf's state updates via REVIEW_COMPLETED event
- [ ] OR: stay on Planner after review — event-driven update triggers recompute and leaf color transition

## Ambient animation gates

- [ ] Sway visible on at least 1 leaf when on Planner (count <= 20 — all leaves sway; > 20 — every 3rd)
- [ ] Navigate to Home tab; inspect DevTools Performance — no transform/rotate recalcs on trellis leaves (sway paused)

## Accessibility

- [ ] Keyboard focus on leaves: tab cycles through, Enter/Space opens tooltip
- [ ] Tooltip close button has aria-label `Close tooltip`
- [ ] Contrast ratio of tooltip text passes WCAG AA (DevTools — accessibility check)

## PlannerScreen layout

- [ ] Trellis Hero renders at top, directly followed by Suggested Moves section (no Learning Check-In card)
- [ ] Variant picker pill (dev-only) at top-right cycles between A and C

## Variant comparison and decision

After both variants (A and C) are validated on real hardware:

- [ ] User reviews both variants back-to-back
- [ ] User picks default variant for the next release
- [ ] Document the decision in `.planning/STATE.md` under "Latest Decisions"
