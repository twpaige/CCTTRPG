// Android session preparation and reconciliation. No browser speech dependency.
import { selectReview, selectAudit, recallSeconds, progressMap, progressKey, validTime } from './scheduler.js';
import { completeStep } from './mastery.js';
import { validateSnapshot, requireValue } from './validation.js';
export const MAX_PLAN_BYTES = 16 * 1024 * 1024;
export function buildNativePlan(snapshot, { mode = 'REVIEW', seriesId, window = { type: 'now' }, random = false,
  now = Date.now(), rng = Math.random, recall = 4, rate = .9, voiceName = '', sessionId = crypto.randomUUID() } = {}) {
  validateSnapshot(snapshot); validTime(now);
  requireValue(['REVIEW', 'AUDIT'].includes(mode), 'Choose REVIEW or AUDIT.');
  requireValue(Number.isFinite(rate) && rate >= .5 && rate <= 2, 'Rate must be 0.5–2.');
  recallSeconds({}, recall);
  const selected = mode === 'AUDIT' ? selectAudit(snapshot, { seriesId }) : selectReview(snapshot, { seriesId, window, random, now, rng });
  const progress = progressMap(snapshot), units = [];
  for (const selectedCard of selected) {
    const card = snapshot.flashcards.find(row => row.id === selectedCard.cardId);
    for (const step of card.steps.filter(row => selectedCard.stepIds.includes(row.id))) {
      const row = progress.get(progressKey(card.id, step.id));
      units.push({ id: String(units.length), cardId: card.id, stepId: step.id, name: card.name, stepNumber: step.position + 1,
        question: step.question, answer: step.answer, recallMs: Math.round(recallSeconds(step, recall) * 1000),
        cardRevision: card.revision, progressRevision: row.revision, mastery: row.mastery, nextDueAt: row.nextDueAt });
    }
  }
  requireValue(units.length > 0, `No eligible ${mode} steps. Try another selection or review window.`);
  const plan = { version: 2, sessionId, libraryId: snapshot.libraryId, libraryGeneration: snapshot.libraryGeneration, mode, voiceName, rate, units };
  requireValue(new TextEncoder().encode(JSON.stringify(plan)).length <= MAX_PLAN_BYTES, 'Selected session exceeds 16 MiB. Choose a smaller series; no content was truncated.');
  return plan;
}
export async function reconcileNative(db, native) {
  // A batch is copied by native code; only the exact successfully processed head is removed.
  const rows = JSON.parse(native.completions());
  for (const row of rows) {
    validTime(row.startedAt); validTime(row.completedAt);
    requireValue(['REVIEW', 'AUDIT'].includes(row.mode), 'Invalid native completion mode.');
    const prepared = { ...row, wasDue: row.mastery < 10 && row.nextDueAt <= row.startedAt };
    const pending = row.pending;
    if (pending) prepared.expectedKey = pending.expectedKey;
    await completeStep(db, prepared, { successful: true, completedAt: row.completedAt, pending });
    requireValue(native.acknowledge(row.queueId) === true, 'Completion saved; native acknowledgement will retry safely.');
  }
  return rows.length;
}
