# SR Stage 1 — Test results and Windows verification

Date: 2026-10-12 (America/Chicago). Scope: **Stage 1 only**.

**G1 acceptance status: BLOCKED — awaiting owner desktop Chrome/audible verification.**

Implementation and available automated testing are complete. The production controller/speech adapter pass the tests below. No audible test, Chrome-rendered test run, or 30-minute browser session is claimed as passed. Do not advance to Stage 2 based on these results. The owner explicitly authorized restarting an interrupted utterance on Resume; this implementation uses that behavior consistently.

## Files

All additions are under `SR/`; no dependencies or framework were installed.

| File | Purpose |
|---|---|
| `poc/speech.html` | Working desktop speech proof page |
| `poc/speech.css` | Small responsive stylesheet |
| `poc/speech-page.js` | UI wiring, controls, voice selection, bounded timestamped log |
| `poc/sample.js` | Three in-memory cards, containing 1, 2 and 6 steps |
| `js/voices.js` | Preferred/English fallback selection and asynchronous voice discovery |
| `js/speech.js` | Native Web Speech adapter with settle-once completion/cancellation |
| `js/review.js` | Sequential question/recall/answer controller and controls |
| `tests/suite.js` | Dependency-free fake-speech/clock tests using the production modules |
| `tests/run.mjs` | Node command-line runner, nonzero exit on failure |
| `tests/runner.html`, `tests/runner.js` | Same silent suite in a browser |
| `tests/serve.mjs` | Localhost-only static development server, using Node built-ins |
| `docs/TEST_RESULTS.md` | This evidence, manual checklist and opening instructions |

Preserved: `SPECIFICATION.md`, `BUILD_PLAN.md`, and `Joshua18.html`. No storage, authoring, mastery, scheduling, Android bridge, service worker, synchronization, or later-stage application code was added. The simple static development server is only for opening ES modules locally; it is not an application backend.

## Automated results

Executed on Windows with Node **v24.19.0** from the repository root:

```powershell
node SR/tests/run.mjs
```

Result: **33/33 tests passed, exit code 0**. No speech was produced by this suite. It uses a fake synthesis service that deliberately does not emit completion on cancellation, and a controllable monotonic clock. The real `BrowserSpeech`, `ReviewController` and voice-selection/discovery modules are imported; application behavior is not reimplemented in the tests.

Coverage:

- All nine sample steps in all three cards, correct question/end/recall/answer/end sequence and automatic card progression.
- Recall begins only after the actual completion callback, including zero-length recall.
- Stop during question, recall and answer; all timers/active speech references are cleared.
- Pause/Resume during both speech phases; the interrupted utterance repeats, with no simulated overlap.
- Recall remainder survives multiple pauses; paused time does not consume recall time.
- Whole-card Skip during speech/recall; Skip while paused stays paused; skipping the last card finishes.
- Restart from question/recall/answer/paused states; repeated Start does not create another session.
- Twenty rapid Stop/Restart cycles; no stale active action or surviving timer after Stop.
- Late callbacks from an old utterance cannot advance or cancel a new session.
- Stop between native completion and its JavaScript promise continuation.
- Speech error and same-answer retry; synchronous `speak()` exception; missing callback watchdog; duplicate completion callbacks.
- Concurrent adapter calls rejected; already-aborted signals produce no speech.
- Voice/rate/pitch/volume wiring, session-setting snapshot, and invalid settings.
- Preferred voice, explicit selection, UK/other-English fallbacks, no-English inventory.
- Empty initial inventory, asynchronous `voiceschanged`, three-second discovery wait, late voices and listener disposal.

Local HTTP checks returned **200** with appropriate MIME types for the page, stylesheet, sample, production modules and browser test-runner modules. This verifies local serving, **not browser execution or sound**. Source review confirmed one pending playback action at a time, cancellable waits, bounded diagnostic output, and no additional packages or speculative later-stage scaffolding.

## Browser/manual evidence available here

