# Phase 01 Test Baseline and Attribution

Recorded: 2026-07-11

## Reproduced baseline

The canonical Windows command `npm test` discovered 882 tests: 876 passed and exactly six failed. No failure is exempted from the Phase 1 completion gate.

| Failure | Test/target history | Attribution and observed cause | Final status |
|---|---|---|---|
| `BS-OS-03: overscrollBehavior lives on the SAME element as overflowY (co-location)` | Test and target last changed by `deb19c2` (2026-05-18) | Not introduced by Phase 1. The production properties remained co-located; a 200-character test window was invalidated by explanatory comments. | Repaired with same-style-object extraction; invariant retained. |
| `ChatInput flex-shrink guard` | Target last changed by `cf1426e` (2026-04-20); guard inherited before Phase 1 | Not introduced by Phase 1 behavior. The input retained `flex: 1` and `minWidth: 0`; the test assumed one exact indentation/newline sequence. | Repaired with whitespace-tolerant JSX location; both properties retained. |
| `ChatInput send-on-pointerdown guard (BUGFIX-04)` | Guard/target last touched during the Phase 0 fork conversion (`18409d3`, 2026-07-09) | Phase 0 formatting exposed the brittle locator. Production retained shared `submitMessage`, `preventDefault`, Enter submit, pointer-down submit, and disabled guard. | Repaired with whitespace-tolerant JSX location; all send contracts retained. |
| `G12: no BottomSheet consumer declares bare autoFocus on an input child` | Guard last changed by `17ac2dd` (2026-05-18) | Not a product regression. Windows lacked the POSIX `grep` fallback after the shell `rg` command failed. | Repaired with recursive Node filesystem discovery; assertion is OS-independent. |
| `patchPostEssayInCache patches the durable post stores` | Test last touched by Phase 0 conversion (`18409d3`); target durable fix `dc988ad` (2026-07-08) | The function still unconditionally patched both durable owners. The test required a line-ending/format-specific `\n}\n` terminator and failed on the current one-line `try` blocks/CRLF source. | Repaired with balanced-brace extraction; both durable stores and no-early-return remain asserted. |
| `postHistoryService` (`keepAll` retention) | Test last changed by `3579805` (2026-05-21); target last changed by `dc988ad` (2026-07-08) | Phase 1 renamed active settings storage to `questiontrace_settings`; the test still seeded retired `trellis_settings`, so null retention was never loaded. | Repaired by seeding the active namespace; behavioral null-retention assertion retained. |

## Completion result

All six formerly failing contracts pass individually. The cross-platform runner is `app/scripts/run-tests.mjs`; it recursively discovers sorted `tests/**/*.test.mjs`, invokes `process.execPath --test` without shell substitution, inherits output, and propagates the child exit status. The final working-tree suite discovered 893 tests: 893 passed and 0 failed.
