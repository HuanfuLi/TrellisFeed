import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '../..');
const projectRoot = resolve(appRoot, '..');
const displayName = 'QuestionTrace';
const androidAppId = 'com.trellis.app';
const iosBundleId = 'com.huanfuli.trellis';
const legacyBrand = 'trellis';

const read = (...segments) => readFileSync(resolve(...segments), 'utf8');

function collectLegacyBrandPaths(value, path = '', matches = []) {
  if (typeof value === 'string') {
    if (value.toLowerCase().includes(legacyBrand)) matches.push(path);
    return matches;
  }

  for (const [key, child] of Object.entries(value)) {
    if (path === 'settings.developer') continue;
    collectLegacyBrandPaths(child, path ? `${path}.${key}` : key, matches);
  }
  return matches;
}

const localeFiles = ['en.json', 'zh.json', 'es.json', 'ja.json'];

test('native and web display surfaces use QuestionTrace while bundle identifiers stay stable', () => {
  const indexHtml = read(appRoot, 'index.html');
  const capacitorConfig = read(appRoot, 'capacitor.config.ts');
  const infoPlist = read(appRoot, 'ios/App/App/Info.plist');
  const androidStrings = read(appRoot, 'android/app/src/main/res/values/strings.xml');
  const xcodeProject = read(appRoot, 'ios/App/App.xcodeproj/project.pbxproj');

  assert.match(indexHtml, new RegExp(`<title>${displayName}</title>`));
  assert.match(capacitorConfig, new RegExp(`appName: '${displayName}'`));
  assert.match(capacitorConfig, new RegExp(`appId: '${androidAppId}'`));
  assert.match(infoPlist, new RegExp(`<key>CFBundleDisplayName</key>\\s*<string>${displayName}</string>`));
  assert.doesNotMatch(infoPlist, /NSMicrophoneUsageDescription/);
  assert.match(androidStrings, new RegExp(`<string name="app_name">${displayName}</string>`));
  assert.match(androidStrings, new RegExp(`<string name="title_activity_main">${displayName}</string>`));
  assert.match(androidStrings, new RegExp(`<string name="package_name">${androidAppId}</string>`));
  assert.match(androidStrings, new RegExp(`<string name="custom_url_scheme">${androidAppId}</string>`));
  assert.match(xcodeProject, new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = ${iosBundleId};`));
});

test('all user-facing locale strings no longer name the legacy brand', () => {
  for (const file of localeFiles) {
    const locale = JSON.parse(read(appRoot, 'src/locales', file));
    assert.deepEqual(collectLegacyBrandPaths(locale), [], file);
  }
});

test('active participant surfaces contain no legacy feedback action or starter copy', () => {
  const home = read(appRoot, 'src/screens/HomeScreen.tsx');
  const conceptFeed = read(appRoot, 'src/services/concept-feed.service.ts');
  const starterSection = conceptFeed.slice(
    conceptFeed.indexOf('export const STARTER_POSTS'),
    conceptFeed.indexOf('function makeStarterPost'),
  );

  assert.doesNotMatch(home, /mailto:|Trellis%20Feedback/i);
  assert.doesNotMatch(starterSection, /\bTrellis\b/i);
});
