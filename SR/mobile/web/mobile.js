import { openDatabase } from './js/db.js';
import { exportSnapshot, contentKey } from './js/backup.js';
import { buildNativePlan, reconcileNative } from './js/native-study.js';
import { INTERVAL_LABELS } from './js/scheduler.js';
import { planMastery, changeMastery } from './js/mastery.js';
const $ = id => document.getElementById(id), native = window.SRNative;
let db, library, busy = false, polling = false, inventory = '', lastOptions, levelDirty = false;
const state = () => JSON.parse(native.status());
const option = (value, text) => new Option(text, value);
function settings() {
  for (const id of ['recall', 'rate', 'days']) if (!$(id).reportValidity() || $(id).value === '') throw new Error('Enter valid listening settings.');
  return { mode: $('mode').value, seriesId: $('series').value || undefined, window: { type: $('window').value, days: Number($('days').value) },
    random: $('random').checked, recall: Number($('recall').value), rate: Number($('rate').value), voiceName: $('voice').value };
}
function preview() {
  $('review-options').hidden = $('mode').value === 'AUDIT'; $('audit-note').hidden = !$('review-options').hidden;
  $('days').disabled = $('window').value !== 'days';
  if (!library) return;
  try { const plan = buildNativePlan(library, settings()); $('selection').textContent = `${plan.mode}: ${new Set(plan.units.map(row => row.cardId)).size} cards, ${plan.units.length} steps.`; }
  catch (error) { $('selection').textContent = error.message; }
}
function stepView() {
  levelDirty = false;
  const row = library?.stepProgress.find(row => row.flashcardId === $('card').value && row.stepId === $('step').value);
  $('saved-mastery').textContent = row ? `Saved mastery ${row.mastery} · ${row.nextDueAt === null ? 'KNOWN — no REVIEW due date' : 'Due ' + new Date(row.nextDueAt).toLocaleString()}` : 'No steps selected.';
  if (row) $('level').value = String(row.mastery); feedback();
}
function cardView() {
  const selected = $('step').value, card = library?.flashcards.find(row => row.id === $('card').value);
  $('step').replaceChildren(...(card?.steps || []).map(row => option(row.id, `Step ${row.position + 1}: ${row.question.slice(0, 65)}`)));
  if (card?.steps.some(row => row.id === selected)) $('step').value = selected;
  stepView();
}
async function reload() {
  const selectedStep = $('step').value, selectedLevel = $('level').value, preserveLevel = levelDirty;
  library = await exportSnapshot(db);
  const series = $('series').value, card = $('card').value;
  $('series').replaceChildren(option('', 'ALL series'), ...library.series.map(row => option(row.id, row.name)));
  if (library.series.some(row => row.id === series)) $('series').value = series;
  $('card').replaceChildren(...library.flashcards.map(row => option(row.id, row.name)));
  if (library.flashcards.some(row => row.id === card)) $('card').value = card;
  cardView();
  if (preserveLevel && $('card').value === card && $('step').value === selectedStep) { $('level').value = selectedLevel; levelDirty = true; feedback(); }
  preview();
}
function feedback() { const level = Number($('level').value); $('interval').textContent = level === 10 ? 'KNOWN — excluded from REVIEW, available through AUDIT.' : `Mastery ${level} — Next review in ${INTERVAL_LABELS[level]}.`; }
function render() {
  const s = state(), active = s.serviceRunning;
  $('platform').textContent = `Android ${s.android}; WebView ${s.webview}`;
  const voices = JSON.stringify(s.voices);
  if (voices !== inventory) { inventory = voices; const selected = $('voice').value; $('voice').replaceChildren(option('', 'Automatic offline English'), ...(s.voices || []).map(row => option(row.name, `${row.name} (${row.language})`))); if ((s.voices || []).some(row => row.name === selected)) $('voice').value = selected; }
  $('voice-message').textContent = s.voiceMessage;
  $('settings').disabled = !db || busy || active;
  $('start').disabled = !db || busy || active || !!s.queuedCount;
  for (const id of ['pause', 'resume', 'skip', 'stop']) $(id).disabled = busy || !active;
  $('stop').disabled = !active;
  $('pause').disabled ||= !['playing', 'initializing'].includes(s.status);
  $('resume').disabled ||= !s.ready || !['paused', 'error'].includes(s.status) || s.refreshRequired;
  $('skip').disabled ||= !s.ready || s.refreshRequired;
  $('restart').disabled = busy || !lastOptions;
  $('save-progress').disabled = busy || !db;
  for (const id of ['card', 'step', 'apply']) $(id).disabled = busy || active || !!s.queuedCount || !library?.flashcards.length;
  $('queue').disabled = busy || !active || !s.step || s.refreshRequired || !s.occurrenceId;
  for (const id of ['known', 'reset-card', 'reset-final', 'reset-objective']) $(id).disabled = busy || !library?.flashcards.length || (active && (!s.step || s.refreshRequired));
  $('status').textContent = `${s.mode || $('mode').value} · ${s.status} · ${s.message || ''}${s.refreshRequired ? ' Mastery saved or queued: Stop, then Start a fresh session.' : ''}`;
  $('current').textContent = s.step ? `${s.card} · Step ${s.step.stepNumber} · Mastery ${s.step.mastery} · ${s.action}: ${s.text || ''}` : '';
  $('progress').textContent = `${s.queuedCount} / ${s.queueLimit} completed steps awaiting save. ${s.pendingMastery == null ? '' : `Queued mastery: ${s.pendingMastery}.`}`;
  if (s.bridgeError) $('error').textContent = s.bridgeError;
  if (s.step && active) { const changed = $('card').value !== s.step.cardId || $('step').value !== s.step.stepId; if (changed) { $('card').value = s.step.cardId; cardView(); $('step').value = s.step.stepId; stepView(); } }
}
async function drain() { let total = 0; for (let i = 0; i < 16 && state().queuedCount; i++) total += await reconcileNative(db, native); if (total) await reload(); }
async function waitFor(predicate) { for (let i = 0; i < 100; i++) { if (predicate(state())) return; await new Promise(resolve => setTimeout(resolve, 50)); } throw new Error('Native control is still pending. Retry after checking playback.'); }
async function stopped() { native.command('STOP'); await waitFor(s => !s.serviceRunning); await drain(); }
async function paused() { if (state().serviceRunning) { native.command('PAUSE'); await waitFor(s => !s.serviceRunning || s.status === 'paused' || s.status === 'error'); } await drain(); }
async function run(action) { if (busy) return; busy = true; $('error').textContent = ''; render(); try { while (polling) await new Promise(resolve => setTimeout(resolve, 25)); await action(); } catch (error) { $('error').textContent = error.message; } finally { busy = false; render(); } }
async function start(options) { await drain(); await reload(); const plan = buildNativePlan(library, options); lastOptions = options; native.start(JSON.stringify(plan)); }
$('start').onclick = () => run(() => start(settings()));
$('restart').onclick = () => run(async () => { await stopped(); await start(lastOptions); });
$('stop').onclick = () => { native.command('STOP'); void run(stopped); };
for (const id of ['pause', 'resume', 'skip']) $(id).onclick = () => { native.command(id.toUpperCase()); render(); };
$('refresh').onclick = () => native.refresh();
$('save-progress').onclick = () => run(drain);
$('data').onclick = event => { if (busy || state().serviceRunning || state().queuedCount) { event.preventDefault(); $('error').textContent = 'Stop playback and Save queued progress before opening Data.'; } };
for (const id of ['mode', 'series', 'window', 'days', 'random', 'recall', 'rate']) $(id).onchange = preview;
$('card').onchange = cardView; $('step').onchange = stepView; $('level').onchange = () => { levelDirty = true; feedback(); };
$('level').replaceChildren(...INTERVAL_LABELS.map((text, i) => option(String(i), `${i} — ${text}`)));
$('queue').onclick = () => run(async () => {
  const level = Number($('level').value), before = state(); await paused(); const s = state();
  if (before.sessionId !== s.sessionId || before.occurrenceId !== s.occurrenceId) throw new Error('Step changed while pausing. Check the current step and choose again.');
  if (!s.step || s.refreshRequired || !s.serviceRunning) throw new Error('No unfinished step. Start a session first.');
  const snapshot = await exportSnapshot(db), action = { type: 'step', cardId: s.step.cardId, stepId: s.step.stepId, level }, plan = planMastery(snapshot, action);
  const confirmed = plan.confirmation && confirm(plan.message + ' Apply only after the full answer finishes?');
  if (plan.confirmation && !confirmed) return;
  const error = native.queueMastery(JSON.stringify({ action, confirmed, expectedKey: contentKey(snapshot), sessionId: s.sessionId, occurrenceId: s.occurrenceId }));
  if (error) throw new Error(error);
  levelDirty = false;
});
async function manual(type) {
  const level = Number($('level').value), cardId = $('card').value, stepId = $('step').value;
  await paused();
  if (state().serviceRunning && state().step?.cardId !== cardId) throw new Error('Card changed while pausing. Check the current card and choose again.');
  const snapshot = await exportSnapshot(db), action = { type, cardId, stepId, level }, plan = planMastery(snapshot, action);
  if (plan.confirmation && !confirm(plan.message)) return;
  await stopped(); await changeMastery(db, { action, expectedKey: contentKey(snapshot), confirmed: true }); levelDirty = false; await reload();
}
$('apply').onclick = () => run(() => manual('step'));
for (const [id, type] of [['known', 'known'], ['reset-card', 'resetCard'], ['reset-final', 'resetFinal'], ['reset-objective', 'resetObjective']]) $(id).onclick = () => run(() => manual(type));
async function tick() { if (!db || busy || polling || document.hidden) return; polling = true; try { await drain(); render(); } catch (error) { $('error').textContent = 'Progress remains queued: ' + error.message; } finally { polling = false; } }
try {
  if (!native) throw new Error('Open this listening page inside the Android application.');
  db = await openDatabase({ onBlocked: message => { $('error').textContent = message; }, onVersionChange: message => { db = undefined; $('error').textContent = message; render(); } });
  await drain(); await reload(); render();
} catch (error) { $('error').textContent = error.message; }
const timer = setInterval(tick, 1500); document.addEventListener('visibilitychange', tick);
window.addEventListener('pagehide', () => { clearInterval(timer); db?.close(); });
