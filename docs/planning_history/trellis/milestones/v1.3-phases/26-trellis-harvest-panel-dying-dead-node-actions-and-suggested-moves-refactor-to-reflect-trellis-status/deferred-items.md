# Deferred Items (Phase 26)

## Discovered during Plan 26-02 (out of scope — not caused by plan changes)

- `app/src/screens/PlannerScreen.tsx:4` — `Sparkles` imported but never used (pre-existing, unrelated to status panel wiring).
- `app/src/screens/PlannerScreen.tsx:177` — `navigate` declared but never used (pre-existing; may belong to a later refactor pass).
- Several pre-existing TypeScript errors surface in `src/screens/GraphScreen.tsx`, `src/services/canonical-knowledge.service.ts`, `src/services/review.service.ts`, and `src/services/trellis-state.service.ts` when running `npx tsc --noEmit -p tsconfig.app.json`. None are caused by Phase 26 changes. Tracking here for future cleanup.
