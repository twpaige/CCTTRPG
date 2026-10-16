// Render the actual laboratory recipe. --write regenerates the two native PCM assets.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { APPROVED_CHIMES } from '../js/transition-chimes.js';
const { chromium } = createRequire(import.meta.url)(process.env.SR_PLAYWRIGHT || 'playwright');
const base = process.env.SR_TEST_URL || 'http://127.0.0.1:8765';
const browser = await chromium.launch({ headless: true, executablePath: process.env.SR_BROWSER || undefined });
const directory = 'SR/mobile/app/src/main/res/raw';
try {
  const page = await browser.newPage();
  await page.goto(base + '/chime-lab.html');
  for (const [kind, id] of [['step', 'wood'], ['card', 'two-note']]) {
    assert.deepEqual(APPROVED_CHIMES[kind], { id, pitch: 330, volume: 32, duration: .72, decay: 69, before: .27, after: .18 });
    const samples = await page.evaluate(async settings => {
      const { scheduleTone } = await import('./js/chime-tones.js');
      const context = new OfflineAudioContext(1, 56160, 48000);
      scheduleTone(context, context.destination, settings, settings.before);
      return Array.from((await context.startRendering()).getChannelData(0), value => Math.round(value * 32767));
    }, APPROVED_CHIMES[kind]);
    assert.equal(samples.length, 56160);
    assert.ok(samples.slice(0, 12960).every(v => v === 0));
    assert.ok(samples.slice(47520).every(v => v === 0));
    const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    assert.ok(peak > 100 && peak < 1900);
    const wav = Buffer.alloc(44 + samples.length * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
    samples.forEach((value, i) => wav.writeInt16LE(value, 44 + i * 2));
    const path = directory + '/sr_' + kind + '.wav';
    if (process.argv.includes('--write')) { await mkdir(directory, { recursive: true }); await writeFile(path, wav); }
    const actual = await readFile(path);
    assert.deepEqual(actual.subarray(0, 44), wav.subarray(0, 44));
    let maxDifference = 0;
    samples.forEach((value, i) => { maxDifference = Math.max(maxDifference, Math.abs(value - actual.readInt16LE(44 + i * 2))); });
    assert.ok(maxDifference <= 2, 'Native PCM differs from browser synthesis by more than two 16-bit quantization units');
    console.log('PASS ' + kind + ': exact approved settings, 1.17-second PCM with silence, bounded amplitude and browser/native equivalence');
  }
  console.log('2/2 approved waveform checks passed. Actual Bluetooth sound remains owner verification.');
} finally { await browser.close(); }
