import { openDatabase, DATA_STORES } from './db.js';
import { Repository } from './repository.js';
import { exportSnapshot, exportJSON, contentKey, readSnapshot } from './backup.js';

const $ = id => document.getElementById(id);
const copy = value => structuredClone(value);
let db, repo, snapshot, selected, draft, dirty = false, busy = false, pendingDelete, databaseOptions;
let seriesPage = 0, cardPage = 0;
const pageSize = 50;
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function button(text, action, { disabled = false, className, label } = {}) {
  const element = node('button', text, className); element.type = 'button'; element.disabled = disabled;
  if (label) element.setAttribute('aria-label', label);
  element.onclick = action; return element;
}
function field(labelText, id, value, onInput, { tag = 'input', type = 'text' } = {}) {
  const label = node('label', labelText), input = node(tag); input.id = id;
  if (tag === 'input') input.type = type;
  input.value = value; input.oninput = () => { onInput(input.value); markDirty(); };
  label.append(input); return label;
}
function message(text) { $('status').textContent = text; }
function error(reason) { $('error').textContent = reason.message || String(reason); $('error').scrollIntoView({ block: 'nearest' }); }
function markDirty() { dirty = true; draftState(); }
function draftState() { $('draft-state').textContent = dirty ? 'Unsaved changes' : draft ? 'Saved content · editing' : ''; }
function abandon() { return !dirty || confirm('Discard unsaved changes? Choose Cancel to keep editing.'); }
function clearDraft() { draft = undefined; dirty = false; draftState(); }
function controls() { $('workspace').disabled = !db || !snapshot || busy; $('delete-confirm').disabled = busy; }
async function run(action) {
  if (busy) return;
  busy = true; controls(); $('error').textContent = '';
  try { await action(); } catch (reason) { error(reason); }
  finally { busy = false; controls(); }
}
async function load() {
  const next = await exportSnapshot(db);
  const expected = contentKey(next);
  // Match the displayed library inside the SAME transaction as every mutation.
  // This also guards confirmed cascade counts, ordering, progress and restore generations.
  repo = new Repository(db, { guardStores: DATA_STORES, writeGuard: async tx => {
    if (contentKey(await readSnapshot(tx)) !== expected)
      throw new Error('The library changed in another tab or was restored. Nothing was saved. Your draft is still here; copy any needed text, then use Reload saved library and reopen the card.');
  } });
  snapshot = next;
  if (!snapshot.series.some(row => row.id === selected)) selected = snapshot.series[0]?.id;
  renderLists();
}
async function mutate(action, success) {
  const write = async () => {
    const result = await action();
    clearDraft(); message(success);
    await load(); renderEditor(); return result;
  };
  return navigator.locks ? navigator.locks.request(`SR-authoring-${db.name}`, write) : write();
}
function cardsFor(id) { return snapshot.flashcards.filter(card => card.seriesId === id); }
function paged(container, rows, page, setPage, renderRow) {
  page = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  rows.slice(page * pageSize, (page + 1) * pageSize).forEach(renderRow);
  if (rows.length > pageSize) {
    const bar = node('div', undefined, 'toolbar');
    bar.append(button('Previous', () => { setPage(page - 1); renderLists(); }, { disabled: page === 0 }),
      node('small', `${page * pageSize + 1}–${Math.min(rows.length, (page + 1) * pageSize)} of ${rows.length}`),
      button('Next', () => { setPage(page + 1); renderLists(); }, { disabled: (page + 1) * pageSize >= rows.length }));
    container.append(bar);
  }
}
function renderLists() {
  $('series-list').replaceChildren(); $('card-list').replaceChildren(); $('series-actions').replaceChildren();
  if (!snapshot.series.length) $('series-list').append(node('p', 'No series yet. Choose New series.'));
  paged($('series-list'), snapshot.series, seriesPage, value => { seriesPage = value; }, row => {
    const item = node('div', undefined, 'list-item');
    const choose = button(`${row.position + 1}. ${row.name}`, () => {
      if (!abandon()) return; clearDraft(); selected = row.id; cardPage = 0; renderLists(); renderEditor();
    }); choose.setAttribute('aria-current', String(selected === row.id));
    item.append(choose, node('small', `${cardsFor(row.id).length} flashcards · ${row.bound ? 'Bound' : 'Unbound'}`));
    $('series-list').append(item);
  });
  const series = snapshot.series.find(row => row.id === selected);
  $('current-series').textContent = series?.name || 'Select a series';
  $('binding').textContent = series ? series.bound ? 'Bound — keep this meaningful sequence together in future reviews.' : 'Unbound — cards may be reviewed independently or randomly in future reviews.' : '';
  if (!series) return;
  const cards = cardsFor(series.id);
  $('series-actions').append(button('Edit series', () => openSeries(series)), button('New flashcard', () => openCard()));
  if (!cards.length) $('card-list').append(node('p', 'This series is empty. Add your first flashcard.'));
  paged($('card-list'), cards, cardPage, value => { cardPage = value; }, row => {
    const item = node('div', undefined, 'list-item');
    item.append(button(`${row.position + 1}. ${row.name}`, () => openCard(row)), node('small', `${row.steps.length} steps`));
    $('card-list').append(item);
  });
}
function openSeries(row) {
  if (!abandon()) return;
  draft = { kind: 'series', original: row, value: copy(row || { name: '', bound: false, position: snapshot.series.length }) };
  dirty = false; renderEditor(); $('series-name').focus();
}
function newStep() { return { id: crypto.randomUUID(), question: '', answer: '', position: 0 }; }
function openCard(row) {
  if (!abandon()) return;
  draft = { kind: 'card', original: row, value: copy(row || { name: '', seriesId: selected, position: cardsFor(selected).length, steps: [newStep()] }) };
  dirty = false; renderEditor(); $('card-name').focus();
}
function positionField(max) {
  const label = field('Position (1 is first)', 'position', draft.value.position + 1, value => { draft.value.position = Number(value) - 1; }, { type: 'number' });
  const input = label.querySelector('input'); input.min = 1; input.max = max; input.step = 1;
  const bar = node('div', undefined, 'toolbar');
  for (const [labelText, delta] of [['Move up', -1], ['Move down', 1]]) bar.append(button(labelText, () => {
    const value = Number(input.value) + delta;
    if (!Number.isInteger(value) || value < 1 || value > max) return;
    draft.value.position = value - 1; markDirty(); renderEditor(); $('position').focus();
  }, { disabled: delta < 0 ? draft.value.position <= 0 : draft.value.position >= max - 1 }));
  label.append(bar); return label;
}
function renderEditor() {
  const editor = $('editor'); editor.replaceChildren(); draftState();
  if (!draft) { editor.append(node('h2', 'Choose a flashcard to edit'), node('p', 'Or create a new flashcard in the selected series. Changes are saved only when you choose Save.')); return; }
  const { kind, original, value } = draft;
  editor.append(node('h2', original ? `Edit ${kind === 'card' ? 'flashcard' : 'series'}: ${value.name}` : `New ${kind === 'card' ? 'flashcard' : 'series'}`));
  const form = node('form'); form.noValidate = true; form.onsubmit = event => { event.preventDefault(); run(save); };
  form.append(field(kind === 'card' ? 'Flashcard name' : 'Series name', `${kind}-name`, value.name, name => { value.name = name; }));
  if (kind === 'series') {
    const label = node('label'), checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.id = 'bound'; checkbox.checked = value.bound;
    checkbox.onchange = () => { value.bound = checkbox.checked; markDirty(); };
    label.append(checkbox, document.createTextNode(' Bound series — order is meaningful')); form.append(label,
      node('p', 'Bound: preserve a required sequence, such as a passage journey. Unbound: related cards can later be reviewed independently or randomly. Changing this does not reorder your cards.'),
      positionField(snapshot.series.length + (original ? 0 : 1)));
  } else {
    const label = node('label', 'Series'), select = node('select'); select.id = 'card-series';
    for (const row of snapshot.series) { const option = node('option', row.name); option.value = row.id; select.append(option); }
    select.value = value.seriesId; select.onchange = () => {
      value.seriesId = select.value; value.position = cardsFor(select.value).filter(row => row.id !== original?.id).length;
      markDirty(); renderEditor(); $('card-series').focus();
    }; label.append(select); form.append(label, positionField(cardsFor(value.seriesId).filter(row => row.id !== original?.id).length + 1));
    const progress = snapshot.progress.find(row => row.flashcardId === original?.id);
    form.append(node('p', `Knowledge Mastery: ${progress?.mastery ?? 0}/10 · Read only. Editing preserves saved review progress.`));
    if (value.recitationStepIds || value.steps.some(step => Object.hasOwn(step, 'role') || Object.hasOwn(step, 'directQuestion') || Object.hasOwn(step, 'recallSeconds')))
      form.append(node('p', 'This imported card has annotations. They are preserved. Referenced recitation steps cannot be deleted or reordered here; annotation management belongs to a later stage.'));
    const steps = node('div'); steps.id = 'steps';
    value.steps.forEach((step, index) => {
      const section = node('fieldset', undefined, 'step'); section.dataset.stepId = step.id;
      section.append(node('legend', `Step ${index + 1}`),
        field('Question', `question-${index}`, step.question, text => { step.question = text; }, { tag: 'textarea' }),
        field('Answer', `answer-${index}`, step.answer, text => { step.answer = text; }, { tag: 'textarea' }));
      const bar = node('div', undefined, 'toolbar');
      const move = delta => {
        const reordered = [...value.steps]; [reordered[index], reordered[index + delta]] = [reordered[index + delta], reordered[index]];
        const refs = value.recitationStepIds;
        if (refs && JSON.stringify(reordered.filter(item => refs.includes(item.id)).map(item => item.id)) !== JSON.stringify(refs)) {
          error('This move would change imported recitation references. Their order is preserved until annotation editing is available.'); return;
        }
        value.steps = reordered; markDirty(); renderEditor(); $(`question-${index + delta}`).focus();
      };
      bar.append(button('Up', () => move(-1), { disabled: index === 0, label: `Move step ${index + 1} up` }),
        button('Down', () => move(1), { disabled: index === value.steps.length - 1, label: `Move step ${index + 1} down` }),
        button('Insert after', () => { value.steps.splice(index + 1, 0, newStep()); markDirty(); renderEditor(); $(`question-${index + 1}`).focus(); }, { label: `Insert after step ${index + 1}` }),
        button('Delete step', () => {
          if (value.recitationStepIds?.includes(step.id)) { error('This step is referenced for recitation. It is preserved until annotation editing is available.'); return; }
          if (!confirm(`Delete step ${index + 1}, its question, answer and any annotations from this draft? Save applies the deletion; Cancel discards it.`)) return;
          value.steps.splice(index, 1); markDirty(); renderEditor(); $(`question-${Math.min(index, value.steps.length - 1)}`).focus();
        }, { disabled: value.steps.length === 1, label: `Delete step ${index + 1}` }));
      section.append(bar); steps.append(section);
    }); form.append(node('h3', `${value.steps.length} ordered steps · Review the complete chain below`), steps,
      button('Add step', () => { value.steps.push(newStep()); markDirty(); renderEditor(); $(`question-${value.steps.length - 1}`).focus(); }));
  }
  const bar = node('div', undefined, 'toolbar editor-actions'), saveButton = node('button', 'Save', 'primary'); saveButton.type = 'submit'; saveButton.id = 'save';
  bar.append(saveButton, button('Cancel', () => { if (abandon()) { clearDraft(); renderEditor(); } }));
  if (original) bar.append(button(`Delete ${kind === 'card' ? 'flashcard' : 'series'}`, () => confirmDelete(), { className: 'danger' }));
  form.prepend(bar); editor.append(form);
}
async function save() {
  const { kind, original, value } = draft;
  if (!value.name.trim()) throw new Error('Enter a name. Your draft has been kept.');
  if (!Number.isInteger(value.position) || value.position < 0) throw new Error('Position must be a whole number starting at 1.');
  if (kind === 'series') {
    const patch = { name: value.name, bound: value.bound, position: value.position };
    await mutate(async () => { const row = original ? await repo.updateSeries(original.id, patch, original.revision) : await repo.createSeries(patch); selected = row.id; }, 'Series saved.');
  } else {
    for (const [index, step] of value.steps.entries()) {
      if (!step.question.trim() || !step.answer.trim()) throw new Error(`Step ${index + 1} needs both a question and an answer. Your draft has been kept.`);
    }
    const patch = { name: value.name, seriesId: value.seriesId, position: value.position, steps: value.steps };
    await mutate(async () => { const row = original ? await repo.updateCard(original.id, patch, original.revision) : await repo.createCard(patch); selected = row.seriesId; }, `Flashcard saved — ${value.steps.length} steps. Review progress preserved.`);
  }
}
function confirmDelete() {
  if (!abandon()) return;
  const { kind, original } = draft;
  const cards = kind === 'series' ? cardsFor(original.id) : [original];
  const ids = new Set(cards.map(card => card.id));
  const presets = snapshot.presets.filter(preset => preset.cardIds.some(id => ids.has(id)) || kind === 'series' && preset.seriesIds.includes(original.id));
  $('delete-title').textContent = `Delete ${kind === 'series' ? 'series' : 'flashcard'} “${original.name}”?`;
  const list = node('ul'); cards.forEach(card => list.append(node('li', `${card.name} (${card.steps.length} steps)`)));
  $('delete-detail').replaceChildren(node('p', `Permanently deletes ${kind === 'series' ? 'this series, ' : ''}${cards.length} flashcards, ${cards.reduce((n, card) => n + card.steps.length, 0)} steps and ${cards.length} mastery/review progress records. Removes references from ${presets.length} presets; the presets themselves remain.`), list);
  pendingDelete = () => mutate(() => kind === 'series' ? repo.deleteSeries(original.id, original.revision, { confirmed: true }) : repo.deleteCard(original.id, original.revision), 'Deletion saved. Remaining positions and preset references updated.');
  $('delete-dialog').showModal(); $('delete-cancel').focus();
}
$('delete-cancel').onclick = () => { $('delete-dialog').close(); pendingDelete = undefined; };
$('delete-dialog').oncancel = () => { pendingDelete = undefined; };
$('delete-confirm').onclick = () => run(async () => { const action = pendingDelete; pendingDelete = undefined; $('delete-dialog').close(); await action(); });
$('new-series').onclick = () => openSeries();
$('reload').onclick = () => { if (abandon()) run(async () => { await load(); clearDraft(); renderEditor(); message('Saved library reloaded.'); }); };
$('backup').onclick = () => run(async () => {
  const json = await exportJSON(db), url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = node('a'); link.href = url; link.download = `sr-backup-${new Date().toISOString().replaceAll(':', '-')}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  message('Backup download requested for saved content. Unsaved drafts are not included. Keep and verify the file outside this browser.');
});
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => db?.close());
window.addEventListener('pageshow', event => {
  if (event.persisted) run(async () => {
    db = await openDatabase(databaseOptions);
    if (repo) repo.db = db; // Keep the old guard/draft; Back must not authorize a stale write.
    message('Returned to the editor. Any draft is retained; saving checks for library changes.');
  });
});
await run(async () => {
  const testName = new URLSearchParams(location.search).get('test');
  if (testName !== null && !/^SRLearning-test-[a-zA-Z0-9-]+$/.test(testName)) throw new Error('Invalid isolated test database name.');
  if (testName) { document.querySelector('h1').textContent = 'My library — disposable test database'; $('data-link').href += `?test=${encodeURIComponent(testName)}`; }
  databaseOptions = { name: testName || undefined, onBlocked: error, onVersionChange: reason => { db = undefined; controls(); error(reason); } };
  db = await openDatabase(databaseOptions);
  await load(); message('Library ready. Changes stay on this browser until you export a backup.');
});
