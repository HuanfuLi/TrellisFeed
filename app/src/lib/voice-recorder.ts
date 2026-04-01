/**
 * Cross-platform audio recording via capacitor-voice-recorder.
 *
 * On Android the plugin routes through the native layer which correctly handles
 * the WebView's onPermissionRequest callback — something navigator.mediaDevices
 * cannot do on its own inside a Capacitor WebView.
 */
import { VoiceRecorder } from 'capacitor-voice-recorder';

export class MicPermissionDeniedError extends Error {
  constructor() {
    super('PERMISSION_DENIED');
  }
}

/**
 * Request permission if needed, then start a recording session.
 * Throws MicPermissionDeniedError when the user denies the microphone prompt.
 * Throws with the plugin error code string for other failures (e.g. MICROPHONE_BEING_USED).
 */
export async function startVoiceRecording(): Promise<void> {
  const { value: hasPerm } = await VoiceRecorder.hasAudioRecordingPermission();
  if (!hasPerm) {
    const { value: granted } = await VoiceRecorder.requestAudioRecordingPermission();
    if (!granted) throw new MicPermissionDeniedError();
  }
  await VoiceRecorder.startRecording();
}

/**
 * Stop the current recording and return the audio as a WAV Blob.
 *
 * The raw platform audio (AAC-ADTS on Android, WebM on web) is decoded through
 * the Web Audio API and re-encoded as 16-bit mono PCM WAV. This sidesteps all
 * MIME/container mismatch issues — the native decoder handles whatever format
 * the plugin returns, and Whisper always accepts unambiguous WAV.
 */
export async function stopVoiceRecording(): Promise<Blob> {
  const { value } = await VoiceRecorder.stopRecording();
  const { recordDataBase64, mimeType } = value;
  if (!recordDataBase64) throw new Error('EMPTY_RECORDING');

  const byteChars = atob(recordDataBase64);
  const byteNums = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i);
  }
  const rawBlob = new Blob([byteNums], { type: mimeType });
  return encodeAsWav(rawBlob);
}

/**
 * Decode any browser-supported audio blob via Web Audio API and
 * re-encode as 16-bit mono PCM WAV.
 */
async function encodeAsWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }

  const { sampleRate, length: numSamples, numberOfChannels } = audioBuffer;

  // Mix down to mono 16-bit PCM
  const pcm = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    let sample = 0;
    for (let c = 0; c < numberOfChannels; c++) {
      sample += audioBuffer.getChannelData(c)[i];
    }
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round((sample / numberOfChannels) * 32767)));
  }

  return new Blob([buildWavHeader(numSamples, sampleRate), pcm.buffer], { type: 'audio/wav' });
}

/** Build a 44-byte RIFF/WAV header for 16-bit mono PCM at the given sample rate. */
function buildWavHeader(numSamples: number, sampleRate: number): ArrayBuffer {
  const dataBytes = numSamples * 2; // 16-bit mono = 2 bytes per sample
  const view = new DataView(new ArrayBuffer(44));
  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  str(0,  'RIFF');
  view.setUint32(4,  36 + dataBytes,      true); // file size - 8
  str(8,  'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16,                  true); // fmt chunk size
  view.setUint16(20, 1,                   true); // PCM = 1
  view.setUint16(22, 1,                   true); // mono
  view.setUint32(24, sampleRate,          true);
  view.setUint32(28, sampleRate * 2,      true); // byte rate (mono 16-bit)
  view.setUint16(32, 2,                   true); // block align
  view.setUint16(34, 16,                  true); // bits per sample
  str(36, 'data');
  view.setUint32(40, dataBytes,           true);

  return view.buffer;
}
