# SR — Stage 1 and Stage 2 test results

## Owner verification update — 2026-10-13

The owner personally tested the live desktop page and the installed Samsung Android application on October 12–13, 2026. This section supersedes the **historical pending-owner statements** below; the original automated evidence and detailed checklists remain for traceability.

**Current assessment:**
- **G1: Core desktop speech and >30-minute minimized-window reliability PASS (owner-observed).** Formal full-checklist closure remains **OPEN** for items not explicitly verified, including offline desktop voice, exact recall-pause remainder, keyboard access, and browser test-runner execution.
- **G2: Core Android listening feasibility PASS (owner-observed).** Screen locked, app backgrounded, USB disconnected, Bluetooth headphones, offline operation and notification controls all worked. Formal full G2 remains **OPEN** until the two explicitly timed 30-minute locked-screen sessions (at least one offline) and remaining interruption/rapid-control checks are evidenced.
- **Stage 2.5: Cloud build/sign/publish and first phone update PASS.** Prior diagnostic journal preservation has not yet been explicitly confirmed; the owner confirmed installed version and successful post-update narration. A second successive cloud update is not yet tested.

### Stage 1 — desktop owner observations

The owner used the live page at `https://crownandcall.com/SR/poc/speech.html` in Chrome for **more than 30 minutes**, with the browser minimized for most of the run. Questions, recall pauses, answers and automatic progression worked. The owner exercised Pause, Resume, Stop, Restart and changing voices; reported no stalls or overlapping narration. These observations support M2/M3/M10 and the principal M12 reliability objective, plus general operation of controls M5/M6/M8. The precise phase-by-phase, rapid-cycle and timing subcases M4/M7/M9 were not individually documented; M1/M11/M13 were not reported.

### Stage 2 — physical Samsung owner observations

Device: **Samsung SM-S931U**, installed as **SR Speech Proof**. The owner observed:
- **A2/A3 PASS for ordinary use:** Android native dynamic TTS spoke the three-card sample with question → pause → answer → automatic progression. Voice selection displayed about ten options; the owner selected and liked an alternate voice.
- **A8/A12 PASS for observed conditions:** Playback continued over **Bluetooth headphones** after minimizing the app, disconnecting USB, locking the screen and putting the phone in a pocket.
- **A9 PASS via equivalent connectivity-off method:** With both Wi-Fi **and mobile data disabled**, Bluetooth remained connected and speech continued. Airplane Mode itself was deliberately not used; do not imply it was.
- **A14 PASS for observed controls:** Lock-screen notification Pause, Resume, Skip and Stop worked; Stop removed the notification.
- **A5/A6 partial:** Stop and Skip worked in ordinary use; exhaustive question/answer/recall-phase tests and Restart on Android were not individually reported.
- **A1, A4's exact recall remainder, A7, A10, A11, A13 and process-death portion of A15:** Not fully documented. Do not infer these from ordinary playback success.

### Stage 2.5 — signing and update observations

