import { parseRetryAfter, type StructuredProvider, type StructuredRequest, type StructuredResult } from './provider.ts';

export function toAnthropicRequest(request: StructuredRequest) {
  return {
    model: request.model,
    max_tokens: request.maxTokens,
    system: request.prompt.system,
    messages: [{ role: 'user', content: request.prompt.user }],
    output_config: { format: { type: 'json_schema', name: 'questiontrace_preprocessed_post', schema: request.schema } },
  };
}

export function createAnthropicProvider(options: { model: string; apiKey: string; fetch?: typeof fetch; endpoint?: string }): StructuredProvider {
  const fetchImpl = options.fetch ?? fetch;
  return {
    name: 'anthropic', model: options.model,
    async call(request): Promise<StructuredResult> {
      const response = await fetchImpl(options.endpoint ?? 'https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': options.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(toAnthropicRequest(request)),
      });
      const body = await response.json() as any;
      const block = Array.isArray(body.content) ? body.content.find((item: any) => item?.type === 'text') : undefined;
      return {
        text: typeof block?.text === 'string' ? block.text : '', model: body.model ?? options.model,
        stopReason: body.stop_reason ?? '', inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0, requestId: body.id ?? response.headers.get('request-id') ?? '',
        httpStatus: response.status, refusal: body.stop_reason === 'refusal' ? 'provider refusal' : undefined,
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
      };
    },
  };
}
