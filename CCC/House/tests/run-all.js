/**
 * run-all.js — runs every *.test.js in this directory, in a fresh process
 * each, and exits non-zero if any of them fails.
 *
 *   npm test          # these suites
 *   npm run verify    # compile + smoke test, run before every deploy
 *   npm run check     # both
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const suites = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
const failed = [];

for (const f of suites) {
  console.log('\n' + '═'.repeat(70) + '\n  ' + f + '\n' + '═'.repeat(70));
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(f);
}

console.log('\n' + '─'.repeat(70));
if (failed.length) {
  console.log(`${suites.length - failed.length}/${suites.length} suites passed. Failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`${suites.length}/${suites.length} suites passed.`);
