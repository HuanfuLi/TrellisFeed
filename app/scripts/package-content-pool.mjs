import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contentPoolPackageFail,
  packageContentPool,
  resolveSelectedPoolRoot,
} from './content-pool-package-contract.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const selectionPath = join(appRoot, 'content-pool.package.json');
let selection;
try {
  selection = JSON.parse(readFileSync(selectionPath, 'utf8'));
} catch {
  contentPoolPackageFail('content-pool.package.json is missing or invalid JSON');
}
if (!selection || typeof selection !== 'object' || Array.isArray(selection)
  || Object.keys(selection).length !== 1 || typeof selection.poolRoot !== 'string') {
  contentPoolPackageFail('content-pool.package.json must contain only poolRoot');
}

const result = packageContentPool({
  poolRoot: resolveSelectedPoolRoot({ appRoot, poolRoot: selection.poolRoot }),
  generatedRoot: join(appRoot, 'src/generated/content-pool-v1'),
  publicRoot: join(appRoot, 'public/content-pool-v1'),
  checkOnly: process.argv.includes('--check'),
});

console.log(
  `Packaged ${result.postCount} posts from ${result.contentPoolVersion} (${process.argv.includes('--check') ? 'verified' : 'generated'}).`,
);
