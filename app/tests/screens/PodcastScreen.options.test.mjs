// RED until Plan 52-03
//
// Phase 52-01 Task 3 — Source-reading invariants for PodcastScreen.tsx
// chip selectors + dirty-state badge + playback-rate + locale parity.
//
// Pattern A (source-read counterweight + positive presence assertions on
// PodcastScreen.tsx) plus parsed-JSON locale-bundle parity across en/zh/es/ja.
// Mirrors app/tests/screens/ReviewScreen.anchor-empty-state.test.mjs:15-85.
//
// All PodcastScreen.tsx source-read assertions are RED at end of Wave 0 —
// the screen wiring lands in Plan 52-03. The locale-parity assertions are
// RED too, because podcast.options.* keys aren't in the bundles yet.
//
// This file EXISTS so 52-03 has a green target: every failing assertion
// here describes exactly one piece of work 52-03 must do.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PODCAST_SCREEN_PATH = resolve(__dirname, '../../src/screens/PodcastScreen.tsx');
const source = readFileSync(PODCAST_SCREEN_PATH, 'utf-8');

const LOCALE_PATHS = ['en', 'zh', 'es', 'ja'].map((code) => ({
  code,
  path: resolve(__dirname, `../../src/locales/${code}.json`),
}));

describe('PodcastScreen length+style chips (Phase 52 PODCAST-02)', () => {
  it('renders chip selectors keyed by t("podcast.options.lengthLabel") and t("podcast.options.styleLabel")', () => {
    assert.match(
      source,
      /podcast\.options\.lengthLabel/,
      'PodcastScreen.tsx must reference t("podcast.options.lengthLabel") for the Length chip-group heading',
    );
    assert.match(
      source,
      /podcast\.options\.styleLabel/,
      'PodcastScreen.tsx must reference t("podcast.options.styleLabel") for the Style chip-group heading',
    );
  });

  it('initializes chip state from settings.podcast.defaultLength ?? "standard" (D-11 + D-14)', () => {
    assert.match(
      source,
      /settings\.podcast\.defaultLength\s*\?\?\s*['"]standard['"]/,
      'PodcastScreen.tsx must initialize selectedLength from settings.podcast.defaultLength ?? "standard"',
    );
  });

  it('initializes chip state from settings.podcast.defaultStyle ?? "conversational" (D-11 + D-14)', () => {
    assert.match(
      source,
      /settings\.podcast\.defaultStyle\s*\?\?\s*['"]conversational['"]/,
      'PodcastScreen.tsx must initialize selectedStyle from settings.podcast.defaultStyle ?? "conversational"',
    );
  });

  it('passes the selected length+style options to generatePodcast', () => {
    assert.match(
      source,
      /generatePodcast\([^)]*\{\s*length[^}]*style[^}]*\}\)/,
      'PodcastScreen.tsx must call generatePodcast(..., { length, style }) using the chip selections',
    );
  });

  it('uses podcast.options.regenerateWithNew key for the explicit regenerate button (D-04)', () => {
    assert.match(
      source,
      /podcast\.options\.regenerateWithNew/,
      'PodcastScreen.tsx must reference t("podcast.options.regenerateWithNew") for the dirty-state regenerate CTA',
    );
  });

  it('uses podcast.player.optionsBadge key for the cached-options inline badge (D-06)', () => {
    assert.match(
      source,
      /podcast\.player\.optionsBadge/,
      'PodcastScreen.tsx must reference t("podcast.player.optionsBadge", { length, style }) for the cached-options diff signal',
    );
  });

  it('wires playbackRate to audioRef.current.playbackRate for the 1x/1.5x/2x button (D-08)', () => {
    assert.match(
      source,
      /audioRef\.current\.playbackRate\s*=/,
      'PodcastScreen.tsx must set audioRef.current.playbackRate when the user toggles the cycle button — native HTML5 <audio> API',
    );
  });
});

describe('Locale bundles carry podcast.options.* keys (Phase 52 i18n)', () => {
  const REQUIRED_OPTION_KEYS = [
    'lengthLabel',
    'brief',
    'standard',
    'deep',
    'extended',
    'styleLabel',
    'focused',
    'conversational',
    'review',
    'regenerateWithNew',
  ];

  const REQUIRED_FIELD_KEYS = [
    'podcastDefaultLength',
    'podcastDefaultStyle',
    'ttsModel',
    'ttsModelStandard',
    'ttsModelHd',
  ];

  for (const { code, path } of LOCALE_PATHS) {
    it(`${code}.json defines podcast.options.{${REQUIRED_OPTION_KEYS.join(',')}}`, () => {
      const bundle = JSON.parse(readFileSync(path, 'utf-8'));
      const opts = bundle?.podcast?.options;
      assert.ok(opts, `locales/${code}.json must define podcast.options namespace`);
      for (const k of REQUIRED_OPTION_KEYS) {
        assert.ok(
          typeof opts[k] === 'string' && opts[k].trim().length > 0,
          `locales/${code}.json podcast.options.${k} must be non-empty string`,
        );
      }
    });

    it(`${code}.json defines settings.fields.{${REQUIRED_FIELD_KEYS.join(',')}} (D-07 + D-11)`, () => {
      const bundle = JSON.parse(readFileSync(path, 'utf-8'));
      const fields = bundle?.settings?.fields;
      assert.ok(fields, `locales/${code}.json must define settings.fields namespace`);
      for (const k of REQUIRED_FIELD_KEYS) {
        assert.ok(
          typeof fields[k] === 'string' && fields[k].trim().length > 0,
          `locales/${code}.json settings.fields.${k} must be non-empty string`,
        );
      }
    });

    it(`${code}.json podcast.player.optionsBadge has {{length}} and {{style}} placeholders (D-06)`, () => {
      const bundle = JSON.parse(readFileSync(path, 'utf-8'));
      const badge = bundle?.podcast?.player?.optionsBadge;
      assert.ok(
        typeof badge === 'string' && badge.trim().length > 0,
        `locales/${code}.json podcast.player.optionsBadge must be a non-empty string`,
      );
      assert.ok(
        badge.includes('{{length}}'),
        `locales/${code}.json podcast.player.optionsBadge must include {{length}} interpolation`,
      );
      assert.ok(
        badge.includes('{{style}}'),
        `locales/${code}.json podcast.player.optionsBadge must include {{style}} interpolation`,
      );
    });
  }
});
