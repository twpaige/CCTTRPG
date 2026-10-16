# SR Chime Laboratory — sound selection only

Temporary page: [Chime Laboratory](https://crownandcall.com/SR/chime-lab.html).

Stop REVIEW in other tabs before auditioning. Use a comfortable device/earbud volume. Each category has eight synthesized candidates: glass, wood, silver, two-note, marimba, wind, felt piano and electronic. The flashcard defaults are lower and longer, with only a small increase in level.

1. Press **Play** beside a candidate to audition it. This does not select it.
2. Select one radio button in each category. Adjust pitch, volume, sound length, fade-out, and silence before/after independently for each category. The settings apply to all candidates in that category.
3. **Compare selected sounds** plays the step cue, then the flashcard cue. **Test Listening Sequence** speaks a fixed two-step sample and the next flashcard's question, with a one-second recall pause before each answer.
4. **Stop** cancels speech, tones and pending silences. Another Play/Compare/Test cancels the previous audition first. Settings are frozen for the current audition; changes apply on the next Play/Test.
5. **Copy Selected Chime Settings** copies compact JSON with both candidate IDs and numeric parameters. Paste that into the conversation for later implementation. If clipboard access fails, copy the visible settings text manually. Reload resets laboratory selections.

The sample reads the existing device-local desktop voice and rate. Voice availability is checked at each utterance; unavailable voices fall back to an English/browser default without changing the saved preference. This page does not open IndexedDB, read flashcards, alter backups or award review credit. It has no production player hooks. No Android implementation or APK is included.

## Parameters

Pitch is the base frequency in Hz (220–660); volume is a bounded relative percentage (0–70). Duration and silence values are seconds. Decay is the portion of the sound devoted to fading (20–95%); higher values begin fading sooner. Synthesized sine partials have a short attack and a fade to zero. Partial and overlapping-note amplitudes are normalized; the maximum summed digital peak is bounded at 0.126. Device volume still determines actual listening loudness.

The copied format identifies the synthesis recipe as `sr-chime-lab-v1`. It is a selection note, not an SR backup/import format. Choices and adjustments are held only in page memory.

## Future transition rules — documentation only, pending approval

- Play the step cue between steps within a flashcard.
- At a flashcard boundary, the flashcard cue replaces the step cue. Never play both.
- Apply approved cues to automatic and manual navigation.
- Do not interrupt question or answer speech.
- Do not change recall timing, mastery or scheduling.
- Make cues optional through device-local preferences.
- Use equivalent approved sounds on desktop and Android.
- A cue indicates a transition, not a completed review or another learning event.

These rules are not integrated into REVIEW, AUDIT or Android. Owner sound selection and explicit integration authorization are still required.

## Verification

Run `node SR/tests/serve.mjs`, then `node SR/tests/chime-lab.mjs` with the same `SR_PLAYWRIGHT` and `SR_BROWSER` settings as the existing browser suites. `SR_TEST_URL` can point at the live SR URL.

The focused suite renders all 16 choices with real Chrome OfflineAudioContext, measures bounded non-silent output and silent tails, exercises real-time Web Audio lifecycle and cancellation, mocks speech/clipboard for deterministic sequence/preferences checks, blocks IndexedDB access, and checks a narrow layout and unsupported Web Audio. This is not an audible comfort/recognizability test. The owner should audition the sounds through their usual Bluetooth earbuds, compare them, test the listening sequence and send the copied settings.
