import { openDatabase } from './js/db.js';
import { exportSnapshot, contentKey } from './js/backup.js';
import { buildNativePlan, reconcileNative, prepareNativeSession, updatePreparedSession, sessionCall } from './js/native-study.js';
import { INTERVAL_LABELS } from './js/scheduler.js';
import { planMastery, changeMastery } from './js/mastery.js';
const $ = id => document.getElementById(id), native = window.SRNative;
let db, library, busy = false, polling = false, inventory = '', preparation = 0;
const state = () => JSON.parse(native.status());
const option = (value, text) => new Option(text, value);
const yieldUI = () => new Promise(resolve => setTimeout(resolve, 0));
function settings() {
  for (const id of ['recall', 'rate', 'days']) if (!$(id).reportValidity() || $(id).value === '') throw new Error('Enter valid listening settings.');
  return { mode: $('mode').value, seriesId: $('series').value || undefined, window: { type: $('window').value, days: Number($('days').value) },
    random: $('random').checked, recall: Number($('recall').value), rate: Number($('rate').value), voiceName: $('voice').value };
}
function preview() {
  $('review-options').hidden = $('mode').value === 'AUDIT'; $('audit-note').hidden = !$('review-options').hidden;
  $('days').disabled = $('window').value !== 'days';
  if (!library) return;
  try { const plan = buildNativePlan(library, { ...settings(), streamed: true }); $('selection').textContent = plan.mode + ': ' + new Set(plan.units.map(row => row.cardId)).size + ' cards, ' + plan.units.length + ' steps.'; }
  catch (error) { $('selection').textContent = error.message; }
}
function stepView() {
  const row = library?.stepProgress.find(row => row.flashcardId === $('card').value && row.stepId === $('step').value);
  $('saved-mastery').textContent = row ? 'Saved mastery ' + row.mastery + ' · ' + (row.nextDueAt === null ? 'KNOWN — no REVIEW due date' : 'Due ' + new Date(row.nextDueAt).toLocaleString()) : 'No steps selected.';
}
function cardView() {
  const selected = $('step').value, card = library?.flashcards.find(row => row.id === $('card').value);
  $('step').replaceChildren(...(card?.steps || []).map(row => option(row.id, 'Step ' + (row.position + 1) + ': ' + row.question.slice(0, 65))));
  if (card?.steps.some(row => row.id === selected)) $('step').value = selected;
  stepView();
}
async function reload() {
  library = await exportSnapshot(db);
  const series = $('series').value, card = $('card').value;
  $('series').replaceChildren(option('', 'ALL series'), ...library.series.map(row => option(row.id, row.name)));
  if (library.series.some(row => row.id === series)) $('series').value = series;
  $('card').replaceChildren(...library.flashcards.map(row => option(row.id, row.name)));
  if (library.flashcards.some(row => row.id === card)) $('card').value = card;
  cardView(); preview();
}
function render() {
  const s = state(), active = s.serviceRunning, prepared = s.prepared;
  $('platform').textContent = 'Android ' + s.android + '; WebView ' + s.webview;
  const voices = JSON.stringify(s.voices);
  if (voices !== inventory) { inventory = voices; const selected = $('voice').value; $('voice').replaceChildren(option('', 'Automatic offline English'), ...(s.voices || []).map(row => option(row.name, row.name + ' (' + row.language + ')'))); if ((s.voices || []).some(row => row.name === selected)) $('voice').value = selected; }
  $('voice-message').textContent = s.voiceMessage;
  $('settings').disabled = !db || busy || active || prepared;
  $('prepare').disabled = !db || busy || active || prepared || !!s.queuedCount;
  $('play').disabled = busy || active || !prepared || !!s.queuedCount;
  $('pause').disabled = !active;
  $('resume').disabled = busy || !active || !s.ready || !['paused', 'error'].includes(s.status) || s.refreshRequired;
  $('skip').disabled = busy || !active || !s.ready || s.refreshRequired;
  $('stop').disabled = !active && !prepared && !busy;
  $('save-progress').disabled = busy || !db;
  for (const id of ['card', 'step']) $(id).disabled = busy || active || prepared || !!s.queuedCount;
  for (const button of document.querySelectorAll('[data-level], [data-reset]')) button.disabled = busy || !db || !library?.flashcards.length || (prepared && !active) || (active && (!s.step || !s.ready || s.refreshRequired || s.status === 'error'));
  $('status').textContent = prepared && !active ? 'Ready — ' + s.preparedCount + ' steps. Press PLAY.' : (s.mode || $('mode').value) + ' · ' + s.status + ' · ' + (s.message || '') + (s.refreshRequired ? ' Session update pending. If an error occurred, Stop and PREPARE again.' : '');
  $('current').textContent = s.step && active ? s.card + ' · Step ' + s.step.stepNumber + ' · Mastery ' + s.step.mastery + ' · ' + s.action + ': ' + (s.text || '') : '';
  $('progress').textContent = s.queuedCount + ' completed steps awaiting save.';
  if (s.bridgeError) $('error').textContent = s.bridgeError;
  if (s.step && active) { const changed = $('card').value !== s.step.cardId || $('step').value !== s.step.stepId; if (changed) { $('card').value = s.step.cardId; cardView(); $('step').value = s.step.stepId; stepView(); } }
}
async function drain() {
  let total = 0;
  while (state().queuedCount) { const saved = await reconcileNative(db, native); if (!saved) throw new Error('Native progress is still pending. Retry saving.'); total += saved; await yieldUI(); }
  if (total) await reload();
}
async function waitFor(predicate) { for (let i = 0; i < 100; i++) { if (predicate(state())) return; await new Promise(resolve => setTimeout(resolve, 50)); } throw new Error('Native control is still pending. Retry after checking playback.'); }
async function run(action) { if (busy) return; busy = true; $('error').textContent = ''; render(); try { while (polling) await new Promise(resolve => setTimeout(resolve, 25)); await action(); } catch (error) { $('error').textContent = error.message; } finally { busy = false; render(); } }
$('prepare').onclick = () => { const generation = ++preparation; void run(async () => { await drain(); await reload(); $('status').textContent = 'Preparing all session material…'; await prepareNativeSession(library, settings(), native, yieldUI, () => generation === preparation); }); };
$('play').onclick = () => run(() => sessionCall(native, 'play'));
$('stop').onclick = () => { preparation++; native.command('STOP'); if ($('confirmation').open) $('confirmation').close('cancel'); void run(async () => { await waitFor(s => !s.serviceRunning && !s.prepared); await drain(); }); };
for (const id of ['pause', 'resume', 'skip']) $(id).onclick = () => { native.command(id.toUpperCase()); render(); };
$('refresh').onclick = () => native.refresh();
$('save-progress').onclick = () => run(drain);
$('data').onclick = event => { const s = state(); if (busy || s.prepared || s.serviceRunning || s.queuedCount) { event.preventDefault(); $('error').textContent = 'Stop the prepared session and save queued progress before opening Data.'; } };
for (const id of ['mode', 'series', 'window', 'days', 'random', 'recall', 'rate']) $(id).onchange = preview;
$('card').onchange = cardView; $('step').onchange = stepView;
function confirmAction(message) {
  $('confirmation-text').textContent = message;
  const dialog = $('confirmation'); dialog.returnValue = '';
  return new Promise(resolve => { dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }); dialog.showModal(); });
}
async function manual(type, level, before) {
  if (before.serviceRunning) await waitFor(s => s.status === 'paused' || !s.serviceRunning);
  const paused = state();
  if (before.serviceRunning && (paused.sessionId !== before.sessionId || !paused.serviceRunning || paused.step?.stepId !== before.step?.stepId || paused.step?.cardId !== before.step?.cardId)) throw new Error('Step changed while pausing. Check the current step and choose again.');
  const control = paused.controlGeneration;
  const sameSession = () => { const s = state(); return s.serviceRunning && s.sessionId === paused.sessionId && s.controlGeneration === control; };
  if (before.serviceRunning) sessionCall(native, 'edit', JSON.stringify({ sessionId: paused.sessionId, skipCard: type === 'resetCard' || type === 'resetObjective' }));
  await drain();
  const snapshot = await exportSnapshot(db);
  const action = { type, cardId: before.serviceRunning ? before.step.cardId : $('card').value, stepId: before.serviceRunning ? before.step.stepId : $('step').value, level };
  const plan = planMastery(snapshot, action);
  if (plan.confirmation || level === 10) {
    const card = snapshot.flashcards.find(row => row.id === action.cardId);
    const scope = level === 10 && type === 'step' && card.steps.at(-1).id !== action.stepId ? 'Only this step becomes KNOWN. ' : '';
    const extra = level === 10 ? ' This material stays out of normal REVIEW until explicitly lowered or reset. AUDIT remains available where applicable.' : '';
    if (!await confirmAction(scope + plan.message + extra)) {
      if (before.serviceRunning && state().serviceRunning && state().sessionId === paused.sessionId) {
        sessionCall(native, 'cancelEdit', paused.sessionId);
        if (sameSession()) native.command('RESUME');
      }
      return;
    }
  }
  if (before.serviceRunning) {
    if (!sameSession()) {
      if (state().serviceRunning && state().sessionId === paused.sessionId) sessionCall(native, 'cancelEdit', paused.sessionId);
      throw new Error('Playback was stopped or paused again. Mastery was not changed.');
    }
  }
  await changeMastery(db, { action, expectedKey: contentKey(snapshot), confirmed: true });
  await reload();
  if (before.serviceRunning) {
    if (!sameSession()) return;
    await updatePreparedSession(library, [...new Set(plan.members.map(([card]) => card))], native);
    if (sameSession() && !state().refreshRequired) native.command('RESUME');
  }
}
function adjust(type, level) {
  if (busy) return;
  const before = state();
  if (before.serviceRunning) { try { sessionCall(native, 'pause'); } catch (error) { $('error').textContent = error.message; return; } }
  void run(() => manual(type, level, before));
}
$('levels').replaceChildren(...INTERVAL_LABELS.map((label, level) => {
  const button = document.createElement('button'); button.textContent = String(level); button.dataset.level = String(level);
  button.title = level === 10 ? 'KNOWN — confirmation required' : 'Next review in ' + label;
  button.onclick = () => adjust('step', level); return button;
}));
for (const button of document.querySelectorAll('[data-reset]')) button.onclick = () => adjust(button.dataset.reset, 0);
async function tick() { if (!db || busy || polling || document.hidden) return; polling = true; try { await drain(); render(); } catch (error) { $('error').textContent = 'Progress remains queued: ' + error.message; } finally { polling = false; } }
try {
  if (!native) throw new Error('Open this listening page inside the Android application.');
  db = await openDatabase({ onBlocked: message => { $('error').textContent = message; }, onVersionChange: message => { db = undefined; $('error').textContent = message; render(); } });
  await drain(); await reload(); render();
} catch (error) { $('error').textContent = error.message; }
const timer = setInterval(tick, 1500); document.addEventListener('visibilitychange', tick);
window.addEventListener('pagehide', () => { clearInterval(timer); db?.close(); });
