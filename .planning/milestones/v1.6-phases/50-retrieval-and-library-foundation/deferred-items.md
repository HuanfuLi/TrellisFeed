# Phase 50 — Deferred Items (out of scope for the plans that found them)

## Discovered during plan 50-04 execution

### Pre-existing tsc errors in app/src/screens/SavedScreen.tsx (lines 186-187)

`tsc -b --noEmit` reports two errors at `SavedScreen.tsx:186`:

- TS2322: t() return type not assignable to `ReactI18NextChildren | Iterable<...>`
- TS2589: Type instantiation is excessively deep and possibly infinite.

These errors exist on the base commit (verified via `git stash + tsc`) and
are unrelated to the library-search service introduced in plan 50-04. They
likely originated from a typed-key tightening in react-i18next or
i18n.d.ts elsewhere; SavedScreen is going to be modified in plan 50-09
and that plan should investigate / fix the i18n call site at line 186.

**Discovered by:** plan 50-04 executor (worktree-agent-aa038307700c268ea)
**Out of scope for:** 50-04 (which only creates a new leaf service, no UI integration)
**Forwarded to:** plan 50-09 (SavedScreen extension)
