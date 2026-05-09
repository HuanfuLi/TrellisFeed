import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';
import { bindI18nLeaf } from '../../src/lib/i18n-leaf.ts';

// Initialize the i18next global singleton — date.ts reads i18next.language
// for both Intl formatting and translated greeting/today labels. Give it the
// same greeting keys the production en.json ships, so getGreeting() returns
// stable strings for comparison.
await i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        common: {
          today: 'Today',
          greeting: {
            morning: 'Good Morning',
            afternoon: 'Good Afternoon',
            evening: 'Good Evening',
          },
        },
      },
    },
    zh: {
      translation: {
        common: {
          today: 'Today',
          greeting: {
            morning: 'Good Morning',
            afternoon: 'Good Afternoon',
            evening: 'Good Evening',
          },
        },
      },
    },
    ja: {
      translation: {
        common: {
          today: 'Today',
          greeting: {
            morning: 'Good Morning',
            afternoon: 'Good Afternoon',
            evening: 'Good Evening',
          },
        },
      },
    },
  },
});

// Phase 37: date.ts now reads via the i18n-leaf shim (Pitfall 1 mitigation).
// Wire the leaf to the test-local i18next singleton AFTER init AND BEFORE the
// dynamic import of date.ts so subsequent `i18next.changeLanguage(...)` calls
// in tests propagate through `getCurrentLocale()` and `t(...)`.
bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language);

// date.ts is a leaf module (only imports the i18n-leaf shim, no JSON). To
// avoid triggering the JSON-import chain under Node 25, the test wires the
// leaf above and then dynamically imports date.ts.
const { formatDate, formatDateLabel, getGreeting, today, currentIntlLocale } =
  await import('../../src/lib/date.ts');

test('formatDate: en vs ja produce different strings', async () => {
  const ts = Date.UTC(2026, 4, 15); // May 15, 2026
  await i18next.changeLanguage('en');
  const enOut = formatDate(ts);
  await i18next.changeLanguage('ja');
  const jaOut = formatDate(ts);
  assert.notEqual(
    enOut,
    jaOut,
    `en and ja formatDate outputs must differ. en=${enOut}, ja=${jaOut}`,
  );
});

test('formatDate: zh uses zh-CN Intl tag', async () => {
  await i18next.changeLanguage('zh');
  assert.equal(currentIntlLocale(), 'zh-CN');
});

test('formatDate: unknown locale falls back to en-US Intl tag', async () => {
  await i18next.changeLanguage('ko'); // not supported
  assert.equal(currentIntlLocale(), 'en-US');
});

test('formatDateLabel: today returns t(common.today)', async () => {
  await i18next.changeLanguage('en');
  const out = formatDateLabel(today());
  assert.equal(out, i18next.t('common.today'));
});

test('formatDateLabel: non-today renders via Intl in active locale', async () => {
  await i18next.changeLanguage('en');
  const enOut = formatDateLabel('2026-05-15');
  await i18next.changeLanguage('ja');
  const jaOut = formatDateLabel('2026-05-15');
  assert.notEqual(
    enOut,
    jaOut,
    `en vs ja formatDateLabel non-today must differ. en=${enOut}, ja=${jaOut}`,
  );
});

test('getGreeting returns one of the three greeting translations', async () => {
  await i18next.changeLanguage('en');
  const greeting = getGreeting();
  const valid = [
    i18next.t('common.greeting.morning'),
    i18next.t('common.greeting.afternoon'),
    i18next.t('common.greeting.evening'),
  ];
  assert.ok(
    valid.includes(greeting),
    `getGreeting=${greeting} not in ${JSON.stringify(valid)}`,
  );
});
