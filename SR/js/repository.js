import { request, transaction } from './db.js';
import { fields, requireValue, timestamp, validateSeries, validateCard, validateProgress, validatePreset, validateSetting } from './validation.js';
import { nextDue } from './scheduler.js';

const sorted = rows => rows.sort((a, b) => a.position - b.position);
const clone = value => structuredClone(value);
function existing(row) { requireValue(row, 'Record no longer exists.'); return row; }
function revision(row, expected) { requireValue(row.revision === expected, 'Record changed; reload before saving.'); }
function fresh(input) { const now = Date.now(); return { ...input, id: input.id ?? crypto.randomUUID(), createdAt: now, updatedAt: now, revision: 1 }; }
function changed(row, patch) {
  requireValue(Number.isSafeInteger(row.revision + 1), 'Revision limit reached; no data was changed.');
  return { ...row, ...patch, updatedAt: Math.max(Date.now(), row.updatedAt), revision: row.revision + 1 };
}
function reorder(store, rows) {
  rows.forEach((row, position) => { if (row.position !== position) store.put(changed(row, { position })); });
}
function insert(rows, row, position = rows.length) {
  requireValue(Number.isInteger(position) && position >= 0 && position <= rows.length, 'Position is outside the collection.');
  rows.splice(position, 0, row); return position;
}

