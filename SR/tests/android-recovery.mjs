// Shared web/Android Data workflow; real Chrome, IndexedDB and desktop temporary files.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installPickers } from './file-pickers.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.SR_PLAYWRIGHT || 'playwright');
const base = process.env.SR_TEST_URL || 'http://127.0.0.1:8765', profile = await mkdtemp(join(tmpdir(), 'sr-data-test-'));
let context, count = 0;
const pass = name => { count++; console.log('PASS ' + name); };
try {
  context = await chromium.launchPersistentContext(profile, { headless: true, executablePath: process.env.SR_BROWSER || undefined });
  for (const android of [false, true]) {
    const page = await context.newPage(), errors = [], name = 'SRLearning-test-data-' + (android ? 'android' : 'desktop');
    page.on('pageerror', e => errors.push(e.message));
    if (!android) await installPickers(page, profile);
    else await page.addInitScript(() => {
      window.picker = { saved: [], opens: 0, rows: [], state: { serviceRunning: false }, ackFails: false };
      window.SRNative = { status: () => JSON.stringify({ ...picker.state, queuedCount: picker.rows.length }),
        openBackup: () => picker.opens++, saveBackup: json => picker.saved.push(json),
        completions: () => JSON.stringify(picker.rows.slice(0, 32)), acknowledge: id => { if (picker.ackFails || picker.rows[0]?.queueId !== id) return false; picker.rows.shift(); return true; } };
    });
    await page.goto(base + '/data/index.html?test=' + name);
    const idle = () => page.waitForFunction(() => !document.getElementById('choose-import').disabled);
    await idle();
    const read = () => page.evaluate(async name => { const { openDatabase } = await import('../js/db.js'), { exportSnapshot } = await import('../js/backup.js'); const db = await openDatabase({ name }); try { return await exportSnapshot(db); } finally { db.close(); } }, name);
    const key = snapshot => { const copy = structuredClone(snapshot); delete copy.exportedAt; return JSON.stringify(copy); };
    const emit = detail => page.evaluate(detail => window.dispatchEvent(new CustomEvent('sr-file-result', { detail })), detail);
    const incoming = await page.evaluate(async () => JSON.stringify((await import('../tests/mastery.test.js')).legacyFixture()));
    const empty = JSON.stringify(await read());
    async function choose(json = incoming) {
      if (android) { const n = await page.evaluate(() => picker.saved.length), opened = await page.evaluate(() => picker.opens); await page.locator('#choose-import').click(); await page.waitForFunction(opened => picker.opens > opened, opened); await emit({ json }); await page.waitForFunction(n => picker.saved.length > n, n); }
      else { await page.evaluate(json => { picker.incoming = json; picker.mode = ''; }, json); await page.locator('#choose-import').click(); await page.locator('#destination').waitFor({ state: 'visible' }); }
    }
    async function verified() {
      if (android) await emit({ saved: true, verified: true, filename: 'SR-Backup-2026-10-14-1435(1).json' });
      else { await writeFile(join(profile, 'backup.json'), ''); await page.locator('#destination').click(); }
      await page.waitForFunction(() => document.getElementById('confirmation').open);
      await page.waitForFunction(() => !document.getElementById('confirm-import').disabled);
    }
    const backup = async () => android ? JSON.parse(await page.evaluate(() => picker.saved.at(-1))) : JSON.parse(await readFile(join(profile, 'backup.json'), 'utf8'));
    const mutate = value => page.evaluate(async ({ name, value }) => { const { openDatabase, request } = await import('../js/db.js'); const db = await openDatabase({ name }); try { // Simulate an old tab that does not cooperate with Web Locks.
      const tx = db.transaction('settings', 'readwrite'); const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = reject; }); await request(tx.objectStore('settings').put({ key: 'rate', value })); await done;
    } finally { db.close(); } }, { name, value });
    let original = key(await read());
    assert.equal(await page.locator('#recovery, #migration-backup, #choose-safety, #confirm, #replace, input[type=checkbox]').count(), 0);
    assert.deepEqual(await page.locator('section[aria-label="Backup and import"] button').allTextContents(), ['Save Complete JSON Backup', 'Import JSON Library']);
    await page.setViewportSize({ width: 390, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    pass(`${name}: two-action parity, removed workflow and mobile layout`);
    if (android) { await page.locator('#choose-import').click(); await emit({ cancelled: true }); }
    else { await page.evaluate(() => { picker.mode = 'cancel-open'; }); await page.locator('#choose-import').click(); }
    await idle(); assert.equal(key(await read()), original); pass(`${name}: incoming picker cancellation`);
    if (android) { await page.locator('#choose-import').click(); await emit({ json: '{bad' }); }
    else { await page.evaluate(() => { picker.mode = ''; picker.incoming = '{bad'; }); await page.locator('#choose-import').click(); }
    await idle(); assert.equal(key(await read()), original); assert.equal(await page.evaluate(android => android ? picker.saved.length : picker.saves, android), 0);
    pass(`${name}: full validation precedes backup`);
    await choose();
    if (android) await emit({ cancelled: true }); else { await page.evaluate(() => { picker.mode = 'cancel-save'; }); await page.locator('#destination').click(); }
    await idle(); assert.equal(key(await read()), original); pass(`${name}: backup destination cancellation`);
    for (const mode of ['write-fail', 'corrupt']) {
      await choose();
      if (android) await emit(mode === 'write-fail' ? { error: 'Write failed' } : { saved: true, verified: false, filename: 'bad.json' });
      else { await writeFile(join(profile, 'backup.json'), ''); await page.evaluate(mode => { picker.mode = mode; }, mode); await page.locator('#destination').click(); }
      await idle(); assert.equal(key(await read()), original); assert(!(await page.locator('#confirmation').evaluate(el => el.open)));
      pass(`${name}: ${mode} prevents confirmation and replacement`);
    }
    await choose(); await verified(); assert.equal(key(await backup()), original);
    if (!android) assert(await page.evaluate(() => picker.sameFolder));
    await page.locator('#cancel-import').click(); await idle(); assert.equal(key(await read()), original);
    pass(`${name}: complete external empty backup, location hint and confirmation cancellation`);
    await choose(); await mutate(1.2); original = key(await read());
    if (android) await emit({ saved: true, verified: true, filename: 'verified.json' });
    else { await writeFile(join(profile, 'backup.json'), ''); await page.locator('#destination').click(); }
    await idle(); assert.match(await page.locator('#error').textContent(), /changed during backup/); assert.equal(key(await read()), original);
    pass(`${name}: old-tab mutation during backup fails closed`);
    await choose(); await verified(); await mutate(1.3); original = key(await read()); await page.locator('#confirm-import').click(); await idle();
    assert.match(await page.locator('#error').textContent(), /changed after the safety export/); assert.equal(key(await read()), original);
    pass(`${name}: transaction rechecks concurrent change after verification`);
    await choose(); await verified();
    const locked = await page.evaluate(async name => { const { openDatabase, acquirePlayback, transaction, request } = await import('../js/db.js'); const db = await openDatabase({ name }); let blocked = 0;
      try { try { (await acquirePlayback(db))(); } catch { blocked++; } try { await transaction(db, ['settings'], 'readwrite', tx => request(tx.objectStore('settings').put({ key: 'rate', value: 1.4 }))); } catch { blocked++; } return blocked; } finally { db.close(); }
    }, name); assert.equal(locked, 2);
    await page.locator('#cancel-import').click(); await idle(); pass(`${name}: backup/confirmation lease prevents new playback and cooperating writes`);
    await choose(); await verified();
    await page.evaluate(() => { const add = IDBObjectStore.prototype.add; window.restoreAdd = () => { IDBObjectStore.prototype.add = add; }; IDBObjectStore.prototype.add = function(...args) { if (this.name === 'flashcards') throw new Error('Injected failure'); return add.apply(this, args); }; });
    await page.locator('#confirm-import').click(); await idle(); assert.equal(key(await read()), original); await page.evaluate(() => restoreAdd());
    pass(`${name}: atomic rollback after clears`);
    await choose(); await verified(); await page.locator('#confirm-import').click(); await idle();
    assert.match(await page.locator('#preview').textContent(), /Library Imported Successfully.*1 series.*2 flashcards.*10 steps/);
    assert.match(await page.locator('#backup-status').textContent(), /SR-Backup-/);
    let state = await read(); assert.equal(state.stepProgress.length, 10); assert.equal(state.stepProgress[0].mastery, 7);
    pass(`${name}: one-confirmation populated version-1 import retains inherited mastery and actual filename`);
    await choose(JSON.stringify(state)); await verified(); assert.deepEqual((await backup()).stepProgress, state.stepProgress); await page.locator('#confirm-import').click(); await idle();
    assert.deepEqual((await read()).stepProgress, state.stepProgress);
    pass(`${name}: version-2 progress round trip with complete outgoing backup`);
    if (android) {
      await page.evaluate(() => { picker.state.serviceRunning = true; }); const before = key(await read()); await page.locator('#choose-import').click(); await idle(); assert.match(await page.locator('#error').textContent(), /Stop playback/); assert.equal(key(await read()), before); await page.evaluate(() => { picker.state.serviceRunning = false; });
      pass('Android: active native service refused without dropping progress');
      await page.evaluate(async name => { const { openDatabase } = await import('../js/db.js'), { exportSnapshot } = await import('../js/backup.js'), { buildNativePlan } = await import('../js/native-study.js'); const db = await openDatabase({ name }); const plan = buildNativePlan(await exportSnapshot(db), { now: 2000000000000 }); db.close(); picker.rows.push({ ...plan.units[0], queueId: 'pending', sessionId: plan.sessionId, occurrenceId: '0', libraryGeneration: plan.libraryGeneration, mode: plan.mode, startedAt: 2000000000000, completedAt: 2000000010000 }); }, name);
      await choose(); await verified(); const saved = await backup(); assert.equal(saved.stepEvents.length, 1); assert.equal(saved.stepProgress[0].lastReviewedAt, 2000000010000); assert.equal(await page.evaluate(() => picker.rows.length), 0); await page.locator('#cancel-import').click(); await idle();
      pass('Android: pending completion committed and acknowledged before external backup; cancellation retains credit');
      await choose(); await verified(); await page.evaluate(() => picker.rows.push({ queueId: 'late' })); await page.locator('#confirm-import').click(); await idle(); assert.equal(await page.evaluate(() => picker.rows.length), 1); assert.match(await page.locator('#error').textContent(), /pending/);
      pass('Android: late completion blocks replacement and remains queued');
      const beforeFailure = key(await read()); await page.locator('#choose-import').click(); await idle(); assert.equal(await page.evaluate(() => picker.rows.length), 1); assert.equal(key(await read()), beforeFailure); await page.evaluate(() => { picker.rows = []; });
      pass('Android: unreconcilable queue retained; no replacement');
    } else {
      await page.evaluate(async name => { const { openDatabase, acquirePlayback } = await import('../js/db.js'); window.otherDB = await openDatabase({ name }); window.releaseOther = await acquirePlayback(otherDB); }, name);
      await page.evaluate(json => { picker.incoming = json; }, incoming); await page.locator('#choose-import').click(); await idle(); assert.match(await page.locator('#error').textContent(), /busy in another tab/); await page.evaluate(() => { releaseOther(); otherDB.close(); });
      pass('Desktop: active playback lease refuses import');
      await choose(); await writeFile(join(profile, 'backup.json'), 'Existing personal backup'); await page.locator('#destination').click(); await idle(); assert.equal(await readFile(join(profile, 'backup.json'), 'utf8'), 'Existing personal backup');
      pass('Desktop: existing backup cannot be overwritten');
      const names = await page.evaluate(async () => { const { backupFilename } = await import('./files.js'); return [backupFilename(new Date(2026, 9, 14, 18, 33)), backupFilename(new Date(2026, 9, 14, 18, 33))]; }); assert.deepEqual(names, ['SR-Backup-2026-10-14-1833.json', 'SR-Backup-2026-10-14-1833-1.json']);
      pass('Desktop: local timestamp and same-minute collision suffix');
    }
    await choose(empty); await verified(); await page.locator('#confirm-import').click(); await idle(); assert.equal((await read()).flashcards.length, 0);
    pass(`${name}: empty-library import into populated library`);
    assert.deepEqual(errors, []); await page.close();
  }
  console.log(count + '/' + count + ' Data workflow scenarios passed. System pickers/providers simulated; physical OneDrive and APK update not claimed.');
} finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
