import { openDatabase } from './db.js';
import { exportSnapshot, contentKey } from './backup.js';
import { changeMastery, planMastery } from './mastery.js';
import { INTERVAL_LABELS, nextDue, progressMap, progressKey, selectReview, selectAudit } from './scheduler.js';
const $ = id => document.getElementById(id);
const element = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
let db, snapshot, busy = false, dirty = false, cardId, seriesId, stepId, limit = 50;
const date = time => time === null ? 'No active due date' : new Date(time).toLocaleString();
function error(reason) { $('error').textContent = reason.message || String(reason); $('error').scrollIntoView({ block: 'nearest' }); }
function controls() { $('workspace').disabled = !db || !snapshot || busy; }
async function run(action) { if (busy) return; busy = true; controls(); $('error').textContent = ''; try { await action(); } catch (reason) { error(reason); } finally { busy = false; controls(); } }
function discard() { return !dirty || confirm('Discard the unapplied mastery selection?'); }
function options(select, rows, value) { select.replaceChildren(...rows.map(([id, name]) => { const option = element('option', name); option.value = id; return option; })); select.value = value; }
function card() { return snapshot.flashcards.find(row => row.id === cardId); }
function row() { return progressMap(snapshot).get(progressKey(cardId, stepId)); }
function render() {
  if (!snapshot.series.some(series => series.id === seriesId)) seriesId = snapshot.series[0]?.id;
  options($('series'), snapshot.series.map(series => [series.id, series.name]), seriesId);
  const cards = snapshot.flashcards.filter(card => card.seriesId === seriesId).sort((a, b) => a.position - b.position);
  if (!cards.some(card => card.id === cardId)) cardId = cards[0]?.id;
  options($('card'), cards.map(card => [card.id, card.name]), cardId);
  if (!card()?.steps.some(step => step.id === stepId)) stepId = card()?.steps[0]?.id;
  const progress = progressMap(snapshot);
  options($('step'), (card()?.steps || []).map((step, index) => [step.id, `${index + 1}${index === card().steps.length - 1 ? ' — Final' : ''}: mastery ${progress.get(progressKey(cardId, step.id)).mastery} · ${step.question}`]), stepId);
  const step = card()?.steps.find(step => step.id === stepId), current = row();
  $('question').textContent = step ? `Question: ${step.question}` : 'This series has no flashcards. Create one in the library editor.';
  $('answer').textContent = step ? `Answer: ${step.answer}` : '';
  $('current').textContent = current ? `Saved mastery ${current.mastery}. Due: ${date(current.nextDueAt)}. Last REVIEW: ${current.lastReviewedAt === null ? 'Never' : date(current.lastReviewedAt)}.` : '';
  $('level').value = current?.mastery ?? 0;
  for (const id of ['apply', 'known', 'reset', 'level']) $(id).disabled = !current;
  dirty = false; feedback(); preview();
}
function feedback() {
  const level = Number($('level').value);
  $('interval').textContent = level === 10 ? 'KNOWN — Excluded from normal REVIEW. Available through AUDIT.' : `Mastery ${level} — Next review in ${INTERVAL_LABELS[level]}.`;
  $('new-due').textContent = `If applied now: ${date(nextDue(level, Date.now()))}. Dates use elapsed days/weeks and clamped UTC calendar months.`;
}
async function load() { snapshot = await exportSnapshot(db); render(); }
async function apply(action) {
  const plan = planMastery(snapshot, action);
  if (plan.confirmation && !confirm(plan.message)) return;
  await changeMastery(db, { action, expectedKey: contentKey(snapshot), confirmed: plan.confirmation });
  dirty = false; await load(); $('status').textContent = 'Mastery saved. Authored content preserved.';
}
function preview() {
  const audit = $('mode').value === 'AUDIT'; $('review-options').hidden = audit; $('audit-policy').hidden = !audit;
  $('days').disabled = $('window').value !== 'days';
  const selection = $('scope').value === 'all' ? {} : { seriesId };
  const units = audit ? selectAudit(snapshot, selection) : selectReview(snapshot, { ...selection, now: Date.now(), window: { type: $('window').value, days: Number($('days').value) }, random: $('random').checked });
  $('preview-count').textContent = `${audit ? 'AUDIT' : 'REVIEW'}: ${units.length} flashcards, ${units.reduce((n, unit) => n + unit.stepIds.length, 0)} eligible steps.`;
  $('preview-list').replaceChildren();
  for (const unit of units.slice(0, limit)) {
    const card = snapshot.flashcards.find(row => row.id === unit.cardId), detail = element('details'), summary = element('summary', `${card.name} — steps ${unit.stepIds.map(id => card.steps.findIndex(step => step.id === id) + 1).join(', ')}`);
    detail.append(summary);
    // Populate expanded text lazily, not 10,000 hidden textarea/paragraph rows.
    let filled = false;
    detail.ontoggle = () => { if (detail.open && !filled) { filled = true; for (const step of card.steps.filter(step => unit.stepIds.includes(step.id))) { const paragraph = element('p', `${step.question}\n→ ${step.answer}`); paragraph.className = 'verbatim'; detail.append(paragraph); } } };
    if (audit) {
      const controls = element('div'); controls.className = 'toolbar';
      for (const [label, type] of [['Reset final step only', 'resetFinal'], ['Reset entire flashcard / objective', 'resetObjective']]) {
        const button = element('button', label); button.onclick = () => { if (discard()) run(() => apply({ type, cardId: card.id })); }; controls.append(button);
      }
      const note = element('p', 'If you decide an AUDIT failed, choose an explicit reset. For the final card of a BOUND series, resetting the objective resets the entire series.');
      detail.append(note, controls);
    }
    $('preview-list').append(detail);
  }
  $('more').hidden = units.length <= limit;
}
for (const id of ['series', 'card', 'step']) $(id).onchange = () => {
  if (!discard()) { $(id).value = { series: seriesId, card: cardId, step: stepId }[id]; return; }
  if (id === 'series') seriesId = $(id).value; if (id === 'card') cardId = $(id).value; if (id === 'step') stepId = $(id).value;
  render();
};
options($('level'), INTERVAL_LABELS.map((label, index) => [index, `${index} — ${label}`]), 0);
$('level').onchange = () => { dirty = true; feedback(); };
$('apply').onclick = () => run(() => apply({ type: 'step', cardId, stepId, level: Number($('level').value) }));
$('known').onclick = () => { if (discard()) run(() => apply({ type: 'known', cardId })); };
$('reset').onclick = () => { if (discard()) run(() => apply({ type: 'resetCard', cardId })); };
$('reload').onclick = () => { if (discard()) run(load); };
for (const id of ['mode', 'scope', 'window', 'days', 'random']) $(id).onchange = () => run(async () => { limit = 50; preview(); });
$('preview').onclick = () => run(async () => preview()); $('more').onclick = () => run(async () => { limit += 50; preview(); });
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => db?.close());
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
await run(async () => {
  const name = new URLSearchParams(location.search).get('test');
  if (name !== null && !/^SRLearning-test-[a-zA-Z0-9-]+$/.test(name)) throw new Error('Invalid isolated test database name.');
  if (name) for (const id of ['library-link', 'data-link']) $(id).href += `?test=${encodeURIComponent(name)}`;
  db = await openDatabase({ name: name || undefined, onBlocked: error, onVersionChange: reason => { db = undefined; error(reason); controls(); } });
  await load(); $('status').textContent = 'Mastery ready. Make a JSON backup before major changes.';
});
