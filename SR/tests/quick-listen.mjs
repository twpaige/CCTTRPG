import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';
import { execFileSync } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)(process.env.SR_PLAYWRIGHT || 'playwright');
const base = process.env.SR_TEST_URL || 'http://127.0.0.1:8765';
const profile = await mkdtemp(join(tmpdir(), 'sr-quick-listen-'));
const name = 'SRLearning-test-quick-listen';
let context, count = 0;
const pass = text => { count++; console.log('PASS ' + text); };
async function launch() {
  context = await chromium.launchPersistentContext(profile, { headless: true, executablePath: process.env.SR_BROWSER || undefined });
  await context.addInitScript(() => {
    const synth = new class extends EventTarget {
      getVoices() { return [{ name: 'test', lang: 'en-GB', voiceURI: 'test' }]; }
      speak(u) { this.current = u; } cancel() { this.current = null; }
    }();
    Object.defineProperty(window, 'speechSynthesis', { value: synth });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class {} });
  });
  return context.newPage();
}
try {
  let page = await launch(); await page.goto(base + '/chime-lab.html');
  const result = await page.evaluate(async name => {
    const { openDatabase } = await import('./js/db.js'), { Repository } = await import('./js/repository.js');
    const { exportSnapshot, exportJSON, restoreJSON } = await import('./js/backup.js');
    const { StudySession } = await import('./js/study.js');
    const { buildNativePlan, prepareNativeSession, playlistValidationKey } = await import('./js/native-study.js');
    const { readSpeechPreferences, saveSpeechPreferences } = await import('./js/speech-preferences.js');
    const { readPreferences, savePreferences } = await import('./mobile/web/preferences.js');
    const check = (ok, message) => { if (!ok) throw Error(message); };
    const db = await openDatabase({ name }), repo = new Repository(db);
    const durations = [0, 3, 60, 300, undefined];
    for (let i = 0; i < durations.length; i++) {
      await repo.createSeries({ id: 's' + i, name: 'S' + i, bound: false });
      const step = { id: 'p' + i, position: 0, question: 'Question ' + i, answer: 'Answer ' + i };
      if (durations[i] !== undefined) step.recallSeconds = durations[i];
      await repo.createCard({ id: 'c' + i, name: 'C' + i, seriesId: 's' + i, steps: [step] });
    }
    const original = await exportSnapshot(db), plans = [];
    const until = async fn => { for (let i = 0; i < 500; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 1)); } throw Error('Playback did not reach expected phase'); };
    let cases = 0;
    for (const mode of ['REVIEW', 'AUDIT']) {
      if (mode === 'AUDIT') {
        const prior = await exportJSON(db), known = JSON.parse(prior);
        known.stepProgress.forEach(p => { p.mastery = 10; p.nextDueAt = null; });
        await restoreJSON(db, JSON.stringify(known), { confirmed: true, safetyJSON: prior });
      }
      const snapshot = await exportSnapshot(db);
      for (const quickListen of [false, true]) {
        const options = { mode, quickListen, recall: 7, window: { type: 'max' }, now: Date.now() };
        const native = buildNativePlan(snapshot, options);
        check(native.units.length === 5, 'Eligibility must not change');
        native.units.forEach((u, i) => check(u.recallMs === (quickListen ? 2000 : (durations[i] ?? 7) * 1000), 'Native recall mismatch'));
        plans.push(native);
        const rows = []; let part = '';
        await prepareNativeSession(snapshot, options, { session(op, arg) { if (op === 'part') part += arg; if (op === 'step') { rows.push(JSON.parse(part)); part = ''; } return ''; } }, async () => {});
        check(rows.every((u, i) => u.recallMs === native.units[i].recallMs), 'Streamed native timing mismatch');
        for (let i = 0; i < durations.length; i++) {
          const clock = { time: 0, now() { return this.time; }, setTimeout(fn, ms) { this.fn = fn; this.ms = ms; return 1; }, clearTimeout() { this.fn = null; } };
          let finish;
          const speech = { speak(text, { signal }) { return new Promise(resolve => {
            finish = () => { signal.removeEventListener('abort', abort); resolve('ended'); };
            const abort = () => resolve('cancelled'); signal.addEventListener('abort', abort, { once: true });
          }); } };
          const session = new StudySession(db, speech, { clock });
          const settings = { ...options, seriesId: 's' + i, recallMs: 7000, voice: { name: 'test' }, rate: .9 };
          await session.start(settings); await until(() => session.snapshot.phase === 'question' && finish);
          settings.quickListen = !quickListen; // Active session must retain the captured choice.
          finish(); await until(() => session.snapshot.phase === 'recall');
          const expected = quickListen ? 2000 : (durations[i] ?? 7) * 1000;
          check(session.snapshot.remainingMs === expected, 'Desktop override/fallback mismatch');
          clock.time += Math.min(700, expected); session.pause();
          const remaining = session.snapshot.remainingMs;
          clock.time += 5000; session.resume();
          check(clock.ms === remaining, 'Pause/Resume changed remaining recall');
          clock.time += remaining; clock.fn(); await until(() => session.snapshot.phase === 'answer');
          await session.stop(); cases++;
        }
      }
      check(await playlistValidationKey(snapshot, { mode, recall: 7, quickListen: true, window: { type: 'max' } }) !==
        await playlistValidationKey(snapshot, { mode, recall: 7, quickListen: false, window: { type: 'max' } }), 'Ready playlist reused across timing change');
    }
    check(JSON.stringify((await exportSnapshot(db)).flashcards) === JSON.stringify(original.flashcards), 'Authored content changed');
    check((await exportSnapshot(db)).stepEvents.length === 0, 'Interrupted answers received credit');
    check(readSpeechPreferences().quickListen === false && readPreferences(localStorage).quickListen === false, 'Existing-user default must be OFF');
    saveSpeechPreferences({ ...readSpeechPreferences(), quickListen: true });
    check(readPreferences(localStorage).quickListen === false, 'Android preference coupled to desktop');
    savePreferences(localStorage, { quickListen: true });
    const backup = await exportJSON(db);
    check(!backup.includes('quickListen'), 'Device option leaked into backup');
    const older = JSON.parse(backup); older.settings.recallSeconds = 300;
    await restoreJSON(db, JSON.stringify(older), { confirmed: true, safetyJSON: backup });
    check(readSpeechPreferences().quickListen && readPreferences(localStorage).quickListen, 'Import overwrote local preferences');
    check(JSON.stringify((await exportSnapshot(db)).flashcards) === JSON.stringify(original.flashcards), 'Import changed authored durations');
    db.close();
    return { cases, plans };
  }, name);
  assert.equal(result.cases, 20);
  pass('20 REVIEW/AUDIT ON/OFF timing cases: 0/3/60/300/missing, frozen session and Pause/Resume');
  pass('Native plans and streamed units bake correct waits; timing changes invalidate ready-playlist reuse');
  pass('OFF defaults, independent local keys, JSON exclusion/import preservation, unchanged authored content and no unfinished credit');
  // Feed the actual JS-prepared payloads through the real native Plan/executor.
  if (!process.env.SR_SKIP_JAVA) {
    const directory = resolve('SR/mobile/app/build/quick-listen-tests'); await mkdir(directory, { recursive: true });
    const fixture = join(directory, 'plans.json'); await writeFile(fixture, JSON.stringify(result.plans));
    const jar = resolve('SR/mobile/app/build/authored-tests/json-20240303.jar');
    const jdk = process.env.SR_JAVA_HOME || process.env.JAVA_HOME;
    const executable = n => jdk ? join(jdk, 'bin', n + (process.platform === 'win32' ? '.exe' : '')) : n;
    execFileSync(executable('javac'), ['-cp', jar, '-d', directory,
      ...['PlaybackEngine', 'Plan', 'SessionStore'].map(n => 'SR/mobile/app/src/main/java/com/crownandcall/srproof/' + n + '.java'),
      'SR/mobile/tests/QuickListenTest.java'], { stdio: 'inherit' });
    execFileSync(executable('java'), ['-cp', directory + delimiter + jar, 'com.crownandcall.srproof.QuickListenTest', fixture], { stdio: 'inherit' });
    pass('Actual prepared native waits and Pause/Resume run independently of JavaScript');
  }
  const desktop = base + '/index.html?test=' + name;
  await page.goto(desktop); await page.waitForFunction(() => !document.querySelector('#settings').disabled);
  assert.ok(await page.locator('#quick-listen').isChecked());
  await page.locator('#session-panel summary').click();
  await page.screenshot({ path: '../quick-listen-desktop.png', fullPage: true });
  await page.locator('#quick-listen').uncheck(); await page.reload();
  assert.equal(await page.locator('#quick-listen').isChecked(), false);
  await page.locator('#session-panel summary').click(); await page.locator('#quick-listen').check();
  pass('Desktop checkbox restores and persists both ON and OFF through reload');
  await context.close(); page = await launch(); await page.goto(desktop);
  await page.waitForFunction(() => !document.querySelector('#settings').disabled);
  assert.ok(await page.locator('#quick-listen').isChecked());
  pass('Desktop Quick Listen survives a real browser-process restart');
  await page.locator('#session-panel summary').click(); await page.locator('#mode').selectOption('AUDIT');
  await page.locator('#start').click(); await page.waitForFunction(() => !!speechSynthesis.current);
  assert.ok(await page.locator('#quick-listen').isDisabled());
  await page.evaluate(() => { const u = speechSynthesis.current; speechSynthesis.current = null; u.onend(); });
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Recall: 2 seconds'));
  await page.locator('#stop').click();
  pass('Actual desktop UI captures Quick Listen at Start, disables active changes and uses two-second AUDIT recall');
  const isolated = await context.browser().newContext();
  const other = await isolated.newPage(); await other.goto(base + '/chime-lab.html');
  assert.equal(await other.evaluate(async () => (await import('./js/speech-preferences.js')).readSpeechPreferences().quickListen), false);
  await isolated.close();
  pass('A separate browser/device profile defaults OFF independently');
  // No production DB in the owner profile: this entire process/profile is disposable.
  await page.route('**/mobile/web/shared/styles.css', route => route.continue({ url: base + '/styles.css' }));
  await page.route('**/mobile/web/js/**', route => route.continue({ url: route.request().url().replace('/mobile/web/js/', '/js/') }));
  await context.addInitScript(() => {
    window.SRNative = { status: () => JSON.stringify({ status: 'stopped', voices: [{ name: 'test', language: 'en-GB' }], ready: true }),
      completions: () => '[]', refresh() {} };
  });
  await page.goto(base + '/mobile/web/index.html'); await page.waitForFunction(() => !document.querySelector('#voice-settings').disabled);
  assert.ok(await page.locator('#quick-listen').isChecked());
  await page.locator('#voice-panel summary').click();
  await page.setViewportSize({ width: 390, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '../quick-listen-android.png', fullPage: true });
  await page.locator('#quick-listen').uncheck(); await page.reload();
  assert.equal(await page.locator('#quick-listen').isChecked(), false);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sr.desktop.speech.v1')).quickListen), true);
  pass('Android UI restores/persists its independent checkbox without modifying desktop preferences');
  console.log(count + '/' + count + ' Quick Listen grouped checks passed (20 timing combinations).');
} finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
