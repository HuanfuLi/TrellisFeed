import assert from 'node:assert/strict';
import test from 'node:test';

import { unzipSync } from 'fflate';

import worker from '../src/worker.ts';

function basicAuth(password) {
  return `Basic ${Buffer.from(`researcher:${password}`).toString('base64')}`;
}

function adminRequest(path, password) {
  const headers = password === undefined ? {} : { authorization: basicAuth(password) };
  return new Request(`https://collector.invalid${path}`, { headers });
}

function fakeAdminD1() {
  const queries = [];
  return {
    queries,
    prepare(sql) {
      queries.push(sql);
      return {
        async all() {
          if (sql.includes('COUNT(*) AS total FROM behavioral_events')) {
            return { results: [{ total: 2 }] };
          }
          if (sql.includes('COUNT(*) AS total FROM question_answer_records')) {
            return { results: [{ total: 1 }] };
          }
          if (sql.includes('MAX(received_at) AS last_received_at')) {
            return { results: [{ last_received_at: '2026-07-11T12:05:00.000Z' }] };
          }
          if (sql.includes('FROM behavioral_events')) return { results: [] };
          if (sql.includes('FROM question_answer_records')) return { results: [] };
          throw new Error(`Unexpected query: ${sql}`);
        },
      };
    },
  };
}

test('missing or incorrect Basic credentials cannot query an admin route', async () => {
  for (const path of ['/admin', '/admin/export.zip']) {
    for (const password of [undefined, 'incorrect-password']) {
      const db = fakeAdminD1();
      const response = await worker.fetch(adminRequest(path, password), {
        DB: db,
        RESEARCH_ADMIN_PASSWORD: 'correct-password',
      });

      assert.equal(response.status, 401);
      assert.equal(response.headers.get('www-authenticate'), 'Basic realm="QuestionTrace Research"');
      assert.equal(db.queries.length, 0);
    }
  }
});

test('correct Basic credentials receive a health-only HTML status page', async () => {
  const db = fakeAdminD1();
  const response = await worker.fetch(adminRequest('/admin', 'correct-password'), {
    DB: db,
    RESEARCH_ADMIN_PASSWORD: 'correct-password',
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.match(html, /Behavioral events<\/dt>\s*<dd>2<\/dd>/);
  assert.match(html, /Question\/answer records<\/dt>\s*<dd>1<\/dd>/);
  assert.match(html, /2026-07-11T12:05:00.000Z/);
});

test('the health page never renders participant-authored question HTML', async () => {
  const db = fakeAdminD1();
  db.latestQuestionText = '<script>alert("participant text")<\/script>';

  const response = await worker.fetch(adminRequest('/admin', 'correct-password'), {
    DB: db,
    RESEARCH_ADMIN_PASSWORD: 'correct-password',
  });
  const html = await response.text();

  assert.doesNotMatch(html, /<script>alert\("participant text"\)<\/script>/);
});

test('correct Basic credentials can download the cache-controlled two-file export', async () => {
  const db = fakeAdminD1();
  const response = await worker.fetch(adminRequest('/admin/export.zip', 'correct-password'), {
    DB: db,
    RESEARCH_ADMIN_PASSWORD: 'correct-password',
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/zip');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-disposition') ?? '', /^attachment;/);
  assert.deepEqual(Object.keys(unzipSync(new Uint8Array(await response.arrayBuffer()))).sort(), [
    'behavioral-events.csv',
    'question-answer-records.csv',
  ]);
});
