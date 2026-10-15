const defaultClock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id),
};

// One pending action at a time. Every replacement invalidates its old continuation.
export class ReviewController {
  constructor(cards, speech, { clock = defaultClock, onChange = () => {}, onEvent = () => {},
    prepareStep, completeStep, discardStep = () => {}, nextCycle, segment = text => [text], recall = (_step, settings) => settings.recallMs } = {}) {
    this.cards = cards;
    this.speech = speech;
    this.clock = clock;
    this.onChange = onChange;
    this.onEvent = onEvent;
    this.hooks = { prepareStep, completeStep, discardStep, nextCycle, segment, recall };
    this.part = 0;
    this.status = 'idle';
    this.phase = 'question';
    this.cardIndex = 0;
    this.stepIndex = 0;
    this.generation = 0;
    this.timer = null;
    this.abort = null;
    this.settings = null;
    this.remainingMs = 0;
    this.repeatCurrent = false;
    this.repeatCard = false;
    this.error = '';
  }

  get snapshot() {
    const card = this.cards[this.cardIndex];
    return {
      status: this.status, phase: this.phase, cardIndex: this.cardIndex,
      stepIndex: this.stepIndex, repeatCurrent: this.repeatCurrent, repeatCard: this.repeatCard, card, step: card?.steps[this.stepIndex],
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
    this.repeatCurrent = this.repeatCard = false;
    this._newStep();
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
    this.repeatCurrent = this.repeatCard = false;
    this._cancelAction();
    this.hooks.discardStep();
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

  skip() { this.navigateCard(1); }

  navigateCard(direction) {
    if (!['playing', 'paused', 'error'].includes(this.status)) return;
    if (direction === -1 && (this.cardIndex === 0 || this.phase === 'commit' || this.phase === 'cycle')) return;
    const paused = this.status === 'paused';
    this._cancelAction();
    this.repeatCurrent = this.repeatCard = false;
    this.cardIndex += direction;
    this.stepIndex = 0;
    this._newStep();
    this.error = '';
    this.status = paused ? 'paused' : 'playing';
    this._publish(direction === -1 ? 'previous-card' : 'skip-card');
    if (this.cardIndex >= this.cards.length && !this.hooks.nextCycle) this._finish();
    else if (!paused) this._execute();
  }

  setRepeat(enabled) {
    this.repeatCurrent = !!enabled && ['playing', 'paused', 'error'].includes(this.status) && !!this.snapshot.step;
    if (this.repeatCurrent) this.repeatCard = false;
    this._publish('repeat-setting');
  }

  setRepeatCard(enabled) {
    this.repeatCard = !!enabled && ['playing', 'paused', 'error'].includes(this.status) && !!this.snapshot.step;
    if (this.repeatCard) this.repeatCurrent = false;
    this._publish('repeat-setting');
  }

  navigateStep(direction) {
    if (!['playing', 'paused', 'error'].includes(this.status) || !this.snapshot.step || this.phase === 'commit') return;
    if (direction === -1 && this.stepIndex === 0) return;
    const paused = this.status === 'paused';
    this._cancelAction(); this.repeatCurrent = this.repeatCard = false;
    if (direction === -1) { --this.stepIndex; this._newStep(); }
    else this._advance();
    this.error = ''; this.status = paused ? 'paused' : 'playing';
    this._publish(direction === -1 ? 'previous-step' : 'skip-step');
    if (this.cardIndex >= this.cards.length && !this.hooks.nextCycle) this._finish();
    else if (!paused) this._execute();
  }

  _finish() {
    this.repeatCurrent = this.repeatCard = false;
    this._cancelAction();
    this.status = 'finished';
    this._publish('session-finished');
  }

  _newStep() {
    this.hooks.discardStep();
    this.context = undefined;
    this.work = undefined;
    this.part = 0;
    this.phase = this.hooks.prepareStep ? 'prepare' : 'question';
    this.parts = undefined;
  }

  // A special mastery action cancels the unfinished attempt, even if its dialog is dismissed.
  resetCurrentStep() { this.repeatCurrent = this.repeatCard = false; this.pause(); this._newStep(); this._publish('step-reset'); }

  _advance() {
    if (this.repeatCurrent) { this._newStep(); return; }
    if (++this.stepIndex >= this.cards[this.cardIndex].steps.length) {
      this.stepIndex = 0;
      if (!this.repeatCard) ++this.cardIndex;
    }
    this._newStep();
  }

  _error(error) {
    this._cancelAction(); this.status = 'error'; this.error = error.message;
    this._publish('playback-error');
  }

  _execute() {
    if (this.status !== 'playing') return;
    if (this.cardIndex >= this.cards.length) {
      if (!this.hooks.nextCycle) return this._finish();
      this.phase = 'cycle';
    }
    const token = ++this.generation;
    const stillCurrent = () => token === this.generation && this.status === 'playing';
    if (['prepare', 'commit', 'cycle'].includes(this.phase)) {
      const phase = this.phase;
      this._publish(`${phase}-start`);
      // Retain in-flight work over Pause/Resume. Retry failed commits with the same receipt.
      if (!this.work) {
        try {
          const result = phase === 'prepare' ? this.hooks.prepareStep(this.snapshot)
            : phase === 'commit' ? this.hooks.completeStep(this.context)
              : this.hooks.nextCycle();
          this.work = Promise.resolve(result);
        } catch (error) { this._error(error); return; }
      }
      this.work.then(result => {
        if (!stillCurrent()) return;
        this.work = undefined;
        if (phase === 'prepare') { this.context = result; this.phase = 'question'; }
        else if (phase === 'commit') this._advance();
        else {
          this.cards = result; this.cardIndex = this.stepIndex = 0;
          if (!result.length) return this._finish();
          this._newStep();
        }
        this._execute();
      }).catch(error => { if (stillCurrent()) { this.work = undefined; this._error(error); } });
      return;
    }
    if (this.phase === 'recall') {
      this.deadline = this.clock.now() + this.remainingMs;
      this._publish('recall-start');
      this.timer = this.clock.setTimeout(() => {
        if (!stillCurrent()) return;
        this.timer = null;
        this.remainingMs = Math.max(0, this.deadline - this.clock.now());
        if (this.remainingMs > 0) { this._execute(); return; }
        this._publish('recall-end');
        this.phase = 'answer';
        this._execute();
      }, Math.min(this.remainingMs, 2147483647));
      return;
    }
    this.abort = new AbortController();
    const step = this.cards[this.cardIndex].steps[this.stepIndex];
    const parts = this.parts ??= this.hooks.segment(step[this.phase]);
    this._publish(`${this.phase}-requested`);
    this.speech.speak(parts[this.part], { ...this.settings, signal: this.abort.signal }).then(result => {
      if (!stillCurrent() || result !== 'ended') return;
      this.abort = null;
      if (++this.part < parts.length) { this._execute(); return; }
      this.part = 0;
      this.parts = undefined;
      this._publish(`${this.phase}-ended`);
      if (this.phase === 'question') {
        this.phase = 'recall';
        this.remainingMs = this.hooks.recall(step, this.settings);
      } else {
        if (this.hooks.completeStep) this.phase = 'commit';
        else this._advance();
      }
      this._execute();
    }).catch(error => {
      if (!stillCurrent()) return;
      this._error(error);
    });
  }
}
