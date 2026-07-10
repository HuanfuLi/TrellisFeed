# Phase 11: Planner Retry & Milestone Card Variety - Context & Decisions

**Discussed:** 2026-03-27  
**Locked Decisions:** 4/4

---

## Phase Goal
Add user control for regenerating Planner suggestions and expand the visual design of milestone cards to prevent monotony and provide visual variety.

---

## Locked Design Decisions

### 1. Regeneration Rate Limiting ✅
**Decision:** Unlimited regenerations with warning after 5+ attempts

**Rationale:**
- Respects user autonomy (no hard limits)
- Shows warning to prevent accidental API spam
- Educates without restricting (teaches consequence without punishment)
- Leverages Phase 10 cooldown (24h global cooldown already prevents daily thrashing)

**Implementation details:**
- Add regeneration counter to auto-gen tracking (localStorage)
- After 5 attempts: Show warning modal "Are you sure? High API usage"
- Reset counter daily (aligns with Phase 10's 24h refresh)
- No API rate limit errors—falls back to previous suggestions if exceeded

---

### 2. Card Design Rotation Strategy ✅
**Decision:** Random selection for each card (stateless)

**Rationale:**
- Simple to implement, no state management overhead
- Natural variation feels organic (not algorithmic cycles)
- Prevents predictability without complexity
- Allows same design to appear in sequence if random favors it (natural)

**Implementation:**
```typescript
const designs = ['gradient', 'outline', 'solid'];
const selectedDesign = designs[Math.floor(Math.random() * designs.length)];
```

**Note:** If users report fatigue with repeated designs, pivot to biased random (D-02b) in Phase 12.

---

### 3. Visual Design Direction ✅
**Decision:** Use proposed 3+ designs (Gradient + Icon, Outline + Monochrome, Solid + Badge)

**Rationale:**
- Already defined in existing PLAN.md (no reinvention)
- Covers aesthetic spectrum (colorful, minimal, bold)
- Icon badges provide visual signaling + accessibility cue
- Progress bars ensure design consistency across variants

**Design Specifications:**
1. **Design 1: Gradient + Icon**
   - Colorful gradient background (theme-aware)
   - Large icon badge (top-left or center)
   - Title + subtitle minimal
   - Progress bar bottom (semi-transparent)
   - Feeling: Modern, energetic

2. **Design 2: Outline + Monochrome**
   - Border-focused (2-4px stroke)
   - Monochrome text + subtle accent color
   - Icon inline with title
   - Progress bar minimal
   - Feeling: Clean, professional

3. **Design 3: Solid + Badge**
   - Solid color background (per category/milestone)
   - Corner badge with category icon
   - Bold typography
   - Progress bar emphasis
   - Feeling: Bold, purposeful

**Implementation:** Export as variants in CardStyleComponent.tsx (3 CSS-in-JS styles or Tailwind variants).

---

### 4. Accessibility Priority ✅
**Decision:** WCAG AAA compliance (highest bar)

**Rationale:**
- Mobile-first app benefits from AAA (colorblind, low vision, motor users critical)
- EchoLearn is learning/education—accessibility non-negotiable
- Users may have dyslexia, color blindness, tremors
- AAA ensures universal design from day 1 (not afterthought)

**Accessibility Requirements:**
- **Color contrast:** 7:1 minimum (AAA) for all text on backgrounds
- **Text sizing:** 14px minimum (mobile), scalable to 2x (browser zoom)
- **Touch targets:** 48x48px minimum (AAA standard)
- **Motion:** Reduced motion support (prefers-reduced-motion media query)
- **Colorblind:** Pattern + color (not color alone for meaning)
- **Screen readers:** ARIA labels for card designs, roles, state
- **Focus management:** Visible focus indicators (not removed)
- **Error handling:** Clear error messaging with aria-live regions

**Testing:**
- WebAIM contrast checker for all color combinations
- NVDA + VoiceOver testing (screen readers)
- axe-core automated accessibility audit
- Manual testing on 2+ screen sizes (375px, 600px+)

---

## Gray Areas Resolved

| Question | Decision | Owner |
|----------|----------|-------|
| How many regeneration attempts before warning? | 5 attempts, then warning | Retry logic |
| How to select which design for each card? | Random selection (stateless) | Card renderer |
| Which visual designs to implement? | 3 proposed: Gradient, Outline, Solid | UI design |
| Accessibility standard? | WCAG AAA (7:1 contrast, 48px targets) | Component team |

---

## Design Guardrails

### What This Phase DOES Include
✅ Retry button next to Suggested Moves header  
✅ Regeneration trigger (respects Phase 10 24h cooldown)  
✅ Unlimited attempts + warning UX  
✅ 3+ card design variants  
✅ Random design selection per card  
✅ WCAG AAA compliance  
✅ Responsive design (375px-600px+)  
✅ Cohesion with existing theme  

### What This Phase DOES NOT Include
❌ User-selectable card themes (Phase 12)  
❌ Per-card design pinning/locking (Phase 12)  
❌ Animation/transition enhancements (Phase 12)  
❌ A/B testing card designs (Phase 13)  
❌ Custom card builder (Phase 14+)  

---

## Downstream Artifacts

**For gsd-planner:**
- Rate limiting: Unlimited attempts + warning after 5
- Rotation: Random per card (no sequence memory)
- Designs: 3 variants ready (gradient, outline, solid)
- Accessibility: WCAG AAA required for all designs

**For gsd-phase-researcher (if needed):**
- Card design patterns: Existing PLAN.md provides directions
- Accessibility patterns: WCAG AAA checklist, tools (WebAIM, axe-core)
- Button UX: Retry mechanics, state management
- Rate limiting: Counter logic + warning timing

---

## Testing Implications

**Unit tests:**
- Regeneration counter logic (increment, reset daily)
- Design selection randomness (distribution, no bias)
- Warning trigger (fires at 5+)
- Cooldown enforcement (respects Phase 10 rules)

**Accessibility tests:**
- Contrast ratio checker (all color combos ≥ 7:1)
- ARIA labels + screen reader coverage
- Touch target sizes (≥ 48x48px)
- Focus indicators visible
- Motion/animation respects prefers-reduced-motion

**Integration tests:**
- Retry button updates Phase 10 suggestions
- Card designs render correctly with all state combinations
- Designs persist across app restart (localStorage)
- Designs appear random over 10+ cards

**Manual UAT:**
- Device testing: 375px (iPhone SE), 600px+ (iPad)
- Screen reader testing: NVDA on Windows, VoiceOver on iOS
- Colorblind testing: Deuteranopia simulation (DevTools)
- Touch testing: Button/card tap responsiveness

---

## Notes & Follow-ups

**Deferred ideas (for future phases):**
- User-selectable card themes (Phase 12)
- Per-card design pinning (Phase 12)
- Card animation/transitions (Phase 12)
- A/B testing variant performance (Phase 13)
- Custom card builder (Phase 14+)

**Open questions for planning phase:**
- Should warning modal include "don't show again" toggle?
- Should regeneration counter be visible to user (UI indicator)?
- Should card styles be device-specific (different on tablet vs phone)?
- Should designs rotate based on time of day (morning = gradient, evening = solid)?

**Dependencies on Phase 10:**
- Phase 10 must complete first (provides auto-gen foundation)
- Phase 10 24h cooldown is prerequisite for rate limiting strategy
- Phase 10 AUTO_GEN_UPDATED event used to trigger retry logic

---

## Testing Checklist (Phase 11 UAT)

### Regeneration Feature
- [ ] Retry button visible next to "Suggested Moves" header
- [ ] Tapping retry generates new suggestions
- [ ] Warning modal appears after 5 regeneration attempts
- [ ] Counter resets after 24 hours
- [ ] Error handling: graceful fallback if API limit hit

### Card Design Variety
- [ ] 3+ card designs render correctly
- [ ] Designs appear random across multiple cards
- [ ] Same design can appear twice in sequence (not filtered)
- [ ] Designs persist after app restart

### Accessibility (WCAG AAA)
- [ ] All text contrast ≥ 7:1 ratio
- [ ] Touch targets ≥ 48x48px
- [ ] Focus indicators visible on buttons
- [ ] Screen reader labels present and descriptive
- [ ] prefers-reduced-motion respected (no forced animations)
- [ ] Works on 375px width (iPhone SE)
- [ ] Works on 600px+ width (iPad/larger phones)

---

*Phase: 11-planner-retry-milestone-cards*
*Context gathered: 2026-03-27 via user discussion*

