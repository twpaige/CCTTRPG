import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.SR_PLAYWRIGHT || 'playwright');
const base = process.env.SR_TEST_URL || 'http://127.0.0.1:8765', profile = await mkdtemp(join(tmpdir(), 'sr-android-recovery-'));
let context, page, count = 0;
const pass = name => { count++; console.log('PASS ' + name); };
try {
  context = await chromium.launchPersistentContext(profile, { headless: true, executablePath: process.env.SR_BROWSER || undefined });
  page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.picker = { saved: [], opens: 0, state: { serviceRunning: false, queuedCount: 0 } };
    window.SRNative = { status: () => JSON.stringify(picker.state), openBackup: () => picker.opens++, saveBackup: json => picker.saved.push(json) };
  });
  await page.goto(base + '/data/index.html?test=SRLearning-test-android-recovery');
  await page.waitForFunction(() => !document.getElementById('choose-import').disabled);
  const read = () => page.evaluate(async () => { const { openDatabase } = await import('../js/db.js'), { exportJSON, contentKey } = await import('../js/backup.js'); const db = await openDatabase({ name: 'SRLearning-test-android-recovery' }); try { return contentKey(JSON.parse(await exportJSON(db))); } finally { db.close(); } });
  const original = await read();
  const incoming = await page.evaluate(async () => JSON.stringify((await import('../tests/mastery.test.js')).legacyFixture()));
  const emit = detail => page.evaluate(detail => window.dispatchEvent(new CustomEvent('sr-file-result', { detail })), detail);
  const idle = () => page.waitForFunction(() => !document.getElementById('choose-import').disabled);
  const retry = async () => { const n = await page.evaluate(() => picker.saved.length); await page.locator('#choose-safety').click(); await page.waitForFunction(n => picker.saved.length > n, n); };
  const choose = async () => { const n = await page.evaluate(() => picker.saved.length); await page.locator('#choose-import').click(); await emit({ json: incoming }); await page.waitForFunction(n => picker.saved.length > n, n); };
  const verified = { saved: true, verified: true, filename: 'SR-Backup-2026-10-14-1435(1).json' };
  assert(await page.locator('#confirm').isHidden());
  await page.locator('#choose-import').click(); await emit({ cancelled: true }); await idle(); assert.equal(await read(), original);
  pass('Incoming document-picker cancellation leaves library unchanged');
  await page.locator('#choose-import').click(); await emit({ json: '{invalid' }); await idle(); assert.equal(await page.evaluate(() => picker.saved.length), 0); assert(await page.locator('#replace').isDisabled());
  pass('Invalid incoming JSON never requests an outgoing backup or replacement');
  await choose(); assert(await page.locator('#replace').isDisabled()); assert.equal(await read(), original);
  await emit({ cancelled: true }); await idle(); assert(await page.locator('#replace').isDisabled());
  pass('OneDrive/Downloads backup cancellation retains the library and disables confirmation');
  for (const detail of [{ error: 'Write failed' }, { saved: true, verified: false, filename: 'bad.json' }]) {
    await retry(); await emit(detail); await idle(); assert(await page.locator('#replace').isDisabled()); assert.equal(await read(), original);
  }
  pass('Write failure or unverified saved file cannot authorize replacement');
  await retry();
  await page.evaluate(async () => { const { openDatabase, transaction, request } = await import('../js/db.js'); const db = await openDatabase({ name: 'SRLearning-test-android-recovery' }); try { await transaction(db, ['settings'], 'readwrite', tx => request(tx.objectStore('settings').put({ key: 'rate', value: 1.2 }))); } finally { db.close(); } });
  let changed = await read(); await emit(verified); await idle(); assert(await page.locator('#replace').isDisabled()); assert.match(await page.locator('#error').textContent(), /changed during backup/);
  pass('Library mutation during backup blocks stale replacement');
  await retry(); await emit(verified); await idle(); assert(!(await page.locator('#replace').isDisabled())); assert.equal(await read(), changed);
  await page.evaluate(async () => { const { openDatabase, transaction, request } = await import('../js/db.js'); const db = await openDatabase({ name: 'SRLearning-test-android-recovery' }); try { await transaction(db, ['settings'], 'readwrite', tx => request(tx.objectStore('settings').put({ key: 'rate', value: 1.3 }))); } finally { db.close(); } });
  changed = await read(); await page.locator('#replace').click(); await idle(); assert.equal(await read(), changed); assert.match(await page.locator('#error').textContent(), /changed after the safety export/);
  pass('Mutation after verification is rejected inside the replacement transaction');
  // A fresh page is the equivalent of leaving without confirming; no restore occurred.
  await page.reload(); await idle(); assert.equal(await read(), changed); assert(await page.locator('#replace').isDisabled());
  pass('Verified backup alone does not replace data; leaving confirmation preserves library');
  await choose(); await emit(verified); await idle();
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add; window.restoreAdd = () => { IDBObjectStore.prototype.add = add; };
    IDBObjectStore.prototype.add = function (...args) { if (this.name === 'flashcards') throw new Error('Injected replacement failure'); return add.apply(this, args); };
  });
  await page.locator('#replace').click(); await idle(); assert.equal(await read(), changed);
  await page.evaluate(() => restoreAdd());
  pass('Atomic replacement failure rolls back clears and preserves previous library');
  await page.locator('#replace').click(); await idle(); assert.match(await page.locator('#preview').textContent(), /Library Restored Successfully.*1 series.*2 flashcards.*10 steps.*1435\(1\)/);
  const recovery = await page.evaluate(async () => { const { openDatabase } = await import('../js/db.js'), { recoveryJSON, contentKey } = await import('../js/backup.js'); const db = await openDatabase({ name: 'SRLearning-test-android-recovery' }); try { return contentKey(JSON.parse(await recoveryJSON(db))); } finally { db.close(); } });
  assert.equal(recovery, changed); assert.notEqual(await read(), changed);
  pass('One confirmation restores atomically, reports counts/actual filename and retains prior recovery');
  await choose(); await emit(verified); await idle();
  await page.evaluate(() => { picker.state.queuedCount = 1; }); await page.locator('#replace').click(); await idle(); assert.match(await page.locator('#error').textContent(), /save queued progress/);
  pass('Native completion queue guard prevents replacement with unsaved playback progress');
  assert.deepEqual(errors, []); console.log(count + '/' + count + ' Android recovery UI scenarios passed; provider simulated, IndexedDB real.');
} finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
