import { useState, type FormEvent, type PointerEvent } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({ onSend, placeholder, disabled }: ChatInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');

  const resolvedPlaceholder = placeholder ?? t('chatInput.placeholder');

  const submitMessage = () => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setMessage('');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitMessage();
  };

  const handleSendPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    submitMessage();
  };

  const canSend = message.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={handleSubmit}
      style={{ flexShrink: 0, padding: '0 16px 16px' }}
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
            border: '1.5px solid transparent',
          }}
        >
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={resolvedPlaceholder}
            disabled={disabled}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--foreground)',
              fontSize: '1rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!canSend}
            onPointerDown={handleSendPointerDown}
            style={{
              flexShrink: 0,
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: canSend ? 'var(--primary-40)' : 'var(--surface)',
              color: canSend ? 'white' : 'var(--muted-foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canSend ? 'pointer' : 'not-allowed',
              opacity: canSend ? 1 : 0.5,
              transition: 'background-color 0.2s, opacity 0.2s',
            }}
            aria-label={t('chatMessage.send')}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </form>
  );
}
