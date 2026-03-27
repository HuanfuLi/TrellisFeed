# Milestone v1.1 Requirements

**Engagement & Discovery Iteration**

## Active Requirements

### Post Feed Redesign (FEED)
- [x] **FEED-01**: User can view posts with image-forward design (large image with emoji/text overlay)
- [x] **FEED-02**: AI generates multiple image styles per post (infograph, illustration, photo-style)
- [x] **FEED-03**: Posts display catchy titles/questions/stories as hook text over images
- [x] **FEED-04**: User can scroll through feed and scroll-release to load more posts (explicit action trigger)
- [x] **FEED-05**: User can navigate to post detail page showing image carousel/gallery at top
- [x] **FEED-06**: Post detail displays multiple generated images in carousel before essay content

### Image Generation Integration (IMAGE)
- [x] **IMAGE-01**: System integrates Nano Banana API for AI image generation
- [x] **IMAGE-02**: System integrates Gemini API as fallback image generation provider
- [x] **IMAGE-03**: Images are cached locally to prevent re-generation on app restart
- [ ] **IMAGE-04**: User can trigger image regeneration if unsatisfied with quality
- [ ] **IMAGE-05**: Image generation failures are handled gracefully (error states, retry options)

### Planner Auto-Suggestions (PLANNER)
- [x] **PLANNER-01**: When Knowledge Graph has 5+ nodes AND Planner is empty, system auto-generates "Suggested Moves"
- [x] **PLANNER-02**: Auto-generated suggestions appear on Planner screen without user intervention
- [x] **PLANNER-03**: Suggestions regenerate daily (after podcast time) automatically
- [ ] **PLANNER-04**: User can retry/regenerate suggestions with "Retry" button if unsatisfied
- [x] **PLANNER-05**: Suggestion algorithm considers trajectory: review performance, question frequency, engagement patterns
- [ ] **PLANNER-06**: Suggestions link directly to Posts, Questions, or Review sessions (rich "Moves")

### Milestone Card Variety (CARDS)
- [ ] **CARDS-01**: System provides 3+ distinct visual designs for milestone cards
- [ ] **CARDS-02**: Cards alternate or shuffle designs to prevent visual fatigue
- [ ] **CARDS-03**: All card designs maintain accessibility and readability standards

---

## Requirements by Category

### Feed Engagement (4 requirements)
- FEED-01 through FEED-06: Image-forward feed design, scroll-to-load, post details with image carousel

### Image Generation (5 requirements)
- IMAGE-01 through IMAGE-05: Multi-provider image generation, caching, error handling

### Planner Intelligence (6 requirements)
- PLANNER-01 through PLANNER-06: Auto-generation, daily refresh, retry pattern, trajectory-aware

### Visual Variety (3 requirements)
- CARDS-01 through CARDS-03: Multiple card designs, rotation strategy

---

## Future Requirements (Deferred)

These may be considered for v1.2+:
- [ ] **EXTENDED-01**: User can customize image generation styles (e.g., "always infographs" preference)
- [ ] **EXTENDED-02**: Planner suggestions show confidence scores
- [ ] **EXTENDED-03**: Posts support video backgrounds (animated SVG or short video clips)
- [ ] **EXTENDED-04**: A/B testing framework for card designs to optimize engagement

---

## Out of Scope

- **EXCLUDED-01**: Backend/cloud synchronization (remains local-first only)
- **EXCLUDED-02**: Social sharing of posts (privacy-first, local-only)
- **EXCLUDED-03**: Custom image upload (AI-generated only per v1.1 scope)
- **EXCLUDED-04**: Real-time collaborative planning (single-user focus)

---

## Traceability

| Phase | Requirements | Status |
|-------|--------------|--------|
| (To be filled by roadmapper) | — | Pending |

---

_Last updated: 2026-03-26 — v1.1 requirements defined_
