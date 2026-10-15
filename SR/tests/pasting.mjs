import assert from 'node:assert/strict';

export async function testPasting(context, base) {
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/library.html?test=SRLearning-test-pasting');
  await page.waitForFunction(() => !document.getElementById('workspace').disabled);
  const results = await page.evaluate(async () => {
    const { openDatabase, DATA_STORES, transaction, request, acquirePlayback } = await import('./js/db.js');
    const { Repository } = await import('./js/repository.js');
    const { validateFlashcardInput, validateSnapshot } = await import('./js/validation.js');
    const { exportSnapshot, exportJSON, restoreJSON, contentKey, readSnapshot } = await import('./js/backup.js');
    const { changeMastery } = await import('./js/mastery.js');
    const { buildNativePlan } = await import('./js/native-study.js');
    const equal = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Mismatch: ' + JSON.stringify([a, b])); };
    const ok = value => { if (!value) throw new Error('Assertion failed'); };
    const rejects = async fn => { let failed = false; try { await fn(); } catch { failed = true; } ok(failed); };
    const input = { flashcards: [{ name: ' Exact name Ω ', steps: [
      { question: ' Q\n日本語 <script>literal</script> ', answer: ' A\n🧠 ', recallSeconds: 0 },
      { question: 'Final?', answer: 'Exact final!', recallSeconds: 3600.5 }
    ] }] };
    const results = [];
    async function test(label, body) {
      const db = await openDatabase({ name: 'SRLearning-test-paste-' + crypto.randomUUID() }), repo = new Repository(db);
      try {
        const series = await repo.createSeries({ name: 'Existing', bound: false });
        await repo.createCard({ seriesId: series.id, name: 'Original', steps: [{ question: 'Q', answer: 'A' }] });
        await body(db, repo, series); validateSnapshot(await exportSnapshot(db)); results.push(label);
      } finally { db.close(); await new Promise((resolve, reject) => { const r = indexedDB.deleteDatabase(db.name); r.onsuccess = resolve; r.onerror = () => reject(r.error); }); }
    }
    for (const count of [1, 3, 1000]) for (const create of [false, true]) await test('Add ' + count + ' cards to ' + (create ? 'new BOUND' : 'existing') + ' series atomically with exact content/order and fresh progress', async (db, repo, series) => {
      const before = await exportSnapshot(db), batch = { flashcards: Array.from({ length: count }, (_, i) => ({ ...structuredClone(input.flashcards[0]), name: 'Card ' + i })) };
      const result = await repo.importCards(batch, create ? { name: 'New', bound: true } : { seriesId: series.id }), after = await exportSnapshot(db);
      equal(result.cards.length, count); equal(result.series.bound, create); equal(batch.flashcards.length, count);
      for (const key of ['series', 'flashcards', 'progress', 'stepProgress', 'stepEvents']) {
        const original = after[key].filter(row => before[key].some(old => JSON.stringify(old) === JSON.stringify(row)));
        equal(original, before[key]);
      }
      equal(after.libraryGeneration, before.libraryGeneration); equal(after.settings, before.settings); equal(after.presets, before.presets);
      const allIds = after.flashcards.flatMap(c => [c.id, ...c.steps.map(s => s.id)]); equal(new Set(allIds).size, allIds.length);
      for (const [i, card] of result.cards.entries()) {
        equal(card.name, batch.flashcards[i].name); equal(card.position, i + (create ? 0 : 1));
        equal(card.steps.map(({ id, position, ...step }) => step), batch.flashcards[i].steps);
        equal(card.steps.map(s => s.position), [0, 1]); equal(card.createdAt, card.updatedAt); equal(card.revision, 1);
        const progress = after.stepProgress.filter(p => p.flashcardId === card.id);
        equal(progress.length, 2); ok(progress.every(p => p.mastery === 0 && p.lastReviewedAt === null && p.nextDueAt === card.createdAt + 900000 && p.revision === 1));
      }
      const json = await exportJSON(db); await restoreJSON(db, json, { confirmed: true, safetyJSON: json });
      const restored = await exportSnapshot(db);
      for (const key of ['flashcards', 'series', 'stepProgress', 'progress', 'stepEvents']) equal(restored[key], after[key]);
      equal(buildNativePlan(restored, { window: { type: 'max' }, streamed: true }).units.length, 1 + count * 2);
    });
    await test('Reject malformed/unsupported authoring fields, backup format and invalid recall without writes', async (db, repo, series) => {
      const before = contentKey(await exportSnapshot(db));
      const bad = [null, [], {}, { flashcards: [] }, { flashcards: null }, { flashcards: [null] }, { flashcards: [{ name: ' ', steps: [] }] },
        { ...input, format: 'sr-learning-backup' }, await exportSnapshot(db), JSON.parse('{"flashcards":[],"__proto__":{}}')];
      for (const field of ['id', 'position', 'revision', 'mastery', 'dueAt', 'recitationStepIds']) bad.push({ flashcards: [{ ...input.flashcards[0], [field]: 1 }] });
      for (const patch of [{ question: '' }, { answer: ' ' }, { question: 5 }, { answer: null }, { recallSeconds: -1 }, { recallSeconds: '2' }, { recallSeconds: null }, { recallSeconds: Infinity }, { role: 'cue' }, { id: 'x' }]) {
        bad.push({ flashcards: [{ name: 'Bad', steps: [{ question: 'Q', answer: 'A', ...patch }] }] });
      }
      for (const value of bad) await rejects(() => repo.importCards(value, { seriesId: series.id }));
      await rejects(() => validateFlashcardInput(JSON.parse('{bad')));
      await rejects(() => repo.importCards(input, { seriesId: 'missing' }));
      await rejects(() => repo.importCards(input, { name: ' ', bound: false }));
      equal(contentKey(await exportSnapshot(db)), before);
    });
    for (const create of [false, true]) await test('Mid-import failure rolls back ' + (create ? 'new series and all cards' : 'all appended cards'), async (db, repo, series) => {
      const before = contentKey(await exportSnapshot(db)), add = IDBObjectStore.prototype.add; let writes = 0;
      IDBObjectStore.prototype.add = function(...args) { if (this.name === 'stepProgress' && ++writes === 3) throw new Error('Injected storage failure'); return add.apply(this, args); };
      try { await rejects(() => repo.importCards({ flashcards: [input.flashcards[0], input.flashcards[0]] }, create ? { name: 'Rollback', bound: false } : { seriesId: series.id })); }
      finally { IDBObjectStore.prototype.add = add; }
      equal(contentKey(await exportSnapshot(db)), before);
    });
    await test('Imported card supports mastery, moving, editing, cloning, deleting and preserves history on move', async (db, repo, series) => {
      const result = await repo.importCards(input, { name: 'New unbound', bound: false }), card = result.cards[0];
      await changeMastery(db, { action: { type: 'step', cardId: card.id, stepId: card.steps[0].id, level: 4 }, expectedKey: contentKey(await exportSnapshot(db)), confirmed: true });
      await transaction(db, ['stepEvents'], 'readwrite', tx => {
        const event = { libraryGeneration: 'test', sessionId: 'session', occurrenceId: '1', flashcardId: card.id, stepId: card.steps[0].id, completedAt: 100 };
        event.id = JSON.stringify([event.libraryGeneration, event.sessionId, event.occurrenceId, event.flashcardId, event.stepId]);
        return request(tx.objectStore('stepEvents').add(event));
      });
      const before = await exportSnapshot(db), moved = await repo.updateCard(card.id, { seriesId: series.id }, card.revision);
      equal(moved.id, card.id); equal(moved.steps, card.steps);
      const after = await exportSnapshot(db); equal(after.stepProgress, before.stepProgress); equal(after.stepEvents, before.stepEvents);
      const edited = await repo.updateCard(moved.id, { name: 'Edited', steps: [...moved.steps].reverse() }, moved.revision);
      equal(edited.steps.map(s => s.id), [...card.steps].reverse().map(s => s.id));
      const [copy] = await repo.cloneCard(edited.id, 1, edited.revision); equal(copy.name, 'Edited (Copy 1)');
      await repo.deleteCard(edited.id, edited.revision);
      ok(await repo.getCard(copy.id)); equal((await repo.getStepProgress(copy.id, copy.steps[0].id)).mastery, 0);
    });
    await test('Stale preview rejects concurrent changes and identical restore; playback blocks import', async (db, repo, series) => {
      const guard = async () => {
        const expected = contentKey(await exportSnapshot(db));
        return new Repository(db, { guardStores: DATA_STORES, writeGuard: async tx => {
          if (contentKey(await readSnapshot(tx)) !== expected) throw new Error('Stale preview');
        } });
      };
      let guarded = await guard();
      const attempts = await Promise.allSettled([guarded.importCards(input, { seriesId: series.id }), guarded.importCards(input, { name: 'Concurrent', bound: false })]);
      equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
      guarded = await guard(); const json = await exportJSON(db); await restoreJSON(db, json, { confirmed: true, safetyJSON: json });
      await rejects(() => guarded.importCards(input, { seriesId: series.id }));
      const owner = await openDatabase({ name: db.name }), release = await acquirePlayback(owner);
      try { await rejects(() => repo.importCards(input, { seriesId: series.id })); } finally { release(); owner.close(); }
    });
    return results;
  });
  for (const result of results) console.log('PASS ' + result);
  let count = results.length; const pass = label => { console.log('PASS ' + label); count++; };
  const ready = () => page.waitForFunction(() => !document.getElementById('workspace').disabled);
  const press = name => page.getByRole('button', { name, exact: true }).click();
  const input = JSON.stringify({ flashcards: [{ name: 'Pasted', steps: [{ question: ' Q Ω\n ', answer: ' A 🧠\n ', recallSeconds: 4 }] }] });
  const read = () => page.evaluate(async () => {
    const { openDatabase } = await import('./js/db.js'), { exportSnapshot, contentKey } = await import('./js/backup.js');
    const db = await openDatabase({ name: 'SRLearning-test-pasting' }); try { return contentKey(await exportSnapshot(db)); } finally { db.close(); }
  });
  const validate = async () => { await press('Validate & Preview'); await ready(); };
  const confirm = async () => { await press('Confirm Import'); await ready(); };
  await press('Paste Flashcards'); const before = await read();
  await page.locator('#paste-json').fill('{bad'); await validate(); assert(await page.locator('#paste-error').textContent()); assert.equal(await page.locator('#paste-json').inputValue(), '{bad');
  await page.locator('#paste-json').fill(input); await page.locator('#paste-name').fill('New pasted series'); await page.locator('#paste-bound').check(); await validate();
  assert.match(await page.locator('#paste-preview').textContent(), /1 flashcards · 1 steps.*new BOUND/); assert.equal(await read(), before);
  await page.locator('#paste-cancel').click(); assert.equal(await read(), before);
  await press('Paste Flashcards'); assert.equal(await page.locator('#paste-json').inputValue(), input); await validate(); await confirm();
  assert.equal(await page.locator('#card-name').inputValue(), 'Pasted'); assert.equal(await page.locator('#question-0').inputValue(), ' Q Ω\n ');
  pass('Paste works in empty library: errors retain JSON; preview/cancel write nothing; confirmed new BOUND series selects first card');
  await page.locator('#answer-0').fill('Unsaved'); await press('Paste Flashcards');
  assert.match(await page.locator('#error').textContent(), /Save or cancel/); assert.equal(await page.locator('#paste-dialog').evaluate(e => e.open), false);
  assert.equal(await page.locator('#answer-0').inputValue(), 'Unsaved'); await press('Save'); await ready();
  pass('Unsaved card draft is retained and blocks paste workflow');
  await press('Paste Flashcards'); await page.locator('#paste-json').fill(input); await validate(); const existing = await read();
  await page.locator('#paste-json').fill(input + ' '); assert(await page.locator('#paste-confirm').isDisabled()); await validate();
  await page.locator('#paste-series').selectOption(''); assert(await page.locator('#paste-confirm').isDisabled());
  await page.locator('#paste-name').fill('Never created'); await validate(); await page.locator('#paste-bound').uncheck(); assert(await page.locator('#paste-confirm').isDisabled());
  await page.locator('#paste-series').selectOption({ label: 'New pasted series' }); await validate(); assert.equal(await read(), existing);
  await confirm(); assert.equal(await page.locator('#card-list .list-item').count(), 2);
  pass('Changes to text/destination/settings invalidate preview; existing destination appends without replacement');
  await press('Paste Flashcards'); await page.locator('#paste-json').fill(input); await validate();
  await page.evaluate(async () => {
    const { openDatabase } = await import('./js/db.js'), { Repository } = await import('./js/repository.js');
    const db = await openDatabase({ name: 'SRLearning-test-pasting' }); try { await new Repository(db).createSeries({ name: 'Other tab', bound: false }); } finally { db.close(); }
  });
  const concurrent = await read(); await confirm(); assert.equal(await read(), concurrent);
  assert.match(await page.locator('#paste-error').textContent(), /changed.*Validate & Preview/s); assert(await page.locator('#paste-confirm').isDisabled()); assert.equal(await page.locator('#paste-json').inputValue(), input);
  await validate(); await confirm(); assert.equal(await page.locator('#card-list .list-item').count(), 3);
  pass('Concurrent change rejects preview, retains pasted input and requires successful fresh validation');
  await press('Paste Flashcards'); await page.locator('#paste-json').fill(input); await page.locator('#paste-series').selectOption(''); await page.locator('#paste-name').fill('Failed new');
  await validate(); const beforeFailure = await read();
  await page.evaluate(() => { const add = IDBObjectStore.prototype.add; window.restorePasteAdd = () => IDBObjectStore.prototype.add = add; IDBObjectStore.prototype.add = function(...args) { if (this.name === 'stepProgress') throw new Error('Injected failure'); return add.apply(this, args); }; });
  await confirm(); assert.equal(await read(), beforeFailure); assert.match(await page.locator('#paste-error').textContent(), /Injected failure/);
  assert.equal(await page.locator('#paste-json').inputValue(), input); await page.evaluate(() => restorePasteAdd());
  pass('UI transaction failure retains paste and creates no empty series or partial records');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => { const d = document.getElementById('paste-dialog'); return d.scrollWidth <= d.clientWidth && d.getBoundingClientRect().right <= innerWidth; }));
    await page.locator('#paste-json').focus(); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'paste-series');
    await page.locator('#paste-cancel').scrollIntoViewIfNeeded(); assert(await page.locator('#paste-cancel').isVisible());
  }
  await page.locator('#paste-cancel').click();
  pass('Paste dialog fits 390/320px, scrolls to actions and supports keyboard navigation');
  await press('Paste Flashcards'); await page.locator('#paste-json').fill(input); await validate();
  await page.evaluate(() => {
    const getAll = IDBObjectStore.prototype.getAll;
    window.restorePasteRead = () => IDBObjectStore.prototype.getAll = getAll;
    IDBObjectStore.prototype.getAll = function(...args) {
      if (this.transaction.mode === 'readonly' && this.name === 'series') throw new Error('Injected refresh failure');
      return getAll.apply(this, args);
    };
  });
  await confirm(); await page.evaluate(() => restorePasteRead());
  assert.match(await page.locator('#error').textContent(), /Import saved.*Reload saved library/);
  assert.equal(await page.locator('#paste-dialog').evaluate(e => e.open), false);
  assert.equal(await page.locator('#paste-json').inputValue(), '');
  await press('Reload saved library'); await ready(); assert.equal(await page.locator('#card-list .list-item').count(), 4);
  pass('Post-commit refresh failure reports saved import and prevents accidental retry duplication');
  assert.deepEqual(errors, []); await page.close(); return count;
}
