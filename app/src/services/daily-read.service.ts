// Daily concept exploration tracker (Phase 30, D-01/D-02/D-03).
// Tracks which concept anchors the user has scrolled through today,
// with automatic daily reset via date comparison.

// Inline today() to avoid the i18next dependency chain from lib/date.ts,
// keeping this module testable under plain Node without bundler resolution.
function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STORAGE_KEY = 'questiontrace_daily_read';

interface DailyReadState {
  date: string;
  exploredAnchors: string[];
}

function freshState(): DailyReadState {
  return { date: today(), exploredAnchors: [] };
}

function loadState(): DailyReadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<DailyReadState>;
    if (parsed.date !== today()) return freshState();
    return {
      date: parsed.date,
      exploredAnchors: Array.isArray(parsed.exploredAnchors) ? parsed.exploredAnchors : [],
    };
  } catch {
    return freshState();
  }
}

function saveState(state: DailyReadState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage quota exceeded — silently drop
  }
}

export const dailyReadService = {
  /** Check if an anchor has been explored today. */
  isExplored(anchorId: string): boolean {
    return loadState().exploredAnchors.includes(anchorId);
  },

  /** Mark an anchor as explored today (idempotent). */
  markExplored(anchorId: string): void {
    const state = loadState();
    if (!state.exploredAnchors.includes(anchorId)) {
      state.exploredAnchors.push(anchorId);
      saveState(state);
    }
  },

  /** Get all explored anchor IDs for today. */
  getExploredAnchors(): string[] {
    return loadState().exploredAnchors;
  },

  /** Reset state (primarily for testing). */
  reset(): void {
    saveState(freshState());
  },
};

