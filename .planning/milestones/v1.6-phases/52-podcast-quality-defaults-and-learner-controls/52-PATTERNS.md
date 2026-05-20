# Phase 52: Podcast Quality Defaults and Learner Controls — Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 14 (3 new + 11 modified, with 4 locale bundles counted as one i18n surface)
**Analogs found:** 14 / 14

## File Classification

| File | New/Modified | Role | Data Flow | Closest Analog | Match Quality |
|------|--------------|------|-----------|----------------|---------------|
| `app/src/services/podcast-prompt.ts` | NEW | service (leaf, pure) | transform (input → string assembly) | `app/src/lib/i18n-leaf.ts` (leaf-module pattern) + prompt-builder slices in `canonical-knowledge.service.ts:buildStepPrompt` | exact (leaf-module + prompt-assembly hybrid) |
| `app/tests/services/podcast-prompt.test.mjs` | NEW | test (pure prompt assembly) | unit | `app/tests/services/reorg-prompt-journal-injection.test.mjs` | exact (source-reading + prompt slice asserts) |
| `app/tests/services/podcast-options.test.mjs` | NEW | test (service hash + cache invalidation) | unit | `app/tests/services/classification-dedup.test.mjs` | exact (source-reading + structural invariants) |
| `app/tests/screens/PodcastScreen.options.test.mjs` | NEW | test (screen render + behavior) | unit | `app/tests/screens/ReviewScreen.anchor-empty-state.test.mjs` | exact (source-reading + 4-locale bundle parity) |
| `app/src/types/index.ts` | MODIFIED | type def | additive optional fields | existing `DailyPodcast` (line 187), `PodcastSettings` (line 284), `TTSConfig` (line 269) | exact (same file, additive only) |
| `app/src/services/podcast.service.ts` | MODIFIED | service | CRUD + transform (signature change, cache key) | itself — extend `generatePodcast` + `addConceptToPodcast` invalidation pattern in place | exact (in-place extension) |
| `app/src/screens/PodcastScreen.tsx` | MODIFIED | screen | request-response (chips → service call) | itself; chip selector pattern from `SelectInput` in `SettingsShared.tsx` (project convention) | exact (in-place extension; iOS-style chip group is new shape) |
| `app/src/state/usePodcast.ts` | MODIFIED | hook | pass-through | itself — extend `generatePodcast` signature only | exact |
| `app/src/providers/tts/index.ts` | MODIFIED | provider | request-response (HTTP) | itself — un-hardcode `model:` literal at line 54, read from `config.model ?? 'tts-1'` | exact |
| `app/src/services/scheduler.service.ts` | MODIFIED | service | event-driven (timer) | itself — add `settings.podcast.defaultLength/Style` read at line 87 | exact |
| `app/src/screens/settings/SettingsFeaturesScreen.tsx` | MODIFIED | settings sub-screen | request-response (form save) | itself — Podcast section block (lines 53–88); add two `SelectInput` `SettingRow`s alongside autoGenerate/sleepTime/advanceMinutes | exact |
| `app/src/screens/settings/SettingsAIScreen.tsx` | MODIFIED | settings sub-screen | request-response (form save) | itself — TTS section voice `SelectInput` block (lines 389–404); add sibling Model row | exact |
| `app/src/locales/{en,zh,es,ja}.json` | MODIFIED | locale bundle | static config | `app/src/locales/en.json` `podcast.*` namespace (lines 618–673) — extend with `podcast.options.*`; `settings.fields/descriptions.*` (existing namespaces) | exact (same files, additive keys) |

---

## Pattern Assignments

### `app/src/services/podcast-prompt.ts` (NEW — leaf service, prompt assembly)

**Analog:** `app/src/lib/i18n-leaf.ts` (leaf-module contract) + slices from prompt-builder patterns in `canonical-knowledge.service.ts`.

**Leaf-module rule (load-bearing, from CLAUDE.md i18n workflow + Phase 27/50 D-03):**
- Pure prompt-string assembly only.
- NO JSON imports.
- NO `import { ... } from '../lib/date'`.
- NO `import { useTranslation } from 'react-i18next'`.
- NO `import { ... } from '../locales/index'`.
- Reason: `tests/locales/bundle-parity.test.mjs` runs under `node --test` on Node 25 which throws `ERR_IMPORT_ATTRIBUTE_MISSING` on the static JSON imports inside `src/locales/index.ts`. Any transitive import chain from a service tested by `node --test` back to those JSON imports breaks the entire suite.

**Leaf-module header pattern** (copy from `app/src/lib/i18n-leaf.ts:1-26`):
```typescript
// src/services/podcast-prompt.ts (Phase 52 — PODCAST-01..04)
//
// Pure prompt-string assembly for podcast generation. Leaf module — no JSON
// imports, no lib/date, no react-i18next. Otherwise tests/locales/
// bundle-parity.test.mjs chain breaks under `node --test`.
//
// Inputs: conceptLines (pre-formatted bullet list), PodcastOptions.
// Output: { system, user } prompt pair fed to chatCompletion.
//
// See CLAUDE.md "i18n Workflow" + Phase 27/50 leaf-service rule.
```

