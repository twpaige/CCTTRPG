import { sampleCards } from './shared/sample.js';
import { buildPlaybackPlan } from './shared/playback-plan.js';
const $ = id => document.getElementById(id);
const native = window.SRNative;
let inventory = '', polling, probeActive = false, probeTimer, probeUtterance;
const webSpeech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
function probeStatus(message = '') {
  const count = webSpeech ? speechSynthesis.getVoices().length : 0;
  $('web-speech').textContent = `speechSynthesis: ${webSpeech ? 'present' : 'absent'}; voices: ${count}. ${message}`;
}
function cancelProbe() { clearTimeout(probeTimer); if (probeUtterance) { probeUtterance.onend = null; probeUtterance.onerror = null; } if (webSpeech) speechSynthesis.cancel(); probeActive = false; probeUtterance = null; }
function refresh() {
  if (!native) { $('error').textContent = 'Open this page inside the Android APK.'; return; }
  const state = JSON.parse(native.status());
  $('platform').textContent = `Android ${state.android}; WebView ${state.webview}`;
  $('voice-message').textContent = state.voiceMessage;
  const next = JSON.stringify(state.voices);
  if (next !== inventory) {
    inventory = next; const selected = $('voice').value;
    $('voice').replaceChildren(new Option('Automatic offline English selection', ''), ...(state.voices || []).map(v => new Option(`${v.name} (${v.language})`, v.name)));
    if ([...$('voice').options].some(v => v.value === selected)) $('voice').value = selected;
  }
  const busy = state.serviceRunning;
  for (const id of ['start', 'voice', 'refresh', 'recall', 'rate', 'passes']) $(id).disabled = busy || probeActive;
  for (const id of ['pause', 'resume', 'skip', 'restart', 'stop']) $(id).disabled = !busy;
  $('pause').disabled = !busy || !['playing', 'initializing'].includes(state.status);
  $('resume').disabled = !busy || !state.ready || !['paused', 'error'].includes(state.status);
  $('skip').disabled = $('restart').disabled = !busy || !state.ready;
  $('probe').disabled = busy || probeActive || !webSpeech;
  $('status').textContent = `${state.status} ${state.card || ''} ${state.action || ''} ${state.voice || ''}`;
  $('error').textContent = [state.bridgeError, state.message].filter(Boolean).join(' ');
  $('current').textContent = state.text || '';
  $('evidence').textContent = JSON.stringify({ ...state, userAgent: navigator.userAgent, webSpeechPresent: webSpeech, webSpeechVoices: webSpeech ? speechSynthesis.getVoices().map(v => v.name) : [] }, null, 2);
}
$('start').onclick = () => {
  if (!native) return;
  for (const id of ['recall', 'rate', 'passes']) if (!$(id).reportValidity()) return;
  try {
    cancelProbe();
    native.start(JSON.stringify(buildPlaybackPlan(sampleCards, { recallMs: Number($('recall').value) * 1000,
      rate: Number($('rate').value), passes: Number($('passes').value), voiceName: $('voice').value })));
    $('start').disabled = true;
  } catch (error) { $('error').textContent = error.message; }
};
for (const id of ['pause', 'resume', 'skip', 'restart', 'stop']) $(id).onclick = () => { native?.command(id.toUpperCase()); refresh(); };
$('refresh').onclick = () => native?.refresh();
$('probe').onclick = () => {
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(v => /^en(?:-|_)/i.test(v.lang));
  if (!voice) { probeStatus('No English voice to test. Use native playback.'); return; }
  probeActive = true; refresh();
  probeUtterance = new SpeechSynthesisUtterance(sampleCards[0].steps[0].question);
  probeUtterance.voice = voice;
  const finish = message => { cancelProbe(); probeStatus(message); refresh(); };
  probeUtterance.onend = () => finish('Completion event received; audible output still needs your confirmation.');
  probeUtterance.onerror = event => finish(`Speech error: ${event.error}`);
  probeTimer = setTimeout(() => finish('No completion within 15 seconds.'), 15000);
  speechSynthesis.speak(probeUtterance);
};
if (webSpeech) speechSynthesis.addEventListener('voiceschanged', () => probeStatus());
function updatePolling() { clearInterval(polling); if (!document.hidden) { refresh(); polling = setInterval(refresh, 1000); } }
document.addEventListener('visibilitychange', updatePolling);
window.addEventListener('pagehide', () => { clearInterval(polling); cancelProbe(); });
probeStatus(); updatePolling();
