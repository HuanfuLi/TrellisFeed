# Phase 49 — Deferred Items

Issues discovered during Phase 49 execution that are pre-existing and outside this
phase's scope. Logged per the Scope Boundary rule (only auto-fix issues DIRECTLY
caused by the current plan's changes).

## Plan 49-03

### Pre-existing tsc errors in `src/screens/SavedScreen.tsx:186`

```
src/screens/SavedScreen.tsx(186,9): error TS2322: Type 'TFunctionReturnOptionalDetails<...>' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
src/screens/SavedScreen.tsx(186,10): error TS2589: Type instantiation is excessively deep and possibly infinite.
```

- **Status:** Pre-existing — not introduced by Plan 49-03 changes.
- **Verification:** `git log src/screens/SavedScreen.tsx` shows last change was `6fea9786` (post-history consolidation, unrelated to i18n typing). Stashing Plan 49-03 changes and re-running `npx tsc -b --noEmit` reproduces the same error.
- **Likely cause:** i18next v23+ deep-typed t() inference exceeding tsc's recursion budget on a specific call site; needs either a `t() as unknown as string` cast at the call site or a tsc maxRecursion adjustment.
- **Action:** Not touching this file. Phase 49 is about graph correction UI; SavedScreen is unrelated. Will need a dedicated patch (likely 1-line cast at line 186).
