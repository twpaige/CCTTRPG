// Development-only Playwright runner. No browser library ships with SR.
import { installPickers } from './file-pickers.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SR_PLAYWRIGHT || 'playwright');
const url = process.env.SR_TEST_URL || 'http://127.0.0.1:8765';
const profile = await mkdtemp(join(tmpdir(), 'sr-browser-test-'));
let context;
const launch = () => chromium.launchPersistentContext(profile, { headless: true, executablePath: process.env.SR_BROWSER || undefined });
try {
  context = await launch(); let page = await context.newPage();
  await page.goto(`${url}/tests/persistence.html`);
  await page.waitForFunction(() => Array.isArray(globalThis.srPersistenceResults), null, { timeout: 120000 });
  const result = await page.evaluate(() => ({ results: globalThis.srPersistenceResults, timings: globalThis.srScaleTimings, browser: navigator.userAgent }));
  for (const row of result.results) console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.name}${row.error ? '\n' + row.error : ''}`);
  console.log(JSON.stringify({ browser: result.browser, scaleMilliseconds: result.timings }));
  if (result.results.some(row => !row.pass)) throw new Error('Persistence suite failed');
  // Separate browser process restart, with the same disposable profile/origin.
  await page.evaluate(async () => {
    const { openDatabase } = await import('../js/db.js'); const { Repository } = await import('../js/repository.js');
    const db = await openDatabase({ name: 'SRLearning-test-lifecycle' }); const repo = new Repository(db);
    const series = await repo.createSeries({ id: 'lifecycle-series', name: 'Restart', bound: false });
    await repo.createCard({ id: 'lifecycle-card', seriesId: series.id, name: 'Persist', steps: [{ question: 'Before close?', answer: 'After restart. 🧠' }] }); db.close();
  });
  await context.close(); context = await launch(); page = await context.newPage();
  await page.goto(`${url}/tests/runner.html`);
  await page.waitForFunction(() => document.getElementById('result').textContent.includes('33/33'));
  // Modules must be loaded before disconnecting; cold offline launch is Stage 9.
  await page.evaluate(async () => { globalThis.srLifecycleModules = await Promise.all([import('../js/db.js'), import('../js/repository.js'), import('../js/backup.js')]); });
  await context.setOffline(true);
  const persisted = await page.evaluate(async () => {
    const [{ openDatabase }, { Repository }, { exportJSON, restoreJSON }] = globalThis.srLifecycleModules;
    const db = await openDatabase({ name: 'SRLearning-test-lifecycle' }), repo = new Repository(db);
    const card = await repo.getCard('lifecycle-card');
    if (card.steps[0].answer !== 'After restart. 🧠') throw new Error('Restart lost content');
    await repo.updateProgress(card.id, { mastery: 7 }, 1);
    const json = await exportJSON(db); await restoreJSON(db, json, { confirmed: true, safetyJSON: json });
    const mastery = (await repo.getProgress(card.id)).mastery; db.close(); return mastery;
  });
  if (persisted !== 7) throw new Error('Offline storage failed');
  await context.setOffline(false);
  await installPickers(page, profile);
  await page.goto(`${url}/data/index.html?test=SRLearning-test-panel`);
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('Saved locally'));
  const original = await page.evaluate(async () => {
    const { openDatabase } = await import('../js/db.js'); const { Repository } = await import('../js/repository.js'); const { exportJSON } = await import('../js/backup.js');
    const db = await openDatabase({ name: 'SRLearning-test-panel' }); const repo = new Repository(db);
    const series = await repo.createSeries({ name: 'UI test', bound: false });
    await repo.createCard({ name: 'Original', seriesId: series.id, steps: [{ question: 'Unicode?', answer: '日本語\n🧠' }] });
    const json = await exportJSON(db); db.close(); return json;
  });
  await page.reload(); await page.waitForFunction(() => document.getElementById('status').textContent.includes('1 cards'));
  await page.locator('#export').click();
  await page.waitForFunction(() => document.getElementById('preview').textContent.includes('Complete Backup Saved'));
  const saved = JSON.parse(await readFile(join(profile, 'backup.json'), 'utf8')); if (saved.flashcards[0].name !== 'Original') throw new Error('Wrong backup');
  await writeFile(join(profile, 'backup.json'), '');
  const incoming = JSON.parse(original); incoming.flashcards[0].name = 'Restored';
  await page.evaluate(json => { picker.incoming = json; }, JSON.stringify(incoming));
  await page.locator('#choose-import').click(); await page.locator('#destination').click();
  await page.locator('#confirm-import').click();
  await page.waitForFunction(() => document.getElementById('preview').textContent.includes('Library Imported Successfully'));
  if (JSON.parse(await readFile(join(profile, 'backup.json'), 'utf8')).flashcards[0].name !== 'Original') throw new Error('Wrong automatic outgoing backup');
  await page.reload(); await page.waitForFunction(() => document.getElementById('status').textContent.includes('1 cards'));
  const errors = await page.locator('#error').textContent(); if (errors) throw new Error(errors);
  console.log('PASS Data panel manual/automatic external backup, readback, confirmation, replacement and reload');
  // Hold an actual replacement transaction open, destroy its page, then verify rollback.
  await page.evaluate(async () => {
    const { openDatabase } = await import('../js/db.js'); const { exportJSON, restoreJSON } = await import('../js/backup.js');
    const db = await openDatabase({ name: 'SRLearning-test-panel' }), safe = await exportJSON(db), snapshot = JSON.parse(safe);
    snapshot.flashcards[0].name = 'Must roll back';
    const original = IDBObjectStore.prototype.add; let held = false;
    IDBObjectStore.prototype.add = function (...args) {
      const result = original.apply(this, args);
      if (this.name === 'progress' && !held) {
        held = true; const store = this;
        const keepAlive = () => { const read = store.get('keepalive'); read.onsuccess = () => { globalThis.srRestoreHeld = true; keepAlive(); }; };
        keepAlive();
      }
      return result;
    };
    globalThis.srInterruptedRestore = restoreJSON(db, JSON.stringify(snapshot), { confirmed: true, safetyJSON: safe }).catch(() => {});
  });
  await page.waitForFunction(() => globalThis.srRestoreHeld === true); await page.close(); page = await context.newPage();
  await page.goto(`${url}/data/index.html?test=SRLearning-test-panel`);
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('1 cards'));
  const afterInterrupt = await page.evaluate(async () => {
    const { openDatabase } = await import('../js/db.js'); const { exportSnapshot } = await import('../js/backup.js');
    const db = await openDatabase({ name: 'SRLearning-test-panel' }); const snapshot = await exportSnapshot(db); db.close(); return snapshot.flashcards[0].name;
  });
  if (afterInterrupt !== 'Restored') throw new Error('Interrupted restore damaged old content');
  console.log('PASS closing page during an active replacement transaction rolls back the import');
  console.log(`PASS browser-process restart, offline read/write/export/restore, and 33 desktop browser regressions\n${result.results.length}/${result.results.length} persistence tests passed.`);
} finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
