import { englishVoices, selectVoice, voiceKey } from './voices.js';
export const SPEECH_KEY = 'sr.desktop.speech.v1';
export function readSpeechPreferences(legacy = {}) {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(SPEECH_KEY)); } catch { /* Fall back safely. */ }
  const value = saved && typeof saved === 'object' ? saved : { voice: legacy.desktopVoice, rate: legacy.rate, recall: legacy.recallSeconds };
  const preferences = {
    voice: value.voice && typeof value.voice.name === 'string' && typeof value.voice.language === 'string' ? value.voice : null,
    rate: Number.isFinite(value.rate) && value.rate >= .5 && value.rate <= 2 ? value.rate : .9,
    recall: Number.isFinite(value.recall) && value.recall >= 0 && value.recall * 1000 <= Number.MAX_SAFE_INTEGER ? value.recall : 4,
    quickListen: value.quickListen === true
  };
  if (!saved) { try { saveSpeechPreferences(preferences); } catch { /* Playback still works without persistence. */ } }
  return preferences;
}
export function saveSpeechPreferences(value) { localStorage.setItem(SPEECH_KEY, JSON.stringify(value)); }
export function preferredVoice(voices, preferences) {
  const saved = preferences.voice;
  const match = englishVoices(voices).find(v => saved && v.name === saved.name && v.lang === saved.language && (!saved.voiceURI || v.voiceURI === saved.voiceURI));
  return selectVoice(voices, match ? voiceKey(match) : '');
}