export class Repository {
  constructor(db, { writeGuard, guardStores = [] } = {}) { this.db = db; this.writeGuard = writeGuard; this.guardStores = guardStores; }
  write(stores, body) {
    return transaction(this.db, [...new Set([...stores, ...this.guardStores])], 'readwrite', async tx => {
      if (this.writeGuard) await this.writeGuard(tx);
      return body(tx);
    });
  }
  getSeries(id) { return this.get('series', id); }
  getCard(id) { return this.get('flashcards', id); }
  getProgress(id) { return this.get('progress', id); }
  getStepProgress(cardId, stepId) { return this.get('stepProgress', [cardId, stepId]); }
  getPreset(id) { return this.get('presets', id); }
  get(store, id) { return transaction(this.db, [store], 'readonly', tx => request(tx.objectStore(store).get(id))); }
  listSeries() { return transaction(this.db, ['series'], 'readonly', tx => request(tx.objectStore('series').index('byPosition').getAll())); }
  listCards(seriesId) { return transaction(this.db, ['flashcards'], 'readonly', async tx => sorted(await request(tx.objectStore('flashcards').index('bySeries').getAll(seriesId)))); }
  listCardIds(seriesId) {
    return transaction(this.db, ['flashcards'], 'readonly', tx => request(tx.objectStore('flashcards').index('bySeriesPosition')
      .getAllKeys(IDBKeyRange.bound([seriesId, 0], [seriesId, Number.MAX_SAFE_INTEGER]))));
  }
  listDue(at = Date.now()) {
    requireValue(timestamp(at), 'Invalid due query timestamp.');
    return transaction(this.db, ['progress'], 'readonly', tx => request(tx.objectStore('progress').index('byDue').getAll(IDBKeyRange.upperBound(at))));
  }
  listPresets() { return transaction(this.db, ['presets'], 'readonly', tx => request(tx.objectStore('presets').getAll())); }
  async createSeries(input) {
    input = clone(input); fields(input, ['name', 'bound'], ['id', 'position', 'recitationPrompt']);
    return this.write(['series'], async tx => {
      const store = tx.objectStore('series'), rows = sorted(await request(store.getAll()));
      const row = fresh(input); row.position = insert(rows, row, input.position);
      validateSeries(row); await request(store.add(row)); reorder(store, rows); return row;
    });
  }
  async updateSeries(id, patch, expectedRevision) {
    patch = clone(patch); fields(patch, [], ['name', 'bound', 'position', 'recitationPrompt']);
    return this.write(['series'], async tx => {
      const store = tx.objectStore('series'), old = existing(await request(store.get(id))); revision(old, expectedRevision);
      const rows = sorted(await request(store.getAll())).filter(row => row.id !== id);
      const row = changed(old, patch); insert(rows, row, row.position); validateSeries(row);
      await request(store.put(row)); reorder(store, rows); return row;
    });
  }
  async createCard(input) {
    input = clone(input); fields(input, ['seriesId', 'name', 'steps'], ['id', 'position', 'recitationStepIds']);
    return this.write(['series', 'flashcards', 'progress', 'stepProgress'], async tx => {
      existing(await request(tx.objectStore('series').get(input.seriesId)));
      const store = tx.objectStore('flashcards'), rows = sorted(await request(store.index('bySeries').getAll(input.seriesId)));
      const row = fresh(input);
      row.steps = input.steps.map((step, position) => ({ ...step, id: step.id ?? crypto.randomUUID(), position }));
      row.position = insert(rows, row, input.position); validateCard(row);
      await request(store.add(row));
      await request(tx.objectStore('progress').add({ flashcardId: row.id, mastery: 0, lastReviewedAt: null, nextDueAt: 0, revision: 1 }));
      for (const step of row.steps) tx.objectStore('stepProgress').add({ flashcardId: row.id, stepId: step.id, mastery: 0, lastReviewedAt: null, nextDueAt: nextDue(0, row.createdAt), revision: 1 });
      reorder(store, rows); return row;
    });
  }
  async updateCard(id, patch, expectedRevision) {
    patch = clone(patch); fields(patch, [], ['seriesId', 'name', 'position', 'steps', 'recitationStepIds']);
    return this.write(['series', 'flashcards', 'stepProgress'], async tx => {
      const store = tx.objectStore('flashcards'), old = existing(await request(store.get(id))); revision(old, expectedRevision);
      const row = changed(old, patch);
      existing(await request(tx.objectStore('series').get(row.seriesId)));
      if (patch.steps) row.steps = patch.steps.map((step, position) => ({ ...step, id: step.id ?? crypto.randomUUID(), position }));
      const rows = sorted(await request(store.index('bySeries').getAll(row.seriesId))).filter(item => item.id !== id);
      row.position = insert(rows, row, patch.position ?? (old.seriesId === row.seriesId ? old.position : rows.length));
      validateCard(row); await request(store.put(row)); reorder(store, rows);
      const kept = new Set(row.steps.map(step => step.id)), previous = new Set(old.steps.map(step => step.id));
      for (const step of old.steps) if (!kept.has(step.id)) tx.objectStore('stepProgress').delete([id, step.id]);
      for (const step of row.steps) if (!previous.has(step.id)) tx.objectStore('stepProgress').add({ flashcardId: id, stepId: step.id, mastery: 0, lastReviewedAt: null, nextDueAt: nextDue(0, row.updatedAt), revision: 1 });
      if (old.seriesId !== row.seriesId) reorder(store, sorted(await request(store.index('bySeries').getAll(old.seriesId))));
      return row;
    });
  }
  async updateProgress(id, patch, expectedRevision) {
    patch = clone(patch); fields(patch, [], ['mastery', 'lastReviewedAt', 'nextDueAt']);
    // Legacy v1 archive API, retained for compatibility/tests. Active learning uses stepProgress.
    return this.write(['progress'], async tx => {
      const store = tx.objectStore('progress'), old = existing(await request(store.get(id))); revision(old, expectedRevision);
      const row = { ...old, ...patch, revision: old.revision + 1 }; validateProgress(row);
      await request(store.put(row)); return row;
    });
  }
  async savePreset(input, expectedRevision) {
    input = clone(input); fields(input, ['name', 'seriesIds', 'cardIds', 'mode', 'order', 'grouping'], ['id']);
    return this.write(['presets', 'series', 'flashcards'], async tx => {
      const store = tx.objectStore('presets'), old = input.id ? await request(store.get(input.id)) : undefined;
      if (old) revision(old, expectedRevision);
      else requireValue(expectedRevision === undefined, 'Preset no longer exists.');
      const row = old ? changed(old, input) : fresh(input); validatePreset(row);
      for (const id of row.seriesIds) existing(await request(tx.objectStore('series').get(id)));
      for (const id of row.cardIds) existing(await request(tx.objectStore('flashcards').get(id)));
      await request(store.put(row)); return row;
    });
  }
  deletePreset(id, expectedRevision) {
    return this.write(['presets'], async tx => {
      const store = tx.objectStore('presets'); revision(existing(await request(store.get(id))), expectedRevision);
      await request(store.delete(id));
    });
  }
  async setSetting(key, value) {
    value = clone(value); validateSetting(key, value);
    return this.write(['settings'], tx => request(tx.objectStore('settings').put({ key, value })));
  }
  async getSettings() {
    return transaction(this.db, ['settings'], 'readonly', async tx => Object.fromEntries((await request(tx.objectStore('settings').getAll())).map(row => [row.key, row.value])));
  }
  deleteCard(id, expectedRevision) { return this._delete('flashcards', id, expectedRevision); }
  deleteSeries(id, expectedRevision, { confirmed = false } = {}) {
    requireValue(confirmed === true, 'Confirm series deletion and its card count first.');
    return this._delete('series', id, expectedRevision);
  }
  _delete(kind, id, expectedRevision) {
    return this.write(['series', 'flashcards', 'progress', 'presets', 'stepProgress'], async tx => {
      const store = tx.objectStore(kind), old = existing(await request(store.get(id))); revision(old, expectedRevision);
      const cards = kind === 'series' ? await request(tx.objectStore('flashcards').index('bySeries').getAll(id)) : [old];
      const removed = new Set(cards.map(card => card.id));
      for (const card of cards) {
        tx.objectStore('flashcards').delete(card.id); tx.objectStore('progress').delete(card.id);
        for (const step of card.steps) tx.objectStore('stepProgress').delete([card.id, step.id]);
      }
      if (kind === 'series') { await request(store.delete(id)); reorder(store, sorted(await request(store.getAll()))); }
      else reorder(store, sorted(await request(store.index('bySeries').getAll(old.seriesId))));
      for (const preset of await request(tx.objectStore('presets').getAll())) {
        const cardIds = preset.cardIds.filter(value => !removed.has(value));
        const seriesIds = preset.seriesIds.filter(value => kind !== 'series' || value !== id);
        if (cardIds.length !== preset.cardIds.length || seriesIds.length !== preset.seriesIds.length)
          tx.objectStore('presets').put(changed(preset, { cardIds, seriesIds }));
      }
      return { deletedCards: cards.length };
    });
  }
}
