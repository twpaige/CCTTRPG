import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.SR_PLAYWRIGHT || 'playwright');

export async function testSpeechPreview(base) {
  const profile = await mkdtemp(join(tmpdir(), 'sr-speech-preview-'));
  let context, count = 0;
  const pass = name => { console.log('PASS ' + name); count++; };
  const launch = () => chromium.launchPersistentContext(profile, { headless: true, executablePath: process.env.SR_BROWSER || undefined, viewport: { width: 1440, height: 1000 } });
  async function mock() {
    await context.addInitScript(() => {
      globalThis.previewSynth = new class extends EventTarget {
        voices = [{ name: 'Default English', voiceURI: 'default', lang: 'en-GB' }]; current = null; spoken = [];
        getVoices() { return this.voices; }
        speak(u) { this.current = u; this.spoken.push({ text: u.text, rate: u.rate, voice: u.voice.name }); }
        cancel() { this.current = null; }
        end() { const u = this.current; this.current = null; u?.onend?.(); }
      }();
      globalThis.lateVoice = () => { previewSynth.voices.push({ name: 'Late English', voiceURI: 'late', lang: 'en-US' }); previewSynth.dispatchEvent(new Event('voiceschanged')); };
      Object.defineProperty(window, 'speechSynthesis', { value: previewSynth });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(text) { this.text = text; } } });
    });
  }
  try {
    context = await launch(); await mock();
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    const name = 'SRLearning-test-speech-preview', url = base + '/library.html?test=' + name;
    const ready = () => page.waitForFunction(() => !document.getElementById('workspace').disabled);
    const saved = () => page.evaluate(async name => {
      const { openDatabase } = await import('./js/db.js'), { exportSnapshot, contentKey } = await import('./js/backup.js');
      const db = await openDatabase({ name }); try { return contentKey(await exportSnapshot(db)); } finally { db.close(); }
    }, name);
    await page.goto(url); await ready();
    await page.evaluate(async name => {
      const { openDatabase } = await import('./js/db.js'), { Repository } = await import('./js/repository.js');
      const db = await openDatabase({ name }), repo = new Repository(db);
      try {
        const s = await repo.createSeries({ name: 'Speech', bound: false });
        await repo.createCard({ seriesId: s.id, name: 'Preview card', steps: [{ question: 'Saved question', answer: 'Saved answer', recallSeconds: 32 }] });
        await repo.setSetting('desktopVoice', { name: 'Late English', language: 'en-US', voiceURI: 'late' });
        await repo.setSetting('rate', 1.2); await repo.setSetting('recallSeconds', 7);
      } finally { db.close(); }
      localStorage.removeItem('sr.desktop.speech.v1');
      localStorage.setItem('sr.android.listening.v1', '{"voiceName":"Native voice","rate":1.3,"recall":25}');
    }, name);
    await page.reload(); await ready();
    const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('sr.desktop.speech.v1')));
    assert.equal(prefs.rate, 1.2); assert.equal(prefs.recall, 7); assert.equal(prefs.voice.name, 'Late English');
    pass('Legacy desktop speech preferences seed browser-local settings once');
    await page.getByRole('button', { name: '1. Preview card', exact: true }).click();
    const before = await saved(), question = page.locator('[data-preview="question-0"]'), answer = page.locator('[data-preview="answer-0"]');
    await page.locator('#question-0').fill('Unsaved question Ω\nline 2'); await question.click();
    await page.waitForFunction(() => previewSynth.current);
    assert.deepEqual(await page.evaluate(() => previewSynth.spoken.at(-1)), { text: 'Unsaved question Ω\nline 2', rate: 1.2, voice: 'Default English' });
    await question.click(); assert.equal(await page.evaluate(() => previewSynth.current), null); assert.equal(await saved(), before);
    pass('Preview speaks unsaved exact text at REVIEW rate, falls back gracefully, toggles Stop and never saves');
    await page.evaluate(() => lateVoice()); await question.click(); await page.waitForFunction(() => previewSynth.current);
    await page.locator('#answer-0').fill('Unsaved answer'); await answer.click(); await page.waitForFunction(() => previewSynth.current?.text === 'Unsaved answer');
    assert.equal(await page.evaluate(() => previewSynth.current.voice.name), 'Late English');
    assert.equal(await question.getAttribute('aria-pressed'), 'false'); assert.equal(await answer.getAttribute('aria-pressed'), 'true');
    await page.evaluate(() => previewSynth.end()); await page.waitForFunction(() => !previewSynth.current);
    assert.equal(await saved(), before);
    pass('Switching Preview cancels previous speech and discovers the preferred late-arriving voice without recall or credit');
    const long = 'Long authored text Ω. '.repeat(70);
    await page.locator('#question-0').fill(long); const start = await page.evaluate(() => previewSynth.spoken.length);
    await question.click(); await page.waitForFunction(() => previewSynth.current);
    for (let i = 0; i < 20 && await question.getAttribute('aria-pressed') === 'true'; i++) { await page.evaluate(() => previewSynth.end()); await page.waitForTimeout(10); }
    assert.equal((await page.evaluate(start => previewSynth.spoken.slice(start).map(u => u.text).join(''), start)), long);
    assert.equal(await question.getAttribute('aria-pressed'), 'false'); assert.equal(await saved(), before);
    pass('Long preview splits speech without changing text, pausing for recall or touching learning records');
    const player = await context.newPage(); await player.goto(base + '/index.html?test=' + name);
    await player.waitForFunction(() => !document.getElementById('settings').disabled);
    await player.locator('#session-panel summary').click(); await player.locator('#window').selectOption('max');
    await player.locator('#start').click(); await player.waitForFunction(() => previewSynth.current);
    await answer.click(); await page.waitForFunction(() => document.getElementById('error').textContent.includes('busy'));
    assert.equal(await page.evaluate(() => previewSynth.current), null); assert(await player.evaluate(() => !!previewSynth.current));
    await player.locator('#stop').click(); await player.waitForFunction(() => !document.getElementById('settings').disabled);
    pass('Active REVIEW rejects editor Preview without cancelling or interrupting REVIEW speech');
    await answer.click(); await page.waitForFunction(() => previewSynth.current);
    await player.locator('#start').click(); await player.waitForFunction(() => document.getElementById('error').textContent.includes('busy'));
    assert(await page.evaluate(() => !!previewSynth.current)); await answer.click();
    pass('Preview holds the existing library lock so REVIEW cannot overlap it');
    if (!await player.locator('#session-panel').evaluate(el => el.open)) await player.locator('#session-panel summary').click();
    await player.evaluate(() => lateVoice()); await player.locator('#voice').selectOption(JSON.stringify(['late', 'Late English', 'en-US']));
    await player.locator('#rate').fill('0.75'); await player.locator('#rate').dispatchEvent('change');
    await player.locator('#recall').fill('8'); await player.locator('#recall').dispatchEvent('change');
    await answer.click(); await page.waitForFunction(() => previewSynth.current);
    assert.equal(await page.evaluate(() => previewSynth.current.rate), .75); await answer.click();
    pass('REVIEW control changes persist immediately and Preview reads the same browser-local voice/rate');
    const backupCheck = await page.evaluate(async name => {
      const { openDatabase } = await import('./js/db.js'), b = await import('./js/backup.js');
      const db = await openDatabase({ name });
      try {
        const json = await b.exportJSON(db), exported = JSON.parse(json), older = await b.exportSnapshot(db);
        older.settings.desktopVoice = { name: 'Foreign', language: 'en-US' }; older.settings.androidVoice = { name: 'Foreign native', language: 'en-US' };
        older.settings.rate = 2; older.settings.recallSeconds = 999;
        const local = localStorage.getItem('sr.desktop.speech.v1'), native = localStorage.getItem('sr.android.listening.v1');
        await b.restoreJSON(db, JSON.stringify(older), { confirmed: true, safetyJSON: json });
        return { settings: exported.settings, recall: exported.flashcards[0].steps[0].recallSeconds,
          localSame: local === localStorage.getItem('sr.desktop.speech.v1'), nativeSame: native === localStorage.getItem('sr.android.listening.v1'),
          legacy: (await b.exportSnapshot(db)).settings };
      } finally { db.close(); }
    }, name);
    assert.deepEqual(backupCheck.settings, {}); assert.equal(backupCheck.recall, 32); assert(backupCheck.localSame && backupCheck.nativeSame); assert.equal(backupCheck.legacy.rate, 1.2);
    pass('New backups omit device settings, old imports cannot overwrite them, authored recall and Android preferences survive');
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await question.isVisible()); assert(await answer.isVisible());
    await answer.click(); await page.waitForFunction(() => previewSynth.current);
    page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.evaluate(() => previewSynth.current), null);
    pass('Compact Preview controls fit narrow screens and cancel when leaving the editor');
    assert.deepEqual(errors, []);
    await context.close(); context = await launch(); await mock();
    const reopened = await context.newPage(); await reopened.goto(base + '/index.html?test=' + name);
    await reopened.waitForFunction(() => !document.getElementById('settings').disabled);
    assert.equal(await reopened.locator('#rate').inputValue(), '.75'.replace('.', '0.')); assert.equal(await reopened.locator('#recall').inputValue(), '8');
    assert.match(await reopened.locator('#voice').inputValue(), /Default English/);
    await reopened.evaluate(() => lateVoice()); assert.match(await reopened.locator('#voice').inputValue(), /Late English/);
    assert.equal(await reopened.evaluate(() => previewSynth.spoken.length), 0);
    pass('Real browser-process restart restores local preferences, then restores preferred voice after delayed discovery without speaking');
    await reopened.evaluate(() => localStorage.setItem('sr.desktop.speech.v1', '{bad'));
    await reopened.reload(); await reopened.waitForFunction(() => !document.getElementById('settings').disabled);
    assert.equal(await reopened.locator('#rate').inputValue(), '1.2');
    pass('Malformed local storage gracefully falls back to valid legacy/default speech preferences');
    return count;
  } finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
}
