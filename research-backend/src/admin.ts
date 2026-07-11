const AUTH_CHALLENGE = 'Basic realm="QuestionTrace Research"';

function unauthorized() {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'cache-control': 'no-store',
      'www-authenticate': AUTH_CHALLENGE,
    },
  });
}

function decodeBasicPassword(request: Request) {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Basic\s+([^\s]+)$/i);
  if (!match) return null;

  try {
    const binary = atob(match[1]);
    const credentials = new TextDecoder().decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
    const delimiter = credentials.indexOf(':');
    return delimiter === -1 ? null : credentials.slice(delimiter + 1);
  } catch {
    return null;
  }
}

/** Avoid an early-return password comparison for this small Basic-auth boundary. */
function constantTimeishEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length, 1);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/** Return a 401 response unless a Worker-secret password authorizes the request. */
export function requireAdminAuth(request: Request, env: { RESEARCH_ADMIN_PASSWORD?: unknown }) {
  const expectedPassword = env.RESEARCH_ADMIN_PASSWORD;
  const suppliedPassword = decodeBasicPassword(request);
  if (typeof expectedPassword !== 'string' || expectedPassword.length === 0 || suppliedPassword === null) {
    return unauthorized();
  }
  return constantTimeishEqual(suppliedPassword, expectedPassword) ? null : unauthorized();
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function safeCount(value: unknown) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? String(count) : '0';
}

export function renderStatusPage({
  behavioralEventCount,
  questionAnswerRecordCount,
  lastReceivedAt,
}: {
  behavioralEventCount: unknown;
  questionAnswerRecordCount: unknown;
  lastReceivedAt: unknown;
}) {
  const lastReceived = lastReceivedAt ? escapeHtml(lastReceivedAt) : 'No uploads received yet';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>QuestionTrace research status</title>
  </head>
  <body>
    <main>
      <h1>QuestionTrace research status</h1>
      <dl>
        <dt>Behavioral events</dt>
        <dd>${safeCount(behavioralEventCount)}</dd>
        <dt>Question/answer records</dt>
        <dd>${safeCount(questionAnswerRecordCount)}</dd>
        <dt>Last received</dt>
        <dd>${lastReceived}</dd>
      </dl>
      <p><a href="/admin/export.zip">Download CSV archive</a></p>
    </main>
  </body>
</html>`;
}
