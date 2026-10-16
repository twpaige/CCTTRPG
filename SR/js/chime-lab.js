import { candidates, defaults, controls, scheduleTone } from './chime-tones.js';
import { readSpeechPreferences, preferredVoice } from './speech-preferences.js';

const $ = id => document.getElementById(id);
const selected = structuredClone(defaults);
const Audio = window.AudioContext || window.webkitAudioContext;
let context, active, activeUtterance;
const cancelled = () => new DOMException('Stopped', 'AbortError');
function check(signal) { if (signal.aborted) throw cancelled(); }
function wait(seconds, signal) {
  check(signal);
  return new Promise((resolve, reject) => {
    const finish = () => { signal.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(finish, seconds * 1000);
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(cancelled()); };
    signal.addEventListener('abort', abort, { once: true });
  });
}
function stop() {
  active?.abort();
  active = null;
  $('status').textContent = 'Stopped.';
}
function settingsJSON() { return JSON.stringify({ version: 1, synthesis: 'sr-chime-lab-v1', ...selected }); }
function display() { $('selected').textContent = settingsJSON(); }
async function tone(settings, signal) {
  await wait(settings.before, signal);
  check(signal);
  const cleanup = scheduleTone(context, context.destination, settings);
  signal.addEventListener('abort', cleanup, { once: true });
  try { await wait(settings.duration, signal); }
  finally { signal.removeEventListener('abort', cleanup); cleanup(); }
  await wait(settings.after, signal);
}
function speak(text, preferences, signal) {
  check(signal);
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    activeUtterance = utterance; // Keep Chrome speech alive until end/error/cancellation.
    const voice = preferredVoice(speechSynthesis.getVoices(), preferences);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-US';
    utterance.rate = preferences.rate;
    let timer;
    const finish = error => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      utterance.onend = utterance.onerror = null;
      if (activeUtterance === utterance) activeUtterance = null;
      if (error) reject(error); else resolve();
    };
    const abort = () => { finish(cancelled()); speechSynthesis.cancel(); };
    utterance.onend = () => finish();
    utterance.onerror = event => finish(new Error('Sample speech failed: ' + event.error));
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { finish(new Error('Sample speech timed out. Please try again.')); speechSynthesis.cancel(); }, 60000);
    try { speechSynthesis.speak(utterance); }
    catch (error) { finish(error); speechSynthesis.cancel(); }
  });
}
async function play(label, task) {
  stop();
  $('error').textContent = '';
  if (!Audio) return;
  const controller = new AbortController();
  active = controller;
  $('status').textContent = label;
  try {
    context ||= new Audio();
    await context.resume();
    check(controller.signal);
    await task(controller.signal);
    if (active === controller) $('status').textContent = 'Finished. Ready to compare again.';
  } catch (error) {
    if (!controller.signal.aborted) {
      $('error').textContent = error.message;
      $('status').textContent = 'Unable to finish. Try another sound or Stop.';
    }
  } finally { if (active === controller) active = null; }
}
for (const kind of ['step', 'card']) {
  const section = document.createElement('section');
  section.setAttribute('aria-label', kind === 'step' ? 'Step chimes' : 'Flashcard chimes');
  section.innerHTML = '<h2>' + (kind === 'step' ? '1. Step chime' : '2. Flashcard chime') + '</h2><p class="note">' +
    (kind === 'step' ? 'Short and light · within one flashcard' : 'Lower and longer · moving to a new flashcard') + '</p>';
  for (const candidate of candidates) {
    const row = document.createElement('div');
    row.className = 'candidate';
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = kind; radio.value = candidate.id;
    radio.checked = selected[kind].id === candidate.id;
    radio.setAttribute('aria-label', 'Select ' + candidate.name + ' for ' + kind);
    radio.onchange = () => { selected[kind].id = candidate.id; display(); };
    label.append(radio, candidate.name);
    const button = document.createElement('button');
    button.textContent = 'Play';
    button.dataset.audio = '';
    button.setAttribute('aria-label', 'Play ' + candidate.name + ' ' + kind + ' chime');
    button.onclick = () => {
      const settings = { ...selected[kind], id: candidate.id };
      play('Playing ' + candidate.name + ' · ' + kind, signal => tone(settings, signal));
    };
    row.append(label, button); section.append(row);
  }
  const adjustments = document.createElement('div');
  adjustments.className = 'adjustments';
  for (const [key, title, min, max, step, unit] of controls) {
    const label = document.createElement('label');
    const output = document.createElement('output');
    const input = document.createElement('input');
    input.type = 'range'; input.id = kind + '-' + key;
    input.min = min; input.max = max; input.step = step; input.value = selected[kind][key];
    output.htmlFor = input.id; output.textContent = input.value + unit;
    input.oninput = () => { selected[kind][key] = Number(input.value); output.textContent = input.value + unit; display(); };
    label.append(title + ': ', output, input); adjustments.append(label);
  }
  section.append(adjustments); $('choices').append(section);
}
$('stop').onclick = stop;
$('compare').onclick = () => {
  const snapshot = structuredClone(selected);
  play('Comparing step, then flashcard…', async signal => {
    await tone(snapshot.step, signal);
    await wait(.4, signal);
    await tone(snapshot.card, signal);
  });
};
$('sequence').onclick = () => {
  const snapshot = structuredClone(selected);
  const preferences = readSpeechPreferences();
  play('Sample listening sequence…', async signal => {
    await speak('What is the capital of France?', preferences, signal);
    await wait(1, signal);
    await speak('Paris.', preferences, signal);
    await tone(snapshot.step, signal);
    await speak('Which river flows through Paris?', preferences, signal);
    await wait(1, signal);
    await speak('The Seine.', preferences, signal);
    await tone(snapshot.card, signal);
    await speak('Next flashcard. What is the capital of Japan?', preferences, signal);
  });
};
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(settingsJSON()); $('status').textContent = 'Selected settings copied.'; }
  catch { $('error').textContent = 'Clipboard unavailable. Select and copy the settings text below manually.'; }
};
display();
if (!Audio) {
  document.querySelectorAll('[data-audio]').forEach(button => { button.disabled = true; });
  $('error').textContent = 'Web Audio is unavailable in this browser. Open this page in desktop Chrome to audition sounds.';
} else if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
  $('sequence').disabled = true;
  $('error').textContent = 'Browser speech is unavailable. You can still audition and compare chimes.';
}
window.addEventListener('pagehide', stop);
