import type { ResearchIdentity } from '../types';

// TDD scaffold: Task 2's behavioral test is committed before the durable
// bind-once implementation replaces these placeholders.
export const studyContextService = {
  async hydrate(): Promise<void> {},
  getRequired(): ResearchIdentity {
    throw new Error('Research identity is not bound');
  },
  getOptional(): ResearchIdentity | null {
    return null;
  },
  isBound(): boolean {
    return false;
  },
  async bindOnce(_identity: ResearchIdentity): Promise<void> {
    void _identity;
  },
};
