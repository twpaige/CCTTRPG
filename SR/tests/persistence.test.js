import { openDatabase, request, transaction, ALL_STORES, DB_VERSION } from '../js/db.js';
import { Repository } from '../js/repository.js';
import { exportJSON, exportSnapshot, restoreJSON, contentKey, previewImport } from '../js/backup.js';
import { parseSnapshot } from '../js/validation.js';
const check = (ok, message = 'Assertion failed') => { if (!ok) throw new Error(message); };
const equal = (a, b) => check(JSON.stringify(a) === JSON.stringify(b), `Different values: ${JSON.stringify(a)} / ${JSON.stringify(b)}`);
const rejects = async fn => { let caught = false; try { await fn(); } catch { caught = true; } check(caught, 'Expected rejection'); };
const tests = [];
const test = (name, run) => tests.push({ name, run });
const databases = [];
async function fixture() {
  const name = `SRLearning-test-${crypto.randomUUID()}`;
  const db = await openDatabase({ name }); databases.push({ name, db });
  return { db, repo: new Repository(db), name };
}
const step = { question: '  Where?\n日本語 🧠 <script>literal</script>', answer: 'Café — עִבְרִית\nSecond line\t  ' };
async function seed(f, count = 2) {
  const series = await f.repo.createSeries({ name: 'Synthetic bound series', bound: true });
  const cards = [];
  for (let i = 0; i < count; i++) cards.push(await f.repo.createCard({ seriesId: series.id, name: `Card ${i}`, steps: [step, { question: 'Second?', answer: 'Yes' }] }));
  return { series, cards };
}
test('Initialization creates current-version stores/indexes and stable library identity', async () => {
  const f = await fixture(); equal(f.db.version, DB_VERSION); equal([...f.db.objectStoreNames].sort(), [...ALL_STORES].sort());
  const first = await exportSnapshot(f.db); f.db.close(); const reopened = await openDatabase({ name: f.name }); databases.push({ db: reopened });
  equal((await exportSnapshot(reopened)).libraryId, first.libraryId);
  const tx = reopened.transaction(['progress', 'flashcards', 'reviewEvents']);
  check(tx.objectStore('progress').indexNames.contains('byDue')); check(tx.objectStore('flashcards').indexNames.contains('bySeriesPosition'));
  check(tx.objectStore('reviewEvents').index('bySessionUnit').unique);
});
test('Series CRUD retains IDs and contiguous positions', async () => {
  const f = await fixture(); const a = await f.repo.createSeries({ name: 'a', bound: false });
  const b = await f.repo.createSeries({ name: 'b', bound: true, position: 0 });
  equal((await f.repo.listSeries()).map(row => row.id), [b.id, a.id]);
  const updated = await f.repo.updateSeries(b.id, { name: 'B', position: 1 }, b.revision); equal(updated.id, b.id);
  equal((await f.repo.listSeries()).map(row => row.position), [0, 1]);
  await rejects(() => f.repo.deleteSeries(b.id, updated.revision));
  await f.repo.deleteSeries(b.id, updated.revision, { confirmed: true }); equal(await f.repo.getSeries(b.id), undefined);
});
test('Card creation atomically writes progress, steps and stable IDs', async () => {
  const f = await fixture(), { cards } = await seed(f, 1); const card = await f.repo.getCard(cards[0].id);
  equal(card.steps[0].question, step.question); equal(card.steps[0].answer, step.answer);
  equal(card.steps.map(s => s.position), [0, 1]); equal(card.steps.map(s => s.id), cards[0].steps.map(s => s.id));
  equal(await f.repo.getProgress(card.id), { flashcardId: card.id, mastery: 0, lastReviewedAt: null, nextDueAt: 0, revision: 1 });
});
test('Step reorder, insertion, deletion and 100-step cards preserve authored order', async () => {
  const f = await fixture(), { cards } = await seed(f, 1); const card = cards[0];
  const updated = await f.repo.updateCard(card.id, { steps: [...card.steps].reverse() }, card.revision);
  equal(updated.steps.map(s => s.id), card.steps.map(s => s.id).reverse()); equal(updated.steps.map(s => s.position), [0, 1]);
  const large = await f.repo.updateCard(card.id, { steps: Array.from({ length: 100 }, (_, i) => ({ question: `Q${i}`, answer: `A${i}` })) }, updated.revision);
  equal(large.steps.length, 100);
  const small = await f.repo.updateCard(card.id, { steps: large.steps.slice(50) }, large.revision); equal(small.steps[0].question, 'Q50');
});
test('Card move updates both series positions and indexed ID-only retrieval', async () => {
  const f = await fixture(), { series, cards } = await seed(f, 3);
  const second = await f.repo.createSeries({ name: 'Second', bound: false });
  await f.repo.updateCard(cards[1].id, { seriesId: second.id }, cards[1].revision);
  equal((await f.repo.listCards(series.id)).map(row => row.position), [0, 1]); equal(await f.repo.listCardIds(second.id), [cards[1].id]);
});
test('Progress updates do not rewrite content or other progress; due index includes zero', async () => {
  const f = await fixture(), { cards } = await seed(f); const before = await f.repo.getCard(cards[0].id), other = await f.repo.getProgress(cards[1].id);
  await f.repo.updateProgress(cards[0].id, { mastery: 10, lastReviewedAt: 1000, nextDueAt: 5000 }, 1);
  equal(await f.repo.getCard(cards[0].id), before); equal(await f.repo.getProgress(cards[1].id), other);
  equal((await f.repo.listDue(4999)).map(row => row.flashcardId), [cards[1].id]); equal((await f.repo.listDue(5000)).length, 2);
});
test('Stale content/progress revisions reject lost updates', async () => {
  const f = await fixture(), { cards } = await seed(f, 1); const card = cards[0];
  await f.repo.updateCard(card.id, { name: 'New' }, 1);
  await rejects(() => f.repo.updateCard(card.id, { name: 'Stale' }, 1));
  await f.repo.updateProgress(card.id, { mastery: 4 }, 1); await rejects(() => f.repo.updateProgress(card.id, { mastery: 9 }, 1));
});
test('Duplicate card IDs and missing series reject without partial progress/content', async () => {
  const f = await fixture(), { cards } = await seed(f, 1), before = contentKey(await exportSnapshot(f.db));
  const { id, seriesId, steps } = cards[0];
  await rejects(() => f.repo.createCard({ id, seriesId, steps, name: 'Duplicate' }));
  await rejects(() => f.repo.createCard({ seriesId: 'missing', steps, name: 'Missing' }));
  equal(contentKey(await exportSnapshot(f.db)), before);
});
test('Presets and allowlisted settings round-trip; secret/unknown settings fail', async () => {
  const f = await fixture(), { series, cards } = await seed(f);
  const preset = await f.repo.savePreset({ name: 'Focus', seriesIds: [series.id], cardIds: [cards[0].id], mode: 'focused', order: 'sequential', grouping: 'individual' });
  equal(await f.repo.getPreset(preset.id), preset);
  await f.repo.setSetting('desktopVoice', { name: 'Google UK English Male', language: 'en-GB', voiceURI: 'voice' }); await f.repo.setSetting('rate', .9);
  equal((await f.repo.getSettings()).rate, .9); await rejects(() => f.repo.setSetting('oauthToken', 'secret'));
  await rejects(() => f.repo.savePreset({ name: 'bad', seriesIds: ['absent'], cardIds: [], mode: 'focused', order: 'random', grouping: 'auto' }));
  await f.repo.deletePreset(preset.id, preset.revision); equal((await f.repo.listPresets()).length, 0);
});
test('Card and series cascades remove progress/references and normalize ordering', async () => {
  const f = await fixture(), { series, cards } = await seed(f, 3);
  const preset = await f.repo.savePreset({ name: 'Focus', seriesIds: [series.id], cardIds: cards.map(c => c.id), mode: 'focused', order: 'random', grouping: 'auto' });
  await f.repo.deleteCard(cards[1].id, 1); equal(await f.repo.getProgress(cards[1].id), undefined);
  equal((await f.repo.getPreset(preset.id)).cardIds, [cards[0].id, cards[2].id]);
  equal((await f.repo.listCards(series.id)).map(c => c.position), [0, 1]);
  await f.repo.deleteSeries(series.id, 1, { confirmed: true });
  equal((await f.repo.getPreset(preset.id)).seriesIds, []); equal((await f.repo.listDue()).length, 0);
  parseSnapshot(await exportJSON(f.db));
});
test('Deliberate transaction abort rolls back all participating stores', async () => {
  const f = await fixture(); await seed(f); const before = await exportSnapshot(f.db);
  await rejects(() => transaction(f.db, ['flashcards', 'progress'], 'readwrite', async tx => {
    await request(tx.objectStore('flashcards').clear()); tx.objectStore('progress').clear(); tx.abort();
  }));
  equal(contentKey(await exportSnapshot(f.db)), contentKey(before));
});
test('Complete JSON round-trip preserves Unicode, whitespace, references, settings and progress', async () => {
  const f = await fixture(), { series, cards } = await seed(f);
  await f.repo.updateProgress(cards[0].id, { mastery: 8, lastReviewedAt: 123, nextDueAt: 999 }, 1);
  await f.repo.setSetting('recallSeconds', 4); await f.repo.setSetting('androidVoice', { name: 'Local', language: 'en-US' });
  await f.repo.savePreset({ name: 'Selected', seriesIds: [series.id], cardIds: [cards[0].id], mode: 'due', order: 'random', grouping: 'full' });
  const original = await exportSnapshot(f.db), target = await fixture();
  await restoreJSON(target.db, JSON.stringify(original), { confirmed: true, safetyJSON: await exportJSON(target.db) });
  const restored = await exportSnapshot(target.db); check(restored.libraryGeneration !== original.libraryGeneration);
  restored.libraryGeneration = original.libraryGeneration;
  equal(contentKey(restored), contentKey(original));
});
test('Confirmation and matching safety backup are both required', async () => {
  const f = await fixture(); await seed(f); const json = await exportJSON(f.db);
  await rejects(() => restoreJSON(f.db, json, { safetyJSON: json })); await rejects(() => restoreJSON(f.db, json, { confirmed: true }));
  await f.repo.setSetting('rate', 1.1); const before = contentKey(await exportSnapshot(f.db));
  await rejects(() => restoreJSON(f.db, json, { confirmed: true, safetyJSON: json })); equal(contentKey(await exportSnapshot(f.db)), before);
});
test('External outgoing backup restores previous library without creating an internal recovery copy', async () => {
  const f = await fixture(); await seed(f); const original = await exportJSON(f.db), other = await fixture();
  await restoreJSON(f.db, await exportJSON(other.db), { confirmed: true, safetyJSON: original });
  equal(await historicalJSON(f.db), undefined);
  await restoreJSON(f.db, original, { confirmed: true, safetyJSON: await exportJSON(f.db) });
  equal((await exportSnapshot(f.db)).flashcards.length, 2);
});
const invalid = [
  ['malformed JSON', () => '{truncated'],
  ['future format', s => { s.formatVersion = 99; }], ['future schema', s => { s.schemaVersion = 99; }],
  ['duplicate IDs', s => { s.flashcards.push(s.flashcards[0]); }], ['missing ID', s => { delete s.series[0].id; }],
  ['missing progress', s => { s.progress.pop(); }], ['dangling series', s => { s.flashcards[0].seriesId = 'absent'; }],
  ['invalid mastery', s => { s.progress[0].mastery = 10.5; }], ['negative timestamp', s => { s.progress[0].lastReviewedAt = -1; }],
  ['invalid calendar timestamp', s => { s.exportedAt = '2026-02-30T00:00:00.000Z'; }],
  ['null due is not a known legacy format', s => { s.progress[0].nextDueAt = null; }],
  ['duplicate step IDs', s => { s.flashcards[0].steps[1].id = s.flashcards[0].steps[0].id; }],
  ['incorrect step order', s => { s.flashcards[0].steps.reverse(); }],
  ['duplicate positions', s => { s.flashcards[1].position = 0; }],
  ['card array/order mismatch', s => { s.flashcards.reverse(); }],
  ['dangling preset references', s => { s.presets.push({ id: 'p', name: 'P', seriesIds: [], cardIds: ['missing'], mode: 'focused', order: 'random', grouping: 'auto', createdAt: 0, updatedAt: 0, revision: 1 }); }],
  ['invalid recitation references', s => { s.flashcards[0].recitationStepIds = ['missing']; }],
  ['unknown fields', s => { s.flashcards[0].password = 'not allowed'; }],
  ['unsafe keys', s => JSON.stringify(s).replace('"settings":{}', '"settings":{"__proto__":{}}')],
];
for (const [name, mutate] of invalid) test(`Invalid import (${name}) leaves the library unchanged`, async () => {
  const f = await fixture(); await seed(f); const safe = await exportJSON(f.db), snapshot = JSON.parse(safe);
  const output = mutate(snapshot), json = typeof output === 'string' ? output : JSON.stringify(snapshot);
  await rejects(() => restoreJSON(f.db, json, { confirmed: true, safetyJSON: safe }));
  equal(contentKey(await exportSnapshot(f.db)), contentKey(parseSnapshot(safe)));
});
test('Mid-restore write failure after clears rolls back library and prior recovery', async () => {
  const f = await fixture(); await seed(f); const json = await exportJSON(f.db);
  await transaction(f.db, ['recovery'], 'readwrite', tx => request(tx.objectStore('recovery').put({ key: 'pre-import', snapshot: JSON.parse(json) })));
  await restoreJSON(f.db, json, { confirmed: true, safetyJSON: json });
  const safe = await exportJSON(f.db), recovery = await historicalJSON(f.db), original = IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = function (...args) {
    if (this.name === 'progress') throw new DOMException('Simulated disk full', 'QuotaExceededError');
    return original.apply(this, args);
  };
  try { await rejects(() => restoreJSON(f.db, json, { confirmed: true, safetyJSON: safe })); }
  finally { IDBObjectStore.prototype.add = original; }
  equal(contentKey(await exportSnapshot(f.db)), contentKey(parseSnapshot(safe))); equal(await historicalJSON(f.db), recovery);
});
test('Blocked upgrade waits for old connection; aborted upgrade preserves version/data', async () => {
  const f = await fixture(); await seed(f); const safe = await exportJSON(f.db); f.db.close();
  const blocker = await request(indexedDB.open(f.name, DB_VERSION));
  let blocked = false;
  const opening = indexedDB.open(f.name, DB_VERSION + 1);
  opening.onblocked = () => { blocked = true; blocker.close(); };
  opening.onupgradeneeded = () => { opening.result.createObjectStore('temporary'); opening.transaction.abort(); };
  await rejects(() => request(opening)); check(blocked, 'Upgrade was not blocked');
  const db = await openDatabase({ name: f.name }); databases.push({ db }); equal(db.version, DB_VERSION);
  equal(contentKey(await exportSnapshot(db)), contentKey(parseSnapshot(safe)));
});
test('Asynchronous constraint failure during replacement rolls back all stores', async () => {
  const f = await fixture(); await seed(f); const safe = await exportJSON(f.db), original = IDBObjectStore.prototype.add;
  let injected = false;
  IDBObjectStore.prototype.add = function (...args) {
    const operation = original.apply(this, args);
    if (this.name === 'progress' && !injected) { injected = true; original.apply(this, args); }
    return operation;
  };
  try { await rejects(() => restoreJSON(f.db, safe, { confirmed: true, safetyJSON: safe })); }
  finally { IDBObjectStore.prototype.add = original; }
  check(injected); equal(contentKey(await exportSnapshot(f.db)), contentKey(parseSnapshot(safe)));
});
test('Versionchange closes old connection; future database version is rejected without deleting data', async () => {
  const f = await fixture(); await seed(f);
  const opening = indexedDB.open(f.name, DB_VERSION + 1); opening.onupgradeneeded = () => opening.result.createObjectStore('future');
  const future = await request(opening); databases.push({ db: future });
  await rejects(() => openDatabase({ name: f.name }));
  equal(await request(future.transaction('flashcards').objectStore('flashcards').count()), 2);
});
test('1,000 cards × 10 steps export/restore/reopen works for five measured runs', async () => {
  const f = await fixture(), { series, cards } = await seed(f, 1), base = await exportSnapshot(f.db);
  base.flashcards = Array.from({ length: 1000 }, (_, i) => ({ ...cards[0], id: `card-${i}`, position: i,
    steps: Array.from({ length: 10 }, (_, j) => ({ id: `step-${j}`, position: j, ...step })) }));
  base.progress = base.flashcards.map(card => ({ flashcardId: card.id, mastery: 5, lastReviewedAt: null, nextDueAt: 0, revision: 1 }));
  base.stepProgress = base.flashcards.flatMap(card => card.steps.map(step => ({ flashcardId: card.id, stepId: step.id, mastery: 5, lastReviewedAt: null, nextDueAt: 0, revision: 1 })));
  const timings = [];
  for (let i = 0; i < 5; i++) {
    const safetyJSON = await exportJSON(f.db), start = performance.now();
    await restoreJSON(f.db, JSON.stringify(base), { confirmed: true, safetyJSON });
    const json = await exportJSON(f.db); timings.push(performance.now() - start);
    equal(previewImport(json).counts.steps, 10000);
  }
  equal((await f.repo.listCardIds(series.id)).length, 1000);
  f.db.close(); const db = await openDatabase({ name: f.name }); databases.push({ db });
  equal((await exportSnapshot(db)).flashcards.length, 1000);
  globalThis.srScaleTimings = timings;
});
export async function runPersistenceTests(report = () => {}) {
  const results = [];
  for (const { name, run } of tests) {
    try { await run(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.stack || String(error) }); }
    finally {
      for (const item of databases) item.db.close();
      for (const { name } of databases.splice(0)) if (name) await request(indexedDB.deleteDatabase(name));
    }
    report(results.at(-1));
  }
  return results;
}
export async function exampleBackup() {
  const name = `SRLearning-test-example-${crypto.randomUUID()}`;
  const db = await openDatabase({ name });
  try { await seed({ db, repo: new Repository(db) }); return await exportJSON(db); }
  finally { db.close(); await request(indexedDB.deleteDatabase(name)); }
}

// Test-only inspection: obsolete records must survive updates without an application export API.
async function historicalJSON(db, key = 'pre-import') {
  const row = await request(db.transaction('recovery').objectStore('recovery').get(key));
  return row ? JSON.stringify(row.snapshot) : undefined;
}
