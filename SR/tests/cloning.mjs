import assert from 'node:assert/strict';

// Runs in the existing disposable editor-test browser, never the owner's library.
export async function testCloning(context, base) {
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const name = 'SRLearning-test-cloning';
  await page.goto(base + '/library.html?test=' + name);
  await page.waitForFunction(() => !document.getElementById('workspace').disabled);
  const results = await page.evaluate(async () => {
    const { openDatabase, transaction, request, acquirePlayback, DATA_STORES } = await import('./js/db.js');
    const { Repository } = await import('./js/repository.js');
    const { exportSnapshot, exportJSON, restoreJSON, contentKey, readSnapshot } = await import('./js/backup.js');
    const { validateSnapshot } = await import('./js/validation.js');
    const results = [];
    const equal = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Mismatch: ' + JSON.stringify([a, b])); };
    const ok = value => { if (!value) throw new Error('Assertion failed'); };
    const rejects = async fn => { let failed = false; try { await fn(); } catch { failed = true; } ok(failed); };
    async function fixture(label, test) {
      const db = await openDatabase({ name: 'SRLearning-test-clone-' + crypto.randomUUID() }), repo = new Repository(db);
      try {
        const series = await repo.createSeries({ name: 'Template', bound: true, recitationPrompt: ' Exact prompt Ω ' });
        await repo.createSeries({ name: 'Later', bound: false });
        const cards = [];
        for (let i = 0; i < 3; i++) cards.push(await repo.createCard({ seriesId: series.id, name: 'Card ' + i,
          steps: [{ id: 's' + i + 'a', question: ' Q\n日本語 ', answer: ' A Ω\n ', role: 'cue', directQuestion: ' Direct? ', recallSeconds: 0 },
            { id: 's' + i + 'b', question: ' Final? ', answer: ' Exact final ', role: 'target', recallSeconds: 3600 }],
          recitationStepIds: ['s' + i + 'a', 's' + i + 'b'] }));
        await transaction(db, ['stepProgress', 'stepEvents'], 'readwrite', async tx => {
          for (const card of cards) for (const step of card.steps) await request(tx.objectStore('stepProgress').put({
            flashcardId: card.id, stepId: step.id, mastery: 10, lastReviewedAt: 100, nextDueAt: null, revision: 3
          }));
          const event = { libraryGeneration: 'old', sessionId: 'session', occurrenceId: 'one', flashcardId: cards[0].id, stepId: cards[0].steps[0].id, completedAt: 100 };
          event.id = JSON.stringify([event.libraryGeneration, event.sessionId, event.occurrenceId, event.flashcardId, event.stepId]);
          await request(tx.objectStore('stepEvents').add(event));
        });
        await test(db, repo, series, cards);
        validateSnapshot(await exportSnapshot(db)); results.push(label);
      } finally { db.close(); await new Promise((resolve, reject) => { const r = indexedDB.deleteDatabase(db.name); r.onsuccess = resolve; r.onerror = () => reject(r.error); }); }
    }
    function checkCopy(copy, original, snapshot) {
      ok(copy.id !== original.id); equal(copy.revision, 1); equal(copy.createdAt, copy.updatedAt);
      ok(copy.createdAt >= original.createdAt);
      equal(copy.steps.map(({ id, ...s }) => s), original.steps.map(({ id, ...s }) => s));
      ok(copy.steps.every(s => !original.steps.some(o => o.id === s.id)));
      equal(copy.recitationStepIds, copy.steps.map(s => s.id));
      const progress = snapshot.stepProgress.filter(p => p.flashcardId === copy.id);
      equal(progress.length, copy.steps.length);
      ok(progress.every(p => p.mastery === 0 && p.lastReviewedAt === null && p.nextDueAt === copy.createdAt + 900000 && p.revision === 1));
      ok(!snapshot.stepEvents.some(e => e.flashcardId === copy.id));
    }
    for (const index of [0, 1, 2]) for (const count of [1, 10]) await fixture('Clone FC ' + count + ' at position ' + index + ': exact content, independent IDs/progress and contiguous ordering', async (db, repo, series, cards) => {
      const before = await exportSnapshot(db), original = cards[index];
      const copies = await repo.cloneCard(original.id, count, original.revision), after = await exportSnapshot(db);
      const rows = await repo.listCards(series.id), ids = cards.map(c => c.id); ids.splice(index + 1, 0, ...copies.map(c => c.id));
      equal(rows.map(c => c.id), ids); equal(rows.map(c => c.position), rows.map((_, i) => i));
      equal(await repo.getCard(original.id), original);
      for (const card of cards) {
        const actual = await repo.getCard(card.id);
        equal({ ...actual, position: card.position, updatedAt: card.updatedAt, revision: card.revision }, card);
      }
      equal(after.stepProgress.filter(p => cards.some(c => c.id === p.flashcardId)), before.stepProgress);
      equal(after.progress.filter(p => cards.some(c => c.id === p.flashcardId)), before.progress); equal(after.stepEvents, before.stepEvents);
      copies.forEach(c => checkCopy(c, original, after));
      const allIds = rows.flatMap(c => [c.id, ...c.steps.map(s => s.id)]); equal(new Set(allIds).size, allIds.length);
      equal(copies.map(c => c.name), copies.map((_, i) => original.name + ' (Copy ' + (i + 1) + ')'));
    });
    await fixture('Repeated cloning and cloning a copy choose readable unused numbered names; invalid counts and stale revisions reject', async (db, repo, series, cards) => {
      const [first] = await repo.cloneCard(cards[0].id, 1, 1);
      const [second] = await repo.cloneCard(first.id, 1, 1);
      equal(second.name, 'Card 0 (Copy 2)');
      const before = contentKey(await exportSnapshot(db));
      for (const count of [0, 11, 1.5, NaN, '1']) await rejects(() => repo.cloneCard(cards[0].id, count, 1));
      await rejects(() => repo.cloneCard(cards[0].id, 1, 999)); await rejects(() => repo.cloneSeries(series.id, 999));
      equal(contentKey(await exportSnapshot(db)), before);
    });
    for (const bound of [true, false]) await fixture('Clone complete ' + (bound ? 'BOUND' : 'UNBOUND') + ' series with remapped references and fresh progress', async (db, repo, series, cards) => {
      series = await repo.updateSeries(series.id, { bound }, series.revision);
      const before = await exportSnapshot(db), result = await repo.cloneSeries(series.id, series.revision), after = await exportSnapshot(db);
      equal(result.series.name, 'Template (Copy)'); equal(result.series.bound, bound); equal(result.series.recitationPrompt, series.recitationPrompt);
      equal((await repo.listSeries()).map(s => s.position), [0, 1, 2]); equal(await repo.getSeries(series.id), series);
      equal(result.cards.map(c => c.name), cards.map(c => c.name));
      result.cards.forEach((c, i) => { equal(c.seriesId, result.series.id); checkCopy(c, cards[i], after); });
      equal(after.stepEvents, before.stepEvents); for (const card of cards) equal(await repo.getCard(card.id), card);
      const json = await exportJSON(db);
      await restoreJSON(db, json, { confirmed: true, safetyJSON: json });
      const restored = await exportSnapshot(db);
      for (const key of ['series', 'flashcards', 'stepProgress', 'progress', 'stepEvents']) equal(restored[key], after[key]);
      const edited = await repo.updateCard(result.cards[0].id, { name: 'Independent edit' }, 1);
      equal((await repo.getCard(cards[0].id)).name, cards[0].name);
      await repo.deleteCard(edited.id, edited.revision); ok(await repo.getCard(cards[0].id));
      await repo.deleteSeries(series.id, series.revision, { confirmed: true });
      equal((await repo.listCards(result.series.id)).length, 2); ok(await repo.getSeries(result.series.id));
    });
    await fixture('Clone empty series at end', async (db, repo) => {
      const empty = (await repo.listSeries())[1], result = await repo.cloneSeries(empty.id, empty.revision);
      equal(result.cards, []); equal(result.series.position, 2); equal((await repo.listSeries()).map(s => s.position), [0, 1, 2]);
    });
    await fixture('Clone series in the middle; deleting its copy preserves the original', async (db, repo) => {
      const middle = (await repo.listSeries())[1];
      await repo.createSeries({ name: 'Last', bound: false });
      const result = await repo.cloneSeries(middle.id, middle.revision);
      equal((await repo.listSeries()).map(s => s.name), ['Template', 'Later', 'Later (Copy)', 'Last']);
      await repo.deleteSeries(result.series.id, result.series.revision, { confirmed: true });
      equal(await repo.getSeries(middle.id), middle);
    });
    for (const kind of ['card', 'series']) await fixture('Atomic ' + kind + ' rollback when renumbering fails after all clones exist', async (db, repo, series, cards) => {
      const before = contentKey(await exportSnapshot(db)), put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(...args) {
        if (this.name === (kind === 'card' ? 'flashcards' : 'series')) throw new Error('Injected reorder failure');
        return put.apply(this, args);
      };
      try { await rejects(() => kind === 'card' ? repo.cloneCard(cards[0].id, 10, 1) : repo.cloneSeries(series.id, 1)); }
      finally { IDBObjectStore.prototype.put = put; }
      equal(contentKey(await exportSnapshot(db)), before);
    });
    for (const kind of ['card', 'series']) await fixture('Atomic ' + kind + ' rollback after partial writes and ID collision', async (db, repo, series, cards) => {
      const before = contentKey(await exportSnapshot(db)), add = IDBObjectStore.prototype.add;
      let writes = 0;
      IDBObjectStore.prototype.add = function(value, ...args) {
        if (this.name === 'stepProgress' && ++writes === 3) throw new Error('Injected storage failure');
        return add.call(this, value, ...args);
      };
      try { await rejects(() => kind === 'card' ? repo.cloneCard(cards[0].id, 10, 1) : repo.cloneSeries(series.id, 1)); }
      finally { IDBObjectStore.prototype.add = add; }
      equal(contentKey(await exportSnapshot(db)), before);
      const uuid = crypto.randomUUID.bind(crypto); crypto.randomUUID = () => kind === 'card' ? cards[0].id : series.id;
      try { await rejects(() => kind === 'card' ? repo.cloneCard(cards[0].id, 1, 1) : repo.cloneSeries(series.id, 1)); }
      finally { crypto.randomUUID = uuid; }
      equal(contentKey(await exportSnapshot(db)), before);
    });
    await fixture('Playback lock and snapshot guards reject concurrent changes and restore generations', async (db, repo, series, cards) => {
      const expected = contentKey(await exportSnapshot(db));
      const guarded = new Repository(db, { guardStores: DATA_STORES, writeGuard: async tx => {
        if (contentKey(await readSnapshot(tx)) !== expected) throw new Error('Stale library');
      } });
      const owner = await openDatabase({ name: db.name }), release = await acquirePlayback(owner);
      try { await rejects(() => guarded.cloneCard(cards[0].id, 1, 1)); await rejects(() => guarded.cloneSeries(series.id, 1)); }
      finally { release(); owner.close(); }
      const json = await exportJSON(db); await restoreJSON(db, json, { confirmed: true, safetyJSON: json });
      await rejects(() => guarded.cloneCard(cards[0].id, 1, 1)); await rejects(() => guarded.cloneSeries(series.id, 1));
    });
    await fixture('Concurrent guarded clone requests commit once and refuse the stale second request', async (db, repo, series, cards) => {
      const expected = contentKey(await exportSnapshot(db));
      const guarded = new Repository(db, { guardStores: DATA_STORES, writeGuard: async tx => {
        if (contentKey(await readSnapshot(tx)) !== expected) throw new Error('Stale library');
      } });
      const attempts = await Promise.allSettled([guarded.cloneCard(cards[0].id, 1, 1), guarded.cloneSeries(series.id, 1)]);
      equal(attempts.filter(r => r.status === 'fulfilled').length, 1); equal(attempts.filter(r => r.status === 'rejected').length, 1);
    });
    return results;
  });
  for (const result of results) console.log('PASS ' + result);
  let count = results.length;
  const pass = text => { console.log('PASS ' + text); count++; };
  const ready = () => page.waitForFunction(() => !document.getElementById('workspace').disabled);
  const press = name => page.getByRole('button', { name, exact: true }).click();
  async function seedOrChange(change = false) {
    return page.evaluate(async change => {
      const { openDatabase } = await import('./js/db.js'), { Repository } = await import('./js/repository.js');
      const db = await openDatabase({ name: 'SRLearning-test-cloning' }), repo = new Repository(db);
      try {
        if (change) return await repo.createSeries({ name: 'Concurrent', bound: false });
        const series = await repo.createSeries({ name: 'UI template', bound: false });
        await repo.createCard({ seriesId: series.id, name: 'Saved template', steps: [{ question: 'Saved Q', answer: 'Saved A' }] });
      } finally { db.close(); }
    }, change);
  }
  await seedOrChange(); await press('Reload saved library'); await ready(); await press('1. Saved template');
  await page.locator('#answer-0').fill('Unsaved draft'); await press('Clone FC');
  assert.match(await page.locator('#error').textContent(), /Save or cancel/);
  assert.equal(await page.locator('#clone-dialog').evaluate(e => e.open), false);
  await press('Clone Series'); assert.equal(await page.locator('#answer-0').inputValue(), 'Unsaved draft');
  await press('Save'); await ready(); await press('1. Saved template'); await press('Clone FC');
  assert.equal(await page.locator('#clone-count').inputValue(), '1');
  await page.locator('#clone-cancel').click();
  assert.equal(await page.locator('#card-list .list-item').count(), 1);
  pass('Dirty draft blocks both clones; save permits cloning; dialog defaults to one and cancel writes nothing');
  await press('Clone FC'); await page.locator('#clone-count').fill('11'); await press('Create copies');
  assert(await page.locator('#clone-dialog').evaluate(e => e.open)); await page.locator('#clone-count').fill('10'); await press('Create copies'); await ready();
  assert.equal(await page.locator('#card-list .list-item').count(), 11); assert.equal(await page.locator('#card-name').inputValue(), 'Saved template (Copy 1)');
  assert.equal(await page.locator('#answer-0').inputValue(), 'Unsaved draft');
  pass('Clone FC quantity validation, ten-copy insertion, success and first-clone selection');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const boxes = await page.locator('.editor-actions button').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
    if (width === 1440) assert(boxes.every(b => b.y === boxes[0].y));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert(boxes[i].right <= boxes[j].x || boxes[j].right <= boxes[i].x || boxes[i].bottom <= boxes[j].y || boxes[j].bottom <= boxes[i].y);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  pass('Clone FC shares the existing action row; controls wrap without overlap at 390/320px');
  await press('Clone Series'); assert(await page.locator('#clone-quantity').isHidden()); await press('Create series copy'); await ready();
  assert.equal(await page.locator('#current-series').textContent(), 'UI template (Copy)'); assert.equal(await page.locator('#card-name').inputValue(), 'Saved template');
  pass('Clone Series confirms exactly one copy and selects its first card');
  await press('Clone FC'); await seedOrChange(true); await press('Create copies'); await ready();
  assert.match(await page.locator('#error').textContent(), /changed in another tab/); assert.equal(await page.locator('#card-name').inputValue(), 'Saved template');
  await press('Reload saved library'); await ready(); await press('Clone Series'); await seedOrChange(true); await press('Create series copy'); await ready();
  assert.match(await page.locator('#error').textContent(), /changed in another tab/);
  pass('Concurrent writes after either confirmation reject the clone and preserve the editor');
  assert.deepEqual(errors, []); await page.close(); return count;
}