**Type-only imports (allowed)** — pattern from `app/src/providers/tts/index.ts:2`:
```typescript
import type { PodcastOptions, PodcastLength, PodcastStyle, SupportedLocale } from '../types';
```

**Constant-map pattern** — copy shape from `app/src/providers/tts/index.ts:21-26` (`LOCALE_VOICE_FALLBACK`):
```typescript
const LENGTH_MAP: Record<PodcastLength, string> = {
  brief: 'Keep it concise: ~150 words (~60 seconds spoken). Shorten each section proportionally; do not omit any.',
  standard: 'Target ~225 words (~90 seconds spoken). Cover all five sections evenly.',
  deep: 'Target ~450 words (~3 minutes spoken). Expand connections and ask 4-5 retrieval questions.',
  extended: 'Target ~750 words (~5 minutes spoken). Develop each section in depth; aim for commute-friendly long-form.',
};

const STYLE_MAP: Record<PodcastStyle, string> = {
  focused: 'Use structured, section-by-section delivery. Be precise and direct. Minimal asides.',
  conversational: 'Use a warm, natural radio-host style with smooth transitions. Engaging but stay educational.',
  review: 'Emphasize active recall. After each concept recap, immediately pose a retrieval question. End with a rapid-fire self-test.',
};
```

**Export shape** — single function returning `{ system, user }` (mirrors how `podcast.service.ts:204-211` currently inlines the prompt object literal):
```typescript
export function buildPodcastPrompt(conceptLines: string, options: PodcastOptions): { system: string; user: string } {
  const system = [
    BASE_INSTRUCTION,
    SECTION_INSTRUCTION,
    LENGTH_MAP[options.length],
    STYLE_MAP[options.style],
    COVERAGE_CONSTRAINT,
  ].join('\n\n');
  const user = `Concepts to cover:\n${conceptLines}`;
  return { system, user };
}

export function computeOptionsHash(
  conceptIds: string[],
  locale: SupportedLocale,
  options: PodcastOptions,
): string {
  const sorted = [...conceptIds].sort();
  return JSON.stringify({ conceptIds: sorted, locale, length: options.length, style: options.style });
}
```

**Coverage constraint string is a stable literal** — the test suite asserts the literal `'you MUST mention every concept'` substring exists (R5 + R17 contract). Keep it byte-stable.

---

### `app/tests/services/podcast-prompt.test.mjs` (NEW — source-reading prompt asserts)

**Analog:** `app/tests/services/reorg-prompt-journal-injection.test.mjs:1-100`. Same shape: read `podcast-prompt.ts` source as text, assert literal slices exist.

**Imports + source-read pattern** (lines 25-32 of analog):
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/services/podcast-prompt.ts', import.meta.url),
  'utf-8',
);
```

**Behavioral assertion via dynamic import** — Phase 52 also needs to verify the assembled prompt strings programmatically (3 lengths × 3 styles + coverage). Pattern from `post-essay.service.test.mjs:6-21` (dynamic `await import`):
```javascript
it('buildPodcastPrompt with length=brief includes the brief LENGTH_MAP modifier', async () => {
  const { buildPodcastPrompt } = await import('../../src/services/podcast-prompt.ts');
  const { system } = buildPodcastPrompt('- Concept A: summary', { length: 'brief', style: 'focused' });
  assert.match(system, /150 words/);
  assert.match(system, /you MUST mention every concept/i); // COVERAGE constraint
});
```

**Test enumeration pattern (3 × 4 matrix)** — mirror the for-loop in `ReviewScreen.anchor-empty-state.test.mjs:65-85`:
```javascript
for (const length of ['brief', 'standard', 'deep', 'extended']) {
  for (const style of ['focused', 'conversational', 'review']) {
    it(`buildPodcastPrompt(${length}, ${style}) includes coverage constraint + 5 sections`, () => {
      const { system } = buildPodcastPrompt('- X: y', { length, style });
      assert.match(system, /RECAP/);
      assert.match(system, /CONNECTIONS/);
      assert.match(system, /MISCONCEPTION/);
      assert.match(system, /RETRIEVAL QUESTIONS/);
      assert.match(system, /NEXT ACTION/);
      assert.match(system, /MUST mention every concept/i);
    });
  }
}
```

**Coverage-substring eval** — assert that given 5 concept lines, every concept name appears at least in the user-prompt half (substring check):
```javascript
const lines = ['Concept Alpha', 'Concept Beta', 'Concept Gamma'].map((c) => `- ${c}: summary`).join('\n');
const { user } = buildPodcastPrompt(lines, { length: 'brief', style: 'review' });
for (const name of ['Concept Alpha', 'Concept Beta', 'Concept Gamma']) {
  assert.ok(user.includes(name), `user prompt must include "${name}"`);
}
```

---

### `app/tests/services/podcast-options.test.mjs` (NEW — hash + cache invalidation)

**Analog:** `app/tests/services/classification-dedup.test.mjs:1-80`. Source-reading + structural invariants on the live `podcast.service.ts`.

**Hash determinism + key-permutation test** (no analog needed — direct unit test of `computeOptionsHash`):
```javascript
it('computeOptionsHash is deterministic across conceptId order', () => {
  const h1 = computeOptionsHash(['c1', 'c2', 'c3'], 'en', { length: 'standard', style: 'conversational' });
  const h2 = computeOptionsHash(['c3', 'c1', 'c2'], 'en', { length: 'standard', style: 'conversational' });
  assert.equal(h1, h2, 'conceptIds must be sorted before hashing');
});

