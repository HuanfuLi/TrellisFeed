/**
 * DiagnosticChat component
 *
 * Multi-turn conversation thread UI for the learning check-in area.
 * Renders chat bubbles for user/assistant turns with input area for replies.
 * Auto-scrolls to latest message. Ends after 3 user turns or Done tap.
 *
 * Phase 20: Orchestration Strategy & Diagnostic Dialogue
 */

import { useState, useRef, useEffect } from 'react';
import { Loader2, Send, CheckCircle } from 'lucide-react';
import type { DiagnosticSession } from '../services/diagnostic-dialogue.service';

// ── Types ────────────────────────────────────────────────────────────────────

interface DiagnosticChatProps {
  session: DiagnosticSession;
  onReply: (text: string) => void;
  onDone: () => void;
  isProcessing: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_USER_TURNS = 3;

// ── DiagnosticChat ───────────────────────────────────────────────────────────

export function DiagnosticChat({ session, onReply, onDone, isProcessing }: DiagnosticChatProps) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const userTurnCount = session.turns.filter((t) => t.role === 'user').length;
  const isComplete = session.status === 'completed' || userTurnCount >= MAX_USER_TURNS;

  // Auto-scroll to bottom when new turns appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [session.turns.length]);

  // Auto-finalize when max turns reached
  useEffect(() => {
    if (userTurnCount >= MAX_USER_TURNS && session.status === 'active') {
      onDone();
    }
  }, [userTurnCount, session.status, onDone]);

  const handleReply = () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;
    setInputText('');
    onReply(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReply();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Conversation thread */}
      <div style={{
        maxHeight: '280px', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '6px',
        padding: '4px 0',
      }}>
        {session.turns.map((turn, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: turn.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: turn.role === 'user'
                ? '14px 14px 4px 14px'
                : '14px 14px 14px 4px',
              backgroundColor: turn.role === 'user'
                ? 'var(--primary-40)'
                : 'var(--surface-variant)',
              color: turn.role === 'user'
                ? 'white'
                : 'var(--foreground)',
              fontSize: '0.85rem',
              lineHeight: 1.45,
            }}>
              {turn.content}
            </div>
          </div>
        ))}

        {/* Processing indicator */}
        {isProcessing && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '14px 14px 14px 4px',
              backgroundColor: 'var(--surface-variant)',
              color: 'var(--muted-foreground)',
              fontSize: '0.82rem',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              Thinking...
            </div>
          </div>
        )}

        {/* Completion message */}
        {isComplete && !isProcessing && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: '8px',
            color: 'var(--muted-foreground)', fontSize: '0.78rem',
          }}>
            <CheckCircle size={14} color="var(--node-mint)" />
            Check-in complete
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input area (only when session is active and under max turns) */}
      {!isComplete && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            disabled={isProcessing}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: '12px',
              border: '1.5px solid var(--border)',
              backgroundColor: 'var(--surface-variant)',
              color: 'var(--foreground)',
              fontSize: '0.85rem',
              opacity: isProcessing ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleReply}
            disabled={!inputText.trim() || isProcessing}
            className="active-squish"
            style={{
              width: '38px', height: '38px', borderRadius: '12px',
              backgroundColor: 'var(--primary-40)', color: 'white',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: !inputText.trim() || isProcessing ? 'not-allowed' : 'pointer',
              opacity: !inputText.trim() || isProcessing ? 0.5 : 1,
            }}
          >
            <Send size={14} />
          </button>
          <button
            onClick={onDone}
            disabled={isProcessing}
            className="active-squish"
            style={{
              padding: '9px 14px', borderRadius: '12px',
              backgroundColor: 'var(--surface-variant)',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
              fontSize: '0.82rem', fontWeight: 500,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
