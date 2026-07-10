// ─── Structural injection bracketing (D-13) ──────────────────────────────────
// Central pre-flight rewrite: every outbound LLM request gets user-supplied
// content wrapped in `<user_content>...</user_content>` defense-in-depth
// structural bracketing. Idempotent. Zero per-call-site changes required.
//
// IMPORTANT (D-13): This module is the ONLY code path that wraps user content
// for an LLM request. Do NOT bracket at individual call sites. Do NOT bracket
// in providers/embedding/index.ts (bracketing corrupts cosine math). See
// 47-RESEARCH.md §"Embedding wrapper bracketing decision".
//
// Phase 35 KV-cache invariant (load-bearing): only the LAST role:'user'
// message is wrapped. All earlier history messages (role:'system',
// role:'assistant', historic role:'user') pass through byte-stable so the
// provider prefix-cache stays warm.

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const USER_CONTENT_OPEN_TAG = '<user_content>';
export const USER_CONTENT_CLOSE_TAG = '</user_content>';

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
