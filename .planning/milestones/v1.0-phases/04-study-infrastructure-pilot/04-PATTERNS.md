# Phase 4: Study infrastructure + pilot - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 15
**Analogs found:** 13 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/screens/OnboardingScreen.tsx` | component | request-response | `app/src/screens/OnboardingScreen.tsx` | exact |
| `app/src/services/research-consent.service.ts` | service | CRUD | `app/src/services/research-consent.service.ts` | exact |
| `app/src/services/recommendation-research.service.ts` | service | batch | `app/src/services/interaction-log.service.ts` | exact |
| `shared/research-wire-contract.v1.json` | config | schema | `shared/research-wire-contract.v1.json` | exact |
| `app/src/services/research-wire-contract.ts` | service | request-response | `app/src/services/research-wire-contract.ts` | exact |
| `app/src/services/upload-queue.service.ts` | service | event-driven | `app/src/services/upload-queue.service.ts` | exact |
| `app/src/types/research.ts` | type | schema | `app/src/types/index.ts` | exact |
| `app/src/locales/en.json` | config | config | `app/src/locales/en.json` | exact |
| `app/src/locales/zh.json` | config | config | `app/src/locales/zh.json` | exact |
| `app/src/locales/es.json` | config | config | `app/src/locales/es.json` | exact |
| `app/src/locales/ja.json` | config | config | `app/src/locales/ja.json` | exact |
| `research-backend/migrations/0004_recommendations.sql` | migration | CRUD | `research-backend/migrations/0001_init.sql` | exact |
| `research-backend/src/validation.ts` | utility | request-response | `research-backend/src/validation.ts` | exact |
| `research-backend/src/worker.ts` | controller | request-response | `research-backend/src/worker.ts` | exact |
| `research-backend/src/export.ts` | utility | file-I/O | `research-backend/src/export.ts` | exact |
| `research-backend/test/validation.test.mjs` | test | test | `research-backend/test/validation.test.mjs` | exact |
| `research-backend/test/ingest.test.mjs` | test | test | `research-backend/test/ingest.test.mjs` | exact |
| `research-backend/test/export.test.mjs` | test | test | `research-backend/test/export.test.mjs` | exact |

## Pattern Assignments

### `app/src/services/recommendation-research.service.ts` (service, batch)

**Analog:** `app/src/services/interaction-log.service.ts`

**Imports pattern** (lines 1-3):
```typescript
import { dbExecute, dbQuery } from './db.service.ts';
import { studyContextService } from './study-context.service.ts';
import { enqueue as enqueueUpload } from './upload-queue.service.ts';
```

**Core pattern** (lines 92-101, 142-150):
```typescript
async function persistRecord(
  record: UserInteractionEvent | QuestionAnswerRecord,
  kind: 'event' | 'qa',
): Promise<void> {
  const revision = 'revision' in record ? record.revision : 1;
  await dbExecute(
    'INSERT OR REPLACE INTO research_records (id, kind, revision, data) VALUES (?, ?, ?, ?)',
    [record.id, kind, revision, JSON.stringify(record)],
  );
}

  async function storeAndEnqueue(
    record: UserInteractionEvent | QuestionAnswerRecord,
    kind: 'event' | 'qa',
  ): Promise<boolean> {
    if (!hasAffirmativeResearchConsent()) return false;
    await persistRecord(record, kind);
    await dependencies.enqueue(record);
    return true;
  }
