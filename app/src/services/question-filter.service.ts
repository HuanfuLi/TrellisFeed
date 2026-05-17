// Hybrid question classifier — narrow regex (Layer 1) + embedding-similarity
// (Layer 2). Phase 47 rewrite per D-07 / D-08 / D-11 / D-12 / D-19.
//
// This is a LEAF module: zero static imports of settings.service / locales
// bundles. Settings access happens via lazy `await import('./settings.service.ts')`
// inside evaluateQuestion so node --test can import this file directly without
// hitting the JSON-import-attribute failure chain (CLAUDE.md i18n testing rule).
//
// ─── Why the rewrite ─────────────────────────────────────────────────────────
//
// The prior implementation paired a broad regex pattern library with a "LLM
// fallback for low-confidence cases" — but the LLM fallback only fired when
// pattern confidence was in `(0, 0.75)`, which never happened in practice.
// Both surfaced production failures:
//   - "How are you doing?"  → no regex match → confidence=0 → fallback skipped
//                              → classified as on-topic (false negative)
//   - "What is a system prompt?" → regex hits 0.92 → fallback skipped
//                              → classified as off-topic/malicious (false positive)
//
// Phase 47 replaces the dead LLM fallback with embedding-similarity over a
// curated corpus (Layer 2) so the second layer actually runs. Layer 1 is
// narrowed to unambiguous greetings/acks/single-token spam/"how are you" with
// strict ^...$ anchors + a length guard. D-08 pushes the broader patterns
// (system-prompt inquiries, jailbreak attempts, sarcasm) into the corpus.
//
// ─── Three labels per ask (D-01) ─────────────────────────────────────────────
//
//   - 'malicious'  → caller MUST skip the answer LLM call; bracketing (D-13) is
//                    the secondary safety net for anything Layer 2 misses.
//   - 'off-topic'  → caller proceeds with the answer LLM but marks the resulting
//                    Question `flagged: true`; downstream consumers skip flagged
//                    Q&A; user can override per FILTER-05.
//   - 'on-topic'   → caller proceeds normally; classifyAndAnchorIncremental fires.
//
// ─── Failure path (D-12) ─────────────────────────────────────────────────────
//
// embedding-provider down, no API key, signal aborted, etc. → return Layer 1
// outcome if Layer 1 matched, else `{label: 'on-topic'}`. Bracketing keeps
// safety intact during outages; malicious prompts can technically slip
// through but they hit a bracketed LLM that won't be jailbroken.

import type { EmbeddingConfig } from '../types/index.ts';
import { embedText, cosine } from '../providers/embedding/index.ts';
import {
  loadCorpusEmbeddings,
  type FilterCorpusEntry,
  type FilterLabel,
} from './filter-corpus.service.ts';

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * Session context for follow-up questions. End-to-end plumbed through
 * useQuestions.askStreaming → question.service.ask → evaluateQuestion.
 *
 * Do NOT change shape — call sites at useQuestions.ts:9 and
 * question.service.ts:15 import this verbatim.
 */
export interface QuestionFilterContext {
  /** The immediately preceding user question. */
  priorQuestion?: string;
  /** The AI response to the prior question. */
  priorAnswer?: string;
}

export type { FilterLabel };

export interface FilterResult {
  label: FilterLabel;
  /** Internal scoring for dev console + eval-test debug only (D-04/D-05). */
  bestMatch?: { label: FilterLabel; exemplar: string; score: number };
}

// ─── Thresholds (RESEARCH §"Layer 2 Decision Rule") ──────────────────────────

/**
 * Cosine similarity threshold above which the best-matching corpus
 * off-topic exemplar wins. Looser than malicious because off-topic
 * false-positives still let the LLM answer (just mark `flagged: true`).
 * CLAUDE.md band: 0.75-0.95.
 */
export const OFF_TOPIC_SIMILARITY_THRESHOLD = 0.75;

/**
 * Cosine similarity threshold above which the best-matching corpus
 * malicious exemplar wins. Stricter than off-topic because false-positives
 * BLOCK the answer LLM with no override (D-02).
 */
export const MALICIOUS_SIMILARITY_THRESHOLD = 0.82;

// ─── Layer 1 (narrow regex fast-path) ────────────────────────────────────────

