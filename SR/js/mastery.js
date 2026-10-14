import { DATA_STORES, request, transaction } from './db.js';
import { readSnapshot, exportSnapshot, contentKey } from './backup.js';
import { requireValue, validateStepProgress } from './validation.js';
import { nextDue, validTime, validMastery, progressKey, progressMap, selectReview, selectAudit } from './scheduler.js';

export function planMastery(snapshot, action) {
  const card = snapshot.flashcards.find(row => row.id === action.cardId);
  requireValue(card, 'Flashcard no longer exists.');
  const series = snapshot.series.find(row => row.id === card.seriesId);
  const siblings = snapshot.flashcards.filter(row => row.seriesId === series.id).sort((a, b) => a.position - b.position);
  const comprehensive = series.bound && siblings.at(-1).id === card.id;
  let cards = [card], steps, level, confirmation = false;
  switch (action.type) {
    case 'step':
      level = validMastery(action.level);
      steps = card.steps.filter(step => step.id === action.stepId);
      requireValue(steps.length === 1, 'Step no longer exists.');
      if (level === 10 && card.steps.at(-1).id === action.stepId) { confirmation = true; steps = undefined; if (comprehensive) cards = siblings; }
      break;
    case 'known': level = 10; confirmation = true; if (comprehensive) cards = siblings; break;
    case 'resetCard': level = 0; confirmation = true; break;
    case 'resetObjective': level = 0; confirmation = true; if (comprehensive) cards = siblings; break;
    case 'resetFinal': level = 0; confirmation = true; steps = [card.steps.at(-1)]; break;
    default: throw new Error('Unknown mastery action.');
  }
  const members = cards.flatMap(row => (steps || row.steps).map(step => [row.id, step.id]));
  const entireSeries = comprehensive && cards === siblings;
  const target = entireSeries ? `entire BOUND series “${series.name}”` : `flashcard “${card.name}”`;
  const effect = level === 10 ? 'KNOWN: excluded from normal REVIEW and available through AUDIT.' : `Mastery ${level}: next due is calculated from this change. Earlier KNOWN steps remain unchanged unless included below.`;
  return { members, level, confirmation, message: `${target}: change ${members.length} steps across ${cards.length} flashcards. ${effect} Authored content is preserved.` };
}
async function writePlan(tx, snapshot, plan, now) {
  const progress = progressMap(snapshot);
  for (const [cardId, stepId] of plan.members) {
    const old = progress.get(progressKey(cardId, stepId)); requireValue(old, 'Missing step progress.');
    const row = { ...old, mastery: plan.level, nextDueAt: nextDue(plan.level, now), revision: old.revision + 1 };
    validateStepProgress(row); await request(tx.objectStore('stepProgress').put(row));
  }
}
export async function changeMastery(db, { action, expectedKey, confirmed = false, now = Date.now() }) {
  validTime(now);
  return transaction(db, DATA_STORES, 'readwrite', async tx => {
    const snapshot = await readSnapshot(tx);
    requireValue(typeof expectedKey === 'string' && contentKey(snapshot) === expectedKey, 'Library changed. Reload before changing mastery; nothing was changed.');
    const plan = planMastery(snapshot, action);
    requireValue(!plan.confirmation || confirmed === true, 'Explicit confirmation is required for this mastery action.');
    await writePlan(tx, snapshot, plan, now); return plan;
  });
}

