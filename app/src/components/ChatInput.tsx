import { useState, useEffect, useRef } from 'react';
import { Send, Mic, Loader2, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { transcribeAudio } from '../providers/stt';
import { startVoiceRecording, stopVoiceRecording, MicPermissionDeniedError } from '../lib/voice-recorder';
import { settingsService } from '../services/settings.service';
import { toast } from '../lib/toast';
import { useKeyboard } from '../state/useKeyboard';
import { resolveChatInputSettleDistance } from '../state/chatinput-offset';

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
}

export function ChatInput({ onSend, placeholder, disabled, webSearchEnabled, onToggleWebSearch }: ChatInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const resolvedPlaceholder = placeholder ?? t('chatInput.placeholder');

  // Phase 55.1 BUGFIX-04: single-source send body shared by the Enter-key path
  // (handleSubmit) and the pointerdown path (Send button). Keeping one body
  // means a stray synthetic click after pointerdown is a no-op — setMessage('')
  // already cleared the field so the trimmed guard short-circuits the second
  // call (no double-send).
  const submitMessage = () => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setMessage('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage();
  };

  const startRecording = async () => {
    try {
      await startVoiceRecording();
      setIsRecording(true);
    } catch (err) {
      if (err instanceof MicPermissionDeniedError) {
        toast(t('common.toast.micPermissionDenied'), 'error');
      } else {
        const code = err instanceof Error ? err.message : String(err);
        if (code.includes('MICROPHONE_BEING_USED')) {
          toast(t('common.toast.micInUse'), 'error');
        } else if (code.includes('DEVICE_CANNOT_VOICE_RECORD')) {
          toast(t('common.toast.micUnsupported'), 'error');
        } else {
          toast(t('common.toast.micGenericError'), 'error');
        }
      }
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      const blob = await stopVoiceRecording();
      const settings = settingsService.getSync();
      const text = await transcribeAudio(blob, settings.tts);
      if (text) setMessage((prev) => (prev ? `${prev} ${text}` : text));
    } catch (err) {
      console.error('[ChatInput] transcription error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast(
        msg.includes('API key') || msg.includes('No API')
          ? t('common.toast.transcriptionMissingKey')
          : t('common.toast.transcriptionFailed', { message: msg }),
        'error',
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleMic = () => {
    if (isRecording) void stopRecording();
    else void startRecording();
  };

  const canSend = message.trim().length > 0 && !disabled;

  // GAP-A (BUGFIX-05, Phase 55.1): smooth the input-bar reposition on keyboard
  // open/close instead of teleporting.
  //
  // On Android `adjustResize` shrinks the WebView and the AskScreen 100dvh flex
  // column reflows INSTANTLY, so this bar snaps above the keyboard in one frame.
  // We do NOT add a second persistent mover (that would fight adjustResize — two
  // animation owners). Instead, at the moment keyboardOpen flips we apply a brief
  // transient translateY (the bar starts a few px BELOW its landing spot) and let
  // a short CSS transition ease it to 0. The resting offset is always 0 (see
  // resolveChatInputOffset's contract) — only the edge is animated.
  //
  // The transition lives on THIS form wrapper (the element ChatInput owns), never
  // on an ancestor of a Header (CLAUDE.md "Header positioning" forbids
  // transform/will-change on Header ancestors). useKeyboard() is the existing
  // global hysteresis signal — reused here, no second visualViewport listener.
  const keyboardOpen = useKeyboard();
  const [settleY, setSettleY] = useState(0);
  const animFrame = useRef<number | null>(null);

  useEffect(() => {
    const vp = window.visualViewport;
    const keyboardHeight = vp
      ? Math.max(0, (window.innerHeight || vp.height) - vp.height)
      : 0;
    // Start a frame BELOW the landing position when opening (slide up to land);
    // when closing, settle distance is 0 so the bar simply eases to rest.
    const distance = resolveChatInputSettleDistance({ keyboardHeight, isKeyboardOpen: keyboardOpen });
    setSettleY(distance);
    if (animFrame.current !== null) cancelAnimationFrame(animFrame.current);
    // Next frame: relax to the resting offset (0) so the CSS transition eases through.
    animFrame.current = requestAnimationFrame(() => setSettleY(0));
    return () => {
      if (animFrame.current !== null) cancelAnimationFrame(animFrame.current);
    };
  }, [keyboardOpen]);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        flexShrink: 0,
        padding: '0 16px 16px',
        // Eased reposition: the transient settleY decays to 0 over a short
        // ease-out so the bar slides into place instead of teleporting. ~180ms
        // is short enough that it never lags behind the native adjustResize.
        transform: settleY ? `translateY(${settleY}px)` : undefined,
        transition: 'transform 0.18s ease-out',
        willChange: 'transform',
      }}
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
            boxShadow: 'var(--shadow-2)',
            border: isRecording ? '1.5px solid var(--primary-40)' : '1.5px solid transparent',
            transition: 'border-color 0.2s',
          }}
        >
          {/* Mic button */}
          <button
            type="button"
            onClick={toggleMic}
            disabled={isTranscribing || disabled}
            title={isRecording ? t('chatInput.stopRecordingTitle') : t('chatInput.voiceInputTitle')}
            style={{
              flexShrink: 0,
              width: '44px',
              height: '44px',
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

          {/* Globe toggle — forces web search */}
          {onToggleWebSearch && (
            <button
              type="button"
              onClick={onToggleWebSearch}
              title={webSearchEnabled ? t('chatInput.webSearchOn') : t('chatInput.webSearchOff')}
              style={{
                flexShrink: 0,
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: webSearchEnabled ? 'var(--primary-40)' : 'transparent',
                color: webSearchEnabled ? 'white' : 'var(--muted-foreground)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s, color 0.2s',
              }}
            >
              <Globe size={17} />
            </button>
          )}

          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isRecording ? t('chatInput.listening') : resolvedPlaceholder}
            disabled={disabled}
            style={{
              flex: 1,
              // Phase 33 UAT-4 fix (2026-04-20): minWidth: 0 is load-bearing.
              // Without it, the input's flex-basis: auto defaults to intrinsic
              // content width, which Android WebView refuses to shrink below.
              // The flexShrink:0 send button then overflows off-screen. This
              // regressed twice — once when position:fixed → flex-column
              // (d45c228c), again when mic/globe grew 34→44px (47d81049).
              // Do NOT remove without replacing the flex-shrink guarantee.
              minWidth: 0,
              background: 'transparent',
              color: 'var(--foreground)',
            }}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={!canSend}
            // Phase 55.1 BUGFIX-04: send on pointerDOWN, not the default
            // click/form-submit (which fires on pointer-up after the focus
            // change). On Android WebView the first tap's blur dismisses the
            // keyboard and the submit never reaches handleSubmit, so the user
            // had to tap twice. preventDefault() runs BEFORE the input blurs,
            // preserving focus (keyboard stays open) and suppressing the
            // synthetic click so the send fires exactly once. type="submit" is
            // kept so the Enter-key path still routes through handleSubmit. Do
            // NOT add an explicit blur() here — that would trigger
            // SwipeTabContainer.onFocusOut nav drift.
            onPointerDown={(e) => {
              e.preventDefault();
              submitMessage();
            }}
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
            {t('chatInput.tapMicAgainHint')}
          </p>
        )}
      </div>
    </form>
  );
}
