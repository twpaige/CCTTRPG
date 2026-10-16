import { acquirePlayback } from './db.js';
import { BrowserSpeech } from './speech.js';
import { speechParts } from './study.js';
import { readSpeechPreferences, preferredVoice } from './speech-preferences.js';

export class EditorSpeech {
  constructor(getDatabase, onChange, onError) {
    this.getDatabase = getDatabase; this.onChange = onChange; this.onError = onError; this.epoch = 0;
  }
  stop() {
    this.epoch++; this.controller?.abort(); this.controller = undefined;
    this.release?.(); this.release = undefined; this.id = undefined; this.onChange();
  }
  async toggle(id, text) {
    if (this.id === id) { this.stop(); return; }
    // Switching text retains our lease: releasing/reacquiring it here can race Web Locks.
    this.epoch++; this.controller?.abort(); this.controller = undefined;
    if (!text.trim()) { this.stop(); this.onError('Enter text to preview.'); return; }
    const epoch = this.epoch; this.id = id; this.onChange();
    try {
      if (!this.release) await (this.acquiring ||= acquirePlayback(this.getDatabase()).then(release => {
        if (this.id) this.release = release; else release();
      }).finally(() => { this.acquiring = undefined; }));
      if (epoch !== this.epoch) return;
      if (!globalThis.speechSynthesis || !globalThis.SpeechSynthesisUtterance) throw new Error('Browser speech is unavailable. Use desktop Chrome.');
      const preferences = readSpeechPreferences(), voice = preferredVoice(speechSynthesis.getVoices(), preferences);
      if (!voice) throw new Error('No English voice is available yet. Wait for Chrome to load voices, then try Preview again.');
      const controller = this.controller = new AbortController(), speech = new BrowserSpeech(speechSynthesis, SpeechSynthesisUtterance);
      for (const part of speechParts(text)) {
        if (controller.signal.aborted) break;
        await speech.speak(part, { voice, rate: preferences.rate, signal: controller.signal });
      }
    } catch (reason) { if (epoch === this.epoch) this.onError(reason.message); }
    finally { if (epoch === this.epoch) this.stop(); }
  }
}