it('computeOptionsHash changes when length changes', () => {
  const a = computeOptionsHash(['c1'], 'en', { length: 'standard', style: 'conversational' });
  const b = computeOptionsHash(['c1'], 'en', { length: 'deep', style: 'conversational' });
  assert.notEqual(a, b);
});
```

**Source-reading cache-invalidation invariants** — copy pattern from `classification-dedup.test.mjs:67-80`:
```javascript
const source = fs.readFileSync(
  new URL('../../src/services/podcast.service.ts', import.meta.url),
  'utf-8',
);

it('generatePodcast cache-skip includes optionsHash equality check', () => {
  // The skip condition at podcast.service.ts:155 must now also compare optionsHash.
  // Match the new shape: status === 'ready' && audioBlobUrls.has(...) && existing.optionsHash === ...
  assert.match(source, /existing\?\.status\s*===\s*['"]ready['"]/);
  assert.match(source, /audioBlobUrls\.has\(existing\.id\)/);
  assert.match(source, /existing\.optionsHash\s*===\s*computeOptionsHash\(/);
});

it('podcast.service imports buildPodcastPrompt + computeOptionsHash from podcast-prompt', () => {
  assert.match(
    source,
    /import\s*\{[^}]*buildPodcastPrompt[^}]*computeOptionsHash[^}]*\}\s*from\s*['"]\.\/podcast-prompt['"]/,
  );
});

it('generatePodcast signature accepts an optional third options param', () => {
  assert.match(
    source,
    /generatePodcast\(\s*date:\s*string,\s*conceptIds\?:\s*string\[\],\s*options\?:\s*PodcastOptions/,
  );
});
```

**Default-fallback invariant**:
```javascript
it('podcast.service falls back to {length:standard, style:conversational} when options undefined', () => {
  // Source-read: the resolveOptions/defaults block must contain the two literal fallbacks.
  assert.match(source, /['"]standard['"]/);
  assert.match(source, /['"]conversational['"]/);
});
```

---

### `app/tests/screens/PodcastScreen.options.test.mjs` (NEW — UI source-read)

**Analog:** `app/tests/screens/ReviewScreen.anchor-empty-state.test.mjs` (entire file, ~85 lines).

**Imports + locale loop pattern** (lines 15-29):
```javascript
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
```

**Source-read invariants for the chip selectors + dirty badge** (model from analog lines 30-62):
```javascript
describe('PodcastScreen length+style chips (Phase 52 PODCAST-02)', () => {
  it('renders chip selectors keyed by t("podcast.options.lengthLabel") and t("podcast.options.styleLabel")', () => {
    assert.match(source, /podcast\.options\.lengthLabel/);
    assert.match(source, /podcast\.options\.styleLabel/);
  });

  it('initializes chip state from settings.podcast.defaultLength ?? "standard"', () => {
    assert.match(source, /settings\.podcast\.defaultLength\s*\?\?\s*['"]standard['"]/);
    assert.match(source, /settings\.podcast\.defaultStyle\s*\?\?\s*['"]conversational['"]/);
  });

  it('passes selected options to generatePodcast', () => {
    // Match the generatePodcast(today(), ..., { length, style }) shape.
    assert.match(source, /generatePodcast\([^)]*\{\s*length[^}]*style[^}]*\}\)/);
  });

  it('renders Regenerate-with-new-options button only when selection !== cached optionsHash', () => {
    assert.match(source, /podcast\.options\.regenerateWithNew/);
  });

  it('renders cached-options badge using podcast.player.optionsBadge', () => {
    assert.match(source, /podcast\.player\.optionsBadge/);
  });

  it('wires playbackRate to audioRef.current.playbackRate for the 1x/1.5x/2x button', () => {
    assert.match(source, /audioRef\.current\.playbackRate\s*=/);
  });
});
```

**Locale-bundle parity check** — copy lines 65-85 of analog verbatim, swapping keys:
```javascript
describe('Locale bundles carry podcast.options.* keys (Phase 52 i18n)', () => {
  for (const { code, path } of LOCALE_PATHS) {
    it(`${code}.json defines podcast.options.{lengthLabel,brief,standard,deep,extended,styleLabel,focused,conversational,review,regenerateWithNew}`, () => {
      const bundle = JSON.parse(readFileSync(path, 'utf-8'));
      const opts = bundle?.podcast?.options;
      assert.ok(opts, `locales/${code}.json must define podcast.options namespace`);
      for (const k of ['lengthLabel','brief','standard','deep','extended','styleLabel','focused','conversational','review','regenerateWithNew']) {
        assert.ok(typeof opts[k] === 'string' && opts[k].trim().length > 0,
          `locales/${code}.json podcast.options.${k} must be non-empty string`);
      }
    });
  }
});
```

---

### `app/src/types/index.ts` (MODIFIED — additive optional fields)

**Analog:** the file itself — extend in place. Match exact placement (group near existing podcast section at line 187+).

**New type pattern** — after `PodcastStatus` declaration at line 202:
```typescript
export type PodcastLength = 'brief' | 'standard' | 'deep' | 'extended';
export type PodcastStyle = 'focused' | 'conversational' | 'review';

export interface PodcastOptions {
  length: PodcastLength;
  style: PodcastStyle;
}
```

**Additive optional fields on `DailyPodcast`** (line 187) — same shape as existing `audioDataUri?`, `duration?`:
```typescript
export interface DailyPodcast {
  id: string;
  date: string;
  questionIds: string[];
  script: string;
  audioPath?: string;
  audioDataUri?: string;
  duration?: number;
  status: PodcastStatus;
  progress?: number;
  error?: string;
  createdAt: number;
  options?: PodcastOptions;        // Phase 52 PODCAST-03
  optionsHash?: string;            // Phase 52 PODCAST-03 cache invalidation key
}
```

**Additive optional fields on `PodcastSettings`** (line 284):
```typescript
export interface PodcastSettings {
  sleepTime: string;
  advanceMinutes: number;
  autoGenerate: boolean;
  defaultLength?: PodcastLength;   // Phase 52 — undefined falls back to 'standard' at read time
  defaultStyle?: PodcastStyle;     // Phase 52 — undefined falls back to 'conversational' at read time
}
```

**Additive optional field on `TTSConfig`** (line 269):
```typescript
export interface TTSConfig {
  provider: 'openai' | 'gptsovits';
  apiKey?: string;
  baseUrl?: string;
  voice: string;
  speed: number;
  isConfigured: boolean;
  model?: string;                  // Phase 52 PODCAST-05 — default 'tts-1', opt-in 'tts-1-hd'
}
```

**Project-specific rule (CLAUDE.md + `feedback_no_normalize_for_optional_fields.md`):**
- No `normalize()` migration function.
- No boot-time defaulting.
- Existing localStorage settings load with these fields `undefined`. Read-site fallback is the entire migration strategy.

---

### `app/src/services/podcast.service.ts` (MODIFIED — signature, hash, cache key)

**Analog:** itself. Extend `generatePodcast` signature + cache-skip + add `addConceptToPodcast` invalidation parallel for options.

**Imports addition** (after existing line 8):
```typescript
import { synthesize } from '../providers/tts';
import { getCurrentLocale } from '../lib/i18n-leaf.ts';
import { buildPodcastPrompt, computeOptionsHash } from './podcast-prompt';
import type { PodcastOptions, SupportedLocale } from '../types';
```

**Signature change** (line 151):
```typescript
async generatePodcast(
  date: string,
  conceptIds?: string[],
  options?: PodcastOptions,
): Promise<ServiceResult<DailyPodcast>> {
  const settings = settingsService.getSync();
  const resolvedOptions: PodcastOptions = {
    length: options?.length ?? settings.podcast.defaultLength ?? 'standard',
    style: options?.style ?? settings.podcast.defaultStyle ?? 'conversational',
  };
  const locale = getCurrentLocale() as SupportedLocale;
  // ... resolve questions (existing code) ...
  const conceptIdList = questions.map((q) => q.id);
  const optionsHash = computeOptionsHash(conceptIdList, locale, resolvedOptions);
  const existing = loadStore().find((p) => p.date === date);

  // Cache skip — extend existing condition at line 155 with optionsHash equality
  if (
    existing?.status === 'ready' &&
    audioBlobUrls.has(existing.id) &&
    existing.optionsHash === optionsHash
  ) {
    return { success: true, data: existing };
  }
```

**Prompt assembly** — replace the inline literal at lines 203-211 with leaf-module call:
```typescript
const questionLines = questions.map((q) => `- ${q.content}: ${q.summary}`).join('\n');
const { system, user } = buildPodcastPrompt(questionLines, resolvedOptions);
script = await chatCompletion(
  [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ],
  settings.llm,
  { serviceName: 'podcast' },
);
```

**Persist options + optionsHash on the completed object** (extend lines 251-260):
```typescript
const completed: DailyPodcast = {
  id,
  date,
  questionIds: conceptIdList,
  script,
  status: 'ready',
  progress: 100,
  duration,
  createdAt: pod.createdAt,
  options: resolvedOptions,
  optionsHash,
};
```

**Duration estimation improvement** (line 234) — replace `script.length / 15`:
```typescript
const wordCount = script.trim().split(/\s+/).length;
duration = Math.round(wordCount / 2.5);  // ~150 wpm
```

**retryGeneration preserves options** (line 280) — pass through existing podcast's options:
```typescript
async retryGeneration(podcastId: string): Promise<ServiceResult<DailyPodcast>> {
  const pod = loadStore().find((p) => p.id === podcastId);
  if (!pod) return { success: false, error: { code: 'NOT_FOUND', message: 'Podcast not found', retryable: false } };
  return this.generatePodcast(pod.date, pod.questionIds, pod.options);
}
```

**`addConceptToPodcast` belt-and-suspenders** — current code at lines 320-340 already sets `status: 'pending'` + clears script, so the cache-skip check naturally fails. No changes needed there beyond eventual hash recomputation on next generate (R14 documented; D-05 confirmed).

---

### `app/src/screens/PodcastScreen.tsx` (MODIFIED — chip selectors, dirty badge, playback rate)

**Analog:** itself — extend in place. Chip-group pattern derived from research R10 + UI-SPEC. Playback-rate buttons mirror the existing seek-button shape at lines 537-548.

**`useState` initializer pattern** (one-shot at boot) — copy shape from `SettingsFeaturesScreen.tsx:19`:
```typescript
const [selectedLength, setSelectedLength] = useState<PodcastLength>(
  () => settingsService.getSync().podcast.defaultLength ?? 'standard',
);
const [selectedStyle, setSelectedStyle] = useState<PodcastStyle>(
  () => settingsService.getSync().podcast.defaultStyle ?? 'conversational',
);
const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
```

**Dirty-state derivation** (no useEffect — derived on render):
```typescript
const cachedOptions = selected?.options;
const cachedHash = selected?.optionsHash;
// recompute current hash with current chip selection + current locale
const currentHash = useMemo(
  () => computeOptionsHash(todayConcepts.map((c) => c.id), getCurrentLocale() as SupportedLocale, { length: selectedLength, style: selectedStyle }),
  [todayConcepts, selectedLength, selectedStyle],
);
const isDirty = !!cachedHash && cachedHash !== currentHash;
```

**Generate call site** (line 632) — pass options as third arg:
```typescript
<Button onClick={() => generatePodcast(today(), todayConcepts.map((c) => c.id), { length: selectedLength, style: selectedStyle })} fullWidth>
```

**Playback-rate button** — append below the play/seek button group at line 575. YouTube-style cycle (operator preference per Specifics + memory):
```typescript
<button
  onClick={() => {
    const next: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }}
  style={{
    minWidth: '44px', height: '44px', borderRadius: 'var(--radius-pill)',
    backgroundColor: 'transparent', color: 'var(--foreground)',
    border: '1px solid var(--border)',
    fontSize: '0.78rem', fontWeight: 600,
  }}
>
  {playbackRate}x
</button>
```

**Resync on `PODCAST_GENERATION_COMPLETED`** (CLAUDE.md no-refresh rule) — the existing `usePodcast` hook already subscribes to PODCAST_GENERATION_COMPLETED at `usePodcast.ts:47`. PodcastScreen reads `selected` from `podcasts` returned by the hook, so `selected.options` + `selected.optionsHash` are naturally reactive after the type addition. No new subscriber needed.

**Project-specific rules:**
- Inline styles with CSS variables (NOT Tailwind), matches existing PodcastScreen lines 519-611.
- iOS-style chip groups (UI-SPEC, Phase 49+50 convention). Selected chip: `var(--primary-40)` background. Unselected: `var(--surface-variant)`.
- All strings via `t('podcast.options.*')` — i18n bundles must land in same PR.

---

### `app/src/state/usePodcast.ts` (MODIFIED — pass-through)

**Analog:** itself. One-line type change + pass-through.

**Signature change** (line 13 + 80):
```typescript
generatePodcast: (date: string, conceptIds?: string[], options?: PodcastOptions) => Promise<void>;
// ...
const generatePodcast = useCallback(async (date: string, conceptIds?: string[], options?: PodcastOptions) => {
  setIsGenerating(true);
  setGenerationProgress(0);
  setError(null);
  const result = await podcastService.generatePodcast(date, conceptIds, options);
  // ... existing setPodcasts logic ...
}, []);
```

**Import addition** (line 2):
```typescript
import type { DailyPodcast, ServiceError, PodcastOptions } from '../types';
```

No other changes — event-bus subscriptions at lines 38-66 keep working since `e.payload` is a `DailyPodcast` which now carries `options`/`optionsHash`.

---

### `app/src/providers/tts/index.ts` (MODIFIED — un-hardcode model)

**Analog:** itself at line 54 — single-line literal replacement.

**Before** (line 54):
```typescript
body: JSON.stringify({
  model: 'tts-1',
  input: text,
  voice,
  speed: config.speed,
}),
```

**After**:
```typescript
body: JSON.stringify({
  model: config.model ?? 'tts-1',
  input: text,
  voice,
  speed: config.speed,
}),
```

**Project-specific rule (CLAUDE.md FILTER-03 / D-13 bracketing exemption preserved):** the comment block at lines 4-12 of tts/index.ts is load-bearing. Do NOT remove. Do NOT add the bracketing helper import — `tests/providers/tts-bracketing-exempt.test.mjs` enforces this.

---

### `app/src/services/scheduler.service.ts` (MODIFIED — default options pass-through)

**Analog:** itself at line 87.

**Before** (line 87):
```typescript
await podcastService.generatePodcast(today());
```

**After** (pull from settings — D-13):
```typescript
const defaultOptions: PodcastOptions = {
  length: settings.podcast.defaultLength ?? 'standard',
  style: settings.podcast.defaultStyle ?? 'conversational',
};
await podcastService.generatePodcast(today(), undefined, defaultOptions);
```

`settings` is already in scope (line 64). Type import addition:
```typescript
import type { PodcastOptions } from '../types';
```

**Project-specific rule (memory `project_serverless_no_background_tasks`):** scheduler runs only when app is open. D-13 inherits this constraint — auto-generation with defaults still requires the app to be foregrounded at sleepTime − advanceMinutes.

---

### `app/src/screens/settings/SettingsFeaturesScreen.tsx` (MODIFIED — 2 new SelectInput rows)

**Analog:** itself, Podcast section block at lines 53-88. Extend the existing `<Card>` containing autoGenerate / sleepTime / advanceMinutes with two new `<SettingRow>` rows BEFORE the save Button (line 67).

**Imports addition** (line 13) — add `SelectInput` to the existing import:
```typescript
import { SectionHeader, SettingRow, MaterialSwitch, TextInput, SelectInput, SUB_SCREEN_STYLE } from './SettingsShared';
```

**State addition** (after line 21):
```typescript
const [podcastDefaultLength, setPodcastDefaultLength] = useState<PodcastLength>(
  () => settingsService.getSync().podcast.defaultLength ?? 'standard',
);
const [podcastDefaultStyle, setPodcastDefaultStyle] = useState<PodcastStyle>(
  () => settingsService.getSync().podcast.defaultStyle ?? 'conversational',
);
```

**Row pattern** — copy verbatim shape from existing SettingsAIScreen voice SelectInput (lines 389-404):
```typescript
<SettingRow label={t('settings.fields.podcastDefaultLength')} description={t('settings.descriptions.podcastDefaultLength')}>
  <SelectInput
    value={podcastDefaultLength}
    onChange={(v) => setPodcastDefaultLength(v as PodcastLength)}
    options={[
      { value: 'brief', label: t('podcast.options.brief') },
      { value: 'standard', label: t('podcast.options.standard') },
      { value: 'deep', label: t('podcast.options.deep') },
      { value: 'extended', label: t('podcast.options.extended') },
    ]}
  />
</SettingRow>
<SettingRow label={t('settings.fields.podcastDefaultStyle')} description={t('settings.descriptions.podcastDefaultStyle')}>
  <SelectInput
    value={podcastDefaultStyle}
    onChange={(v) => setPodcastDefaultStyle(v as PodcastStyle)}
    options={[
      { value: 'focused', label: t('podcast.options.focused') },
      { value: 'conversational', label: t('podcast.options.conversational') },
      { value: 'review', label: t('podcast.options.review') },
    ]}
  />
</SettingRow>
```

**Save handler extension** — extend lines 71-82's `settingsService.set('podcast', { ... })` call:
```typescript
const result = await settingsService.set('podcast', {
  autoGenerate: podcastAutoGenerate,
  sleepTime: podcastSleepTime,
  advanceMinutes: Number.isNaN(parseInt(podcastAdvance)) ? 60 : parseInt(podcastAdvance),
  defaultLength: podcastDefaultLength,
  defaultStyle: podcastDefaultStyle,
});
```

---

### `app/src/screens/settings/SettingsAIScreen.tsx` (MODIFIED — TTS Model SelectInput)

**Analog:** itself, TTS voice SelectRow at lines 389-404.

**State addition** — colocate with existing `tts` state, no new useState needed; `tts.model` is already part of the extended TTSConfig.

**New row** — insert AFTER the voice SettingRow (line 404), BEFORE the Save button row (line 405):
```typescript
<SettingRow label={t('settings.fields.ttsModel')} description={t('settings.descriptions.ttsModel')}>
  <SelectInput
    value={tts.model ?? 'tts-1'}
    onChange={(v) => {
      const next = { ...tts, model: v };
      setTts(next);
      saveTts(next);
    }}
    options={[
      { value: 'tts-1', label: t('settings.fields.ttsModelStandard') },
      { value: 'tts-1-hd', label: t('settings.fields.ttsModelHd') },
    ]}
  />
</SettingRow>
```

**Conditional rendering rule (D-07):** Only show this row when `tts.provider === 'openai'` (gptsovits has no equivalent). Wrap in `{tts.provider === 'openai' && (...)}` matching lines 365-378 conditional pattern.

---

### `app/src/locales/{en,zh,es,ja}.json` (MODIFIED — additive keys)

**Analog:** `app/src/locales/en.json:618-673` (existing `podcast.*` namespace). Extend with new `podcast.options.*` sub-namespace + new `settings.fields/descriptions` keys.

**en.json additions to `podcast.*` namespace** (insert after line 671 `toast.audioUnavailable`):
```json
"options": {
  "lengthLabel": "Length",
  "brief": "Brief",
  "standard": "Standard",
  "deep": "Deep",
  "extended": "Extended",
  "styleLabel": "Style",
  "focused": "Focused",
  "conversational": "Conversational",
  "review": "Review Drill",
  "regenerateWithNew": "Regenerate with new options"
},
```

**en.json `podcast.player` additions** (extend existing player object at line 636):
```json
"optionsBadge": "Cached: {{length}} · {{style}}",
"playbackRateLabel": "Speed {{rate}}x"
```

**en.json `settings.fields` additions** (extend existing `fields` object — anchor near line 418 `sleepTime`):
```json
"podcastDefaultLength": "Default Podcast Length",
"podcastDefaultStyle": "Default Podcast Style",
"ttsModel": "TTS Model",
"ttsModelStandard": "Standard (tts-1)",
"ttsModelHd": "HD (tts-1-hd)",
```

**en.json `settings.descriptions` additions**:
```json
"podcastDefaultLength": "Length used when auto-generating",
"podcastDefaultStyle": "Style used when auto-generating",
"ttsModel": "Higher quality costs more; standard works on all OpenAI endpoints",
```

**Project-specific rules (CLAUDE.md §i18n Workflow):**
- All 4 bundles land in same PR — `tests/locales/bundle-parity.test.mjs` blocks merges where key sets diverge.
- en.json is canonical hand-authored; zh/es/ja generated by Sonnet subagent per `app/scripts/translate-locales.md`.
- Do NOT translate proper nouns: "tts-1", "tts-1-hd", "OpenAI" remain English in all 4 bundles.
- Human-review zh/es/ja for length (Spanish ~20% longer; Japanese chip labels need to fit narrow UI).

---

## Shared Patterns

### ServiceResult return shape
**Source:** existing `podcastService.generatePodcast` (line 151) — already `Promise<ServiceResult<DailyPodcast>>`.
**Apply to:** N/A (no new public service methods added; podcast-prompt.ts exports plain functions, not ServiceResult).

### Event-bus subscription pattern
**Source:** `app/src/state/usePodcast.ts:35-73` — `eventBus.subscribe('PODCAST_GENERATION_*', ...)` with cleanup return.
**Apply to:** No new subscriber needed. Existing `PODCAST_GENERATION_COMPLETED` carries the extended `DailyPodcast` payload, which PodcastScreen reads through the hook.

### Inline styles with CSS variables
**Source:** existing PodcastScreen, SettingsShared SettingRow, etc.
**Apply to:** all new UI (chip selectors, badge, playback-rate button). Required project convention (CLAUDE.md §Style Conventions).
```typescript
style={{
  backgroundColor: isSelected ? 'var(--primary-40)' : 'var(--surface-variant)',
  color: isSelected ? 'white' : 'var(--foreground)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-pill)',
  padding: '6px 12px',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
}}
```

### i18n translation lookup
**Source:** `PodcastScreen.tsx:22` — `const { t } = useTranslation();` for React components; `app/src/lib/i18n-leaf.ts` (`t(key)`) for non-React services + providers.
**Apply to:**
- PodcastScreen + Settings screens → `useTranslation` hook
- podcast.service.ts → leaf `t` from i18n-leaf if any user-visible strings (currently none; service emits toasts via the existing `toast(t('common.toast.*'), ...)` path)
- podcast-prompt.ts → NO i18n imports at all (leaf-module rule).

### Settings persistence
**Source:** `SettingsFeaturesScreen.tsx:71-82` — `await settingsService.set('podcast', { ... })`.
**Apply to:** new defaultLength/defaultStyle fields added to the existing podcast save block. Same for TTS model on SettingsAIScreen.

### Source-reading test invariant
**Source:** `tests/services/classification-dedup.test.mjs` + `tests/services/reorg-prompt-journal-injection.test.mjs` + `tests/screens/ReviewScreen.anchor-empty-state.test.mjs`.
**Apply to:** All 3 new test files. Read TypeScript source as text, assert literal-string or regex matches on imports / function signatures / prompt slices. This is the project canonical pattern for guarding load-bearing code shape without booting the full React/LLM stack.

### No-refresh re-read pattern
**Source:** CLAUDE.md §"Always-mounted screens must explicitly re-read service state on navigation" + memory `feedback_no_refresh_assumption.md`.
**Apply to:** PodcastScreen is a top-level swipe-tab slot (always-mounted). Chip selections + dirty badge derive from `usePodcast()`'s reactive `podcasts` array (already event-bus driven). No new useEffect re-reads required because `usePodcast` already subscribes to PODCAST_GENERATION_COMPLETED.

### Additive optional-field rule
**Source:** CLAUDE.md + memory `feedback_no_normalize_for_optional_fields.md`.
**Apply to:** All new `?:` fields on `DailyPodcast`, `PodcastSettings`, `TTSConfig`. No migration function, no normalize call, no boot-time defaulting. Read-site fallback only.

---

## No Analog Found

None — every file in scope has a direct in-place analog (existing files being extended) or a near-exact prior-art file in tests/services or tests/screens. All 14 files in scope are mapped.

---

## Metadata

**Analog search scope:**
- `app/src/services/` (podcast.service.ts, scheduler.service.ts, post-essay.service.ts, canonical-knowledge.service.ts)
- `app/src/screens/` (PodcastScreen.tsx, settings/SettingsFeaturesScreen.tsx, settings/SettingsAIScreen.tsx, settings/SettingsShared.tsx)
- `app/src/state/` (usePodcast.ts)
- `app/src/providers/tts/` (index.ts)
- `app/src/lib/` (i18n-leaf.ts — leaf-module exemplar)
- `app/src/types/index.ts` (additive type extensions)
- `app/src/locales/en.json` (canonical namespace shape)
- `app/tests/services/` (reorg-prompt-journal-injection, classification-dedup, post-essay.service, _actions-mock-podcast, _actions-mock-tts, _actions-mock-llm)
- `app/tests/screens/` (ReviewScreen.anchor-empty-state, SettingsScreen.api-keys)
- `app/tests/providers/` (tts-bracketing-exempt, tts-locale)
- `app/tests/locales/` (bundle-parity, missing-key)

**Files scanned:** 22

**Pattern extraction date:** 2026-05-19

---

## PATTERN MAPPING COMPLETE

**Phase:** 52 — podcast-quality-defaults-and-learner-controls
**Files classified:** 14 (3 new + 11 modified, locales × 4 counted as one surface)
**Analogs found:** 14 / 14

### Coverage
- Files with exact analog: 14
- Files with role-match analog: 0
- Files with no analog: 0

### Key Patterns Identified
- **Leaf-module discipline for `podcast-prompt.ts`** — pure prompt-string assembly, NO JSON / `lib/date` / `react-i18next` imports. Mirrors `app/src/lib/i18n-leaf.ts:1-26` header; same constraint enforced by `tests/locales/bundle-parity.test.mjs`.
- **Source-reading tests over behavioral tests** — all three new test files follow the `classification-dedup.test.mjs` / `reorg-prompt-journal-injection.test.mjs` / `ReviewScreen.anchor-empty-state.test.mjs` pattern: read source as text, assert literal substrings + regex on function signatures + prompt-slice positions. Cheaper than stubbing the LLM + IndexedDB + Audio stack.
- **Additive optional fields, no migration** — `options?`, `optionsHash?`, `defaultLength?`, `defaultStyle?`, `model?` all `?:`. Read-site fallback (`?? 'standard'`, `?? 'conversational'`, `?? 'tts-1'`) is the entire migration strategy. No `normalize()` function (operator rule + memory).
- **One event signal per semantic event** — reuse `PODCAST_GENERATION_*` events. No new event types. `DailyPodcast` payload carries `options`/`optionsHash` after type addition.
- **i18n bundle 4-locale parity in same PR** — `podcast.options.*` + `settings.fields/descriptions.*` additions land in en/zh/es/ja simultaneously. `bundle-parity.test.mjs` blocks merges where key sets diverge. en.json hand-authored; zh/es/ja via Sonnet subagent.
- **Settings sub-screen convention** — both new SelectInput rows mirror the existing voice SelectInput shape at `SettingsAIScreen.tsx:389-404`, using `SectionHeader` + `SettingRow` + `SelectInput` from `SettingsShared.tsx`.
- **iOS-style chip group + dirty-state inline badge** — UI-SPEC + memory `feedback_ios_gesture_for_spatial_ui.md`. Chips: tap = select, no long-press, no hidden gestures. Dirty badge: single line below player title, muted-foreground color, paired with explicit "Regenerate with new options" button — no modal confirm (D-04, D-12).

### File Created
`.planning/phases/52-podcast-quality-defaults-and-learner-controls/52-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns + project-specific rules in PLAN.md files.
