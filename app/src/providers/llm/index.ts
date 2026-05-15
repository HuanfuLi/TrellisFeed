import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { LLMConfig } from '../../types';
import { tokenUsageReporter, type UsageMetadata } from '../../services/token-usage.service.ts';
import { applyLocaleDirective } from './locale-directive.ts';
import { applyUserContentBracketing } from './user-content-bracketing.ts';

// Re-export so downstream code (including tests that CAN import this file)
// has a single documented entry point for the central locale-injection helper.
export { applyLocaleDirective };
// Re-export the D-13 bracketing helper for the same reason.
export { applyUserContentBracketing };

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─── Timeout helper ────────────────────────────────────────────────────────────
//
// Returns an AbortSignal that fires after `ms` milliseconds.
// Used to prevent fetch() calls from hanging indefinitely on slow mobile networks.

function timeoutSignal(ms: number): AbortSignal {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(new DOMException(`Request timed out after ${ms / 1000}s`, 'TimeoutError')), ms);
  ac.signal.addEventListener('abort', () => clearTimeout(id), { once: true });
  return ac.signal;
}

// ─── Signal composition ──────────────────────────────────────────────────────
//
// Composes a caller-supplied AbortSignal (e.g. LOCALE_CHANGED → abortController
// from useQuestions per D-22) with the timeout signal so whichever fires first
// cancels the fetch. AbortSignal.any is available on Chromium 116+ /
// Safari 17.4+ / Node 20+; we fall back to a manual forwarder for older
// runtimes.

function composeSignal(callerSignal: AbortSignal | undefined, ms: number): AbortSignal {
  const tm = timeoutSignal(ms);
  if (!callerSignal) return tm;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([callerSignal, tm]);
  // Manual fallback: forward either abort into a fresh controller.
  const ac = new AbortController();
  if (callerSignal.aborted) ac.abort(callerSignal.reason);
  else callerSignal.addEventListener('abort', () => ac.abort(callerSignal.reason), { once: true });
  if (tm.aborted) ac.abort(tm.reason);
  else tm.addEventListener('abort', () => ac.abort(tm.reason), { once: true });
  return ac.signal;
}

const COMPLETION_TIMEOUT_MS = 60_000; // 60 s for non-streaming completions
const STREAM_TIMEOUT_MS = 120_000;    // 120 s for full streaming response

// ─── Routing ──────────────────────────────────────────────────────────────────

export interface CompletionOptions {
  maxTokens?: number;
  serviceName?: string;
  jsonMode?: boolean;
  /** Caller-supplied abort signal (D-22 mid-stream cancellation on LOCALE_CHANGED). */
  signal?: AbortSignal;
}

export async function chatCompletion(messages: ChatMessage[], config: LLMConfig, options?: CompletionOptions): Promise<string> {
  const msgs = applyLocaleDirective(messages); // D-12 — central locale injection
  const bracketed = applyUserContentBracketing(msgs); // D-13 — structural injection bracketing
  const maxTokens = options?.maxTokens ?? 4096;
  switch (config.provider) {
    case 'claude':   return claudeCompletion(bracketed, config, maxTokens, options);
    case 'gemini':   return geminiCompletion(bracketed, config, maxTokens, options);
    default:         return openAICompletion(bracketed, config, maxTokens, options); // openai | local | lmstudio
  }
}

export async function* chatStream(messages: ChatMessage[], config: LLMConfig, options?: CompletionOptions): AsyncGenerator<string> {
  const msgs = applyLocaleDirective(messages); // D-12 — central locale injection
  const bracketed = applyUserContentBracketing(msgs); // D-13 — structural injection bracketing
  switch (config.provider) {
    case 'claude':  yield* claudeStream(bracketed, config, options);  break;
    case 'gemini':  yield* geminiStream(bracketed, config, options);  break;
    default:        yield* openAIStream(bracketed, config, options);  break; // openai | local | lmstudio
  }
}

// ─── Usage normalizers ────────────────────────────────────────────────────────

