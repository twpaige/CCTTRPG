import { openDatabase } from '../js/db.js';
import { exportJSON, previewImport, restoreJSON, recoveryJSON, contentKey } from '../js/backup.js';
import { parseSnapshot, migrateSnapshot } from '../js/validation.js';
const $ = id => document.getElementById(id);
const MAX_FILE = 32 * 1024 * 1024;
const native = window.SRNative;
let db, incoming, safety, busy = false, filePending = false, nativeTarget, pendingSafety, backupName;
function error(reason) { $('error').textContent = reason.message || String(reason); }
function buttons() {
  for (const id of ['export', 'recovery', 'migration-backup', 'choose-import', 'choose-safety']) $(id).disabled = !db || busy || filePending;
  $('replace').disabled = !db || busy || filePending || !incoming || !safety || (!native && !$('confirm').checked);
}
function stopped() { if (native) { const state = JSON.parse(native.status()); if (state.serviceRunning || state.queuedCount) throw new Error('Return to Listening, Stop, and save queued progress before using Data.'); } }
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
  if (native) { nativeTarget = 'export'; filePending = true; buttons(); native.saveBackup(json); return; }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `sr-${label}-${new Date().toISOString().replaceAll(':', '-')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function select(json, target) {
  if (new Blob([json]).size > MAX_FILE) throw new Error('File exceeds the 32 MiB limit. No data was changed.');
  if (target === 'import') {
    const { counts, snapshot } = previewImport(json); incoming = json;
    $('preview').textContent = `Replace with ${counts.series} series, ${counts.flashcards} cards, ${counts.steps} steps and ${counts.presets} presets (format ${snapshot.formatVersion}). ${snapshot.formatVersion === 1 ? 'Card progress will be copied to every step; KNOWN has no due date. ' : ''}All current progress and settings will also be replaced.`;
    $('confirm').checked = false;
    if (native) await automaticBackup();
  } else {
    if (contentKey(migrateSnapshot(parseSnapshot(json))) !== contentKey(parseSnapshot(await exportJSON(db)))) throw new Error('That file does not match the current library. Save and select a new backup.');
    safety = json; $('safety-status').textContent = 'Saved file reselected, validated, and matched to the current library.';
  }
}
for (const target of ['import', 'safety']) {
  $(`choose-${target}`).onclick = () => {
    if (native && target === 'safety') { void run(automaticBackup); return; }
    if (native) { safety = pendingSafety = backupName = undefined; }
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
window.addEventListener('sr-file-result', event => { filePending = false; return run(async () => {
  if (event.detail.cancelled || event.detail.error) { if (nativeTarget === 'automatic-backup') safety = pendingSafety = undefined; if (event.detail.error) throw new Error(event.detail.error); $('safety-status').textContent = 'Cancelled. The local library was not replaced.'; return; }
  if (event.detail.json !== undefined) await select(event.detail.json, nativeTarget);
  if (event.detail.saved) {
    if (!event.detail.verified || !event.detail.filename) throw new Error('Backup could not be verified. Library was not replaced.');
    if (nativeTarget === 'automatic-backup') {
      if (!pendingSafety || contentKey(parseSnapshot(pendingSafety)) !== contentKey(parseSnapshot(await exportJSON(db)))) throw new Error('Library changed during backup. Save and verify a new backup before replacing.');
      safety = pendingSafety; pendingSafety = undefined; backupName = event.detail.filename;
      $('safety-status').textContent = 'Backup saved and read back successfully: ' + backupName + '. Confirm below to replace the current library and all review progress with the previewed file.';
    } else $('status').textContent = 'Backup saved and verified: ' + event.detail.filename + '. Wait for OneDrive synchronization before using it on another device.';
  }
}); });
$('export').onclick = () => run(async () => save(await exportJSON(db), 'backup'));
$('recovery').onclick = () => run(async () => save(await recoveryJSON(db), 'pre-import'));
$('migration-backup').onclick = () => run(async () => save(await recoveryJSON(db, 'pre-migration'), 'pre-migration'));
$('confirm').onchange = buttons;
$('replace').onclick = () => run(async () => {
  const counts = previewImport(incoming).counts, count = counts.flashcards;
  await restoreJSON(db, incoming, { confirmed: native ? true : $('confirm').checked, safetyJSON: safety });
  incoming = safety = undefined; $('confirm').checked = false;
  $('preview').textContent = `Restore Successful — ${count} Flashcards Imported. Restore committed. Previous library is available with Save previous pre-import backup.`;
  if (native) $('preview').textContent = `Library Restored Successfully — ${counts.series} series · ${counts.flashcards} flashcards · ${counts.steps} steps. The previous library was backed up as: ${backupName}`;
  $('safety-status').textContent = 'A new safety backup is required for another restore.'; await refresh();
});
async function automaticBackup() {
  stopped(); safety = pendingSafety = backupName = undefined;
  if (!incoming) throw new Error('Choose and validate the incoming JSON first.');
  previewImport(incoming);
  pendingSafety = await exportJSON(db);
  $('safety-status').textContent = 'Choose OneDrive or Downloads for the automatic timestamped backup. Replacement stays blocked until read-back verification succeeds.';
  nativeTarget = 'automatic-backup'; filePending = true; buttons(); native.saveBackup(pendingSafety);
}
if (native) {
  $('confirmation').hidden = true;
  $('choose-safety').textContent = 'Retry automatic backup';
  $('replace').textContent = 'Confirm replacement of library and review progress';
  $('instructions').replaceChildren(...['Choose the incoming JSON and check its counts.', 'Save the automatic timestamped backup in OneDrive or Downloads. SR reads it back to verify it.', 'Confirm replacement of your library and review progress.'].map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('export-note').textContent = 'Android reads each saved backup back and verifies its contents. No manual re-selection is needed.';
}
const link = document.createElement('a'); link.href = '../index.html'; link.textContent = native ? 'Return to Listening / save queued progress' : 'REVIEW / AUDIT player'; $('back').append(link);
try {
  const testName = new URLSearchParams(location.search).get('test');
  if (testName !== null && !/^SRLearning-test-[a-zA-Z0-9-]+$/.test(testName)) throw new Error('Invalid isolated test database name.');
  if (!native) {
    const editorLink = document.createElement('a');
    editorLink.href = '../library.html' + (testName ? `?test=${encodeURIComponent(testName)}` : '');
    if (testName) link.href += `?test=${encodeURIComponent(testName)}`;
    editorLink.textContent = 'Return to library editor';
    $('back').prepend(editorLink, document.createTextNode(' · '));
  }
  if (testName) document.querySelector('h1').textContent = 'Data and recovery — disposable test library';
  db = await openDatabase({ name: testName || undefined, onBlocked: message => error(message), onVersionChange: message => { db = undefined; error(message); buttons(); } });
  await refresh();
} catch (reason) { error(reason); }
buttons();
window.addEventListener('pagehide', () => db?.close());
