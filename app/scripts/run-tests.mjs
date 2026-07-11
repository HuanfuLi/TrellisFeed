import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function discover(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const candidate = join(directory, entry.name);
      if (entry.isDirectory()) return discover(candidate);
      return entry.name.endsWith('.test.mjs') ? [candidate] : [];
    })
    .sort((left, right) => left.localeCompare(right));
}

const result = spawnSync(
  process.execPath,
  ['--test', ...process.argv.slice(2), ...discover('tests')],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
