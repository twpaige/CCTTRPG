import { openDatabase, request, transaction } from '../js/db.js';
import { Repository } from '../js/repository.js';
import { exportSnapshot, exportJSON, restoreJSON, contentKey } from '../js/backup.js';
import { StudySession, speechParts } from '../js/study.js';
import { BrowserSpeech } from '../js/speech.js';
import { nextDue } from '../js/scheduler.js';
const check = (ok, message = 'Assertion failed') => { if (!ok) throw new Error(message); };
const equal = (a, b) => check(JSON.stringify(a) === JSON.stringify(b), `Different values: ${JSON.stringify(a)} / ${JSON.stringify(b)}`);
const rejects = async action => { let failed = false; try { await action(); } catch { failed = true; } check(failed, 'Expected rejection'); };
const tests = [], fixtures = [];
const test = (name, run) => tests.push({ name, run });
export const until = async predicate => { const end = performance.now() + 8000; while (!predicate()) { if (performance.now() > end) throw new Error('Timed out waiting for test state'); await new Promise(resolve => setTimeout(resolve, 0)); } };
export class Clock {
  time = 0; id = 0; tasks = new Map();
  now = () => this.time;
  setTimeout = (fn, delay) => { check(delay <= 2147483647, 'Browser timeout overflow'); const id = ++this.id; this.tasks.set(id, { at: this.time + delay, fn }); return id; };
  clearTimeout = id => this.tasks.delete(id);
  tick(ms) { const end = this.time + ms; for (;;) { const next = [...this.tasks].sort((a, b) => a[1].at - b[1].at)[0]; if (!next || next[1].at > end) break; this.time = next[1].at; this.tasks.delete(next[0]); next[1].fn(); } this.time = end; }
}
export class Synth extends EventTarget {
  current = null; spoken = []; overlaps = 0;
  getVoices() { return [voice]; }
  speak(utterance) { if (this.current) this.overlaps++; this.current = utterance; this.spoken.push(utterance.text); }
  cancel() { this.current = null; }
  end() { check(this.current, 'No active utterance'); const u = this.current; this.current = null; u.onend?.(); }
  fail() { const u = this.current; this.current = null; u.onerror?.({ error: 'test failure' }); }
}
export class Utterance { constructor(text) { this.text = text; } }
export const voice = { name: 'Google UK English Male', voiceURI: 'test', lang: 'en-GB', localService: true };
const options = { mode: 'REVIEW', window: { type: 'now' }, voice, rate: 0.9, recallMs: 1000 };
const time = 10000000;
export async function seed(name) {
  check(/^SRLearning-test-/.test(name), 'Disposable database names only');
  const db = await openDatabase({ name }), repo = new Repository(db);
  const bound = await repo.createSeries({ id: 'bound', name: 'States (synthetic)', bound: true });
  const free = await repo.createSeries({ id: 'free', name: 'Unbound (synthetic)', bound: false });
  for (const [id, count, seriesId] of [['a', 2, bound.id], ['b', 3, bound.id], ['c', 1, free.id], ['d', 2, free.id]])
    await repo.createCard({ id, name: id === 'a' ? 'Delaware (synthetic)' : `Card ${id}`, seriesId,
      steps: Array.from({ length: count }, (_, position) => ({ id: `${id}${position}`, position, question: `  ${id} question ${position}? 🧠\n`, answer: `${id} answer ${position}.\n  ` })) });
  await transaction(db, ['stepProgress'], 'readwrite', async tx => { const store = tx.objectStore('stepProgress'); for (const row of await request(store.getAll())) await request(store.put({ ...row, nextDueAt: 0 })); });
  return db;
}
async function fixture() {
  const name = `SRLearning-test-study-${crypto.randomUUID()}`, db = await seed(name), clock = new Clock(), synth = new Synth();
  const session = new StudySession(db, new BrowserSpeech(synth, Utterance, clock), { clock, now: () => time + clock.time, rng: () => 0 });
  const f = { name, db, clock, synth, session, read: () => exportSnapshot(db) }; fixtures.push(f); return f;
}
async function alter(f, mutate) { const before = await f.read(); const changed = structuredClone(before); mutate(changed); await restoreJSON(f.db, JSON.stringify(changed), { confirmed: true, safetyJSON: JSON.stringify(before) }); }
async function start(f, settings = {}) { await f.session.start({ ...options, ...settings }); await until(() => f.synth.current || ['finished', 'error'].includes(f.session.snapshot.status)); }
async function question(f) { f.synth.end(); await until(() => f.session.snapshot.phase === 'recall'); }
async function answer(f, milliseconds = 1000) { await question(f); f.clock.tick(milliseconds); await until(() => f.session.snapshot.phase === 'answer'); }
async function step(f) { await answer(f); f.synth.end(); await until(() => f.synth.current || ['finished', 'error'].includes(f.session.snapshot.status)); }
const row = (snapshot, id = 'a0') => snapshot.stepProgress.find(row => row.stepId === id);

