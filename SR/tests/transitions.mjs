import assert from 'node:assert/strict';
import { ReviewController } from '../js/review.js';
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const cards = [
  { id: 'a', steps: [{ id: 'a0', question: 'Q0', answer: 'A0' }, { id: 'a2', question: 'Q2', answer: 'A2' }] },
  { id: 'c', steps: [{ id: 'c0', question: 'QC', answer: 'AC' }] },
];
function fixture(extra = {}) {
  const f = { active: null, history: [], credits: 0, cancelled: 0 };
  const operation = (type, text, { signal }) => {
    if (signal.aborted) return Promise.resolve('cancelled');
    assert.equal(f.active, null, 'Speech/chime overlap');
    f.history.push([type, text]);
    return new Promise(resolve => {
      const finish = result => { signal.removeEventListener('abort', abort); f.active = null; resolve(result); };
      const abort = () => { f.cancelled++; finish('cancelled'); };
      f.active = { type, text, finish }; signal.addEventListener('abort', abort, { once: true });
    });
  };
  f.controller = new ReviewController(structuredClone(cards), { speak: (text, options) => operation('speech', text, options) }, {
    clock: { now: () => 0, clearTimeout: () => { f.timer = null; }, setTimeout: fn => { f.timer = fn; return 1; } },
    transition: (kind, options) => operation('chime', kind, options),
    completeStep: () => { f.credits++; }, ...extra,
  });
  f.start = () => f.controller.start({ voice: { name: 'test' }, rate: .9, recallMs: 1000 });
  f.end = async () => { assert.ok(f.active); f.active.finish('ended'); await flush(); };
  f.answer = async () => { await f.end(); assert.equal(f.controller.phase, 'recall'); f.controller.remainingMs = 0; f.controller.deadline = 0; f.timer(); await flush(); await f.end(); };
  f.start(); return f;
}
let count = 0;
async function test(name, fn) { await fn(); count++; console.log('PASS ' + name); }
await test('Start is silent; same-card cue follows answer credit and precedes next question', async () => {
  const f = fixture(); assert.deepEqual(f.history, [['speech', 'Q0']]); await f.answer();
  assert.equal(f.credits, 1); assert.deepEqual(f.active && [f.active.type, f.active.text], ['chime', 'step']);
  await f.end(); assert.equal(f.active.text, 'Q2'); assert.equal(f.credits, 1);
});
await test('Card boundary replaces step cue; end of finite session has no extra cue', async () => {
  const f = fixture(); await f.answer(); await f.end(); await f.answer();
  assert.equal(f.active.text, 'card'); await f.end(); await f.answer();
  assert.equal(f.controller.status, 'finished'); assert.equal(f.credits, 3);
  assert.deepEqual(f.history.filter(([type]) => type === 'chime').map(([, kind]) => kind), ['step', 'card']);
});
await test('Next/Previous steps and cards use actual eligible identities, without completion credit', async () => {
  const f = fixture(); f.controller.navigateStep(1); await flush(); assert.equal(f.active.text, 'step'); await f.end();
  f.controller.navigateStep(-1); await flush(); assert.equal(f.active.text, 'step'); await f.end();
  f.controller.skip(); await flush(); assert.equal(f.active.text, 'card'); await f.end();
  f.controller.navigateCard(-1); await flush(); assert.equal(f.active.text, 'card'); assert.equal(f.credits, 0);
});
await test('Ordinary speech Pause/Resume does not introduce a cue or credit', async () => {
  const f = fixture(); f.controller.pause(); f.controller.resume(); await flush();
  assert.deepEqual(f.history, [['speech', 'Q0'], ['speech', 'Q0']]); assert.equal(f.credits, 0);
});
await test('Pause during cue cancels it; Resume retries only the cue, not the completed answer', async () => {
  const f = fixture(); await f.answer(); f.controller.pause(); assert.equal(f.active, null); assert.equal(f.credits, 1);
  f.controller.resume(); await flush(); assert.equal(f.active.text, 'step'); await f.end(); assert.equal(f.active.text, 'Q2'); assert.equal(f.credits, 1);
});
await test('Stop and immediate navigation invalidate queued cue continuations', async () => {
  const f = fixture(); f.controller.navigateStep(1); f.controller.skip(); await flush();
  assert.equal(f.active.text, 'card'); f.controller.stop(); await flush(); assert.equal(f.active, null); assert.equal(f.credits, 0);
  f.start(); assert.equal(f.active.text, 'Q0');
});
await test('Navigation while paused is silent until Resume and suppresses abandoned destination cues', async () => {
  const f = fixture(); f.controller.pause(); f.controller.navigateStep(1); f.controller.skip(); await flush();
  assert.equal(f.active, null); f.controller.resume(); await flush(); assert.equal(f.active.text, 'card');
});
await test('Repeating the identical step is not a transition', async () => {
  const f = fixture(); f.controller.setRepeat(true); await f.answer(); assert.equal(f.active.text, 'Q0');
  assert.equal(f.history.filter(([type]) => type === 'chime').length, 0);
});
await test('AUDIT cycle chooses cue after refreshed destination is known', async () => {
  const f = fixture({ nextCycle: () => structuredClone(cards), completeStep: undefined });
  f.controller.skip(); await flush(); await f.end(); await f.answer(); assert.equal(f.active.text, 'card'); assert.equal(f.credits, 0);
});
await test('Repeat refresh removing KNOWN card emits only the actual card boundary', async () => {
  const f = fixture({ refreshRepeat: () => null }); f.controller.setRepeat(true); await f.answer();
  assert.equal(f.active.text, 'card'); assert.equal(f.credits, 1);
  assert.deepEqual(f.history.filter(([type]) => type === 'chime'), [['chime', 'card']]);
});
console.log(count + '/' + count + ' desktop transition scenarios passed.');
