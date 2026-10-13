const defaultClock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id),
};

// One pending action at a time. Every replacement invalidates its old continuation.
export class ReviewController {
  constructor(cards, speech, { clock = defaultClock, onChange = () => {}, onEvent = () => {} } = {}) {
    this.cards = cards;
    this.speech = speech;
    this.clock = clock;
    this.onChange = onChange;
    this.onEvent = onEvent;
    this.status = 'idle';
    this.phase = 'question';
    this.cardIndex = 0;
    this.stepIndex = 0;
    this.generation = 0;
    this.timer = null;
    this.abort = null;
    this.settings = null;
    this.remainingMs = 0;
    this.error = '';
  }

  get snapshot() {
    const card = this.cards[this.cardIndex];
    return {
      status: this.status, phase: this.phase, cardIndex: this.cardIndex,
      stepIndex: this.stepIndex, card, step: card?.steps[this.stepIndex],
      error: this.error, voiceName: this.settings?.voice.name || '',
      remainingMs: this.status === 'playing' && this.phase === 'recall'
        ? Math.max(0, this.deadline - this.clock.now()) : this.remainingMs,
    };
  }

  _publish(event) {
    this.onEvent({ time: this.clock.now(), event, status: this.status, phase: this.phase,
      card: this.cardIndex + 1, step: this.stepIndex + 1 });
    this.onChange(this.snapshot);
  }

  _cancelAction() {
    ++this.generation;
    this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.abort?.abort();
    this.abort = null;
  }

  start(settings) {
    if (this.status === 'playing' || this.status === 'paused') return;
    if (!settings?.voice || !Number.isFinite(settings.recallMs) || settings.recallMs < 0
      || !Number.isFinite(settings.rate) || settings.rate <= 0) {
      throw new Error('Choose an English voice, a valid recall pause, and a positive speech rate.');
    }
    this._cancelAction();
    this.settings = { ...settings };
    this.cardIndex = 0;
    this.stepIndex = 0;
    this.phase = 'question';
    this.error = '';
    this.status = 'playing';
    this._publish('session-start');
    this._execute();
  }

  restart(settings = this.settings) {
    this.stop();
    this.start(settings);
  }

  stop() {
    this._cancelAction();
    this.status = 'stopped';
    this.error = '';
    this._publish('stop');
  }

  pause() {
    if (this.status !== 'playing') return;
    if (this.phase === 'recall') this.remainingMs = Math.max(0, this.deadline - this.clock.now());
    this._cancelAction();
    this.status = 'paused';
    this._publish('pause');
  }

  resume() {
    if (this.status !== 'paused' && this.status !== 'error') return;
    this.status = 'playing';
    this.error = '';
    this._publish('resume');
    this._execute();
  }

  skip() {
    if (!['playing', 'paused', 'error'].includes(this.status)) return;
    const paused = this.status === 'paused';
    this._cancelAction();
    ++this.cardIndex;
    this.stepIndex = 0;
    this.phase = 'question';
    this.error = '';
    this.status = paused ? 'paused' : 'playing';
    this._publish('skip-card');
    if (this.cardIndex >= this.cards.length) this._finish();
    else if (!paused) this._execute();
  }

  _finish() {
    this._cancelAction();
    this.status = 'finished';
    this._publish('session-finished');
  }

  _execute() {
    if (this.status !== 'playing') return;
    if (this.cardIndex >= this.cards.length) return this._finish();
    const token = ++this.generation;
    const stillCurrent = () => token === this.generation && this.status === 'playing';
    if (this.phase === 'recall') {
      this.deadline = this.clock.now() + this.remainingMs;
      this._publish('recall-start');
      this.timer = this.clock.setTimeout(() => {
        if (!stillCurrent()) return;
        this.timer = null;
        this._publish('recall-end');
        this.phase = 'answer';
        this._execute();
      }, this.remainingMs);
      return;
    }
    this.abort = new AbortController();
    const step = this.cards[this.cardIndex].steps[this.stepIndex];
    this._publish(`${this.phase}-requested`);
    this.speech.speak(step[this.phase], { ...this.settings, signal: this.abort.signal }).then(result => {
      if (!stillCurrent() || result !== 'ended') return;
      this.abort = null;
      this._publish(`${this.phase}-ended`);
      if (this.phase === 'question') {
        this.phase = 'recall';
        this.remainingMs = this.settings.recallMs;
      } else {
        this.phase = 'question';
        if (++this.stepIndex >= this.cards[this.cardIndex].steps.length) {
          this.stepIndex = 0;
          ++this.cardIndex;
        }
      }
      this._execute();
    }).catch(error => {
      if (!stillCurrent()) return;
      this._cancelAction();
      this.status = 'error';
      this.error = error.message;
      this._publish('speech-error');
    });
  }
}
