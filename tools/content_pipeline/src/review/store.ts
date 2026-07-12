import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CodexGateResult } from '../codex-gate/run.ts';
import type { NormalizedCandidate } from '../normalize/candidate.ts';
import type { PreprocessSuccess } from '../preprocess/run.ts';

export type ReviewDisposition = 'approved' | 'rejected' | 'needs-edit';
export type RightsReview = { status: 'cleared' | 'rejected' | 'missing'; reviewer: string; basis: string; notes: string };
export type ReviewDecisionInput = {
  disposition: ReviewDisposition; reviewer: string; notes: string; rubricVersion: string; editedContentHash: string;
  rightsReview: RightsReview; scores?: { quality: number; interestingness: number; educationalValue: number; difficulty: number };
  finalTopicTags?: string[]; review?: Record<string, string>;
};
export type ReviewDecision = ReviewDecisionInput & {
  candidateId: string; decidedAt: string; sequence: number; codexVerdictHash: string | null; operatorIsGateOfRecord: true;
};
export type ReviewCandidate = {
  id: string; source: NormalizedCandidate; preprocess: PreprocessSuccess; draft: any; codex: CodexGateResult;
  contentHash: string; codexCurrent: boolean; latestDecision?: ReviewDecision;
  reviewTemplate: Record<string, null>;
};

const REVIEW_FIELDS = [
  'sourceQuality', 'factualReliability', 'contentRelevance', 'hookAccuracy', 'summaryFaithfulness',
  'suggestedQuestionUsefulness', 'participantAppropriateness', 'duplicateRisk', 'biasRisk',
  'misinformationRisk', 'contentWarnings', 'rightsReview',
] as const;

function safeId(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) || value.includes('..')) throw new Error('invalid candidate id');
  return value;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  return JSON.stringify(value);
}

export const reviewContentHash = (sourceHash: string, draft: unknown): string => createHash('sha256').update(canonical({ sourceHash, draft }), 'utf8').digest('hex');

async function jsonFiles(directory: string): Promise<string[]> {
  try { return (await readdir(directory)).filter((name) => name.endsWith('.json')).sort(); }
  catch { return []; }
}

async function readJson(path: string): Promise<any> { return JSON.parse(await readFile(path, 'utf8')); }

async function readDecisions(runDir: string): Promise<ReviewDecision[]> {
  try { return (await readFile(join(runDir, 'review', 'decisions.jsonl'), 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
  catch { return []; }
}

export async function loadReviewQueue(runDir: string): Promise<ReviewCandidate[]> {
  const sources = new Map<string, NormalizedCandidate>();
  for (const name of await jsonFiles(join(runDir, 'normalized'))) {
    const source = await readJson(join(runDir, 'normalized', name));
    sources.set(source.id, source);
  }
  const decisions = await readDecisions(runDir);
  const output: ReviewCandidate[] = [];
  for (const name of await jsonFiles(join(runDir, 'preprocessed'))) {
    const preprocess: PreprocessSuccess = await readJson(join(runDir, 'preprocessed', name));
    if (preprocess.status !== 'preprocessed') continue;
    const source = sources.get(preprocess.candidateId);
    if (!source) continue;
    let draft = preprocess.draft;
    let contentHash = preprocess.candidateContentHash;
    try {
      const edit = await readJson(join(runDir, 'review', 'edits', `${safeId(preprocess.candidateId)}.json`));
      draft = edit.draft; contentHash = edit.contentHash;
    } catch { /* no operator edit */ }
    let codex: CodexGateResult;
    try { codex = await readJson(join(runDir, 'codex-review', `${preprocess.cacheKey}.json`)); }
    catch { codex = { status: 'blocked', reasonCode: 'missing_verdict', canAdvanceToHuman: false, requiresHumanApproval: true }; }
    const advisoryHash = codex.status === 'advisory-ready' ? codex.advisory.candidateContentHash : null;
    const candidateDecisions = decisions.filter((decision) => decision.candidateId === preprocess.candidateId);
    output.push({
      id: preprocess.candidateId, source, preprocess, draft, codex, contentHash,
      codexCurrent: codex.status === 'advisory-ready' && codex.canAdvanceToHuman && advisoryHash === contentHash,
      latestDecision: candidateDecisions.at(-1), reviewTemplate: Object.fromEntries(REVIEW_FIELDS.map((field) => [field, null])),
    });
  }
  return output.sort((a, b) => a.id.localeCompare(b.id));
}

export async function writeReviewEdit(runDir: string, candidate: ReviewCandidate, input: { draft: unknown; editor: string; notes: string }): Promise<{ contentHash: string }> {
  if (!input.editor.trim()) throw new Error('editor is required');
  if (!input.draft || typeof input.draft !== 'object') throw new Error('edited draft is required');
  const contentHash = reviewContentHash(candidate.source.contentHash, input.draft);
  const directory = join(runDir, 'review', 'edits');
  await mkdir(directory, { recursive: true });
  const destination = join(directory, `${safeId(candidate.id)}.json`);
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ candidateId: candidate.id, editor: input.editor.trim(), notes: input.notes, editedAt: new Date().toISOString(), contentHash, draft: input.draft }, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, destination);
  return { contentHash };
}

export async function writeReviewDecision(runDir: string, candidate: ReviewCandidate, input: ReviewDecisionInput): Promise<ReviewDecision> {
  if (!['approved', 'rejected', 'needs-edit'].includes(input.disposition)) throw new Error('invalid disposition');
  if (!input.reviewer?.trim() || !input.rubricVersion?.trim()) throw new Error('reviewer and rubric version are required');
  if (input.editedContentHash !== candidate.contentHash) throw new Error('decision content hash is stale');
  if (input.disposition === 'approved') {
    if (!candidate.codexCurrent) throw new Error('current advancing Codex verdict is required for approval');
    if (input.rightsReview?.status !== 'cleared' || !input.rightsReview.reviewer?.trim() || !input.rightsReview.basis?.trim()) throw new Error('cleared rights review is required for approval');
    const missing = REVIEW_FIELDS.filter((field) => field !== 'rightsReview' && !input.review?.[field]);
    if (missing.length) throw new Error(`review dimensions are incomplete: ${missing.join(', ')}`);
    if (!input.scores || Object.values(input.scores).some((score) => !Number.isFinite(score) || score < 0 || score > 1)) throw new Error('final review scores from 0 to 1 are required');
  }
  const prior = await readDecisions(runDir);
  const decision: ReviewDecision = {
    ...input, reviewer: input.reviewer.trim(), candidateId: candidate.id, decidedAt: new Date().toISOString(),
    sequence: prior.length + 1, codexVerdictHash: candidate.codex.status === 'advisory-ready' ? candidate.codex.advisory.candidateContentHash : null,
    operatorIsGateOfRecord: true,
  };
  const directory = join(runDir, 'review');
  await mkdir(directory, { recursive: true });
  await appendFile(join(directory, 'decisions.jsonl'), `${JSON.stringify(decision)}\n`, { encoding: 'utf8', flag: 'a' });
  return decision;
}
