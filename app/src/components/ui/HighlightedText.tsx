import type { ReactNode } from 'react';

// Phase 50 Plan 50-06 — match-index → <mark> primitive (UI-SPEC Surface 7).
//
// Wraps Fuse.js match indices (`result.matches[n].indices`) around runs of
// the source text using inline `<mark>` JSX nodes. Because the matched runs
// are passed as React children (text nodes), React's built-in escaping is
// the XSS mitigation (T-50-XSS-HL — see threat register in 50-06-PLAN.md).
//
// NEVER use the React HTML-injection escape hatch here. A regression would
// silently allow any future caller to splice user-controlled text into the
// DOM as raw HTML.
// The Fuse-derived indices themselves are integers operating on the SAME
// text passed in — there is no HTML-string concatenation path at any layer.
//
// Indices contract: Fuse returns inclusive `[start, end]` pairs (both bounds
// point at characters that ARE matched). To convert an inclusive [start, end]
// to a JavaScript-half-open slice we use `text.slice(start, end + 1)`.
//
// Empty / undefined indices → plain text fragment (no <mark>), so consumers
// can safely pass `result.matches.find(m => m.key === 'title')?.indices`
// without a defensive guard at the call site.
//
// Style contract (UI-SPEC §"Surface 7 — Search Result Row"):
//   - background: var(--primary-40)
//   - color: #fff
//   - border-radius: 2px
//   - inline padding: 0 4px  (var(--space-xs) — see UI-SPEC Spacing Scale)

interface HighlightedTextProps {
  text: string;
  /**
   * Fuse.js match indices — array of inclusive [start, end] pairs.
   * Pass `result.matches[n].indices` from a `Fuse` search result.
   * For snippet rendering, indices MUST be rebased against the snippet
   * offset (see `rebaseIndices` in plan 50-04's library-search service).
   */
  indices?: readonly (readonly [number, number])[];
}

function HighlightedText({ text, indices }: HighlightedTextProps) {
  if (!indices || indices.length === 0) {
    return <>{text}</>;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of indices) {
    // Defensive: clamp negative / out-of-order tuples so a malformed Fuse
    // result cannot crash the render. The clamp keeps cursor monotonic.
    const s = Math.max(start, cursor);
    const e = Math.min(end, text.length - 1);
    if (e < s) continue;

    if (s > cursor) {
      nodes.push(text.slice(cursor, s));
    }
    nodes.push(
      <mark
        key={`${s}-${e}`}
        style={{
          background: 'var(--primary-40)',
          color: '#fff',
          borderRadius: 2,
          padding: '0 4px',
        }}
      >
        {text.slice(s, e + 1)}
      </mark>,
    );
    cursor = e + 1;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return <>{nodes}</>;
}

export default HighlightedText;
