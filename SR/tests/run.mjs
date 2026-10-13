import { runTests } from './suite.js';
const results = await runTests(result => console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}${result.error ? '\n' + result.error : ''}`));
const failed = results.filter(result => !result.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed. These tests are silent fakes, not audible G1 verification.`);
process.exitCode = failed ? 1 : 0;
