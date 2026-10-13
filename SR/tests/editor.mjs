// Real UI / IndexedDB acceptance in an isolated Chrome profile. No runtime dependency.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.SR_PLAYWRIGHT || 'playwright');
const base = process.env.SR_TEST_URL || 'http://127.0.0.1:8765';
const profile = await mkdtemp(join(tmpdir(), 'sr-editor-test-'));
const name = 'SRLearning-test-editor';
const url = `${base}/index.html?test=${name}`;
let context, page, checks = 0;
const passed = text => { console.log(`PASS ${text}`); checks++; };
const launch = () => chromium.launchPersistentContext(profile, { headless: true, executablePath: process.env.SR_BROWSER || undefined, viewport: { width: 1440, height: 1000 } });
const ready = () => page.waitForFunction(() => !document.getElementById('workspace').disabled);
const press = async text => { const button = page.getByRole('button', { name: text, exact: true }); await button.focus(); await button.press('Enter'); };
const save = async () => { await press('Save'); await page.waitForFunction(() => !document.querySelector('#save')); await ready(); assert.equal(await page.locator('#error').textContent(), ''); };
const dialog = async (text, accept) => { const event = page.waitForEvent('dialog'); const action = press(text); const modal = await event; await (accept ? modal.accept() : modal.dismiss()); await action; };
const reload = async (dirty = false) => { if (dirty) await dialog('Reload saved library', true); else await press('Reload saved library'); await ready(); };
async function data(fn, arg) {
  return page.evaluate(`(async () => {
    const [{ openDatabase }, { Repository }, backup] = await Promise.all([import('./js/db.js'), import('./js/repository.js'), import('./js/backup.js')]);
    const db = await openDatabase({ name: ${JSON.stringify(name)} });
    try { return await (${fn.toString()})(new Repository(db), db, backup, ${JSON.stringify(arg ?? null)}); }
    finally { db.close(); }
  })()`);
}
const snapshot = () => data((repo, db, backup) => backup.exportSnapshot(db));
async function series(title, bound = false) {
  await press('New series'); await page.locator('#series-name').fill(title);
  if (bound) await page.locator('#bound').press('Space'); await save();
}
async function card(title, count) {
  await press('New flashcard'); await page.locator('#card-name').fill(title);
  const steps = [];
  for (let index = 0; index < count; index++) {
    if (index) await press('Add step');
    const question = `  Q${index + 1} — 日本語 🧠 <script>text only</script>\nsecond line  `;
    const answer = ` A${index + 1}\n${'My own association. '.repeat(index === 0 ? 200 : 1)} Ω  `;
    await page.locator(`#question-${index}`).fill(question); await page.locator(`#answer-${index}`).fill(answer);
    steps.push({ question, answer });
  }
  await save(); return steps;
}
try {
  context = await launch(); page = await context.newPage();
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(url); await ready();
  await series('Journey', true); await series('Independent');
  await press('Edit series'); await page.locator('#series-name').fill('Presidents'); await press('Move up'); await save();
  let state = await snapshot(); assert.deepEqual(state.series.map(row => [row.name, row.bound]), [['Presidents', false], ['Journey', true]]);
  assert.match(await page.locator('#binding').textContent(), /Unbound/);
  passed('Create/rename/order series; bound/unbound semantics; empty series');
  const expected = {};
  for (const count of [1, 6, 10, 100]) expected[`Chain ${count}`] = await card(`Chain ${count}`, count);
  state = await snapshot();
  for (const row of state.flashcards) assert.deepEqual(row.steps.map(({ question, answer }) => ({ question, answer })), expected[row.name]);
  assert(state.progress.every(row => row.mastery === 0 && row.lastReviewedAt === null && row.nextDueAt === 0));
  assert.equal(await page.locator('#card-list script').count(), 0);
  passed('Actual UI authors 1, 6, 10 and 100 steps; exact Unicode/whitespace/multiline/long stories and new progress defaults');
  await press('2. Chain 6');
  const six = state.flashcards.find(row => row.name === 'Chain 6');
  await press('Move step 1 down'); await press('Move step 6 up');
  await press('Insert after step 2'); await page.locator('#question-2').fill('Inserted question'); await page.locator('#answer-2').fill('Inserted answer');
  await dialog('Delete step 4', true);
  await page.locator('#answer-0').fill('Edited answer\nwith two lines');
  await save(); await press('2. Chain 6');
  const edited = (await snapshot()).flashcards.find(row => row.id === six.id);
  assert.deepEqual(edited.steps.filter(step => step.id !== edited.steps[2].id).map(step => step.id), [six.steps[1].id, six.steps[0].id, six.steps[3].id, six.steps[5].id, six.steps[4].id]);
  assert.equal(edited.steps[0].answer, 'Edited answer\nwith two lines');
  assert.equal(await page.locator('#question-2').inputValue(), 'Inserted question');
  passed('Insert/delete/edit and first/last step moves persist with stable surviving IDs');
  await page.locator('#answer-0').fill('Unsaved'); await dialog('Cancel', false);
  assert.equal(await page.locator('#answer-0').inputValue(), 'Unsaved'); await dialog('Cancel', true);
  assert.equal((await snapshot()).flashcards.find(row => row.id === six.id).steps[0].answer, edited.steps[0].answer);
  await press('2. Chain 6'); await page.locator('#card-name').fill('Draft'); await dialog('New series', false);
  assert.equal(await page.locator('#card-name').inputValue(), 'Draft');
  const navigation = page.waitForEvent('dialog'); await page.evaluate(() => { setTimeout(() => location.reload(), 0); }); const warning = await navigation; assert.equal(warning.type(), 'beforeunload'); await warning.dismiss();
  assert.equal(await page.locator('#card-name').inputValue(), 'Draft'); await dialog('Cancel', true);
  passed('Cancel, in-app navigation and browser reload guard unsaved input');
  await press('New flashcard'); await press('Save'); await ready(); assert.match(await page.locator('#error').textContent(), /name/);
  await page.locator('#card-name').fill('Invalid'); await page.locator('#question-0').fill('  '); await page.locator('#answer-0').fill('Retained');
  await press('Save'); await ready(); assert.match(await page.locator('#error').textContent(), /Step 1/); assert.equal(await page.locator('#answer-0').inputValue(), 'Retained');
  await dialog('Cancel', true); passed('Blank/whitespace validation retains drafts without creating records');
  await data(async (repo, db, backup, id) => { await repo.updateProgress(id, { mastery: 8, lastReviewedAt: 100, nextDueAt: 200 }, 1); }, six.id);
  await reload(); const beforeEdit = await snapshot();
  await press('2. Chain 6'); const longName = `Long name — ${'memory '.repeat(45)}<b>literal</b>`;
  await page.locator('#card-name').fill(longName); await page.locator('#answer-0').fill('Exact new answer'); await save();
  state = await snapshot(); assert.deepEqual(state.progress, beforeEdit.progress);
  assert.deepEqual(state.flashcards.filter(row => row.id !== six.id), beforeEdit.flashcards.filter(row => row.id !== six.id));
  assert.equal(state.flashcards.find(row => row.id === six.id).name, longName);
  passed('Long-name/text editing preserves progress and every unrelated card');
  await press(`2. ${longName}`); await press('Move down'); await save();
  state = await snapshot(); assert.equal(state.flashcards.find(row => row.id === six.id).position, 2);
  await press(`3. ${longName}`); await page.locator('#card-series').selectOption(state.series.find(row => row.name === 'Journey').id); await save();
  state = await snapshot(); assert.equal(state.flashcards.find(row => row.id === six.id).position, 0); assert.deepEqual(state.progress, beforeEdit.progress);
  passed('Card position and cross-series move normalize ordering without resetting progress');
  await press(`1. ${longName}`); await page.locator('#card-name').fill('Retain after write failure');
  await page.evaluate(() => { globalThis.srOriginalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'flashcards') throw new DOMException('Simulated quota exhausted', 'QuotaExceededError'); return globalThis.srOriginalPut.apply(this, args); }; });
  await press('Save'); await ready(); assert.match(await page.locator('#error').textContent(), /quota/); assert.equal(await page.locator('#card-name').inputValue(), 'Retain after write failure');
  assert.equal((await snapshot()).flashcards.find(row => row.id === six.id).name, longName);
  await page.evaluate(() => { IDBObjectStore.prototype.put = globalThis.srOriginalPut; });
  await save(); passed('Injected quota write failure rolls back and preserves input for retry');
  await press('1. Retain after write failure'); await page.locator('#card-name').fill('Stale draft');
  const other = await context.newPage(); await other.goto(url); await other.waitForFunction(() => !document.getElementById('workspace').disabled);
  await other.getByRole('button', { name: 'New series', exact: true }).click(); await other.locator('#series-name').fill('Other tab'); await other.getByRole('button', { name: 'Save', exact: true }).click(); await other.waitForFunction(() => !document.querySelector('#save'));
  await press('Save'); await ready(); assert.match(await page.locator('#error').textContent(), /changed in another tab/); assert.equal(await page.locator('#card-name').inputValue(), 'Stale draft');
  await other.close(); await reload(true);
  await press('1. Retain after write failure'); await page.locator('#card-name').fill('Draft before restore');
  await data(async (repo, db, backup) => { const json = await backup.exportJSON(db); await backup.restoreJSON(db, json, { confirmed: true, safetyJSON: json }); });
  await press('Save'); await ready(); assert.match(await page.locator('#error').textContent(), /was restored/); assert.equal(await page.locator('#card-name').inputValue(), 'Draft before restore');
  await reload(true); passed('Concurrent editor tab and identical-content restore generation both reject stale saves');
  // Seed optional imported annotations using the existing API, then edit through UI.
  await data(async (repo, db, backup, id) => { const row = await repo.getCard(id); const steps = row.steps.map(step => ({ ...step, role: 'target', directQuestion: 'Direct?', recallSeconds: 3 })); await repo.updateCard(id, { steps, recitationStepIds: steps.map(step => step.id) }, row.revision); }, six.id);
  await reload(); await press('1. Retain after write failure'); await page.locator('#card-name').fill('Annotated');
  await press('Move step 1 down'); assert.match(await page.locator('#error').textContent(), /recitation references/);
  await press('Delete step 1'); assert.match(await page.locator('#error').textContent(), /referenced/); await save();
  const annotated = (await snapshot()).flashcards.find(row => row.id === six.id); assert(annotated.steps.every(step => step.directQuestion === 'Direct?' && step.recallSeconds === 3 && step.role === 'target'));
  assert.deepEqual(annotated.recitationStepIds, annotated.steps.map(step => step.id));
  passed('Imported annotations retained; destructive recitation-reference changes fail closed');
  // Confirmation race: another writer adds content after the shown count.
  await press('Edit series'); await press('Delete series');
  assert.match(await page.locator('#delete-detail').textContent(), /1 flashcards, 6 steps and 1 mastery/);
  await data(async (repo, db, backup, id) => repo.createCard({ seriesId: id, name: 'Arrived after confirmation', steps: [{ question: 'Q', answer: 'A' }] }), annotated.seriesId);
  await press('Delete permanently'); await ready(); assert.match(await page.locator('#error').textContent(), /changed/);
  assert.equal((await snapshot()).flashcards.filter(row => row.seriesId === annotated.seriesId).length, 2);
  await reload(); passed('Stale destructive confirmation cannot cascade over newly added content');
  await data(async (repo, db, backup, id) => { const row = await repo.getCard(id); await repo.savePreset({ name: 'Affected', seriesIds: [row.seriesId], cardIds: [id], mode: 'focused', order: 'sequential', grouping: 'auto' }); }, six.id);
  await reload(); await press('1. Annotated'); await press('Delete flashcard'); await press('Keep content');
  assert((await snapshot()).flashcards.some(row => row.id === six.id));
  await press('Delete flashcard'); await press('Delete permanently'); await ready();
  state = await snapshot(); assert(!state.flashcards.some(row => row.id === six.id)); assert(!state.progress.some(row => row.flashcardId === six.id)); assert.deepEqual(state.presets[0].cardIds, []);
  await press('Edit series'); await press('Delete series'); await press('Delete permanently'); await ready();
  state = await snapshot(); assert(!state.series.some(row => row.id === annotated.seriesId)); assert.deepEqual(state.presets[0].seriesIds, []);
  await press('2. Other tab'); await press('Edit series'); await press('Delete series'); assert.match(await page.locator('#delete-detail').textContent(), /0 flashcards/); await press('Delete permanently'); await ready();
  passed('Cancelled deletion, card/series cascades, progress cleanup, preserved presets and empty-series deletion');
  const beforeRestart = await snapshot();
  const downloading = page.waitForEvent('download'); await press('Save JSON backup'); const download = await downloading; const path = join(profile, 'library.json'); await download.saveAs(path);
  const exported = JSON.parse(await readFile(path, 'utf8')); assert.deepEqual(exported.flashcards, beforeRestart.flashcards); assert.deepEqual(exported.progress, beforeRestart.progress);
  await context.close(); context = await launch(); page = await context.newPage(); await page.goto(url); await ready();
  state = await snapshot(); assert.deepEqual(state.flashcards, beforeRestart.flashcards); assert.deepEqual(state.series, beforeRestart.series); assert.deepEqual(state.progress, beforeRestart.progress);
  await press('3. Chain 100'); assert.equal(await page.locator('.step').count(), 100);
  for (let index = 0; index < 100; index++) { assert.equal(await page.locator(`#question-${index}`).inputValue(), expected['Chain 100'][index].question); assert.equal(await page.locator(`#answer-${index}`).inputValue(), expected['Chain 100'][index].answer); }
  passed('Actual browser process restart and UI reopen preserve all 100 questions/answers, IDs and positions; JSON download includes library');
  const restored = await page.evaluate(async json => {
    const { openDatabase } = await import('./js/db.js'); const backup = await import('./js/backup.js');
    const db = await openDatabase({ name: 'SRLearning-test-editor-restore' });
    try { await backup.restoreJSON(db, json, { confirmed: true, safetyJSON: await backup.exportJSON(db) }); return await backup.exportSnapshot(db); } finally { db.close(); }
  }, JSON.stringify(exported));
  for (const key of ['series', 'flashcards', 'progress', 'presets', 'settings']) assert.deepEqual(restored[key], exported[key]);
  passed('Complete exported library restores with record-level equality into isolated database');
  if (process.env.SR_SCREENSHOT) await page.screenshot({ path: process.env.SR_SCREENSHOT });
  await page.setViewportSize({ width: 390, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#answer-99').focus(); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BUTTON');
  if (process.env.SR_SCREENSHOT) await page.screenshot({ path: join(dirname(process.env.SR_SCREENSHOT), 'editor-small.png') });
  assert.deepEqual(pageErrors, []); passed('Responsive layout has no horizontal overflow; keyboard step controls reachable; no uncaught page errors');
  await page.setViewportSize({ width: 1440, height: 1000 }); await press('Cancel');
  await data(async (repo, db, backup) => { const series = (await repo.listSeries())[0]; for (let i = 0; i < 51; i++) await repo.createCard({ name: `Extra ${i}`, seriesId: series.id, steps: [{ question: 'Q', answer: 'A' }] }); });
  await reload(); assert.equal(await page.locator('#card-list .list-item').count(), 50); assert.equal(await page.locator('.step').count(), 0);
  const next = page.locator('#card-list').getByRole('button', { name: 'Next', exact: true }); await next.focus(); await next.press('Enter'); assert.equal(await page.locator('#card-list .list-item').count(), 4);
  passed('Card list pagination renders 50 summaries and no unselected step forms');
  await page.goto(`${base}/index.html?test=invalid`); await page.waitForFunction(() => document.getElementById('error').textContent.includes('Invalid isolated'));
  assert(await page.locator('#workspace').evaluate(element => element.disabled)); passed('Invalid test database name fails closed');
  console.log(`${checks}/${checks} editor acceptance scenarios passed. Browser UI automation, not owner manual verification.`);
} finally {
  await context?.close();
  // Only the exact directory created by mkdtemp for this run is removed.
  assert.equal(dirname(profile), tmpdir()); assert(join(profile).includes('sr-editor-test-'));
  await rm(profile, { recursive: true, force: true });
}
