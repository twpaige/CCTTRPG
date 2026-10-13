// Shared sequencing definition. Native code interprets actions; it never builds Q/A rules.
export function buildPlaybackPlan(cards, { recallMs = 4000, passes = 1, rate = 0.9, voiceName = '', sessionId = crypto.randomUUID() } = {}) {
  if (!Array.isArray(cards) || !cards.length || !Number.isInteger(passes) || passes < 1 || passes > 100
    || !Number.isFinite(recallMs) || recallMs < 0 || recallMs > 120000 || !Number.isFinite(rate) || rate < 0.5 || rate > 2) {
    throw new Error('Invalid sample or playback settings.');
  }
  const units = [];
  for (let pass = 0; pass < passes; pass++) for (const [cardIndex, card] of cards.entries()) {
    if (!Array.isArray(card.steps) || !card.steps.length) throw new Error('Every card needs steps.');
    const actions = [];
    for (const [stepIndex, step] of card.steps.entries()) {
      for (const field of ['question', 'answer']) {
        if (typeof step[field] !== 'string' || !step[field].trim() || step[field].length > 2000) throw new Error('Sample speech must contain 1–2000 characters.');
      }
      actions.push({ type: 'speak', text: step.question, label: `Question ${stepIndex + 1}` },
        { type: 'wait', milliseconds: recallMs, label: `Recall ${stepIndex + 1}` },
        { type: 'speak', text: step.answer, label: `Answer ${stepIndex + 1}` });
    }
    units.push({ id: `${pass}:${cardIndex}`, name: card.name, actions });
  }
  return { version: 1, sessionId, voiceName, rate, units };
}
