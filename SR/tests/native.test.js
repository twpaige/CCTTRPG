import { openDatabase, request } from '../js/db.js';
import { exportSnapshot, exportJSON, restoreJSON, contentKey } from '../js/backup.js';
import { migrateSnapshot } from '../js/validation.js';
import { legacyFixture, createLegacy } from './mastery.test.js';
import { buildNativePlan, reconcileNative } from '../js/native-study.js';
import { selectReview, selectAudit, nextDue } from '../js/scheduler.js';
import { changeMastery } from '../js/mastery.js';
const tests = [], fixtures = [], time = 2000000000000;
const test = (name, fn) => tests.push({ name, fn });
const check = (value, message = 'Assertion failed') => { if (!value) throw new Error(message); };
const equal = (a, b) => check(JSON.stringify(a) === JSON.stringify(b), 'Values differ');
const rejects = async fn => { let failed = false; try { await fn(); } catch { failed = true; } check(failed, 'Expected rejection'); };
async function fixture() {
  const name = `SRLearning-test-native-${crypto.randomUUID()}`; await createLegacy(name); const db = await openDatabase({ name }); fixtures.push({ name, db });
  const snapshot = await exportSnapshot(db), plan = buildNativePlan(snapshot, { now: time });
  const rows = [], native = { completions: () => JSON.stringify(rows.slice(0, 32)), acknowledge: id => { if (rows[0]?.queueId !== id) return false; rows.shift(); return true; } };
  const complete = (index = 0, start = time) => { const unit = plan.units[index]; const row = { ...unit, queueId: crypto.randomUUID(), sessionId: plan.sessionId, occurrenceId: String(index), libraryGeneration: plan.libraryGeneration, mode: plan.mode, startedAt: start, completedAt: start + 10000 }; rows.push(row); return row; };
  return { db, snapshot, plan, rows, native, complete };
}
test('Native REVIEW selection matches shared anchors, window, BOUND ordering and exact text', () => {
  const snapshot = migrateSnapshot(legacyFixture());
  for (const window of [{ type: 'now' }, { type: 'days', days: 7 }, { type: 'max' }]) {
    const expected = selectReview(snapshot, { now: time, window }).flatMap(card => card.stepIds.map(stepId => [card.cardId, stepId]));
    const plan = buildNativePlan(snapshot, { now: time, window }); equal(plan.units.map(row => [row.cardId, row.stepId]), expected);
    equal(plan.units.map(row => row.question), snapshot.flashcards[0].steps.map(row => row.question));
  }
});
test('Native AUDIT ALL/one series uses shared final-only eligibility and rejects empty selection', async () => {
  const snapshot = migrateSnapshot(legacyFixture()), plan = buildNativePlan(snapshot, { mode: 'AUDIT', seriesId: 'states', now: time });
  equal(plan.units.map(row => row.stepId), selectAudit(snapshot).flatMap(row => row.stepIds)); check(plan.units.length === 1);
  await rejects(() => buildNativePlan(snapshot, { mode: 'AUDIT', seriesId: 'missing' }));
});
test('Long/zero/default recall and long Unicode text survive plan preparation exactly', () => {
  const snapshot = migrateSnapshot(legacyFixture()); snapshot.flashcards[0].steps[0].recallSeconds = 0;
  snapshot.flashcards[0].steps[0].answer = '  日本語 🧠\n'.repeat(1000);
  const plan = buildNativePlan(snapshot, { now: time, recall: 8 });
  equal(plan.units.map(row => row.recallMs), [0, 1800000, 8000, 8000, 8000]); equal(plan.units[0].answer, snapshot.flashcards[0].steps[0].answer);
});
test('Invalid modes, intervals and oversized complete plans fail before playback, without truncation', async () => {
  const snapshot = migrateSnapshot(legacyFixture());
  for (const options of [{ mode: 'FOCUSED' }, { rate: 0 }, { recall: Infinity }, { window: { type: 'days', days: 0 } }]) await rejects(() => buildNativePlan(snapshot, { now: time, ...options }));
  snapshot.flashcards[0].steps[0].answer = 'x'.repeat(17 * 1024 * 1024); await rejects(() => buildNativePlan(snapshot, { now: time }));
});
test('Due completion uses actual native step start/completion and updates only that step', async () => {
  const f = await fixture(), row = f.complete(); await reconcileNative(f.db, f.native); const after = await exportSnapshot(f.db);
  const progress = after.stepProgress.find(p => p.flashcardId === row.cardId && p.stepId === row.stepId);
  check(progress.lastReviewedAt === row.completedAt && progress.nextDueAt === nextDue(row.mastery, row.completedAt));
  equal(after.flashcards, f.snapshot.flashcards); check(after.stepEvents.length === 1 && f.rows.length === 0);
});
test('Lost acknowledgement retries existing receipt without scheduling twice', async () => {
  const f = await fixture(); f.complete(); const acknowledge = f.native.acknowledge; f.native.acknowledge = () => false;
  await rejects(() => reconcileNative(f.db, f.native)); const after = contentKey(await exportSnapshot(f.db));
  f.native.acknowledge = acknowledge; await reconcileNative(f.db, f.native); equal(contentKey(await exportSnapshot(f.db)), after);
});
test('Early-at-start completion preserves dates even if due passes during answer', async () => {
  const f = await fixture(); const row = f.complete(); row.startedAt = row.nextDueAt - 1; row.completedAt = row.nextDueAt + 10000;
  await reconcileNative(f.db, f.native); equal(contentKey(await exportSnapshot(f.db)), contentKey(f.snapshot));
});
test('AUDIT repeated completions acknowledge with no progress or history changes', async () => {
  const f = await fixture(), audit = buildNativePlan(f.snapshot, { mode: 'AUDIT' });
  for (let i = 0; i < 3; i++) f.rows.push({ ...audit.units[0], mode: 'AUDIT', sessionId: audit.sessionId, occurrenceId: String(i), libraryGeneration: audit.libraryGeneration, queueId: String(i), startedAt: time, completedAt: time + 1 });
  await reconcileNative(f.db, f.native); equal(contentKey(await exportSnapshot(f.db)), contentKey(f.snapshot)); check(f.rows.length === 0);
});
test('Stale progress and replaced generations remain queued instead of overwriting or dropping', async () => {
  const f = await fixture(); const row = f.complete(); await changeMastery(f.db, { action: { type: 'step', cardId: row.cardId, stepId: row.stepId, level: 3 }, expectedKey: contentKey(f.snapshot), now: time });
  await rejects(() => reconcileNative(f.db, f.native)); check(f.rows.length === 1);
  const current = await exportJSON(f.db); await restoreJSON(f.db, current, { confirmed: true, safetyJSON: current }); await rejects(() => reconcileNative(f.db, f.native)); check(f.rows.length === 1);
});
test('Completion transaction failure retains queue and permits safe retry', async () => {
  const f = await fixture(); f.complete(); const add = IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = function(...args) { if (this.name === 'stepEvents') throw new Error('Injected disk failure'); return add.apply(this, args); };
  try { await rejects(() => reconcileNative(f.db, f.native)); } finally { IDBObjectStore.prototype.add = add; }
  equal(contentKey(await exportSnapshot(f.db)), contentKey(f.snapshot)); check(f.rows.length === 1); await reconcileNative(f.db, f.native); check(f.rows.length === 0);
});
test('Confirmed pending final mastery applies at completion with normal propagation safeguards', async () => {
  const f = await fixture(), row = f.complete(4);
  row.pending = { action: { type: 'step', cardId: row.cardId, stepId: row.stepId, level: 10 }, confirmed: false, expectedKey: contentKey(f.snapshot) };
  await rejects(() => reconcileNative(f.db, f.native)); row.pending.confirmed = true;
  await reconcileNative(f.db, f.native); check((await exportSnapshot(f.db)).stepProgress.filter(p => p.flashcardId === row.cardId).every(p => p.mastery === 10 && p.nextDueAt === null));
});
test('Backwards completion time remains queued without credit', async () => { const f = await fixture(); f.complete().completedAt = time - 1; await rejects(() => reconcileNative(f.db, f.native)); equal(contentKey(await exportSnapshot(f.db)), contentKey(f.snapshot)); });
test('Schema-2 export and restore preserve reconciled progress and receipts', async () => { const f = await fixture(); f.complete(); await reconcileNative(f.db, f.native); const before = await exportSnapshot(f.db), json = await exportJSON(f.db); await restoreJSON(f.db, json, { confirmed: true, safetyJSON: json }); const after = await exportSnapshot(f.db); equal(after.stepProgress, before.stepProgress); equal(after.stepEvents, before.stepEvents); equal(after.flashcards, before.flashcards); });
export async function run() {
  const results = [];
  try { for (const { name, fn } of tests) { try { await fn(); results.push({ name, pass: true }); } catch (error) { results.push({ name, pass: false, error: error.stack }); } } }
  finally { for (const { db, name } of fixtures) { db.close(); await request(indexedDB.deleteDatabase(name)); } }
  return results;
}
