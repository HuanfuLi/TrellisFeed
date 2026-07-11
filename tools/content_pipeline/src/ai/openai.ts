import { parseRetryAfter, type StructuredProvider, type StructuredRequest, type StructuredResult } from './provider.ts';

export function toOpenAiRequest(request: StructuredRequest, nativeStructuredOutput = true) {
  const user = nativeStructuredOutput ? request.prompt.user : `${request.prompt.user}\n\nReturn JSON matching this fixed schema:\n${JSON.stringify(request.schema)}`;
  return {
    model: request.model,
    messages: [{ role: 'system', content: request.prompt.system }, { role: 'user', content: user }],
    max_tokens: request.maxTokens,
    ...(nativeStructuredOutput ? { response_format: { type: 'json_schema', json_schema: { name: 'questiontrace_preprocessed_post', strict: true, schema: request.schema } } } : { response_format: { type: 'json_object' } }),
  };
}

export function createOpenAiProvider(options: { model: string; apiKey: string; fetch?: typeof fetch; endpoint?: string; nativeStructuredOutput?: boolean; name?: 'openai' | 'local' }): StructuredProvider {
  const fetchImpl = options.fetch ?? fetch;
  return {
    name: options.name ?? 'openai', model: options.model,
    async call(request): Promise<StructuredResult> {
      const response = await fetchImpl(options.endpoint ?? 'https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${options.apiKey}` },
        body: JSON.stringify(toOpenAiRequest(request, options.nativeStructuredOutput ?? true)),
      });
      const body = await response.json() as any;
      const choice = body.choices?.[0];
      return {
        text: typeof choice?.message?.content === 'string' ? choice.message.content : '', model: body.model ?? options.model,
        stopReason: choice?.finish_reason ?? '', inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0, requestId: body.id ?? response.headers.get('x-request-id') ?? '',
        httpStatus: response.status, refusal: choice?.message?.refusal ? 'provider refusal' : undefined,
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
      };
    },
  };
}
