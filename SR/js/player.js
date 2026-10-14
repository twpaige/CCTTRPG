import { openDatabase } from './db.js';
import { exportSnapshot } from './backup.js';
import { BrowserSpeech } from './speech.js';
import { StudySession } from './study.js';
import { englishVoices, selectVoice, voiceKey, watchVoices, PREFERRED_VOICE } from './voices.js';
import { INTERVAL_LABELS, selectReview, selectAudit } from './scheduler.js';
const $ = id => document.getElementById(id);
let db, session, library, inventory = [], busy = false, watcher, displayedToken, countdown;
const option = (value, label) => { const node = document.createElement('option'); node.value = value; node.textContent = label; return node; };
const error = reason => { $('error').textContent = reason.message || String(reason); };
function feedback() {
  const level = Number($('level').value);
  $('interval').textContent = level === 10 ? 'KNOWN — available through AUDIT, excluded from normal REVIEW.' : `Mastery ${level} — Next review in ${INTERVAL_LABELS[level]}.`;
}
function options() {
  if ($('recall').value === '' || $('rate').value === '') throw new Error('Enter a recall duration and speech rate.');
  const rate = Number($('rate').value), recallMs = Number($('recall').value) * 1000;
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 2) throw new Error('Speech rate must be from 0.5 to 2.');
  if (!Number.isFinite(recallMs) || recallMs < 0 || recallMs > Number.MAX_SAFE_INTEGER) throw new Error('Enter a finite, nonnegative recall duration.');
  return { mode: $('mode').value, seriesId: $('series').value || undefined, window: { type: $('window').value, days: Number($('days').value) },
    random: $('random').checked, voice: selectVoice(inventory, $('voice').value), rate, recallMs };
}
function preview() {
  const audit = $('mode').value === 'AUDIT';
  $('review-options').hidden = audit; $('audit-note').hidden = !audit; $('days').disabled = $('window').value !== 'days';
  if (!library) return;
  try {
    const settings = options(), units = audit ? selectAudit(library, settings) : selectReview(library, settings);
    $('selection').textContent = units.length ? `${settings.mode}: ${units.length} flashcards, ${units.reduce((sum, unit) => sum + unit.stepIds.length, 0)} steps. Selection refreshes at Start.`
      : `${settings.mode}: no eligible cards. ${audit ? 'AUDIT requires KNOWN material.' : 'Try lookahead or Max Deferred to include future-due material; KNOWN is excluded.'}`;
  } catch (reason) { $('selection').textContent = reason.message; }
}
function render(state = session?.snapshot || { status: 'idle' }) {
  clearTimeout(countdown);
  if (state.status === 'playing' && state.phase === 'recall') countdown = setTimeout(() => render(), 1000);
  const active = !!session?.lease || !!session?.starting;
  $('settings').disabled = !db || active || busy;
  $('start').disabled = !db || active || busy || !selectVoice(inventory, $('voice').value);
  $('pause').disabled = busy || state.status !== 'playing';
  $('resume').disabled = busy || !['paused', 'error'].includes(state.status) || !active;
  $('skip').disabled = busy || !active || !state.card;
  $('stop').disabled = busy || !active;
  $('restart').disabled = busy || !session?.options;
  const unfinished = active && ['playing', 'paused', 'error'].includes(state.status) && ['question', 'recall', 'answer'].includes(state.phase) && !!session?.completion.current;
  $('mastery-controls').disabled = busy || !unfinished;
  $('special-controls').disabled = busy || !active || !state.card || state.phase === 'commit';
  $('audit-actions').hidden = state.mode !== 'AUDIT';
  if (state.starting) $('status').textContent = 'Preparing session…';
  else if (state.status === 'idle') $('status').textContent = 'Library ready. Choose REVIEW or AUDIT, then Start.';
  else if (state.status === 'finished') $('status').textContent = `${state.mode} complete — no more eligible cards in this pass. AUDIT ends when its selection is empty.`;
  else $('status').textContent = `${state.mode} · ${state.status} · ${state.phase}${state.mode === 'AUDIT' ? ` · cycle ${state.cycle}` : ''}${state.phase === 'recall' ? ` · ${Math.ceil(state.remainingMs / 1000)} seconds remaining` : ''}`;
  if (state.error) error(`${state.error} Resume / retry retries this operation. Stop releases the library; make a backup before attempting recovery.`);
  $('current-card').textContent = state.card ? `${state.card.name}` : 'Ready to listen';
  $('current-step').textContent = state.step ? `Authored step ${state.step.position + 1} · eligible step ${state.stepIndex + 1} of ${state.card.steps.length} · voice: ${state.voiceName}` : '';
  $('question').textContent = state.step?.question || ''; $('answer').textContent = state.step?.answer || '';
  const token = session?.completion.current;
  if (token && token !== displayedToken) {
    displayedToken = token;
    const saved = JSON.parse(token.prepared.expectedKey).stepProgress.find(row => row.flashcardId === state.card.id && row.stepId === state.step.id);
    $('level').value = saved.mastery; feedback();
    $('current-progress').textContent = `Saved mastery ${saved.mastery} · ${saved.nextDueAt === null ? 'KNOWN' : `Due ${new Date(saved.nextDueAt).toLocaleString()}`}. ${token.prepared.wasDue && state.mode === 'REVIEW' ? 'Successful answer restarts the interval.' : 'No automatic schedule change for this step.'}`;
  }
  if (!state.step) $('current-progress').textContent = '';
  $('pending').textContent = state.pending === undefined ? 'No pending mastery change.' : `Pending mastery ${state.pending}; applies only when the entire answer finishes.`;
}
async function run(action) {
  if (busy) return;
  busy = true; $('error').textContent = ''; render();
  try { await action(); } catch (reason) { error(reason); }
  finally { busy = false; render(); }
}
async function load() {
  library = await exportSnapshot(db);
  const selected = $('series').value;
  $('series').replaceChildren(option('', 'ALL series'), ...library.series.map(row => option(row.id, `${row.name} · ${row.bound ? 'BOUND' : 'UNBOUND'}`)));
  if (library.series.some(row => row.id === selected)) $('series').value = selected;
  preview();
}
$('level').replaceChildren(...INTERVAL_LABELS.map((label, level) => option(level, `${level} — ${label}`))); feedback();
for (const id of ['mode', 'series', 'window', 'days', 'random', 'recall', 'rate']) $(id).onchange = preview;
$('voice').onchange = () => render(); $('level').onchange = feedback;
$('start').onclick = () => run(() => session.start(options()));
$('pause').onclick = () => session.pause();
$('resume').onclick = () => { $('error').textContent = ''; session.resume(); };
$('skip').onclick = () => { $('error').textContent = ''; session.skip(); };
$('stop').onclick = () => run(async () => { await session.stop(); await load(); });
$('restart').onclick = () => run(() => session.restart());
$('reload').onclick = () => run(load);
$('queue').onclick = () => run(() => session.pendingMastery(Number($('level').value), message => confirm(message)));
for (const [id, type] of [['reset', 'resetCard'], ['known', 'known'], ['reset-final', 'resetFinal'], ['reset-objective', 'resetObjective']])
  $(id).onclick = () => run(() => session.special(type, message => confirm(message)));
