import { BrowserSpeech } from '../js/speech.js';
import { ReviewController } from '../js/review.js';
import { selectVoice, voiceKey, watchVoices } from '../js/voices.js';
import { sampleCards } from '../poc/sample.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (condition, message = 'Assertion failed') => { if (!condition) throw new Error(message); };
const equal = (actual, expected) => assert(JSON.stringify(actual) === JSON.stringify(expected),
  `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const flush = async () => { for (let i = 0; i < 8; ++i) await Promise.resolve(); };

class Clock {
  time = 0;
  nextId = 0;
  tasks = new Map();
  now = () => this.time;
  setTimeout = (fn, delay) => {
    const id = ++this.nextId;
    this.tasks.set(id, { at: this.time + delay, fn });
    return id;
  };
  clearTimeout = id => this.tasks.delete(id);
  tick(ms) {
    const end = this.time + ms;
    for (;;) {
      const next = [...this.tasks].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      this.time = next[1].at;
      this.tasks.delete(next[0]);
      next[1].fn();
    }
    this.time = end;
  }
}

class Utterance { constructor(text) { this.text = text; } }
class Synth extends EventTarget {
  voices = [];
  spoken = [];
  current = null;
  overlaps = 0;
  cancelCount = 0;
  getVoices() { return this.voices; }
  speak(utterance) {
    if (this.current) ++this.overlaps;
    this.current = utterance;
    this.spoken.push(utterance);
  }
  cancel() { ++this.cancelCount; this.current = null; } // Deliberately emits NO event.
  end() { const u = this.current; assert(u, 'No current speech'); this.current = null; u.onend?.(); }
  fail() { const u = this.current; assert(u); this.current = null; u.onerror?.({ error: 'network' }); }
}

const preferred = { name: 'Google UK English Male', lang: 'en-GB', voiceURI: 'preferred', localService: false };
const local = { name: 'Local English', lang: 'en-US', voiceURI: 'local', localService: true };
const options = { voice: preferred, rate: 0.9, recallMs: 1000 };
const fixtures = [];
function setup() {
  const clock = new Clock();
  const synth = new Synth();
  const speech = new BrowserSpeech(synth, Utterance, clock);
  const events = [];
  const controller = new ReviewController(sampleCards, speech, { clock, onEvent: event => events.push(event) });
  const fixture = { clock, synth, speech, events, controller };
  fixtures.push(fixture);
  return fixture;
}
async function reachAnswer(fixture) {
  fixture.synth.end();
  await flush();
  fixture.clock.tick(1000);
  await flush();
}

test('The three sample cards have 1, 2, and 6 steps', () => equal(sampleCards.map(c => c.steps.length), [1, 2, 6]));

test('Full session preserves question → completion → pause → answer across every step/card', async () => {
  const f = setup();
  f.controller.start(options);
  const expected = [];
  for (const card of sampleCards) for (const step of card.steps) {
    equal(f.synth.current.text, step.question);
    expected.push(step.question);
    f.synth.end();
    await flush();
    equal(f.controller.phase, 'recall');
    equal(f.synth.current, null);
    f.clock.tick(999);
    equal(f.synth.current, null);
    f.clock.tick(1);
    equal(f.synth.current.text, step.answer);
    expected.push(step.answer);
    f.synth.end();
    await flush();
  }
  equal(f.synth.spoken.map(u => u.text), expected);
  equal(f.events.slice(1, 7).map(e => e.event), ['question-requested', 'question-ended', 'recall-start', 'recall-end', 'answer-requested', 'answer-ended']);
  equal(f.controller.status, 'finished');
  equal(f.clock.tasks.size, 0);
  equal(f.synth.overlaps, 0);
});

test('Recall starts at actual completion, not estimated question duration', async () => {
  const f = setup(); f.controller.start(options);
  f.clock.tick(5000);
  equal(f.controller.phase, 'question');
  f.synth.end(); await flush();
  equal(f.controller.snapshot.remainingMs, 1000);
});

test('Zero recall delay still waits for question completion', async () => {
  const f = setup(); f.controller.start({ ...options, recallMs: 0 });
  f.clock.tick(0); equal(f.controller.phase, 'question');
  f.synth.end(); await flush(); f.clock.tick(0);
  equal(f.controller.phase, 'answer');
});

for (const phase of ['question', 'recall', 'answer']) {
  test(`Stop during ${phase} settles/cancels everything and does not advance`, async () => {
    const f = setup(); f.controller.start(options);
    if (phase !== 'question') { f.synth.end(); await flush(); }
    if (phase === 'answer') f.clock.tick(1000);
    const before = f.synth.spoken.length;
    f.controller.stop(); await flush(); f.clock.tick(180000); await flush();
    equal(f.controller.status, 'stopped'); equal(f.synth.spoken.length, before);
    equal(f.clock.tasks.size, 0); equal(f.speech.active, null);
  });
}

for (const phase of ['question', 'answer']) {
  test(`Pause/Resume repeats only the current ${phase}, with no overlap`, async () => {
    const f = setup(); f.controller.start(options);
    if (phase === 'answer') await reachAnswer(f);
    const text = f.synth.current.text;
    f.controller.pause(); f.controller.pause(); await flush();
    equal(f.controller.status, 'paused'); equal(f.clock.tasks.size, 0);
    f.clock.tick(300000); f.controller.resume(); f.controller.resume();
    equal(f.synth.current.text, text); equal(f.synth.overlaps, 0);
    equal(f.synth.spoken.at(-2).text, text);
  });
}

test('Recall Pause/Resume preserves remaining time across repeated pauses', async () => {
  const f = setup(); f.controller.start(options); f.synth.end(); await flush();
  f.clock.tick(400); f.controller.pause(); equal(f.controller.snapshot.remainingMs, 600);
  f.clock.tick(9000); f.controller.resume(); f.clock.tick(200); f.controller.pause();
  equal(f.controller.snapshot.remainingMs, 400);
  f.controller.resume(); f.clock.tick(399); equal(f.synth.current, null);
  f.clock.tick(1); equal(f.synth.current.text, sampleCards[0].steps[0].answer);
});

test('Skip cancels speech and skips the whole multi-step card', async () => {
  const f = setup(); f.controller.start(options); f.controller.skip();
  equal(f.synth.current.text, sampleCards[1].steps[0].question);
  await reachAnswer(f); f.controller.skip();
  equal(f.synth.current.text, sampleCards[2].steps[0].question);
  equal(f.controller.stepIndex, 0); equal(f.synth.overlaps, 0);
});

test('Skip during recall cancels the old timer', async () => {
  const f = setup(); f.controller.start(options); f.synth.end(); await flush();
  f.controller.skip(); f.clock.tick(1000);
  equal(f.synth.current.text, sampleCards[1].steps[0].question);
  equal(f.synth.spoken.length, 2);
});

test('Skip while paused stays paused, then resumes the next card', async () => {
  const f = setup(); f.controller.start(options); f.controller.pause(); f.controller.skip();
  equal(f.controller.status, 'paused'); equal(f.synth.current, null);
  f.controller.resume(); equal(f.synth.current.text, sampleCards[1].steps[0].question);
});

test('Skipping the last card finishes and Resume does not restart it', async () => {
  const f = setup(); f.controller.start(options);
  f.controller.skip(); f.controller.skip(); f.controller.pause(); f.controller.skip(); f.controller.resume();
  equal(f.controller.status, 'finished'); equal(f.synth.current, null); equal(f.clock.tasks.size, 0);
});

for (const phase of ['question', 'recall', 'answer', 'paused']) {
  test(`Restart during ${phase} resets cursor without a surviving old action`, async () => {
    const f = setup(); f.controller.start(options); f.controller.skip();
    if (phase === 'recall' || phase === 'answer') { f.synth.end(); await flush(); }
    if (phase === 'answer') f.clock.tick(1000);
    if (phase === 'paused') f.controller.pause();
    f.controller.restart(); await flush(); f.clock.tick(1000);
    equal(f.controller.cardIndex, 0); equal(f.controller.stepIndex, 0);
    equal(f.synth.current.text, sampleCards[0].steps[0].question); equal(f.synth.overlaps, 0);
  });
}

test('Repeated Start is ignored, including while paused', () => {
  const f = setup(); f.controller.start(options);
  for (let i = 0; i < 30; ++i) f.controller.start(options);
  equal(f.synth.spoken.length, 1); f.controller.pause(); f.controller.start(options);
  equal(f.controller.status, 'paused'); equal(f.synth.spoken.length, 1);
});

test('20 rapid Stop/Restart cycles leave exactly one active utterance/watchdog', async () => {
  const f = setup(); f.controller.start(options);
  for (let i = 0; i < 20; ++i) { f.controller.stop(); f.controller.restart(); }
  await flush(); equal(f.synth.overlaps, 0); equal(f.clock.tasks.size, 1);
  f.controller.stop(); await flush(); equal(f.clock.tasks.size, 0); equal(f.speech.active, null);
});

test('Late old end/error callbacks cannot advance or cancel a new session', async () => {
  const f = setup(); f.controller.start(options);
  const oldEnd = f.synth.current.onend; const oldError = f.synth.current.onerror;
  f.controller.restart(); const active = f.synth.current; const cancels = f.synth.cancelCount;
  oldEnd(); oldError({ error: 'interrupted' }); await flush();
  equal(f.controller.phase, 'question'); assert(f.synth.current === active);
  equal(f.synth.cancelCount, cancels); equal(f.synth.overlaps, 0);
});

test('Stop between native end event and promise continuation prevents progression', async () => {
  const f = setup(); f.controller.start(options); f.synth.end(); f.controller.stop(); await flush();
  equal(f.controller.status, 'stopped'); equal(f.clock.tasks.size, 0); equal(f.synth.spoken.length, 1);
});

test('Speech error stops advancement; Resume retries the same answer', async () => {
  const f = setup(); f.controller.start(options); await reachAnswer(f);
  f.synth.fail(); await flush(); equal(f.controller.status, 'error');
  assert(f.controller.error.includes('network')); equal(f.clock.tasks.size, 0);
  f.controller.resume(); equal(f.synth.current.text, sampleCards[0].steps[0].answer);
});

test('Missing speech callback reports an error rather than guessing completion', async () => {
  const f = setup(); f.controller.start(options); f.clock.tick(120000); await flush();
  equal(f.controller.status, 'error'); equal(f.synth.spoken.length, 1);
  equal(f.controller.cardIndex, 0); equal(f.clock.tasks.size, 0); equal(f.synth.current, null);
});

test('Synchronous browser speak exception becomes a recoverable error', async () => {
  const f = setup(); f.synth.speak = () => { throw new Error('Unavailable'); };
  f.controller.start(options); await flush(); equal(f.controller.status, 'error');
  equal(f.controller.error, 'Unavailable'); equal(f.clock.tasks.size, 0);
});

test('Duplicate end events settle the speech operation only once', async () => {
  const f = setup(); f.controller.start(options); const end = f.synth.current.onend;
  f.synth.end(); end(); await flush(); equal(f.controller.phase, 'recall');
  equal(f.events.filter(e => e.event === 'question-ended').length, 1); equal(f.clock.tasks.size, 1);
});

test('Adapter rejects a concurrent utterance rather than queuing overlapping work', async () => {
  const f = setup(); const abort = new AbortController();
  const first = f.speech.speak('one', { ...options, signal: abort.signal });
  let rejected = false;
  try { await f.speech.speak('two', { ...options, signal: abort.signal }); } catch { rejected = true; }
  assert(rejected); abort.abort(); equal(await first, 'cancelled'); equal(f.clock.tasks.size, 0);
});

test('Adapter honors already-aborted signal without speaking', async () => {
  const f = setup(); const abort = new AbortController(); abort.abort();
  equal(await f.speech.speak('never', { ...options, signal: abort.signal }), 'cancelled');
  equal(f.synth.spoken.length, 0);
});

test('Voice/rate/pitch/volume reach the native utterance and session settings are frozen', () => {
  const f = setup(); const config = { ...options }; f.controller.start(config); config.rate = 2;
  equal(f.synth.current.rate, 0.9); equal(f.synth.current.pitch, 1); equal(f.synth.current.volume, 1);
  assert(f.synth.current.voice === preferred); equal(f.synth.current.lang, 'en-GB');
  equal(f.controller.settings.rate, 0.9);
});

test('Invalid settings are rejected before playback', () => {
  const f = setup(); let rejected = false;
  try { f.controller.start({ ...options, recallMs: NaN }); } catch { rejected = true; }
  assert(rejected); equal(f.synth.spoken.length, 0);
});

test('Preferred voice, saved selection, UK fallback, English fallback and no-English cases', () => {
  const french = { name: 'French', lang: 'fr-FR', voiceURI: 'fr' };
  const uk = { name: 'Local UK', lang: 'en-GB', voiceURI: 'uk' };
  assert(selectVoice([local, preferred]) === preferred);
  assert(selectVoice([local, preferred], voiceKey(local)) === local);
  assert(selectVoice([local, uk]) === uk);
  assert(selectVoice([french, local]) === local);
  equal(selectVoice([french]), null); equal(selectVoice([]), null);
});

test('Async voiceschanged refreshes an initially empty voice inventory', () => {
  const synth = new Synth(); const clock = new Clock(); const updates = [];
  const watcher = watchVoices(synth, update => updates.push(update), clock);
  equal(updates.at(-1).waiting, true);
  synth.voices = [preferred]; synth.dispatchEvent(new Event('voiceschanged'));
  equal(updates.at(-1).waiting, false); assert(selectVoice(updates.at(-1).voices) === preferred);
  watcher.dispose(); equal(clock.tasks.size, 0);
});

test('Voice discovery stops waiting after 3 seconds but still accepts late voices', () => {
  const synth = new Synth(); const clock = new Clock(); const updates = [];
  const watcher = watchVoices(synth, update => updates.push(update), clock);
  clock.tick(3000); equal(updates.at(-1).waiting, false); equal(updates.at(-1).voices, []);
  synth.voices = [local]; synth.dispatchEvent(new Event('voiceschanged'));
  assert(selectVoice(updates.at(-1).voices) === local);
  watcher.refresh(); watcher.dispose(); const length = updates.length;
  synth.dispatchEvent(new Event('voiceschanged')); equal(updates.length, length); equal(clock.tasks.size, 0);
});

export async function runTests(report = () => {}) {
  const results = [];
  for (const { name, fn } of tests) {
    try { await fn(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.stack || String(error) }); }
    finally { for (const fixture of fixtures.splice(0)) fixture.controller.stop(); await flush(); }
    report(results.at(-1));
  }
  return results;
}
