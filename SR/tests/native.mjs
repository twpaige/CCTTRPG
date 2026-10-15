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
    const s = { status: 'stopped', serviceRunning: false, prepared: false, ready: true, controlGeneration: 0, voices: [], android: 'simulated', webview: 'test' };
    const queue = [], finished = new Set(); let plan, current = 0, part = '', revised = [], after;
    const activate = () => { const row = plan.units[current]; s.step = row; s.card = row.name; s.action = 'Question'; s.text = row.question; s.occurrenceId = String(current); s.startedAt = Date.now(); s.sessionId = plan.sessionId; };
    globalThis.nativeTest = { s, queue, plan: () => plan, finish() {
      const row = s.step;
      if (!finished.has(row.id) && plan.mode === 'REVIEW') queue.push({ ...row, queueId: s.sessionId + ':' + row.id, sessionId: s.sessionId, occurrenceId: 'step:' + row.id, libraryGeneration: plan.libraryGeneration, mode: plan.mode, startedAt: s.startedAt, completedAt: Date.now() });
      finished.add(row.id); current = (current + 1) % plan.units.length; activate();
    } };
    globalThis.SRNative = {
      status: () => JSON.stringify({ ...s, queuedCount: queue.length, preparedCount: plan?.units.length || 0 }),
      session(op, arg) {
        if (op === 'pause') this.command('PAUSE');
        if (op === 'cancelEdit') s.refreshRequired = false;
        if (nativeTest.failOperation === op) return 'ERROR: Injected storage failure';
        if (op === 'begin') { plan = { ...JSON.parse(arg), units: [] }; finished.clear(); }
        if (op === 'part') part += arg;
        if (op === 'step') { plan.units.push(JSON.parse(part)); part = ''; }
        if (op === 'finish') s.prepared = true;
        if (op === 'abort') { plan = undefined; s.prepared = false; part = ''; }
        if (op === 'play') { current = 0; s.serviceRunning = true; s.mode = plan.mode; s.status = 'playing'; s.refreshRequired = false; activate(); }
        if (op === 'edit') { s.refreshRequired = true; after = Number(s.step.id); if (JSON.parse(arg).skipCard) after = Math.max(...plan.units.filter(row => row.cardId === s.step.cardId).map(row => Number(row.id))); }
        if (op === 'updateBegin') revised = [];
        if (op === 'manifest') return JSON.stringify({ header: plan, count: plan.units.length, units: plan.units.slice(Number(arg), Number(arg) + 32) });
        if (op === 'updateStep') { const patch = JSON.parse(arg); if (patch.keep) revised.push({ ...plan.units.find(row => row.id === patch.id), ...patch }); }
        if (op === 'updateFinish') { plan.units = revised; s.refreshRequired = false; if (!revised.length) this.command('STOP'); else { current = revised.findIndex(row => Number(row.id) > after); if (current < 0) current = 0; activate(); } }
        return '';
      },
      command(action) {
        if (['PAUSE', 'STOP', 'SKIP'].includes(action)) s.controlGeneration++;
        if (action === 'STOP') { s.status = 'stopped'; s.serviceRunning = false; s.prepared = false; s.step = null; s.refreshRequired = false; }
        if (action === 'PAUSE') s.status = 'paused';
        if (action === 'RESUME' && !s.refreshRequired) s.status = 'playing';
        if (action === 'SKIP') { const card = s.step.cardId; do { current++; } while (current < plan.units.length && plan.units[current].cardId === card); if (current === plan.units.length) current = 0; activate(); }
      },
      completions: () => JSON.stringify(queue.slice(0, 32)),
      acknowledge(id) { if (queue[0]?.queueId !== id) return false; queue.shift(); return true; }, refresh() {},
    };
  });
  await page.goto(base + '/mobile/web/index.html'); await ready();
  const read = () => page.evaluate(async () => { const { openDatabase } = await import('./js/db.js'); const { exportSnapshot } = await import('./js/backup.js'); const db = await openDatabase(); try { const snapshot = await exportSnapshot(db); delete snapshot.exportedAt; return snapshot; } finally { db.close(); } });
  const prepare = async () => { await page.locator('#prepare').click(); await page.waitForFunction(() => !document.getElementById('play').disabled); };
  const play = async () => { await page.locator('#play').click(); await page.waitForFunction(() => nativeTest.s.serviceRunning); };
  const stop = async () => { await page.locator('#stop').click(); await ready(); };
  const idle = () => page.waitForFunction(() => !document.querySelector('[data-level="0"]').disabled);
  await page.locator('#window').selectOption('max'); await page.locator('#recall').fill('3600'); await prepare();
  let plan = await page.evaluate(() => nativeTest.plan());
  assert.equal(plan.units.length, 5); assert.equal(plan.units[0].recallMs, 3600000); assert.equal(plan.units[1].recallMs, 1800000);
  assert.equal(await page.evaluate(() => nativeTest.s.serviceRunning), false);
  pass('PREPARE freezes authored REVIEW and recall overrides without starting speech');
  await page.locator('#data').click(); assert.match(await page.locator('#error').textContent(), /Stop the prepared session/);
  await play(); await page.evaluate(() => nativeTest.finish()); await page.waitForFunction(() => nativeTest.queue.length === 0);
  assert.equal((await read()).stepEvents.length, 1); pass('PLAY and visible reconciliation save due progress and guard Data transfer');
  const previous = (await read()).stepProgress.find(row => row.stepId === 'step-1');
  await page.locator('[data-level="8"]').click(); await idle();
  const changed = (await read()).stepProgress.find(row => row.stepId === 'step-1');
  assert.equal(changed.mastery, 8); assert.equal(changed.lastReviewedAt, previous.lastReviewedAt);
  assert.equal(await page.evaluate(() => nativeTest.s.status), 'playing'); assert.equal(await page.evaluate(() => nativeTest.s.step.stepId), 'step-2');
  assert.equal((await read()).stepEvents.length, 1);
  pass('One-touch mastery saves immediately, resumes next step and gives no interrupted completion credit');
  const beforeCancel = await read(); await page.locator('[data-level="10"]').click();
  await page.locator('#confirmation').waitFor({ state: 'visible' }); assert.equal(await page.evaluate(() => nativeTest.s.status), 'paused');
  await page.locator('#confirmation button[value="cancel"]').click(); await idle();
  assert.deepEqual(await read(), beforeCancel); assert.equal(await page.evaluate(() => nativeTest.s.step.stepId), 'step-2');
  assert.equal(await page.evaluate(() => nativeTest.s.status), 'playing');
  pass('Intermediate KNOWN always confirms; cancel resumes interrupted step unchanged');
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; globalThis.restorePut = () => IDBObjectStore.prototype.put = put; IDBObjectStore.prototype.put = function(...args) { if (this.name === 'stepProgress') throw new Error('Injected mastery save failure'); return put.apply(this, args); }; });
  await page.locator('[data-level="7"]').click(); await page.waitForFunction(() => document.getElementById('error').textContent.includes('Injected mastery save failure'));
  assert.equal(await page.evaluate(() => nativeTest.s.status), 'paused'); assert.deepEqual(await read(), beforeCancel);
  await page.evaluate(() => restorePut()); await stop();
  pass('Failed mastery transaction leaves progress unchanged and playback paused');
  await page.locator('#card').selectOption('card-1'); await page.locator('#step').selectOption('step-4'); await page.locator('[data-level="10"]').click();
  await page.locator('#confirmation').waitFor({ state: 'visible' }); assert.match(await page.locator('#confirmation-text').textContent(), /entire BOUND series/);
  await page.locator('#confirmation button[value="confirm"]').click(); await ready(); assert((await read()).stepProgress.every(row => row.mastery === 10));
  await page.locator('#mode').selectOption('AUDIT'); await prepare(); await play();
  assert.equal(await page.evaluate(() => nativeTest.plan().units.length), 1); assert.equal(await page.evaluate(() => nativeTest.s.step.cardId), 'card-1');
  pass('Confirmed final KNOWN propagates through BOUND series; AUDIT selects comprehensive final');
  await page.locator('[data-reset="resetObjective"]').click(); await page.locator('#confirmation').waitFor({ state: 'visible' });
  await page.locator('#confirmation button[value="confirm"]').click(); await ready(); assert((await read()).stepProgress.every(row => row.mastery === 0));
  assert.equal(await page.evaluate(() => nativeTest.s.serviceRunning), false);
  pass('AUDIT objective reset preserves scope and ends a now-empty prepared session');
  await page.locator('#mode').selectOption('REVIEW'); await prepare(); await play();
  await page.locator('#pause').click(); const pausedId = await page.evaluate(() => nativeTest.s.step.id);
  await page.locator('#resume').click(); assert.equal(await page.evaluate(() => nativeTest.s.step.id), pausedId);
  await stop(); assert(await page.locator('#play').isDisabled());
  pass('Ordinary Pause/Resume preserves position; Stop requires new preparation');
  for (let level = 0; level < 10; level++) {
    await prepare(); await play(); const step = await page.evaluate(() => nativeTest.s.step);
    await page.locator('[data-level="' + level + '"]').click(); await idle();
    assert.equal((await read()).stepProgress.find(row => row.flashcardId === step.cardId && row.stepId === step.stepId).mastery, level);
    assert.equal(await page.evaluate(() => nativeTest.s.status), 'playing'); await stop();
  }
  pass('Every mastery level 0–9 completes with one tap');
  await page.evaluate(() => nativeTest.failOperation = 'part'); await page.locator('#prepare').click();
  await page.waitForFunction(() => document.getElementById('error').textContent.includes('Injected storage failure'));
  assert(await page.locator('#play').isDisabled()); assert.equal(await page.evaluate(() => nativeTest.s.prepared), false);
  await page.evaluate(() => nativeTest.failOperation = undefined); await prepare(); await play();
  await page.locator('[data-level="10"]').click(); await page.locator('#confirmation').waitFor({ state: 'visible' });
  const beforeStop = await read(); await page.evaluate(() => SRNative.command('STOP'));
  await page.locator('#confirmation button[value="confirm"]').click(); await ready();
  assert.deepEqual(await read(), beforeStop); assert.equal(await page.evaluate(() => nativeTest.s.status), 'stopped');
  pass('Preparation failure never enables PLAY; Stop during confirmation prevents save or restart');
  await page.reload(); await ready(); assert.equal(await page.evaluate(() => nativeTest.s.serviceRunning), false);
  pass('Reopening never resumes speech');
  if (process.env.SR_NATIVE_SCREENSHOT) await page.screenshot({ path: process.env.SR_NATIVE_SCREENSHOT, fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.deepEqual(errors, []);
  pass('390px controls fit without uncaught JavaScript errors');
  console.log(results.length + '/' + results.length + ' native integration domain tests + ' + count + '/' + count + ' mobile UI tests passed. Bridge/audio simulated; IndexedDB real.');
} finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
