const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', 'app/src/services/graph.service.ts');
console.log('Checking for Jaccard pre-filter in graph.service.ts');
if (!fs.existsSync(file)) {
  console.error('FILE NOT FOUND:', file);
  process.exit(2);
}
const src = fs.readFileSync(file, 'utf8');
if (/jaccard/i.test(src) || /jaccardPre/i.test(src)) {
  console.log('FOUND: Jaccard pre-filter usage detected');
  process.exit(0);
}
if (/cosine/i.test(src) && !/jaccard/i.test(src)) {
  console.warn('WARNING: cosine similarity present but no jaccard pre-filter detected');
  process.exit(1);
}
console.log('No similarity computations detected (manual review may be required)');
process.exit(0);
