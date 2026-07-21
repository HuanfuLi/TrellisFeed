# Phase 3: Graph-memory + recommendation engine - Pattern Map

**Mapped:** 2026-07-17
**Files analyzed:** 19
**Analogs found:** 10 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tools/content_pipeline/schemas/global-edge.schema.json` | config | N/A | None | no-analog |
| `tools/content_pipeline/schemas/ranking-features.schema.json` | config | N/A | None | no-analog |
| `tools/content_pipeline/src/graph/build.ts` | script | transform | None | no-analog |
| `app/src/domain/graph.types.ts` | model | N/A | None | no-analog |
| `app/src/services/global-graph.repository.ts` | store | CRUD | `app/src/services/question.service.ts` | role-match |
| `app/src/services/graph-memory.service.ts` | service | event-driven | `app/src/services/canonical-knowledge.service.ts` | role-match |
| `app/src/services/question-extraction.service.ts` | service | async job | `app/src/services/canonical-knowledge.service.ts` | role-match |
| `app/src/services/recommendation-config.ts` | config | N/A | None | no-analog |
| `app/src/services/ranking/control-ranker.ts` | service | transform | `app/src/services/study-context.service.ts` | partial-match |
| `app/src/services/ranking/experimental-ranker.ts` | service | transform | `app/src/services/study-context.service.ts` | partial-match |
| `app/src/services/ranking/diversity-reranker.ts` | service | transform | None | no-analog |
| `app/src/services/recommendation.repository.ts` | store | CRUD | `app/src/services/question.service.ts` | role-match |
| `app/src/services/recommendation.service.ts` | service | event-driven | `app/src/services/interaction-log.service.ts` | partial-match |
| `app/tests/services/global-graph.repository.test.mjs` | test | testing | `app/tests/services/anchor-persistence.test.mjs` | exact |
| `app/tests/services/graph-memory.service.test.mjs` | test | testing | `app/tests/services/anchor-persistence.test.mjs` | exact |
| `app/tests/services/question-extraction.service.test.mjs` | test | testing | None | no-analog |
| `app/tests/services/ranking-components.test.mjs` | test | testing | None | no-analog |
| `app/tests/services/diversity-reranker.test.mjs` | test | testing | None | no-analog |
| `app/tests/services/recommendation.service.test.mjs` | test | testing | `app/tests/services/anchor-persistence.test.mjs` | exact |

## Pattern Assignments

### `app/src/services/graph-memory.service.ts` & `app/src/services/question-extraction.service.ts` (service, event-driven/async)

**Analog:** `app/src/services/canonical-knowledge.service.ts`

**Core Pattern (Embedding Pre-check and Async Execution)** (lines 618-639, 648-662):
```typescript
export async function preCheckAnchorMatch(
  question: Question,
  allQuestions: Question[],
): Promise<{ match: Question; similarity: number } | null> {
  const { settingsService } = await import('./settings.service.ts');
  const settings = settingsService.getSync();
  const embCfg = settings.embedding;
  if (!embCfg.isConfigured) return null;

  const embDebug = settings.embeddingDebug as
    | { debugEnabled?: boolean; anchorDedupThreshold?: number }
    | undefined;
  const activeAnchorThreshold = embDebug?.debugEnabled === true
    ? Math.min(0.85, Math.max(0.78, embDebug.anchorDedupThreshold ?? ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD))
    : ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD;

  // Resolve the query vector.
  let queryVec = question.embeddingVector;
  if (!queryVec || queryVec.length === 0) {
    try {
      queryVec = await embedText(question.content, embCfg);
    } catch (err) {
      console.warn('[QuestionTrace] pre-check query embedding failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }
  // ...
```

---

### `app/src/services/global-graph.repository.ts` & `app/src/services/recommendation.repository.ts` (store, CRUD)

**Analog:** `app/src/services/question.service.ts`

**Core Pattern (Write-through IndexedDB Persistence)** (lines 72-82, 684-692):
```typescript
function persistToSQLite(question: Question) {
  const embeddingBlob = question.embeddingVector && question.embeddingVector.length > 0
    ? vectorToBase64(question.embeddingVector)
    : null;
  const { embeddingVector: _dropped, ...rest } = question;
  void dbExecute('INSERT OR REPLACE INTO questions (id, data, embedding) VALUES (?, ?, ?)', [
    question.id,
    JSON.stringify(rest),
    embeddingBlob,
  ]);
}

  async function replaceAll(questions: Question[]): Promise<void> {
    const previous = loadStore({ includeFlagged: true });
    const nextIds = new Set(questions.map((q) => q.id));
    saveStore(questions);
    for (const q of previous) {
      if (!nextIds.has(q.id)) await deleteFromSQLite(q.id);
    }
    for (const q of questions) persistToSQLite(q);
  }
```

---

### `app/src/services/recommendation.service.ts` (service, event-driven / branching)

**Analog 1 (Condition Branching):** `app/src/services/study-context.service.ts`

**Core Pattern (Branch Point)** (lines 98-101):
```typescript
  getRequired(): ResearchIdentity {
    if (!identity) throw new Error('Research identity is not bound');
    return identity;
  },
```

**Analog 2 (Event Source):** `app/src/services/interaction-log.service.ts`

**Core Pattern (Idempotent Derived Contribution)** (lines 130-149):
```typescript
  async function record(
    eventType: InteractionEventType,
    fields: InteractionEventFields = {},
  ): Promise<UserInteractionEvent> {
    if (!Object.hasOwn(EVENT_FIELDS, eventType)) {
      throw new Error(`Interaction event type is not allowed: ${String(eventType)}`);
    }
    assertEventFields(fields, EVENT_FIELDS[eventType]);

    const identity = studyContextService.getRequired();
    const timestamp = dependencies.now();
    assertTimestamp(timestamp);
    const event: UserInteractionEvent = {
      id: dependencies.createId(),
      userId: identity.userId,
      condition: identity.condition,
      topicId: identity.topicId,
      timestamp,
      eventType,
      ...fields,
    };
    await storeAndEnqueue(event, 'event');
    return event;
  }
```

---

### Repository Tests (`app/tests/services/*.repository.test.mjs`, `graph-memory.service.test.mjs`, `recommendation.service.test.mjs`)

**Analog:** `app/tests/services/anchor-persistence.test.mjs`

**Core Pattern (Assert Durability Through dbQuery)** (lines 68-76):
```javascript
  it('insertNode writes the anchor through to durable storage', async () => {
    questionService.insertNode(anchor('anchor-2', 'Retrieval Practice'));
    await flushWrites();

    assert.ok(
      (await durableIds()).includes('anchor-2'),
      'anchor must be persisted, not only held in the in-memory mirror',
    );
  });
```

---

## Shared Patterns

### Database Access Seam
**Source:** `app/src/services/db.service.ts`
**Apply to:** All stores and repositories that persist state to IndexedDB.
```typescript
export async function dbExecute(sql: string, values?: (string | number | null)[]) {
  const db = await getDB();
  return db.execute(sql, values);
}

export async function dbQuery<T extends Row>(sql: string, values?: (string | number | null)[]): Promise<T[]> {
  const db = await getDB();
  return db.query<T>(sql, values);
}
```

### Event Bus Notification
**Source:** `app/src/lib/event-bus.ts`
**Apply to:** Async extraction and derived graph memory updates.
```typescript
eventBus.emit({
  type: 'GRAPH_UPDATED',
  payload: { kind: 'interaction', affectedIds: [conceptId] },
});
```

## D-12 Removal Set / Refactoring

The following files and their callers/tests must be removed or modified as they constitute the deprecated Phase 1 D-12 transitional recommendation shell:

- `app/src/services/concept-feed.service.ts`
- `app/src/services/post-queue.service.ts`
- `app/src/style-assignment.ts`
- `app/src/feed-spread.ts`
- `app/src/refill-mutex.ts`

**Affected Callers/Tests** (to be updated/removed):
- `App.tsx`, `components/InfoFlow.tsx`, `infiniteScroll.service.ts`, `engagement.service.ts`, `session.service.ts`
- Test files: `concept-feed.test.mjs`, `post-queue.test.mjs`, `refill-mutex.test.mjs`, `style-assignment.test.mjs`, `spread-by-concept.test.mjs`, etc.

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tools/content_pipeline/schemas/global-edge.schema.json` | config | N/A | Pipeline artifact, no direct `app/` analog |
| `tools/content_pipeline/schemas/ranking-features.schema.json` | config | N/A | Pipeline artifact, no direct `app/` analog |
| `tools/content_pipeline/src/graph/build.ts` | script | transform | Pipeline artifact |
| `app/src/domain/graph.types.ts` | model | N/A | Pure types |
| `app/src/services/recommendation-config.ts` | config | N/A | Pure configuration object |
| `app/src/services/ranking/diversity-reranker.ts` | service | transform | First stateful reranker in the project |
| `app/tests/services/question-extraction.service.test.mjs` | test | testing | Unique async retry behavior |
| `app/tests/services/ranking-components.test.mjs` | test | testing | Pure function tests without direct analogs |
| `app/tests/services/diversity-reranker.test.mjs` | test | testing | Pure function tests without direct analogs |

## Metadata

**Analog search scope:** `app/src/services/`, `app/tests/services/`, `app/src/lib/`
**Files scanned:** 7 analog files explicitly read from codebase context.
**Pattern extraction date:** 2026-07-17
