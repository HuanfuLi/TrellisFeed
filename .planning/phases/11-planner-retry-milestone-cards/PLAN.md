# Phase 11: Planner Retry & Milestone Card Variety

**Milestone:** v1.1 (Engagement & Discovery Iteration)  
**Status:** Planning  
**Depends on:** Phase 10 (Planner Auto-Suggestions)

## Goal

Add user control for regenerating Planner suggestions and expand the visual design of milestone cards to provide variety and prevent visual fatigue over time.

## Requirements

- **PLANNER-04**: Retry/regenerate suggestions button
- **PLANNER-06**: Rich "Moves" linking (already in Phase 10, complete here)
- **CARDS-01**: Multiple card designs (3+)
- **CARDS-02**: Card design rotation/shuffling
- **CARDS-03**: Accessibility & readability standards

## User Stories

1. **As a learner**, I want to regenerate suggestions if I'm not happy with them, so I can get different recommendations.
2. **As a learner**, I want milestone cards to look visually different from each other, so the Planner doesn't feel monotonous.
3. **As a learner**, I want all card designs to be accessible and readable on my mobile device.

## Success Criteria

1. ✅ "Retry" button appears next to Suggested Moves header
2. ✅ Tapping Retry regenerates new suggestions
3. ✅ Max 3 regenerations per day (prevent algorithm spam)
4. ✅ Milestone cards display in 3+ distinct visual styles
5. ✅ Styles rotate across cards in Planner
6. ✅ All designs pass WCAG AA accessibility standards
7. ✅ Cards responsive on 375px to 600px+ screens
8. ✅ Card styles feel cohesive with overall app theme

## Card Design Directions

### Design 1: Gradient + Icon
```
┌──────────────────────┐
│  📚 Gradient BG      │
│  ─────────────────   │
│  Title               │
│  Progress bar        │
└──────────────────────┘
Characteristics: Colorful gradients, icon badge, minimal text
Feeling: Modern, energetic
```

### Design 2: Outline + Monochrome
```
┌──────────────────────┐
│  Bordered outline    │
│  ─────────────────   │
│  Title + subtitle    │
│  [Status indicator]  │
└──────────────────────┘
Characteristics: Clean borders, single color accent, hierarchical text
Feeling: Minimal, organized
```

### Design 3: Illustration + Contextual
```
┌──────────────────────┐
│  [Concept illust.]   │
│  ─────────────────   │
│  Title in overlay    │
│  Progress bottom     │
└──────────────────────┘
Characteristics: Custom SVG illustrations per concept, full-bleed image
Feeling: Playful, engaging
```

### Design 4: Card Shadow + Layered
```
┌──────────────────────┐
│  ╲ Shadow layer      │
│   Title              │
│   ─────────────────  │
│   Progress + action  │
│                      │
└──────────────────────┘
Characteristics: Depth with shadows, 3D-like appearance, spacious
Feeling: Premium, tactile
```

(Pick any 3-4 of these + create 1-2 original designs)

## Task Breakdown

### Wave 1: Retry Button & Logic (Days 1)

#### T11.1: Retry Button Component
- Add "Retry" button next to "Suggested Moves" header
- Show icon (refresh icon) + text
- Styling consistent with theme
- **Acceptance:** Button renders, clickable

#### T11.2: Retry Logic
- Implement `retryGenerateSuggestions()` function
- Call `moveGenerator.generateMoves()` with same KG data
- Use different randomization (not exact same suggestions)
- Show loading indicator during generation
- Update UI with new suggestions
- **Acceptance:** New suggestions appear after retry

#### T11.3: Retry Counter
- Track retry attempts per day
- Max 3 retries per 24 hours
- Show message if limit reached: "Try again tomorrow"
- Disable button at limit
- Reset counter daily
- **Acceptance:** Counter works, button disables at limit

### Wave 2: Card Design System (Days 1-2)

#### T11.4: Card Design Registry
- Create `src/components/UI/MilestoneCardDesigns.ts`
- Define 4 design variants:
  - `GradientIconCard`
  - `OutlineCard`
  - `IllustrationCard`
  - `ShadowLayeredCard`
- Export factory function: `selectCardDesign(index): CardDesign`
- Implement round-robin selection
- **Acceptance:** All designs registered and accessible

#### T11.5: Gradient + Icon Card
- Create `src/components/UI/Cards/GradientIconCard.tsx`
- Accept: concept, progress, status
- Implement gradient background (colorful, 2-3 colors)
- Add icon badge (emoji or SVG)
- Show title and progress bar
- **Acceptance:** Card renders beautifully

#### T11.6: Outline + Monochrome Card
- Create `src/components/UI/Cards/OutlineCard.tsx`
- Implement clean border (2px, theme color)
- Show title + subtitle
- Add status indicator (badge)
- Single accent color
- **Acceptance:** Card is clean and readable

