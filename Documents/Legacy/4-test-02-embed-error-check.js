const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', 'app/src/services/question.service.ts');
console.log('Checking embedText error handling in question.service.ts');
if (!fs.existsSync(file)) {
  console.error('FILE NOT FOUND:', file);
  process.exit(2);
}
const src = fs.readFileSync(file, 'utf8');
const swallowPattern = /embedText[\s\S]*?catch\s*\(.*?\)\s*\{\s*(?:\/\/.*)?\s*\}/m;
if (swallowPattern.test(src)) {
  console.error('POSSIBLE ERROR: embedText errors may be swallowed (found catch block with no logging)');
  process.exit(1);
}
console.log('No obvious swallowing pattern detected (manual review may still be required)');
process.exit(0);
