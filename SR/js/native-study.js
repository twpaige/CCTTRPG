// Android session preparation and reconciliation. No browser speech dependency.
import { selectReview, selectAudit, recallSeconds, progressMap, progressKey, validTime, cutoff } from './scheduler.js';
import { completeStep } from './mastery.js';
import { validateSnapshot, requireValue } from './validation.js';
import { contentKey } from './backup.js';
export const MAX_PLAN_BYTES = 16 * 1024 * 1024;
export function buildNativePlan(snapshot, { mode = 'REVIEW', seriesId, window = { type: 'now' }, random = false,
  now = Date.now(), rng = Math.random, recall = 4, rate = .9, voiceName = '', sessionId = crypto.randomUUID(), streamed = false } = {}) {
  validateSnapshot(snapshot); validTime(now);
  requireValue(['REVIEW', 'AUDIT'].includes(mode), 'Choose REVIEW or AUDIT.');
  requireValue(Number.isFinite(rate) && rate >= .5 && rate <= 2, 'Rate must be 0.5–2.');
  recallSeconds({}, recall);
  const selected = mode === 'AUDIT' ? selectAudit(snapshot, { seriesId }) : selectReview(snapshot, { seriesId, window, random, now, rng });
  const progress = progressMap(snapshot), units = [];
  for (const [cardIndex, selectedCard] of selected.entries()) {
    const card = snapshot.flashcards.find(row => row.id === selectedCard.cardId);
    for (const step of card.steps.filter(row => selectedCard.stepIds.includes(row.id))) {
      const row = progress.get(progressKey(card.id, step.id));
      units.push({ id: String(units.length), cardId: card.id, stepId: step.id, name: card.name, stepNumber: step.position + 1,
        question: step.question, answer: step.answer, recallMs: Math.round(recallSeconds(step, recall) * 1000),
        cardNumber: cardIndex + 1, cardTotal: selected.length, stepTotal: card.steps.length,
        cardRevision: card.revision, progressRevision: row.revision, mastery: row.mastery, nextDueAt: row.nextDueAt });
    }
  }
  requireValue(units.length > 0, `No eligible ${mode} steps. Try another selection or review window.`);
  const plan = { version: 2, sessionId, libraryId: snapshot.libraryId, libraryGeneration: snapshot.libraryGeneration, mode, voiceName, rate, units };
  if (!streamed) requireValue(new TextEncoder().encode(JSON.stringify(plan)).length <= MAX_PLAN_BYTES, 'Selected session exceeds 16 MiB. Choose a smaller series; no content was truncated.');
  return plan;
}
export function sessionCall(native, operation, argument = '') {
  const result = native.session(operation, argument);
  requireValue(typeof result === 'string' && !result.startsWith('ERROR:'), result || 'Native session operation failed.');
  return result;
}
// Reuse only a ready, never-started native playlist in this process. STOP still disposes it.
export async function playlistValidationKey(snapshot, options) {
  const selected = buildNativePlan(snapshot, { ...options, random: false, streamed: true });
  const { now, rng, sessionId, ...configuration } = options;
  const material = JSON.stringify([contentKey(snapshot), configuration, selected.units.map(row => [row.cardId, row.stepId])]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function prepareNativeSession(snapshot, options, native, yieldUI = () => new Promise(resolve => setTimeout(resolve, 0)), continuing = () => true) {
  const now = options.now ?? Date.now(), plan = buildNativePlan(snapshot, { ...options, now, streamed: true });
  const { units, ...header } = plan;
  if (options.validationKey) header.validationKey = options.validationKey;
  header.cutoff = plan.mode === 'REVIEW' ? (Number.isFinite(cutoff(now, options.window)) ? cutoff(now, options.window) : null) : null;
  requireValue(continuing(), 'Preparation stopped.');
  sessionCall(native, 'begin', JSON.stringify(header));
  try {
    for (let i = 0; i < units.length; i++) {
      requireValue(continuing(), 'Preparation stopped.');
      const json = JSON.stringify(units[i]);
      for (let start = 0; start < json.length;) {
        let end = Math.min(json.length, start + 65536);
        if (end < json.length && json.charCodeAt(end - 1) >= 0xD800 && json.charCodeAt(end - 1) <= 0xDBFF) end--;
        sessionCall(native, 'part', json.slice(start, end)); start = end;
      }
      sessionCall(native, 'step');
      if (i % 16 === 0) await yieldUI();
    }
    requireValue(continuing(), 'Preparation stopped.');
    sessionCall(native, 'finish');
    return { header, count: units.length };
  } catch (error) { try { sessionCall(native, 'abort'); } catch { /* Preserve original error. */ } throw error; }
}
export function preparedPatches(snapshot, manifest, affectedCards) {
  const progress = progressMap(snapshot), affected = new Set(affectedCards);
  const audit = manifest.header.mode === 'AUDIT' ? new Set(selectAudit(snapshot).flatMap(card => card.stepIds.map(step => progressKey(card.cardId, step)))) : null;
  return manifest.units.map(unit => {
    if (!affected.has(unit.cardId)) return { ...unit, keep: true };
    const card = snapshot.flashcards.find(row => row.id === unit.cardId);
    const row = progress.get(progressKey(unit.cardId, unit.stepId)), anchor = card && progress.get(progressKey(card.id, card.steps.at(-1).id));
    const eligible = row => row && row.mastery < 10 && (manifest.header.cutoff === null || row.nextDueAt <= manifest.header.cutoff);
    const keep = audit ? audit.has(progressKey(unit.cardId, unit.stepId)) : eligible(anchor) && eligible(row);
    return { ...unit, keep: !!keep, ...(row ? { mastery: row.mastery, nextDueAt: row.nextDueAt, progressRevision: row.revision } : {}) };
  });
}
export async function updatePreparedSession(snapshot, affectedCards, native) {
  sessionCall(native, 'updateBegin');
  let offset = 0, count;
  do {
    const manifest = JSON.parse(sessionCall(native, 'manifest', String(offset))); count = manifest.count;
    for (const patch of preparedPatches(snapshot, manifest, affectedCards)) sessionCall(native, 'updateStep', JSON.stringify(patch));
    offset += manifest.units.length;
    await new Promise(resolve => setTimeout(resolve, 0));
  } while (offset < count);
  sessionCall(native, 'updateFinish');
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
