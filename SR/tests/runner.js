import { runTests } from './suite.js';
try {
  const results = await runTests(result => {
    const item = document.createElement('li');
    item.textContent = `${result.pass ? 'PASS' : 'FAIL'}: ${result.name}${result.error ? '\n' + result.error : ''}`;
    document.getElementById('results').append(item);
  });
  const passed = results.filter(result => result.pass).length;
  document.getElementById('result').textContent = `${passed}/${results.length} passed. Audible G1 verification still required.`;
} catch (error) {
  document.getElementById('result').textContent = `Test harness error: ${error.message}`;
}
