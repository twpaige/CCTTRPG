import { openDatabase, request, transaction, ALL_STORES } from '../js/db.js';
import { Repository } from '../js/repository.js';
import { exportSnapshot, exportJSON, restoreJSON, contentKey } from '../js/backup.js';
import { migrateSnapshot, validateSnapshot } from '../js/validation.js';
import { nextDue, cutoff, selectReview, selectAudit, progressMap, progressKey, auditCursor, recallSeconds } from '../js/scheduler.js';
import { planMastery, changeMastery, prepareCompletion, completeStep, StepCompletionController } from '../js/mastery.js';
const check = (ok, message = 'Assertion failed') => { if (!ok) throw new Error(message); };
const equal = (a, b) => check(JSON.stringify(a) === JSON.stringify(b), `Different values: ${JSON.stringify(a)} / ${JSON.stringify(b)}`);
const rejects = async fn => { let failed = false; try { await fn(); } catch { failed = true; } check(failed, 'Expected rejection'); };
const tests = [], databases = [];
const test = (name, run) => tests.push({ name, run });
const time = Date.UTC(2024, 0, 31, 12, 15, 30);
export function legacyFixture() {
  const snapshot = { format: 'sr-learning-backup', formatVersion: 1, schemaVersion: 1, appVersion: '0.4', exportedAt: new Date(time).toISOString(), libraryId: 'legacy-library', libraryGeneration: 'legacy-generation',
    series: [{ id: 'states', name: 'States (synthetic fixture)', bound: true, position: 0, createdAt: 10, updatedAt: 20, revision: 3 }],
    flashcards: [0, 1].map(i => ({ id: `card-${i}`, name: i ? 'Final comprehensive card' : 'Delaware (synthetic fixture)', seriesId: 'states', position: i, createdAt: 10, updatedAt: 20, revision: 3,
      steps: [0, 1, 2, 3, 4].map(j => ({ id: `step-${j}`, question: `  Original Q${j}\n日本語 <b>literal</b>`, answer: `Original A${j} 🧠\n  `, position: j, ...(j === 1 ? { recallSeconds: 1800 } : {}) })) })),
    progress: [0, 1].map(i => ({ flashcardId: `card-${i}`, mastery: i ? 10 : 7, lastReviewedAt: 1000, nextDueAt: time + 123456, revision: 4 })), presets: [], settings: { recallSeconds: 4 }, reviewEvents: [] };
  return validateSnapshot(snapshot);
}
// A real old-version fixture, independent of production's new onupgradeneeded implementation.
export async function createLegacy(name, snapshot = legacyFixture()) {
  const opening = indexedDB.open(name, 1);
  opening.onupgradeneeded = () => {
    const db = opening.result;
    db.createObjectStore('series', { keyPath: 'id' }).createIndex('byPosition', 'position');
    const cards = db.createObjectStore('flashcards', { keyPath: 'id' }); cards.createIndex('bySeries', 'seriesId'); cards.createIndex('bySeriesPosition', ['seriesId', 'position']);
    const progress = db.createObjectStore('progress', { keyPath: 'flashcardId' }); progress.createIndex('byDue', 'nextDueAt'); progress.createIndex('byMastery', 'mastery');
    db.createObjectStore('presets', { keyPath: 'id' }); db.createObjectStore('settings', { keyPath: 'key' });
    const events = db.createObjectStore('reviewEvents', { keyPath: 'id' }); events.createIndex('bySessionUnit', ['sessionId', 'unitId'], { unique: true }); events.createIndex('byCompletedAt', 'completedAt');
    db.createObjectStore('meta', { keyPath: 'key' }); db.createObjectStore('recovery', { keyPath: 'key' });
  };
  const db = await request(opening);
  await transaction(db, [...db.objectStoreNames], 'readwrite', async tx => {
    for (const key of ['series', 'flashcards', 'progress', 'presets', 'reviewEvents']) for (const row of snapshot[key]) tx.objectStore(key).add(row);
    for (const [key, value] of Object.entries(snapshot.settings)) tx.objectStore('settings').add({ key, value });
    tx.objectStore('meta').add({ key: 'library', libraryId: snapshot.libraryId, libraryGeneration: snapshot.libraryGeneration });
    await request(tx.objectStore('recovery').add({ key: 'pre-import', snapshot }));
  }); db.close();
}
async function fixture(legacy = true) {
  const name = `SRLearning-test-mastery-${crypto.randomUUID()}`; databases.push({ name });
  if (legacy) await createLegacy(name);
  const db = await openDatabase({ name }); databases.push({ db }); return { name, db, repo: new Repository(db) };
}
async function alter(db, mutate) {
  const snapshot = await exportSnapshot(db), safe = JSON.stringify(snapshot); mutate(snapshot);
  await restoreJSON(db, JSON.stringify(snapshot), { confirmed: true, safetyJSON: safe });
}
async function change(db, action, confirmed = true, now = time) { return changeMastery(db, { action, confirmed, now, expectedKey: contentKey(await exportSnapshot(db)) }); }
const action = (cardId, stepId, level) => ({ type: 'step', cardId, stepId, level });
const progress = (snapshot, cardId = 'card-0', stepId = 'step-4') => progressMap(snapshot).get(progressKey(cardId, stepId));
const options = (mode = 'REVIEW', occurrenceId = crypto.randomUUID()) => ({ cardId: 'card-0', stepId: 'step-4', mode, sessionId: 'session', occurrenceId, startedAt: time, window: { type: 'max' } });

