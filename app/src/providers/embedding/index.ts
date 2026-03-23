import type { EmbeddingConfig } from '../../types';

// ─── Cosine similarity ────────────────────────────────────────────────────────

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function openAIEmbed(text: string, config: EmbeddingConfig): Promise<number[]> {
  const base = config.baseUrl
    ? config.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
    : 'https://api.openai.com';
  const url = `${base}/v1/embeddings`;
  const body: Record<string, unknown> = { model: config.model, input: text };
  if (config.dimensions) body.dimensions = config.dimensions;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI embeddings error ${response.status}: ${err}`);
  }
  const data = await response.json() as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}

// ─── Google ───────────────────────────────────────────────────────────────────

async function googleEmbed(text: string, config: EmbeddingConfig): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:embedContent?key=${config.apiKey ?? ''}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: `models/${config.model}`, content: { parts: [{ text }] } }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google embeddings error ${response.status}: ${err}`);
  }
  const data = await response.json() as { embedding: { values: number[] } };
  return data.embedding.values;
}

// ─── Local (Ollama / LM Studio) ───────────────────────────────────────────────

async function localEmbed(text: string, config: EmbeddingConfig): Promise<number[]> {
  const base = (config.baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');

  // Try Ollama endpoint first, fall back to OpenAI-compatible /v1/embeddings
  try {
    const response = await fetch(`${base}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, prompt: text }),
    });
    if (response.ok) {
      const data = await response.json() as { embedding?: number[] };
      // Only accept if the response actually has an array — otherwise fall through to LM Studio path
      if (Array.isArray(data.embedding)) return data.embedding;
    }
  } catch {
    // fall through to LM Studio-compatible path
  }

  const response = await fetch(`${base}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, input: text }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Local embeddings error ${response.status}: ${err}`);
  }
  const data = await response.json() as { data?: { embedding?: number[] }[] };
  const vec = data.data?.[0]?.embedding;
  if (!Array.isArray(vec)) {
    throw new Error('Local embeddings: unexpected response format (no embedding array found)');
  }
  return vec;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function embedText(text: string, config: EmbeddingConfig): Promise<number[]> {
  switch (config.provider) {
    case 'google': return googleEmbed(text, config);
    case 'local':  return localEmbed(text, config);
    default:       return openAIEmbed(text, config);
  }
}
