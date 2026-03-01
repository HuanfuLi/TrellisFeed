import { useState, useRef } from 'react';
import { Send, Mic, Loader2 } from 'lucide-react';
import { transcribeAudio } from '../providers/stt';
import { mockSettingsService } from '../services/mock/settings.mock';
import { toast } from '../lib/toast';

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({ onSend, placeholder = 'Ask anything...', disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setMessage('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const settings = mockSettingsService.getSync();
          const text = await transcribeAudio(blob, settings.llm);
          if (text) setMessage((prev) => (prev ? `${prev} ${text}` : text));
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          toast(
            msg.includes('API key') || msg.includes('No API')
              ? 'STT requires an OpenAI API key — check Settings.'
              : 'Transcription failed. Check your API settings.',
            'error',
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      toast('Microphone access denied.', 'error');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const toggleMic = () => {
    if (isRecording) stopRecording();
    else void startRecording();
  };

  const canSend = message.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={handleSubmit}
      style={{ position: 'fixed', bottom: '80px', left: 0, right: 0, padding: '0 16px 16px' }}
    >
      <div style={{ maxWidth: '448px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: 'var(--surface-variant)',
            borderRadius: 'var(--radius-pill)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            border: isRecording ? '1.5px solid var(--primary-40)' : '1.5px solid transparent',
            transition: 'border-color 0.2s',
          }}
        >
          {/* Mic button */}
          <button
            type="button"
            onClick={toggleMic}
            disabled={isTranscribing || disabled}
            title={isRecording ? 'Stop recording' : 'Voice input'}
            style={{
              flexShrink: 0,
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: isRecording ? 'var(--primary-40)' : 'transparent',
              color: isRecording ? 'white' : 'var(--muted-foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isTranscribing || disabled ? 'not-allowed' : 'pointer',
              opacity: isTranscribing ? 0.5 : 1,
              animation: isRecording ? 'mic-pulse 1.4s ease-in-out infinite' : 'none',
              transition: 'background-color 0.2s, color 0.2s',
            }}
          >
            {isTranscribing
              ? <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />
              : <Mic size={17} />
            }
          </button>

          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isRecording ? '🎙 Listening…' : placeholder}
            disabled={disabled}
            style={{
              flex: 1,
              background: 'transparent',
              color: 'var(--foreground)',
            }}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!canSend}
            style={{
              flexShrink: 0,
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-40)',
              color: 'white',
              opacity: canSend ? 1 : 0.4,
              cursor: canSend ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s, opacity 0.2s',
            }}
          >
            <Send size={20} />
          </button>
        </div>

        {isRecording && (
          <p style={{
            textAlign: 'center',
            fontSize: '0.72rem',
            color: 'var(--primary-40)',
            marginTop: '5px',
            letterSpacing: '0.02em',
          }}>
            Tap the mic again to stop
          </p>
        )}
      </div>
    </form>
  );
}
