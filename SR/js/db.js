// All callers await transaction completion, never just a successful request.
import { migrateSnapshot, FORMAT } from './validation.js';
export const DB_NAME = 'SRLearning';
export const DB_VERSION = 2;
export const DATA_STORES = ['series', 'flashcards', 'progress', 'presets', 'settings', 'reviewEvents', 'meta', 'stepProgress', 'stepEvents'];
export const ALL_STORES = [...DATA_STORES, 'recovery'];
export const request = operation => new Promise((resolve, reject) => {
  operation.onsuccess = () => resolve(operation.result);
  operation.onerror = () => reject(operation.error);
});

export function openDatabase({ name = DB_NAME, onBlocked = () => {}, onVersionChange = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    let upgradeError;
    const opening = indexedDB.open(name, DB_VERSION);
    opening.onblocked = () => onBlocked('Close other SR tabs before continuing the database upgrade.');
    opening.onerror = () => reject(upgradeError || opening.error);
    opening.onupgradeneeded = event => {
      const db = opening.result;
      // Sequential migrations: version 0 is an absent database, not a legacy library.
      if (event.oldVersion < 1) {
        db.createObjectStore('series', { keyPath: 'id' }).createIndex('byPosition', 'position');
        const cards = db.createObjectStore('flashcards', { keyPath: 'id' });
        cards.createIndex('bySeries', 'seriesId');
        cards.createIndex('bySeriesPosition', ['seriesId', 'position']);
        const progress = db.createObjectStore('progress', { keyPath: 'flashcardId' });
        progress.createIndex('byDue', 'nextDueAt');
        progress.createIndex('byMastery', 'mastery');
        db.createObjectStore('presets', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
        const events = db.createObjectStore('reviewEvents', { keyPath: 'id' });
        events.createIndex('bySessionUnit', ['sessionId', 'unitId'], { unique: true });
        events.createIndex('byCompletedAt', 'completedAt');
        db.createObjectStore('meta', { keyPath: 'key' });
        db.createObjectStore('recovery', { keyPath: 'key' });
        opening.transaction.objectStore('meta').add({ key: 'library', libraryId: crypto.randomUUID(), libraryGeneration: crypto.randomUUID() });
      }
      if (event.oldVersion < 2) {
        const tx = opening.transaction;
        const steps = db.createObjectStore('stepProgress', { keyPath: ['flashcardId', 'stepId'] });
        steps.createIndex('byCard', 'flashcardId'); steps.createIndex('byDue', 'nextDueAt');
        db.createObjectStore('stepEvents', { keyPath: 'id' });
        // All reads, validation, recovery and new records share the versionchange transaction.
        Promise.all(['series', 'flashcards', 'progress', 'presets', 'settings', 'reviewEvents', 'meta'].map(name => request(tx.objectStore(name).getAll())))
          .then(([series, flashcards, progress, presets, settings, reviewEvents, meta]) => {
            const identity = meta.find(row => row.key === 'library');
            const before = { format: FORMAT, formatVersion: 1, schemaVersion: 1, appVersion: '0.4', exportedAt: new Date().toISOString(),
              libraryId: identity?.libraryId, libraryGeneration: identity?.libraryGeneration,
              series: series.sort((a, b) => a.position - b.position),
              flashcards: flashcards.sort((a, b) => a.seriesId < b.seriesId ? -1 : a.seriesId > b.seriesId ? 1 : a.position - b.position),
              progress, presets, settings: Object.fromEntries(settings.map(row => [row.key, row.value])), reviewEvents };
            const converted = migrateSnapshot(before);
            if (event.oldVersion === 1) tx.objectStore('recovery').put({ key: 'pre-migration', snapshot: before });
            for (const row of converted.stepProgress) steps.add(row);
          }).catch(error => { upgradeError = error; try { tx.abort(); } catch { /* already aborted */ } });
      }
    };
    opening.onsuccess = () => {
      const db = opening.result;
      db.onversionchange = () => { db.close(); onVersionChange('Storage changed in another tab. Reload this page.'); };
      resolve(db);
    };
  });
}

// body may await IndexedDB requests only, never network, timers, or file dialogs.
export async function transaction(db, stores, mode, body) {
  const tx = db.transaction(stores, mode);
  const completed = new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new DOMException('Transaction aborted; nothing was saved.', 'AbortError'));
    tx.onerror = () => {}; // Request errors abort by default; onabort is authoritative.
  });
  try {
    const result = await body(tx);
    await completed;
    return result;
  } catch (error) {
    try { tx.abort(); } catch { /* Already aborted/completed. */ }
    await completed.catch(() => {});
    throw error;
  }
}
