# Phase 7 Verification Checklist

**Post Feed Redesign & Image Integration**

## How to Verify

### Setup

1. Open the app in a browser: `cd app && npm run dev`
2. Complete onboarding if not already done
3. Ask 2-3 questions to seed the feed

---

## Success Criteria

### FEED-01: Image-forward post design

- [ ] Feed posts show a large image (≥200px height) at the top of each card
- [ ] The image has an emoji + title text overlay at the bottom
- [ ] The overlay text is readable (white text, gradient scrim behind it)
- [ ] Cards render correctly at 375px width (mobile) and 600px+ width (tablet)

### FEED-02: Multiple image style generation

- [ ] Scrolling through the feed shows 3 different visual styles rotating:
  - `infograph` (dark blue gradient + 📊 icon)
  - `illustration` (purple/orange gradient + 🎨 icon)
  - `photo` (grey/green gradient + 📸 icon)
- [ ] Connection posts always use `illustration` style
- [ ] Starter posts always use `infograph` style

### FEED-03: Overlay text

- [ ] Each image shows an emoji derived from the post's topic keywords
- [ ] Title text is truncated to ≤50 characters with ellipsis if needed
- [ ] Text is visible against any image background

### IMAGE-01: Nano Banana integration

- [ ] Settings → Image Generation → Nano Banana API Key field is present
- [ ] Saving a key re-bootstraps providers without page reload
- [ ] With a valid key: real images are generated
- [ ] With no key: SVG placeholder mock images are shown (not a crash)

### IMAGE-02: Gemini integration

- [ ] Settings → Image Generation → Gemini API Key field is present
- [ ] When Nano Banana fails (or key is absent), Gemini is used as fallback
- [ ] With no key: mock images are shown

### IMAGE-03: Image caching

- [ ] Scrolling away and back to a post reuses the cached image (no re-generation)
- [ ] Settings shows cache stats (item count + total size)
- [ ] "Clear Image Cache" button empties the cache and resets stats

---

## Error State Verification

- [ ] Loading state: skeleton shimmer shown while image is generating
- [ ] Error state: "Image generation failed" message + Retry button shown if all providers fail
- [ ] Clicking Retry re-triggers image generation for that post
- [ ] Network failure: feed still renders (text fallback + error image state)

---

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Image generation time | < 8s avg | Check `console.debug` logs |
| Cache hit rate | > 80% on revisit | Navigate away and back, confirm no new log |
| Feed scroll | 60fps smooth | DevTools Performance panel |
| Cache size | < 50MB | Settings → Image Generation stats |

---

## Known Deviations

1. **T4.1 SQLite storage**: The plan mentioned SQLite as a secondary store for larger datasets. Implemented localStorage-only (consistent with the rest of the app). SQLite integration deferred — the service interface is already in place.

2. **T5.3 Device testing**: Manual on-device testing deferred to QA phase. Tests run in Node test runner (13/13 passing).

3. **Nano Banana API**: Not a real public API. Provider is structurally complete but uses mock images by default. Wire in real endpoint URL if/when service launches.

---

## Technical Debt

- `imageGenerationService.getCacheStats()` is called synchronously — if cache metadata grows large, consider async.
- No image compression yet (T4.2 compression deferred). SVG mocks are tiny; real PNG/JPEG from APIs should be compressed before caching.
- Rate limiting quota display in Settings (T3.4) shows cache stats only; API quota tracking requires a real API to be wired.

---

_Phase 7 Verification | Post Feed Redesign & Image Integration | 2026-03-26_
