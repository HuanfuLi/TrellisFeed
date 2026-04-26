/**
 * Native Notification Scheduler
 *
 * Schedules OS-level local notifications for:
 *   - Podcast generation reminder (sleepTime − advanceMinutes)
 *   - Review reminder (reminderTime)
 *
 * Notifications are rescheduled whenever settings change.
 * On tap, the app opens and the foreground scheduler (scheduler.service.ts)
 * picks up and executes the actual task.
 *
 * Only active on native platforms (iOS/Android). No-op on web.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { settingsService } from './settings.service';

// Fixed notification IDs (stable across reschedules)
const PODCAST_NOTIF_ID = 9001;
const REVIEW_NOTIF_ID = 9002;

/** Parse "HH:MM" → { hour, minute } */
function parseHHMM(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hour: h || 0, minute: m || 0 };
}

/**
 * Build a Date for today (or tomorrow if time already passed) at the given hour:minute.
 */
function nextOccurrence(hour: number, minute: number): Date {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/**
 * Schedule (or reschedule) native local notifications based on current settings.
 * Safe to call multiple times — previous notifications with the same IDs are replaced.
 */
export async function scheduleNativeNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Request permission (no-op if already granted)
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      console.warn('[NativeScheduler] Notification permission not granted');
      return;
    }

    // Cancel existing scheduled notifications to avoid duplicates
    await LocalNotifications.cancel({ notifications: [{ id: PODCAST_NOTIF_ID }, { id: REVIEW_NOTIF_ID }] });

    const settings = settingsService.getSync();
    const notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date; allowWhileIdle: boolean };
    }> = [];

    // ── Podcast notification ───────────────────────────────────────────────
    if (settings.podcast.autoGenerate && settings.llm.isConfigured) {
      const sleep = parseHHMM(settings.podcast.sleepTime);
      const advanceMin = settings.podcast.advanceMinutes || 60;

      // Calculate trigger time: sleepTime − advanceMinutes
      let triggerMinutes = (sleep.hour * 60 + sleep.minute) - advanceMin;
      if (triggerMinutes < 0) triggerMinutes += 1440;
      const triggerHour = Math.floor(triggerMinutes / 60) % 24;
      const triggerMin = triggerMinutes % 60;

      notifications.push({
        id: PODCAST_NOTIF_ID,
        title: 'Your daily podcast is ready to generate',
        body: `Tap to open Trellis and start your ${settings.podcast.sleepTime} wind-down podcast.`,
        schedule: {
          at: nextOccurrence(triggerHour, triggerMin),
          allowWhileIdle: true,
        },
      });
    }

    // ── Review reminder notification ───────────────────────────────────────
    if (settings.review.notificationsEnabled) {
      const reminder = parseHHMM(settings.review.reminderTime);

      notifications.push({
        id: REVIEW_NOTIF_ID,
        title: 'Time to review your flashcards',
        body: 'A few minutes of spaced repetition keeps your knowledge fresh.',
        schedule: {
          at: nextOccurrence(reminder.hour, reminder.minute),
          allowWhileIdle: true,
        },
      });
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
      console.log('[NativeScheduler] Scheduled', notifications.length, 'notification(s)');
    }

    // Listen for notification taps — app opens and foreground scheduler handles the task
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('[NativeScheduler] Notification tapped:', action.notification.id);
      // The foreground scheduler (scheduler.service.ts) will run checks on app resume
    });
  } catch (err) {
    console.warn('[NativeScheduler] Failed to schedule notifications:', err);
  }
}

/**
 * Cancel all Trellis scheduled notifications.
 */
export async function cancelNativeNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: PODCAST_NOTIF_ID }, { id: REVIEW_NOTIF_ID }] });
  } catch { /* ignore */ }
}
