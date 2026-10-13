export const FORMAT = 'sr-learning-backup';
export const FORMAT_VERSION = 2;
export function requireValue(ok, message) { if (!ok) throw new Error(message); }
export const text = value => typeof value === 'string' && value.trim().length > 0;
export const timestamp = value => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const oneOf = (value, choices) => choices.includes(value);
const badKeys = new Set(['__proto__', 'prototype', 'constructor']);

export function fields(object, required, optional = []) {
  requireValue(object && typeof object === 'object' && !Array.isArray(object), 'Expected an object.');
  requireValue(required.every(key => Object.hasOwn(object, key)), 'Missing required fields.');
  requireValue(Object.keys(object).every(key => !badKeys.has(key) && [...required, ...optional].includes(key)), 'Unknown or unsafe fields.');
}
function ids(list) {
  requireValue(Array.isArray(list) && list.every(text) && new Set(list).size === list.length, 'Invalid or duplicate IDs.');
}
function common(row) {
  requireValue(text(row.id) && text(row.name), 'ID and name must be nonempty text.');
  requireValue(timestamp(row.createdAt) && timestamp(row.updatedAt) && row.updatedAt >= row.createdAt, 'Invalid record timestamps.');
  requireValue(integer(row.revision) && row.revision >= 1, 'Invalid revision.');
}
export function validateSeries(row) {
  fields(row, ['id', 'name', 'bound', 'position', 'createdAt', 'updatedAt', 'revision'], ['recitationPrompt']);
  common(row);
  requireValue(typeof row.bound === 'boolean' && integer(row.position), 'Invalid series binding/position.');
  if ('recitationPrompt' in row) requireValue(text(row.recitationPrompt), 'Invalid recitation prompt.');
}
export function validateCard(row) {
  fields(row, ['id', 'seriesId', 'name', 'position', 'steps', 'createdAt', 'updatedAt', 'revision'], ['recitationStepIds']);
  common(row);
  requireValue(text(row.seriesId) && integer(row.position), 'Invalid card series/position.');
  requireValue(Array.isArray(row.steps) && row.steps.length > 0, 'A card needs at least one step.');
  ids(row.steps.map(step => step?.id));
  row.steps.forEach((step, position) => {
    fields(step, ['id', 'question', 'answer', 'position'], ['role', 'directQuestion', 'recallSeconds']);
    requireValue(step.position === position && text(step.question) && text(step.answer), 'Invalid step text or order.');
    if ('role' in step) requireValue(oneOf(step.role, ['cue', 'bridge', 'target']), 'Invalid step role.');
    if ('directQuestion' in step) requireValue(text(step.directQuestion), 'Invalid direct question.');
    if ('recallSeconds' in step) requireValue(Number.isFinite(step.recallSeconds) && step.recallSeconds >= 0, 'Invalid step recall duration.');
  });
  // Stage 5 uses the final step as the eligibility anchor, irrespective of old role annotations.
  if ('recitationStepIds' in row) {
    ids(row.recitationStepIds);
    const selected = row.steps.filter(step => row.recitationStepIds.includes(step.id)).map(step => step.id);
    requireValue(JSON.stringify(selected) === JSON.stringify(row.recitationStepIds), 'Invalid recitation references/order.');
  }
}
export function validateProgress(row) {
  fields(row, ['flashcardId', 'mastery', 'lastReviewedAt', 'nextDueAt', 'revision']);
  requireValue(text(row.flashcardId) && Number.isInteger(row.mastery) && row.mastery >= 0 && row.mastery <= 10, 'Invalid progress ID/mastery.');
  requireValue((row.lastReviewedAt === null || timestamp(row.lastReviewedAt)) && timestamp(row.nextDueAt), 'Invalid review timestamps; nextDueAt must be numeric.');
  requireValue(integer(row.revision) && row.revision >= 1, 'Invalid progress revision.');
}
export function validateStepProgress(row) {
  fields(row, ['flashcardId', 'stepId', 'mastery', 'lastReviewedAt', 'nextDueAt', 'revision']);
  requireValue(text(row.flashcardId) && text(row.stepId) && Number.isInteger(row.mastery) && row.mastery >= 0 && row.mastery <= 10, 'Invalid step progress identity/mastery.');
  requireValue((row.lastReviewedAt === null || timestamp(row.lastReviewedAt)) && (row.mastery === 10 ? row.nextDueAt === null : timestamp(row.nextDueAt)), 'KNOWN must have no due date; other steps require a numeric due date.');
  requireValue(integer(row.revision) && row.revision >= 1, 'Invalid step progress revision.');
}
export function validatePreset(row) {
  fields(row, ['id', 'name', 'seriesIds', 'cardIds', 'mode', 'order', 'grouping', 'createdAt', 'updatedAt', 'revision']);
  common(row); ids(row.seriesIds); ids(row.cardIds);
  requireValue(oneOf(row.mode, ['focused', 'due']) && oneOf(row.order, ['sequential', 'random']) && oneOf(row.grouping, ['auto', 'individual', 'full']), 'Invalid preset configuration.');
}
export function validateSetting(key, value) {
  if (['desktopVoice', 'androidVoice'].includes(key)) {
    fields(value, ['name', 'language'], ['voiceURI']);
    requireValue(text(value.name) && text(value.language) && (!('voiceURI' in value) || typeof value.voiceURI === 'string'), 'Invalid voice descriptor.');
  } else if (key === 'rate') requireValue(Number.isFinite(value) && value >= 0.1 && value <= 10, 'Invalid speech rate.');
  else if (key === 'pitch') requireValue(Number.isFinite(value) && value >= 0 && value <= 2, 'Invalid speech pitch.');
  else if (key === 'volume') requireValue(Number.isFinite(value) && value >= 0 && value <= 1, 'Invalid speech volume.');
  else if (['recallSeconds', 'passageMarginSeconds'].includes(key)) requireValue(Number.isFinite(value) && value >= 0, 'Invalid recall time.');
  else if (key === 'passageWordsPerMinute') requireValue(Number.isFinite(value) && value > 0, 'Invalid passage rate.');
  else if (key === 'intervalDays') requireValue(Array.isArray(value) && value.length === 11 && value.every(day => Number.isFinite(day) && day >= 0), 'Invalid interval table.');
  else throw new Error('Unsupported setting; secrets and arbitrary metadata are not stored.');
}
function unique(rows, key) { ids(rows.map(row => row?.[key])); }
function positions(rows) {
  requireValue(rows.every((row, index) => row.position === index), 'Array order and contiguous positions must agree.');
}
export function validateSnapshot(snapshot) {
  const v2 = snapshot?.formatVersion === 2 && snapshot?.schemaVersion === 2;
  fields(snapshot, ['format', 'formatVersion', 'schemaVersion', 'appVersion', 'exportedAt', 'libraryId', 'libraryGeneration', 'series', 'flashcards', 'progress', 'presets', 'settings', 'reviewEvents', ...(v2 ? ['stepProgress', 'stepEvents'] : [])]);
  requireValue(snapshot.format === FORMAT && (v2 || snapshot.formatVersion === 1 && snapshot.schemaVersion === 1), 'Unsupported backup format/schema version.');
  requireValue(text(snapshot.appVersion) && text(snapshot.libraryId) && text(snapshot.libraryGeneration), 'Invalid backup identity.');
  requireValue(typeof snapshot.exportedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(snapshot.exportedAt)
    && Number.isFinite(Date.parse(snapshot.exportedAt)) && new Date(snapshot.exportedAt).toISOString() === snapshot.exportedAt, 'Invalid export timestamp.');
  for (const key of ['series', 'flashcards', 'progress', 'presets', 'reviewEvents']) requireValue(Array.isArray(snapshot[key]), 'Missing record array.');
  unique(snapshot.series, 'id'); unique(snapshot.flashcards, 'id'); unique(snapshot.progress, 'flashcardId'); unique(snapshot.presets, 'id');
  snapshot.series.forEach(validateSeries); snapshot.flashcards.forEach(validateCard);
  snapshot.progress.forEach(validateProgress); snapshot.presets.forEach(validatePreset);
  positions(snapshot.series);
  const seriesIds = new Set(snapshot.series.map(row => row.id));
  const cardIds = new Set(snapshot.flashcards.map(row => row.id));
  const grouped = new Map(snapshot.series.map(row => [row.id, []]));
  for (const card of snapshot.flashcards) {
    requireValue(seriesIds.has(card.seriesId), 'Card references a missing series.');
    grouped.get(card.seriesId).push(card);
  }
  for (const cards of grouped.values()) positions(cards);
  requireValue(snapshot.progress.length === cardIds.size && snapshot.progress.every(row => cardIds.has(row.flashcardId)), 'Every live card needs exactly one progress record.');
  for (const preset of snapshot.presets) requireValue(preset.seriesIds.every(id => seriesIds.has(id)) && preset.cardIds.every(id => cardIds.has(id)), 'Preset references missing content.');
  requireValue(snapshot.settings && typeof snapshot.settings === 'object' && !Array.isArray(snapshot.settings), 'Invalid settings object.');
  for (const [key, value] of Object.entries(snapshot.settings)) validateSetting(key, value);
  // Reserved store, no scheduled-completion writer until Stage 6. Do not invent its contract here.
  requireValue(snapshot.reviewEvents.length === 0, 'Scheduled review events are not supported by this Stage 3 format.');
  if (v2) {
    requireValue(Array.isArray(snapshot.stepProgress) && Array.isArray(snapshot.stepEvents), 'Missing step progress/events.');
    const expected = new Set(snapshot.flashcards.flatMap(card => card.steps.map(step => JSON.stringify([card.id, step.id]))));
    const actual = snapshot.stepProgress.map(row => { validateStepProgress(row); return JSON.stringify([row.flashcardId, row.stepId]); });
    requireValue(actual.length === expected.size && new Set(actual).size === actual.length && actual.every(key => expected.has(key)), 'Every live step needs exactly one progress record.');
    unique(snapshot.stepEvents, 'id');
    for (const event of snapshot.stepEvents) {
      fields(event, ['id', 'libraryGeneration', 'sessionId', 'occurrenceId', 'flashcardId', 'stepId', 'completedAt']);
      requireValue(['id', 'libraryGeneration', 'sessionId', 'occurrenceId', 'flashcardId', 'stepId'].every(key => text(event[key])) && timestamp(event.completedAt), 'Invalid step completion receipt.');
      requireValue(event.id === JSON.stringify([event.libraryGeneration, event.sessionId, event.occurrenceId, event.flashcardId, event.stepId]), 'Invalid step receipt identity.');
    }
  }
  return snapshot;
}
// Pure, validated and idempotent; never mutates the incoming object or propagates across cards.
export function migrateSnapshot(snapshot) {
  validateSnapshot(snapshot);
  if (snapshot.formatVersion === 2) return structuredClone(snapshot);
  const copy = structuredClone(snapshot), progress = new Map(copy.progress.map(row => [row.flashcardId, row]));
  copy.formatVersion = copy.schemaVersion = 2;
  copy.stepProgress = copy.flashcards.flatMap(card => card.steps.map(step => {
    const old = progress.get(card.id);
    return { ...old, stepId: step.id, nextDueAt: old.mastery === 10 ? null : old.nextDueAt };
  }));
  copy.stepEvents = [];
  return validateSnapshot(copy);
}
export function parseSnapshot(json) {
  requireValue(typeof json === 'string', 'Select a JSON text file.');
  return validateSnapshot(JSON.parse(json, (key, value) => {
    requireValue(!badKeys.has(key), 'Unsafe object key.');
    return value;
  }));
}