| Check | Result / evidence |
|---|---|
| Browser connector access to Chrome | BLOCKED: connector reported “Browser is not available: chrome” |
| Installed Chrome discovery through Computer Use | Chrome was found, with an existing minimized Joshua 1:8 window |
| Chrome page/UI inspection | BLOCKED: Computer Use ended because it could not determine the current browser URL confidently enough to enforce policy; no further app input attempted |
| Browser execution of the 33 tests | NOT RUN; owner must open the browser runner |
| Voice inventory/preferred voice on the owner's Chrome | NOT VERIFIED |
| Audible ordering, cancellation and fallback voice | NOT RUN |
| Thirty-minute run, hidden-tab behavior and offline local voice | NOT RUN |

No browser version, voice availability, audible success or graphical UI approval is inferred from installed-app discovery. There are no known failing automated tests; G1 remains blocked on the empirical checks below.

## Open and test on Windows

The source page is `SR/poc/speech.html`. Do **not** double-click it as a `file://` page; ES module loading should use HTTP.

1. Open PowerShell in your CCTTRPG checkout, on `main`. If using the checkout from this chat, its current location is:

   ```powershell
   Set-Location 'C:\Users\tpaig\Documents\Codex\2026-10-12\files-pasted-by-the-user-dex\work\CCTTRPG'
   ```

   For a different checkout, use its actual root folder instead. Obtain these committed Stage 1 files with your normal Git update; do not overwrite unrelated local edits.

2. Start the static server and leave that PowerShell window running:

   ```powershell
   node SR/tests/serve.mjs
   ```

   If `node` is not on PowerShell's PATH, the runtime used in this environment is:

   ```powershell
   & 'C:\Users\tpaig\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' SR/tests/serve.mjs
   ```

   This command installs nothing. Node 22 or newer is recommended for the same `.js` ES-module detection used by the command-line tests. If the bundled runtime is absent, use an existing compatible Node installation. If port 8765 is already in use, first check whether the existing SR server is already serving the links below; otherwise stop that known server before retrying. Do not terminate an unknown process.

