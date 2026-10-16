// Laboratory only: normalized additive sine tones, no files or production-player hooks.
export const candidates = [
  { id: 'glass', name: 'Soft glass', partials: [[1, 1], [2.76, .18], [4.1, .05]], notes: [1] },
  { id: 'wood', name: 'Warm wood', partials: [[1, 1], [1.48, .25], [2.1, .08]], notes: [1], damp: 2 },
  { id: 'metal', name: 'Brushed silver', partials: [[1, 1], [2.4, .22], [3.8, .08]], notes: [1] },
  { id: 'two-note', name: 'Gentle two-note', partials: [[1, 1], [2, .08]], notes: [1, 1.25] },
  { id: 'marimba', name: 'Soft marimba', partials: [[1, 1], [4, .12]], notes: [1], damp: 1.6 },
  { id: 'wind', name: 'Delicate wind', partials: [[1, 1], [2.7, .1]], notes: [1, 1.5, 1.25] },
  { id: 'piano', name: 'Felt piano', partials: [[1, 1], [2, .3], [3, .1]], notes: [1], damp: 1.2 },
  { id: 'electronic', name: 'Quiet electronic', partials: [[1, 1]], notes: [1, 1.125] },
];
export const defaults = {
  step: { id: 'wood', pitch: 440, volume: 35, duration: .32, decay: 75, before: .12, after: .18 },
  card: { id: 'two-note', pitch: 360, volume: 40, duration: .6, decay: 80, before: .18, after: .25 },
};
export const controls = [
  ['pitch', 'Pitch', 220, 660, 10, ' Hz'],
  ['volume', 'Volume', 0, 70, 1, '%'],
  ['duration', 'Sound length', .15, 1.2, .01, ' s'],
  ['decay', 'Fade-out (higher = softer tail)', 20, 95, 1, '%'],
  ['before', 'Silence before', 0, 1.5, .01, ' s'],
  ['after', 'Silence after', 0, 1.5, .01, ' s'],
];
export function boundedSettings(value) {
  const result = { id: candidates.some(c => c.id === value.id) ? value.id : 'wood' };
  for (const [key, , min, max] of controls) {
    result[key] = Number.isFinite(value[key]) ? Math.max(min, Math.min(max, value[key])) : defaults.step[key];
  }
  return result;
}
export function scheduleTone(context, destination, value, start = context.currentTime) {
  const settings = boundedSettings(value);
  const candidate = candidates.find(c => c.id === settings.id);
  const nodes = [];
  const sum = candidate.partials.reduce((total, [, weight]) => total + weight, 0);
  // Bound the sum even when notes overlap: <= .126 peak at maximum volume.
  const level = .18 * settings.volume / 100 / candidate.notes.length;
  candidate.notes.forEach((ratio, index) => {
    const offset = index * settings.duration * .2;
    const length = settings.duration - offset;
    const at = start + offset;
    const envelope = context.createGain();
    envelope.connect(destination);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(level, at + .012);
    const fadeStart = at + Math.max(.013, length * (1 - settings.decay / 100));
    envelope.gain.setValueAtTime(level, fadeStart);
    envelope.gain.exponentialRampToValueAtTime(.00001, at + length - .005);
    envelope.gain.linearRampToValueAtTime(0, at + length);
    nodes.push(envelope);
    for (const [partial, weight] of candidate.partials) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = settings.pitch * ratio * partial;
      gain.gain.setValueAtTime(weight / sum, at);
      if (partial > 1) gain.gain.exponentialRampToValueAtTime(weight / sum / (candidate.damp || 1), at + length);
      oscillator.connect(gain).connect(envelope);
      oscillator.start(at);
      oscillator.stop(at + length);
      nodes.push(oscillator, gain);
    }
  });
  return () => { for (const node of nodes) { if (node.stop) { try { node.stop(); } catch {} } node.disconnect(); } };
}
