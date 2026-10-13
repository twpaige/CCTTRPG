// Only this adapter touches Web Speech. Cancellation never depends on a browser event.
export class BrowserSpeech {
  constructor(synth, Utterance, clock = globalThis, timeoutMs = 120000) {
    this.synth = synth;
    this.Utterance = Utterance;
    this.clock = clock;
    this.timeoutMs = timeoutMs;
    this.active = null;
  }

  speak(text, { voice, rate = 0.9, signal }) {
    if (this.active) return Promise.reject(new Error('A speech operation is already active.'));
    if (signal.aborted) return Promise.resolve('cancelled');
    return new Promise((resolve, reject) => {
      const utterance = new this.Utterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;
      let settled = false;
      let timer;
      const finish = (result, error) => {
        if (settled) return false;
        settled = true;
        this.clock.clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
        utterance.onend = null;
        utterance.onerror = null;
        this.active = null;
        if (error) reject(error);
        else resolve(result);
        return true;
      };
      const cancel = () => {
        if (finish('cancelled')) this.synth.cancel();
      };
      utterance.onend = () => finish('ended');
      utterance.onerror = event => {
        if (finish(null, new Error(`Speech failed: ${event.error || 'unknown error'}. Use Resume to retry, Skip, or Stop.`))) this.synth.cancel();
      };
      this.active = utterance; // Keep a strong reference until completion/cancellation.
      signal.addEventListener('abort', cancel, { once: true });
      timer = this.clock.setTimeout(() => {
        if (finish(null, new Error('No speech completion within 120 seconds. Nothing was advanced. Resume retries this utterance.'))) this.synth.cancel();
      }, this.timeoutMs);
      try {
        this.synth.speak(utterance);
      } catch (error) {
        finish(null, error);
        this.synth.cancel();
      }
    });
  }
}
