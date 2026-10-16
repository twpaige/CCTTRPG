// Presentation only: authored positions come from the full library, never queue indexes.
export function playbackStatus(state, library) {
  const card = library?.flashcards.find(card => card.id === state.card?.id);
  const series = library?.series.find(series => series.id === card?.seriesId);
  const step = card?.steps.find(step => step.id === state.step?.id);
  const fields = [state.mode];
  if (series && card) {
    fields.push(series.name, `Card ${card.position + 1}/${library.flashcards.filter(row => row.seriesId === series.id).length}`);
    if (step) fields.push(`Step ${step.position + 1}/${card.steps.length}`);
  }
  const seconds = Math.ceil(Math.max(0, state.remainingMs || 0) / 1000);
  const phase = state.phase === 'recall' ? `Recall: ${seconds} seconds remaining`
    : { question: 'Question', answer: 'Answer', chime: 'Transition', prepare: 'Preparing step', commit: 'Saving', cycle: 'Preparing session', repeat: 'Checking repeat eligibility' }[state.phase];
  const status = state.starting ? 'Preparing session'
    : state.status === 'paused' ? `Paused${phase ? ` (${phase})` : ''}`
      : { stopped: 'Stopped', finished: 'Completed', error: 'Error', idle: 'Ready' }[state.status] || phase;
  return [...fields, status].filter(Boolean).join(' · ');
}