for (const [level, expected] of [900000, 10800000, 21600000, 86400000, 172800000, 259200000, 604800000, 1209600000, Date.UTC(2024, 1, 29, 12, 15, 30) - time, Date.UTC(2024, 3, 30, 12, 15, 30) - time, null].entries())
  test(`Mastery ${level} has exact approved interval`, () => equal(nextDue(level, time), expected === null ? null : time + expected));
test('Calendar months clamp leap/nonleap month ends and preserve UTC time across years/DST', () => {
  equal(nextDue(8, Date.UTC(2023, 0, 31)), Date.UTC(2023, 1, 28)); equal(nextDue(9, Date.UTC(2023, 10, 30)), Date.UTC(2024, 1, 29));
  equal(nextDue(8, Date.UTC(2024, 11, 31)), Date.UTC(2025, 0, 31)); equal(nextDue(3, Date.UTC(2024, 2, 10, 5)), Date.UTC(2024, 2, 11, 5));
});
test('Invalid mastery, timestamp, window and overflowing dates reject', async () => {
  for (const level of [-1, 11, 2.5, NaN]) await rejects(() => nextDue(level, time));
  for (const at of [-1, Infinity, NaN]) await rejects(() => nextDue(4, at));
  await rejects(() => nextDue(8, 8640000000000000)); await rejects(() => cutoff(time, { type: 'days', days: 0 }));
});
test('Final anchor and same lookahead cutoff select steps 1, 4, 5 only', () => {
  const snapshot = migrateSnapshot(legacyFixture()), days = [6, null, 10, -1, 5], levels = [6, 10, 8, 4, 7];
  snapshot.stepProgress.filter(row => row.flashcardId === 'card-0').forEach((row, i) => { row.mastery = levels[i]; row.nextDueAt = days[i] === null ? null : time + days[i] * 86400000; });
  equal(selectReview(snapshot, { now: time, window: { type: 'days', days: 7 } }), [{ mode: 'REVIEW', cardId: 'card-0', stepIds: ['step-0', 'step-3', 'step-4'] }]);
  equal(selectReview(snapshot, { now: time }), []); // Earlier overdue step is not an anchor.
  equal(selectReview(snapshot, { now: time, window: { type: 'max' } })[0].stepIds, ['step-0', 'step-2', 'step-3', 'step-4']);
});
test('BOUND order preserved; UNBOUND shuffle never changes step order or membership', () => {
  const snapshot = migrateSnapshot(legacyFixture()); snapshot.stepProgress.forEach(row => { row.mastery = 0; row.nextDueAt = 0; });
  equal(selectReview(snapshot, { now: time, random: true, rng: () => 0 }).map(unit => unit.cardId), ['card-0', 'card-1']);
  snapshot.series[0].bound = false;
  const units = selectReview(snapshot, { now: time, random: true, rng: () => 0 }); equal(units.map(unit => unit.cardId), ['card-1', 'card-0']);
  equal(units[0].stepIds, ['step-0', 'step-1', 'step-2', 'step-3', 'step-4']);
});
test('AUDIT ALL/one series uses KNOWN final steps and collapses a completely KNOWN BOUND series', () => {
  const snapshot = migrateSnapshot(legacyFixture()); equal(selectAudit(snapshot).map(unit => unit.cardId), ['card-1']); equal(selectAudit(snapshot, { seriesId: 'missing' }), []);
  snapshot.stepProgress.forEach(row => { row.mastery = 10; row.nextDueAt = null; });
  equal(selectAudit(snapshot), [{ mode: 'AUDIT', cardId: 'card-1', stepIds: ['step-4'] }]);
  snapshot.series[0].bound = false; equal(selectAudit(snapshot, { seriesId: 'states' }).length, 2);
});
test('AUDIT repeats continuously until stopped and removed eligibility disappears', () => {
  const cursor = auditCursor(), units = [{ cardId: 'a' }, { cardId: 'b' }];
  equal(Array.from({ length: 7 }, () => cursor.next(units).cardId), ['a', 'b', 'a', 'b', 'a', 'b', 'a']);
  equal(cursor.next([]), null); cursor.stop(); equal(cursor.next(units), null);
});
test('Recall override preserves zero/long values and session fallback', () => { equal(recallSeconds({}, 4), 4); equal(recallSeconds({ recallSeconds: 0 }, 4), 0); equal(recallSeconds({ recallSeconds: 1800 }, 4), 1800); });
test('Actual v1 upgrade copies every progress field without changing content or propagating across cards', async () => {
  const f = await fixture(), before = legacyFixture(), after = await exportSnapshot(f.db);
  equal(after.flashcards, before.flashcards); equal(after.series, before.series); equal(after.progress, before.progress); equal(after.libraryGeneration, before.libraryGeneration);
  for (const row of after.stepProgress) { const old = before.progress.find(old => old.flashcardId === row.flashcardId); equal({ ...row, stepId: undefined }, { ...old, nextDueAt: old.mastery === 10 ? null : old.nextDueAt, stepId: undefined }); }
  equal(progress(after).mastery, 7); equal(progress(after, 'card-1').mastery, 10);
  equal(await historicalJSON(f.db, 'pre-migration'), undefined); equal(JSON.parse(await historicalJSON(f.db)), before);
});
test('Migration and converter are idempotent; second open preserves recovery and independent step edits', async () => {
  const f = await fixture();
  await transaction(f.db, ['recovery'], 'readwrite', tx => request(tx.objectStore('recovery').put({ key: 'pre-migration', snapshot: legacyFixture() })));
  await change(f.db, action('card-0', 'step-0', 2)); const before = await exportSnapshot(f.db), recovery = await historicalJSON(f.db, 'pre-migration');
  equal(migrateSnapshot(before), before); f.db.close(); const db = await openDatabase({ name: f.name }); databases.push({ db });
  equal(contentKey(await exportSnapshot(db)), contentKey(before)); equal(await historicalJSON(db, 'pre-migration'), recovery);
});
test('Existing historical copies survive migration and successful external-file replacement unchanged', async () => {
  const name = `SRLearning-test-history-${crypto.randomUUID()}`; databases.push({ name });
  await createLegacy(name); const old = await request(indexedDB.open(name, 1));
  const historical = { ...legacyFixture(), appVersion: 'original-history' };
  await transaction(old, ['recovery'], 'readwrite', tx => request(tx.objectStore('recovery').put({ key: 'pre-migration', snapshot: historical })));
  old.close(); const db = await openDatabase({ name }); databases.push({ db });
  equal(JSON.parse(await historicalJSON(db, 'pre-migration')), historical);
  const safe = await exportJSON(db); await restoreJSON(db, safe, { confirmed: true, safetyJSON: safe });
  equal(JSON.parse(await historicalJSON(db, 'pre-migration')), historical);
  equal(JSON.parse(await historicalJSON(db)), legacyFixture());
});
test('Corrupt legacy progress aborts upgrade without altering v1 records or stores', async () => {
  const name = `SRLearning-test-corrupt-${crypto.randomUUID()}`, old = legacyFixture(); databases.push({ name }); old.progress.pop(); await createLegacy(name, old);
  await rejects(() => openDatabase({ name })); const db = await request(indexedDB.open(name, 1)); databases.push({ db });
  equal(db.version, 1); check(!db.objectStoreNames.contains('stepProgress')); equal(await request(db.transaction('flashcards').objectStore('flashcards').getAll()), old.flashcards);
});
test('Mid-migration asynchronous write failure rolls back schema, records and recovery', async () => {
  const name = `SRLearning-test-abort-${crypto.randomUUID()}`; databases.push({ name }); await createLegacy(name);
  const original = IDBObjectStore.prototype.add; let injected = false;
  IDBObjectStore.prototype.add = function (...args) { const result = original.apply(this, args); if (this.name === 'stepProgress' && !injected) { injected = true; original.apply(this, args); } return result; };
  try { await rejects(() => openDatabase({ name })); } finally { IDBObjectStore.prototype.add = original; }
  check(injected); const db = await request(indexedDB.open(name, 1)); databases.push({ db });
  equal(db.version, 1); equal(await request(db.transaction('flashcards').objectStore('flashcards').getAll()), legacyFixture().flashcards);
  equal(await request(db.transaction('recovery').objectStore('recovery').get('pre-migration')), undefined);
});
test('Final-step and I know this for sure share card/BOUND-series confirmation scopes', async () => {
  const f = await fixture(), snapshot = await exportSnapshot(f.db);
  equal(planMastery(snapshot, action('card-0', 'step-4', 10)).members, planMastery(snapshot, { type: 'known', cardId: 'card-0' }).members);
  equal(planMastery(snapshot, action('card-1', 'step-4', 10)).members.length, 10);
  await rejects(() => change(f.db, action('card-1', 'step-4', 10), false)); equal(contentKey(await exportSnapshot(f.db)), contentKey(snapshot));
  await change(f.db, action('card-0', 'step-4', 10)); check((await exportSnapshot(f.db)).stepProgress.filter(row => row.flashcardId === 'card-0').every(row => row.mastery === 10 && row.nextDueAt === null));
  await change(f.db, { type: 'resetCard', cardId: 'card-0' }); await change(f.db, { type: 'known', cardId: 'card-1' });
  check((await exportSnapshot(f.db)).stepProgress.every(row => row.mastery === 10));
});
test('Lowering KNOWN final step preserves earlier KNOWN steps; reset FC and bound objective are distinct', async () => {
  const f = await fixture(); await change(f.db, { type: 'known', cardId: 'card-1' }); await change(f.db, action('card-1', 'step-4', 2));
  let snapshot = await exportSnapshot(f.db); equal(progress(snapshot, 'card-1').mastery, 2); check(snapshot.stepProgress.filter(row => row.stepId !== 'step-4').every(row => row.mastery === 10));
  await change(f.db, { type: 'resetFinal', cardId: 'card-1' }); snapshot = await exportSnapshot(f.db); equal(progress(snapshot, 'card-1').nextDueAt, nextDue(0, time));
  await change(f.db, { type: 'resetCard', cardId: 'card-1' }); snapshot = await exportSnapshot(f.db); check(snapshot.stepProgress.filter(row => row.flashcardId === 'card-0').every(row => row.mastery === 10));
  await change(f.db, { type: 'resetObjective', cardId: 'card-1' }); check((await exportSnapshot(f.db)).stepProgress.every(row => row.mastery === 0));
});
test('Manual mastery changes only affected progress, schedules from change time and preserves last review', async () => {
  const f = await fixture(), before = await exportSnapshot(f.db); await change(f.db, action('card-0', 'step-1', 8)); const after = await exportSnapshot(f.db);
  equal(after.flashcards, before.flashcards); equal(after.progress, before.progress); equal(progress(after, 'card-0', 'step-1').nextDueAt, nextDue(8, time)); equal(progress(after, 'card-0', 'step-1').lastReviewedAt, 1000);
  equal(after.stepProgress.filter(row => row.flashcardId !== 'card-0' || row.stepId !== 'step-1'), before.stepProgress.filter(row => row.flashcardId !== 'card-0' || row.stepId !== 'step-1'));
});
test('Stale manual write rejects after unrelated change and after restoration', async () => {
  const f = await fixture(), key = contentKey(await exportSnapshot(f.db)); await f.repo.setSetting('rate', 1.1);
  await rejects(() => changeMastery(f.db, { action: action('card-0', 'step-0', 3), expectedKey: key }));
  const safe = await exportJSON(f.db); await restoreJSON(f.db, safe, { confirmed: true, safetyJSON: safe });
  await rejects(() => changeMastery(f.db, { action: action('card-0', 'step-0', 3), expectedKey: contentKey(JSON.parse(safe)) }));
});
test('Due REVIEW completion restarts interval once, without mastery increase or other-step changes', async () => {
  const f = await fixture(); await alter(f.db, s => { progress(s).nextDueAt = time; }); const before = await exportSnapshot(f.db), prepared = await prepareCompletion(f.db, options());
  equal(await completeStep(f.db, prepared, { successful: true, completedAt: time + 100 }), { applied: true });
  const after = await exportSnapshot(f.db); equal(progress(after).mastery, 7); equal(progress(after).lastReviewedAt, time + 100); equal(progress(after).nextDueAt, nextDue(7, time + 100));
  equal(await completeStep(f.db, prepared, { successful: true, completedAt: time + 500 }), { applied: false, duplicate: true });
  equal(contentKey(await exportSnapshot(f.db)), contentKey(after)); equal(after.stepProgress.filter(row => row.stepId !== 'step-4'), before.stepProgress.filter(row => row.stepId !== 'step-4'));
});
test('Early lookahead preserves due date even when the due time passes during playback', async () => {
  const f = await fixture(); await alter(f.db, s => { progress(s).nextDueAt = time + 50; }); const before = await exportSnapshot(f.db), prepared = await prepareCompletion(f.db, options());
  equal(await completeStep(f.db, prepared, { successful: true, completedAt: time + 100 }), { applied: false }); equal(contentKey(await exportSnapshot(f.db)), contentKey(before));
});
test('Overdue step in lookahead restarts timer; FOCUSED and successful/failed AUDIT never schedule', async () => {
  const f = await fixture(); await alter(f.db, s => { progress(s).nextDueAt = time - 1; });
  await completeStep(f.db, await prepareCompletion(f.db, options()), { successful: true, completedAt: time + 10 }); equal(progress(await exportSnapshot(f.db)).nextDueAt, nextDue(7, time + 10));
  const before = await exportSnapshot(f.db);
  await completeStep(f.db, await prepareCompletion(f.db, options('FOCUSED')), { successful: true, completedAt: time + 10 });
  const audit = await prepareCompletion(f.db, { ...options('AUDIT'), cardId: 'card-1' }); await completeStep(f.db, audit, { successful: true, completedAt: time + 10 });
  await rejects(() => completeStep(f.db, audit, { successful: false })); equal(contentKey(await exportSnapshot(f.db)), contentKey(before));
});
test('Pending mastery commits after success only; interrupted and duplicate callbacks are harmless', async () => {
  const f = await fixture(), controller = new StepCompletionController(f.db), before = await exportSnapshot(f.db);
  const first = await controller.begin(options('FOCUSED')); controller.pendingMastery(3); equal(contentKey(await exportSnapshot(f.db)), contentKey(before)); controller.interrupt();
  await rejects(() => controller.finish(first, time + 100)); equal(contentKey(await exportSnapshot(f.db)), contentKey(before));
  const second = await controller.begin(options('FOCUSED')); controller.pendingMastery(8); await controller.finish(second, time + 100); await controller.finish(second, time + 200);
  equal(progress(await exportSnapshot(f.db)).nextDueAt, nextDue(8, time + 100));
});
test('Special playback actions pause and require confirmation; cancellation does not mutate', async () => {
  const f = await fixture(), controller = new StepCompletionController(f.db), before = await exportSnapshot(f.db); let paused = false;
  await controller.special({ type: 'known', cardId: 'card-1' }, { pause: async () => { paused = true; }, confirm: async text => { check(paused); check(text.includes('entire BOUND series')); return false; }, now: time });
  equal(contentKey(await exportSnapshot(f.db)), contentKey(before));
});
test('Pending mastery on a completed due REVIEW records completion and uses the newly chosen interval', async () => {
  const f = await fixture(); await alter(f.db, s => { progress(s).nextDueAt = time; });
  const controller = new StepCompletionController(f.db), token = await controller.begin(options()); controller.pendingMastery(3); await controller.finish(token, time + 100);
  const row = progress(await exportSnapshot(f.db)); equal(row.mastery, 3); equal(row.lastReviewedAt, time + 100); equal(row.nextDueAt, nextDue(3, time + 100));
});
test('Completion receipt failure rolls back progress; retry applies exactly once', async () => {
  const f = await fixture(); await alter(f.db, s => { progress(s).nextDueAt = time; }); const before = await exportSnapshot(f.db), prepared = await prepareCompletion(f.db, options());
  const original = IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = function (...args) { if (this.name === 'stepEvents') throw new DOMException('Simulated full disk', 'QuotaExceededError'); return original.apply(this, args); };
  try { await rejects(() => completeStep(f.db, prepared, { successful: true, completedAt: time + 100 })); } finally { IDBObjectStore.prototype.add = original; }
  equal(contentKey(await exportSnapshot(f.db)), contentKey(before));
  await completeStep(f.db, prepared, { successful: true, completedAt: time + 100 }); equal(progress(await exportSnapshot(f.db)).nextDueAt, nextDue(7, time + 100));
});
test('Multi-step KNOWN propagation failure is atomic and leaves every prior level intact', async () => {
  const f = await fixture(), before = await exportSnapshot(f.db), original = IDBObjectStore.prototype.put; let count = 0;
  IDBObjectStore.prototype.put = function (...args) { if (this.name === 'stepProgress' && ++count === 3) throw new DOMException('Simulated full disk', 'QuotaExceededError'); return original.apply(this, args); };
  try { await rejects(() => change(f.db, { type: 'known', cardId: 'card-1' })); } finally { IDBObjectStore.prototype.put = original; }
  equal(contentKey(await exportSnapshot(f.db)), contentKey(before));
});
test('Completion rejects changed content/mastery, restored generations and backwards time', async () => {
  const f = await fixture(), prepared = await prepareCompletion(f.db, options('FOCUSED'));
  await rejects(() => completeStep(f.db, prepared, { successful: true, completedAt: time - 1 }));
  await change(f.db, action('card-0', 'step-4', 2)); await rejects(() => completeStep(f.db, prepared, { successful: true, completedAt: time + 1 }));
  const next = await prepareCompletion(f.db, options('FOCUSED')), safe = await exportJSON(f.db); await restoreJSON(f.db, safe, { confirmed: true, safetyJSON: safe });
  await rejects(() => completeStep(f.db, next, { successful: true, completedAt: time + 1 }));
});
test('Editing/reordering retains independent progress; new/deleted steps create/remove only their records', async () => {
  const f = await fixture(); await change(f.db, action('card-0', 'step-0', 2)); const before = await exportSnapshot(f.db), card = await f.repo.getCard('card-0');
  const changed = await f.repo.updateCard(card.id, { steps: [...card.steps].reverse() }, card.revision); equal((await exportSnapshot(f.db)).stepProgress, before.stepProgress);
  await f.repo.updateCard(card.id, { steps: [...changed.steps.slice(1), { question: 'New?', answer: 'New.' }] }, changed.revision);
  const after = await exportSnapshot(f.db); equal(after.stepProgress.length, 10); check(!after.stepProgress.some(row => row.flashcardId === card.id && row.stepId === 'step-4')); equal(progress(after, 'card-0', 'step-0').mastery, 2);
  equal(after.flashcards[0].steps.find(step => step.id === 'step-1').recallSeconds, 1800);
});
test('Version 1/2 JSON recovery, original snapshots and step-completion receipts round-trip', async () => {
  const f = await fixture(false), old = legacyFixture(); await restoreJSON(f.db, JSON.stringify(old), { confirmed: true, safetyJSON: await exportJSON(f.db) });
  equal((await exportSnapshot(f.db)).flashcards, old.flashcards); await change(f.db, action('card-0', 'step-0', 1));
  const controller = new StepCompletionController(f.db), token = await controller.begin(options('FOCUSED')); controller.pendingMastery(2); await controller.finish(token, time + 1);
  const before = await exportSnapshot(f.db), target = await fixture(false); await restoreJSON(target.db, JSON.stringify(before), { confirmed: true, safetyJSON: await exportJSON(target.db) });
  const after = await exportSnapshot(target.db); after.libraryGeneration = before.libraryGeneration; equal(contentKey(after), contentKey(before));
});
test('Corrupt step snapshots fail without mutation (missing/duplicate/dangling/KNOWN due/receipt)', async () => {
  const f = await fixture(); const json = await exportJSON(f.db);
  for (const mutate of [s => s.stepProgress.pop(), s => s.stepProgress.push(s.stepProgress[0]), s => s.stepProgress[0].stepId = 'absent', s => s.stepProgress[0].mastery = 10, s => s.stepEvents.push({ id: 'bad' })]) {
    const bad = JSON.parse(json); mutate(bad); await rejects(() => restoreJSON(f.db, JSON.stringify(bad), { confirmed: true, safetyJSON: json })); equal(contentKey(await exportSnapshot(f.db)), contentKey(JSON.parse(json)));
  }
});
test('1,000-card / 10,000-step migration, filtering and independent write preserve exact content', async () => {
  const f = await fixture(false), legacy = legacyFixture(); legacy.series[0].bound = false;
  legacy.flashcards = Array.from({ length: 1000 }, (_, i) => ({ ...legacy.flashcards[0], id: `scale-${i}`, position: i, steps: Array.from({ length: 10 }, (_, j) => ({ id: `s-${j}`, position: j, question: `Q${j}`, answer: `A${j}` })) }));
  legacy.progress = legacy.flashcards.map(card => ({ flashcardId: card.id, mastery: 4, lastReviewedAt: null, nextDueAt: 0, revision: 1 }));
  const start = performance.now(); await restoreJSON(f.db, JSON.stringify(legacy), { confirmed: true, safetyJSON: await exportJSON(f.db) });
  const snapshot = await exportSnapshot(f.db); equal(snapshot.flashcards, legacy.flashcards); equal(snapshot.stepProgress.length, 10000);
  const selectionStart = performance.now(); equal(selectReview(snapshot, { now: time, random: true }).length, 1000); const selectionMs = performance.now() - selectionStart;
  await change(f.db, action('scale-500', 's-5', 8)); const after = await exportSnapshot(f.db); equal(after.flashcards, snapshot.flashcards);
  equal(after.stepProgress.filter(row => row.flashcardId !== 'scale-500' || row.stepId !== 's-5'), snapshot.stepProgress.filter(row => row.flashcardId !== 'scale-500' || row.stepId !== 's-5'));
  globalThis.srMasteryScale = { totalMs: performance.now() - start, selectionMs };
});
export async function runMasteryTests(report = () => {}) {
  const results = [];
  for (const { name, run } of tests) {
    try { await run(); results.push({ name, pass: true }); } catch (error) { results.push({ name, pass: false, error: error.stack || String(error) }); }
    finally { for (const item of databases) item.db?.close(); for (const { name } of databases.splice(0)) if (name) await request(indexedDB.deleteDatabase(name)); }
    report(results.at(-1));
  }
  return results;
}

// Test-only inspection: obsolete records must survive updates without an application export API.
async function historicalJSON(db, key = 'pre-import') {
  const row = await request(db.transaction('recovery').objectStore('recovery').get(key));
  return row ? JSON.stringify(row.snapshot) : undefined;
}
