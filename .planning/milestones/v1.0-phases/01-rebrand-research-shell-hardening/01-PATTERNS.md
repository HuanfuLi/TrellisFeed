# Phase 1: Rebrand + research shell hardening - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 14
**Analogs found:** 13 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/services/study-context.service.ts` | service | request-response | `app/src/services/settings.service.ts` | role-match |
| `app/src/services/interaction-log.service.ts` | service | event-driven | `app/src/services/post-history.service.ts` | role-match |
| `app/src/services/upload-queue.service.ts` | service | batch | `app/src/services/post-queue.service.ts` | role-match |
| `app/src/services/research-export.service.ts` | service | file-I/O | N/A | no analog |
| `app/src/services/research-config.ts` | config | request-response | `app/src/services/generation-config.ts` | exact |
| `app/src/screens/ResearchDiagnosticsScreen.tsx` | component | request-response | `app/src/screens/settings/SettingsDataScreen.tsx` | exact |
| `app/src/types/research.ts` | utility | request-response | `app/src/types/index.ts` | exact |
| `app/src/services/db.service.ts` | service | CRUD | `app/src/services/db.service.ts` | exact (modify) |
| `app/src/lib/event-bus.ts` | hook | event-driven | `app/src/lib/event-bus.ts` | exact (modify) |
| `app/src/App.tsx` | component | request-response | `app/src/App.tsx` | exact (modify) |
| `app/src/services/settings.service.ts` | service | request-response | `app/src/services/settings.service.ts` | exact (modify) |
| `app/src/services/canonical-knowledge.service.ts` | service | CRUD | `app/src/services/canonical-knowledge.service.ts` | exact (modify) |
| `app/src/services/daily-read.service.ts` | service | CRUD | `app/src/services/daily-read.service.ts` | exact (modify) |
| `app/src/screens/SettingsScreen.tsx` | component | request-response | `app/src/screens/SettingsScreen.tsx` | exact (modify) |

## Pattern Assignments

### `app/src/services/study-context.service.ts` (service, request-response)

**Analog:** `app/src/services/settings.service.ts`

**Imports pattern** (lines 1-3):
```typescript
import type { AppPreferences, AppSettings, ServiceResult, SupportedLocale } from '../types';

const STORAGE_KEY = 'trellis_settings';
```

**Core CRUD pattern (Sync Read, Async Set)** (lines 130-147):
```typescript
export const settingsService = {
  async getAll(): Promise<ServiceResult<AppSettings>> {
    return { success: true, data: load() };
  },

  async get<K extends keyof AppSettings>(key: K): Promise<ServiceResult<AppSettings[K]>> {
    const settings = load();
    return { success: true, data: settings[key] };
  },

  async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<ServiceResult<void>> {
    const settings = load();
    settings[key] = value;
    if (!save(settings)) {
      return { success: false, error: { code: 'DATABASE_ERROR', message: 'Storage quota exceeded. Free up space and try again.', retryable: false } };
    }
    return { success: true };
  },
```

---

### `app/src/services/interaction-log.service.ts` (service, event-driven)

**Analog:** `app/src/services/post-history.service.ts`

**Imports pattern** (lines 4-8):
```typescript
import type { DailyPost } from '../types/index.ts';
import { eventBus } from '../lib/event-bus.ts';
import { settingsService } from './settings.service.ts';
import { engagementService } from './engagement.service.ts';
import { dbExecute, dbQuery } from './db.service.ts';
```

**Core pattern (In-memory mirror + SQLite write-through)** (lines 23-30):
```typescript
function savePosts(posts: DailyPost[]): void {
  _store = posts;
  // IndexedDB write-through (D-09/D-12) — the durable store. Fire-and-forget so
  // a failed write does not block the sync mutator. Re-snapshot the whole table
  // each save (post-history is small + purge mutates the set, so a full
  // overwrite is the simplest correct shape).
  void persistAllToSQLite(posts);
}
```

---

### `app/src/services/upload-queue.service.ts` (service, batch)

**Analog:** `app/src/services/post-queue.service.ts`

**Core Batch Processing Pattern** (lines 296-302):
```typescript
  /** Remove and return the first `count` posts from the queue (FIFO). */
  dequeue(count: number): DailyPost[] {
    const items = _state.posts.splice(0, count);
    _state.totalServed += items.length;
    save(_state);
    return items;
  },
```

---

### `app/src/screens/ResearchDiagnosticsScreen.tsx` (component, request-response)

**Analog:** `app/src/screens/settings/SettingsDataScreen.tsx`

**Imports pattern** (lines 1-7):
```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Shield, Trash2, Download, Upload, RotateCcw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
```

**Settings Row Component Pattern** (lines 160-164):
```typescript
        <SettingRow
          label={t('settings.fields.aiDataTransmission')}
          description={t('settings.descriptions.aiConsentHint')}
        >
          <MaterialSwitch checked={aiConsent} onChange={() => void handleToggleAiConsent()} />
        </SettingRow>
```

---

### `app/src/services/research-config.ts` (config, request-response)

**Analog:** `app/src/services/generation-config.ts`

**Core Pattern (Pure Function)** (lines 18-20):
```typescript
export function resolveGenerationConfig(
  settings: AppSettings,
): { config: LLMConfig; disableThinking: boolean } {
```

---

### `app/src/types/research.ts` (utility, request-response)

**Analog:** `app/src/types/index.ts`

**Core interface definition pattern** (lines 68-71):
```typescript
/** Which provider takes priority when generating images. */
export type ImageProviderPrimary = 'nanoBanana' | 'gemini' | 'auto';

export interface ImageGenerationSettings {
```

---

## Shared Patterns

### Error Handling / SQLite Writes
**Source:** `app/src/services/post-history.service.ts`
**Apply to:** All services persisting to IndexedDB (`study-context.service.ts`, `interaction-log.service.ts`, `upload-queue.service.ts`)
```typescript
async function persistAllToSQLite(posts: DailyPost[]): Promise<void> {
  try {
    await dbExecute('BEGIN');
    await dbExecute('DELETE FROM post_history');
    for (const p of posts) {
      await dbExecute('INSERT OR REPLACE INTO post_history (id, data) VALUES (?, ?)', [p.id, JSON.stringify(p)]);
    }
    await dbExecute('COMMIT');
  } catch {
    try { await dbExecute('ROLLBACK'); } catch { /* ignore */ }
  }
}
```

### Read-only Mirror / Hydration
**Source:** `app/src/services/engagement.service.ts`
**Apply to:** All services loading at boot
```typescript
export async function hydrateEngagementFromSQLite(): Promise<void> {
  if (_hydratedEngagement) return;
  _hydratedEngagement = true;
  try {
// ... 
```

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/src/services/research-export.service.ts` | service | file-I/O | No existing zip/file export logic on the client; relies on new library or standard web APIs. |
| `research-backend/*` | worker | request-response | Entirely new Worker/D1 stack, outside Capacitor shell. |

## Metadata

**Analog search scope:** `app/src/services/`, `app/src/screens/`, `app/src/types/`
**Files scanned:** ~30
**Pattern extraction date:** 2026-07-10
