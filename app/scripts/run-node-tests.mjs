import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function discover(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? discover(path) : entry.name.endsWith('.test.mjs') ? [path] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...discover('tests')], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
