// src/services/podcast-prompt.ts (Phase 52 — PODCAST-01..04)
//
// Pure prompt-string assembly for podcast generation. Leaf module — no JSON
// imports, no lib/date, no react-i18next. Otherwise tests/locales/
// bundle-parity.test.mjs chain breaks under `node --test` on Node 25
// (ERR_IMPORT_ATTRIBUTE_MISSING on the static JSON imports in
// src/locales/index.ts).
//
// Inputs: conceptLines (pre-formatted bullet list of "- Concept: summary"),
//         PodcastOptions (length × style).
// Output: { system, user } prompt pair fed to chatCompletion.
//
// Section structure (PODCAST-01, PODCAST-04):
//   1. RECAP                  — restate each concept in one sentence
//   2. CONNECTIONS            — relate concepts to each other
//   3. MISCONCEPTION CHECK    — surface and correct a likely confusion
//   4. RETRIEVAL QUESTIONS    — pose open recall prompts
//   5. NEXT ACTION            — concrete review step
//
// Coverage constraint (PODCAST-04): every length × style combo MUST mention
// every concept. Enforced prompt-side here and substring-tested in
// tests/services/podcast-prompt.test.mjs.
//
// computeOptionsHash is a local cache invalidation key only — not a security
// primitive. JSON.stringify with sorted conceptIds is sufficient. See
// 52-CONTEXT.md "Claude's Discretion" + 52-PATTERNS.md for the contract.
//
// See CLAUDE.md "i18n Workflow" + Phase 27/50 leaf-service rule.

import type { PodcastOptions, PodcastLength, PodcastStyle, SupportedLocale } from '../types';

const BASE_INSTRUCTION =
  'You are creating a spoken learning podcast recap. Write ONLY the words to be spoken — no stage directions, no music cues, no markdown formatting.';

const SECTION_INSTRUCTION =
  'Structure the podcast with these sections (use natural transitions, do not announce section names):\n' +
  '1. RECAP: restate each concept in one clear sentence.\n' +
  '2. CONNECTIONS: explicitly relate the concepts to each other.\n' +
  '3. MISCONCEPTION CHECK: surface one likely confusion and correct it.\n' +
  '4. RETRIEVAL QUESTIONS: pose open recall prompts the listener can answer aloud.\n' +
  '5. NEXT ACTION: end with one concrete review step.';

// Byte-stable substring — tests assert /MUST mention every concept/i.
const COVERAGE_CONSTRAINT =
  'IMPORTANT: You MUST mention every concept listed below. Do not skip any. Coverage is non-negotiable; depth scales with the length target.';

const LENGTH_MAP: Record<PodcastLength, string> = {
  'brief':
    'Keep it concise: target ~150 words (~60 seconds spoken). Shorten each section proportionally; do not omit any.',
  'standard':
    'Target ~225 words (~90 seconds spoken). Cover all five sections evenly.',
  'deep':
    'Target ~450 words (~3 minutes spoken). Expand connections and ask 4-5 retrieval questions.',
  'extended':
    'Target ~750 words (~5 minutes spoken). Develop each section in depth; aim for commute-friendly long-form.',
};

const STYLE_MAP: Record<PodcastStyle, string> = {
  'focused':
    'Use structured, section-by-section delivery. Be precise and direct. Minimal asides.',
  'conversational':
    'Use a warm, natural radio-host style with smooth transitions. Engaging but stay educational.',
  'review':
    'Emphasize active recall. After each concept recap, immediately pose a retrieval question. End with a rapid-fire self-test.',
};

/**
 * Assemble the system + user prompt pair for podcast generation.
 *
 * The system prompt is BASE + SECTION + LENGTH_MAP[length] + STYLE_MAP[style] + COVERAGE,
 * joined by double newlines so each block is visually distinct to the LLM.
 *
 * The user prompt is the concept-lines payload — the source of truth for what
 * must be mentioned. Coverage constraint references this list.
 */
export function buildPodcastPrompt(
  conceptLines: string,
  options: PodcastOptions,
): { system: string; user: string } {
  const system = [
    BASE_INSTRUCTION,
    SECTION_INSTRUCTION,
    LENGTH_MAP[options.length],
    STYLE_MAP[options.style],
    COVERAGE_CONSTRAINT,
  ].join('\n\n');
  const user = `Concepts to cover:\n${conceptLines}`;
  return { system, user };
}

/**
 * Deterministic JSON-string hash for podcast cache invalidation.
 *
 * Sorts conceptIds so order changes do not invalidate the cache. Locale +
 * length + style are part of the key because each changes the generated
 * script. Not a security primitive — pure identity for the local cache.
 */
export function computeOptionsHash(
  conceptIds: string[],
  locale: SupportedLocale,
  options: PodcastOptions,
): string {
  const sorted = [...conceptIds].sort();
  return JSON.stringify({
    conceptIds: sorted,
    locale,
    length: options.length,
    style: options.style,
  });
}