$('refresh-voices').onclick = () => watcher?.refresh();
window.addEventListener('pagehide', () => { clearTimeout(countdown); watcher?.dispose(); void session?.stop().finally(() => db?.close()); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
await run(async () => {
  const name = new URLSearchParams(location.search).get('test');
  if (name !== null && !/^SRLearning-test-[a-zA-Z0-9-]+$/.test(name)) throw new Error('Invalid isolated test database name.');
  if (name) { document.querySelector('h1').textContent += ' — disposable test library'; for (const id of ['library-link', 'mastery-link', 'data-link']) $(id).href += `?test=${encodeURIComponent(name)}`; }
  db = await openDatabase({ name: name || undefined, onBlocked: error, onVersionChange: reason => { void session?.stop(); db = undefined; error(reason); render(); } });
  session = new StudySession(db, new BrowserSpeech(globalThis.speechSynthesis, globalThis.SpeechSynthesisUtterance), { onChange: render });
  await load();
  $('recall').value = library.settings.recallSeconds ?? 4; $('rate').value = library.settings.rate ?? 0.9;
  if (!globalThis.speechSynthesis) throw new Error('Native browser speech is unavailable. Use desktop Chrome.');
  watcher = watchVoices(speechSynthesis, ({ voices, waiting }) => {
    inventory = voices;
    const chosen = selectVoice(voices, $('voice').value);
    $('voice').replaceChildren(...englishVoices(voices).map(voice => option(voiceKey(voice), `${voice.name} (${voice.lang}${voice.localService ? ', local service' : ''})`)));
    if (chosen) $('voice').value = voiceKey(chosen);
    $('voice-note').textContent = chosen ? `${chosen.name === PREFERRED_VOICE ? 'Preferred voice available.' : 'English fallback available; choose any listed voice.'} Local/offline audio still requires a listening check.`
      : waiting ? 'Waiting for English voices…' : 'No English voice found. Install an English system voice, then Refresh voices.';
    render();
  });
  preview();
});
