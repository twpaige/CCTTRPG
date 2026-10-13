import { DATA_STORES, ALL_STORES, request, transaction } from './db.js';
import { FORMAT, parseSnapshot, validateSnapshot, requireValue } from './validation.js';

export async function readSnapshot(tx) {
  const [series, flashcards, progress, presets, settings, reviewEvents, meta] = await Promise.all(DATA_STORES.map(name => request(tx.objectStore(name).getAll())));
  const identity = meta.find(row => row.key === 'library');
  requireValue(identity, 'Library metadata is missing; no data was reset.');
  return validateSnapshot({ format: FORMAT, formatVersion: 1, schemaVersion: 1, appVersion: '0.3', exportedAt: new Date().toISOString(),
    libraryId: identity.libraryId, libraryGeneration: identity.libraryGeneration,
    series: series.sort((a, b) => a.position - b.position),
    flashcards: flashcards.sort((a, b) => a.seriesId < b.seriesId ? -1 : a.seriesId > b.seriesId ? 1 : a.position - b.position),
    progress, presets, settings: Object.fromEntries(settings.map(row => [row.key, row.value])), reviewEvents });
}
export const exportSnapshot = db => transaction(db, DATA_STORES, 'readonly', readSnapshot);
export async function exportJSON(db) { return JSON.stringify(await exportSnapshot(db), null, 2); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function contentKey(snapshot) {
  const copy = structuredClone(snapshot);
  delete copy.exportedAt; delete copy.appVersion;
  for (const name of ['series', 'flashcards', 'progress', 'presets', 'reviewEvents']) copy[name].sort((a, b) => {
    const x = a.id ?? a.flashcardId, y = b.id ?? b.flashcardId; return x < y ? -1 : x > y ? 1 : 0;
  });
  return JSON.stringify(canonical(copy));
}
export function previewImport(json) {
  const snapshot = parseSnapshot(json);
  return { snapshot, counts: { series: snapshot.series.length, flashcards: snapshot.flashcards.length,
    steps: snapshot.flashcards.reduce((total, card) => total + card.steps.length, 0), presets: snapshot.presets.length } };
}
export async function restoreJSON(db, json, { confirmed = false, safetyJSON } = {}) {
  // Copy/validate both files before acquiring a write transaction.
  const incoming = parseSnapshot(json);
  requireValue(confirmed === true, 'Explicit Replace confirmation is required.');
  const safety = parseSnapshot(safetyJSON);
  const expected = contentKey(safety);
  return transaction(db, ALL_STORES, 'readwrite', async tx => {
    const current = await readSnapshot(tx);
    requireValue(contentKey(current) === expected, 'Library changed after the safety export. Export and verify a new safety backup.');
    // Recovery and replacement commit together; quota/abort retains the previous library and recovery copy.
    await request(tx.objectStore('recovery').put({ key: 'pre-import', snapshot: current }));
    for (const name of DATA_STORES) tx.objectStore(name).clear();
    for (const name of ['series', 'flashcards', 'progress', 'presets', 'reviewEvents'])
      for (const row of incoming[name]) tx.objectStore(name).add(row);
    for (const [key, value] of Object.entries(incoming.settings)) tx.objectStore('settings').add({ key, value });
    const libraryGeneration = crypto.randomUUID();
    tx.objectStore('meta').add({ key: 'library', libraryId: incoming.libraryId, libraryGeneration });
    return { libraryGeneration, cards: incoming.flashcards.length };
  });
}
export async function recoveryJSON(db) {
  const row = await transaction(db, ['recovery'], 'readonly', tx => request(tx.objectStore('recovery').get('pre-import')));
  requireValue(row, 'No pre-import recovery copy exists yet.');
  return JSON.stringify(validateSnapshot(row.snapshot), null, 2);
}
