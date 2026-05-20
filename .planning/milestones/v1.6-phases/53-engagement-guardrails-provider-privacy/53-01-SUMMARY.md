---
phase: 53-engagement-guardrails-provider-privacy
plan: 01
subsystem: testing-infra
tags: [privacy, test-helper, localstorage-shim, wave-0-support]
requires: []
provides:
  - "app/tests/helpers/memory-localstorage.mjs (makeMemoryLocalStorage)"
affects:
  - "Plan 53-02 PRIVACY-01 payload goldens (downstream consumer)"
tech-stack:
  added: []
  patterns:
    - "Leaf-safe dependency-free .mjs test helper (not matched by test:main glob)"
    - "Caller-controlled install ordering (no globalThis auto-install)"
key-files:
  created:
    - "app/tests/helpers/memory-localstorage.mjs"
  modified: []
decisions:
  - "D-03 support: shim enables tests-and-structural-assertion enforcement (no runtime scrubber) by letting goldens seed private localStorage keys"
  - "Full Web Storage surface (getItem/setItem/removeItem/clear/key/length) for completeness, though private services only call getItem/setItem"
  - "No globalThis auto-install — goldens assign globalThis.localStorage = makeMemoryLocalStorage() BEFORE dynamic import() of module under test"
metrics:
  duration: ~3m
  completed: 2026-05-20
  tasks: 1
  files: 1
---

# Phase 53 Plan 01: Leaf-safe localStorage shim for privacy goldens Summary

Adds `app/tests/helpers/memory-localstorage.mjs` — a dependency-free, Map-backed in-memory `localStorage` shim (`makeMemoryLocalStorage()`) so the PRIVACY-01 payload goldens can seed private-service localStorage keys under `node --test` (which has no DOM) before importing provider modules.

## What Was Built

A single Wave-0 support module exporting `makeMemoryLocalStorage()`, returning an object backed by a private `Map` and implementing the full Web Storage surface the private services touch (and then some, for completeness):

- `getItem(k)` → stored string, or `null` when absent
- `setItem(k, v)` → stores `String(v)`
- `removeItem(k)` → deletes the key
- `clear()` → empties the Map
- `key(i)` → key at index, or `null` out of range
- `length` getter → Map size

Design choices honored from the plan:
- **Zero imports** — leaf-safe under `node --test`, never pulls heavy/JSON-import-attribute deps.
- **No `globalThis` auto-install** — the helper returns the object; the importing golden controls install ordering (`globalThis.localStorage = makeMemoryLocalStorage()` BEFORE its dynamic `import()` of the module under test).
- **Not a test file** — `.mjs`, not `.test.mjs`, so the `test:main` glob (`find tests -name '*.test.mjs'`) ignores it.
- Top-of-file comment documents (a) why it exists, (b) install-before-import ordering requirement, (c) that it is not a test file.

I confirmed the three private services (`collection.service.ts`, `engagement.service.ts`, `graph-edit-journal.service.ts`) only call `getItem`/`setItem` on their `trellis_*` keys; the shim covers those plus the rest of the Storage surface for any future use.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Write the leaf-safe Map-backed localStorage shim helper | 9e7eb46b | app/tests/helpers/memory-localstorage.mjs |

## Verification

All Task 1 acceptance criteria passed:
- Roundtrip node one-liner printed `OK` and exited 0 — `getItem` roundtrips a seeded value, returns `null` for absent keys, `removeItem` deletes, `clear` empties.
- `find tests -name '*.test.mjs' | grep memory-localstorage` returns nothing (glob-excluded).
- Zero actual `import` statements in the module (`grep -nE "^\s*import\s"` returns none — the only occurrences of the word "import" are in comment prose).

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface

No new threat surface. The plan's threat register (T-53-01 mitigate, T-53-SC accept) is satisfied: a faithful Web Storage shim ensures seeded sentinels are actually present so a downstream leak would be detectable, and no packages were installed (dependency-free, Node built-ins only).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: app/tests/helpers/memory-localstorage.mjs
- FOUND: commit 9e7eb46b
