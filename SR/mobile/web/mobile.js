import { openDatabase } from './js/db.js';
import { exportSnapshot, contentKey } from './js/backup.js';
import { buildNativePlan, reconcileNative, prepareNativeSession, updatePreparedSession, sessionCall, playlistValidationKey } from './js/native-study.js';
import { INTERVAL_LABELS } from './js/scheduler.js';
import { planMastery, changeMastery } from './js/mastery.js';
import { readPreferences, savePreferences } from './preferences.js';
const $ = id => document.getElementById(id), native = window.SRNative;
let db, library, busy = false, polling = false, inventory = '', preparation = 0, preparing = false, saveMessage = '', saveTimer;
const preferences = readPreferences(localStorage);
const state = () => JSON.parse(native.status());
const option = (value, text) => new Option(text, value);
const yieldUI = () => new Promise(resolve => setTimeout(resolve, 0));
function settings() {
  for (const id of ['recall', 'rate', 'days']) if (!$(id).reportValidity() || $(id).value === '') throw new Error('Enter valid listening settings.');
  return { mode: $('mode').value, seriesId: $('series').value, window: { type: $('window').value, days: Number($('days').value) },
    random: $('random').checked, recall: Number($('recall').value), rate: Number($('rate').value), voiceName: $('voice').value };
}
function remember() { savePreferences(localStorage, settings()); }
function preview() {
  $('review-options').hidden = $('mode').value === 'AUDIT'; $('audit-note').hidden = !$('review-options').hidden;
  $('days').disabled = $('window').value !== 'days';
  $('session-summary').textContent = $('mode').value + ' · ' + ($('series').selectedOptions[0]?.textContent || 'ALL series') + ($('mode').value === 'AUDIT' ? '' : ' · ' + ($('window').value === 'days' ? 'Next ' + $('days').value + ' days' : $('window').selectedOptions[0].textContent));
  if (!library) return;
  try { const plan = buildNativePlan(library, { ...settings(), seriesId: $('series').value || undefined, streamed: true }); $('selection').textContent = new Set(plan.units.map(row => row.cardId)).size + ' cards · ' + plan.units.length + ' steps'; }
  catch (error) { $('selection').textContent = error.message; }
}
async function reload() {
  library = await exportSnapshot(db);
  const series = $('series').value || preferences.seriesId;
  $('series').replaceChildren(option('', 'ALL series'), ...library.series.map(row => option(row.id, row.name)));
  if (library.series.some(row => row.id === series)) $('series').value = series;
  preferences.seriesId = $('series').value;
  preview();
}
function notice() { clearTimeout(saveTimer); saveMessage = 'Saved'; saveTimer = setTimeout(() => { saveMessage = ''; render(); }, 2500); }
function render() {
  const s = state(), active = s.serviceRunning;
  $('platform').textContent = 'Android ' + s.android + ' · WebView ' + s.webview;
  const voices = JSON.stringify(s.voices);
  if (voices !== inventory) {
    inventory = voices; const selected = $('voice').value || preferences.voiceName;
    $('voice').replaceChildren(option('', 'Automatic offline English'), ...(s.voices || []).map(row => option(row.name, row.name + ' (' + row.language + ')')));
    if (selected && !(s.voices || []).some(row => row.name === selected)) $('voice').append(option(selected, selected + ' (not currently available)'));
    $('voice').value = selected;
  }
  $('voice-message').textContent = s.voiceMessage || '';
  $('settings').disabled = $('voice-settings').disabled = !db || busy || active;
  $('play').disabled = !db || busy || active;
  const paused = ['paused', 'error'].includes(s.status) && !s.autoResumePending;
  $('pause').textContent = paused ? 'RESUME' : 'PAUSE';
  $('pause').disabled = !active || (paused && (!s.ready || s.refreshRequired));
  for (const id of ['previous-fc', 'previous-step', 'next-step', 'skip']) $(id).disabled = busy || !active || !s.step || !s.ready || s.refreshRequired;
  $('previous-step').disabled ||= s.unit <= 1;
  $('previous-fc').disabled ||= (s.step?.cardNumber || 1) <= 1;
  $('stop').disabled = !active && !s.prepared && !busy;
  $('save-progress').disabled = busy || !db;
  for (const button of document.querySelectorAll('[data-level], [data-reset]')) {
    button.disabled = busy || !db || !active || !s.step || !s.ready || s.refreshRequired || s.status === 'error';
    if (button.dataset.level) button.setAttribute('aria-pressed', String(Number(button.dataset.level) === s.step?.mastery));
  }
  const label = s.status === 'paused' ? 'Paused' : preparing ? 'Preparing' : s.status === 'initializing' ? 'Preparing' : s.status === 'playing' ? 'Playing' : s.status === 'error' || $('error').textContent ? 'Error' : s.prepared ? 'Ready' : 'Stopped';
  $('status').textContent = (s.mode && s.mode !== 'STATUS' ? s.mode : $('mode').value) + ' · ' + label + (s.queuedCount ? ' · Saving ' + s.queuedCount + ' completed steps…' : saveMessage ? ' · ' + saveMessage : '');
  $('status').title = $('status').textContent;
  $('current').textContent = active && s.step ? 'Card ' + (s.step.cardNumber || 1) + '/' + (s.step.cardTotal || 1) + ' · Step ' + s.step.stepNumber + '/' + (s.step.stepTotal || s.step.stepNumber) + ' · ' + s.action : '';
  $('saved-mastery').textContent = active && s.step ? 'Current step · Mastery ' + s.step.mastery : 'Play a session to adjust its current step.';
  if (s.bridgeError) $('error').textContent = s.bridgeError;
  if (s.status === 'error') $('error').textContent = s.message || 'Playback error. Resume to retry or Stop.';
}
async function drain() {
  let total = 0;
  while (state().queuedCount) { const saved = await reconcileNative(db, native); if (!saved) throw new Error('Native progress is still pending. Retry saving.'); total += saved; await yieldUI(); }
  if (total) { await reload(); notice(); }
}
async function waitFor(predicate) { for (let i = 0; i < 100; i++) { if (predicate(state())) return; await new Promise(resolve => setTimeout(resolve, 50)); } throw new Error('Native control is still pending. Check playback and retry.'); }
async function run(action) { if (busy) return; busy = true; $('error').textContent = ''; render(); try { while (polling) await new Promise(resolve => setTimeout(resolve, 25)); await action(); } catch (error) { $('error').textContent = error.message; } finally { preparing = false; busy = false; render(); } }
async function startListening() {
  const generation = ++preparation, stopped = state().stopGeneration;
  const continuing = () => generation === preparation && state().stopGeneration === stopped;
  preparing = true; render(); await drain(); await reload(); remember();
  const options = { ...settings(), seriesId: $('series').value || undefined };
  let key;
  try { key = await playlistValidationKey(library, options); }
  catch (error) {
    if (continuing() && state().prepared) sessionCall(native, 'abort');
    if (continuing() && options.mode === 'REVIEW' && error.message.startsWith('No eligible REVIEW')) sessionCall(native, 'announce', JSON.stringify({ ...options, phrase: 'No reviews available.' }));
    throw error;
  }
  if (!continuing()) return;
  let valid = false;
  if (state().prepared) { const manifest = JSON.parse(sessionCall(native, 'manifest', '0')); valid = manifest.header.validationKey === key; }
  if (!valid) {
    if (state().prepared) sessionCall(native, 'abort');
    sessionCall(native, 'announce', JSON.stringify({ ...options, phrase: 'Preparing playlist.' }));
    await prepareNativeSession(library, { ...options, validationKey: key }, native, yieldUI, continuing);
  }
  // The preparation announcement shares the service's TTS/focus path; never overlap it with PLAY.
  while (state().serviceRunning && continuing()) {
    if (state().status === 'error') throw new Error(state().message || 'Status speech failed. Stop and retry.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (!continuing()) return;
  sessionCall(native, 'play');
  for (const id of ['session-panel', 'voice-panel']) $(id).open = false;
}
$('play').onclick = () => run(startListening);
$('stop').onclick = () => { preparation++; native.command('STOP'); if ($('confirmation').open) $('confirmation').close('cancel'); void run(async () => { await waitFor(s => !s.serviceRunning && !s.prepared); await drain(); }); };
$('pause').onclick = () => { $('error').textContent = ''; native.command(['paused', 'error'].includes(state().status) && !state().autoResumePending ? 'RESUME' : 'PAUSE'); render(); };
for (const [id, command] of [['previous-fc', 'PREVIOUS_FC'], ['previous-step', 'PREVIOUS_STEP'], ['next-step', 'NEXT_STEP'], ['skip', 'SKIP']]) $(id).onclick = () => { native.command(command); render(); };
$('refresh').onclick = () => native.refresh();
$('save-progress').onclick = () => run(drain);
$('data').onclick = event => { const s = state(); if (busy || s.prepared || s.serviceRunning || s.queuedCount) { event.preventDefault(); $('error').textContent = 'Stop playback and save pending progress before opening Data.'; } };
for (const id of ['mode', 'series', 'window', 'days', 'random', 'recall', 'rate', 'voice']) $(id).onchange = () => {
  preferences.seriesId = $('series').value; preferences.voiceName = $('voice').value;
  try { remember(); preview(); } catch (error) { $('error').textContent = 'Could not save listening settings: ' + error.message; }
};
function confirmAction(message) {
  $('confirmation-text').textContent = message; const dialog = $('confirmation'); dialog.returnValue = '';
  return new Promise(resolve => { dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }); dialog.showModal(); });
}
async function manual(type, level, before) {
  await waitFor(s => s.status === 'paused' || !s.serviceRunning);
  const paused = state();
  if (paused.sessionId !== before.sessionId || !paused.serviceRunning || paused.step?.stepId !== before.step?.stepId || paused.step?.cardId !== before.step?.cardId) throw new Error('Step changed while pausing. Choose again.');
  const control = paused.controlGeneration;
  const sameSession = () => { const s = state(); return s.serviceRunning && s.sessionId === paused.sessionId && s.controlGeneration === control; };
  sessionCall(native, 'edit', JSON.stringify({ sessionId: paused.sessionId, skipCard: type === 'resetCard' || type === 'resetObjective' }));
  await drain(); const snapshot = await exportSnapshot(db);
  const action = { type, cardId: before.step.cardId, stepId: before.step.stepId, level }, plan = planMastery(snapshot, action);
  if (plan.confirmation || level === 10) {
    const card = snapshot.flashcards.find(row => row.id === action.cardId);
    const scope = level === 10 && type === 'step' && card.steps.at(-1).id !== action.stepId ? 'Only this step becomes KNOWN. ' : '';
    const extra = level === 10 ? ' Excluded from normal REVIEW until explicitly lowered or reset. AUDIT remains available where applicable.' : '';
    if (!await confirmAction(scope + plan.message + extra)) {
      if (state().serviceRunning && state().sessionId === paused.sessionId) { sessionCall(native, 'cancelEdit', paused.sessionId); if (sameSession()) native.command('RESUME'); }
      return;
    }
  }
  if (!sameSession()) {
    if (state().serviceRunning && state().sessionId === paused.sessionId) sessionCall(native, 'cancelEdit', paused.sessionId);
    throw new Error('Playback was stopped or paused again. Mastery was not changed.');
  }
  await changeMastery(db, { action, expectedKey: contentKey(snapshot), confirmed: true }); await reload(); notice();
  if (!sameSession()) return;
  await updatePreparedSession(library, [...new Set(plan.members.map(([card]) => card))], native);
  if (sameSession() && !state().refreshRequired) native.command('RESUME');
}
function adjust(type, level) {
  if (busy || !state().step) return; const before = state();
  try { sessionCall(native, 'pause'); } catch (error) { $('error').textContent = error.message; return; }
  void run(() => manual(type, level, before));
}
$('levels').replaceChildren(...INTERVAL_LABELS.map((label, level) => {
  const button = document.createElement('button'); button.textContent = String(level); button.dataset.level = String(level);
  button.setAttribute('aria-label', level === 10 ? '10 — KNOWN, confirmation required' : level + ' — next review in ' + label);
  button.onclick = () => adjust('step', level); return button;
}));
for (const button of document.querySelectorAll('[data-reset]')) button.onclick = () => adjust(button.dataset.reset, 0);
async function tick() { if (!db || polling || document.hidden) return; if (busy) { render(); return; } polling = true; try { await drain(); render(); } catch (error) { $('error').textContent = 'Progress remains queued: ' + error.message; } finally { polling = false; } }
try {
  if (!native) throw new Error('Open this listening page inside the Android application.');
  $('mode').value = preferences.mode; $('window').value = preferences.window.type; $('days').value = preferences.window.days; $('random').checked = preferences.random;
  $('rate').value = preferences.rate; $('recall').value = preferences.recall;
  if (preferences.voiceName) { $('voice').append(option(preferences.voiceName, preferences.voiceName)); $('voice').value = preferences.voiceName; }
  db = await openDatabase({ onBlocked: message => { $('error').textContent = message; }, onVersionChange: message => { db = undefined; $('error').textContent = message; render(); } });
  await drain(); await reload(); render();
} catch (error) { $('error').textContent = error.message; }
const timer = setInterval(tick, 500); document.addEventListener('visibilitychange', tick);
window.addEventListener('pagehide', () => { preparation++; clearInterval(timer); clearTimeout(saveTimer); db?.close(); });
