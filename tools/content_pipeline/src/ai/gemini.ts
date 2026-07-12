import { parseRetryAfter, type StructuredProvider, type StructuredRequest, type StructuredResult } from './provider.ts';

export function toGeminiRequest(request: StructuredRequest) {
  const repair = request.validationPaths?.length
    ? `\n\nREPAIR REQUIRED: the prior JSON failed local validation at ${request.validationPaths.join(', ')}. Return a complete corrected object. All related/prerequisite concept labels must exactly match labels in concepts; all claim sourceBlockIds must use the supplied evidence IDs.`
    : '';
  const schemaPrompt = `${request.prompt.user}\n\nSTRICT OUTPUT JSON SCHEMA:\n${JSON.stringify(request.schema)}${repair}`;
  const parts: Array<Record<string, unknown>> = [{ text: schemaPrompt }];
  if (request.media) {
    const parsed = new URL(request.media.url);
    const id = parsed.searchParams.get('v');
    if (request.media.kind !== 'youtube' || parsed.protocol !== 'https:' || parsed.hostname !== 'www.youtube.com'
      || parsed.pathname !== '/watch' || !id || (request.media.videoId !== undefined && request.media.videoId !== id)) {
      throw new Error('media must be a canonical public YouTube URL');
    }
    parts.unshift({ fileData: { fileUri: parsed.href } });
    parts[1] = { text: schemaPrompt };
  }
  return {
    systemInstruction: { parts: [{ text: request.prompt.system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      maxOutputTokens: request.maxTokens,
      responseMimeType: 'application/json',
    },
  };
}

export function createGeminiProvider(options: { model: string; apiKey: string; fetch?: typeof fetch; endpointBase?: string; timeoutMs?: number }): StructuredProvider {
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 120_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('Gemini timeoutMs must be a positive integer');
  return {
    name: 'gemini', model: options.model,
    async call(request): Promise<StructuredResult> {
      const base = options.endpointBase ?? 'https://generativelanguage.googleapis.com/v1beta/models';
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`Gemini request timed out after ${timeoutMs}ms`);
          controller.abort(error);
          reject(error);
        }, timeoutMs);
      });
      let response: Response;
      try {
        response = await Promise.race([
          fetchImpl(`${base}/${encodeURIComponent(options.model)}:generateContent`, {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': options.apiKey },
            body: JSON.stringify(toGeminiRequest(request)), signal: controller.signal,
          }),
          timeout,
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      const body = await response.json() as any;
      const candidate = body.candidates?.[0];
      const text = candidate?.content?.parts?.map((part: any) => part?.text ?? '').join('') ?? '';
      return {
        text, model: body.modelVersion ?? options.model, stopReason: candidate?.finishReason ?? '',
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0, outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
        requestId: response.headers.get('x-request-id') ?? '', httpStatus: response.status,
        refusal: candidate?.finishReason === 'SAFETY' || body.promptFeedback?.blockReason ? 'provider refusal' : undefined,
        schemaError: response.status === 400 ? 'provider rejected structured schema' : undefined,
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
      };
    },
  };
}
