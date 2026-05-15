// ─── Structural injection bracketing (D-13) ──────────────────────────────────
// Central pre-flight rewrite: every outbound LLM request gets user-supplied
// content wrapped in `<user_content>...</user_content>` defense-in-depth
// structural bracketing. Idempotent. Zero per-call-site changes required.
//
// IMPORTANT (D-13): This module is the ONLY code path that wraps user content
// for an LLM request. Do NOT bracket at individual call sites. Do NOT bracket
// in providers/tts/index.ts (TTS has no instruction-following surface) or in
// providers/embedding/index.ts (bracketing corrupts cosine math). See
// 47-RESEARCH.md §"TTS wrapper bracketing" + §"Embedding wrapper bracketing
// decision". Negative-invariant tests at app/tests/providers/tts-bracketing-
// exempt.test.mjs assert those exemptions.
//
// Phase 35 KV-cache invariant (load-bearing): only the LAST role:'user'
// message is wrapped. All earlier history messages (role:'system',
// role:'assistant', historic role:'user') pass through byte-stable so the
// provider prefix-cache stays warm. See CLAUDE.md "Ask-chat system prompt —
// byte-stable across turns (Phase 35 — load-bearing)" and the source-reading
// regression test at app/tests/state/useQuestions-system-prompt-stability.test.mjs.
//
// Constants discipline: USER_ACK_BEFORE_GRAPH_CONTEXT_LITERAL is duplicated
// from app/src/state/useQuestions.ts (NOT imported) so this module stays a
// leaf — no transitive imports of state, services, or i18n. Mirrors the
// LOCALE_VOICE_FALLBACK duplication in providers/tts/index.ts:11-16. The
// constant-sync test in tests/providers/llm-bracketing.test.mjs guards drift
// between the two copies.

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const USER_CONTENT_OPEN_TAG = '<user_content>';
export const USER_CONTENT_CLOSE_TAG = '</user_content>';

// Duplicated from app/src/state/useQuestions.ts (Phase 35 UAT-1 strict-
// alternation user-ack). Sync-test enforces the two literals stay byte-equal.
const USER_ACK_BEFORE_GRAPH_CONTEXT_LITERAL = 'Here is the knowledge graph context for this turn:';

// Web-search Pass-2 results-injection prefix (useQuestions.ts:262). The Pass-2
// `role: 'user'` message carries synthetic search context, not user-supplied
// content — bracketing it would degrade answer quality. See Pitfall 8.
const WEB_SEARCH_INJECTION_PREFIX = 'Web search results for "';

// Zero-width joiner (U+200D) used to split adversarial closing tags inside
// user content. The LLM tokenizer sees `</user U+200D _content>` instead of
// `</user_content>`, which prevents the literal closing tag from terminating
// our wrapper mid-stream. Use the actual codepoint, NOT the `&zwj;` HTML
// entity (which would only render in HTML rendering, not in plain text the
// LLM sees). See Pitfall 5.
const ZWJ = '‍';

export function applyUserContentBracketing(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return messages;

  // Find the LAST role:'user' message (the new turn — historic user messages
  // sent on prior turns were already either bracketed at their respective
  // send time OR are now history; the wrapper sees only the latest send).
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx === -1) return messages;

  const target = messages[lastUserIdx];

  // Idempotency check: if already wrapped, pass through.
  if (
    target.content.startsWith(USER_CONTENT_OPEN_TAG) &&
    target.content.endsWith(USER_CONTENT_CLOSE_TAG)
  ) {
    return messages;
  }

  // Allowlist: Phase 35 user-ack message is internal alternation glue, not
  // user-supplied content. Pass through unwrapped.
  if (target.content === USER_ACK_BEFORE_GRAPH_CONTEXT_LITERAL) return messages;

  // Allowlist: web-search Pass-2 results-injection is synthetic search
  // context, not user-supplied. Pass through unwrapped (Pitfall 8).
  if (target.content.startsWith(WEB_SEARCH_INJECTION_PREFIX)) return messages;

  // Adversarial-tag escape: replace literal `</user_content>` and
  // `<user_content>` substrings inside user content with ZWJ-split forms so
  // the user cannot close our wrapper from inside (Pitfall 5).
  const safeContent = target.content
    .replaceAll(USER_CONTENT_CLOSE_TAG, `</user${ZWJ}_content>`)
    .replaceAll(USER_CONTENT_OPEN_TAG, `<user${ZWJ}_content>`);

  const wrapped: ChatMessage = {
    ...target,
    content: `${USER_CONTENT_OPEN_TAG}\n${safeContent}\n${USER_CONTENT_CLOSE_TAG}`,
  };

  return [
    ...messages.slice(0, lastUserIdx),
    wrapped,
    ...messages.slice(lastUserIdx + 1),
  ];
}