function normalizeOpenAIUsage(data: Record<string, unknown>): UsageMetadata | undefined {
  const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
  if (!usage?.prompt_tokens) return undefined;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

function normalizeClaudeUsage(data: Record<string, unknown>): UsageMetadata | undefined {
  const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined;
  if (!usage?.input_tokens) return undefined;
  return {
    promptTokens: usage.input_tokens,
    completionTokens: usage.output_tokens ?? 0,
    totalTokens: usage.input_tokens + (usage.output_tokens ?? 0),
  };
}

function normalizeGeminiUsage(data: Record<string, unknown>): UsageMetadata | undefined {
  const meta = data.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
  if (!meta?.promptTokenCount) return undefined;
  return {
    promptTokens: meta.promptTokenCount,
    completionTokens: meta.candidatesTokenCount ?? 0,
    totalTokens: meta.totalTokenCount ?? 0,
  };
}

// ─── OpenAI / Local / LM Studio (OpenAI-compatible) ─────────────────────────

function openAIBaseUrl(config: LLMConfig): string {
  if (config.baseUrl) {
    return config.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
  }
  if (config.provider === 'lmstudio') return 'http://localhost:1234';
  return 'https://api.openai.com';
}

function openAIHeaders(config: LLMConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
  return headers;
}

async function localPost(
  url: string,
  body: object,
  callerSignal?: AbortSignal,
): Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }> {
  const headers = { 'Content-Type': 'application/json' };

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({ url, headers, data: body });
    const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      text: async () => raw,
      json: async () => (typeof res.data === 'string' ? (JSON.parse(res.data) as unknown) : res.data),
    };
  }

  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: composeSignal(callerSignal, COMPLETION_TIMEOUT_MS) });
}

async function openAICompletion(messages: ChatMessage[], config: LLMConfig, maxTokens = 4096, options?: CompletionOptions): Promise<string> {
  const isLocal = config.provider === 'local' || config.provider === 'lmstudio';
  const url = `${openAIBaseUrl(config)}/v1/chat/completions`;
  const body: Record<string, unknown> = { model: config.model, messages, max_tokens: maxTokens, stream: false };
  // LM Studio rejects `json_object` ("must be 'json_schema' or 'text'") and other local
  // OpenAI-compatible servers vary in support. Skip the hint for local providers and rely
  // on prompt guidance + the three-tier repair parser in _doReorganize.
  if (options?.jsonMode && !isLocal) body.response_format = { type: 'json_object' };

  const response = isLocal
    ? await localPost(url, body, options?.signal)
    : await fetch(url, { method: 'POST', headers: openAIHeaders(config), body: JSON.stringify(body), signal: composeSignal(options?.signal, COMPLETION_TIMEOUT_MS) });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${config.provider} API error ${response.status}: ${err}`);
  }
  const data = await response.json() as { choices: { message: { content: string } }[]; usage?: Record<string, number> };
  const usage = normalizeOpenAIUsage(data as Record<string, unknown>);
  if (usage && options?.serviceName) {
    tokenUsageReporter.record({ serviceName: options.serviceName, ...usage, provider: config.provider });
  }
  return data.choices[0].message.content;
}

async function* openAIStream(messages: ChatMessage[], config: LLMConfig, options?: CompletionOptions): AsyncGenerator<string> {
  const isLocal = config.provider === 'local' || config.provider === 'lmstudio';
  const url = `${openAIBaseUrl(config)}/v1/chat/completions`;

  // CapacitorHttp (used for local/lmstudio) does not support SSE — fall back on native.
  // Cloud OpenAI uses window.fetch which supports streaming in the Android WebView.
  if (Capacitor.isNativePlatform() && isLocal) {
    const text = await openAICompletion(messages, config, 4096, options);
    yield text;
    return;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: isLocal ? { 'Content-Type': 'application/json' } : openAIHeaders(config),
    body: JSON.stringify({ model: config.model, messages, max_tokens: 4096, stream: true }),
    signal: composeSignal(options?.signal, STREAM_TIMEOUT_MS),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${config.provider} API error ${response.status}: ${err}`);
  }
  yield* parseSseStream(response, (p) => p.choices?.[0]?.delta?.content ?? '');
}

