// Disposable Chromium profile, real IndexedDB/Web Locks/UI, simulated sound callbacks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.SR_PLAYWRIGHT || 'playwright');
const base = process.env.SR_TEST_URL || 'http://127.0.0.1:8765', name = 'SRLearning-test-player-ui';
const profile = await mkdtemp(join(tmpdir(), 'sr-study-test-'));
let context, page, count = 0;
const pass = text => { console.log(`PASS UI ${text}`); count++; };
const ready = () => page.waitForFunction(() => !document.getElementById('settings').disabled);
const phase = value => page.waitForFunction(value => document.getElementById('status').textContent.includes(`· ${value}`), value);
const spoken = () => page.waitForFunction(() => !!globalThis.testSynth.current);
const end = () => page.evaluate(() => testSynth.end());
const press = id => page.locator(`#${id}`).click();
const read = () => page.evaluate(async name => { const { openDatabase } = await import('./js/db.js'); const { exportSnapshot } = await import('./js/backup.js'); const db = await openDatabase({ name }); try { return await exportSnapshot(db); } finally { db.close(); } }, name);
async function confirm(id, accept, text) { page.once('dialog', async dialog => { if (text) assert.match(dialog.message(), text); await (accept ? dialog.accept() : dialog.dismiss()); }); await press(id); }
try {
  context = await chromium.launchPersistentContext(profile, { headless: true, executablePath: process.env.SR_BROWSER || undefined, viewport: { width: 1440, height: 1000 } });
  page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/tests/study.html`); await page.waitForFunction(() => Array.isArray(globalThis.srStudyResults), null, { timeout: 180000 });
  const results = await page.evaluate(() => globalThis.srStudyResults);
  for (const row of results) console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.name}${row.error ? '\n' + row.error : ''}`);
  assert(results.every(row => row.pass), 'Stage 6 domain tests failed');
  await page.evaluate(async name => { const { seed } = await import('./study.test.js'); const db = await seed(name); db.close(); }, name);
  await context.addInitScript(() => {
    globalThis.testSynth = new class extends EventTarget {
      current = null; spoken = []; voices = []; overlaps = 0;
      getVoices() { return this.voices; }
      speak(u) { if (this.current) this.overlaps++; this.current = u; this.spoken.push(u.text); }
      cancel() { this.current = null; }
      end() { const u = this.current; this.current = null; u.onend?.(); }
    }();
    Object.defineProperty(window, 'speechSynthesis', { value: testSynth });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(text) { this.text = text; } } });
    globalThis.testVoices = () => { testSynth.voices = [{ name: 'Google UK English Male', voiceURI: 'test', lang: 'en-GB', localService: true }]; testSynth.dispatchEvent(new Event('voiceschanged')); };
  });
  const url = `${base}/index.html?test=${name}`;
  await page.goto(url); await ready(); assert(await page.locator('#start').isDisabled()); await page.evaluate(() => testVoices()); assert(await page.locator('#start').isEnabled());
  assert.match(await page.locator('#voice-note').textContent(), /Preferred voice/); assert.match(await page.locator('#library-link').getAttribute('href'), /library.html\?test=/);
  pass('asynchronous preferred voice discovery and navigation preserve isolated database');
  await page.locator('#series').selectOption('bound'); await page.locator('#recall').fill('0'); await press('start'); await spoken();
  assert.match(await page.locator('#current-card').textContent(), /Delaware/); assert.equal(await page.locator('#question').textContent(), '  a question 0? 🧠\n');
  const before = await read(); await end(); await phase('answer'); assert.equal((await read()).stepEvents.length, 0);
  const spokenBefore = await page.evaluate(() => testSynth.spoken.length);
  await press('level-7'); assert.match(await page.locator('#pending').textContent(), /2 weeks.*after the answer/); await phase('answer');
  assert.equal(await page.evaluate(() => testSynth.spoken.length), spokenBefore);
  assert.equal(await page.locator('#level-7').getAttribute('aria-checked'), 'true'); assert.match(await page.locator('#level-0').getAttribute('class'), /saved-level/);
  assert.match(await page.locator('#level-7').getAttribute('class'), /pending-level/);
  assert.equal((await read()).stepProgress.find(r => r.stepId === 'a0').mastery, 0); await end(); await spoken(); await page.waitForFunction(() => document.getElementById('current-step').textContent.includes('Authored step 2'));
  let after = await read(); assert.equal(after.stepEvents.length, 1); assert.equal(after.stepProgress.find(r => r.stepId === 'a0').mastery, 7); assert.deepEqual(after.flashcards, before.flashcards);
  assert.match(await page.locator('#mastery-saved').textContent(), /Saved mastery 7/); assert.equal(await page.locator('#level-0').getAttribute('aria-checked'), 'true');
  pass('one-click queues without interrupting speech, current/pending differ, answer saves and next step resets selection');
  const second = await context.newPage(); await second.goto(url); await second.waitForFunction(() => !document.getElementById('settings').disabled); await second.evaluate(() => testVoices()); await second.locator('#start').click();
  await second.waitForFunction(() => document.getElementById('error').textContent.includes('busy in another tab')); assert.equal(await second.evaluate(() => testSynth.spoken.length), 0);
  await second.goto(`${base}/library.html?test=${name}`); await second.waitForFunction(() => !document.getElementById('workspace').disabled); await second.getByRole('button', { name: 'New series', exact: true }).click(); await second.locator('#series-name').fill('Unsaved test draft'); await second.locator('#save').click();
  await second.waitForFunction(() => document.getElementById('error').textContent.includes('Stop playback')); assert.equal(await second.locator('#series-name').inputValue(), 'Unsaved test draft'); second.on('dialog', d => d.accept()); await second.close();
  pass('second-tab playback rejected; editor save blocked with draft retained');
  await press('pause'); await press('skip'); await phase('paused'); assert.match(await page.locator('#current-card').textContent(), /Card b/);
  await press('resume'); await spoken(); await confirm('known', true, /entire BOUND series/); await ready();
  after = await read(); assert(after.stepProgress.filter(r => ['a', 'b'].includes(r.flashcardId)).every(r => r.mastery === 10)); assert.equal(after.stepEvents.length, 1);
  pass('paused Skip preserves prior credit and confirmed special KNOWN propagates BOUND series');
  await page.locator('#mode').selectOption('AUDIT'); await press('start'); await spoken(); assert.match(await page.locator('#current-card').textContent(), /Card b/);
  const audit = await read(); await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(() => document.getElementById('status').textContent.includes('cycle 2'));
  assert.deepEqual((await read()).stepProgress, audit.stepProgress); assert.deepEqual((await read()).stepEvents, audit.stepEvents);
  await confirm('reset-final', true, /change 1 steps/); await phase('paused'); await press('resume'); await spoken(); assert.match(await page.locator('#current-card').textContent(), /Delaware/); await press('stop'); await ready();
  pass('continuous AUDIT makes no automatic writes and refreshes reset-final eligibility');
  await page.locator('#mode').selectOption('REVIEW'); await page.locator('#window').selectOption('max'); await press('start'); await spoken(); const reloadBefore = await read();
  await page.reload(); await ready(); await page.evaluate(() => testVoices()); assert.equal(await page.evaluate(() => testSynth.spoken.length), 0); assert.deepEqual((await read()).stepProgress, reloadBefore.stepProgress);
  await press('start'); await spoken(); await press('stop'); await ready(); assert.equal(await page.evaluate(() => testSynth.overlaps), 0);
  pass('reload cancels unfinished work without credit or automatic speech; lease can be reacquired');
  await page.setViewportSize({ width: 390, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.locator('#start').focus(); await page.keyboard.press('Enter'); await spoken(); await press('stop'); await ready();
  if (process.env.SR_STUDY_SCREENSHOT) await page.screenshot({ path: process.env.SR_STUDY_SCREENSHOT, fullPage: true });
  assert.deepEqual(errors, []); pass('narrow-screen layout, keyboard Start and no uncaught page errors');
  async function fresh() {
    await page.evaluate(async ({ name, original }) => { const { openDatabase } = await import('./js/db.js'); const { exportJSON, restoreJSON } = await import('./js/backup.js'); const db = await openDatabase({ name }); try { await restoreJSON(db, JSON.stringify(original), { confirmed: true, safetyJSON: await exportJSON(db) }); } finally { db.close(); } }, { name, original: before });
    await page.reload(); await ready(); await page.evaluate(() => testVoices()); await page.locator('#series').selectOption('bound'); await page.locator('#recall').fill('0'); await press('start'); await spoken();
  }
  await fresh();
  assert.equal(await page.locator('#queue, #level').count(), 0);
  assert.deepEqual(await page.locator('#levels button span').allTextContents(), ['15m','3h','6h','1d','2d','3d','1w','2w','1mo','3mo','KNOWN']);
  assert.deepEqual(await page.locator('#levels button strong').allTextContents(), Array.from({length:11}, (_,i)=>String(i)));
  assert.equal(await page.getByRole('radio').count(), 11); assert.equal(await page.locator('[role=radio][aria-checked=true]').count(), 1);
  await press('level-2'); await press('level-8'); await press('level-4');
  assert.equal(await page.evaluate(() => testSynth.spoken.length), 1); assert.equal(await page.locator('#level-4').getAttribute('aria-checked'), 'true');
  await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(() => document.getElementById('current-step').textContent.includes('Authored step 2'));
  assert.equal((await read()).stepProgress.find(r=>r.stepId==='a0').mastery,4); await press('stop'); await ready();
  pass('all eleven labelled radio buttons; rapid selections commit only the last level');
  await fresh(); await page.locator('#level-0').focus(); await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#level-1').getAttribute('aria-checked'),'true');
  await page.keyboard.press('End'); assert.equal(await page.locator('#level-10').getAttribute('aria-checked'),'true');
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#level-10').getAttribute('aria-checked'),'true');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(() => document.getElementById('current-step').textContent.includes('Authored step 2'));
  after=await read(); assert.equal(after.stepProgress.find(r=>r.stepId==='a0').mastery,10); assert.equal(after.stepProgress.find(r=>r.stepId==='a1').mastery,0); await press('stop'); await ready();
  pass('keyboard arrows/Home/End, intermediate KNOWN without confirmation and responsive selector');
  await fresh(); await press('level-6'); await press('skip'); await spoken(); await page.waitForFunction(() => document.getElementById('current-card').textContent.includes('Card b'));
  assert.equal(await page.locator('#level-0').getAttribute('aria-checked'),'true'); assert.equal((await read()).stepProgress.find(r=>r.stepId==='a0').mastery,0);
  await press('level-9'); await press('stop'); await ready(); assert.equal((await read()).stepProgress.find(r=>r.stepId==='b0').mastery,0);
  pass('Stop and playing Skip discard selection without leaking into the next step');
  await fresh(); await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(() => document.getElementById('current-step').textContent.includes('Authored step 2'));
  await confirm('level-10', false, /2 steps across 1 flashcards/); await spoken(); assert.match(await page.locator('#status').textContent(), /playing/); assert.equal(await page.locator('#level-0').getAttribute('aria-checked'),'true');
  await confirm('level-10', true, /2 steps across 1 flashcards/); await spoken(); await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(() => document.getElementById('current-card').textContent.includes('Card b'));
  after=await read(); assert(after.stepProgress.filter(r=>r.flashcardId==='a').every(r=>r.mastery===10)); assert(after.stepProgress.filter(r=>r.flashcardId==='b').every(r=>r.mastery===0));
  for(let i=0;i<2;i++){ await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(n=>document.getElementById('current-step').textContent.includes('Authored step '+n),i+2); }
  await confirm('level-10', true, /entire BOUND series/); await spoken(); await end(); await phase('answer'); await end(); await ready();
  assert((await read()).stepProgress.filter(r=>['a','b'].includes(r.flashcardId)).every(r=>r.mastery===10));
  pass('final-step KNOWN cancel safely continues; confirmed card and final BOUND-series propagation');
  assert.deepEqual(errors, []);
  console.log(`${results.length}/${results.length} Stage 6 domain scenarios + ${count}/${count} UI scenarios. ${await page.evaluate(() => navigator.userAgent)}. Simulated speech; no audible claim.`);
} finally { await context?.close(); assert.equal(dirname(profile), tmpdir()); assert(profile.includes('sr-study-test-')); await rm(profile, { recursive: true, force: true }); }