- The owner imported the original debug signing key into password-protected `D:\SR-Signing\SR-signing.p12` under alias `sr-personal`, verified **PrivateKeyEntry** and matching SHA-256 certificate fingerprint `ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb`, and configured four GitHub Actions secrets plus the certificate-fingerprint variable. No secret contents were provided in chat.
- [GitHub Actions run 38340835846](https://github.com/twpaige/CCTTRPG/actions/runs/38340835846): **build SUCCESS; publish SUCCESS**. The signed release asset was published as `sr-android-100201/SR.apk`.
- The owner downloaded the APK directly on the Samsung, overcame the device's Auto Blocker installation restriction, and installed the update **without uninstalling the existing app**. Android App info showed version **0.2.100201**. The owner confirmed audio playback still worked after updating.
- **Not yet verified:** persistence of pre-update Device evidence completion entries and a second higher-version GitHub-to-GitHub update. The original Stage 2.5 "no signed release" statements below are historical and no longer current.
- Signing key backup currently on D:; a second independent encrypted off-device backup is still recommended.

No Stage 3 implementation is implied by these observations.

---

## Original gate status at initial implementation (2026-10-12)

- **G1: BLOCKED / open.** The owner reports successful Chrome narration, automatic progression and playback controls in the Stage 2 assignment. The 30-minute desktop reliability test is still underway. This owner report is evidence for those reported behaviors, not a claim that every detailed checklist item below was performed.
- **G2: BLOCKED.** Stage 2 implementation and automated evidence are recorded separately below; physical Android installation and acceptance tests remain required.
- The owner explicitly authorized Stage 2 in parallel with open G1. No Stage 3 or later work is authorized or implemented.

# Stage 1 — original implementation evidence and Windows verification

Date: 2026-10-12 (America/Chicago). Scope: **Stage 1 only**.

**Historical G1 status at initial delivery: BLOCKED.** See owner verification update above.

Implementation and available automated testing are complete. The production controller/speech adapter pass the tests below. The following environment evidence and checklist describe the original Stage 1 delivery; the owner's later report is recorded above. No 30-minute browser session is claimed as passed. Stage 2 proceeded under the owner's explicit parallel-work authorization, not a completed G1. The owner explicitly authorized restarting an interrupted utterance on Resume; this implementation uses that behavior consistently.

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

## Stage 1 action-plan boundary — historical design note

The Stage 1 engine executes each step as speak(question) → wait(recall milliseconds) → speak(answer), with a card/step cursor and cancellable operation generation. Its proposed serialized boundary contained a session ID and ordered card units with `speak {text}` / `wait {milliseconds}` actions and stable unit IDs. Stage 1 added no Android code. Stage 2 below implements that boundary without modifying the desktop application.

# Stage 2 — Android speech and locked-screen proof

Date: 2026-10-12 (America/Chicago). **Historical G2 status at initial delivery: BLOCKED.** See owner verification update above. Implementation scope is the fixed-sample proof only.

## Files created or modified

| Path under `SR/` | Purpose |
|---|---|
| `js/playback-plan.js` | Shared JavaScript question/recall/answer sequencing, passes and plan validation |
| `mobile/settings.gradle`, `build.gradle`, `gradle.properties` | Minimal Android build configuration |
| `mobile/gradlew`, `gradlew.bat`, `gradle/wrapper/*` | Official Gradle 8.11.1 wrapper, pinned distribution checksum |
| `mobile/.gitignore` | Exclude local SDK/JDK, caches, APK/build outputs, machine settings and keys |
| `mobile/app/build.gradle` | Android app and automatic packaging of shared sample/CSS/plan assets |
| `mobile/app/src/main/AndroidManifest.xml` | Launcher, private foreground playback service, required platform permissions |
| `mobile/app/src/main/java/com/crownandcall/srproof/MainActivity.java` | Local WebView, bounded JS bridge, voice inventory and notification permission |
| `mobile/app/src/main/java/com/crownandcall/srproof/Plan.java` | Native validation of serialized action plans |
| `mobile/app/src/main/java/com/crownandcall/srproof/PlaybackEngine.java` | Platform-independent native action executor and cancellation tokens |
| `mobile/app/src/main/java/com/crownandcall/srproof/PlaybackService.java` | Dynamic native TTS, completion callbacks, recall timers, focus, notification controls, wake lock and completion journal |
| `mobile/web/index.html`, `mobile.js` | Small sample UI, actual WebView speech probe and diagnostic display |
| `mobile/tests/plan.test.mjs` | Shared plan and unchanged desktop/native sequence parity tests |
| `mobile/tests/PlaybackEngineTest.java`, `run-native.ps1` | Framework-free production executor tests and Windows runner |
| `docs/ANDROID_SETUP.md` | Windows Studio/SDK/JDK/USB/build/install/update instructions and device checklist |
| `docs/TEST_RESULTS.md` | This gate evidence and owner report update |

`SPECIFICATION.md`, `BUILD_PLAN.md`, `Joshua18.html` and all Stage 1 application/test files are preserved. There is no editor, IndexedDB, mastery/scheduling implementation, prerecorded audio, server or cloud TTS dependency. The bounded completion journal is diagnostic evidence only. All new project files remain under `SR/`; no repository publishing configuration changed.

The build plan's proposed Capacitor wrapper was simplified to a plain WebView with one local bridge and the same JavaScript-defined plan/native foreground-service execution model. See the explicit decision and platform references in [ANDROID_SETUP.md](ANDROID_SETUP.md). No third-party runtime library or new TTS engine is bundled. This is a candidate route pending device evidence, not a claim that WebView's API was tested on a phone.

## Automated and build evidence

Executed with Node v24.19.0 and portable OpenJDK 17.0.20.1. SDK 35's official platform archive was used for the Android API compilation check. Development tools/caches are ignored under `mobile/.tools/`; global Java settings were not changed.

| Test | Status | Evidence |
|---|---|---|
| Stage 1 regression suite | PASS | `node SR/tests/run.mjs`: 33/33, exit 0 |
| Shared JavaScript action plans | PASS | `node SR/mobile/tests/plan.test.mjs`: 6/6, exit 0 |
| Production native executor | PASS | `SR/mobile/tests/run-native.ps1 -Jdk <JDK17>`: 16/16, exit 0 |
| Android API source compilation | PASS | All four production Java classes compile against SDK 35 `android.jar`; only a deprecated API note |
| APK packaging | PASS | Gradle 8.11.1 / AGP 8.9.2 `assembleDebug`: BUILD SUCCESSFUL; bundled HTML, JavaScript, shared sample and CSS present |
| Android lint | PASS | `lintDebug`: 0 errors; reviewed warnings for intentionally enabled JavaScript and Android 12+ data-extraction rules |
| Debug APK signature | PASS | SDK `apksigner verify --verbose`: verifies, APK Signature Scheme v2, one signer |
| Physical installation/runtime | BLOCKED | No owner phone connected or tested in this session |

The shared-plan suite checks all three cards/27 actions, question → recall → answer ordering, unique IDs across passes, invalid input, unchanged samples, and sequence parity with the real Stage 1 controller. The 16 native cases cover sequential completion without JavaScript callbacks, all cards/steps, speech and recall Pause/Resume, Stop during speech/recall/answer, partial-card non-completion, whole-card Skip, paused Skip, Restart with stale waits, 20 rapid cycles, stale error callbacks, duplicate completion, explicit retry after error, interruption pause behavior, initially paused preparation, journal failure and zero/long recall.

These tests use fake speech, clocks and host resources. They do **not** exercise Android's actual TTS service, audio-focus implementation, Bluetooth routing, foreground-service lifecycle, wake locks or power management. Source compilation is not an APK/device test. Notification controls and phone cleanup remain manual acceptance items.

The debug APK was produced locally at `SR/mobile/app/build/outputs/apk/debug/app-debug.apk`. It is an ignored build output, not committed to Git. The development SDK contains platform 35 and Build-Tools 35.0.0; Platform-Tools/adb is not installed here, and Gradle reported that package's license was not accepted. That warning did not prevent APK packaging. No SDK license was accepted on the owner's behalf. The owner setup guide installs Platform-Tools through Studio and asks the owner to review its terms. The first build invocation had a PowerShell argument-quoting error; correcting the quoted Gradle property produced the successful build above.

Local verified APK SHA-256: `c07eace7e147ae329316b9cafb4555a69b3cbdb18e2c6fa366483f3c0cc17f8f`. A build on the owner's computer may differ, including its debug signature.

## Manual results and remaining evidence

No Android physical-device test was performed by the agent. Follow the numbered Windows instructions in [ANDROID_SETUP.md](ANDROID_SETUP.md), then record observations for these matching checklist IDs. PASS requires observation, FAIL requires an observed failure, and BLOCKED here means not performed because the owner/device is needed.

| IDs | Test | Status | Remaining evidence |
|---|---|---|---|
| A1 | Actual WebView speech API availability | BLOCKED | API presence/absence, voices, optional audible probe; Android/WebView versions |
| A2 | Native TTS initialization and voice selection | BLOCKED | Engine/voice identity, audible selection, missing-voice behavior where reproducible |
| A3 | Question/recall/answer/next-step/next-card | BLOCKED | Full hands-free audible sample pass |
| A4 | Pause/Resume during speech and recall | BLOCKED | Repeated utterance and remaining recall interval |
| A5 | Stop during speech and recall | BLOCKED | Silence, no delayed action, service/notification cleanup |
| A6 | Skip and Restart | BLOCKED | Whole-card skip and restart without stale speech |
| A7 | Rapid controls / overlapping sessions | BLOCKED | 20 physical control cycles without overlap/stalls |
| A8 | Bluetooth routing with screen locked | BLOCKED | Audio heard in actual paired earbuds/headset |
| A9 | Offline speech | BLOCKED | Fresh session in airplane mode with local voice and Bluetooth |
| A10 | Incoming call / competing audio | BLOCKED | Pause on focus loss; explicit Resume afterward |
| A11 | Bluetooth disconnect/reconnect | BLOCKED | Pause on disconnect, no unexpected speaker speech or auto-resume |
| A12 | App backgrounding and locking | BLOCKED | Progress without a visible WebView; no duplicate session on reopening |
| A13 | Long locked-screen reliability | BLOCKED | Two 30-minute locked Bluetooth runs, at least one offline, per build plan G2 |
| A14 | Locked notification controls and cleanup | BLOCKED | Pause/Resume/Skip/Stop and no running service/wake lock after Stop |
| A15 | Process death/relaunch/update | BLOCKED | No auto-speech; completion journal persists; no partial-card completion |

No runtime architecture failure has yet been observed because the app has not run on the owner's phone. If the route fails, record the exact phase, device, voice, error and interruption; stop for a bounded correction/reassessment. Do not silently replace the shared JavaScript architecture or proceed to Stage 3.

## Known limits and operational contract

- Native TTS uses installed offline English voices only. Availability and actual offline behavior are separate tests; no Google UK English Male Android guarantee.
- Whole prepared plans are finite (1–100 passes, three fixed cards). The service interprets `speak`/`wait` actions; it contains no flashcard/review policy. No WebView timer drives background progression.
- Resume repeats interrupted speech; recall resumes its remaining time. Calls/focus loss and output disconnection are intended to pause until explicit Resume. OEM behavior needs testing.
- A missing speech callback becomes an error after 120 seconds. Recall is bounded to 120 seconds. A 150-second wake lock is renewed at action boundaries and released on non-playing states. These bounds prevent indefinite wake-lock ownership, not all possible OEM termination.
- Stop/completion request TTS shutdown and foreground-service removal. The service uses `START_NOT_STICKY`; process death never automatically restarts narration. The journal keeps only the latest 200 completed cards and is not a recovery/scheduling implementation.
- Notification actions provide Pause/Resume, Skip and Stop; Restart is in the app. First notification permission approval requires another explicit Start. Notification display depends on phone privacy settings.
- The app loads only bundled allowlisted assets into its bridge-enabled WebView, with no INTERNET permission, external navigation, file/content access, or third-party scripts. Normal offline TTS and Bluetooth media routing belong to Android/the selected engine.
- Lint's JavaScript warning is expected for the shared HTML/JS UI; the allowlist/CSP and disabled navigation restrict bridge exposure. Lint also notes that `allowBackup=false` does not uniformly govern Android 12+ device transfer; this proof has no personal library, and its diagnostic history should not be treated as a portable backup. Production backup policy remains later work.
- Minimum Android API is 26; a current WebView is required for the JavaScript UI (Chromium 92+). No emulator, device, installation, sound, power behavior or screen-lock success is inferred from unit tests or compilation.

**Historical at Stage 2 delivery:** G1 and G2 were open. See owner verification update above for successful physical-device evidence and remaining acceptance items.

# Stage 2.5 — GitHub Android builds

Scope: build/distribution only. Android application code and ID remain unchanged. The only project file outside `SR/` is the explicitly authorized `.github/workflows/sr-android.yml`.

New files: workflow, `mobile/ci/release.mjs`, `mobile/tests/release.test.mjs`, `docs/GITHUB_APK_BUILDS.md`. Modified: `mobile/app/build.gradle` (environment-supplied version code), `mobile/.gitignore` (signing-container exclusions), and this report.

| Check | Status | Evidence |
|---|---|---|
| Desktop regression | PASS | 33/33 local tests |
| Shared plan | PASS | 6/6 local tests |
| Native executor | PASS | 16/16 local tests |
| Release safety | PASS | 6/6: run/attempt increments, counter bounds, fingerprint normalization, APK package/version checks, signer mismatch/multiple signers, older/different-identity release rejection |
| Workflow static validation | PASS | Official checksum-verified actionlint; no diagnostics; ShellCheck integration not installed/enabled locally |
| Release compilation/lint | PASS | Local JDK 17, Gradle 8.11.1, AGP 8.9.2: `assembleRelease lintRelease`, BUILD SUCCESSFUL |
| Actual unsigned APK identity/version | PASS | SDK `aapt dump xmltree`: `com.crownandcall.srproof`, version code 100101. Manifest parser checked against this real output; certificate field in that parser test was synthetic, not a signing test |
| Original installed signing identity | PASS (owner provenance + local APK inspection) | Owner confirmed installation of this chat's Stage 2 APK. Public APK certificate SHA-256 `ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb`; original keystore located at `C:\Users\tpaig\.android\debug.keystore` |
| Owner backup / GitHub Secrets | BLOCKED | Owner must make and verify encrypted backups, protect the existing key, then configure four signing Secrets and the public fingerprint Variable |
| First GitHub cloud build/tests | PASS | [Run 38338802278](https://github.com/twpaige/CCTTRPG/actions/runs/38338802278), source commit `81661aaa238cf1aecd6715f86857c13dd49af327`: SDK setup, all 61 tests, release compilation/lint and unsigned intermediate upload succeeded |
| Complete GitHub workflow / publication | BLOCKED (run concludes failure at setup gate) | Same run's `publish` job stopped at **Require owner-backed signing configuration**; all signing/publication steps skipped. This is the intended missing-secrets guard, not a successful end-to-end release |
| Signed GitHub release/download | BLOCKED | No signing credentials supplied; fail-closed signing preflight prevents release. Signature/download checks are implemented but not yet exercised end-to-end |
| Installed update / data retention | BLOCKED | Owner must install over the original app and then install a subsequent higher-version GitHub APK, verifying diagnostic history survives both |

No private key/password was read into chat, committed, uploaded or generated by the agent. Only the existing APK's public signing certificate was inspected. The workflow never generates signing keys; passwords are passed to `apksigner` through environment references, and the temporary private key is removed on step exit. Artifacts/Release assets exclude all credentials. Reusing the existing certificate avoids a deliberate key migration; phone behavior remains unverified.

Release publication checks both the owner-pinned fingerprint and the previous published SR release, with increasing version codes. An old run cannot publish a downgrade; the owner should start a new run. The release is created as a draft, signed asset uploaded/downloaded and byte-compared, then published. No release or successful physical update is inferred from local unit tests. See [GITHUB_APK_BUILDS.md](GITHUB_APK_BUILDS.md) for exact backup, configuration and phone instructions. Stop at owner signing setup; no Stage 3 work.
