import { parseRetryAfter, type StructuredProvider, type StructuredRequest, type StructuredResult } from './provider.ts';

export function toGeminiRequest(request: StructuredRequest) {
  return {
    systemInstruction: { parts: [{ text: request.prompt.system }] },
    contents: [{ role: 'user', parts: [{ text: request.prompt.user }] }],
    generationConfig: { maxOutputTokens: request.maxTokens, responseMimeType: 'application/json', responseJsonSchema: request.schema },
  };
}

export function createGeminiProvider(options: { model: string; apiKey: string; fetch?: typeof fetch; endpointBase?: string }): StructuredProvider {
  const fetchImpl = options.fetch ?? fetch;
  return {
    name: 'gemini', model: options.model,
    async call(request): Promise<StructuredResult> {
      const base = options.endpointBase ?? 'https://generativelanguage.googleapis.com/v1beta/models';
      const response = await fetchImpl(`${base}/${encodeURIComponent(options.model)}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': options.apiKey },
        body: JSON.stringify(toGeminiRequest(request)),
      });
      const body = await response.json() as any;
      const candidate = body.candidates?.[0];
      const text = candidate?.content?.parts?.map((part: any) => part?.text ?? '').join('') ?? '';
      return {
        text, model: body.modelVersion ?? options.model, stopReason: candidate?.finishReason ?? '',
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0, outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
        requestId: response.headers.get('x-request-id') ?? '', httpStatus: response.status,
        refusal: candidate?.finishReason === 'SAFETY' || body.promptFeedback?.blockReason ? 'provider refusal' : undefined,
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
      };
    },
  };
}
