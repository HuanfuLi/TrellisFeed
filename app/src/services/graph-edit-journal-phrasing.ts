// Phase 48-01 — Canonical phrasing for graph-edit journal entries.
//
// Used by reorganizeMindmap()'s system-prompt builder to project journal
// entries as "Manual corrections to preserve:" constraint lines (D-20).
//
// ─── Load-bearing: byte-stability ─────────────────────────────────────────
//
// Output bytes are part of the reorg LLM system prompt — changing
// phrasing rephrases the prompt → cache miss across already-cached reorg
// runs. Provider KV-cache (Anthropic, OpenAI, Gemini all support automatic
// prefix caching with 5-min TTL) is keyed on byte prefix. Don't tweak
// these templates without intentionally accepting a cache invalidation.
// See CLAUDE.md §"Ask-chat system prompt — byte-stable across turns" for
// the same discipline applied to a different surface (Phase 35).
//
// Date formatting MUST use `new Date(ts).toISOString().slice(0, 10)` to
// avoid timezone drift breaking byte-stability across user devices. A
// learner in Tokyo and a learner in NYC editing at the same Unix epoch
// timestamp MUST see the same YYYY-MM-DD string in the prompt; locale
// date formatting would diverge.
//
// ─── Why no 'undo' case ───────────────────────────────────────────────────
//
// An undo writes an INVERSE journal entry whose `cmd` is one of these
// six verbs (with swapped before/after per R Summary point 6). The
// phrasing therefore naturally reads as "User renamed X back to Y on
// <date>" without a dedicated 'undo' template. Adding one would
// double-cover the surface and risk drift.

import type { GraphEditLogEntry } from '../types/index.ts';

// Safe accessor for nested before/after shapes. Journal entries from
// older app versions or hand-tampered storage may be missing fields —
// fall back to a generic placeholder rather than crashing the reorg
// prompt builder.
function getField(obj: unknown, ...path: string[]): string | undefined {
  let cur: unknown = obj;
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'string' && cur.length > 0 ? cur : undefined;
}

function formatDate(ts: number): string {
  // UTC-deterministic. Same date string everywhere regardless of the
  // user's wall-clock timezone — load-bearing for byte-stability across
  // devices (R4 note).
  return new Date(ts).toISOString().slice(0, 10);
}

const FALLBACK_NAME = 'the affected node';

/**
 * Project a journal entry into a single canonical English line suitable
 * for the reorganizeMindmap() system prompt's "Manual corrections to
 * preserve:" block.
 *
 * Templates per R4 (lines 458-463):
 *  - rename  → User renamed "{before.title}" to "{after.title}" — preserve this name.
 *  - move    → User moved "{name}" under "{newParent}" — preserve this placement.
 *  - merge   → User merged "{loser.title}" into "{survivor.title}" — do not re-create "{loser.title}".
 *  - detach  → User detached Q&A {qaId} from anchor "{oldAnchor}" — leave it free to re-classify.
 *  - prune   → User pruned anchor "{title}" — do not recreate this anchor.
 *  - delete  → User deleted "{title}" — do not recreate this node.
 *
 * Output is deterministic given the same input (D-20 byte-stability).
 */
export function phraseJournalEntry(entry: GraphEditLogEntry): string {
  const date = formatDate(entry.ts);

  switch (entry.cmd) {
    case 'rename': {
      const oldTitle = getField(entry.before, 'title') ?? FALLBACK_NAME;
      const newTitle = getField(entry.after, 'title') ?? FALLBACK_NAME;
      return `${date}: User renamed "${oldTitle}" to "${newTitle}" — preserve this name.`;
    }
    case 'move': {
      const name = getField(entry.before, 'title')
        ?? getField(entry.after, 'title')
        ?? FALLBACK_NAME;
      const newParent = getField(entry.after, 'parentTitle')
        ?? getField(entry.after, 'clusterLabel')
        ?? getField(entry.after, 'branchLabel')
        ?? 'a new location';
      return `${date}: User moved "${name}" under "${newParent}" — preserve this placement.`;
    }
    case 'merge': {
      const loser = getField(entry.before, 'loser', 'title') ?? FALLBACK_NAME;
      const survivor = getField(entry.before, 'survivor', 'title')
        ?? getField(entry.after, 'survivor', 'title')
        ?? 'the surviving node';
      return `${date}: User merged "${loser}" into "${survivor}" — do not re-create "${loser}" as a separate node.`;
    }
    case 'detach': {
      const qaId = entry.targetIds[0] ?? 'unknown';
      const oldAnchor = getField(entry.before, 'parentTitle')
        ?? getField(entry.before, 'clusterLabel')
        ?? FALLBACK_NAME;
      return `${date}: User detached Q&A ${qaId} from anchor "${oldAnchor}" — leave it free to re-classify.`;
    }
    case 'prune': {
      const title = getField(entry.before, 'title')
        ?? getField(entry.after, 'title')
        ?? FALLBACK_NAME;
      return `${date}: User pruned anchor "${title}" — do not recreate this anchor.`;
    }
    case 'delete': {
      const title = getField(entry.before, 'title')
        ?? getField(entry.before, 'deletedRecord', 'title')
        ?? FALLBACK_NAME;
      return `${date}: User deleted "${title}" — do not recreate this node.`;
    }
    default: {
      // Exhaustiveness check — if a future cmd literal is added without a
      // case here, TS will error at compile time. The fallback string is
      // a runtime safety net for hand-tampered journal entries with an
      // unknown cmd.
      const _exhaustive: never = entry.cmd;
      void _exhaustive;
      return `${date}: Unknown manual correction (${String(entry.cmd)}) — preserve unless contradicted.`;
    }
  }
}
