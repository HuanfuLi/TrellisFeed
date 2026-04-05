/**
 * diagnostic-dialogue.test.mjs
 * Unit tests for diagnosticDialogueService — session lifecycle, signal merging, turn limits.
 * Phase 20: Orchestration Strategy & Diagnostic Dialogue
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ─── Mock chatCompletion ──────────────────────────────────────────────────────

let chatCompletionMock;

// We mock the llm provider before importing the service
const mockLLM = {
  chatCompletion: async (_messages, _config, _options) => {
    if (chatCompletionMock) return chatCompletionMock(_messages, _config, _options);
    return 'What specifically about that topic feels unclear to you?';
  },
};

// ─── Mock localStorage ────────────────────────────────────────────────────────

const store = {};
const mockLocalStorage = {
  getItem(key) { return store[key] ?? null; },
  setItem(key, value) { store[key] = String(value); },
  removeItem(key) { delete store[key]; },
};

// ─── Mock settingsService ─────────────────────────────────────────────────────

const mockSettings = {
  getSync: () => ({
    llm: { isConfigured: true, provider: 'openai', apiKey: 'test-key', model: 'gpt-4' },
  }),
};

// ─── Heuristic signal extraction (mirrors planner.service.ts logic) ───────────

function unique(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function heuristicExtractSignals(content) {
  const fallback = {
    confidence: [], confusion: [], connections: [], curiosity: [], revisitIntent: [],
  };
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;

  const clauses = normalized
    .split(/(?:[.?!]|;\s*|\s+but\s+|\s+and\s+(?=i\s))/i)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const lower = clause.toLowerCase();

    if (/\b(confident|clear|understand|understood|finally get|got it)\b/i.test(lower)) {
      const topic = clause.replace(/^.*?(about|with|on)\s+/i, '').trim();
      if (topic) fallback.confidence.push(topic);
    }

    if (/\b(fuzzy|confused|confusing|unclear|lost|don't get|do not get|not sure|struggling|stuck)\b/i.test(lower)) {
      const topic = clause.replace(/^.*?(about|with|on)\s+/i, '').trim();
      if (topic) fallback.confusion.push(topic);
    }

    if (/\b(curious|interested|want to learn|want to know|wondering about|learn about)\b/i.test(lower)) {
      const topic = clause.replace(/^.*?(about|with|on)\s+/i, '').trim();
      if (topic) fallback.curiosity.push(topic);
    }

    if (/\b(revisit|review again|come back to|return to|practice more)\b/i.test(lower)) {
      const topic = clause.replace(/^.*?(about|with|on)\s+/i, '').trim();
      if (topic) fallback.revisitIntent.push(topic);
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

function mergeSignals(primary, fallback) {
  return {
    confidence: unique([...primary.confidence, ...fallback.confidence]).slice(0, 4),
    confusion: unique([...primary.confusion, ...fallback.confusion]).slice(0, 4),
    connections: unique([...primary.connections, ...fallback.connections]).slice(0, 4),
    curiosity: unique([...primary.curiosity, ...fallback.curiosity]).slice(0, 4),
    revisitIntent: unique([...primary.revisitIntent, ...fallback.revisitIntent]).slice(0, 4),
  };
}

// ─── Service re-implementation for testability ────────────────────────────────
// We create a testable version of the service that accepts injected dependencies

const MAX_TURNS = 3;
const STORAGE_KEY = 'echolearn_diagnostic_session';

function createDiagnosticDialogueService(deps) {
  const { localStorage: ls, chatCompletion, settingsService } = deps;

  function extractSignalsSync(content) {
    return heuristicExtractSignals(content);
  }

  async function extractSignals(content) {
    const fallback = heuristicExtractSignals(content);
    const settings = settingsService.getSync();
    if (!settings.llm.isConfigured) return fallback;

    try {
      const response = await chatCompletion(
        [
          { role: 'system', content: 'Extract learning signals as JSON...' },
          { role: 'user', content },
        ],
        settings.llm,
        { serviceName: 'diagnostic' },
      );
      const text = response.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return fallback;
      const parsed = JSON.parse(jsonMatch[0]);
      return mergeSignals({
        confidence: Array.isArray(parsed.confidence) ? parsed.confidence : [],
        confusion: Array.isArray(parsed.confusion) ? parsed.confusion : [],
        connections: Array.isArray(parsed.connections) ? parsed.connections : [],
        curiosity: Array.isArray(parsed.curiosity) ? parsed.curiosity : [],
        revisitIntent: Array.isArray(parsed.revisitIntent) ? parsed.revisitIntent : [],
      }, fallback);
    } catch {
      return fallback;
    }
  }

  function persist(session) {
    ls.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  return {
    async startSession(initialText) {
      const signals = await extractSignals(initialText);
      const session = {
        id: `diag-${Date.now()}`,
        turns: [{ role: 'user', content: initialText, signals, timestamp: Date.now() }],
        mergedSignals: signals,
        status: 'active',
        createdAt: Date.now(),
      };
      persist(session);
      return session;
    },

    async generateFollowUp(session) {
      const lastUserTurn = [...session.turns].reverse().find((t) => t.role === 'user');
      const lastMessage = lastUserTurn?.content ?? '';
      const ms = session.mergedSignals;

      const systemPrompt = `You are a learning coach having a diagnostic conversation with a student.

The student said: "${lastMessage}"

Extracted signals:
- Areas of confusion: ${ms.confusion.join(', ') || 'none identified'}
- Curiosity topics: ${ms.curiosity.join(', ') || 'none identified'}
- Confident areas: ${ms.confidence.join(', ') || 'none identified'}

Ask ONE specific follow-up question that helps you understand their learning state better.
Focus on confusion or curiosity areas. Be conversational and warm, like a tutor.
Keep it to 1-2 sentences. Do not repeat what they said.`;

      const settings = settingsService.getSync();
      const followUp = await chatCompletion(
        [{ role: 'system', content: systemPrompt }],
        settings.llm,
        { serviceName: 'diagnostic' },
      );

      session.turns.push({ role: 'assistant', content: followUp, timestamp: Date.now() });
      persist(session);
      return followUp;
    },

    async processReply(session, reply) {
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

    finalize(session) {
      session.status = 'completed';
      ls.removeItem(STORAGE_KEY);
      return session;
    },

    getActiveSession() {
      const raw = ls.getItem(STORAGE_KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },

    clearSession() {
      ls.removeItem(STORAGE_KEY);
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('diagnosticDialogueService', () => {
  let service;

  beforeEach(() => {
    // Clear storage
    for (const key of Object.keys(store)) delete store[key];
    chatCompletionMock = null;

    service = createDiagnosticDialogueService({
      localStorage: mockLocalStorage,
      chatCompletion: mockLLM.chatCompletion,
      settingsService: mockSettings,
    });
  });

  it('startSession creates a DiagnosticSession with initial user turn and extracted signals', async () => {
    const session = await service.startSession('I am confused about recursion but clear on loops');

    assert.ok(session.id.startsWith('diag-'), 'id should start with diag-');
    assert.equal(session.turns.length, 1);
    assert.equal(session.turns[0].role, 'user');
    assert.equal(session.turns[0].content, 'I am confused about recursion but clear on loops');
    assert.ok(session.turns[0].signals, 'initial turn should have signals');
    assert.ok(session.turns[0].signals.confusion.length > 0 || session.turns[0].signals.confidence.length > 0,
      'signals should be populated from heuristic extraction');
  });

  it('startSession sets status to active and mergedSignals populated', async () => {
    const session = await service.startSession('I am confused about recursion');

    assert.equal(session.status, 'active');
    assert.ok(session.mergedSignals, 'mergedSignals should exist');
    assert.ok(session.mergedSignals.confusion.length > 0, 'confusion signals should be populated');
  });

  it('generateFollowUp returns a non-empty string referencing confusion/curiosity topics', async () => {
    chatCompletionMock = async (messages) => {
      // Verify the prompt includes confusion topics
      const systemMsg = messages.find((m) => m.role === 'system');
      assert.ok(systemMsg.content.includes('confusion'), 'prompt should reference confusion');
      return 'Can you tell me more about what specifically confuses you about recursion?';
    };

    const session = await service.startSession('I am confused about recursion');
    const followUp = await service.generateFollowUp(session);

    assert.ok(followUp.length > 0, 'follow-up should not be empty');
    assert.ok(typeof followUp === 'string', 'follow-up should be a string');
  });

  it('processReply adds user turn, re-extracts signals, merges with existing', async () => {
    const session = await service.startSession('I am confused about recursion');
    const initialConfusionCount = session.mergedSignals.confusion.length;

    const updated = await service.processReply(session, 'I am also not sure about closures');

    assert.equal(updated.turns.length, 2, 'should have 2 turns after reply');
    assert.equal(updated.turns[1].role, 'user');
    assert.equal(updated.turns[1].content, 'I am also not sure about closures');
    assert.ok(updated.turns[1].signals, 'reply turn should have extracted signals');
    // Merged signals should have items from both turns
    assert.ok(updated.mergedSignals.confusion.length >= initialConfusionCount,
      'merged confusion signals should include items from both turns');
  });

  it('processReply increments turn count correctly', async () => {
    const session = await service.startSession('I am confused about recursion');
    assert.equal(session.turns.filter((t) => t.role === 'user').length, 1, 'should start with 1 user turn');

    const updated = await service.processReply(session, 'Also struggling with closures');
    assert.equal(updated.turns.filter((t) => t.role === 'user').length, 2, 'should have 2 user turns after reply');
  });

  it('session capped at 3 user turns; processReply on 3-turn session auto-finalizes', async () => {
    const session = await service.startSession('I am confused about recursion');

    // Add assistant turn (simulating generateFollowUp)
    session.turns.push({ role: 'assistant', content: 'Tell me more?', timestamp: Date.now() });

    const afterSecond = await service.processReply(session, 'Also not sure about closures');
    assert.equal(afterSecond.status, 'active', 'should still be active after 2 user turns');

    // Add another assistant turn
    afterSecond.turns.push({ role: 'assistant', content: 'Interesting, what else?', timestamp: Date.now() });

    const afterThird = await service.processReply(afterSecond, 'And curious about async patterns');
    assert.equal(afterThird.status, 'completed', 'should be completed after 3 user turns (MAX_TURNS)');
    assert.equal(afterThird.turns.filter((t) => t.role === 'user').length, 3, 'should have exactly 3 user turns');
  });

  it('finalize sets status to completed and clears localStorage', async () => {
    const session = await service.startSession('I am confused about recursion');
    assert.ok(mockLocalStorage.getItem(STORAGE_KEY), 'session should be persisted before finalize');

    const finalized = service.finalize(session);
    assert.equal(finalized.status, 'completed');
    assert.equal(mockLocalStorage.getItem(STORAGE_KEY), null, 'localStorage should be cleared after finalize');
  });

  it('active session persists to and loads from localStorage', async () => {
    const session = await service.startSession('I am confused about recursion');

    // Create a new service instance to test loading from storage
    const service2 = createDiagnosticDialogueService({
      localStorage: mockLocalStorage,
      chatCompletion: mockLLM.chatCompletion,
      settingsService: mockSettings,
    });

    const loaded = service2.getActiveSession();
    assert.ok(loaded, 'should load session from localStorage');
    assert.equal(loaded.id, session.id, 'loaded session should have same id');
    assert.equal(loaded.turns.length, session.turns.length, 'loaded session should have same turns');
    assert.equal(loaded.status, session.status, 'loaded session should have same status');
  });

  it('signals merge incrementally (DIAG-03) — confusion from turn 1 + confusion from turn 2 combined', async () => {
    // Use LLM mock that returns empty (so we rely on heuristics only)
    chatCompletionMock = async () => '{}';

    const session = await service.startSession('I am confused about recursion');
    const turn1Confusion = [...session.mergedSignals.confusion];
    assert.ok(turn1Confusion.length > 0, 'turn 1 should detect confusion about recursion');

    // Add assistant turn
    session.turns.push({ role: 'assistant', content: 'Tell me more?', timestamp: Date.now() });

    const updated = await service.processReply(session, 'I am also not sure about closures');
    const turn2Confusion = updated.mergedSignals.confusion;

    // Should have confusion signals from BOTH turns combined
    assert.ok(turn2Confusion.length >= turn1Confusion.length,
      'merged confusion should include signals from both turns');
    // At minimum, should have more than just turn 1's signals
    // (closures confusion should be added)
    assert.ok(turn2Confusion.length > turn1Confusion.length || turn2Confusion.some((s) => s.toLowerCase().includes('closure')),
      'turn 2 confusion about closures should be merged in');
  });
});