/**
 * Layer 1 maximum content length. Beyond this threshold, no plausible bare
 * greeting/ack/single-token nonsense fits — defer to Layer 2. Prevents
 * false-positive on inputs like "ok let me describe ..." which embed an
 * ack-shaped prefix inside a real query.
 */
const LAYER_1_MAX_LENGTH = 60;

// Narrow regex set per RESEARCH §"Layer 1 Narrow Regex Set". All are `^...$`
// anchored so they ONLY match when the message IS the greeting/ack/test,
// not when it contains one inside a longer question.
const LAYER_1_REGEXES: RegExp[] = [
  // Pure greetings (entire message)
  /^\s*(hi|hello|hey|hiya|howdy|good\s+(morning|afternoon|evening|night)|greetings|sup|yo)[\s!.?]*$/i,
  // Bare backchannel / ack (entire message)
  /^\s*(ok|okay|alright|cool|nice|great|thanks|thank\s+you|ty|np|yep|yes|no|nope|sure|fine|got\s+it)[\s!.?]*$/i,
  // Single-token nonsense / test (entire message)
  /^\s*(test|asdf|qwerty|xyz|lol|haha|lmao|xd|wtf|brb|gtg|jk|smh|hmm+|huh)[\s!.?]*$/i,
  // "How are you" family (entire message)
  /^\s*(how\s+are\s+you|how['']?s\s+it\s+going|how\s+have\s+you\s+been|what['']?s\s+up|what['']?s\s+new|nice\s+to\s+meet\s+you)[\s!.?]*$/i,
];

/**
 * Synchronous narrow regex check — Layer 1 fast-path.
 *
 * Returns `{matched: true}` if and only if the entire (trimmed) message
 * is a bare greeting/ack/single-token/"how are you" pattern AND the message
 * length is ≤ LAYER_1_MAX_LENGTH (60 chars).
 *
 * Counter-examples that MUST return matched=false (length-guard or
 * structural-anchor rejection):
 *   - "Hello world programming"     (greeting prefix in real query)
 *   - "What is a thank-you note?"   (ack-word inside real query)
 *   - "How are you supposed to learn this?" (greeting family inside real query)
 *   - Any 70+ char message even if shaped like a Layer 1 pattern
 */
export function layer1Regex(content: string): { matched: boolean } {
  const trimmed = content.trim();
  if (trimmed.length > LAYER_1_MAX_LENGTH) {
    return { matched: false };
  }
  for (const re of LAYER_1_REGEXES) {
    if (re.test(trimmed)) {
      return { matched: true };
    }
  }
  return { matched: false };
}

// ─── Layer 2 (embedding similarity) ──────────────────────────────────────────

/** Number of characters of priorAnswer to prefix the query embedding (D-11). */
const PRIOR_ANSWER_PREFIX_CHARS = 240;

