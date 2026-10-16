import { acquirePlayback } from './db.js';
import { exportSnapshot, contentKey } from './backup.js';
import { selectReview, selectAudit, recallSeconds } from './scheduler.js';
import { StepCompletionController, planMastery } from './mastery.js';
import { ReviewController } from './review.js';

// Keep every code point and whitespace, splitting at a word boundary when possible.
// Small utterances keep the existing 120-second speech watchdog useful for long answers.
export function speechParts(text, limit = 400) {
  const chars = Array.from(text), parts = [];
  for (let start = 0; start < chars.length;) {
    let end = Math.min(start + limit, chars.length);
    if (end < chars.length) {
      for (let i = end; i > start + limit / 2; i--) if (/\s/u.test(chars[i - 1])) { end = i; break; }
    }
    parts.push(chars.slice(start, end).join('')); start = end;
  }
  return parts;
}

// Storage/policy adapter for the one existing speech controller, not another audio loop.
export class StudySession {
  constructor(db, speech, { onChange = () => {}, transition, clock, now = () => Date.now(), rng = Math.random } = {}) {
    this.db = db; this.speech = speech; this.onChange = onChange; this.clock = clock; this.now = now; this.rng = rng;
    this.completion = new StepCompletionController(db);
    this.transition = transition;
    this.operations = new Set(); this.epoch = 0; this.starting = false;
  }
  track(promise) {
    this.operations.add(promise);
    promise.then(() => this.operations.delete(promise), () => this.operations.delete(promise));
    return promise;
  }
  async settled() { while (this.operations.size) await Promise.allSettled([...this.operations]); }
  async release() { await this.settled(); const release = this.lease; this.lease = undefined; release?.(); }
  get snapshot() { return { ...(this.controller?.snapshot || { status: 'idle' }), mode: this.options?.mode, cycle: this.cycle,
    pending: this.completion.current?.masterySaved ? undefined : this.completion.current?.pending?.action.level, masterySaved: this.masterySaved, starting: this.starting }; }
  publish() { this.onChange(this.snapshot); }
  select(snapshot) {
    const units = this.options.mode === 'AUDIT' ? selectAudit(snapshot, this.options)
      : selectReview(snapshot, { ...this.options, now: this.now(), rng: this.rng });
    return units.map(unit => {
      const card = snapshot.flashcards.find(row => row.id === unit.cardId);
      const steps = card.steps.filter(step => unit.stepIds.includes(step.id));
      for (const step of steps) recallSeconds(step, this.options.recallMs / 1000);
      return { ...card, steps };
    });
  }
  async start(options) {
    if (this.starting || this.lease) return;
    const epoch = ++this.epoch;
    this.starting = true; this.publish();
    try {
      if (!['REVIEW', 'AUDIT'].includes(options.mode)) throw new Error('Choose REVIEW or AUDIT.');
      if (!options.voice || !Number.isFinite(options.rate) || options.rate < 0.5 || options.rate > 2) throw new Error('Choose an English voice and a speech rate from 0.5 to 2.');
      recallSeconds({}, options.recallMs / 1000);
      const release = await acquirePlayback(this.db);
      if (epoch !== this.epoch) { release(); return; }
      this.lease = release;
      this.options = { ...options, window: { ...options.window } };
      this.masterySaved = undefined; this.practiced = new Set();
      this.sessionId = crypto.randomUUID(); this.occurrence = 0; this.cycle = 1;
      const snapshot = await exportSnapshot(this.db);
      if (epoch !== this.epoch) return;
      // Stop old pre-deployment pages from silently changing the words/order mid-pass.
      const identity = data => contentKey({ libraryGeneration: data.libraryGeneration, series: data.series, flashcards: data.flashcards });
      const expected = identity(snapshot);
      const guard = async () => {
        const current = await exportSnapshot(this.db);
        if (epoch !== this.epoch) throw new Error('Session stopped.');
        if (identity(current) !== expected) throw new Error('Library content was changed or restored. Stop, then Start to reload it. No stale completion was saved.');
        return current;
      };
      this.controller = new ReviewController(this.select(snapshot), this.speech, {
        clock: this.clock,
        transition: this.transition,
        segment: speechParts,
        recall: (step, settings) => recallSeconds(step, settings.recallMs / 1000) * 1000,
        discardStep: () => this.completion.interrupt(),
        prepareStep: state => {
          const prior = [...this.operations], generation = this.completion.generation;
          return this.track((async () => {
            await Promise.allSettled(prior);
            const current = await guard();
            if (generation !== this.completion.generation) throw new Error('Step interrupted before speech.');
            const practice = options.mode === 'REVIEW' && (this.practiced.has(JSON.stringify([state.card.id, state.step.id]))
              || current.stepProgress.some(row => row.flashcardId === state.card.id && row.stepId === state.step.id && row.mastery === 10));
            const token = await this.completion.begin({ cardId: state.card.id, stepId: state.step.id, mode: practice ? 'FOCUSED' : options.mode,
              sessionId: this.sessionId, occurrenceId: String(++this.occurrence), startedAt: this.now(), window: options.window });
            if (identity(JSON.parse(token.prepared.expectedKey)) !== expected)
              throw new Error('Library content changed while preparing. Stop, then Start to reload.');
            return token;
          })());
        },
        completeStep: token => {
          token.completedAt ??= this.now();
          return this.track(this.completion.finish(token, token.completedAt).then(result => {
            this.practiced.add(JSON.stringify([token.prepared.cardId, token.prepared.stepId]));
            if (token.pending && epoch === this.epoch && this.completion.current === token) {
              token.masterySaved = true;
              const card = JSON.parse(token.prepared.expectedKey).flashcards.find(row => row.id === token.prepared.cardId);
              this.masterySaved = { level: token.pending.action.level, card: card.name,
                step: card.steps.find(row => row.id === token.prepared.stepId).position + 1 };
              this.publish();
            }
            return result;
          }));
        },
        refreshRepeat: options.mode === 'REVIEW' ? state => this.track((async () => {
          const current = await guard();
          // Refresh only this card; keep the prepared session's card order intact.
          const unit = selectReview(current, { ...options, random: false, now: this.now() }).find(unit => unit.cardId === state.card.id);
          if (!unit) return null;
          const card = current.flashcards.find(card => card.id === unit.cardId);
          return { ...card, steps: card.steps.filter(step => unit.stepIds.includes(step.id)) };
        })()) : undefined,
        nextCycle: options.mode === 'AUDIT' ? () => this.track((async () => {
          const current = await guard(); ++this.cycle; return this.select(current);
        })()) : undefined,
        onChange: state => {
          this.publish();
          if (state.status === 'finished') void this.release().then(() => this.publish());
        },
      });
      this.controller.start(options);
    } catch (error) { await this.release(); throw error; }
    finally { this.starting = false; this.publish(); }
  }
  pause() { this.controller?.pause(); }
  resume() { this.controller?.resume(); }
  skip() { this.controller?.skip(); }
  skipStep() { this.controller?.navigateStep(1); }
  previousStep() { this.controller?.navigateStep(-1); }
  previousCard() { this.controller?.navigateCard(-1); }
  setRepeat(enabled) { this.controller?.setRepeat(enabled); }
  setRepeatCard(enabled) { this.controller?.setRepeatCard(enabled); }
  async stop() {
    ++this.epoch; this.completion.interrupt(); this.controller?.stop();
    await this.release(); this.publish();
  }
  async restart() { const options = this.options; await this.stop(); if (options) await this.start(options); }
  async pendingMastery(level, confirm) {
    const token = this.completion.current;
    if (!token || token.promise || !['question', 'recall', 'answer'].includes(this.controller.phase)) throw new Error('Wait for an unfinished step before choosing mastery.');
    // Use the captured, validated step snapshot: ordinary selection has no async gap
    // in which an answer callback could advance to a different step.
    const snapshot = JSON.parse(token.prepared.expectedKey), { cardId, stepId } = token.prepared;
    const plan = planMastery(snapshot, { type: 'step', cardId, stepId, level });
    if (!plan.confirmation) {
      this.completion.pendingMastery(level); this.publish(); return;
    }
    const wasPlaying = this.controller.status === 'playing';
    this.pause();
    try {
      const confirmed = await confirm(plan.message + ' This pending choice applies only after the entire answer finishes.');
      if (this.completion.current !== token) return;
      if (confirmed) this.completion.pendingMastery(level, { confirmed: true });
      this.publish();
    } finally {
      if (wasPlaying && this.completion.current === token && this.controller.status === 'paused') this.resume();
    }
  }

  async special(type, confirm) {
    const cardId = this.controller?.snapshot.card?.id;
    if (!cardId || !this.lease || this.controller.phase === 'commit') throw new Error('Wait for the current scheduling write, or select an active flashcard.');
    const epoch = this.epoch;
    const prior = [...this.operations];
    const result = await this.track(this.completion.special({ type, cardId }, {
      pause: async () => { this.pause(); await Promise.allSettled(prior); },
      confirm: async message => {
        if (epoch !== this.epoch) return false;
        const approved = await confirm(message); return epoch === this.epoch && approved;
      }, now: this.now,
    }));
    if (epoch !== this.epoch) return;
    this.controller.resetCurrentStep();
    // A confirmed change invalidates this card's current selection; do not replay stale units.
    if (result.applied !== false) this.controller.skip();
    this.publish(); return result;
  }
}
