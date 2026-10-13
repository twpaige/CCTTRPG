import assert from 'node:assert/strict';
import { buildPlaybackPlan } from '../../js/playback-plan.js';
import { sampleCards } from '../../poc/sample.js';
import { BrowserSpeech } from '../../js/speech.js';
import { ReviewController } from '../../js/review.js';
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const settings = { sessionId: 'test', recallMs: 4000 };
test('The shared samples produce three ordered units and 27 actions', () => {
  const plan = buildPlaybackPlan(sampleCards, settings);
  assert.deepEqual(plan.units.map(u => u.actions.length), [3, 6, 18]);
  assert.deepEqual(plan.units.flatMap(u => u.actions.filter(a => a.type === 'speak').map(a => a.text)), sampleCards.flatMap(c => c.steps.flatMap(s => [s.question, s.answer])));
});
test('Recall values follow each question, never speech duration guesses', () => {
  for (const unit of buildPlaybackPlan(sampleCards, settings).units) {
    for (let i = 0; i < unit.actions.length; i += 3) assert.deepEqual(unit.actions.slice(i, i + 3).map(a => a.type), ['speak', 'wait', 'speak']);
    assert.ok(unit.actions.filter(a => a.type === 'wait').every(a => a.milliseconds === 4000));
  }
});
test('Repeated passes retain unique unit IDs and fixed sample order', () => {
  const units = buildPlaybackPlan(sampleCards, { ...settings, passes: 30 }).units;
  assert.equal(units.length, 90); assert.equal(new Set(units.map(u => u.id)).size, 90);
  assert.equal(units[3].name, units[0].name);
});
test('Invalid settings and malformed/oversized speech are rejected', () => {
  for (const bad of [{ passes: 0 }, { passes: 1.5 }, { passes: 101 }, { recallMs: -1 }, { recallMs: NaN }, { rate: 0 }]) assert.throws(() => buildPlaybackPlan(sampleCards, { ...settings, ...bad }));
  assert.throws(() => buildPlaybackPlan([{ steps: [] }], settings));
  assert.throws(() => buildPlaybackPlan([{ steps: [{ question: 'x'.repeat(2001), answer: 'a' }] }], settings));
});
test('Building a plan never mutates the shared sample or adds scheduling data', () => {
  const before = JSON.stringify(sampleCards); const plan = buildPlaybackPlan(sampleCards, settings);
  assert.equal(JSON.stringify(sampleCards), before); assert.equal('mastery' in plan, false);
});

// Compare a completed run of the unchanged desktop engine to the native action definition.
let current, timer, clock = 0;
const spoken = [], waits = [];
const synth = { speak(u) { current = u; spoken.push(u.text); }, cancel() { current = null; } };
const fakeClock = { now: () => clock, setTimeout(fn, ms) { if (ms === 4000) { waits.push(ms); timer = fn; } return fn; }, clearTimeout(id) { if (timer === id) timer = null; } };
const desktop = new ReviewController(sampleCards, new BrowserSpeech(synth, class { constructor(text) { this.text = text; } }, fakeClock), { clock: fakeClock });
desktop.start({ voice: { name: 'fake', lang: 'en' }, rate: .9, recallMs: 4000 });
for (let i = 0; i < 100 && desktop.status !== 'finished'; i++) {
  if (current) { const utterance = current; current = null; utterance.onend(); }
  else if (timer) { const fn = timer; timer = null; clock += 4000; fn(); }
  for (let j = 0; j < 8; j++) await Promise.resolve();
}
test('Desktop execution trace matches JavaScript-defined native speech and wait order', () => {
  assert.equal(desktop.status, 'finished');
  const actions = buildPlaybackPlan(sampleCards, settings).units.flatMap(u => u.actions);
  assert.deepEqual(spoken, actions.filter(a => a.type === 'speak').map(a => a.text));
  assert.deepEqual(waits, actions.filter(a => a.type === 'wait').map(a => a.milliseconds));
});
console.log(`${passed}/${passed} JavaScript plan tests passed.`);