3. In **desktop Google Chrome**, open [the speech page](http://127.0.0.1:8765/poc/speech.html). The server's root is `SR/`, so the local URL intentionally omits `/SR`.
4. In a second tab, open [the silent automated tests](http://127.0.0.1:8765/tests/runner.html). Expect “33/33 passed.” If it says Running indefinitely, open Chrome Developer Tools → Console and record the loading/error message. These tests should make no sound.
5. Return to the speech page. Confirm the selected English voice. Defaults are 4-second recall, rate 0.9, pitch/volume 1, one pass. Press Start once. Close the test tab if it distracts; keep only **one copy of the speech page** open.
6. Stop narration before closing the page. To stop the local server, press Ctrl+C in its PowerShell window. The page also cancels its own session on `pagehide`.

Repository links: [speech source](https://github.com/twpaige/CCTTRPG/blob/main/SR/poc/speech.html), [browser test source](https://github.com/twpaige/CCTTRPG/blob/main/SR/tests/runner.html). GitHub's source viewer does not execute the page. No separate hosting/deployment configuration was changed.

## Owner manual checklist required to close G1

Record Windows and Chrome versions, selected voice and its local-service label, recall/rate settings, date/time, observations and any error. Use the Event log disclosure and Download event log after a failure; it retains only the latest 200 events and resets on reload.

| ID | Procedure | Expected result | Status |
|---|---|---|---|
| M1 | Open the browser test runner | 33/33 pass with no console errors | Required |
| M2 | Open speech page; inspect voice selection, then Refresh voices | Google UK English Male selected if present; otherwise explicit English fallback; controls become usable when voices load | Required |
| M3 | Start one pass; do not interact until completion | All 3 cards / 9 steps / 18 utterances in order; each question ends before its pause, then answer; no extra gesture, reload or overlapping audio | Required |
| M4 | Set recall to 10 seconds; Pause about 3 seconds into a recall; wait about 5 seconds; Resume | About 7 seconds of recall remain before the answer, allowing human timing tolerance | Required |
| M5 | Pause while a question is spoken, then Resume; repeat during an answer | Silence while paused; that question/answer restarts from its beginning, then proceeds normally | Required |
| M6 | Stop during a question, an answer, and a recall pause; wait at least 10 seconds each time | Immediate practical silence, no later narration, status stays Stopped | Required |
| M7 | Skip from each playback phase on the multi-step President card; repeat while paused | Entire current card skipped; no remaining steps spoken; paused Skip remains paused (last card finishes) | Required |
| M8 | Restart during speech, recall, and while paused | Old work cancels; starts again at card 1, step 1, with the previous session's settings | Required |
| M9 | Rapidly press available Start/Pause/Resume/Stop/Skip/Restart controls; include 20 Stop/Restart cycles | No overlapping voices, delayed old answers, orphan narration or frozen controls; disabled controls are deliberately ignored | Required |
| M10 | Select a different English voice (prefer a “local service” voice), then Start | Actual audible voice matches the displayed session voice; fallback/selection is clear | Required |
| M11 | With a local-service English voice selected and page already open, disconnect networking using your normal method and Start one pass | Dynamic speech and complete progression work without network; restore connectivity afterward. A local-service label alone is not a pass | Required |
| M12 | Set Sample passes to 30; run for at least 30 minutes, backgrounding the tab for at least 5 minutes and exercising controls | Continuous progression with no unexplained stalls/overlap; no per-question interaction. Record pauses/delays in a hidden tab; if it stalls, G1 fails pending investigation | Required |
| M13 | Use Tab/Shift+Tab and Enter/Space for controls; resize the browser | Settings, status and controls remain readable/reachable; no keyboard trap | Required |

For M12, run both the preferred voice (if available) and a local English fallback long enough to establish the behavior, with at least one uninterrupted 30-minute session. Sample passes are finite and require no repeat clicks between passes. Start is disabled while paused; use Resume. Restart repeats the frozen session settings; use Stop, edit settings, then Start to apply new settings.

A missing preferred Google voice is acceptable if an explicit working English fallback is verified. Record that the preferred path was unavailable rather than calling it passed. If no English voice is available, Start stays disabled with guidance. Testing an actually missing voice/error condition may require a different browser profile/device; the synthetic cases are covered by the suite, but do not claim a real error scenario was exercised unless it was.

After these checks, record PASS or FAIL for each applicable item and the final G1 decision. **Only the necessary observed audible/browser evidence can change G1 to PASS.** A failure should include the phase, voice, exact controls, event log and whether the tab was hidden/offline. Stage 2 still needs separate authorization even after G1 passes.

## Known limits and control contract

- This is an in-memory speech proof, not a personal library application. Reload resets everything. No persisted settings or data.
- Resume consistently replays the current utterance; it does not attempt exact mid-word continuation. This is permitted by the Stage 1 assignment and avoids reliance on browser pause quirks.
- Recall time is configurable from 0–120 seconds; rate from 0.5–2.0. These are proof-page settings, not future product limits. Empty/invalid numeric inputs are rejected before Start.
- A 120-second **speech** watchdog stops a missing callback with a visible error and never invents completion. It is adequate for these short sample utterances; long-passage tuning is later work. Resume retries the failed utterance, Skip advances a whole card, Stop cancels, Restart begins again.
- Preferred Google and other remote voices may need network. An installed local voice must be tested offline. No external speech service or substitute engine is called by application code; all speech uses browser `speechSynthesis`.
- Tests prove JavaScript behavior with fakes, not real Chrome's audible cancellation latency, hidden-tab timing, voice quality or offline availability. System sleep, Android/locked-phone operation, and cross-tab coordination are not certified in Stage 1. Keep one speech page open.
- Diagnostic speech “requested” entries precede the native call; they are not evidence that sound started. “Ended” entries reflect native completion callbacks. Timers/listeners are released on completion or cancellation, and event-log memory is capped at 200 entries.
- No Windows/browser security settings, permissions, installed engines or network settings were changed for testing.

## Future action-plan boundary — design note only

The Stage 1 engine executes each step as speak(question) → wait(recall milliseconds) → speak(answer), with a card/step cursor and cancellable operation generation. A possible future serialized plan would contain a session ID and ordered card units with `speak {text}` / `wait {milliseconds}` actions and stable unit IDs; controls would be Start/Pause/Resume/Skip-unit/Stop and completion/error notifications. Learning/scheduling rules would stay in JavaScript. This is only the Stage 1 contract sketch requested by the plan: no Android module, native code or Stage 2 experiment is included.
