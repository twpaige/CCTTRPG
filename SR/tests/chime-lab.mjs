import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.SR_PLAYWRIGHT || 'playwright');
const base = process.env.SR_TEST_URL || 'http://127.0.0.1:8765';
const browser = await chromium.launch({ headless: true, executablePath: process.env.SR_BROWSER || undefined });
let checks = 0;
const passed = name => { checks++; console.log('PASS ' + name); };
try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.dbCalls = 0;
    indexedDB.open = () => { window.dbCalls++; throw new Error('Lab must not open IndexedDB'); };
    window.spoken = []; window.cancelCount = 0; window.holdSpeech = false;
    const voices = [{ name: 'Test preferred', lang: 'en-GB', voiceURI: 'preferred' }];
    localStorage.setItem('sr.desktop.speech.v1', JSON.stringify({ voice: { name: 'Test preferred', language: 'en-GB', voiceURI: 'preferred' }, rate: 1.2, recall: 9 }));
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(text) { this.text = text; } } });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => window.lateVoices ? [] : voices,
      speak: utterance => { window.spoken.push({ text: utterance.text, rate: utterance.rate, voice: utterance.voice?.name }); window.currentUtterance = utterance; if (!window.holdSpeech) setTimeout(() => utterance.onend?.(), 10); },
      cancel: () => { window.cancelCount++; },
    } });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { if (window.failCopy) throw Error('Denied'); window.copied = text; } } });
    const NativeAudio = window.AudioContext;
    window.startedTones = 0; window.liveTones = 0;
    window.AudioContext = class extends NativeAudio {
      async resume() { if (window.delayResume) await new Promise(resolve => { window.releaseResume = resolve; }); return super.resume(); }
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator), disconnect = oscillator.disconnect.bind(oscillator);
        let counted = false;
        oscillator.start = (...args) => { counted = true; window.startedTones++; window.liveTones++; return start(...args); };
        oscillator.disconnect = (...args) => { if (counted) window.liveTones--; counted = false; return disconnect(...args); };
        return oscillator;
      }
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/chime-lab.html');
  const ready = () => page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Finished.'));
  const stop = () => page.locator('#stop').click();
  assert.equal(await page.locator('.candidate').count(), 16);
  assert.equal(await page.locator('input[type=range]').count(), 12);
  assert.equal(await page.locator('#step-before').inputValue(), '0.12');
  assert.equal(await page.locator('#step-after').inputValue(), '0.18');
  passed('16 candidates, named Play controls, and six adjustments per category');
  const render = await page.evaluate(async () => {
    const { candidates, defaults, scheduleTone, boundedSettings } = await import('./js/chime-tones.js');
    const results = [];
    for (const kind of ['step', 'card']) for (const candidate of candidates) {
      const settings = { ...defaults[kind], id: candidate.id, volume: 70 };
      const context = new OfflineAudioContext(1, 48000 * 2, 48000);
      scheduleTone(context, context.destination, settings, 0);
      const data = (await context.startRendering()).getChannelData(0);
      results.push({ peak: data.reduce((peak, v) => Math.max(peak, Math.abs(v)), 0),
        tail: data.slice(60000).every(v => v === 0), finite: data.every(Number.isFinite) });
    }
    const bounded = boundedSettings({ id: 'invalid', pitch: Infinity, duration: -1, volume: 10000 });
    return { results, bounded };
  });
  assert.equal(render.results.length, 16);
  assert.ok(render.results.every(r => r.peak > .001 && r.peak <= .127 && r.tail && r.finite));
  assert.equal(render.bounded.volume, 70); assert.equal(render.bounded.duration, .15); assert.equal(render.bounded.id, 'wood');
  passed('All 16 tones render finite non-silent audio, bounded peaks, and silent tails; unsafe parameters clamp');
  await page.locator('input[name=step][value=glass]').check();
  await page.locator('#step-pitch').fill('550');
  await page.locator('#step-pitch').dispatchEvent('input');
  await page.locator('#copy').click();
  let settings = await page.evaluate(() => JSON.parse(window.copied));
  assert.equal(settings.step.id, 'glass'); assert.equal(settings.step.pitch, 550);
  assert.equal(settings.card.id, 'two-note');
  assert.deepEqual(settings, JSON.parse(await page.locator('#selected').textContent()));
  passed('Selection and independent adjustments round-trip to compact clipboard JSON');
  await page.evaluate(() => { window.failCopy = true; });
  await page.locator('#copy').click();
  assert.match(await page.locator('#error').textContent(), /manually/);
  passed('Clipboard failure leaves selectable settings and clear fallback');
  await page.locator('#compare').click(); await ready();
  assert.equal(await page.evaluate(() => window.liveTones), 0);
  assert.ok(await page.evaluate(() => window.startedTones > 0));
  passed('Back-to-back comparison finishes and releases all tone nodes');
  await page.evaluate(() => { window.holdSpeech = true; window.lateVoices = true; });
  await page.locator('#sequence').click();
  await page.waitForFunction(() => window.spoken.length === 1);
  await stop();
  assert.equal(await page.evaluate(() => window.cancelCount), 1);
  await page.evaluate(() => { window.holdSpeech = false; window.lateVoices = false; window.spoken = []; });
  await page.locator('#sequence').click(); await ready();
  const spoken = await page.evaluate(() => window.spoken);
  assert.equal(spoken.length, 5);
  assert.match(spoken[0].text, /capital of France/); assert.match(spoken[4].text, /Japan/);
  assert.ok(spoken.every(u => u.rate === 1.2 && u.voice === 'Test preferred'));
  passed('Sequence speaks in order, resolves late preferred voice/rate, and Stop cancels held speech');
  await page.locator('#sequence').click();
  await page.waitForFunction(() => window.spoken.length === 6);
  await page.waitForTimeout(50); await stop();
  await page.waitForTimeout(1100);
  assert.equal(await page.evaluate(() => window.spoken.length), 6);
  passed('Stop during recall prevents all subsequent speech and cues');
  await page.locator('#step-before').fill('1.5'); await page.locator('#step-before').dispatchEvent('input');
  const oldStarts = await page.evaluate(() => window.startedTones);
  await page.getByRole('button', { name: 'Play Soft glass step chime', exact: true }).click(); await stop();
  await page.waitForTimeout(1600);
  assert.equal(await page.evaluate(() => window.startedTones), oldStarts);
  passed('Stop during pre-chime silence prevents delayed tones');
  await page.locator('#step-before').fill('0'); await page.locator('#step-before').dispatchEvent('input');
  await page.locator('#step-duration').fill('1.2'); await page.locator('#step-duration').dispatchEvent('input');
  await page.getByRole('button', { name: 'Play Soft glass step chime', exact: true }).click();
  await page.waitForFunction(() => window.liveTones > 0);
  await page.getByRole('button', { name: 'Play Quiet electronic step chime', exact: true }).click();
  await page.waitForFunction(() => window.liveTones === 2);
  await stop();
  assert.equal(await page.evaluate(() => window.liveTones), 0);
  passed('Switching auditions releases previous tones; Stop disconnects immediately');
  await page.evaluate(() => { window.delayResume = true; });
  const beforeResume = await page.evaluate(() => window.startedTones);
  await page.locator('#compare').click(); await stop();
  await page.evaluate(() => { window.releaseResume(); });
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.startedTones), beforeResume);
  passed('Stop also cancels while AudioContext resume is pending');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await page.evaluate(() => window.dbCalls), 0);
  assert.deepEqual(errors, []);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '../chime-lab-narrow.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '../chime-lab-desktop.png', fullPage: true });
  passed('Narrow layout fits, no browser errors, and no IndexedDB access');
  const unsupported = await context.newPage();
  await unsupported.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  await unsupported.goto(base + '/chime-lab.html');
  assert.match(await unsupported.locator('#error').textContent(), /Web Audio is unavailable/);
  assert.equal(await unsupported.locator('[data-audio]:not(:disabled)').count(), 0);
  await unsupported.locator('#copy').click();
  assert.ok(await unsupported.evaluate(() => window.copied));
  passed('Unsupported Web Audio disables audition gracefully but preserves settings copy');
  console.log(checks + '/'+ checks + ' chime laboratory checks passed. Speech mocked; synthesized waveforms rendered. Audible selection remains owner verification.');
} finally { await browser.close(); }
