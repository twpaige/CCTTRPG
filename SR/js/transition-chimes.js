import { scheduleTone } from './chime-tones.js';

// Owner-approved sr-chime-lab-v1 settings. No preference or backup fields.
export const APPROVED_CHIMES = Object.freeze(Object.fromEntries(
  [['step', 'wood'], ['card', 'two-note']].map(([kind, id]) => [kind, Object.freeze({
    id, pitch: 330, volume: 32, duration: .72, decay: 69, before: .27, after: .18,
  })])));

export class TransitionChimes {
  // Call directly from Start/Resume user gestures, before asynchronous database work.
  unlock() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio is unavailable. Use desktop Chrome for transition chimes.');
    this.context ||= new Audio();
    return this.context.resume();
  }
  async play(kind, { signal }) {
    if (signal.aborted) return 'cancelled';
    if (!this.context || this.context.state !== 'running') throw new Error('Chime audio is suspended. Press Resume to enable audio.');
    const settings = APPROVED_CHIMES[kind];
    return new Promise(resolve => {
      const cleanup = scheduleTone(this.context, this.context.destination, settings, this.context.currentTime + settings.before);
      const finish = result => {
        clearTimeout(timer); signal.removeEventListener('abort', abort); cleanup(); resolve(result);
      };
      const abort = () => finish('cancelled');
      const timer = setTimeout(() => finish('ended'), (settings.before + settings.duration + settings.after) * 1000);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
}
