// Per CONTEXT D-01, the trellis harvest flow awards fruit credits whenever anchors are
// harvested in their blossom state. Credits persist across app restarts via localStorage,
// mirroring the pattern established in trellis-blossom-dates.service.ts.

const STORAGE_KEY = 'trellis_fruit_credits';

function readTotal(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeTotal(total: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(total));
  } catch {
    // localStorage quota exceeded — silently drop; credits reset next cycle
  }
}

export const trellisCreditsService = {
  /** Current fruit credit total (parse int from localStorage, default 0). */
  getTotal(): number {
    return readTotal();
  },

  /** Increment the stored credit total and return the new value. */
  add(count: number): number {
    const current = readTotal();
    const next = current + (Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0);
    writeTotal(next);
    return next;
  },
};