#### T11.7: Illustration + Contextual Card
- Create `src/components/UI/Cards/IllustrationCard.tsx`
- Accept concept ID
- Load or generate concept illustration
- Show title as overlay
- Progress bar at bottom
- **Acceptance:** Illustrations render, layout is balanced

#### T11.8: Shadow Layered Card
- Create `src/components/UI/Cards/ShadowLayeredCard.tsx`
- Implement layered shadow effect
- Spacious layout with breathing room
- Show progress + action button
- Premium feel with depth
- **Acceptance:** Card has distinct premium feel

### Wave 3: Design Rotation & Integration (Days 2-3)

#### T11.9: Card Rotation Logic
- Implement `getCardDesignForIndex(index): CardDesign`
- Rotate through designs: 1 → 2 → 3 → 4 → 1
- Option: Randomize (shuffle pool each milestone refresh)
- **Acceptance:** Designs rotate visibly

#### T11.10: Milestone List Updates
- Update `src/screens/PlannerScreen.tsx`
- Render milestone cards with rotating designs
- Pass design type to card component
- Update existing milestone display
- **Acceptance:** Milestones show varied designs

#### T11.11: Card Animations
- Add Framer Motion entrance animations:
  - Scale + fade-in on load
  - Subtle hover effect (lift, shadow increase)
  - Tap feedback (scale down + back up)
- Keep animations subtle (not distracting)
- **Acceptance:** Animations feel natural

### Wave 4: Accessibility & Responsiveness (Days 3-4)

#### T11.12: Accessibility Audit
- Verify all cards meet WCAG AA standards:
  - Color contrast ratios (4.5:1 for text)
  - Font sizes (min 14px on mobile)
  - Touch targets (min 44px)
  - Semantic HTML (buttons, landmarks)
- Test with accessibility tools
- Add alt text for illustrations
- **Acceptance:** All standards met

#### T11.13: Responsive Design Testing
- Test cards on 375px (iPhone SE), 600px+ (tablets)
- Verify layout doesn't break
- Test in light + dark mode
- Test with larger text sizes (accessibility setting)
- **Acceptance:** All screen sizes work

#### T11.14: Theme Integration
- Ensure all 4 designs respect light/dark mode
- Test color contrast in both modes
- Verify gradients look good on both backgrounds
- **Acceptance:** Designs look good everywhere

#### T11.15: Polish & Animation Refinement
- Refine transition timing (300-400ms)
- Add haptic feedback on card tap (Capacitor Haptics)
- Test animation performance (60 fps)
- **Acceptance:** Animations feel premium, not janky

### Wave 5: Testing & Validation (Days 4)

#### T11.16: Unit Tests
- Test card design selection logic
- Test rotation/shuffle algorithm
- Test retry counter
- **Acceptance:** >80% coverage

#### T11.17: Visual Regression Tests
- Screenshot all 4 card designs in light/dark mode
- Screenshot in 375px and 600px+ widths
- Compare against baseline
- **Acceptance:** No regressions

#### T11.18: Mobile Testing
- Test on iOS iPhone 12 + 14
- Test on Android Pixel 4 + 6
- Test haptic feedback
- Test performance with 20+ cards
- **Acceptance:** All devices smooth

#### T11.19: Accessibility Testing
- Test with screen reader (VoiceOver / TalkBack)
- Test with high contrast mode
- Test with reduced motion mode
- **Acceptance:** All a11y features work

### Wave 6: Documentation & Handoff (Days 4-5)

#### T11.20: Design System Documentation
- Document all 4 card designs with screenshots
- Explain design rationale (why each style)
- Document design tokens (colors, spacing, typography)
- **Acceptance:** Future designers can extend

#### T11.21: Usage Guide
- Document how to use card components
- Show examples of each design
- Explain design selection algorithm
- **Acceptance:** Developers can use easily

#### T11.22: Accessibility Documentation
- Document WCAG compliance checklist
- List design decisions for accessibility
- Create troubleshooting guide
- **Acceptance:** Team can maintain a11y

#### T11.23: Performance Metrics
- Measure card render time
- Measure animation frame rate
- Create performance baseline
- Document any optimizations needed
- **Acceptance:** Performance tracked

#### T11.24: Phase Completion
- Update STATE.md with v1.1 completion
- Create final VERIFICATION.md
- Document any technical debt
- Create handoff notes for v1.2
- **Acceptance:** Milestone ready for release

---

## Estimated Scope: 4-5 working days

**Key focus:** Visual variety + accessibility + polish.

---

## Design Inspiration

Consider referencing:
- Material Design 3 (cards, elevation, typography)
- Apple Design System (minimalism, hierarchy)
- Figma's card designs (modern, clean)
- Playful learning apps (Duolingo, Quizlet for inspiration on visual variety)

---

_Phase 11 Plan | Planner Retry & Milestone Card Variety_
