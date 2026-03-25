import type { Question, LLMConfig } from '../types/index.ts';
import { chatCompletion } from '../providers/llm/index.ts';
import { mockSettingsService } from './mock/settings.mock.ts';

// ─── Pattern Library ─────────────────────────────────────────────────────────
// Each entry has a regex pattern and a confidence weight (0.0–1.0).
// Multiple patterns can match — total confidence is summed.

interface PatternEntry {
  pattern: RegExp;
  confidence: number;
}

const PATTERN_LIBRARY: PatternEntry[] = [
  // Greetings and casual openers
  { pattern: /^(hello|hi|hey|good morning|good afternoon|good evening|greetings|hey there)/i, confidence: 0.9 },

  // Social small talk (never learning questions)
  { pattern: /\b(how are you|how's it going|what's new|what's up|sup|how ya doin|how have you been|nice to meet|good to see|lovely day|how about you)\b/i, confidence: 0.9 },

  // Meta-questions about the system
  { pattern: /^(what (can|should|will) you|who (are|is) you|how (do|does|can) (you|this) work|tell me (about|who|what) (you|yourself)|what('?s| is| are) (your|the) (name|capabilities|purpose)|describe yourself|are you|can you (actually )?help)/i, confidence: 0.95 },

  // Sarcasm, skepticism, and dismissive meta-commentary
  { pattern: /\b(really\?|seriously\?|for real|come on|right\?|sure sure|yeah right|whatever|yikes|oh please|uh huh sure)/i, confidence: 0.85 },

  // Requests for jokes, entertainment, non-learning content
  { pattern: /^(tell me a joke|make me laugh|give me a riddle|say something funny|tell me a story|write a poem)/i, confidence: 0.95 },

  // Incomplete test messages
  { pattern: /^(test|asdf|xyz|lol|haha|lmao|xd)/i, confidence: 0.85 },

  // Trivial acknowledgements and backchannels (word boundary — also catches punctuation variants)
  { pattern: /\b(ok|okay|alright|got it|i see|cool|right|yeah|yes|no|sure|thanks|thank you|np|yep|nope|uh huh|uh uh|mhm|mm|exactly|indeed|fine|whatever|absolutely|certainly|definitely|sounds good|for sure|totally|100)\b/i, confidence: 0.8 },
];

// ─── Exported types ───────────────────────────────────────────────────────────

export interface QuestionFilterContext {
  priorQuestion?: string;  // The immediately preceding user question
  priorAnswer?: string;    // The AI response to the prior question
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Fast, synchronous pattern check.
 * Returns the sum of confidence scores for all matched patterns.
 */
export function isOffTopicByPattern(content: string): { flagged: boolean; confidence: number } {
  let totalConfidence = 0;
  for (const entry of PATTERN_LIBRARY) {
    if (entry.pattern.test(content.trim())) {
      totalConfidence += entry.confidence;
    }
  }
  return { flagged: totalConfidence >= 0.7, confidence: totalConfidence };
}

/**
 * LLM fallback for edge cases where pattern confidence is ambiguous.
 * Injects session context so follow-up questions are not false-positives.
 * Gracefully degrades to "not off-topic" on error.
 */
async function isOffTopicByLLM(
  content: string,
  sessionContext: QuestionFilterContext | undefined,
  llmConfig: LLMConfig,
): Promise<boolean> {
  try {
    const contextInstructions = sessionContext?.priorQuestion
      ? `Prior question: "${sessionContext.priorQuestion}"\nPrior answer preview: "${sessionContext.priorAnswer?.slice(0, 200)}..."\n\n`
      : '';

    const response = await chatCompletion(
      [
        {
          role: 'system',
          content: `${contextInstructions}You are a question classifier. Determine if the following is a genuine learning/knowledge question or off-topic chat (greetings, jokes, meta-questions about the system, etc). If this appears to be a follow-up or elaboration on the prior question shown above, treat it as a valid learning question. Respond with ONLY "yes" if off-topic, "no" if genuine learning question.`,
        },
        { role: 'user', content },
      ],
      llmConfig,
    );
    const trimmed = response.trim().toLowerCase();
    return trimmed.startsWith('yes');
  } catch (err) {
    // Graceful degradation: if LLM fails, assume not off-topic so valid questions are not lost
    console.warn('[EchoLearn] filter LLM fallback failed, assuming valid question:', err);
    return false;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Evaluates a question for off-topic / meta status using a hybrid approach:
 * 1. Fast pattern matching (deterministic)
 * 2. LLM fallback for ambiguous cases (optional, requires LLM config)
 *
 * Session context is used to avoid false-positives on follow-up questions.
 *
 * @param question - The question to evaluate
 * @param sessionContext - Optional prior Q&A pair for follow-up context
 * @returns The same question with `flagged` field set
 */
export async function evaluateQuestion(
  question: Question,
  sessionContext?: QuestionFilterContext,
): Promise<Question> {
  // Step 1: Check patterns
  const patternResult = isOffTopicByPattern(question.content);

  // Step 2: High confidence pattern match — use result directly
  if (patternResult.confidence >= 0.75) {
    return { ...question, flagged: patternResult.flagged };
  }

  // Step 3: Low but non-zero confidence — try LLM fallback if configured
  if (patternResult.confidence > 0) {
    const settings = mockSettingsService.getSync();
    if (settings.llm.isConfigured) {
      const llmResult = await isOffTopicByLLM(question.content, sessionContext, settings.llm);
      return { ...question, flagged: llmResult };
    }
  }

  // Step 4: No patterns matched and no LLM available — assume valid question
  return { ...question, flagged: false };
}
