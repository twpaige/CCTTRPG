// Pure Stage 5 policy. UTC timestamps; elapsed days/weeks, clamped UTC calendar months.
export const INTERVAL_LABELS = ['15 minutes', '3 hours', '6 hours', '1 day', '2 days', '3 days', '1 week', '2 weeks', '1 calendar month', '3 calendar months', 'KNOWN'];
const minutes = [15, 180, 360, 1440, 2880, 4320, 10080, 20160];
export function validTime(value) { if (!Number.isSafeInteger(value) || value < 0 || value > 8640000000000000) throw new Error('Invalid timestamp.'); return value; }
export function validMastery(value) { if (!Number.isInteger(value) || value < 0 || value > 10) throw new Error('Mastery must be an integer from 0 to 10.'); return value; }
export function nextDue(mastery, from) {
  validMastery(mastery); validTime(from);
  if (mastery === 10) return null;
  if (mastery < 8) return validTime(from + minutes[mastery] * 60000);
  const date = new Date(from), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + (mastery === 8 ? 1 : 3));
  const last = new Date(date); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  date.setUTCDate(Math.min(day, last.getUTCDate()));
  return validTime(date.getTime());
}
export function cutoff(now, window = { type: 'now' }) {
  validTime(now);
  if (window.type === 'max') return Infinity;
  if (window.type === 'now') return now;
  if (window.type !== 'days' || !Number.isInteger(window.days) || window.days < 1) throw new Error('Lookahead needs a whole number of days, starting at 1.');
  return validTime(now + window.days * 86400000);
}
export const progressKey = (cardId, stepId) => JSON.stringify([cardId, stepId]);
export function progressMap(snapshot) { return new Map(snapshot.stepProgress.map(row => [progressKey(row.flashcardId, row.stepId), row])); }
export function known(card, progress) { return progress.get(progressKey(card.id, card.steps.at(-1).id))?.mastery === 10; }
function shuffle(rows, rng) {
  for (let i = rows.length - 1; i > 0; i--) { const sample = rng(); if (!(sample >= 0 && sample < 1)) throw new Error('Invalid random source.'); const j = Math.floor(sample * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
  return rows;
}
export function selectReview(snapshot, { now = Date.now(), window = { type: 'now' }, seriesId, random = false, rng = Math.random } = {}) {
  const due = cutoff(now, window), progress = progressMap(snapshot), units = [];
  const eligible = row => row && row.mastery < 10 && row.nextDueAt <= due;
  for (const series of [...snapshot.series].sort((a, b) => a.position - b.position)) {
    if (seriesId !== undefined && series.id !== seriesId) continue;
    let cards = snapshot.flashcards.filter(card => card.seriesId === series.id).sort((a, b) => a.position - b.position)
      .filter(card => eligible(progress.get(progressKey(card.id, card.steps.at(-1).id))));
    if (random && !series.bound) cards = shuffle(cards, rng);
    for (const card of cards) units.push({ mode: 'REVIEW', cardId: card.id, stepIds: card.steps.filter(step => eligible(progress.get(progressKey(card.id, step.id)))).map(step => step.id) });
  }
  return units;
}
export function selectAudit(snapshot, { seriesId } = {}) {
  if (seriesId !== undefined && typeof seriesId !== 'string') throw new Error('AUDIT supports ALL or one series.');
  const progress = progressMap(snapshot), units = [];
  for (const series of [...snapshot.series].sort((a, b) => a.position - b.position)) {
    if (seriesId !== undefined && series.id !== seriesId) continue;
    let cards = snapshot.flashcards.filter(card => card.seriesId === series.id).sort((a, b) => a.position - b.position);
    if (series.bound && cards.length && cards.every(card => known(card, progress))) cards = [cards.at(-1)];
    else cards = cards.filter(card => known(card, progress));
    for (const card of cards) units.push({ mode: 'AUDIT', cardId: card.id, stepIds: [card.steps.at(-1).id] });
  }
  return units;
}
// A Stage 6 caller refreshes eligibility each cycle, so reset targets leave AUDIT.
export function auditCursor() {
  let index = 0, stopped = false;
  return { stop() { stopped = true; }, next(units) { if (stopped || !units.length) return null; const unit = units[index % units.length]; index++; return unit; } };
}
export function recallSeconds(step, sessionDefault, quickListen = false) {
  const value = quickListen === true ? 2 : step.recallSeconds ?? sessionDefault;
  if (!Number.isFinite(value) || value < 0 || value * 1000 > Number.MAX_SAFE_INTEGER) throw new Error('Invalid recall duration.');
  return value;
}
