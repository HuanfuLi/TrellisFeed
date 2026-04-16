import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, BookOpen, CalendarClock, Sparkles, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
import { settingsService } from '../../services/settings.service';
import { toast } from '../../lib/toast';
import { scheduleNativeNotifications } from '../../services/scheduler.native';
import { plannerAutoGenService } from '../../services/plannerAutoGen.service';
import { plannerService } from '../../services/planner.service';
import { questionService } from '../../services/question.service';
import { SectionHeader, SettingRow, MaterialSwitch, TextInput, SUB_SCREEN_STYLE } from './SettingsShared';

export function SettingsFeaturesScreen() {
  const { t } = useTranslation();

  // Podcast state
  const [podcastAutoGenerate, setPodcastAutoGenerate] = useState(() => settingsService.getSync().podcast.autoGenerate);
  const [podcastSleepTime, setPodcastSleepTime] = useState(() => settingsService.getSync().podcast.sleepTime);
  const [podcastAdvance, setPodcastAdvance] = useState(() => String(settingsService.getSync().podcast.advanceMinutes));

  // Review state
  const [reviewNotif, setReviewNotif] = useState(() => settingsService.getSync().review.notificationsEnabled);
  const [reviewReminderTime, setReviewReminderTime] = useState(() => settingsService.getSync().review.reminderTime);
  const [reviewLimit, setReviewLimit] = useState(() => String(settingsService.getSync().review.dailyLimit));

  // Planner state
  const [plannerRefreshEnabled, setPlannerRefreshEnabled] = useState(() => {
    const stored = localStorage.getItem('echolearn_planner_refresh_enabled');
    return stored !== null ? stored === 'true' : true;
  });
  const [plannerRefreshTime, setPlannerRefreshTime] = useState(() => {
    return localStorage.getItem('echolearn_planner_refresh_time') ?? '08:00';
  });
  const [isRefreshingPlanner, setIsRefreshingPlanner] = useState(false);

  const savePlannerRefreshEnabled = (value: boolean) => {
    setPlannerRefreshEnabled(value);
    localStorage.setItem('echolearn_planner_refresh_enabled', String(value));
  };

  const savePlannerRefreshTime = (value: string) => {
    setPlannerRefreshTime(value);
    localStorage.setItem('echolearn_planner_refresh_time', value);
  };

  return (
    <div style={SUB_SCREEN_STYLE}>
      <Header title={t('settings.titles.features')} backTo="/settings" />

      {/* Podcast Settings */}
      <SectionHeader icon={<Radio size={20} />} title={t('settings.sections.podcast')} />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label={t('settings.fields.autoGenerate')} description={t('settings.descriptions.podcastAutoGenerate')}>
          <MaterialSwitch
            checked={podcastAutoGenerate}
            onChange={() => setPodcastAutoGenerate((v) => !v)}
          />
        </SettingRow>
        <SettingRow label={t('settings.fields.sleepTime')} description={t('settings.descriptions.podcastSleepTime')}>
          <TextInput type="time" value={podcastSleepTime} onChange={setPodcastSleepTime} placeholder={t('settings.placeholders.sleepTime')} />
        </SettingRow>
        <SettingRow label={t('settings.fields.advanceMinutes')} description={t('settings.descriptions.podcastAdvance')}>
          <TextInput value={podcastAdvance} onChange={setPodcastAdvance} placeholder={t('settings.placeholders.advance')} />
        </SettingRow>
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              const result = await settingsService.set('podcast', {
                autoGenerate: podcastAutoGenerate,
                sleepTime: podcastSleepTime,
                advanceMinutes: Number.isNaN(parseInt(podcastAdvance)) ? 60 : parseInt(podcastAdvance),
              });
              if (result.success) {
                toast(t('settings.toast.podcastSaved'), 'success');
                void scheduleNativeNotifications(); // Reschedule with new times
              } else {
                toast(result.error?.message || t('settings.toast.podcastSaveFailed'), 'error');
              }
            }}
          >
            {t('settings.buttons.save')}
          </Button>
        </div>
      </Card>

      {/* Review Settings */}
      <SectionHeader icon={<BookOpen size={20} />} title={t('settings.sections.review')} />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label={t('settings.fields.notifications')}>
          <MaterialSwitch
            checked={reviewNotif}
            onChange={() => setReviewNotif((v) => !v)}
          />
        </SettingRow>
        {reviewNotif && (
          <SettingRow label={t('settings.fields.reminderTime')}>
            <TextInput type="time" value={reviewReminderTime} onChange={setReviewReminderTime} placeholder={t('settings.placeholders.reminder')} />
          </SettingRow>
        )}
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              await settingsService.set('review', {
                dailyLimit: parseInt(reviewLimit) || 50,
                notificationsEnabled: reviewNotif,
                reminderTime: reviewReminderTime,
              });
              toast(t('settings.toast.reviewSaved'), 'success');
              void scheduleNativeNotifications(); // Reschedule with new times
            }}
          >
            {t('settings.buttons.save')}
          </Button>
        </div>
      </Card>

      {/* Planner Auto-Suggestions */}
      <SectionHeader icon={<CalendarClock size={20} />} title={t('settings.sections.planner')} />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow label={t('settings.fields.dailyAutoRefresh')} description={t('settings.descriptions.plannerAutoRefresh')}>
          <MaterialSwitch
            checked={plannerRefreshEnabled}
            onChange={() => savePlannerRefreshEnabled(!plannerRefreshEnabled)}
          />
        </SettingRow>
        {plannerRefreshEnabled && (
          <SettingRow label={t('settings.fields.preferredRefreshTime')} description={t('settings.descriptions.plannerRefreshTime')}>
            <TextInput type="time" value={plannerRefreshTime} onChange={savePlannerRefreshTime} placeholder={t('settings.placeholders.plannerRefresh')} />
          </SettingRow>
        )}
        <div style={{ paddingTop: '12px', display: 'flex', gap: '8px' }}>
          <Button
            size="sm"
            variant="secondary"
            disabled={isRefreshingPlanner}
            onClick={async () => {
              setIsRefreshingPlanner(true);
              try {
                const questions = questionService.getAll();
                if (questions.length > 0) {
                  const summaryLines = questions
                    .slice(0, 20)
                    .map((q) => q.summary || q.content)
                    .join('. ');
                  const checkInText = t('settings.planner.checkIn', { summary: summaryLines });
                  await plannerService.submitCheckIn(checkInText);
                }
                await plannerAutoGenService.generateAndStoreSuggestions(true);
                toast(t('settings.toast.plannerRefreshed'), 'success');
              } catch {
                toast(t('settings.toast.plannerRefreshFailed'), 'error');
              } finally {
                setIsRefreshingPlanner(false);
              }
            }}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            {isRefreshingPlanner
              ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              : <Sparkles size={16} />
            }
            {isRefreshingPlanner ? t('settings.buttons.generating') : t('settings.buttons.generatePlanner')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
