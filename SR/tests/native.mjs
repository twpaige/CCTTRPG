import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.SR_PLAYWRIGHT || 'playwright');
const base = process.env.SR_TEST_URL || 'http://127.0.0.1:8765', profile = await mkdtemp(join(tmpdir(), 'sr-native-ui-'));
let context, page, count = 0;
const pass = message => { console.log('PASS UI ' + message); count++; };
const ready = () => page.waitForFunction(() => !document.getElementById('settings').disabled);
try {
  context = await chromium.launchPersistentContext(profile, { headless: true, executablePath: process.env.SR_BROWSER || undefined, viewport: { width: 390, height: 900 } });
  page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/tests/native.html'); await page.waitForFunction(() => Array.isArray(globalThis.srNativeResults), null, { timeout: 120000 });
  const results = await page.evaluate(() => srNativeResults); for (const row of results) console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.name}${row.error ? '\n' + row.error : ''}`); assert(results.every(row => row.pass));
  // A completely disposable Chrome profile. Production default DB here is never the owner's profile.
  await page.evaluate(async () => { const { createLegacy } = await import('./mastery.test.js'); await createLegacy('SRLearning'); });
  // Map the packaged Android paths to the exact source assets without changing production imports.
  await page.route('**/mobile/web/js/**', route => route.continue({ url: route.request().url().replace('/mobile/web/js/', '/js/') }));
  await page.route('**/mobile/web/shared/speech.css', route => route.continue({ url: base + '/poc/speech.css' }));
  await page.addInitScript(() => {
    const s = { status: 'stopped', serviceRunning: false, ready: true, voices: [{ name: 'Test offline voice', language: 'en-GB' }], voiceMessage: 'Test voice', android: 'simulated', webview: 'test', queuedCount: 0, queueLimit: 512 };
    const queue = []; let plan, current = 0, occurrence = 0;
    const activate = () => { const row = plan.units[current]; s.step = row; s.card = row.name; s.action = 'Question'; s.text = row.question; s.occurrenceId = String(++occurrence); s.startedAt = Date.now(); s.sessionId = plan.sessionId; };
    globalThis.nativeTest = { s, queue, finish() { const row = s.step; queue.push({ ...row, queueId: s.sessionId + ':' + s.occurrenceId, sessionId: s.sessionId, occurrenceId: s.occurrenceId, libraryGeneration: plan.libraryGeneration, mode: plan.mode, startedAt: s.startedAt, completedAt: Date.now(), ...(s.pending ? { pending: s.pending } : {}) }); if (s.pending) { s.refreshRequired = true; s.status = 'paused'; s.pending = undefined; } else if (++current < plan.units.length) activate(); else { s.serviceRunning = false; s.status = 'stopped'; s.step = null; } }, plan: () => plan };
    globalThis.SRNative = {
      status: () => JSON.stringify({ ...s, queuedCount: queue.length }),
      start(json) { plan = JSON.parse(json); current = 0; s.mode = plan.mode; s.serviceRunning = true; s.status = 'playing'; s.refreshRequired = false; activate(); },
      command(action) { if (action === 'STOP') { s.status = 'stopped'; s.serviceRunning = false; s.pending = undefined; s.step = null; } if (action === 'PAUSE') s.status = 'paused'; if (action === 'RESUME') s.status = 'playing'; if (action === 'SKIP') { s.pending = undefined; const id = s.step.cardId; while (current < plan.units.length && plan.units[current].cardId === id) current++; if (current === plan.units.length) this.command('STOP'); else activate(); } },
      completions: () => JSON.stringify(queue.slice(0, 32)), acknowledge(id) { if (queue[0]?.queueId !== id) return false; queue.shift(); return true; },
      queueMastery(json) { s.pending = JSON.parse(json); s.pendingMastery = s.pending.action.level; return ''; }, refresh() {},
    };
  });
  await page.goto(base + '/mobile/web/index.html'); await ready();
  if (process.env.SR_NATIVE_SCREENSHOT) await page.screenshot({ path: process.env.SR_NATIVE_SCREENSHOT, fullPage: true });
  await page.locator('#window').selectOption('max'); await page.locator('#recall').fill('3600'); await page.locator('#start').click();
  await page.waitForFunction(() => nativeTest.s.serviceRunning); let plan = await page.evaluate(() => nativeTest.plan());
  assert.equal(plan.units.length, 5); assert.equal(plan.units[0].recallMs, 3600000); assert.equal(plan.units[1].recallMs, 1800000);
  pass('Native-only start selects authored REVIEW and full recall overrides');
  await page.locator('#data').click(); assert.match(await page.locator('#error').textContent(), /Stop playback/);
  await page.evaluate(() => nativeTest.finish()); await page.waitForFunction(() => nativeTest.queue.length === 0);
  const read = () => page.evaluate(async () => { const { openDatabase } = await import('./js/db.js'); const { exportSnapshot } = await import('./js/backup.js'); const db = await openDatabase(); try { return await exportSnapshot(db); } finally { db.close(); } });
  assert.equal((await read()).stepEvents.length, 1); pass('Visible reconciliation saves due progress and blocks active Data transfer');
  await page.locator('summary').click(); await page.locator('#level').selectOption('8'); await page.locator('#queue').click();
  await page.waitForFunction(() => nativeTest.s.pending); assert.equal(await page.evaluate(() => nativeTest.s.status), 'paused');
  await page.locator('#resume').click(); await page.evaluate(() => nativeTest.finish()); await page.waitForFunction(() => nativeTest.queue.length === 0);
  assert.equal((await read()).stepProgress.find(row => row.flashcardId === 'card-0' && row.stepId === 'step-1').mastery, 8);
  pass('Queued mastery pauses and commits only after the answer; requires fresh selection');
  await page.locator('#stop').click(); await ready();
  await page.locator('#card').selectOption('card-1'); page.once('dialog', dialog => dialog.dismiss()); await page.locator('#known').click(); await ready();
  assert.equal((await read()).stepProgress.find(row => row.flashcardId === 'card-0' && row.stepId === 'step-4').mastery, 7);
  page.once('dialog', dialog => { assert.match(dialog.message(), /entire BOUND series/); return dialog.accept(); }); await page.locator('#known').click(); await ready();
  assert((await read()).stepProgress.every(row => row.mastery === 10));
  await page.locator('#mode').selectOption('AUDIT'); await page.locator('#start').click(); plan = await page.evaluate(() => nativeTest.plan());
  await page.waitForFunction(() => nativeTest.plan()?.mode === 'AUDIT'); plan = await page.evaluate(() => nativeTest.plan());
  assert.equal(plan.units.length, 1); assert.equal(plan.units[0].cardId, 'card-1'); pass('Confirmed KNOWN and AUDIT ALL preserve final BOUND-series semantics');
  await page.locator('#stop').click(); await ready(); await page.reload(); await ready(); assert.equal(await page.evaluate(() => nativeTest.s.serviceRunning), false); pass('Reopening does not resume speech');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.deepEqual(errors, []);
  pass('390px listening controls fit; no uncaught JavaScript errors');
  console.log(`${results.length}/${results.length} native integration domain tests + ${count}/${count} mobile UI tests passed. Bridge/audio simulated; IndexedDB real.`);
} finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
