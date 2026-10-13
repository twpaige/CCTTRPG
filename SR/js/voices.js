export const PREFERRED_VOICE = 'Google UK English Male';

export const voiceKey = voice => JSON.stringify([voice.voiceURI, voice.name, voice.lang]);
export const englishVoices = voices => voices.filter(voice => /^en(?:[-_]|$)/i.test(voice.lang));

export function selectVoice(voices, selectedKey = '') {
  const english = englishVoices(voices);
  return english.find(voice => voiceKey(voice) === selectedKey)
    || english.find(voice => voice.name === PREFERRED_VOICE)
    || english.find(voice => /^en[-_]GB$/i.test(voice.lang))
    || english[0]
    || null;
}

// Listen before the first read: Chrome can populate its inventory asynchronously.
export function watchVoices(synth, update, clock = globalThis) {
  let timer;
  let expired = false;
  const read = () => {
    const voices = synth.getVoices();
    update({ voices, waiting: !englishVoices(voices).length && !expired });
  };
  const refresh = () => {
    clock.clearTimeout(timer);
    expired = false;
    timer = clock.setTimeout(() => { expired = true; read(); }, 3000);
    read();
  };
  synth.addEventListener('voiceschanged', read);
  refresh();
  return {
    refresh,
    dispose() {
      clock.clearTimeout(timer);
      synth.removeEventListener('voiceschanged', read);
    },
  };
}
