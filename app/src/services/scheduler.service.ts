/**
 * Scheduler Service
 *
 * Checks configured times and triggers tasks when they're due:
 *   - Podcast generation: at (sleepTime − advanceMinutes)
 *   - Planner daily refresh: when 24h+ since last refresh
 *   - Review reminders: at reminderTime
 *
 * Execution modes:
 *   1. Foreground polling: 60s interval while app is active
 *   2. Resume check: runs immediately when app returns to foreground
 *
 * Each task fires at most once per calendar day (daily flag in localStorage).
 * If a task's trigger time has passed (e.g. app was closed), it fires
 * immediately on next check — no upper-bound window.
 */

import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { settingsService } from './settings.service';
import { podcastService } from './podcast.service';
import { plannerAutoGenService } from './plannerAutoGen.service';
import { today } from '../lib/date';
import { eventBus } from '../lib/event-bus';
import { toast } from '../lib/toast';

// ── Daily execution flags (localStorage) ─────────────────────────────────────

const PODCAST_DONE_KEY = 'echolearn_scheduler_podcast_done';
const PLANNER_DONE_KEY = 'echolearn_scheduler_planner_done';
const REVIEW_DONE_KEY = 'echolearn_scheduler_review_done';

function isDoneToday(key: string): boolean {
  return localStorage.getItem(key) === today();
}

function markDoneToday(key: string): void {
  try { localStorage.setItem(key, today()); } catch { /* ignore */ }
}

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Parse "HH:MM" → minutes since midnight */
function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Current time as minutes since midnight */
function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// ── Task runners ──────────────────────────────────────────────────────────────

/**
 * Podcast: trigger if current time is at or past (sleepTime − advanceMinutes).
 * No upper bound — if the app opens late, the podcast still generates.
 */
async function checkPodcast(): Promise<void> {
  const doneToday = isDoneToday(PODCAST_DONE_KEY);
  const settings = settingsService.getSync();
  const sleepMin = parseTime(settings.podcast.sleepTime);
  const advance = settings.podcast.advanceMinutes ?? 60;
  const triggerMin = sleepMin - advance;
  const effectiveTrigger = ((triggerMin % 1440) + 1440) % 1440;
  const now = nowMinutes();
  const isPast = effectiveTrigger <= sleepMin
    ? now >= effectiveTrigger
    : now >= effectiveTrigger || now < sleepMin;

  const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  console.log(`[Scheduler:podcast] now=${fmt(now)} trigger=${fmt(effectiveTrigger)} sleep=${settings.podcast.sleepTime} adv=${advance} isPast=${isPast} done=${doneToday} auto=${settings.podcast.autoGenerate} llm=${settings.llm.isConfigured} tts=${settings.tts.isConfigured}`);

  if (doneToday) return;
  if (!settings.podcast.autoGenerate) return;
  if (!settings.llm.isConfigured) return;
  if (!isPast) return;

  markDoneToday(PODCAST_DONE_KEY);
  console.log('[Scheduler] Triggering podcast generation at', `${Math.floor(now / 60)}:${String(now % 60).padStart(2, '0')}`, `(trigger was ${Math.floor(effectiveTrigger / 60)}:${String(effectiveTrigger % 60).padStart(2, '0')})`);
  toast('Generating your daily podcast...', 'info');

  try {
    await podcastService.generatePodcast(today());
  } catch (err) {
    console.warn('[Scheduler] Podcast generation failed:', err);
  }
}

/**
 * Planner: trigger if daily refresh is needed (24h+ since last).
 */
async function checkPlanner(): Promise<void> {
  if (isDoneToday(PLANNER_DONE_KEY)) return;

  const settings = settingsService.getSync();
  if (!settings.llm.isConfigured) return;

  if (!plannerAutoGenService.isDailyRefreshNeeded()) return;

  markDoneToday(PLANNER_DONE_KEY);
  console.log('[Scheduler] Triggering planner refresh');

  try {
    await plannerAutoGenService.generateAndStoreSuggestions(false);
  } catch (err) {
    console.warn('[Scheduler] Planner refresh failed:', err);
  }
}

/**
 * Review reminder: trigger if current time is at or past reminderTime.
 */
function checkReviewReminder(): void {
  if (isDoneToday(REVIEW_DONE_KEY)) return;

  const settings = settingsService.getSync();
  if (!settings.review.notificationsEnabled) return;

  const reminderMin = parseTime(settings.review.reminderTime);
  const now = nowMinutes();

  if (now < reminderMin) return;

  markDoneToday(REVIEW_DONE_KEY);
  console.log('[Scheduler] Review reminder triggered');
  toast('Time to review your flashcards!', 'info');
  eventBus.emit({ type: 'REVIEW_DUE_COUNT_CHANGED', payload: { count: -1 } });
}

// ── Scheduler lifecycle ───────────────────────────────────────────────────────

let _intervalId: ReturnType<typeof setInterval> | null = null;
let _appStateHandle: Awaited<ReturnType<typeof CapApp.addListener>> | null = null;

async function runAllChecks(): Promise<void> {
  try {
    checkReviewReminder();
    await checkPodcast();
    await checkPlanner();
  } catch (err) {
    console.warn('[Scheduler] Check cycle error:', err);
  }
}

export function startScheduler(): void {
  if (_intervalId) return; // Already running

  // Run checks immediately on start
  void runAllChecks();

  // Poll every 60 seconds while app is in foreground
  _intervalId = setInterval(() => {
    void runAllChecks();
  }, 60_000);

  // On native: also run checks when app returns to foreground
  if (Capacitor.isNativePlatform()) {
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[Scheduler] App resumed — running checks');
        void runAllChecks();
      }
    }).then((handle) => { _appStateHandle = handle; });
  }

  console.log('[Scheduler] Started (60s poll + resume check)');
}

export function stopScheduler(): void {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  if (_appStateHandle) {
    void _appStateHandle.remove();
    _appStateHandle = null;
  }
  console.log('[Scheduler] Stopped');
}
