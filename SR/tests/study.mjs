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
const ready = async () => { await page.waitForFunction(() => !document.getElementById('settings').disabled); if (!await page.locator('#session-panel').evaluate(el => el.open)) await page.locator('#session-panel summary').click(); };
const phase = value => page.waitForFunction(value => document.getElementById('status').textContent.includes(`· ${value[0].toUpperCase()}${value.slice(1)}`), value);
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
    const timeout = window.setTimeout.bind(window);
    globalThis.testNoticeCallbacks = [];
    window.setTimeout = (fn, delay, ...args) => { if (delay === 2500) testNoticeCallbacks.push(fn); return timeout(fn, delay, ...args); };
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
  await page.goto(url); await page.waitForFunction(()=>!document.getElementById('settings').disabled);
  assert.equal(await page.locator('#session-panel').evaluate(el=>el.open),false);
  assert.equal(await page.locator('#mode').inputValue(),'REVIEW'); assert.equal(await page.locator('#series').inputValue(),'');
  assert.equal(await page.locator('#window').inputValue(),'days'); assert.equal(await page.locator('#days').inputValue(),'7'); assert(!(await page.locator('#random').isChecked()));
  assert.equal(await page.locator('#session-summary').textContent(),'REVIEW · All series · Next 7 days');
  assert(await page.locator('#start').isVisible()); assert.equal(await page.evaluate(()=>testSynth.spoken.length),0);
  pass('collapsed default REVIEW / All series / 7-day lookahead, no shuffle or automatic speech, Start visible and correct summary');
  await ready(); assert(await page.locator('#start').isDisabled()); await page.evaluate(() => testVoices()); assert(await page.locator('#start').isEnabled());
  assert.match(await page.locator('#voice-note').textContent(), /Preferred voice/); assert.match(await page.locator('#library-link').getAttribute('href'), /library.html\?test=/);
  pass('asynchronous preferred voice discovery and navigation preserve isolated database');
  await page.locator('#series').selectOption('bound'); await page.locator('#recall').fill('0'); await press('start'); await spoken();
  assert.match(await page.evaluate(()=>testSynth.spoken.at(-1)), /a question/); assert.equal(await page.evaluate(()=>testSynth.current.text), '  a question 0? 🧠\n');
  const before = await read(); await end(); await phase('answer'); assert.equal((await read()).stepEvents.length, 0);
  const spokenBefore = await page.evaluate(() => testSynth.spoken.length);
  await press('level-7'); assert.match(await page.locator('#pending').textContent(), /7 pending until answer completion/); await phase('answer');
  assert.equal(await page.evaluate(() => testSynth.spoken.length), spokenBefore);
  assert.equal(await page.locator('#level-7').getAttribute('aria-checked'), 'true'); assert.match(await page.locator('#level-0').getAttribute('class'), /saved-level/);
  assert.match(await page.locator('#level-7').getAttribute('class'), /pending-level/);
  assert.equal((await read()).stepProgress.find(r => r.stepId === 'a0').mastery, 0); await end(); await spoken(); await page.waitForFunction(() => testSynth.current?.text.includes('question 1'));
  let after = await read(); assert.equal(after.stepEvents.length, 1); assert.equal(after.stepProgress.find(r => r.stepId === 'a0').mastery, 7); assert.deepEqual(after.flashcards, before.flashcards);
  assert.match(await page.locator('#mastery-saved').textContent(), /Saved mastery 7/); assert.equal(await page.locator('#level-0').getAttribute('aria-checked'), 'true');
  pass('one-click queues without interrupting speech, current/pending differ, answer saves and next step resets selection');
  const second = await context.newPage(); await second.goto(url); await second.waitForFunction(() => !document.getElementById('settings').disabled); await second.evaluate(() => testVoices()); await second.locator('#start').click();
  await second.waitForFunction(() => document.getElementById('error').textContent.includes('busy in another tab')); assert.equal(await second.evaluate(() => testSynth.spoken.length), 0);
  await second.goto(`${base}/library.html?test=${name}`); await second.waitForFunction(() => !document.getElementById('workspace').disabled); await second.getByRole('button', { name: 'New series', exact: true }).click(); await second.locator('#series-name').fill('Unsaved test draft'); await second.locator('#save').click();
  await second.waitForFunction(() => document.getElementById('error').textContent.includes('Stop playback')); assert.equal(await second.locator('#series-name').inputValue(), 'Unsaved test draft'); second.on('dialog', d => d.accept()); await second.close();
  pass('second-tab playback rejected; editor save blocked with draft retained');
  await press('pause'); await press('skip'); await phase('paused'); assert(await page.locator('#previous-fc').isEnabled());
  await press('resume'); await spoken(); await press('skip-step'); await spoken(); await press('skip-step'); await spoken(); await confirm('level-10', true, /entire BOUND series/); await spoken(); await end(); await phase('answer'); await end(); await ready();
  after = await read(); assert(after.stepProgress.filter(r => ['a', 'b'].includes(r.flashcardId)).every(r => r.mastery === 10)); assert.equal(after.stepEvents.length, 2);
  pass('paused Skip preserves prior credit and confirmed final-step KNOWN propagates BOUND series');
  await page.locator('#mode').selectOption('AUDIT'); await press('start'); await spoken(); assert.match(await page.evaluate(()=>testSynth.spoken.at(-1)), /b question/);
  const audit = await read(); await end(); await phase('answer'); await end(); await spoken(); assert.match(await page.locator('#status').textContent(), /AUDIT · States \(synthetic\) · Card 2\/2 · Step 3\/3 · Question/);
  assert.deepEqual((await read()).stepProgress, audit.stepProgress); assert.deepEqual((await read()).stepEvents, audit.stepEvents);
  await confirm('reset-final', true, /change 1 steps/); await phase('paused'); await press('resume'); await spoken(); assert.match(await page.evaluate(()=>testSynth.spoken.at(-1)), /a question/); await press('stop'); await ready();
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
  await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(() => testSynth.current?.text.includes('question 1'));
  assert.equal((await read()).stepProgress.find(r=>r.stepId==='a0').mastery,4); await press('stop'); await ready();
  pass('all eleven labelled radio buttons; rapid selections commit only the last level');
  await fresh(); await page.locator('#level-0').focus(); await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#level-1').getAttribute('aria-checked'),'true');
  await page.keyboard.press('End'); assert.equal(await page.locator('#level-10').getAttribute('aria-checked'),'true');
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#level-10').getAttribute('aria-checked'),'true');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(() => testSynth.current?.text.includes('question 1'));
  after=await read(); assert.equal(after.stepProgress.find(r=>r.stepId==='a0').mastery,10); assert.equal(after.stepProgress.find(r=>r.stepId==='a1').mastery,0); await press('stop'); await ready();
  pass('keyboard arrows/Home/End, intermediate KNOWN without confirmation and responsive selector');
  await fresh(); await press('level-6'); await press('skip'); await spoken(); await page.waitForFunction(() => testSynth.current?.text.includes('b question'));
  assert.equal(await page.locator('#level-0').getAttribute('aria-checked'),'true'); assert.equal((await read()).stepProgress.find(r=>r.stepId==='a0').mastery,0);
  await press('level-9'); await press('stop'); await ready(); assert.equal((await read()).stepProgress.find(r=>r.stepId==='b0').mastery,0);
  pass('Stop and playing Skip discard selection without leaking into the next step');
  await fresh(); await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(() => testSynth.current?.text.includes('question 1'));
  await confirm('level-10', false, /2 steps across 1 flashcards/); await spoken(); assert.match(await page.locator('#status').textContent(), /Question/); assert.equal(await page.locator('#level-0').getAttribute('aria-checked'),'true');
  await confirm('level-10', true, /2 steps across 1 flashcards/); await spoken(); await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(() => testSynth.current?.text.includes('b question'));
  after=await read(); assert(after.stepProgress.filter(r=>r.flashcardId==='a').every(r=>r.mastery===10)); assert(after.stepProgress.filter(r=>r.flashcardId==='b').every(r=>r.mastery===0));
  for(let i=0;i<2;i++){ await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(n=>testSynth.current?.text.includes('question '+(n-1)),i+2); }
  await confirm('level-10', true, /entire BOUND series/); await spoken(); await end(); await phase('answer'); await end(); await ready();
  assert((await read()).stepProgress.filter(r=>['a','b'].includes(r.flashcardId)).every(r=>r.mastery===10));
  pass('final-step KNOWN cancel safely continues; confirmed card and final BOUND-series propagation');
  assert.deepEqual(errors, []);
  await fresh();
  assert.equal(await page.locator('#session-panel').evaluate(el=>el.open), false);
  assert.equal(await page.locator('#known').count(), 0);
  assert.equal(await page.locator('#flashcard-panel #playback-controls #start').count(), 1);
  const speechCount = await page.evaluate(()=>testSynth.spoken.length);
  await page.locator('#session-panel summary').click(); assert(await page.locator('#settings').evaluate(el=>el.disabled));
  await page.locator('#session-panel summary').click(); assert.equal(await page.evaluate(()=>testSynth.spoken.length), speechCount);
  await press('stop'); await page.waitForFunction(()=>!document.getElementById('settings').disabled);
  assert.equal(await page.locator('#session-panel').evaluate(el=>el.open), false);
  await page.reload(); assert.equal(await page.locator('#session-panel').evaluate(el=>el.open), false); await ready(); await page.evaluate(()=>testVoices());
  pass('vertical session panel initially collapses, Start stays collapsed, manual toggles preserve audio, Stop stays collapsed; controls belong to card');
  await fresh(); await press('stop'); await ready(); await page.locator('#window').selectOption('max'); await press('start'); await spoken(); assert(await page.locator('#previous-step').isDisabled());
  await page.locator('#repeat-step').check(); await press('level-7'); await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(()=>document.getElementById('mastery-saved').textContent.includes('Saved mastery 7'));
  assert.match(await page.evaluate(()=>testSynth.current.text), /question 0/); const once = await read();
  for(let i=0;i<2;i++){ await end(); await phase('answer'); await end(); await spoken(); }
  assert.deepEqual((await read()).stepProgress, once.stepProgress); assert.deepEqual((await read()).stepEvents, once.stepEvents);
  await page.locator('#repeat-step').uncheck(); await end(); await phase('answer'); await end(); await spoken(); await page.waitForFunction(()=>testSynth.current?.text.includes('question 1'));
  assert(!(await page.locator('#previous-step').isDisabled())); await press('previous-step'); await spoken(); assert.match(await page.evaluate(()=>testSynth.current.text), /a question 0/);
  await press('level-9'); await press('skip-step'); await spoken(); assert.equal((await read()).stepProgress.find(r=>r.stepId==='a0').mastery,7); assert.equal(await page.locator('#level-0').getAttribute('aria-checked'),'true');
  await page.locator('#repeat-step').check(); await press('pause'); await press('skip'); assert(!(await page.locator('#repeat-step').isChecked())); assert(await page.locator('#previous-step').isDisabled()); await press('stop'); await ready();
  pass('repeat practice, uncheck advance, Previous/Skip controls, pending cancellation and paused flashcard skip reset');
  assert.equal(await page.locator('.help-toggle, .help-tip, [role=tooltip], #current-card, #current-step, #current-progress, #question, #answer, #interval').count(), 0);
  pass('question/answer presentation, instructions and help UI removed; speech engine still receives exact text');
  for(const width of [1440,900,390]) {
    await page.setViewportSize({width,height:1000});
    const boxes=await page.evaluate(()=>({top:document.getElementById('session-panel').getBoundingClientRect().bottom,card:document.getElementById('flashcard-panel').getBoundingClientRect().top,scroll:document.documentElement.scrollWidth,width:innerWidth}));
    assert(boxes.card>=boxes.top); assert(boxes.scroll<=boxes.width);
  }
  await fresh(); await page.locator('#repeat-step').focus(); await page.keyboard.press('Space'); assert(await page.locator('#repeat-step').isChecked());
  await press('restart'); await spoken(); assert(!(await page.locator('#repeat-step').isChecked())); await press('stop'); await ready();
  assert.deepEqual(errors, []); pass('responsive stacked panels, keyboard repeat and Restart reset');
  await fresh(); assert(await page.locator('#previous-fc').isDisabled());
  assert.equal(await page.locator('#skip-step').textContent(),'Next Step'); assert.equal(await page.locator('#skip').textContent(),'Next FC');
  await page.locator('#repeat-step').check(); await page.locator('#repeat-fc').check(); assert(!(await page.locator('#repeat-step').isChecked()));
  await page.locator('#repeat-step').check(); assert(!(await page.locator('#repeat-fc').isChecked()));
  await page.locator('#repeat-fc').focus(); await page.keyboard.press('Space'); assert(await page.locator('#repeat-fc').isChecked());
  for(let i=0;i<4;i++){ await end(); await phase('answer'); await end(); await spoken(); }
  assert.match(await page.evaluate(()=>testSynth.current.text),/a question 0/); const fcOnce=await read(); assert.equal(fcOnce.stepEvents.length,2);
  await page.locator('#repeat-fc').uncheck();
  for(let i=0;i<2;i++){ await end(); await phase('answer'); await end(); await spoken(); }
  assert.match(await page.evaluate(()=>testSynth.current.text),/b question 0/); assert(await page.locator('#previous-fc').isEnabled());
  await press('level-9'); await page.locator('#repeat-fc').check(); await press('previous-fc'); await spoken();
  assert.match(await page.evaluate(()=>testSynth.current.text),/a question 0/); assert(!(await page.locator('#repeat-fc').isChecked())); assert(await page.locator('#previous-fc').isDisabled());
  assert.deepEqual((await read()).stepProgress,fcOnce.stepProgress); assert.deepEqual((await read()).stepEvents,fcOnce.stepEvents);
  await page.locator('#repeat-fc').check(); await press('restart'); await spoken(); assert(!(await page.locator('#repeat-fc').isChecked()));
  await page.locator('#repeat-fc').check(); await press('stop'); await ready(); assert(!(await page.locator('#repeat-fc').isChecked()));
  pass('Repeat FC loops, unchecks after card, mutually excludes Repeat Step; Previous FC preserves credit and clears interrupted mastery/repeat');
  await page.evaluate(async name=>{ const {openDatabase}=await import('./js/db.js'); const {Repository}=await import('./js/repository.js'); const db=await openDatabase({name}); try { const repo=new Repository(db); await repo.setSetting('desktopVoice',{name:'Saved English',language:'en-US',voiceURI:'saved'}); await repo.setSetting('rate',1.2); await repo.setSetting('recallSeconds',6); await repo.setSetting('volume',0.7); } finally {db.close();} },name);
  await page.evaluate(()=>localStorage.removeItem('sr.desktop.speech.v1'));
  const savedSettings=(await read()).settings; await page.reload(); await page.waitForFunction(()=>!document.getElementById('settings').disabled);
  await page.evaluate(()=>{testVoices(); testSynth.voices.push({name:'Saved English',lang:'en-US',voiceURI:'saved',localService:true}); testSynth.dispatchEvent(new Event('voiceschanged'));});
  await ready(); assert.equal(await page.locator('#rate').inputValue(),'1.2'); assert.equal(await page.locator('#recall').inputValue(),'6');
  assert.match(await page.locator('#voice').inputValue(),/saved/); assert.deepEqual((await read()).settings,savedSettings);
  await page.locator('#voice').selectOption(JSON.stringify(['test','Google UK English Male','en-GB']));
  await page.evaluate(()=>testSynth.dispatchEvent(new Event('voiceschanged'))); assert.match(await page.locator('#voice').inputValue(),/Google UK English Male/);
  await page.locator('#days').fill('3'); await page.locator('#days').dispatchEvent('change'); assert.match(await page.locator('#session-summary').textContent(),/Next 3 days/);
  await page.locator('#mode').selectOption('AUDIT'); assert.equal(await page.locator('#session-summary').textContent(),'AUDIT · All series');
  await page.locator('#mode').selectOption('REVIEW');
  if(process.env.SR_PLAYER_SCREENSHOTS) {
    for(const width of [1440,900,390]) { await page.setViewportSize({width,height:1000}); await page.screenshot({path:join(process.env.SR_PLAYER_SCREENSHOTS,`compact-expanded-${width}.png`),fullPage:true}); await page.locator('#session-panel summary').click(); await page.screenshot({path:join(process.env.SR_PLAYER_SCREENSHOTS,`compact-collapsed-${width}.png`),fullPage:true}); await page.locator('#session-panel summary').click(); }
  }
  assert.deepEqual(errors, []); pass('saved voice/rate/recall retained without overwriting preferences; summary follows window/activity changes');
  await fresh(); await press('stop'); await ready();
  await page.evaluate(async ({name,original})=>{
    const {openDatabase}=await import('./js/db.js'); const {restoreJSON,exportJSON}=await import('./js/backup.js'); const db=await openDatabase({name});
    try { for(const id of ['a1','b0']) { const row=original.stepProgress.find(p=>p.stepId===id); row.mastery=10; row.nextDueAt=null; }
      original.flashcards.find(c=>c.id==='b').steps[1].recallSeconds=2.2;
      await restoreJSON(db,JSON.stringify(original),{confirmed:true,safetyJSON:await exportJSON(db)});
    } finally { db.close(); }
  },{name,original:before});
  await page.reload(); await ready(); await page.evaluate(()=>testVoices()); await page.locator('#series').selectOption('bound'); await page.locator('#recall').fill('0');
  await press('start'); await spoken();
  const prefix='REVIEW · States (synthetic) · Card 2/2 · Step 2/3 · ';
  assert.equal(await page.locator('#status').textContent(),prefix+'Question'); await end(); await phase('recall');
  assert.equal(await page.locator('#status').textContent(),prefix+'Recall: 3 seconds remaining');
  await page.waitForFunction(()=>document.getElementById('status').textContent.endsWith('Recall: 2 seconds remaining'));
  await press('pause'); const frozen=await page.locator('#status').textContent(); assert.match(frozen,/Paused \(Recall: [12] seconds remaining\)$/);
  await new Promise(resolve=>setTimeout(resolve,1100)); assert.equal(await page.locator('#status').textContent(),frozen);
  for(const width of [1440,390]) { await page.setViewportSize({width,height:1000}); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); if(process.env.SR_PLAYER_SCREENSHOTS) await page.screenshot({path:join(process.env.SR_PLAYER_SCREENSHOTS,`status-${width}.png`),fullPage:true}); }
  await press('resume'); await phase('recall'); await phase('answer'); assert.equal(await page.locator('#status').textContent(),prefix+'Answer');
  await press('skip-step'); await spoken(); assert.match(await page.locator('#status').textContent(),/Card 2\/2 · Step 3\/3 · Question$/);
  await press('previous-step'); await spoken(); assert.equal(await page.locator('#status').textContent(),prefix+'Question');
  pass('authored positions in filtered UI, custom live countdown freezes/resumes, navigation and responsive status');
  await page.evaluate(()=>testSynth.current.onerror({error:'test failure'})); await phase('error'); assert.equal(await page.locator('#status').textContent(),prefix+'Error'); assert(await page.locator('#error').isVisible());
  await press('stop'); await ready(); assert.equal(await page.locator('#status').textContent(),prefix+'Stopped');
  await press('restart'); await spoken(); assert.equal(await page.locator('#status').textContent(),prefix+'Question');
  await end(); await phase('answer'); await end(); await spoken(); assert.match(await page.locator('#status').textContent(),/Step 3\/3 · Question$/);
  await end(); await phase('answer'); await end(); await ready(); assert.equal(await page.locator('#status').textContent(),'REVIEW · Completed');
  assert.deepEqual(errors,[]); pass('Error, Stopped, Restart and Completed status preserve error details and actual playback');
  await fresh(); await press('stop'); await ready();
  await page.evaluate(async ({name,original})=>{
    const {openDatabase}=await import('./js/db.js'); const {restoreJSON,exportJSON}=await import('./js/backup.js'); const db=await openDatabase({name});
    try { const card=original.flashcards.find(c=>c.id==='b');
      for(const i of [3,4]) {card.steps.push({id:`b${i}`,position:i,question:`b question ${i}`,answer:`b answer ${i}`}); original.stepProgress.push({...original.stepProgress.find(p=>p.stepId==='b0'),stepId:`b${i}`});}
      await restoreJSON(db,JSON.stringify(original),{confirmed:true,safetyJSON:await exportJSON(db)});
    } finally {db.close();}
  },{name,original:before});
  await page.reload(); await ready(); await page.evaluate(()=>testVoices()); await page.locator('#recall').fill('0');
  assert.equal(await page.locator('#window').inputValue(),'days'); assert.equal(await page.locator('#days').inputValue(),'7'); assert.equal(await page.locator('#series').inputValue(),'');
  await press('start'); await spoken(); await press('skip'); await spoken(); await page.locator('#repeat-fc').check();
  for(let i=0;i<5;i++) {assert.match(await page.locator('#status').textContent(),new RegExp(`Card 2/2 · Step ${i+1}/5 · Question$`)); if(i<2) await press('level-9'); await end(); await phase('answer'); await end(); await spoken();}
  assert.match(await page.locator('#status').textContent(),/Step 3\/5 · Question$/); assert.equal((await read()).stepProgress.find(p=>p.stepId==='b0').mastery,9); assert.equal((await read()).stepProgress.find(p=>p.stepId==='b1').mastery,9);
  const repeatSaved=await read(); for(let i=0;i<3;i++){await end(); await phase('answer'); await end(); await spoken();}
  assert.match(await page.locator('#status').textContent(),/Step 3\/5 · Question$/); assert.deepEqual((await read()).stepEvents,repeatSaved.stepEvents);
  await page.locator('#repeat-fc').uncheck();
  for(let i=0;i<2;i++){await end(); await phase('answer'); await end(); await spoken();}
  await page.locator('#repeat-fc').check(); await press('level-9'); await end(); await phase('answer'); await end(); await spoken();
  assert.match(await page.locator('#status').textContent(),/Unbound \(synthetic\) · Card 1\/2 · Step 1\/1 · Question$/); assert(!(await page.locator('#repeat-fc').isChecked()));
  if(process.env.SR_PLAYER_SCREENSHOTS) await page.screenshot({path:join(process.env.SR_PLAYER_SCREENSHOTS,'repeat-eligibility.png'),fullPage:true});
  await press('stop'); await ready(); pass('owner seven-day five-step FC scenario: mastery-9 exclusions, ordered repeat without credit, final-anchor exit');
  await fresh(); await press('level-3'); await end(); await phase('answer'); await end(); await spoken();
  assert.equal(await page.locator('#mastery-saved').textContent(),'Saved mastery 3.'); const oldNotice=await page.evaluate(()=>testNoticeCallbacks.length-1);
  assert(!(await page.locator('#status').textContent()).includes('Saved'));
  await press('level-4'); await end(); await phase('answer'); await end(); await spoken(); assert.equal(await page.locator('#mastery-saved').textContent(),'Saved mastery 4.');
  await page.evaluate(i=>testNoticeCallbacks[i](),oldNotice); assert.equal(await page.locator('#mastery-saved').textContent(),'Saved mastery 4.');
  await press('pause'); await phase('paused'); await press('resume'); await phase('question');
  await page.waitForFunction(()=>document.getElementById('mastery-saved').textContent==='');
  await end(); await phase('answer'); assert.equal(await page.locator('#mastery-saved').textContent(),'');
  await page.evaluate(()=>testSynth.current.onerror({error:'test failure'})); await phase('error');
  await page.evaluate(()=>testNoticeCallbacks.forEach(fn=>fn())); assert(await page.locator('#error').isVisible()); assert.equal(await page.locator('#mastery-saved').textContent(),'');
  await press('stop'); await ready(); assert.equal(await page.locator('#mastery-saved').textContent(),'');
  assert.deepEqual(errors,[]); pass('save notices expire, replace rather than accumulate, ignore old timers, never overwrite status or hide errors');
  console.log(`${results.length}/${results.length} Stage 6 domain scenarios + ${count}/${count} UI scenarios. ${await page.evaluate(() => navigator.userAgent)}. Simulated speech; no audible claim.`);
} finally { await context?.close(); assert.equal(dirname(profile), tmpdir()); assert(profile.includes('sr-study-test-')); await rm(profile, { recursive: true, force: true }); }
