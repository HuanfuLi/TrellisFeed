import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('Node env-file contract loads a local credential without putting it in argv', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'questiontrace-env-'));
  const envFile = join(directory, '.env.local');
  await writeFile(envFile, 'GEMINI_API_KEY=fixture-local-key\n');

  const args = [
    `--env-file=${envFile}`,
    '-e',
    'process.stdout.write(process.env.GEMINI_API_KEY ?? "")',
  ];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: {} });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'fixture-local-key');
  assert.equal(result.stderr, '');
  assert.equal(args.some((argument) => argument.includes('fixture-local-key')), false);
});
