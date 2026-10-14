import { runStudyTests } from './study.test.js';
const output = document.getElementById('results'); output.textContent = '';
globalThis.srStudyResults = await runStudyTests(row => { output.textContent += `${row.pass ? 'PASS' : 'FAIL'} ${row.name}${row.error ? '\n' + row.error : ''}\n`; });
