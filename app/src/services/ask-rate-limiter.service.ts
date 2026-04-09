const STORAGE_KEY = 'echolearn_ask_rate_limit';

interface RateLimitStore {
  count: number;
  yearMonth: string; // 'YYYY-MM'
}

export interface RateLimitStatus {
  count: number;
  canAsk: boolean;
  nearLimit: boolean;
  resetDate: string;
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getResetDate(): string {
  const d = new Date();
  const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function load(): RateLimitStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, yearMonth: currentYearMonth() };
    const parsed = JSON.parse(raw) as RateLimitStore;
    // Auto-reset on new month
    if (parsed.yearMonth !== currentYearMonth()) {
      const reset = { count: 0, yearMonth: currentYearMonth() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reset));
      return reset;
    }
    return parsed;
  } catch {
    return { count: 0, yearMonth: currentYearMonth() };
  }
}

function save(store: RateLimitStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getRateLimitStatus(limit: number): RateLimitStatus {
  if (limit <= 0) return { count: 0, canAsk: true, nearLimit: false, resetDate: '' };
  const store = load();
  const pct = store.count / limit;
  return {
    count: store.count,
    canAsk: store.count < limit,
    nearLimit: pct >= 0.8,
    resetDate: getResetDate(),
  };
}

export function incrementAskCount(): void {
  const store = load();
  store.count++;
  save(store);
}

export function getAskCount(): number {
  return load().count;
}