```

### `app/src/services/research-consent.service.ts` (service, CRUD)

**Analog:** `app/src/services/research-consent.service.ts`

**Core pattern** (lines 5-8):
```typescript
export function hasAffirmativeResearchConsent(): boolean {
  const { onboardingCompleted, aiConsentGiven } = settingsService.getSync().preferences;
  return onboardingCompleted === true && aiConsentGiven === true;
}
```

### `research-backend/src/worker.ts` (controller, request-response)

**Analog:** `research-backend/src/worker.ts`

**Imports pattern** (lines 1-3):
```typescript
import { MAX_REQUEST_BYTES, ValidationError, parseIngest } from './validation.ts';
import { renderStatusPage, requireAdminAuth } from './admin.ts';
import { buildExportZip } from './export.ts';
```

**Auth pattern** (lines 128-142):
```typescript
async function requireInstallAuth(request, db) {
  const token = bearerToken(request);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
// ... DB validation
  return { userId: row.user_id, condition: row.condition, topicId: row.topic_id };
}
```

**Core pattern (Ingest)** (lines 231-265):
```typescript
async function handleIngest(request, env) {
  const account = await requireInstallAuth(request, env.DB);
  if (!account) return json({ error: 'Unauthorized.' }, 401);
  const { body, byteLength } = await readBoundedJson(request);
  const records = parseIngest(body, byteLength);

  const receivedAt = new Date().toISOString();
  const eventStatements = [];
  // loop records, check conflicts, bind statements
  const statements = [...eventStatements];
  if (statements.length > 0) await env.DB.batch(statements);

  return json({ acknowledgedIds: [...new Set(records.map((record) => record.id))] });
}
```

### `research-backend/src/validation.ts` (utility, request-response)

**Analog:** `research-backend/src/validation.ts`

**Core pattern (Validation)** (lines 85-91):
```typescript
function assertAllowedFields(record, allowedFields, recordType) {
  for (const key of Object.keys(record)) {
    if (!allowedFields.has(key)) {
      throw new ValidationError(`${recordType} contains a disallowed field: ${key}.`);
    }
  }
}
```

### `research-backend/src/export.ts` (utility, file-I/O)

**Analog:** `research-backend/src/export.ts`

**Core pattern (Export)** (lines 51-57):
```typescript
export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  const lines = [columns.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvCell(row[column])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
```
**Core pattern (ZIP)** (lines 59-67):
```typescript
export function buildExportZip(
  events: Record<string, unknown>[],
  questionAnswers: Record<string, unknown>[],
) {
  return zipSync({
    'behavioral-events.csv': strToU8(toCsv(events, EVENT_COLUMNS)),
    'question-answer-records.csv': strToU8(toCsv(questionAnswers, QUESTION_ANSWER_COLUMNS)),
  });
}
```

### `app/src/screens/OnboardingScreen.tsx` (component, request-response)

**Analog:** `app/src/screens/OnboardingScreen.tsx`

**Core pattern (Consent State)** (lines 28-30):
```typescript
  const [step, setStep] = useState<Step>('welcome');
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
```

**Core pattern (Submit)** (lines 42-51):
```typescript
  const handleContinue = async () => {
    setIsSaving(true);
    await set('preferences', {
      theme: 'system',
      locale: selectedLocale,
      language: selectedLocale,   // legacy back-compat; matches locale
      onboardingCompleted: true,
      aiConsentGiven: true,
    });
```

### `app/src/services/research-wire-contract.ts` (service, schema)

**Analog:** `app/src/services/research-wire-contract.ts`

**Core pattern** (lines 93-96):
```typescript
export function toResearchWireRecord(record: LocalRecord): ResearchWireRecord {
  const { userId: _userId, condition: _condition, topicId: _topicId, ...wire } = record;
  const candidate = wire as Record<string, unknown>;
  assertString(candidate.id, RESEARCH_WIRE_LIMITS.id);
  // validation rules
```

## Shared Patterns

### Error Handling
**Source:** `research-backend/src/validation.ts`
**Apply to:** Backend ingest and validation
```typescript
export class ValidationError extends Error {
  status;
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}
```

### Database Operations
**Source:** `app/src/services/db.service.ts`
**Apply to:** `app/src/services/recommendation-research.service.ts`
```typescript
import { dbExecute, dbQuery } from './db.service.ts';
```

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `docs/pilot_protocol.md` | doc | protocol | Operator checklist format does not exist yet |
| `.planning/REQUIREMENTS.md` | doc | project-management | Document word changes |
| `.planning/ROADMAP.md` | doc | project-management | Document word changes |
| `.planning/PROJECT.md` | doc | project-management | Document word changes |

## Metadata

**Analog search scope:** `app/src/`, `research-backend/src/`
**Files scanned:** 15
**Pattern extraction date:** 2026-07-18
