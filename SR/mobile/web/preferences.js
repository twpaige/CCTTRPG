export const KEY = 'sr.android.listening.v1';
export const defaults = { mode: 'REVIEW', seriesId: '', window: { type: 'days', days: 7 }, random: false, voiceName: '', rate: .9, recall: 4, quickListen: false };
export function normalize(value = {}) {
  return { mode: value.mode === 'AUDIT' ? 'AUDIT' : 'REVIEW', seriesId: typeof value.seriesId === 'string' ? value.seriesId : '',
    window: { type: ['now', 'days', 'max'].includes(value.window?.type) ? value.window.type : 'days',
      days: Number.isSafeInteger(value.window?.days) && value.window.days > 0 ? value.window.days : 7 },
    random: value.random === true, quickListen: value.quickListen === true, voiceName: typeof value.voiceName === 'string' ? value.voiceName : '',
    rate: Number.isFinite(value.rate) && value.rate >= .5 && value.rate <= 2 ? value.rate : .9,
    recall: Number.isFinite(value.recall) && value.recall >= 0 && value.recall <= Number.MAX_SAFE_INTEGER / 1000 ? value.recall : 4 };
}
export function readPreferences(storage) { try { return normalize(JSON.parse(storage.getItem(KEY) || '{}')); } catch { return normalize(); } }
export function savePreferences(storage, value) { storage.setItem(KEY, JSON.stringify(normalize(value))); }
