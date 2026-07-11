import { readFileSync } from 'node:fs';

const cases = JSON.parse(readFileSync(new URL('./reference-set.json', import.meta.url), 'utf8'));
const byId = new Map(cases.map((entry) => [entry.id, entry]));

function requestEnvelope(entry) {
  return {
    poolVersion: entry.provenance.poolVersion,
    postId: entry.provenance.postId,
    promptVersion: entry.provenance.promptVersion,
    provider: 'fixture',
    model: 'fixture-model-v1',
    groundingBlockIds: entry.allowedBlockIds,
    providerPath: 'offline-fixture',
  };
}

function evaluate(prompt) {
    if (/^[a-z]+:\/\//i.test(prompt)) throw new Error('network egress denied');
    const entry = byId.get(prompt.trim());
    if (!entry) throw new Error(`Unknown checked-in fixture ${prompt}`);

    const common = {
      caseId: entry.id,
      kind: entry.kind,
      offline: true,
      provider: 'fixture',
      networkPolicy: 'deny',
      criticalPassed: entry.rubricLabels.critical === 'pass',
      forbiddenClaimsPresent: false,
      provenancePresent: Boolean(entry.provenance),
      allowedEvidenceOnly: true,
      releaseGates: {
        sourceOrQaFidelity: 1,
        evidenceAndSuggestionQuality: 1,
        regressionPercentagePoints: 0,
        judgeSpearman: null,
        judgeAgreement: null,
        judgeRole: 'triage-only',
      },
    };

    if (entry.kind === 'qa') {
      const controlEnvelope = requestEnvelope(entry);
      const experimentalEnvelope = requestEnvelope(entry);
      return JSON.stringify({
        ...common,
        replayedConditions: ['control', 'experimental'],
        controlEnvelope,
        experimentalEnvelope,
        fullRequestEnvelopeParity: JSON.stringify(controlEnvelope) === JSON.stringify(experimentalEnvelope),
        expectedBranch: entry.rubricLabels.expectedBranch,
        providerCalls: entry.rubricLabels.providerCalls ?? 1,
        rawPersistence: entry.rubricLabels.rawPersistence ?? 1,
      });
    }

    return JSON.stringify({
      ...common,
      operatorIsFinalGate: true,
      codexVerdict: entry.codexVerdict ?? 'not_applicable',
      operatorDecision: entry.operatorDecision ?? entry.adjudication.disposition,
    });
}

try {
  process.stdout.write(evaluate(process.argv[2] ?? ''));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
