import { openDatabase, acquirePlayback } from '../js/db.js';
import { exportJSON, previewImport, restoreJSON, contentKey } from '../js/backup.js';
import { reconcileNative } from '../js/native-study.js';
import { backupFilename, saveVerified } from './files.js';
const $ = id => document.getElementById(id), native = window.SRNative;
const MAX_FILE = 32 * 1024 * 1024;
let db, incoming, safety, backupName, source, release, busy = false, closed = false, pendingFile;
function buttons() {
  for (const id of ['export', 'choose-import']) $(id).disabled = !db || busy || !!incoming;
  $('destination').disabled = busy;
  $('confirm-import').disabled = busy;
  $('cancel-import').disabled = busy;
}
function reset() {
  incoming = safety = source = backupName = undefined;
  $('destination').hidden = true; $('confirmation').close();
  release?.(); release = undefined;
}
async function run(action) {
  if (busy || closed) return;
  busy = true; buttons(); $('error').textContent = '';
  try { await action(); }
  catch (reason) {
    reset();
    if (reason.name === 'AbortError') $('backup-status').textContent = 'Cancelled. The library was not replaced.';
    else $('error').textContent = reason.message || String(reason);
  } finally { busy = false; buttons(); }
}
function activeGuard() {
  if (closed) throw new Error('Data page closed. Import cancelled.');
  if (native && JSON.parse(native.status()).serviceRunning) throw new Error('Stop playback on the Listening page before using Data.');
}
async function reconcile() {
  activeGuard();
  if (!native) return;
  for (let n = 0; JSON.parse(native.status()).queuedCount && n < 16; n++) {
    if (!await reconcileNative(db, native)) break;
  }
  if (JSON.parse(native.status()).queuedCount) throw new Error('Completed steps could not be saved. Return to Listening and retry saving queued progress. No import occurred.');
  activeGuard();
}
function nativeFile(method, json) {
  return new Promise((resolve, reject) => { pendingFile = { resolve, reject }; native[method](json); });
}
window.addEventListener('sr-file-result', ({ detail }) => {
  if (!pendingFile) return;
  const { resolve, reject } = pendingFile; pendingFile = undefined;
  if (detail.cancelled) reject(new DOMException('Cancelled', 'AbortError'));
  else if (detail.error) reject(new Error(detail.error));
  else resolve(detail);
});
function savePicker() {
  if (!window.showSaveFilePicker) throw new Error('Verified backups require desktop Chrome on HTTPS or localhost. File access is unavailable; nothing was changed.');
  return window.showSaveFilePicker({ suggestedName: backupFilename(), ...(source ? { startIn: source } : {}),
    types: [{ description: 'JSON backup', accept: { 'application/json': ['.json'] } }] });
}
async function writeBackup(json, handle) {
  if (new Blob([json]).size > MAX_FILE) throw new Error('Backup exceeds 32 MiB. Nothing was replaced.');
  if (!native) return saveVerified(handle, json);
  const result = await nativeFile('saveBackup', json);
  if (!result.saved || !result.verified || !result.filename) throw new Error('Backup could not be verified. The library was not replaced.');
  return result.filename;
}
async function refresh() {
  const { counts } = previewImport(await exportJSON(db));
  $('status').textContent = `Saved locally: ${counts.series} series, ${counts.flashcards} cards, ${counts.steps} steps, ${counts.presets} presets.`;
}
const countText = counts => `${counts.series} series · ${counts.flashcards} flashcards · ${counts.steps} steps`;
async function backupAndConfirm(handle) {
  backupName = await writeBackup(safety, handle);
  activeGuard();
  if (native && JSON.parse(native.status()).queuedCount) throw new Error('New completed steps are pending. Restart import to include them in the backup.');
  if (contentKey(JSON.parse(safety)) !== contentKey(JSON.parse(await exportJSON(db)))) throw new Error('Library changed during backup. Restart import to save a current backup.');
  $('destination').hidden = true;
  $('counts').textContent = countText(previewImport(incoming).counts);
  $('backup-name').textContent = backupName;
  $('backup-status').textContent = 'Backup saved and read back successfully: ' + backupName;
  $('confirmation').showModal();
}
$('choose-import').onclick = () => run(async () => {
  $('preview').textContent = ''; $('backup-status').textContent = '';
  let json;
  if (native) { await reconcile(); json = (await nativeFile('openBackup')).json; }
  else {
    if (!window.showOpenFilePicker) throw new Error('Import requires desktop Chrome on HTTPS or localhost with file access.');
    [source] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'JSON library', accept: { 'application/json': ['.json'] } }] });
    const file = await source.getFile();
    if (file.size > MAX_FILE) throw new Error('File exceeds the 32 MiB limit.');
    json = await file.text();
  }
  if (typeof json !== 'string' || new Blob([json]).size > MAX_FILE) throw new Error('Invalid or oversized JSON file.');
  const { counts } = previewImport(json);
  $('preview').textContent = 'Incoming library: ' + countText(counts);
  activeGuard(); release = await acquirePlayback(db);
  await reconcile();
  safety = await exportJSON(db); incoming = json;
  $('backup-status').textContent = 'Save the automatic backup in the incoming file’s folder, or choose another destination explicitly. Replacement waits for successful read-back verification.';
  if (native) await backupAndConfirm();
  else $('destination').hidden = false; // A fresh click supplies Chrome’s required save-picker activation.
});
$('destination').onclick = () => run(async () => { const handle = await savePicker(); await backupAndConfirm(handle); });
$('export').onclick = () => run(async () => {
  const handle = native ? undefined : await savePicker();
  await reconcile();
  const name = await writeBackup(await exportJSON(db), handle);
  $('preview').textContent = 'Complete Backup Saved Successfully';
  $('backup-status').textContent = name + ' — written and read back successfully. Wait for OneDrive synchronization before using another device.';
});
function cancel() { if (busy) return; reset(); $('backup-status').textContent = 'Cancelled. The library was not replaced. Any verified external backup is retained.'; buttons(); }
$('cancel-import').onclick = cancel;
$('confirmation').addEventListener('cancel', event => { event.preventDefault(); cancel(); });
$('confirm-import').onclick = () => run(async () => {
  activeGuard();
  if (native && JSON.parse(native.status()).queuedCount) throw new Error('New completed steps are pending. Restart import to back them up before replacement.');
  const counts = previewImport(incoming).counts, name = backupName;
  await restoreJSON(db, incoming, { confirmed: true, safetyJSON: safety });
  reset(); await refresh();
  $('preview').textContent = 'Library Imported Successfully — ' + countText(counts);
  $('backup-status').textContent = 'The previous library was backed up successfully as: ' + name;
});
const link = document.createElement('a'); link.href = '../index.html'; link.textContent = native ? 'Return to Listening' : 'REVIEW / AUDIT player'; $('back').append(link);
try {
  const testName = new URLSearchParams(location.search).get('test');
  if (testName !== null && !/^SRLearning-test-[a-zA-Z0-9-]+$/.test(testName)) throw new Error('Invalid isolated test database name.');
  if (!native) {
    const editorLink = document.createElement('a'); editorLink.href = '../library.html' + (testName ? `?test=${encodeURIComponent(testName)}` : '');
    if (testName) link.href += `?test=${encodeURIComponent(testName)}`;
    editorLink.textContent = 'Return to library editor'; $('back').prepend(editorLink, document.createTextNode(' · '));
  }
  if (testName) document.querySelector('h1').textContent = 'Data and recovery — disposable test library';
  db = await openDatabase({ name: testName || undefined, onBlocked: message => { $('error').textContent = message; }, onVersionChange: message => { reset(); db = undefined; $('error').textContent = message; buttons(); } });
  await refresh();
} catch (reason) { $('error').textContent = reason.message; }
buttons();
window.addEventListener('pagehide', () => { closed = true; reset(); db?.close(); });
