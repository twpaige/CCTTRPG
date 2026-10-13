import { runPersistenceTests, exampleBackup } from './persistence.test.js';
const results = await runPersistenceTests(result => {
  const item = document.createElement('li'); item.textContent = `${result.pass ? 'PASS' : 'FAIL'} ${result.name}${result.error ? '\n' + result.error : ''}`;
  document.getElementById('results').append(item);
});
globalThis.srPersistenceResults = results;
document.getElementById('result').textContent = `${results.filter(row => row.pass).length}/${results.length} passed. Phone and actual browser restart verification are separate.`;
const button = document.getElementById('example'); button.disabled = false;
button.onclick = async () => {
  button.disabled = true;
  try {
    const url = URL.createObjectURL(new Blob([await exampleBackup()], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'sr-synthetic-storage-test.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (error) { document.getElementById('result').textContent = error.message; }
  finally { button.disabled = false; }
};
