import { runMasteryTests } from './mastery.test.js';
const output = document.getElementById('result'); output.textContent = '';
globalThis.srMasteryResults = await runMasteryTests(row => { output.textContent += `${row.pass ? 'PASS' : 'FAIL'} ${row.name}${row.error ? '\n' + row.error : ''}\n`; });
