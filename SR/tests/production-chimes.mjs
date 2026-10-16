import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.SR_PLAYWRIGHT || 'playwright');
const base = process.env.SR_TEST_URL || 'http://127.0.0.1:8765';
const name = 'SRLearning-test-production-chimes';
const browser = await chromium.launch({ headless: true, executablePath: process.env.SR_BROWSER || undefined });
let count = 0;
const pass = text => { count++; console.log('PASS ' + text); };
try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.liveTones = 0; window.toneCount = 0; window.overlaps = 0;
    const NativeAudio = window.AudioContext;
    window.AudioContext = class extends NativeAudio {
      createOscillator() {
        const oscillator = super.createOscillator(), start = oscillator.start.bind(oscillator), disconnect = oscillator.disconnect.bind(oscillator);
        let active = false;
        oscillator.start = (...args) => { if (window.testSynth.current) window.overlaps++; window.liveTones++; window.toneCount++; active = true; return start(...args); };
        oscillator.disconnect = (...args) => { if (active) window.liveTones--; active = false; return disconnect(...args); };
        return oscillator;
      }
    };
    window.testSynth = new class extends EventTarget {
      current = null;
      getVoices() { return [{ name: 'test', lang: 'en-GB', voiceURI: 'test' }]; }
      speak(utterance) { if (window.liveTones || this.current) window.overlaps++; this.current = utterance; }
      cancel() { this.current = null; }
      end() { const current = this.current; this.current = null; current.onend(); }
    }();
    Object.defineProperty(window, 'speechSynthesis', { value: testSynth });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(text) { this.text = text; } } });
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/chime-lab.html');
  await page.evaluate(async name => { const { seed } = await import('./tests/study.test.js'); const db = await seed(name); db.close(); }, name);
  await page.goto(base + '/index.html?test=' + name);
  const press = id => page.locator('#' + id).click();
  const speech = () => page.waitForFunction(() => !!testSynth.current);
  const transition = () => page.waitForFunction(() => document.querySelector('#status').textContent.includes('Transition') && window.liveTones > 0);
  const events = () => page.evaluate(async name => {
    const { openDatabase } = await import('./js/db.js'), { exportSnapshot } = await import('./js/backup.js');
    const db = await openDatabase({ name }); try { return (await exportSnapshot(db)).stepEvents.length; } finally { db.close(); }
  }, name);
  await page.waitForFunction(() => !document.querySelector('#start').disabled);
  await page.locator('#session-panel summary').click();
  await page.locator('#series').selectOption('bound');
  await page.locator('#recall').fill('0');
  await press('start'); await speech();
  assert.equal(await page.evaluate(() => window.toneCount), 0);
  await press('pause'); await press('resume'); await speech();
  assert.equal(await page.evaluate(() => window.toneCount), 0);
  pass('Real player starts and resumes interrupted speech without chimes');
  await press('skip-step'); await transition();
  assert.equal(await page.evaluate(() => window.liveTones), 3);
  assert.equal(await events(), 0);
  await press('pause'); assert.equal(await page.evaluate(() => window.liveTones), 0);
  await page.waitForTimeout(1300); assert.equal(await page.evaluate(() => testSynth.current), null);
  await press('resume'); await speech(); assert.equal(await page.evaluate(() => window.liveTones), 0);
  assert.equal(await events(), 0);
  pass('Step cue uses wood partials; Pause cancels actual Web Audio and Resume gates the next question without credit');
  await press('skip'); await transition(); assert.equal(await page.evaluate(() => window.liveTones), 4);
  await press('stop'); await page.waitForTimeout(1300);
  assert.equal(await page.evaluate(() => window.liveTones), 0);
  assert.equal(await page.evaluate(() => testSynth.current), null); assert.equal(await events(), 0);
  pass('Card cue uses two-note partials; Stop cancels tone and pending speech without credit');
  const before = await page.evaluate(() => window.toneCount);
  await press('start'); await speech(); assert.equal(await page.evaluate(() => window.toneCount), before);
  await page.evaluate(() => testSynth.end()); await speech();
  assert.match(await page.evaluate(() => testSynth.current.text), /answer/);
  await page.evaluate(() => testSynth.end()); await transition();
  assert.equal(await events(), 1); await speech(); assert.equal(await events(), 1);
  assert.equal(await page.evaluate(() => window.overlaps), 0);
  await press('stop'); assert.deepEqual(errors, []);
  pass('Automatic cue follows exactly one saved completion, never overlaps speech, and fresh Start has no cue');
  console.log(count + '/' + count + ' production browser chime checks passed. Real Web Audio; simulated speech.');
} finally { await browser.close(); }
