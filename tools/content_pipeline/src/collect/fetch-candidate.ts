import { createHash } from 'node:crypto';
import { assertPublicHttpUrl, resolveAndValidateDestination, type DnsLookup } from './url-policy.ts';

export interface CollectionLimits {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects: number;
  allowedMimeTypes: readonly string[];
}

export interface TransportResponse {
  status: number;
  headers: Headers | Record<string, string | undefined>;
  body: string | Uint8Array | AsyncIterable<Uint8Array>;
}

export interface RawCandidate {
  sourceUrl: string;
  canonicalUrl: string;
  platform?: string;
  sourceName?: string;
  author?: string;
  title?: string;
  publicationDate?: string;
  thumbnailUrl?: string;
  excerpt?: string;
  language?: string;
  estimatedDurationSeconds?: number;
  rawMetadata?: Record<string, unknown>;
  collectedAt: string;
  collectorVersion: string;
  sourceHash: string;
  status: 'collected' | 'failed';
  safeFailureReason?: string;
  mimeType?: string;
  rawBody?: string;
}

export interface FetchCandidateOptions extends Partial<CollectionLimits> {
  lookup?: DnsLookup;
  transport?: (url: URL, signal: AbortSignal) => Promise<TransportResponse>;
  logger?: (line: string) => void;
  now?: () => Date;
  collectorVersion?: string;
}

const DEFAULTS: CollectionLimits = {
  maxBytes: 5_000_000,
  timeoutMs: 15_000,
  maxRedirects: 4,
  allowedMimeTypes: ['text/html', 'text/plain', 'application/json'],
};

function header(headers: TransportResponse['headers'], name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found?.[1];
}

export function redactUrl(input: string | URL): string {
  const url = input instanceof URL ? new URL(input.href) : new URL(input);
  for (const key of [...url.searchParams.keys()]) url.searchParams.set(key, '[REDACTED]');
  url.username = '';
  url.password = '';
  return url.href;
}

async function readBoundedBody(body: TransportResponse['body'], maxBytes: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const add = (chunk: Uint8Array) => {
    total += chunk.byteLength;
    if (total > maxBytes) throw new Error('response exceeds maximum byte limit');
    chunks.push(chunk);
  };
  if (typeof body === 'string') add(new TextEncoder().encode(body));
  else if (body instanceof Uint8Array) add(body);
  else for await (const chunk of body) add(chunk);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

const defaultTransport = async (url: URL, signal: AbortSignal): Promise<TransportResponse> => {
  const response = await fetch(url, { redirect: 'manual', signal, credentials: 'omit' });
  return { status: response.status, headers: response.headers, body: response.body ?? new Uint8Array() };
};

export async function fetchCandidate(input: string, options: FetchCandidateOptions = {}): Promise<RawCandidate> {
  const limits = { ...DEFAULTS, ...options };
  const lookup = options.lookup;
  const transport = options.transport ?? defaultTransport;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  let current = await assertPublicHttpUrl(input, lookup);
  try {
    for (let redirects = 0; redirects <= limits.maxRedirects; redirects += 1) {
      options.logger?.(`collect ${redactUrl(current)}`);
      let response: TransportResponse;
      try {
        response = await Promise.race([
          transport(current, controller.signal),
          new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('collection timed out')), { once: true })),
        ]);
      } catch (error) {
        if (controller.signal.aborted) throw new Error('collection timed out');
        throw error;
      }
      if (response.status >= 300 && response.status < 400) {
        const location = header(response.headers, 'location');
        if (!location) throw new Error('redirect missing destination');
        if (redirects === limits.maxRedirects) throw new Error('redirect limit exceeded');
        current = await resolveAndValidateDestination(current, location, lookup);
        continue;
      }
      if (response.status < 200 || response.status >= 300) throw new Error(`upstream status ${response.status}`);
      const mimeType = (header(response.headers, 'content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!limits.allowedMimeTypes.includes(mimeType)) throw new Error('response MIME type is not allowed');
      const bytes = await Promise.race([
        readBoundedBody(response.body, limits.maxBytes),
        new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('collection timed out')), { once: true })),
      ]);
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      return {
        sourceUrl: input,
        canonicalUrl: current.href,
        collectedAt: (options.now?.() ?? new Date()).toISOString(),
        collectorVersion: options.collectorVersion ?? '0.1.0',
        sourceHash: createHash('sha256').update(bytes).digest('hex'),
        status: 'collected', mimeType, rawBody: text,
      };
    }
    throw new Error('redirect limit exceeded');
  } finally { clearTimeout(timer); }
}
