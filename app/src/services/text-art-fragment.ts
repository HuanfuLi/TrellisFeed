// Phase 55.1 BUGFIX-02 / CR-01 follow-up.
//
// Pure, dependency-free predicate for the text-art fragment gate. Lives in its
// own module (mirroring `ask-persist-target.ts` and `keyboard-hysteresis.ts`)
// so it can be exercised by an EXECUTING unit test — `concept-feed.service.ts`
// pulls in browser-only modules and cannot be imported under bare `node:test`.
//
// Background: a Gemini thinking model on the old 80-token budget returned
// starved fragments like `"T"` (single token) or a dangling `"Is your"` (two
// words, no sentence terminator). Those are unusable as a headline — when this
// returns true the caller falls back to `teaser.hook || title`.
//
// The naive guard `!/\s/.test(s) && s.length < 8` was wrong on two counts:
//   1. It rejected valid short CJK headlines. Chinese/Japanese (2 of the 4
//      shipped locales) use no inter-word spaces, so a correct 7-char headline
//      like "世界模型为何重要" tripped the no-whitespace + short rule and was
//      silently discarded after a LOCALE_CHANGED to zh/ja.
//   2. It never caught the `"Is your"` fragment it was written for — that string
//      contains internal whitespace, so the `!/\s/` test was false.

// CJK / Japanese / Korean scripts that do not use inter-word spacing.
// Ranges: CJK Ext-A, CJK Unified, Hiragana, Katakana, Hangul syllables,
// CJK symbols/punctuation, and fullwidth forms.
const CJK_RE =
  /[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿가-힯＀-￯]/;

const TERMINATOR_RE = /[.!?…。！？]$/;

/**
 * True when a tightened text-art string is too starved to use as a headline.
 *
 * - Empty / whitespace-only → unusable.
 * - CJK headlines are never length-rejected here (no inter-word spaces, and a
 *   few ideographs is a complete headline).
 * - Latin single-token under the floor (e.g. "T") → unusable.
 * - Latin dangling multi-word fragment with no terminator AND short
 *   (e.g. "Is your") → unusable. A real short headline ("RAG is dead.") keeps
 *   its terminator; a long no-terminator headline ("Why the Smell of Safety
 *   Makes AI Unsafe", 41 chars) is above the dangling floor and is kept.
 */
export function isUnusableTextArtFragment(raw: string | null | undefined): boolean {
  const s = (raw ?? '').trim();
  if (!s) return true;

  const hasCJK = CJK_RE.test(s);
  if (hasCJK) return false;

  const hasSpace = /\s/.test(s);

  // Single Latin token under the floor: "T", "RAG".
  if (!hasSpace) return s.length < 8;

  // Dangling multi-word Latin fragment with no sentence terminator: "Is your".
  if (!TERMINATOR_RE.test(s) && s.length < 12) return true;

  return false;
}
