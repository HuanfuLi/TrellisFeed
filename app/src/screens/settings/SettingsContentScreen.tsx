import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Youtube, Globe, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
import { settingsService } from '../../services/settings.service';
import { imageGenerationService } from '../../services/imageGeneration.service';
import { bootstrapImageGeneration } from '../../services/imageGeneration.bootstrap';
import { NanoBananaProvider } from '../../providers/nanoBanana.provider';
import { GeminiProvider } from '../../providers/gemini.provider';
import { toast } from '../../lib/toast';
import {
  SectionHeader,
  SettingRow,
  SelectInput,
  TextInput,
  MaterialSwitch,
  SUB_SCREEN_STYLE,
} from './SettingsShared';
import type { ImageGenerationSettings, ImageProviderPrimary } from '../../types';

export function SettingsContentScreen() {
  const { t } = useTranslation();

  const [imageGen, setImageGen] = useState<ImageGenerationSettings>(
    () => settingsService.getSync().imageGeneration,
  );
  const [cacheStats, setCacheStats] = useState(() => imageGenerationService.getCacheStats());
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [youtubeApiKey, setYoutubeApiKey] = useState(
    () => settingsService.getSync().youtube?.apiKey ?? '',
  );
  const [tavilyApiKey, setTavilyApiKey] = useState(
    () => settingsService.getSync().webSearch?.tavilyApiKey ?? '',
  );
  const [testResult, setTestResult] = useState<Record<string, string | null>>({});
  const [isTesting, setIsTesting] = useState<Record<string, boolean>>({});

  const saveImageGen = async (current: ImageGenerationSettings = imageGen) => {
    await settingsService.set('imageGeneration', current);
    bootstrapImageGeneration();
    toast(t('settings.toast.imageGenSaved'), 'success');
  };

  const handleTestImageConnection = async () => {
    setIsTesting((prev) => ({ ...prev, imageGen: true }));
    setTestResult((prev) => ({ ...prev, imageGen: null }));

    const opts = { timeoutMs: 90_000, maxRetries: 1 };
    const results: string[] = [];

    if (imageGen.nanoBananaApiKey.trim()) {
      const nb = new NanoBananaProvider(imageGen.nanoBananaApiKey);
      const r = await nb.generate(t('settings.test.testPrompt'), 'photo', opts);
      results.push(
        r.success
          ? t('settings.test.nanoBananaOk')
          : t('settings.test.nanoBananaFail', {
              error: r.error?.message ?? t('settings.test.defaultFailed').toLowerCase(),
            }),
      );
    }

    if (imageGen.geminiApiKey.trim()) {
      const g = new GeminiProvider(imageGen.geminiApiKey);
      const r = await g.generate(t('settings.test.testPrompt'), 'photo', opts);
      results.push(
        r.success
          ? t('settings.test.geminiOk')
          : t('settings.test.geminiFail', {
              error: r.error?.message ?? t('settings.test.defaultFailed').toLowerCase(),
            }),
      );
    }

    if (results.length === 0) {
      setTestResult((prev) => ({ ...prev, imageGen: t('settings.test.noKeys') }));
    } else {
      const allOk = results.every((r) => r.includes('✓'));
      setTestResult((prev) => ({
        ...prev,
        imageGen: (allOk ? '✓ ' : '✗ ') + results.join(' | '),
      }));
    }

    setIsTesting((prev) => ({ ...prev, imageGen: false }));
  };

  const handleClearImageCache = async () => {
    if (!confirm(t('settings.confirm.clearImageCache'))) return;
    setIsClearingCache(true);
    await imageGenerationService.clearImageCache();
    setCacheStats(imageGenerationService.getCacheStats());
    setIsClearingCache(false);
    toast(t('settings.toast.imageCacheCleared'), 'success');
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={SUB_SCREEN_STYLE}>
      <Header title={t('settings.titles.contentSources')} backTo="/settings" />

      {/* Image Generation Section */}
      <SectionHeader icon={<Image size={20} />} title={t('settings.sections.imageGeneration')} />
      <Card style={{ marginBottom: '8px' }}>
        <SettingRow
          label={t('settings.fields.imageGeneration')}
          description={t('settings.descriptions.imageGenToggle')}
        >
          <MaterialSwitch
            checked={imageGen.enabled ?? true}
            onChange={() => {
              const next = { ...imageGen, enabled: !(imageGen.enabled ?? true) };
              setImageGen(next);
              void saveImageGen(next);
            }}
          />
        </SettingRow>
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--muted-foreground)',
            marginBottom: '12px',
            lineHeight: 1.5,
          }}
        >
          {t('settings.descriptions.imageGenBlurb')}
        </p>
        <SettingRow
          label={t('settings.fields.primaryProvider')}
          description={t('settings.descriptions.imageGenPrimary')}
        >
          <SelectInput
            value={imageGen.primaryProvider ?? 'auto'}
            onChange={(v) => {
              const next = { ...imageGen, primaryProvider: v as ImageProviderPrimary };
              setImageGen(next);
              void saveImageGen(next);
            }}
            options={[
              { value: 'auto', label: t('settings.providerLabels.autoKeys') },
              { value: 'nanoBanana', label: t('settings.providerLabels.nanoBananaPrimary') },
              { value: 'gemini', label: t('settings.providerLabels.geminiProvider') },
            ]}
          />
        </SettingRow>
        <SettingRow
          label={t('settings.fields.nanoBananaApiKey')}
          description={t('settings.descriptions.nanoBanana')}
        >
          <TextInput
            type="password"
            value={imageGen.nanoBananaApiKey}
            onChange={(v) => setImageGen((prev) => ({ ...prev, nanoBananaApiKey: v }))}
            onBlur={() => void saveImageGen()}
            placeholder={t('settings.placeholders.nanoBananaKey')}
          />
        </SettingRow>
        <SettingRow
          label={t('settings.fields.geminiApiKey')}
          description={t('settings.descriptions.geminiFallback')}
        >
          <TextInput
            type="password"
            value={imageGen.geminiApiKey}
            onChange={(v) => setImageGen((prev) => ({ ...prev, geminiApiKey: v }))}
            onBlur={() => void saveImageGen()}
            placeholder={t('settings.placeholders.geminiKey')}
          />
        </SettingRow>
        <SettingRow
          label={t('settings.fields.geminiModel')}
          description={t('settings.descriptions.geminiModelHint')}
        >
          <TextInput
            value={imageGen.geminiModel ?? 'gemini-3.1-flash-image-preview'}
            onChange={(v) => setImageGen((prev) => ({ ...prev, geminiModel: v }))}
            onBlur={() => void saveImageGen()}
            placeholder={t('settings.placeholders.geminiModel')}
          />
        </SettingRow>
        <SettingRow
          label={t('settings.fields.cacheLimit')}
          description={t('settings.descriptions.cacheLimitHint')}
        >
          <TextInput
            value={String(imageGen.maxCacheSizeMb)}
            onChange={(v) =>
              setImageGen((prev) => ({ ...prev, maxCacheSizeMb: parseInt(v) || 50 }))
            }
            onBlur={() => void saveImageGen()}
            placeholder={t('settings.placeholders.maxCacheSize')}
          />
        </SettingRow>

        {/* Cache stats */}
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--surface-variant)',
            border: '1px solid var(--border)',
          }}
        >
          <p
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--muted-foreground)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: '8px',
            }}
          >
            {t('settings.cacheStats.title')}
          </p>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              fontSize: '0.82rem',
              color: 'var(--foreground)',
              flexWrap: 'wrap',
            }}
          >
            <span>{t('settings.cacheStats.imagesCached', { count: cacheStats.itemCount })}</span>
            <span>
              {t('settings.cacheStats.used', { size: formatBytes(cacheStats.totalSizeBytes) })}
            </span>
            <span>{t('settings.cacheStats.limit', { mb: imageGen.maxCacheSizeMb })}</span>
          </div>
        </div>

        <div style={{ paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button size="sm" variant="primary" onClick={() => void saveImageGen()}>
            {t('settings.buttons.save')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={
              isTesting['imageGen'] ||
              (!imageGen.nanoBananaApiKey.trim() && !imageGen.geminiApiKey.trim())
            }
            onClick={() => void handleTestImageConnection()}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            {isTesting['imageGen'] ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : null}
            {t('settings.buttons.test')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={isClearingCache || cacheStats.itemCount === 0}
            onClick={() => void handleClearImageCache()}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            {isClearingCache ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : null}
            {t('settings.buttons.clearCache')}
          </Button>
        </div>
        {testResult['imageGen'] && (
          <div
            style={{
              marginTop: '10px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              fontSize: '0.8rem',
              color: testResult['imageGen'].startsWith('✓')
                ? 'var(--primary-40)'
                : 'var(--danger)',
              lineHeight: 1.5,
            }}
          >
            {testResult['imageGen'].startsWith('✓') ? (
              <CheckCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            ) : (
              <XCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            )}
            <span>{testResult['imageGen']}</span>
          </div>
        )}
      </Card>

      {/* YouTube Section */}
      <SectionHeader icon={<Youtube size={20} />} title={t('settings.sections.youtube')} />
      <Card style={{ marginBottom: '8px' }}>
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--muted-foreground)',
            marginBottom: '12px',
            lineHeight: 1.5,
          }}
        >
          {t('settings.descriptions.youtubeBlurb')}
        </p>
        <SettingRow
          label={t('settings.fields.apiKey')}
          description={t('settings.descriptions.youtubeApiKey')}
        >
          <TextInput
            type="password"
            value={youtubeApiKey}
            onChange={(v) => setYoutubeApiKey(v)}
            onBlur={() => void settingsService.set('youtube', { apiKey: youtubeApiKey })}
            placeholder={t('settings.descriptions.youtubeApiKey')}
          />
        </SettingRow>
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              await settingsService.set('youtube', { apiKey: youtubeApiKey });
              toast(t('settings.toast.youtubeSaved'), 'success');
            }}
          >
            {t('settings.buttons.save')}
          </Button>
        </div>
      </Card>

      {/* Web Search Section */}
      <SectionHeader icon={<Globe size={20} />} title={t('settings.sections.webSearch')} />
      <Card style={{ marginBottom: '8px' }}>
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--muted-foreground)',
            marginBottom: '12px',
            lineHeight: 1.5,
          }}
        >
          {t('settings.descriptions.webSearchBlurb1')}{' '}
          <a
            href="https://tavily.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary-40)' }}
          >
            tavily.com
          </a>{' '}
          {t('settings.descriptions.webSearchBlurb2')}
        </p>
        <SettingRow
          label={t('settings.fields.apiKey')}
          description={t('settings.descriptions.tavilyApiKey')}
        >
          <TextInput
            type="password"
            value={tavilyApiKey}
            onChange={(v) => setTavilyApiKey(v)}
            onBlur={() => void settingsService.set('webSearch', { tavilyApiKey })}
            placeholder="tvly-..."
          />
        </SettingRow>
        <div style={{ paddingTop: '12px' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              await settingsService.set('webSearch', { tavilyApiKey });
              toast(t('settings.toast.webSearchSaved'), 'success');
            }}
          >
            {t('settings.buttons.save')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