// ─── Claude ──────────────────────────────────────────────────────────────────

async function claudeCompletion(messages: ChatMessage[], config: LLMConfig, maxTokens = 4096, options?: CompletionOptions): Promise<string> {
  const system = messages.find((m) => m.role === 'system')?.content;
  const userMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  // JSON-mode prefill: Claude continues the assistant response from `{`, guaranteeing a JSON object.
  if (options?.jsonMode) {
    userMessages.push({ role: 'assistant', content: '{' });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: config.model, max_tokens: maxTokens, system, messages: userMessages }),
    signal: composeSignal(options?.signal, COMPLETION_TIMEOUT_MS),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }
  const data = await response.json() as Record<string, unknown>;
  const usage = normalizeClaudeUsage(data);
  if (usage && options?.serviceName) {
    tokenUsageReporter.record({ serviceName: options.serviceName, ...usage, provider: config.provider });
  }
  const text = (data.content as Array<{ text: string }>)[0].text;
  return options?.jsonMode ? '{' + text : text;
}

async function* claudeStream(messages: ChatMessage[], config: LLMConfig, options?: CompletionOptions): AsyncGenerator<string> {
  // Claude uses window.fetch (not CapacitorHttp), so SSE streaming works on Android WebView.
  const system = messages.find((m) => m.role === 'system')?.content;
  const userMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: config.model, max_tokens: 4096, stream: true, system, messages: userMessages }),
    signal: composeSignal(options?.signal, STREAM_TIMEOUT_MS),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }
  yield* parseSseStream(
    response,
    (p) => p.type === 'content_block_delta' && p.delta?.type === 'text_delta' ? p.delta.text : '',
  );
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function toGeminiPayload(messages: ChatMessage[], maxTokens = 4096, jsonMode = false) {
  const system = messages.find((m) => m.role === 'system')?.content;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  return {
    contents,
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };
}

async function geminiCompletion(messages: ChatMessage[], config: LLMConfig, maxTokens = 4096, options?: CompletionOptions): Promise<string> {
  const url = `${GEMINI_BASE}/models/${config.model}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey ?? '' },
    body: JSON.stringify(toGeminiPayload(messages, maxTokens, options?.jsonMode ?? false)),
    signal: composeSignal(options?.signal, COMPLETION_TIMEOUT_MS),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }
  const data = await response.json() as Record<string, unknown>;
  const usage = normalizeGeminiUsage(data);
  if (usage && options?.serviceName) {
    tokenUsageReporter.record({ serviceName: options.serviceName, ...usage, provider: config.provider });
  }
  const candidates = data.candidates as Array<{ content: { parts: Array<{ text: string }> } }> | undefined;
  return candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function* geminiStream(messages: ChatMessage[], config: LLMConfig, options?: CompletionOptions): AsyncGenerator<string> {
  // Gemini uses window.fetch (not CapacitorHttp), so SSE streaming works on Android WebView.
  const url = `${GEMINI_BASE}/models/${config.model}:streamGenerateContent?alt=sse`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey ?? '' },
    body: JSON.stringify(toGeminiPayload(messages)),
    signal: composeSignal(options?.signal, STREAM_TIMEOUT_MS),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }
  yield* parseSseStream(response, (p) => p.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
}

// ─── Shared SSE parser ────────────────────────────────────────────────────────

async function* parseSseStream(
  response: Response,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extract: (parsed: any) => string,
): AsyncGenerator<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = JSON.parse(data) as any;
        const text = extract(parsed);
        if (text) yield text;
      } catch {
        // ignore malformed SSE line
      }
    }
  }
}

// ─── Test connection ──────────────────────────────────────────────────────────

export async function testLLMConnection(
  config: LLMConfig,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await chatCompletion([{ role: 'user', content: 'Say "ok".' }], config);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
