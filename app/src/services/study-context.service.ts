import { eventBus } from '../lib/event-bus.ts';
import { dbExecute, dbQuery } from './db.service.ts';
import type { ResearchIdentity, StudyCondition } from '../types/index.ts';

const IDENTITY_METADATA_ID = 'identity';

let identity: ResearchIdentity | null = null;
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
let bindingPromise: Promise<void> | null = null;
let installToken: string | null = null;

interface InstallationBinding {
  identity: ResearchIdentity;
  installToken: string;
}

function freezeIdentity(value: ResearchIdentity): ResearchIdentity {
  return Object.freeze({
    userId: value.userId,
    condition: value.condition,
    topicId: value.topicId,
    boundAt: value.boundAt,
  }) as ResearchIdentity;
}

function isStudyCondition(value: unknown): value is StudyCondition {
  return value === 'control' || value === 'experimental';
}

function parseIdentity(value: unknown): ResearchIdentity {
  if (!value || typeof value !== 'object') {
    throw new Error('Research identity metadata is invalid');
  }

  const candidate = value as Partial<ResearchIdentity>;
  if (
    typeof candidate.userId !== 'string' || !/^\d+$/.test(candidate.userId) ||
    !isStudyCondition(candidate.condition) ||
    typeof candidate.topicId !== 'string' || candidate.topicId.trim().length === 0 ||
    typeof candidate.boundAt !== 'string' || Number.isNaN(Date.parse(candidate.boundAt))
  ) {
    throw new Error('Research identity metadata is invalid');
  }

  return freezeIdentity(candidate as ResearchIdentity);
}

function sameIdentity(left: ResearchIdentity, right: ResearchIdentity): boolean {
  return left.userId === right.userId &&
    left.condition === right.condition &&
    left.topicId === right.topicId &&
    left.boundAt === right.boundAt;
}

async function loadBinding(): Promise<InstallationBinding | null> {
  const rows = await dbQuery<{ id: string; data: string }>(
    'SELECT * FROM research_metadata WHERE id = ?',
    [IDENTITY_METADATA_ID],
  );
  if (rows.length === 0) return null;

  try {
    const parsed = JSON.parse(rows[0].data) as Partial<InstallationBinding>;
    if (typeof parsed.installToken !== 'string' || parsed.installToken.length < 32) {
      throw new Error('Research identity metadata is invalid');
    }
    return { identity: parseIdentity(parsed.identity), installToken: parsed.installToken };
  } catch (error) {
    if (error instanceof Error && error.message === 'Research identity metadata is invalid') {
      throw error;
    }
    throw new Error('Research identity metadata is invalid');
  }
}

export const studyContextService = {
  /** Load the durable, researcher-bound identity once for synchronous readers. */
  async hydrate(): Promise<void> {
    if (hydrated) return;
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      const binding = await loadBinding();
      identity = binding?.identity ?? null;
      installToken = binding?.installToken ?? null;
      hydrated = true;
    })();

    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },

  /** Read the bound identity or fail closed before a participant route can use it. */
  getRequired(): ResearchIdentity {
    if (!identity) throw new Error('Research identity is not bound');
    return identity;
  },

  getOptional(): ResearchIdentity | null {
    return identity;
  },

  isBound(): boolean {
    return identity !== null && installToken !== null;
  },

  /** Internal upload credential; never display, export, or log this value. */
  getInstallToken(): string {
    if (!installToken) throw new Error('Research installation token is not bound');
    return installToken;
  },

  /**
   * Persist the installation identity exactly once. Repeating the exact same
   * bind is harmless; any account, condition, topic, or timestamp change is
   * rejected so participant flows can never switch conditions.
   */
  async bindOnce(nextIdentity: ResearchIdentity, nextInstallToken: string): Promise<void> {
    const candidate = parseIdentity(nextIdentity);
    if (typeof nextInstallToken !== 'string' || nextInstallToken.length < 32) {
      throw new Error('Research installation token is invalid');
    }

    if (bindingPromise) {
      await bindingPromise;
      return studyContextService.bindOnce(candidate, nextInstallToken);
    }

    bindingPromise = (async () => {
      await studyContextService.hydrate();
      if (identity) {
        if (sameIdentity(identity, candidate) && installToken === nextInstallToken) return;
        throw new Error('Research identity is already bound and cannot be changed');
      }

      await dbExecute(
        'INSERT OR REPLACE INTO research_metadata (id, data) VALUES (?, ?)',
        [IDENTITY_METADATA_ID, JSON.stringify({ identity: candidate, installToken: nextInstallToken })],
      );
      identity = candidate;
      installToken = nextInstallToken;
      eventBus.emit({
        type: 'RESEARCH_IDENTITY_BOUND',
        payload: {
          userId: candidate.userId,
          condition: candidate.condition,
          topicId: candidate.topicId,
        },
      });
    })();

    try {
      await bindingPromise;
    } finally {
      bindingPromise = null;
    }
  },
};
