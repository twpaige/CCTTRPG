import { BrowserSpeech } from '../js/speech.js';
import { ReviewController } from '../js/review.js';
import { PREFERRED_VOICE, englishVoices, selectVoice, voiceKey, watchVoices } from '../js/voices.js';
import { sampleCards } from './sample.js';

const $ = id => document.getElementById(id);
const controls = ['start', 'pause', 'resume', 'stop', 'skip', 'restart'];
let voices = [];
let chosenKey = '';
let controller;
let voiceWatcher;
const log = [];

function record(event) {
  log.push({ timestamp: new Date().toISOString(), ...event });
  if (log.length > 200) log.shift();
  $('log').textContent = log.map(row => `${row.timestamp}  ${row.event}  card ${row.card} / step ${row.step}  ${row.phase}`).join('\n');
}

function render(state) {
  const busy = ['playing', 'paused', 'error'].includes(state.status);
  $('voice').disabled = busy || !voices.length;
  for (const id of ['recall', 'rate', 'passes', 'refresh']) $(id).disabled = busy;
  $('start').disabled = busy || !selectVoice(voices, chosenKey);
  $('pause').disabled = state.status !== 'playing';
  $('resume').disabled = !['paused', 'error'].includes(state.status);
  $('stop').disabled = !busy;
  $('skip').disabled = !busy;
  $('restart').disabled = !controller.settings;
  const labels = { idle: 'Ready', playing: { question: 'Speaking question', recall: 'Recall pause', answer: 'Speaking answer' }[state.phase],
    paused: 'Paused', stopped: 'Stopped', finished: 'Session complete', error: 'Speech needs attention' };
  $('status').textContent = labels[state.status];
  $('error').textContent = state.error;
  $('position').textContent = state.card ? `Card ${state.cardIndex + 1} of ${controller.cards.length}: ${state.card.name} · Step ${state.stepIndex + 1} of ${state.card.steps.length}` : 'All flashcards finished.';
  $('session-voice').textContent = state.voiceName ? `Session voice: ${state.voiceName}` : '';
  $('phase').textContent = state.phase === 'recall' ? 'Recall the answer before it is spoken' : `Current ${state.phase}`;
  $('text').textContent = state.step ? state.step[state.phase === 'answer' ? 'answer' : 'question'] : 'Review complete.';
}

function updateVoices({ voices: available, waiting }) {
  voices = englishVoices(available);
  const selected = selectVoice(voices, chosenKey);
  $('voice').replaceChildren(...voices.map(voice => {
    const option = document.createElement('option');
    option.value = voiceKey(voice);
    option.textContent = `${voice.name} (${voice.lang})${voice.localService ? ' — local service' : ' — may need network'}`;
    return option;
  }));
  if (selected) $('voice').value = voiceKey(selected);
  $('voice-status').textContent = selected
    ? `${selected.name === PREFERRED_VOICE ? 'Preferred voice' : 'English fallback / selection'}: ${selected.name}. Offline availability needs a listening test.`
    : waiting ? 'Waiting for English voices (up to 3 seconds)…' : 'No English voices found. Check Chrome/installed voices, then Refresh voices. Start is disabled.';
  render(controller.snapshot);
}

function start() {
  for (const id of ['recall', 'rate', 'passes']) if (!$(id).reportValidity()) return;
  const passes = Number($('passes').value);
  controller.cards = Array.from({ length: passes }, () => sampleCards).flat();
  controller.start({ voice: selectVoice(voices, chosenKey), recallMs: Number($('recall').value) * 1000, rate: Number($('rate').value) });
}

if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
  $('status').textContent = 'Speech synthesis is unavailable in this browser. Open this page in desktop Chrome.';
  $('voice-status').textContent = 'No Web Speech API.';
  $('refresh').disabled = true;
} else {
  controller = new ReviewController(sampleCards, new BrowserSpeech(window.speechSynthesis, window.SpeechSynthesisUtterance),
    { onChange: render, onEvent: record });
  voiceWatcher = watchVoices(window.speechSynthesis, updateVoices);
  $('voice').addEventListener('change', () => { chosenKey = $('voice').value; updateVoices({ voices, waiting: false }); });
  $('refresh').addEventListener('click', () => voiceWatcher.refresh());
  const actions = { start, pause: () => controller.pause(), resume: () => controller.resume(), stop: () => controller.stop(),
    skip: () => controller.skip(), restart: () => controller.restart() };
  for (const id of controls) $(id).addEventListener('click', () => {
    try { actions[id](); } catch (error) { $('error').textContent = error.message; }
  });
  window.addEventListener('pagehide', () => controller.stop());
}

$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ userAgent: navigator.userAgent, events: log }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sr-stage1-events.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
