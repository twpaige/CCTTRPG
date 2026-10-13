import { openDatabase } from '../js/db.js';
import { exportJSON, previewImport, restoreJSON, recoveryJSON, contentKey } from '../js/backup.js';
import { parseSnapshot } from '../js/validation.js';
const $ = id => document.getElementById(id);
const MAX_FILE = 32 * 1024 * 1024;
const native = window.SRNative;
let db, incoming, safety, busy = false, filePending = false, nativeTarget;
function error(reason) { $('error').textContent = reason.message || String(reason); }
function buttons() {
  for (const id of ['export', 'recovery', 'choose-import', 'choose-safety']) $(id).disabled = !db || busy || filePending;
  $('replace').disabled = !db || busy || filePending || !incoming || !safety || !$('confirm').checked;
}
function stopped() { if (native && JSON.parse(native.status()).serviceRunning) throw new Error('Stop native playback on the listening page before using Data.'); }
async function run(action) {
  busy = true; buttons(); $('error').textContent = '';
  try { stopped(); await action(); } catch (reason) { error(reason); }
  finally { busy = false; buttons(); }
}
async function refresh() {
  const { counts } = previewImport(await exportJSON(db));
  $('status').textContent = `Saved locally: ${counts.series} series, ${counts.flashcards} cards, ${counts.steps} steps, ${counts.presets} presets.`;
}
function save(json, label) {
  if (native) { filePending = true; buttons(); native.saveBackup(json); return; }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `sr-${label}-${new Date().toISOString().replaceAll(':', '-')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function select(json, target) {
  if (new Blob([json]).size > MAX_FILE) throw new Error('File exceeds the 32 MiB limit. No data was changed.');
  if (target === 'import') {
    const { counts } = previewImport(json); incoming = json;
    $('preview').textContent = `Replace with ${counts.series} series, ${counts.flashcards} cards, ${counts.steps} steps and ${counts.presets} presets (format 1). All current progress and settings will also be replaced.`;
    $('confirm').checked = false;
  } else {
    if (contentKey(parseSnapshot(json)) !== contentKey(parseSnapshot(await exportJSON(db)))) throw new Error('That file does not match the current library. Save and select a new backup.');
    safety = json; $('safety-status').textContent = 'Saved file reselected, validated, and matched to the current library.';
  }
}
for (const target of ['import', 'safety']) {
  $(`choose-${target}`).onclick = () => {
    if (target === 'import') { incoming = undefined; $('preview').textContent = 'No restore file selected.'; }
    else { safety = undefined; $('safety-status').textContent = 'No safety backup verified.'; }
    $('confirm').checked = false; buttons();
    if (native) { nativeTarget = target; filePending = true; buttons(); native.openBackup(); }
    else { $(`${target}-file`).value = ''; $(`${target}-file`).click(); }
  };
  $(`${target}-file`).onchange = () => run(async () => {
    const file = $(`${target}-file`).files[0]; if (!file) return;
    if (file.size > MAX_FILE) throw new Error('File exceeds the 32 MiB limit. No data was changed.');
    await select(await file.text(), target);
  });
}
window.addEventListener('sr-file-result', event => run(async () => {
  filePending = false;
  if (event.detail.error) throw new Error(event.detail.error);
  if (event.detail.json !== undefined) await select(event.detail.json, nativeTarget);
  if (event.detail.saved) $('status').textContent = 'Backup saved. Reselect it to verify before replacement.';
}));
$('export').onclick = () => run(async () => save(await exportJSON(db), 'backup'));
$('recovery').onclick = () => run(async () => save(await recoveryJSON(db), 'pre-import'));
$('confirm').onchange = buttons;
$('replace').onclick = () => run(async () => {
  await restoreJSON(db, incoming, { confirmed: $('confirm').checked, safetyJSON: safety });
  incoming = safety = undefined; $('confirm').checked = false;
  $('preview').textContent = 'Restore committed. Previous library is available with Save previous pre-import backup.';
  $('safety-status').textContent = 'A new safety backup is required for another restore.'; await refresh();
});
const link = document.createElement('a'); link.href = native ? '../index.html' : '../poc/speech.html'; link.textContent = 'Return to listening proof'; $('back').append(link);
try {
  const testName = new URLSearchParams(location.search).get('test');
  if (testName !== null && !/^SRLearning-test-[a-zA-Z0-9-]+$/.test(testName)) throw new Error('Invalid isolated test database name.');
  if (!native) {
    const editorLink = document.createElement('a');
    editorLink.href = '../index.html' + (testName ? `?test=${encodeURIComponent(testName)}` : '');
    editorLink.textContent = 'Return to library editor';
    $('back').prepend(editorLink, document.createTextNode(' · '));
  }
  if (testName) document.querySelector('h1').textContent = 'Data and recovery — disposable test library';
  db = await openDatabase({ name: testName || undefined, onBlocked: message => error(message), onVersionChange: message => { db = undefined; error(message); buttons(); } });
  await refresh();
} catch (reason) { error(reason); }
buttons();
window.addEventListener('pagehide', () => db?.close());