test('Authored multi-card REVIEW uses exact wording/order; only answer success writes each receipt', async () => {
  const f = await fixture(), before = await f.read(); await start(f);
  const expected = before.flashcards.flatMap(card => card.steps.flatMap(step => [step.question, step.answer]));
  for (let i = 0; i < 8; i++) {
    equal((await f.read()).stepEvents.length, i); await answer(f); equal((await f.read()).stepEvents.length, i);
    f.synth.end(); await until(() => f.synth.current || f.session.snapshot.status === 'finished');
  }
  equal(f.synth.spoken, expected); equal(f.synth.overlaps, 0); equal(f.session.snapshot.status, 'finished');
  const after = await f.read(); equal(after.stepEvents.length, 8); equal(after.flashcards, before.flashcards); equal(after.progress, before.progress); equal(after.settings, before.settings);
  check(after.stepProgress.every(row => row.mastery === 0 && row.nextDueAt === nextDue(0, row.lastReviewedAt)));
});
test('Final anchor and one cutoff: due now empty; lookahead omits later steps; Max Deferred excludes KNOWN', async () => {
  const f = await fixture(); await alter(f, s => {
    s.stepProgress.forEach(p => { p.nextDueAt = time + 8 * 86400000; });
    row(s, 'a0').nextDueAt = 0; row(s, 'a1').nextDueAt = time + 6 * 86400000;
    row(s, 'b2').mastery = 10; row(s, 'b2').nextDueAt = null;
  });
  await start(f); equal(f.synth.spoken, []); await f.session.stop();
  await start(f, { window: { type: 'days', days: 7 } }); equal(f.session.controller.cards.map(c => c.id), ['a']); await f.session.stop();
  await start(f, { window: { type: 'max' } }); equal(f.session.controller.cards.map(c => c.id), ['a', 'c', 'd']);
});
test('BOUND order remains fixed; random applies to UNBOUND cards only, never steps', async () => {
  const f = await fixture(); await start(f, { random: true });
  equal(f.session.controller.cards.map(c => c.id), ['a', 'b', 'd', 'c']); equal(f.session.controller.cards[1].steps.map(s => s.id), ['b0', 'b1', 'b2']);
});
test('Series scoping and individual eligibility retain only matching steps', async () => {
  const f = await fixture(); await alter(f, s => { row(s, 'b0').nextDueAt = time + 999999; row(s, 'b1').mastery = 10; row(s, 'b1').nextDueAt = null; });
  await start(f, { seriesId: 'bound' }); equal(f.session.controller.cards.map(c => [c.id, c.steps.map(s => s.id)]), [['a', ['a0', 'a1']], ['b', ['b2']]]);
});
test('Lookahead early step stays early even when due time passes during its answer', async () => {
  const f = await fixture(); await alter(f, s => { row(s).nextDueAt = time + 10; row(s, 'a1').nextDueAt = time + 10; }); const before = await f.read();
  await start(f, { window: { type: 'max' } }); await step(f); equal(row(await f.read()), row(before));
});
for (const phase of ['question', 'recall', 'answer']) test(`Stop during ${phase} discards pending mastery and ignores late callbacks`, async () => {
  const f = await fixture(), before = await f.read(); await start(f);
  if (phase === 'recall') await question(f); if (phase === 'answer') await answer(f);
  const oldEnd = f.synth.current?.onend; await f.session.pendingMastery(7, () => true); f.session.resume(); await f.session.stop(); oldEnd?.(); f.clock.tick(999999);
  equal(contentKey(await f.read()), contentKey(before)); equal(f.synth.current, null);
});
test('Pause/Resume repeats the interrupted speech segment and preserves recall remainder', async () => {
  const f = await fixture(); await start(f); f.session.pause(); f.session.resume(); equal(f.synth.spoken[0], f.synth.spoken[1]);
  await question(f); f.clock.tick(350); f.session.pause(); f.clock.tick(9000); f.session.resume(); f.clock.tick(649); equal(f.synth.current, null); f.clock.tick(1); check(f.synth.current); equal(f.synth.overlaps, 0);
});
test('Skip discards unfinished change; earlier completed steps keep credit; paused Skip stays paused', async () => {
  const f = await fixture(); await start(f); await step(f); await f.session.pendingMastery(8, () => true); f.session.pause(); f.session.skip();
  equal(f.session.snapshot.status, 'paused'); equal(f.session.snapshot.card.id, 'b'); f.session.resume(); await until(() => f.synth.current);
  const after = await f.read(); equal(after.stepEvents.length, 1); equal(row(after, 'a1').mastery, 0); equal(row(after, 'a1').lastReviewedAt, null);
});
test('Rapid repeated Start and Stop/Restart retain one session and no stale callbacks', async () => {
  const f = await fixture(); await Promise.all([f.session.start(options), f.session.start(options)]); await until(() => f.synth.current);
  for (let i = 0; i < 20; i++) { const end = f.synth.current.onend; await f.session.restart(); await until(() => f.synth.current); end(); }
  equal(f.synth.overlaps, 0); equal((await f.read()).stepEvents.length, 0); await f.session.stop(); equal(f.clock.tasks.size, 0);
});
test('Long recall override exceeds 120 seconds, safely chains timers beyond signed 32-bit limit', async () => {
  const f = await fixture(); await alter(f, s => { s.flashcards[0].steps[0].recallSeconds = 3000000; }); await start(f); await question(f);
  f.clock.tick(2147483647); equal(f.session.snapshot.phase, 'recall'); equal(f.synth.current, null);
  f.session.pause(); const left = f.session.snapshot.remainingMs; f.clock.tick(9999); f.session.resume(); f.clock.tick(left - 1); equal(f.synth.current, null); f.clock.tick(1); check(f.synth.current);
});
test('Zero override and default recall are honored independently', async () => {
  const f = await fixture(); await alter(f, s => { s.flashcards[0].steps[0].recallSeconds = 0; }); await start(f); await question(f); f.clock.tick(0); equal(f.session.snapshot.phase, 'answer'); f.synth.end(); await until(() => f.synth.current); await question(f); equal(f.session.snapshot.remainingMs, 1000);
});
test('Long exact Unicode answer is segmented; no credit before final segment; Resume repeats only interrupted segment', async () => {
  const f = await fixture(), text = '  A long authored answer 🧠 日本語.\n'.repeat(130);
  equal(speechParts(text).join(''), text); check(speechParts(text).every(p => Array.from(p).length <= 400));
  await alter(f, s => { s.flashcards[0].steps[0].answer = text; }); await start(f); await answer(f);
  const parts = speechParts(text); f.synth.end(); await until(() => f.synth.current); f.session.pause(); f.session.resume(); equal(f.synth.current.text, parts[1]);
  for (let i = 1; i < parts.length; i++) { equal((await f.read()).stepEvents.length, 0); equal(f.synth.current.text, parts[i]); f.synth.end(); await until(() => f.synth.current); }
  equal((await f.read()).stepEvents.length, 1);
});
test('Speech error and watchdog never award credit; retry same answer then writes once', async () => {
  const f = await fixture(); await start(f); await answer(f); f.synth.fail(); await until(() => f.session.snapshot.status === 'error'); equal((await f.read()).stepEvents.length, 0);
  f.session.resume(); f.clock.tick(120000); await until(() => f.session.snapshot.status === 'error'); equal((await f.read()).stepEvents.length, 0);
  f.session.resume(); const end = f.synth.current.onend; f.synth.end(); end(); await until(() => f.synth.current); equal((await f.read()).stepEvents.length, 1);
});
test('Pending mastery continues playback, commits at answer success; KNOWN final requires propagation confirmation', async () => {
  const f = await fixture(); await start(f); await f.session.pendingMastery(7, () => true); equal(row(await f.read()).mastery, 0); f.session.resume(); await step(f);
  let after = await f.read(); equal(row(after).mastery, 7); equal(row(after).nextDueAt, nextDue(7, time + 1000));
  let message; await f.session.pendingMastery(10, text => { message = text; return false; }); check(message.includes('2 steps across 1 flashcards')); equal(f.session.snapshot.pending, undefined);
  await f.session.pendingMastery(10, () => true); f.session.resume(); await step(f); after = await f.read(); check(after.stepProgress.filter(r => r.flashcardId === 'a').every(r => r.mastery === 10));
});
for (const phase of ['question', 'recall', 'answer']) test(`One-click mastery during ${phase} is synchronous, last-choice wins and audio is uninterrupted`, async () => {
  const f = await fixture(); await start(f);
  if (phase === 'recall') await question(f); if (phase === 'answer') await answer(f);
  const utterance = f.synth.current, remaining = f.session.snapshot.remainingMs;
  const promises = [2, 7, 9].map(level => f.session.pendingMastery(level, () => { throw new Error('Ordinary choice must not confirm'); }));
  equal(f.session.snapshot.pending, 9); equal(f.session.snapshot.status, 'playing'); equal(f.synth.current, utterance); equal(f.session.snapshot.remainingMs, remaining);
  await Promise.all(promises); equal(row(await f.read()).mastery, 0);
  if (phase === 'question') await answer(f);
  else if (phase === 'recall') { f.clock.tick(1000); await until(() => f.synth.current); }
  f.synth.end(); await until(() => f.session.snapshot.step?.id === 'a1' && f.synth.current);
  equal(row(await f.read()).mastery, 9); equal(f.session.snapshot.pending, undefined); equal(f.session.snapshot.masterySaved.level, 9);
  await step(f); equal(row(await f.read(), 'a1').mastery, 0); equal(f.synth.overlaps, 0);
});
test('Intermediate KNOWN queues without confirmation or pause and changes only that step', async () => {
  const f = await fixture(); await start(f); const utterance = f.synth.current;
  await f.session.pendingMastery(10, () => { throw new Error('Unexpected propagation'); }); equal(f.synth.current, utterance); await step(f);
  const after = await f.read(); equal(row(after).mastery, 10); equal(row(after).nextDueAt, null); equal(row(after, 'a1').mastery, 0);
});
test('Final KNOWN cancel resumes only previously playing audio and preserves earlier pending choice', async () => {
  const f = await fixture(); await start(f); await step(f); await f.session.pendingMastery(3);
  await f.session.pendingMastery(10, message => { check(message.includes('2 steps across 1 flashcards')); equal(f.session.snapshot.status, 'paused'); return false; });
  equal(f.session.snapshot.status, 'playing'); equal(f.session.snapshot.pending, 3); equal(row(await f.read(), 'a1').mastery, 0);
  f.session.pause(); await f.session.pendingMastery(10, () => false); equal(f.session.snapshot.status, 'paused');
});
test('Final BOUND KNOWN confirms series scope then propagates only after the answer', async () => {
  const f = await fixture(); await start(f); f.session.skip(); await until(() => f.synth.current); await step(f); await step(f);
  let confirmed = false; await f.session.pendingMastery(10, message => { check(message.includes('entire BOUND series')); check(message.includes('5 steps across 2 flashcards')); confirmed = true; return true; });
  check(confirmed); equal(f.session.snapshot.status, 'playing'); check((await f.read()).stepProgress.every(p => p.mastery === 0));
  await step(f); const after = await f.read(); check(after.stepProgress.filter(p => ['a', 'b'].includes(p.flashcardId)).every(p => p.mastery === 10)); equal(row(after, 'c0').mastery, 0);
});
test('Stop during an outstanding KNOWN confirmation cannot queue or resume another step', async () => {
  const f = await fixture(); await start(f); await step(f); let approve;
  const pending = f.session.pendingMastery(10, () => new Promise(resolve => { approve = resolve; }));
  await f.session.stop(); approve(true); await pending; equal(f.session.snapshot.status, 'stopped'); equal(f.synth.current, null); equal(row(await f.read(), 'a1').mastery, 0);
});
for (const phase of ['question', 'recall', 'answer']) {
  test(`Skip Step during ${phase} discards pending work without credit and ignores late speech`, async () => {
    const f = await fixture(); await start(f); if (phase === 'recall') await question(f); if (phase === 'answer') await answer(f);
    await f.session.pendingMastery(8); const late = f.synth.current?.onend; f.session.setRepeat(true); f.session.skipStep(); late?.(); await until(() => f.synth.current && f.session.snapshot.step.id === 'a1');
    equal((await f.read()).stepEvents.length, 0); equal(row(await f.read()).mastery, 0); equal(f.session.snapshot.pending, undefined); equal(f.session.snapshot.repeatCurrent, false);
    f.session.skipStep(); await until(() => f.synth.current && f.session.snapshot.card.id === 'b'); equal(f.session.snapshot.step.id, 'b0'); equal(f.synth.overlaps, 0);
  });
  test(`Previous Step during ${phase} restarts previous question, preserves credit and discards interrupted choice`, async () => {
    const f = await fixture(); await start(f); await step(f); const before = await f.read();
    if (phase === 'recall') await question(f); if (phase === 'answer') await answer(f);
    await f.session.pendingMastery(9); const late = f.synth.current?.onend; f.session.previousStep(); late?.(); await until(() => f.synth.current && f.session.snapshot.step.id === 'a0');
    equal(f.session.snapshot.phase, 'question'); equal(f.session.snapshot.pending, undefined); await step(f);
    equal(contentKey(await f.read()), contentKey(before)); equal(f.session.snapshot.step.id, 'a1'); equal(f.synth.overlaps, 0);
  });
}
test('Previous never crosses cards and paused navigation stays paused', async () => {
  const f = await fixture(); await start(f); const utterance = f.synth.current; f.session.previousStep(); equal(f.synth.current, utterance);
  f.session.pause(); f.session.skipStep(); equal(f.session.snapshot.status, 'paused'); equal(f.session.snapshot.step.id, 'a1'); f.session.previousStep(); equal(f.session.snapshot.step.id, 'a0'); equal(f.synth.current, null);
  f.session.skip(); equal(f.session.snapshot.card.id, 'b'); f.session.previousStep(); equal(f.session.snapshot.card.id, 'b'); equal(f.session.snapshot.step.id, 'b0');
});
test('Repeat is full practice after first success, uncheck advances only after current answer', async () => {
  const f = await fixture(); await start(f); f.session.setRepeat(true); await step(f); const first = await f.read();
  for (let i = 0; i < 3; i++) { equal(f.session.snapshot.step.id, 'a0'); await step(f); equal(contentKey(await f.read()), contentKey(first)); }
  equal(f.synth.spoken.filter(text => text.includes('a question 0')).length, 5);
  await answer(f); f.session.setRepeat(false); equal(f.session.snapshot.step.id, 'a0'); f.synth.end(); await until(() => f.synth.current && f.session.snapshot.step.id === 'a1'); equal(contentKey(await f.read()), contentKey(first));
});
test('A fresh mastery choice during repeat commits once without duplicate automatic credit', async () => {
  const f = await fixture(); await start(f); f.session.setRepeat(true); await step(f); const first = await f.read();
  await f.session.pendingMastery(7); await step(f); const changed = await f.read(); equal(row(changed).mastery, 7); equal(row(changed).lastReviewedAt, row(first).lastReviewedAt); equal(changed.stepEvents.length, 2);
  await step(f); equal(contentKey(await f.read()), contentKey(changed)); await f.session.pendingMastery(10); await step(f); equal(row(await f.read()).mastery, 10); equal(f.session.snapshot.step.id, 'a0');
});
test('Repeat preserves recall Pause/Resume and clears on navigation, Stop and Restart', async () => {
  const f = await fixture(); await start(f); f.session.setRepeat(true); await question(f); f.clock.tick(300); f.session.pause(); f.clock.tick(9999); f.session.resume(); f.clock.tick(699); equal(f.synth.current, null); f.clock.tick(1); await until(() => f.synth.current); f.synth.end(); await until(() => f.synth.current); equal(f.session.snapshot.step.id, 'a0');
  f.session.skipStep(); await until(() => f.synth.current); equal(f.session.snapshot.repeatCurrent, false); f.session.setRepeat(true); f.session.previousStep(); await until(() => f.synth.current); equal(f.session.snapshot.repeatCurrent, false);
  f.session.setRepeat(true); f.session.skip(); await until(() => f.synth.current); equal(f.session.snapshot.repeatCurrent, false);
  f.session.setRepeat(true); await f.session.stop(); equal(f.session.snapshot.repeatCurrent, false); await start(f); f.session.setRepeat(true); await f.session.restart(); await until(() => f.synth.current); equal(f.session.snapshot.repeatCurrent, false);
});
test('AUDIT repeat never schedules; repeated final KNOWN still requires confirmation', async () => {
  const f = await fixture(); await alter(f, s => s.stepProgress.forEach(p => { p.mastery = 10; p.nextDueAt = null; })); const before = await f.read();
  await start(f, { mode: 'AUDIT' }); f.session.setRepeat(true); for (let i = 0; i < 3; i++) await step(f); equal(contentKey(await f.read()), contentKey(before));
  let message; await f.session.pendingMastery(10, text => { message = text; return false; }); check(message.includes('entire BOUND series')); await step(f); equal(contentKey(await f.read()), contentKey(before));
});
test('Previous can practice a selected step made KNOWN by final-step propagation without credit', async () => {
  const f = await fixture(); await start(f); f.session.skipStep(); await until(() => f.synth.current && f.session.snapshot.step.id === 'a1');
  f.session.setRepeat(true); await f.session.pendingMastery(10, () => true); await step(f); const before = await f.read();
  f.session.previousStep(); await until(() => f.synth.current && f.session.snapshot.step.id === 'a0'); await step(f); equal(contentKey(await f.read()), contentKey(before));
});
test('Navigation cannot abandon an in-flight successful completion write', async () => {
  const f = await fixture(); await start(f); const finish = f.session.completion.finish.bind(f.session.completion); let release;
  f.session.completion.finish = async (...args) => { await new Promise(resolve => { release = resolve; }); return finish(...args); };
  await answer(f); f.synth.end(); await until(() => f.session.snapshot.phase === 'commit'); f.session.skipStep(); f.session.previousStep(); equal(f.session.snapshot.phase, 'commit');
  release(); await until(() => f.synth.current); equal((await f.read()).stepEvents.length, 1); equal(f.session.snapshot.step.id, 'a1');
});
test('Receipt write failure rolls back; Resume retries without replaying answer or duplicating a committed receipt', async () => {
  const f = await fixture(); await start(f); await answer(f); const before = await f.read(), original = IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = function (...args) { if (this.name === 'stepEvents') throw new DOMException('Test quota', 'QuotaExceededError'); return original.apply(this, args); };
  try { f.synth.end(); await until(() => f.session.snapshot.status === 'error'); } finally { IDBObjectStore.prototype.add = original; }
  equal(contentKey(await f.read()), contentKey(before)); const count = f.synth.spoken.length;
  f.session.resume(); await until(() => f.synth.current); equal(f.synth.spoken.length, count + 1); equal((await f.read()).stepEvents.length, 1);
});
test('Ambiguous success acknowledgement retries the same receipt without double credit', async () => {
  const f = await fixture(); await start(f); const finish = f.session.completion.finish.bind(f.session.completion); let once = true;
  f.session.completion.finish = async (...args) => { const result = await finish(...args); if (once) { once = false; throw new Error('Lost acknowledgement'); } return result; };
  await answer(f); f.synth.end(); await until(() => f.session.snapshot.status === 'error'); const committed = await f.read(); equal(committed.stepEvents.length, 1);
  f.session.resume(); await until(() => f.synth.current); equal(contentKey(await f.read()), contentKey(committed));
});
test('AUDIT ALL/single series repeats final-only KNOWN targets without any writes', async () => {
  const f = await fixture(); await alter(f, s => s.stepProgress.forEach(p => { p.mastery = 10; p.nextDueAt = null; })); const before = await f.read();
  await start(f, { mode: 'AUDIT' }); equal(f.session.controller.cards.map(c => [c.id, c.steps.map(s => s.id)]), [['b', ['b2']], ['c', ['c0']], ['d', ['d1']]]);
  for (let i = 0; i < 7; i++) await step(f); equal(f.session.cycle, 3); equal(contentKey(await f.read()), contentKey(before));
  await f.session.stop(); await start(f, { mode: 'AUDIT', seriesId: 'free' }); equal(f.session.controller.cards.map(c => c.id), ['c', 'd']);
});
test('AUDIT reset-final preserves earlier KNOWN; eligibility refresh drops reset target', async () => {
  const f = await fixture(); await alter(f, s => s.stepProgress.forEach(p => { p.mastery = 10; p.nextDueAt = null; })); await start(f, { mode: 'AUDIT', seriesId: 'bound' });
  await f.session.special('resetFinal', () => true); const after = await f.read(); equal(row(after, 'b2').mastery, 0); check(after.stepProgress.filter(p => p.stepId !== 'b2').every(p => p.mastery === 10));
  f.session.resume(); await until(() => f.synth.current); equal(f.session.snapshot.card.id, 'a'); equal(f.session.cycle, 2); equal(after.stepEvents.length, 0);
});
test('Special KNOWN confirms entire final BOUND series; full AUDIT reset confirms series and exits empty cycle', async () => {
  const f = await fixture(); await start(f, { seriesId: 'bound' }); f.session.skip(); await until(() => f.synth.current); let message;
  await f.session.special('known', text => { message = text; return true; }); check(message.includes('entire BOUND series')); check(message.includes('AUDIT')); await f.session.stop();
  await start(f, { mode: 'AUDIT', seriesId: 'bound' }); await f.session.special('resetObjective', text => { check(text.includes('entire BOUND series')); return true; }); f.session.resume(); await until(() => f.session.snapshot.status === 'finished');
  check((await f.read()).stepProgress.filter(p => p.flashcardId === 'a' || p.flashcardId === 'b').every(p => p.mastery === 0));
});
test('Reset FC is card-only; cancelled special discards pending choice, stays paused and can replay safely', async () => {
  const f = await fixture(); await start(f); await f.session.pendingMastery(7, () => true); const before = await f.read();
  await f.session.special('known', () => false); equal(contentKey(await f.read()), contentKey(before)); equal(f.session.snapshot.status, 'paused'); equal(f.session.snapshot.pending, undefined);
  f.session.resume(); await until(() => f.synth.current); await f.session.special('resetCard', () => true); const after = await f.read(); check(after.stepProgress.filter(p => p.flashcardId === 'a').every(p => p.nextDueAt === nextDue(0, time))); equal(row(after, 'b0'), row(before, 'b0'));
});
test('Exclusive playback lease rejects a second session, edits, mastery writes and restore; export still works', async () => {
  const f = await fixture(), other = await openDatabase({ name: f.name }), second = new StudySession(other, new BrowserSpeech(new Synth(), Utterance));
  try { await start(f); await rejects(() => second.start(options)); await rejects(() => new Repository(other).setSetting('rate', 1)); const json = await exportJSON(other); await rejects(() => restoreJSON(other, json, { confirmed: true, safetyJSON: json })); await f.session.stop(); await new Repository(other).setSetting('rate', 1); } finally { await second.stop(); other.close(); }
});
test('Old noncooperating progress/content writes reject stale completion and preparation', async () => {
  const f = await fixture(); await start(f); await answer(f);
  const tx = f.db.transaction('stepProgress', 'readwrite'), store = tx.objectStore('stepProgress'), p = await request(store.get(['a', 'a0'])); await request(store.put({ ...p, revision: p.revision + 1, mastery: 4 }));
  f.synth.end(); await until(() => f.session.snapshot.status === 'error'); equal(row(await f.read()).mastery, 4); equal((await f.read()).stepEvents.length, 0);
  await f.session.stop(); const begin = f.session.completion.begin.bind(f.session.completion), count = f.synth.spoken.length;
  f.session.completion.begin = async (...args) => {
    const tx = f.db.transaction('flashcards', 'readwrite'), store = tx.objectStore('flashcards'), card = await request(store.get('a'));
    await request(store.put({ ...card, name: 'Concurrent old-page edit', revision: card.revision + 1 })); return begin(...args);
  };
  await start(f); equal(f.session.snapshot.status, 'error'); equal(f.synth.spoken.length, count);
});
test('Stop during async preparation prevents later speech and frees the lease', async () => {
  const f = await fixture(); await f.session.start(options); await f.session.stop(); await new Promise(resolve => setTimeout(resolve, 30)); equal(f.synth.current, null); equal((await f.read()).stepEvents.length, 0); await start(f);
});
test('Pause/Resume during preparation attaches once; Skip invalidates an unfinished preparation', async () => {
  const f = await fixture(); await f.session.start(options); f.session.pause(); await f.session.settled(); equal(f.synth.current, null); f.session.resume(); await until(() => f.synth.current);
  await f.session.stop(); await f.session.start(options); f.session.skip(); await until(() => f.synth.current); equal(f.session.snapshot.card.id, 'b'); equal(f.synth.overlaps, 0);
});
test('Pause/Resume while saving does not replay the answer or duplicate credit', async () => {
  const f = await fixture(); await start(f); await answer(f); const finish = f.session.completion.finish.bind(f.session.completion); let release;
  f.session.completion.finish = async (...args) => { const result = await finish(...args); await new Promise(resolve => { release = resolve; }); return result; };
  f.synth.end(); await until(() => !!release);
  f.session.pause(); release(); await f.session.settled(); const after = await f.read(); equal(after.stepEvents.length, 1); const count = f.synth.spoken.length;
  f.session.resume(); await until(() => f.synth.current); equal(f.synth.spoken.length, count + 1); equal((await f.read()).stepEvents.length, 1);
});
test('Stop while an acknowledged answer is being saved preserves that valid completion', async () => {
  const f = await fixture(); await start(f); await answer(f); const finish = f.session.completion.finish.bind(f.session.completion); let release;
  f.session.completion.finish = async (...args) => { const result = await finish(...args); await new Promise(resolve => { release = resolve; }); return result; };
  f.synth.end(); await until(() => !!release); const stopped = f.session.stop(); release();
  await stopped; equal((await f.read()).stepEvents.length, 1); equal(f.synth.current, null);
});
test('Stop while a special confirmation is pending prevents its later approval from changing data', async () => {
  const f = await fixture(); await start(f); const before = await f.read(); let approve;
  const special = f.session.special('known', () => new Promise(resolve => { approve = resolve; })); await until(() => !!approve);
  const stopped = f.session.stop(); approve(true); await special; await stopped; equal(contentKey(await f.read()), contentKey(before));
});
test('Long answer Stop and Skip leave no partial credit; impossible duration fails before speech', async () => {
  const f = await fixture(); await alter(f, s => { s.flashcards[0].steps[0].answer = 'Long answer. '.repeat(600); });
  await start(f); await answer(f); f.synth.end(); await until(() => f.synth.current); f.session.skip(); await until(() => f.synth.current); equal((await f.read()).stepEvents.length, 0); await f.session.stop();
  await start(f); await answer(f); f.synth.end(); await until(() => f.synth.current); await f.session.stop(); equal((await f.read()).stepEvents.length, 0);
  await alter(f, s => { s.flashcards[0].steps[0].recallSeconds = 1e100; }); const count = f.synth.spoken.length;
  await rejects(() => f.session.start(options)); equal(f.synth.spoken.length, count); check(!f.session.lease);
});

export async function runStudyTests(report = () => {}) {
  const results = [];
  for (const { name, run } of tests) {
    try { await run(); results.push({ name, pass: true }); } catch (error) { results.push({ name, pass: false, error: error.stack || String(error) }); }
    finally { for (const f of fixtures.splice(0)) { await f.session.stop(); f.db.close(); await request(indexedDB.deleteDatabase(f.name)); } }
    report(results.at(-1));
  }
  return results;
}
