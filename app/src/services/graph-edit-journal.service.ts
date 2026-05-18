// Phase 48-01 — Graph edit journal (append-only localStorage log).
//
// This is a LEAF MODULE: zero transitive deps on settings.service /
// llm-provider / locales bundles, so node --test can import it directly
// (same pattern as refill-mutex.ts). See CLAUDE.md's testing rule "Phase 27
// locale tests avoid the JSON-import-attribute failure chain by importing
// i18next directly; follow the same pattern for any new pure-logic helpers."
//
// ─── Why a journal at all ─────────────────────────────────────────────────
//
// Phase 48 D-01: stale-write protection on reorganizeMindmap() is a
// PERSISTENT EDIT JOURNAL injected into the reorg LLM prompt as
// constraints — NOT a per-node `rev: number` counter and NOT a
// `manuallyEdited: boolean` lock. Operator framing: "the real hazard is
// the global reorg rewriting the tree structure such that locked nodes
// lose their meaningful neighborhood. A per-node lock would survive but
// the user's manual intent would not." Telling the reorg LLM "the user
// did X, Y, Z — respect those" preserves intent even when the tree shape
// changes.
//
// D-03 — ONE journal, TWO consumers: (a) graphCommandService.undo() pops
// the newest entry and applies the inverse; (b) reorganizeMindmap()'s
// system-prompt builder projects entries through phraseJournalEntry() as
// "Manual corrections to preserve:" constraint lines.
//
// ─── Invariants ───────────────────────────────────────────────────────────
//
// - Append-only: undo writes a NEW entry (inverse verb with swapped
//   before/after per R Summary point 6), never mutates prior entries.
//   This keeps the reorg-prompt history honest: "user did X, then user
//   did the reverse of X" reads as two ordinary commands.
// - N=10 cap at save (D-05): `entries.slice(-10)` drops OLDEST beyond
//   cap. Same number for retention (storage hygiene) and undo (operator
//   surface).
// - localStorage key 'trellis_graph_edit_log' (D-04, D-18). Trellis brand
//   uses trellis_* prefix.
// - All reads parse defensively (try/catch + Array.isArray gate). Tamper
//   resistance for the undo path is bolstered by isValidPreImage() which
//   the Plan 04 undo() MUST call on entry.before before patching back.
// - QuotaExceededError on setItem is caught + warned; prior journal state
//   is preserved (the in-memory entries array is what loadJournal returns
//   on the next call, which re-reads localStorage — so on quota failure
//   the durable state never changed).

import type { GraphEditLogEntry } from '../types/index.ts';

export type { GraphEditLogEntry };

// D-04 / D-18 — exact key string. Trellis brand convention is trellis_*.
export const GRAPH_EDIT_LOG_KEY = 'trellis_graph_edit_log';

// D-05 — retention cap. Same number for undo-depth and storage-hygiene.
const MAX_ENTRIES = 10;

function loadJournal(): GraphEditLogEntry[] {
  try {
    const raw = localStorage.getItem(GRAPH_EDIT_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as GraphEditLogEntry[]) : [];
  } catch {
    // Malformed JSON, localStorage access throw, anything else — defensive
    // return [] (matches daily-read.service.ts:40-42 pattern).
    return [];
  }
}

function saveJournal(entries: GraphEditLogEntry[]): void {
  try {
    // D-05 — drop oldest when over cap. slice(-N) keeps the LAST N entries
    // (newest), dropping anything older. Newest-last invariant matches
    // append() order and phraseJournalEntry()'s "newest LAST" reorg-prompt
    // projection (R4 byte-stability direction).
    const capped = entries.slice(-MAX_ENTRIES);
    localStorage.setItem(GRAPH_EDIT_LOG_KEY, JSON.stringify(capped));
  } catch (e) {
    // T-48-03 mitigation — quota exceeded on setItem. Don't throw upward;
    // the previous journal state in localStorage is unchanged so callers
    // can continue. N=10 at ~50KB worst-case keeps headroom ~100× of the
    // 5MB Safari/Chromium per-origin quota — this should be unreachable
    // in practice.
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      console.warn('[Trellis] graph edit log quota exceeded — dropping oldest');
      return;
    }
    // Re-throw anything that isn't a quota error so genuine bugs
    // (storage disabled, etc.) surface during dev.
    if (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[Trellis] graph edit log quota exceeded — dropping oldest');
      return;
    }
    throw e;
  }
}

// ID generator per R3 "Don't Hand-Roll" guidance (zero-dep). Same shape as
// canonical-knowledge.service.ts:818.
function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const graphEditJournal = {
  /**
   * Append a new entry. Auto-fills `id` and `ts`. Applies N=10 retention
   * cap on save (drops oldest). Returns the materialized entry so callers
   * can use its id for undo back-references if needed (not used by
   * inverse-verb-with-swapped-snapshots strategy, but available).
   */
  append(entry: Omit<GraphEditLogEntry, 'id' | 'ts'>): GraphEditLogEntry {
    const full: GraphEditLogEntry = {
      ...entry,
      id: newId(),
      ts: Date.now(),
    };
    const entries = loadJournal();
    entries.push(full);
    saveJournal(entries);
    return full;
  },

  /**
   * Read all entries in newest-LAST order. Loads from localStorage on
   * every call so callers see fresh state (no in-memory cache to drift).
   * Empty array when key is missing OR storage is malformed.
   */
  list(): GraphEditLogEntry[] {
    return loadJournal();
  },

  /**
   * Pop and return the newest entry. Used by graphCommandService.undo()
   * (Plan 04). Returns undefined when journal is empty.
   *
   * Note (R Summary point 6): undo() does NOT mutate the popped entry —
   * it constructs an INVERSE entry (same cmd, swapped before/after) and
   * appends THAT via append() above. The popped entry is discarded as
   * "consumed by undo." Result: a rename + undo sequence leaves the
   * journal with ONE rename entry whose before/after match the user's
   * net effect (no-op rename), not zero entries.
   */
  popNewest(): GraphEditLogEntry | undefined {
    const entries = loadJournal();
    const newest = entries.pop();
    saveJournal(entries);
    return newest;
  },

  /**
   * Empty the journal. Used by tests + future clear-all-data dev
   * affordance. Idempotent.
   */
  clear(): void {
    saveJournal([]);
  },
};

/**
 * Validate a candidate pre-image is shaped like a Question-subset.
 *
 * T-48-01 mitigation (tamper-resistance): the localStorage key
 * `trellis_graph_edit_log` is read-write to any code running in the
 * app's origin. XSS or a malicious browser extension can mutate it
 * between writes to inject arbitrary content as a `before` snapshot,
 * which Plan 04's undo() would then patch back into the Question store
 * via questionService.patchQuestion. Reject anything that isn't a
 * non-null non-array plain object.
 *
 * This is the MINIMUM bar. A future hardening (Phase 53 / privacy
 * sanitizer scope) could go further and validate individual field
 * names against the Question schema, but for v1.6 the structural gate
 * is sufficient — the only realistic attack surface is "swap the
 * whole array for a hostile payload," not "subtly mutate one field
 * inside an otherwise-valid entry."
 *
 * Plan 04's undo() MUST call this on `entry.before` BEFORE passing it
 * to patchQuestion. The contract is enforced by the threat-register
 * disposition in 48-01-PLAN.md.
 */
export function isValidPreImage(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}