async function layer2Embedding(
  content: string,
  context: QuestionFilterContext | undefined,
  embConfig: EmbeddingConfig,
  signal: AbortSignal | undefined,
): Promise<FilterResult> {
  // Dual-vector scoring — Phase 47 UAT-5 multi-turn jailbreak fix.
  //
  // The malicious classifier ALWAYS scores against the raw content vector.
  // The original D-11 design used a single contextualized vector
  // (`priorAnswer.slice(0, 240) + ' ' + content`) so "but why?" follow-ups
  // would stay on-topic. That dilution accidentally created an evasion vector:
  // user asks a benign question, then sends a verbatim jailbreak as turn 2 —
  // the 240-char benign prefix dominated the embedding direction, dropping
  // cosine vs malicious exemplars below 0.82. Observed in UAT-5: cosine
  // 0.977 (raw) → 0.755 (contextualized) for the same malicious payload.
  //
  // The off-topic + on-topic labels keep D-11 contextualized scoring so
  // legit follow-ups ("but why?", "go deeper") still get the context benefit.
  //
  // Cost: when context.priorAnswer is present, +1 embedText call per
  // follow-up turn (~50-100ms cloud-OpenAI). When no priorAnswer, contextVec
  // aliases rawVec and we skip the duplicate call.
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const rawVec = await embedText(content, embConfig);
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const hasPriorAnswer = !!(context?.priorAnswer && context.priorAnswer.length > 0);
  const contextVec = hasPriorAnswer
    ? await embedText(
        `${context!.priorAnswer!.slice(0, PRIOR_ANSWER_PREFIX_CHARS)} ${content}`,
        embConfig,
      )
    : rawVec;
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const corpus = await loadCorpusEmbeddings(embConfig);
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Single pass — track per-label best score + exemplar. Malicious uses rawVec
  // (multi-turn evasion fix); off-topic + on-topic use contextVec (D-11).
  let bestMalicious: { entry: FilterCorpusEntry; score: number } | null = null;
  let bestOffTopic: { entry: FilterCorpusEntry; score: number } | null = null;
  let bestOnTopic: { entry: FilterCorpusEntry; score: number } | null = null;

  for (const entry of corpus) {
    if (entry.label === 'malicious') {
      const score = cosine(rawVec, entry.vector);
      if (!bestMalicious || score > bestMalicious.score) bestMalicious = { entry, score };
    } else if (entry.label === 'off-topic') {
      const score = cosine(contextVec, entry.vector);
      if (!bestOffTopic || score > bestOffTopic.score) bestOffTopic = { entry, score };
    } else {
      const score = cosine(contextVec, entry.vector);
      if (!bestOnTopic || score > bestOnTopic.score) bestOnTopic = { entry, score };
    }
  }

  // Apply thresholds in priority order. Malicious wins ties at equal-score
  // boundary (D-12 conservative tie-break — block-with-no-LLM beats
  // flag-with-LLM-call when both labels are similarly close).
  if (bestMalicious && bestMalicious.score >= MALICIOUS_SIMILARITY_THRESHOLD) {
    return {
      label: 'malicious',
      bestMatch: {
        label: 'malicious',
        exemplar: bestMalicious.entry.text,
        score: bestMalicious.score,
      },
    };
  }
  if (bestOffTopic && bestOffTopic.score >= OFF_TOPIC_SIMILARITY_THRESHOLD) {
    return {
      label: 'off-topic',
      bestMatch: {
        label: 'off-topic',
        exemplar: bestOffTopic.entry.text,
        score: bestOffTopic.score,
      },
    };
  }

  // No threshold breached — on-topic. Include the best on-topic exemplar
  // in bestMatch for dev console / eval-test debug visibility.
  return {
    label: 'on-topic',
    bestMatch: bestOnTopic
      ? { label: 'on-topic', exemplar: bestOnTopic.entry.text, score: bestOnTopic.score }
      : undefined,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Hybrid classifier — Layer 1 narrow regex + Layer 2 embedding similarity.
 *
 * Flow:
 *   1. If signal already aborted → throw AbortError.
 *   2. Layer 1: if narrow regex hits AND length ≤ 60 → return off-topic
 *      WITHOUT invoking embedText (fast-path skip).
 *   3. Lazy-load embedding config from settingsService (leaf-module discipline).
 *   4. If embConfig is unconfigured → return on-topic (D-12 graceful degradation).
 *   5. Try Layer 2. On any error or post-call abort → log + return on-topic (D-12).
 *
 * @param content       The user-supplied message under classification.
 * @param context       Optional prior Q&A pair for follow-up context (D-11).
 * @param signal        Optional AbortSignal — checked before each await (D-19).
 * @returns A three-label FilterResult with optional bestMatch debug info.
 */
export async function evaluateQuestion(
  content: string,
  context?: QuestionFilterContext,
  signal?: AbortSignal,
): Promise<FilterResult> {
  // D-19 — honor pre-aborted signal.
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Layer 1 fast-path.
  const l1 = layer1Regex(content);
  if (l1.matched) {
    return { label: 'off-topic' };
  }

  // Lazy-load settings — keeps this module leaf so node --test can import it.
  const { settingsService } = await import('./settings.service.ts');
  const embConfig = settingsService.getSync().embedding;

  // D-12 — graceful degradation when embedding is unconfigured.
  if (!embConfig.isConfigured) {
    return { label: 'on-topic' };
  }

  try {
    return await layer2Embedding(content, context, embConfig, signal);
  } catch (e: unknown) {
    // AbortError is expected on cancellation — propagate as on-topic (caller
    // is shutting down). Other errors are network/quota/parser failures.
    if (signal?.aborted) {
      return { label: 'on-topic' };
    }
    console.warn(
      '[Trellis] filter Layer 2 failed, defaulting to on-topic:',
      e instanceof Error ? e.message : e,
    );
    return { label: 'on-topic' };
  }
}
