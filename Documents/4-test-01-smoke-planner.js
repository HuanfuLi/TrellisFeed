const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const targets = [
  'app/src/services/planner.service.ts',
  'app/src/screens/PlannerScreen.tsx',
  'app/src/services/graph.service.ts'
];

let ok = true;
console.log('Phase 4 smoke checks - Planner');
for (const rel of targets) {
  const p = path.join(repoRoot, rel);
  if (fs.existsSync(p)) {
    console.log(`FOUND: ${rel}`);
  } else {
    console.error(`MISSING: ${rel}`);
    ok = false;
  }
}
process.exit(ok ? 0 : 2);
