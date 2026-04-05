/**
 * diagnostic-dialogue.service.ts
 * Manages multi-turn Socratic check-in conversations.
 * LLM asks follow-up questions based on extracted confusion/curiosity signals.
 * Session state persists to localStorage so navigation doesn't lose progress.
 *
 * Phase 20: Orchestration Strategy & Diagnostic Dialogue
 */

import type { CheckInSignals } from '../types/index.ts';
import { chatCompletion } from '../providers/llm/index.ts';
import { settingsService } from './settings.service.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DialogueTurn {
  role: 'user' | 'assistant';
  content: string;
  signals?: CheckInSignals;
  timestamp: number;
}

export interface DiagnosticSession {
  id: string;
  turns: DialogueTurn[];
  mergedSignals: CheckInSignals;
  status: 'active' | 'completed';
  createdAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_TURNS = 3; // initial + 2 follow-ups
const STORAGE_KEY = 'echolearn_diagnostic_session';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS (duplicated from planner.service.ts — private there)
// ═══════════════════════════════════════════════════════════════════════════════

const EXTRACT_SIGNALS_PROMPT = `You are a learning coach. The user has submitted a brief learning check-in describing what felt clear, fuzzy, interesting, or worth revisiting.

Extract structured signals from the check-in. Return ONLY valid JSON with this exact shape:
{
  "confidence": ["concept or area that feels clear"],
  "confusion": ["concept or area that feels fuzzy or unresolved"],
  "connections": ["connections the user noticed or wants to explore"],
  "curiosity": ["topics the user is curious about"],
  "revisitIntent": ["specific items the user wants to revisit"]
}

Each array can be empty if no relevant signals are found. Keep entries concise (under 15 words each).`;

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function cleanSignal(value: string): string {
  return value
    .split(/\b(?:and i|but i|because|so i|although|though)\b/i)[0]
    .replace(/^(about|on|with|between|its|their|the|a|an)\s+/i, '')
    .replace(/\b(today|right now|for now)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTopicFromClause(clause: string): string {
  const aboutMatch = clause.match(/\babout\s+([^,.!?;]+)/i)?.[1];
  if (aboutMatch) return cleanSignal(aboutMatch);

  const withMatch = clause.match(/\bwith\s+([^,.!?;]+)/i)?.[1];
  if (withMatch) return cleanSignal(withMatch);

  const howMatch = clause.match(/\bhow\s+([^,.!?;]+)/i)?.[1];
  if (howMatch) return cleanSignal(howMatch);

  const lowered = clause.toLowerCase();

  if (lowered.includes('relationship with')) {
    return cleanSignal(clause.split(/relationship with/i)[1] ?? '');
  }

  return '';
}

function heuristicExtractSignals(content: string): CheckInSignals {
  const fallback: CheckInSignals = {
    confidence: [], confusion: [], connections: [], curiosity: [], revisitIntent: [],
  };
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;

  const clauses = normalized
    .split(/(?:[.?!]|;\s*|\s+but\s+|\s+and\s+(?=i\s))/i)
    .map((part) => part.trim())
    .filter(Boolean);

  let recentTopic = '';

  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    const extractedTopic = extractTopicFromClause(clause);
    if (extractedTopic) recentTopic = extractedTopic;

    if (/\b(confident|clear|understand|understood|finally get|got it)\b/i.test(lower)) {
      const topic = extractedTopic || recentTopic;
      if (topic) fallback.confidence.push(topic);
    }

    if (/\b(fuzzy|confused|confusing|unclear|lost|don't get|do not get|not sure|slippery|struggling|struggle|stuck|can't get|not getting|hard to|difficulty)\b/i.test(lower)) {
      let topic = extractedTopic || recentTopic;
      const relationshipTarget = clause.match(/\brelationship with\s+([^,.!?;]+)/i)?.[1];
      if (relationshipTarget && recentTopic) {
        const target = cleanSignal(relationshipTarget);
        topic = cleanSignal(`${recentTopic} and ${target}`);
        fallback.connections.push(topic);
      }
      if (topic) fallback.confusion.push(topic);
    }

    if (/\b(connection|connect|connected|relationship|compare|comparison|difference|vs\.?|versus|link)\b/i.test(lower)) {
      const betweenMatch = clause.match(/\b(?:between|vs\.?|versus)\s+([^,.!?;]+)/i)?.[1];
      if (betweenMatch) {
        fallback.connections.push(cleanSignal(betweenMatch));
      } else if (extractedTopic) {
        fallback.connections.push(extractedTopic);
      }
    }

    if (/\b(curious|interested|want to learn|want to know|want to explore|wondering about|learn about|find out|understand how)\b/i.test(lower)) {
      const topic = extractedTopic || recentTopic;
      if (topic) fallback.curiosity.push(topic);
    }

    if (/\b(revisit|review again|come back to|return to|practice more)\b/i.test(lower)) {
      const topic = extractedTopic || recentTopic;
      if (topic) fallback.revisitIntent.push(topic);
    }

    if (/\bi learned\s+/i.test(lower) && extractedTopic && !fallback.confidence.includes(extractedTopic)) {
      recentTopic = extractedTopic;
    }
  }

  return {
    confidence: unique(fallback.confidence).slice(0, 4),
    confusion: unique(fallback.confusion).slice(0, 4),
    connections: unique(fallback.connections).slice(0, 4),
    curiosity: unique(fallback.curiosity).slice(0, 4),
    revisitIntent: unique(fallback.revisitIntent).slice(0, 4),
  };
}

function mergeSignals(primary: CheckInSignals, fallback: CheckInSignals): CheckInSignals {
  return {
    confidence: unique([...primary.confidence, ...fallback.confidence]).slice(0, 4),
    confusion: unique([...primary.confusion, ...fallback.confusion]).slice(0, 4),
    connections: unique([...primary.connections, ...fallback.connections]).slice(0, 4),
    curiosity: unique([...primary.curiosity, ...fallback.curiosity]).slice(0, 4),
    revisitIntent: unique([...primary.revisitIntent, ...fallback.revisitIntent]).slice(0, 4),
  };
}

async function extractSignals(content: string): Promise<CheckInSignals> {
  const fallback = heuristicExtractSignals(content);

  const settings = settingsService.getSync();
  if (!settings.llm.isConfigured) return fallback;

  try {
    const response = await chatCompletion(
      [
        { role: 'system', content: EXTRACT_SIGNALS_PROMPT },
        { role: 'user', content },
      ],
      settings.llm,
      { serviceName: 'diagnostic' },
    );

    const text = response.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const parsed = JSON.parse(jsonMatch[0]) as CheckInSignals;

    const parsedSignals: CheckInSignals = {
      confidence: Array.isArray(parsed.confidence) ? parsed.confidence : [],
      confusion: Array.isArray(parsed.confusion) ? parsed.confusion : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      curiosity: Array.isArray(parsed.curiosity) ? parsed.curiosity : [],
      revisitIntent: Array.isArray(parsed.revisitIntent) ? parsed.revisitIntent : [],
    };
    return mergeSignals(parsedSignals, fallback);
  } catch {
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildFollowUpPrompt(lastUserMessage: string, signals: CheckInSignals): string {
  return `You are a learning coach having a diagnostic conversation with a student.

The student said: "${lastUserMessage}"

Extracted signals:
- Areas of confusion: ${signals.confusion.join(', ') || 'none identified'}
- Curiosity topics: ${signals.curiosity.join(', ') || 'none identified'}
- Confident areas: ${signals.confidence.join(', ') || 'none identified'}

Ask ONE specific follow-up question that helps you understand their learning state better.
Focus on confusion or curiosity areas. Be conversational and warm, like a tutor.
Keep it to 1-2 sentences. Do not repeat what they said.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

function persist(session: DiagnosticSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const diagnosticDialogueService = {
  /**
   * Start a new diagnostic dialogue session from initial check-in text.
   * Extracts signals and creates the first user turn.
   */
  async startSession(initialText: string): Promise<DiagnosticSession> {
    const signals = await extractSignals(initialText);
    const session: DiagnosticSession = {
      id: `diag-${Date.now()}`,
      turns: [{ role: 'user', content: initialText, signals, timestamp: Date.now() }],
      mergedSignals: signals,
      status: 'active',
      createdAt: Date.now(),
    };
    persist(session);
    return session;
  },

  /**
   * Generate a follow-up question based on the session's merged signals.
   * Adds the assistant turn to the session and persists.
   */
  async generateFollowUp(session: DiagnosticSession): Promise<string> {
    const lastUserTurn = [...session.turns].reverse().find((t) => t.role === 'user');
    const lastMessage = lastUserTurn?.content ?? '';

    const settings = settingsService.getSync();
    const prompt = buildFollowUpPrompt(lastMessage, session.mergedSignals);

    const followUp = await chatCompletion(
      [{ role: 'system', content: prompt }],
      settings.llm,
      { serviceName: 'diagnostic' },
    );

    session.turns.push({ role: 'assistant', content: followUp, timestamp: Date.now() });
    persist(session);
    return followUp;
  },

  /**
   * Process a user reply: extract signals, merge, add turn.
   * Auto-finalizes if user has reached MAX_TURNS.
   */
  async processReply(session: DiagnosticSession, reply: string): Promise<DiagnosticSession> {
    const signals = await extractSignals(reply);
    session.mergedSignals = mergeSignals(signals, session.mergedSignals);
    session.turns.push({ role: 'user', content: reply, signals, timestamp: Date.now() });

    const userTurns = session.turns.filter((t) => t.role === 'user').length;
    if (userTurns >= MAX_TURNS) {
      session.status = 'completed';
    }

    persist(session);
    return session;
  },

  /**
   * Finalize a session: mark completed and clear from localStorage.
   */
  finalize(session: DiagnosticSession): DiagnosticSession {
    session.status = 'completed';
    localStorage.removeItem(STORAGE_KEY);
    return session;
  },

  /**
   * Load the active diagnostic session from localStorage (if any).
   */
  getActiveSession(): DiagnosticSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DiagnosticSession;
    } catch {
      return null;
    }
  },

  /**
   * Clear any active session from localStorage.
   */
  clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
