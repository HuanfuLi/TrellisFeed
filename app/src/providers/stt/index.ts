import type { LLMConfig } from '../../types';

/**
 * Transcribe audio using OpenAI Whisper (/v1/audio/transcriptions).
 * Works with any OpenAI-compatible endpoint that supports the Whisper API.
 */
export async function transcribeAudio(audioBlob: Blob, config: LLMConfig): Promise<string> {
  if (!config.apiKey) throw new Error('No API key configured. Add your OpenAI key in Settings.');

  // Always hit openai.com for Whisper unless the user has overridden the base URL
  // (local OpenAI-compatible servers that support Whisper will also work).
  const baseUrl = (config.baseUrl?.replace(/\/$/, '')) || 'https://api.openai.com';

  const formData = new FormData();
  // The file name extension tells Whisper the codec — webm is broadly supported.
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'json');

  const res = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Whisper ${res.status}: ${body || res.statusText}`);
  }

  const data = (await res.json()) as { text: string };
  return data.text.trim();
}