// Stage 6 integration contract: one occurrence is one attempted step, not one whole card.
export async function prepareCompletion(db, { cardId, stepId, mode, sessionId, occurrenceId, startedAt = Date.now(), window = { type: 'now' } }) {
  validTime(startedAt);
  requireValue(['REVIEW', 'AUDIT', 'FOCUSED'].includes(mode), 'Invalid practice mode.');
  requireValue(typeof sessionId === 'string' && sessionId.length > 0 && typeof occurrenceId === 'string' && occurrenceId.length > 0, 'Completion needs session and occurrence IDs.');
  const snapshot = await exportSnapshot(db), card = snapshot.flashcards.find(row => row.id === cardId);
  requireValue(card?.steps.some(step => step.id === stepId), 'Missing card/step.');
  const units = mode === 'REVIEW' ? selectReview(snapshot, { now: startedAt, window }) : mode === 'AUDIT' ? selectAudit(snapshot) : undefined;
  if (units) requireValue(units.some(unit => unit.cardId === cardId && unit.stepIds.includes(stepId)), `Step is not eligible for ${mode}.`);
  const progress = progressMap(snapshot).get(progressKey(cardId, stepId));
  return { cardId, stepId, mode, sessionId, occurrenceId, startedAt, libraryGeneration: snapshot.libraryGeneration,
    cardRevision: card.revision, progressRevision: progress.revision, wasDue: progress.mastery < 10 && progress.nextDueAt <= startedAt,
    expectedKey: contentKey(snapshot) };
}
export async function completeStep(db, prepared, { successful = false, completedAt = Date.now(), pending } = {}) {
  requireValue(successful === true, 'An unfinished, skipped or interrupted step cannot receive completion.');
  validTime(completedAt); requireValue(completedAt >= prepared.startedAt, 'Clock moved backwards; completion was not applied.');
  return transaction(db, DATA_STORES, 'readwrite', async tx => {
    const snapshot = await readSnapshot(tx);
    requireValue(snapshot.libraryGeneration === prepared.libraryGeneration, 'Library was replaced; discard this stale completion.');
    const id = JSON.stringify([prepared.libraryGeneration, prepared.sessionId, prepared.occurrenceId, prepared.cardId, prepared.stepId]);
    if (await request(tx.objectStore('stepEvents').get(id))) return { applied: false, duplicate: true };
    const card = snapshot.flashcards.find(row => row.id === prepared.cardId);
    const old = progressMap(snapshot).get(progressKey(prepared.cardId, prepared.stepId));
    requireValue(card && old && card.revision === prepared.cardRevision && old.revision === prepared.progressRevision, 'Content or mastery changed; stale completion was not applied.');
    requireValue(['REVIEW', 'AUDIT', 'FOCUSED'].includes(prepared.mode), 'Invalid completion mode.');
    if (pending) {
      requireValue(contentKey(snapshot) === prepared.expectedKey, 'Library changed during a pending mastery adjustment.');
      requireValue(pending.action.type === 'step' && pending.action.cardId === prepared.cardId && pending.action.stepId === prepared.stepId, 'Pending mastery must belong to the current step.');
      const plan = planMastery(snapshot, pending.action);
      requireValue(!plan.confirmation || pending.confirmed === true, 'Explicit propagation confirmation required.');
      await writePlan(tx, snapshot, plan, completedAt);
      if (prepared.mode === 'REVIEW' && prepared.wasDue) {
        requireValue(old.nextDueAt <= prepared.startedAt && (old.lastReviewedAt === null || completedAt >= old.lastReviewedAt), 'Invalid completion timing.');
        const store = tx.objectStore('stepProgress'), changed = await request(store.get([prepared.cardId, prepared.stepId]));
        await request(store.put({ ...changed, lastReviewedAt: completedAt }));
      }
    } else {
      if (prepared.mode !== 'REVIEW' || !prepared.wasDue || old.mastery === 10) return { applied: false };
      requireValue(old.nextDueAt <= prepared.startedAt && (old.lastReviewedAt === null || completedAt >= old.lastReviewedAt), 'Invalid completion timing.');
      const row = { ...old, lastReviewedAt: completedAt, nextDueAt: nextDue(old.mastery, completedAt), revision: old.revision + 1 };
      validateStepProgress(row); await request(tx.objectStore('stepProgress').put(row));
    }
    await request(tx.objectStore('stepEvents').add({ id, libraryGeneration: prepared.libraryGeneration, sessionId: prepared.sessionId,
      occurrenceId: prepared.occurrenceId, flashcardId: prepared.cardId, stepId: prepared.stepId, completedAt }));
    return { applied: true };
  });
}

// No speech here. Stage 6 invokes begin/finish only at real audio boundaries.
export class StepCompletionController {
  constructor(db) { this.db = db; this.generation = 0; }
  async begin(options) {
    const generation = ++this.generation; this.current = undefined;
    const prepared = await prepareCompletion(this.db, options);
    requireValue(generation === this.generation, 'Step was interrupted while preparing.');
    this.current = { prepared }; return this.current;
  }
  pendingMastery(level, { confirmed = false } = {}) {
    requireValue(this.current && !this.current.promise, 'No unfinished step is active.'); validMastery(level);
    const { cardId, stepId } = this.current.prepared;
    this.current.pending = { action: { type: 'step', cardId, stepId, level }, confirmed };
  }
  interrupt() { this.generation++; this.current = undefined; }
  finish(token, completedAt = Date.now()) {
    requireValue(token && token === this.current, 'Interrupted/stale step completion ignored.');
    if (!token.promise) token.promise = completeStep(this.db, token.prepared, { successful: true, completedAt, pending: token.pending }).catch(error => { token.promise = undefined; throw error; });
    return token.promise;
  }
  async special(action, { pause, confirm, now = Date.now }) {
    requireValue(typeof pause === 'function' && typeof confirm === 'function', 'Special actions need playback pause and confirmation handlers.');
    await pause(); this.interrupt();
    const snapshot = await exportSnapshot(this.db), plan = planMastery(snapshot, action);
    if (!await confirm(plan.message)) return { applied: false };
    return changeMastery(this.db, { action, expectedKey: contentKey(snapshot), confirmed: true, now: typeof now === 'function' ? now() : now });
  }
}
