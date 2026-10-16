# SR — Test results

## Quick Listen (2s) — 2026-10-16

Added an off-by-default checkbox beside recall settings on desktop and Android. The existing device-local preference records retain it across restart; JSON exports/imports do not transfer it. The shared recall calculation overrides every authored/default pause with two seconds only when enabled. Desktop captures the option at Start; Android writes resolved waits into every prepared native batch. No database migration, authored-content change, new mode, native audio redesign or mastery/scheduling change.

**500/500 local automated checks PASS**: prior 490 plus nine focused Quick Listen groups and one mobile UI preparation check. Focused coverage includes 20 REVIEW/AUDIT × ON/OFF × authored 0/3/60/300/missing timing combinations, device fallback, frozen active settings, Pause/Resume remaining time, independent local preferences, reload and actual browser-process restart, backup exclusion/import preservation, unchanged content and no interrupted-step credit. Four actual JavaScript-generated plans also run through the production Java Plan/PlaybackEngine, verifying every native wait, interruption and single completion receipt. Mobile UI PLAY verifies both override and authored/default prepared units.

Existing storage/recovery/editor/mastery/study/native regressions, native batching stress, earcon callback/interruption tests, release checks and chime waveform equivalence passed. Desktop Chrome and 390px Android WebView-layout checks passed using isolated test profiles. Speech/native bridge are simulated; no physical Samsung result is claimed.

Release workflow, live-site verification and signed APK evidence will be recorded after publication. Physical Samsung checks remain pending; see [ANDROID_LISTENING.md](ANDROID_LISTENING.md). Usage is documented in [PLAYBACK.md](PLAYBACK.md).
## Android transition completion callback correction — 2026-10-16

Owner-reported regression in **0.2.102401**, Samsung / Psalm 23: the first step and chime are audible, then progression hangs until “Transition sound timed out. Resume retries.” Investigation found a callback-ID contract mismatch: SR supplied only the separate `playEarcon` ID with a null Bundle. [AOSP TextToSpeechService](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/speech/tts/TextToSpeechService.java) uses `AudioSpeechItem.getUtteranceId()` to read `Engine.KEY_PARAM_UTTERANCE_ID` from the Bundle, and suppresses success callbacks when that ID is null. This explains an audible completed chime with no executor advancement; increasing the timeout would not fix it.

The minimal production change supplies the same token in the parameter Bundle and the explicit ID argument. The existing progress listener then reaches `engine.done(token)`, cancels the watchdog and advances once. [AOSP audio queue lifecycle](https://android.googlesource.com/platform/prebuilts/fullsdk/sources/android-31/+/refs/heads/androidx-camera-release/android/speech/tts/AudioPlaybackQueueItem.java) owns MediaPlayer completion/stop/release; no new player or resource lifecycle was added. Media routing/focus, cancellation, native batching, approved WAV bytes, speech, library content, scheduling/mastery and completion-credit policy remain unchanged. A genuinely missing callback still fails at 15 seconds, releases pending audio and waits for explicit retry; no time-based completion is inferred.

The new framework-contract test compiles the production service's chime and cancel method bodies against an Android API double that models the actual Bundle lookup and queued asynchronous callbacks, using the real native executor. It **failed before the fix** with “Earcon callback ID is missing from the parameter Bundle”; **9/9 cases pass after correction**. Cases cover consecutive steps, flashcard boundaries, Bluetooth-style delayed callback delivery, Pause/Resume with stale callbacks, Stop before queued completion delivery, unchanged timeout and retry, navigation, enqueue failure and duplicate completion. Previous tests directly simulated executor completion and missed this platform-contract error. These tests are not a physical Samsung reproduction or Bluetooth certification.

**490/490 local automated scenarios PASS**: all prior 481 scenarios plus the nine new callback-contract cases. Full browser/storage/recovery/editor/mastery/desktop/native regression suites, release-safety checks, native batching stress, and unchanged waveform equivalence checks passed.

Implementation `d9aec5f26980659ce2e33df649fd5f0a41e4eea9` pushed to origin/main. [Android workflow 38916945811](https://github.com/twpaige/CCTTRPG/actions/runs/38916945811) passed cloud regressions, Android release build/lint, signing/upgrade-identity verification and published-download verification. Corrected signed APK **0.2.102501**: [download](https://github.com/twpaige/CCTTRPG/releases/download/sr-android-102501/SR.apk).

Independent download SHA-256 matches metadata: `daed51494b4e932957fa34d173179ab02533a5ca10bbdd5919d46369837411da`. The downloaded APK's certificate remains `ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb`; application ID remains `com.crownandcall.srproof`, origin remains `https://sr.invalid/`. Both packaged WAVs byte-match the approved source renders and APK 0.2.102401. No desktop or learning-data changes.

Remaining owner check: install **0.2.102501** over the existing app without uninstalling, then repeat Psalm 23 across consecutive steps/card boundaries, Bluetooth/locked-screen playback and Pause/Resume/Stop during transitions. Physical Samsung confirmation remains pending.

## Production transition chimes — 2026-10-16

Owner-approved `sr-chime-lab-v1` settings are hardcoded for desktop REVIEW/AUDIT and native Android: wood / two-note, both 330 Hz, volume 32, duration 0.72 s, decay 69, silence before 0.27 s and after 0.18 s. The laboratory page and synthesis source remain intact. Desktop reuses that synthesis; Android bundles two 48 kHz mono PCM resources rendered from it and plays them as earcons in the existing native TTS queue. [Android's earcon API](https://developer.android.com/reference/android/speech/tts/TextToSpeech#playEarcon(java.lang.String,int,android.os.Bundle,java.lang.String)) shares utterance callbacks with the existing executor; no new audio framework or WebView dependency was introduced.

Transitions compare actual source/destination identities after selection/refresh. Within-card changes use wood; cross-card changes use only two-note. Automatic and manual navigation share the rule. Start, Stop and ordinary speech Pause/Resume add no cue. Pause during a cue cancels it; Resume retries only the cue before its target question. Chime completion never invokes learning-completion handling. Existing recall, scheduling/mastery, replay credit protection, native batching/focus/notifications, playlist announcements, database/backup format, application ID and origin are unchanged.

**481/481 local automated scenarios PASS:** all prior 445 regressions, 12 laboratory checks, and 24 new focused checks (10 desktop transition, 8 native transition, 2 waveform-equivalence, 4 production browser). Coverage includes automatic/manual forward/back boundaries, filtered/KNOWN destinations, repeat and AUDIT refresh, no initial/final cue, no ordinary Resume cue, cancellation/stale callbacks/rapid navigation, audio retry, no overlap or extra receipts, native playlist announcements and 1,000-card/5,000-step batching regressions. Native WAV output matches the actual browser recipe within two 16-bit quantization units, with exact 1.17-second duration and approved silence boundaries. Browser tests use real Web Audio and disposable IndexedDB; speech and native host audio are simulated.

Implementation `9805f2dcc3412141e339ad0c721bfee0d7e0eb75` pushed to origin/main. [Android workflow 38910740157](https://github.com/twpaige/CCTTRPG/actions/runs/38910740157) passed all cloud regressions, release build/lint, signing, upgrade identity and published-download checks. Signed APK **0.2.102401**: [download](https://github.com/twpaige/CCTTRPG/releases/download/sr-android-102401/SR.apk). Independently downloaded SHA-256 `05ae98a0aa752112b4839a4ebc58dd01e5f14fb24861d557c20cbc12dd1cee53` matches release metadata. Downloaded APK certificate independently inspected: SHA-256 `ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb`, unchanged. Both packaged PCM assets byte-match the approved source renders; compiled earcon calls and `https://sr.invalid/` origin are present. Application ID remains `com.crownandcall.srproof`. No library migration or data clearing is required.

[Pages deployment 38910739632](https://github.com/twpaige/CCTTRPG/actions/runs/38910739632) succeeded. All **six live Chrome checks passed** against the deployed desktop player/recipe: four production browser checks and two waveform comparisons. The laboratory remains available unchanged.

Physical Samsung/Bluetooth sound quality, routing, interruption timing and in-place update retention remain owner verification. The release checklist is in [ANDROID_LISTENING.md](ANDROID_LISTENING.md); user-facing behavior is in [PLAYBACK.md](PLAYBACK.md).

## Chime Laboratory — 2026-10-16

Standalone sound-selection page at `SR/chime-lab.html`, with eight step and eight flashcard variants, independent controls, comparison, a spoken sample, Stop and compact JSON settings copy. Only new laboratory files and documentation were added. Existing speech preferences are reused; no production REVIEW/AUDIT, IndexedDB, backup, Android or scheduling code changed. No APK release.

**206/206 relevant automated scenarios PASS:** 12 focused laboratory checks, 33 speech tests, 68 editor/preview/preferences scenarios, and 71 desktop study domain + 22 desktop UI scenarios. Focused checks cover all 16 actual synthesized waveforms (finite, non-silent, bounded peak, silent tail), input bounds, settings/copy/fallback, comparison cleanup, speech order/preferred voice/rate, cancellation during speech/recall/pre-tone silence/tone/pending AudioContext resume, switching without overlap, narrow layout, no IndexedDB access and missing Web Audio. Speech and clipboard are simulated; real Web Audio renders tones. Desktop/narrow Chrome screenshots inspected. This is a relevant regression subset, not a rerun of all native/recovery suites.

Owner listening/earbud comfort and final sound selections remain pending. See [CHIME_LAB.md](CHIME_LAB.md) for usage and future transition rules, recorded as documentation only.

Implementation `087e555a7d1f687f33ecc1bf380247f1b0905cf5` pushed to origin/main. [Pages deployment 38906182479](https://github.com/twpaige/CCTTRPG/actions/runs/38906182479) succeeded. All **12 focused checks passed again against the live page in desktop Chrome**, using an isolated browser context, real synthesized waveforms and simulated speech/clipboard. [Android workflow 38906182562](https://github.com/twpaige/CCTTRPG/actions/runs/38906182562) skipped under `[web-only]`; no APK published.

## Website speech Preview and device-local preferences — 2026-10-16

Per-question/answer Preview speaks current unsaved text with the desktop speech adapter, short utterance segmentation and shared voice/rate. Same-button Stop and switching cancel unfinished speech; switching retains the existing library Web Lock to avoid a release/reacquire race. REVIEW/Preview exclude one another without cancelling the active owner. No recall, save, mastery or scheduling action occurs. Navigation and editor actions stop Preview.

Desktop voice/rate/default recall now persist in `sr.desktop.speech.v1`, initialized once from local legacy settings/defaults. Late voice discovery restores the preferred voice; fallback never overwrites that descriptor. Portable JSON excludes the four legacy device settings keys, while authored step recall remains. Old imports retain local preferences and existing inert legacy values. Internal snapshot guards remain complete; restore compares portable snapshots. Android preference keys/native behavior and schema 2 are unchanged; no APK release is needed.

Focused browser tests cover unsaved exact text/no writes, Stop/switch, long text, both directions of REVIEW exclusion, shared preferences, older backup import/export separation, authored recall preservation, native preference isolation, narrow controls, editor exit, real browser-process restart, delayed voice discovery/fallback, and corrupt local storage. Existing recovery tests now use a portable volume setting for concurrent-change checks; malformed backup rollback compares the full unchanged internal snapshot. **445/445 automated scenarios PASS**: the prior 434 plus 11 focused speech/preference scenarios (editor now 68). Existing storage, mastery, desktop/shared/native playback, Android UI, Data/recovery and release-safety suites passed. Preview layout visually checked at desktop and narrow widths. Implementation **`b9d158d2b301cf9e4caa77a0d2f569477e595de0`** pushed to origin/main. [Pages deployment 38902616780](https://github.com/twpaige/CCTTRPG/actions/runs/38902616780) passed. All **11 focused scenarios passed again against the live website** in an isolated profile/disposable database, including actual browser-process restart with simulated speech. [Android workflow 38902618086](https://github.com/twpaige/CCTTRPG/actions/runs/38902618086) was skipped under [web-only]; no APK published. All sound is simulated; owner should verify actual Chrome voice/audio and the feel of Preview on their device.

## Website Paste Flashcards — 2026-10-15

Additive authoring dialog accepts one strict JSON format, previews counts/destination without writes, and confirms an atomic append to an existing or newly created BOUND/UNBOUND series. Existing rows/history are preserved; new cards/steps have ordinary identities, timestamps and mastery-0 progress due in 15 minutes. Unsupported fields and full-library backups are rejected. Dirty drafts block opening, input changes invalidate preview, and stale confirmation requires fresh validation while retaining the text. No database/backup format, restore behavior, playback/mastery policy or Android UI change.

**57/57 editor scenarios PASS**, retaining the previous 39 plus **18 paste scenarios**. Real disposable IndexedDB/browser tests cover 1/3/1,000 cards into both existing/new destinations; exact text, order, IDs and recall; default progress; backup round trips/native-plan compatibility; malformed/unsupported input; partial-write rollback; normal editing/reordering/moving/cloning/mastery/deletion; history preservation on move; locks, concurrent writes and restore-generation guards; no-write preview/cancel; dirty drafts; validation invalidation; failure retention; 390/320px keyboard/scroll layout; post-commit refresh failure without accidental retry duplication. **434/434 total automated scenarios PASS** (previous 416 plus 18 paste cases): editor, storage, mastery, desktop/shared/native playback, Android UI, Data/recovery and release-safety suites. Speech/providers are simulated; browser IndexedDB is real and disposable. Desktop/narrow dialog screenshots visually inspected. Implementation **`6803989b8f49dfcd298a36011cc8ed0b56fc890a`** pushed to origin/main. [Pages deployment 38793700132](https://github.com/twpaige/CCTTRPG/actions/runs/38793700132) passed. All **18 paste scenarios passed again against the live [Library Editor](https://crownandcall.com/SR/library.html)**, using an isolated browser context and disposable databases only. [Android workflow 38793699660](https://github.com/twpaige/CCTTRPG/actions/runs/38793699660) skipped build and publish under the existing [web-only] convention. No APK released.

Remaining owner verification: generate a small JSON batch, paste/preview it in the disposable editor, confirm destination/order/wording, and edit/move/clone a card. Transfer through the existing full-backup/OneDrive workflow when desired. Actual Samsung transfer and personal-library acceptance are not inferred from synthetic tests. Website-only release; no APK requested or published and no next feature/stage begun.

## Android JSON picker bridge correction — 2026-10-15

Owner reported **Error invoking openBackup: Method not found** on Samsung. The native annotated method is present as `openBackup()`; export is `saveBackup(String)`. Shared recovery simplification commit `2b5b51c` replaced the earlier direct zero-argument call with `nativeFile(method, json)`, which always invoked `native[method](json)`. Import therefore supplied one undefined argument to the zero-argument Java method. Method names match; argument count did not. The previous plain JavaScript mock silently accepted extra arguments.

Small shared-helper correction forwards the actual argument list: zero for open, one JSON string for save. Synchronous bridge failure clears the pending callback and follows existing error handling. No native method, picker implementation, library schema/origin, signing identity, scheduling/mastery or playback behavior changes.

Regression evidence: the Data harness now derives method names and parameter types from the annotated Java source and enforces arity/string arguments on every mocked bridge call. Before the fix, this harness failed with the exact reported error; after the fix, **40/40 Data scenarios PASS** (previous 35 plus five checks). Added coverage includes the native file contract, zero-argument import dispatch, invocation failure/retry, and complete standalone desktop/Android export with verified timestamped filename. Existing tests retain automatic outgoing backups, exact snapshot checks, read-back verification failures, cancellation, replacement locks, rollback, v1/v2 JSON conversion/round trips, progress reconciliation and late-completion rejection. Native BackupDocument tests cover timestamp/collision naming, exact UTF-8 write/read-back and refusal to overwrite nonempty files. Browser bridge/pickers/providers are simulated; this is not a physical Samsung import claim.

**416/416 automated scenarios PASS**, retaining the previous 411 plus five recovery checks. Full local suite and [Android workflow 38787597337](https://github.com/twpaige/CCTTRPG/actions/runs/38787597337) passed, including Android release build/lint, signing, upgrade identity and release-download verification. Implementation **`9037fae7f0321f2df868e06a79b78a5bcb3994f3`** pushed to origin/main.

Published signed APK **0.2.102001**: [download](https://github.com/twpaige/CCTTRPG/releases/download/sr-android-102001/SR.apk). Independently downloaded SHA-256 matches metadata: `d7035ee437555980031fbaef1e6f31c238ce389fc0904c6c7c678bd99b2781c0`. Verified corrected argument forwarding in packaged `assets/data/panel.js`. Application ID remains `com.crownandcall.srproof`, origin remains `https://sr.invalid/`, and certificate SHA-256 remains `ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb`. Remaining owner check: update the signed APK in place; export a dated backup, import via the Samsung picker, verify the automatic outgoing backup and confirmation, then export/reopen and compare library contents. Check cancellation as well. No uninstall or data clearing is required.

## Desktop Library Editor cloning — 2026-10-15

Website-only Clone FC (1–10) and Clone Series (exactly one), using saved content and one atomic repository transaction. Copies insert immediately after the original with contiguous integer positions, new identifiers/timestamps, remapped recitation references and mastery-0 progress due in 15 minutes. No existing progress/history is copied or modified. Dirty drafts block cloning. Existing action-row styling and dialogs are reused; the first copy is selected for editing.

Focused disposable-browser/IndexedDB tests cover one/ten FCs at beginning/middle/end, exact text/annotations/order/recall, distinct IDs, original preservation, fresh scheduling, readable repeat-copy names, invalid counts/revisions, BOUND/UNBOUND and empty series, middle/end series insertion, independent edits/deletion, JSON restore equality, mid-copy and post-copy reorder rollback, ID collision, locks, concurrent writes, generation guards, confirmation cancellation, drafts and 1440/390/320px layout. **411/411 automated scenarios PASS**: previous 389 retained plus 22 cloning scenarios (editor suite now 39). Existing storage, mastery, Data/recovery, desktop/shared/native playback, Android UI and release-safety suites all passed. Chrome/Node/JDK in the same local test environment as the preceding release; real disposable IndexedDB, simulated speech. Desktop and narrow layouts visually inspected. Implementation **`2da0950d1b2b44925c129467b69e3b5f6e1d8c6e`** pushed to origin/main. [Pages deployment 38781861342](https://github.com/twpaige/CCTTRPG/actions/runs/38781861342) passed. All **22 cloning scenarios passed again against the live [Library Editor](https://crownandcall.com/SR/library.html)** in an isolated browser context using only disposable test databases; desktop/narrow screenshots were inspected locally. [Android workflow 38781862394](https://github.com/twpaige/CCTTRPG/actions/runs/38781862394) skipped both build and publish under the existing [web-only] convention. No APK released.

Owner verification remaining: try a real template in the disposable editor or after making a dated backup; customize copies and optionally delete the template. Confirm keyboard/dialog usability and expected names/order. Physical JSON transfer to Android remains owner verification; no APK is built or published for this feature. No other feature/stage begun.

## Android stable playback status correction — 2026-10-15

Owner reports APK **0.2.101701** installed and working great, with distracting layout movement from the progress-save notification. This is general owner feedback, not a claim that every outstanding G10 check passed.

Minor Stage 10 UI correction: successful progress/mastery saves now show **Saved** for the existing 2.5 seconds inside the playback status line. Pending-save information uses that same line; the separate progress paragraph is removed. Status and current-position text use nowrap/hidden overflow/ellipsis, preserving full DOM text for accessibility; the status also exposes its full text as a title. Existing error alerts and all save, scheduling, mastery, playback, navigation, audio, database and backup logic are unchanged.

Focused real-browser regression coverage verifies identical status/control/panel bounds when Saved appears and disappears, preserved error reporting and status semantics, and long-status ellipsis without vertical movement or horizontal page overflow at **320, 360 and 390 px**. **389/389 scenarios PASS locally**, retaining the previous 386 and adding three UI regressions (native integration: 22 domain + 26 mobile UI). All existing speech, persistence, editor, mastery, Data/recovery, shared-plan, release-safety, native executor/authored/prepared/listening and desktop-study suites passed. Synthetic data and simulated native bridge/audio; real isolated browser IndexedDB. [Android workflow 38749040257](https://github.com/twpaige/CCTTRPG/actions/runs/38749040257) also passed its complete regression suite, release build/lint, signing, upgrade identity and release-download verification.

Published **0.2.101801** (version code 101801), implementation commit **`b6e83a4d6da5eb23e6caa1ba126f6088691a8968`**: [signed APK download](https://github.com/twpaige/CCTTRPG/releases/download/sr-android-101801/SR.apk). Independently downloaded SHA-256 matches release metadata: `797ab5913fa31a1a06106be21cd7f489e2b18739519634c364044573c77f3ea3`. Verified packaged inline-save JavaScript, truncation CSS and removal of the progress paragraph. App ID remains `com.crownandcall.srproof`; signing certificate SHA-256 remains `ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb`. No physical verification of this new APK is claimed.

Remaining Samsung check: update in place, play until progress saves, and confirm the brief inline Saved indicator causes no menu/control movement; check status truncation with the owner's normal display/font settings. Stage 10 remains ACTIVE / G10 OPEN; no next stage begun.

## Android listening interface and one-touch PLAY — 2026-10-15

**Implementation, 386 automated scenarios, Android build/lint, signing and published-download verification PASS. Samsung acceptance remains OPEN.** Current origin/main was fetched before changes and remained `28ed1bc47987d18198782b854ea819b19a531d77`; prior APK `0.2.101601`. This is Stage 10 only. Historical evidence below is preserved and describes its tested interfaces.

### Changes

- Compact phone layout reuses desktop base styling: always-open sticky playback panel first; collapsed Knowledge Mastery, Choose a Session, Voice & Recall, Data & JSON Recovery; touch-size keyboard-accessible controls. Status is operational only: mode/state, original prepared-card number/total, authored-step number/total and phase. No authored names/Q/A appear in playback status or notification text. Mastery/reset applies to the active step/card without manual selectors; existing atomic saves, confirmation scopes, cancellation and error pause remain.
- PLAY automatically validates/prepares, then starts. Saved activity/series/window/days/shuffle/voice/rate/recall use device-local localStorage in the existing origin, separate from portable JSON. Nothing speaks on open. Invalid preferences fall back safely; missing series falls back to ALL, and unavailable saved voice stays visible until explicitly changed. Persistence mechanism is tested across a real isolated browser-process restart; physical phone restart/APK update remains to verify.
- Conservative reuse: a ready, never-started playlist in the same native process is reusable after matching canonical library/generation, configuration and current eligible-identity hash. Settings, mastery, content, import generation or eligibility changes invalidate it. STOP and process death discard material; next PLAY prepares fresh. No durable cache or recovery machinery.
- Native TTS announces Preparing playlist, Starting playlist, Playlist complete then Replaying playlist, and No reviews available. Phrases execute separately from flashcard units through the existing TTS/focus/control path, with no step-start/completion callbacks or receipts. Natural passes announce completion/replay; navigation past the end announces replay only. No batch-transition announcements, no overlapping preparation/content speech, and retries repeat only the interrupted phrase.
- Previous/Next Step and Previous/Next FC use retained prepared order. Previous Step crosses card boundaries as explicitly requested for Android; desktop behavior is unchanged. Backward first boundary is a no-op; forward last boundary wraps; paused navigation stays paused. Interrupted answers are uncredited and revisiting successful steps does not schedule twice. Batching, first-success opportunity, completion overflow, recovery/import safeguards, app ID/origin/schema/signing configuration remain unchanged.

### Automated evidence

**386/386 distinct scenarios PASS:** original speech 33; persistence 38; editor 17; mastery 40 + 7 UI; Data 35; shared plan 6; release safety 6; native executor 16; authored native/focus/document 28; prepared native 11; **listening-interface native 11**; native integration **22 domain + 23 mobile UI**; desktop study 71 + 22 UI. Prior 361 coverage is retained with Android UI assertions adapted to the requested controls; 25 focused scenarios added. Additional browser lifecycle/offline/transaction-close checks also pass. Node 24.19.0, Chrome 154.0.0.0, JDK 17.0.20.1 on Windows. All production Android Java compiles against API 35. Synthetic content, isolated profiles/databases and simulated speech/providers only; no owner library accessed.

Focused coverage: native announcement order, no announcement credit, pause/retry/stale callbacks/Stop, duckable focus versus calls, navigation boundaries/cross-card/backward/paused behavior, unchanged once-per-step credit after backward playback, content-free status, collapsed panels and keyboard toggle, sticky layout at 390px, one-touch preparation/failure/retry, exact recall overrides, all mastery levels/KNOWN/reset/cancel/save failure, safe ready reuse, settings/mastery/import invalidation, due-boundary invalidation, corrupt preferences/write failure, all choices after page and real browser-process restart, Stop during preparation, no automatic speech on reopen, and empty REVIEW status. Existing 5,000-step fixture, larger 12,000-step batching and 12,001 completion overflow tests pass. Collapsed mobile layout visually inspected.

Use the existing complete-suite commands below. `node SR/mobile/tests/authored.test.mjs` now includes authored 28, prepared 11 and listening-interface 11. `node SR/tests/native.mjs` runs 22 domain and 23 UI scenarios. New tests run through the unchanged GitHub Actions build pipeline. Automated audio does not certify audible timing, Bluetooth routing or locked Samsung behavior.

### Published APK and release verification

Implementation **`07585958f8d0e079fc5ac8087f017592e578e89a`** is pushed to origin/main. [Android workflow 38746173925](https://github.com/twpaige/CCTTRPG/actions/runs/38746173925) completed **build and publish PASS**, including the complete regression suites, assembleRelease/lintRelease, signing, application ID, version progression, original certificate comparison and byte-identical release-download verification. [Pages deployment 38746171017](https://github.com/twpaige/CCTTRPG/actions/runs/38746171017) also passed.

Signed APK **0.2.101701**, version code 101701 (greater than prior 101601): [download SR.apk](https://github.com/twpaige/CCTTRPG/releases/download/sr-android-101701/SR.apk), [release and build metadata](https://github.com/twpaige/CCTTRPG/releases/tag/sr-android-101701). Independently downloaded APK SHA-256 matches metadata: `2cac5fdf4cc773b6401618e719e76bb5385a36d8cfdd2e57a7beec00a8ee9740`. Commit and unchanged app ID `com.crownandcall.srproof` match. Signing SHA-256 remains `ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb`. Packaged index/mobile JavaScript/CSS, preferences module, shared desktop styling and native-study module were verified present in the downloaded APK. These checks establish build/identity compatibility, not observed Samsung update/data preservation or audible acceptance.

### Remaining owner verification

Follow [ANDROID_LISTENING.md](ANDROID_LISTENING.md#remaining-samsung-sm-s931u-verification): back up and install in place; compare records and verify remembered choices after reopen/phone restart/update; press PLAY once; hear the five phrases and verify no extra speech at batches; test navigation, mastery/KNOWN/reset/cancel, empty/error cases and Stop during preparation; repeat locked/offline Bluetooth sessions and notification/call/disconnect checks; verify due/early/AUDIT credit and overflow; perform the protected manual JSON/OneDrive round trip. G10 remains OPEN, as do older unperformed gates. Stage 7 SUPERSEDED; 8/9/11 ON HOLD. No next stage authorized.

Practical limits: keep the app available during preparation; initial Android notification permission can require granting permission then pressing PLAY again. STOP always prepares fresh next time, even if caching could save work. Device preferences are not exported as library settings. Device storage/memory and unusually large individual steps remain practical limits. Process death can lose all uncommitted completions by prior owner decision. No APK-update/data retention or physical audio result is claimed from simulation.

## Android PREPARE / PLAY refinement — 2026-10-15

**Implementation, 361 automated scenarios, Android build/lint, signing and published-download verification PASS. Physical Samsung acceptance remains OPEN.** Baseline: current origin/main was fetched and fast-forwarded to `6e63b0bdb81477ac73e42c0c606bc2c3f2b36b29` before implementation. Previous published APK: `0.2.101101`. This is authorized Stage 10 refinement only; Stage 7 remains SUPERSEDED and Stages 8, 9 and 11 ON HOLD.

### Implementation

- PREPARE applies existing REVIEW/AUDIT selection and freezes exact ordered material, original cutoff and step identities. Stream bounded transfer chunks to disposable app-private files; PLAY becomes available only after all material is ready. Native reads at most 16 steps per batch with approximately 1 MiB text read-ahead, constructs speech substrings lazily and repeats both modes without WebView callbacks. There is no arbitrary session/card/duration or old 16 MiB handoff limit in the listening UI.
- A stable session/step bitset grants at most one first-successful-completion opportunity, including a step skipped on earlier passes. Actual step-start time controls due/early; early success and AUDIT never automatically schedule. Existing atomic IndexedDB receipts protect retry. The bounded 512-entry / 16 MiB memory completion queue spills additional entries into a separate temporary file; FIFO reconciliation never silently drops records. Stop deletes playback material while retaining pending completions. Fresh process startup discards abandoned temporary files and stays silent; uncommitted completion loss remains an accepted shutdown tradeoff.
- One-touch 0–9 pauses immediately, reconciles, saves through the existing mastery API, prunes affected original material using the original cutoff, and resumes past the interrupted step. Every 10 confirms actual scope; cancel resumes unchanged. Reset scopes are preserved. Native Resume is held during edits, and explicit Pause/Stop prevents automatic restart. Save/update failures remain paused and visible. No interrupted-answer credit, new eligibility, schema change, cloud service or new framework.
- Preserve app ID/origin/signing configuration, IndexedDB, JSON formats 1/2, external verified backups, atomic import and manual OneDrive workflow. Legacy plan/pending-completion APIs remain regression-compatible; the current Android UI uses PREPARE/PLAY and immediate mastery.

### Executed automated checks

**361/361 distinct scenarios PASS:** speech 33; persistence 38; editor 17; mastery 40 domain + 7 UI; Data 35; shared plan 6; release safety 6; native executor 16; authored native/focus/document 28; **prepared native 11**; native integration **19 domain + 12 mobile UI**; desktop study 71 domain + 22 UI. Prior 338 coverage is retained with Android UI assertions adapted to the intentionally replaced controls; focused additions contribute 23 scenarios. Additional lifecycle/offline/transaction-close checks also pass. Native/browser speech and document providers are simulated. Synthetic libraries and disposable databases/profiles only; no owner library accessed.

Focused native tests read every step in the repository's **1,000-card / 5,000-step** fixture, checking exact Q/A/recall/order and the 16-step cache bound. A **12,000-step** synthetic plan exceeding 16 MiB also prepares and reads completely. Tests exercise native-only repetition, first successful completion on later passes, early/no-repeat credit, paused pruning across batch boundaries, stable completion flags, stale callbacks, empty/incomplete preparation, resource release, **12,001 FIFO completion records**, final overflow truncation and injected overflow failure without eviction. These tests do not measure audible batch gaps or Samsung memory/battery behavior.

Browser tests cover UTF-16 chunk boundaries/Unicode, preparation failure/cancellation, original-cutoff pruning and no newly introduced material, final/BOUND KNOWN propagation, AUDIT reset, paged updates, real IndexedDB reconciliation, one-touch levels 0–9, mandatory intermediate KNOWN confirmation/cancel, injected save failure/rollback, Stop during confirmation, Pause versus Stop, silent reopen and 390px controls. Existing master/reset, notification/focus, JSON backup/import and migration regressions remain passing. The narrow-screen listening layout was visually inspected.

Environment: Windows, Node 24.19.0, headless Chrome 154.0.0.0, JDK 17.0.20.1; all Android production Java sources compile against API 35. Full Android build/lint/signing run through the unchanged GitHub Actions workflow. Reproduction uses the existing complete-suite commands below; `node SR/mobile/tests/authored.test.mjs` now includes 11 prepared-session tests, and `node SR/tests/native.mjs` runs 19 domain + 12 UI cases. No physical-device result is inferred from automation.

### Published release verification

Implementation commit **`0156ad3999685ed2cda525bc53b7ec90332f4c4e`** is pushed to `origin/main`. [Android workflow 38737739570](https://github.com/twpaige/CCTTRPG/actions/runs/38737739570) completed **build and publish PASS**, including all regression suites, `assembleRelease`, `lintRelease`, signing, application-ID/version/certificate checks against the previous release, and byte-identical release-download verification. [Pages deployment 38737739027](https://github.com/twpaige/CCTTRPG/actions/runs/38737739027) also passed.

Signed APK **0.2.101601** (version code 101601, greater than prior 101101): [download SR.apk](https://github.com/twpaige/CCTTRPG/releases/download/sr-android-101601/SR.apk), [release and build metadata](https://github.com/twpaige/CCTTRPG/releases/tag/sr-android-101601). The published APK was independently downloaded and its SHA-256 matched build-info.json: `586598886a06208f1bed97354f1c106dbfc93d90b8dd796ada1904407f08a17f`. Metadata matches the implementation commit and unchanged app ID `com.crownandcall.srproof`. Signing SHA-256 remains `ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb`. These automated identity checks establish upgrade compatibility, not observed Samsung data preservation.

### Remaining acceptance and practical limits

Follow the updated [Samsung checklist](ANDROID_LISTENING.md#remaining-samsung-sm-s931u-verification): in-place update/data comparison; PREPARE/PLAY readiness; locked/offline/Bluetooth batch progression and repeated sessions; due/early/AUDIT and later-pass credit; one-touch mastery/KNOWN/reset/cancel; notifications/calls/disconnects; more than 512 completions with WebView inactive and reconciliation after Stop; force-stop silence; desktop–phone JSON/OneDrive round trip. **G10 remains OPEN** until required everyday device behavior is owner-verified. No older unperformed gate is closed.

Storage and memory remain practical limits: JavaScript validates/prepares a snapshot and native holds a bounded batch plus an individual step, so one unusually large step can exceed the approximate 1 MiB target. Preparation/revision may take time on large libraries. A database save that succeeds before temporary-file revision fails remains committed; Stop and PREPARE again uses it. Unexpected process death can lose all uncommitted completion records. Audible timing, actual APK update preservation and provider synchronization need owner verification.

## Repeat eligibility and transient save confirmation — 2026-10-14

**Focused web correction; baseline `bae3601873884896c4493b73f13a5a95cf719484`.** Investigation confirmed both repeat modes reused the initial eligible-step list. `ReviewController._advance` restarted it without consulting committed progress; `player.js` rendered the retained `masterySaved` on every update indefinitely. The reported causes are confirmed from the implementation and reproduced with isolated tests.

### Changes

- `js/review.js` adds a cancellable asynchronous repetition-boundary read after successful completion. `js/study.js` rereads guarded committed data and calls the existing `selectReview` using the active window/current boundary time, with randomization disabled for this lookup. FC repeat rebuilds only the current card's ordered eligible steps. If the final anchor is ineligible, it clears repeat and advances in the existing prepared card order. Step repeat checks that anchor and current step, continuing normally when the step no longer qualifies. The current pass is never interrupted by refresh. AUDIT has no new refresh hook and remains unchanged.
- Existing practice tracking/atomic receipts prevent repeats from rescheduling completed steps. Refresh failure pauses in a visible error state; retry rereads eligibility without rewriting completion. Pending reads honor Pause/Resume, unchecking, navigation and Stop through existing generations. No shared scheduler, mastery interval, database/backup or Android changes.
- `js/player.js` shows one separate save confirmation for 2.5 seconds, without restarting its timer on status renders; Stop/Restart clear it. Old expiry callbacks cannot clear newer confirmations. `js/study.js` suppresses delayed notifications whose occurrence/session is no longer current while retaining valid committed credit. Errors remain separate and persistent. `js/player-status.js` labels the short boundary read. PLAYBACK, SPECIFICATION and BUILD_PLAN describe the correction.

### Verification

**338/338 distinct automated scenarios PASS**, including 71 study domain + 22 UI cases. Other full regression suites PASS: original speech 33, persistence 38, editor 17, mastery 40 + 7 UI, Data 35, shared plan 6, release 6, native executor 16, authored native/focus/document 28, native integration 13 + mobile UI 6; lifecycle/offline/transaction-close checks pass. Windows, Node 24.19.0, Chrome 155.0.0.0, JDK 17.0.20.1. Disposable databases/profiles and simulated speech only; no personal library accessed.

Nine new domain cases plus two Chrome UI cases cover the owner's exact All-series/seven-day/five-step-second-FC scenario, mastery-9 exclusion of Steps 1/2, ordered remaining steps, final-anchor exit, early/due-only/KNOWN eligibility, both repeat modes, no duplicate receipts, refresh read failure/retry, Pause/uncheck/navigation/Stop during a delayed refresh, delayed save acknowledgements, and transient/replaced/out-of-order notification expiry. Existing tests that intentionally repeat beyond the due window now explicitly use Max Deferred; KNOWN repeat expectations are updated to exit, while explicit Previous practice remains protected. AUDIT and all other regressions retain their original semantics. The Chrome five-step scenario and transient messages pass; narrow-screen status/control screenshot inspected.

Use the existing complete-suite commands below. `node SR/tests/study.mjs` now runs 71 domain + 22 UI cases. Set `SR_TEST_URL=https://crownandcall.com/SR` for isolated deployed checks. Optional SR_PLAYER_SCREENSHOTS captures the corrected scenario.

Implementation **`483c28924831fd0e6b5b2e8c478bc3068452c746`** pushed to `origin/main`. [Pages deployment 38672287212](https://github.com/twpaige/CCTTRPG/actions/runs/38672287212) **PASS**. Deployed Chrome checks: **71/71 domain + 22/22 UI PASS**, including the exact five-step scenario and notification expiry. This repeat verification is not counted again in 338. [Android workflow 38672287505](https://github.com/twpaige/CCTTRPG/actions/runs/38672287505): **build and publish SKIPPED**. No APK published. Final scope/whitespace checks pass.

Owner listening check: reload [SR](https://crownandcall.com/SR/), repeat a card in seven-day REVIEW, and confirm newly saved mastery-9/KNOWN steps disappear only at the next repeat boundary. Confirm changing the final anchor outside the window advances to the next card, and save confirmations disappear while position/phase and errors remain readable. Automated sound is simulated; actual listening and assistive-technology behavior remain owner verification. No new stage or Android acceptance claim.

## Detailed web playback status — 2026-10-14

**Implementation and automated checks PASS; owner listening comparison remains optional verification.** Baseline `0c09ac5498f109f289ac3a85a74ed2c41cf2a5b3`. Presentation only: no audio controller, scheduling, selection, navigation, repetition, database, JSON, voice or Android changes.

`js/player-status.js` formats Activity / actual series name / authored card position and series total / authored step position and full card total / phase from the existing library snapshot and controller state. `js/player.js` renders it in the existing bottom status element. The existing once-per-second display refresh observes `remainingMs`; no playback timers were added. Recall rounds up, clamps negative values, freezes on Pause and follows Resume. Preparation/save/error/end states remain explicit. No question/answer text or help UI restored; no layout or framework changes needed. PLAYBACK documents these semantics.

**327/327 distinct automated scenarios PASS:** study 62 domain + 20 UI; original speech 33; persistence 38; editor 17; mastery 40 + 7 UI; Data 35; shared plan 6; release 6; native executor 16; authored native/focus/document 28; native integration 13 + mobile UI 6. Lifecycle, offline persistence and transaction-close regressions also pass. Windows, Node 24.19.0, Chrome 155.0.0.0, JDK 17.0.20.1. Synthetic libraries and disposable profiles only; no owner data accessed and speech simulated.

`tests/study.test.js` adds four grouped cases covering authored positions through filtered REVIEW, AUDIT, shuffled UNBOUND and multiple series; Previous/Next navigation and both repeats; custom 4.2-second recall with exact injected-clock pause/resume; nonnegative rounded countdown; Stop/Restart/Completed/Error. `tests/study.mjs` adds two Chrome cases for filtered card/step totals, real display countdown using a 2.2-second custom recall, paused freeze, resume, navigation, error details, Stop/Restart/completion and responsive wrapping. Existing status assertions were updated for the requested labels. A new test initially expected due-only Restart to retain already-reviewed cards; corrected its setup to Max Deferred, preserving the existing eligibility behavior. Final run passes. Desktop and 390px paused-status screenshots inspected in Chrome.

Reproduce with the full-suite commands below; `node SR/tests/study.mjs` now runs 62 domain + 20 UI scenarios. The same runner supports `SR_TEST_URL=https://crownandcall.com/SR` for deployed verification. Optional `SR_PLAYER_SCREENSHOTS` captures the status at 1440px and 390px in an existing output directory.

Implementation **`040482ac7341e78378d0aea8f5b95d18f242a37b`** pushed to `origin/main`. [Pages deployment 38670351859](https://github.com/twpaige/CCTTRPG/actions/runs/38670351859) **PASS**. Deployed Chrome tests: **62/62 domain + 20/20 UI PASS** with isolated data and simulated speech (not counted again in 327). [Android workflow 38670352025](https://github.com/twpaige/CCTTRPG/actions/runs/38670352025): **build and publish SKIPPED**. No APK published. Final scope and whitespace review pass.

Owner check: reload [the player](https://crownandcall.com/SR/), listen while navigating/repeating, and compare the displayed series/card/step positions with authored order. Confirm recall and paused countdown agree with audible playback. Browser tests verify display and simulated timing, not actual audio or screen-reader announcements. Existing acceptance-gate status remains unchanged.

## Compact web player and flashcard navigation — 2026-10-14

**Implementation and available automated checks PASS; new audible controls await owner listening verification.** Baseline `0a579565454624df0bac0b1157d1dbd2fb200223`. Web-only scope; Android application, schema, backup/import, editor and shared scheduling/mastery APIs unchanged. Historical reports below describe their tested versions, not current UI instructions.

### Changes and evidence

- `index.html`, `player.css`, `js/player.js`: collapsed settings with REVIEW / All series / 7-day lookahead / shuffle-off defaults and a window summary; visible Start; compact aligned settings. Retain saved desktop voice/rate/recall without writing settings. Late voice discovery honors the saved voice until the user manually selects another. Remove card/title/metadata/question/answer presentation and help UI/code. Keep mastery colors/keyboard support, screen-reader pending feedback, compact saved/status feedback, confirmations and errors. Audio still receives exact authored text.
- `js/review.js`, `js/study.js`: Previous FC moves through the prepared order without reselection; Next Step/Next FC preserve prior forward behavior. Repeat FC loops eligible ordered steps and mutually excludes Repeat Step. Both reset on explicit navigation, Stop, Restart and special resets; Pause/Resume preserves them. Existing session practice tracking and completion APIs prevent duplicate review credit while allowing fresh mastery choices to commit once. Previous FC and step navigation are disabled during completion writes.
- `tests/study.test.js`, `tests/study.mjs`: 8 added domain and 3 added UI scenarios; existing UI assertions adapted for intentionally removed presentation/help. PLAYBACK, SPECIFICATION and BUILD_PLAN updated. No framework or dependency added. Existing `[web-only]` workflow guard will prevent APK build/publication.

**321/321 distinct automated scenarios PASS:** study 58 domain + 18 UI; original speech 33; persistence 38; editor 17; mastery 40 domain + 7 UI; Data 35; shared plan 6; release 6; native executor 16; authored native/focus/document 28; native integration 13 + mobile UI 6. Browser lifecycle, offline persistence and close-during-transaction checks also pass. Windows, Node 24.19.0, Chrome 155.0.0.0, JDK 17.0.20.1. Synthetic libraries, disposable profiles/databases and simulated speech only; no owner library accessed.

New coverage includes Previous FC during question/recall/answer, pending cancellation and stale callbacks, first-card boundary, paused navigation, frozen shuffled UNBOUND order, multi-step FC repetition/ascending eligible steps, unchecking mid-pass, no duplicate credit on repeat/backward navigation, fresh mastery during practice, mutual exclusion and all repeat resets, recall Pause/Resume, AUDIT no-write repetition, collapsed defaults/summary/Start, removed clutter/help, saved preferences and manual voice selection, responsive layout and keyboard controls. Existing KNOWN/BOUND propagation, atomic rollback/retries, receipts and REVIEW/AUDIT regressions remain passing. Chrome screenshots inspected at desktop and 390px for collapsed and expanded settings; responsive checks also cover 900px.

Run the existing full-suite commands below. `node SR/tests/study.mjs` now runs 58 domain + 18 UI cases; use the local server and SR_PLAYWRIGHT/SR_BROWSER as documented. Optional `SR_PLAYER_SCREENSHOTS` points to an existing output directory for layout screenshots. Use `SR_TEST_URL=https://crownandcall.com/SR` for isolated deployed verification.

### Deployment and owner checks

Implementation **`c10e81c931b7a2f8989b0320ff3946baed35f0be`** is pushed to `origin/main`. [Pages deployment 38668563638](https://github.com/twpaige/CCTTRPG/actions/runs/38668563638) **PASS**. The deployed player passed **58/58 domain + 18/18 UI scenarios** in Chrome with isolated data and simulated speech; this repeat verification is not counted again in the 321 total. [Android workflow 38668563641](https://github.com/twpaige/CCTTRPG/actions/runs/38668563641) confirms **build and publish SKIPPED**. No APK published. Final scope review and whitespace checks pass.

Reload [the player](https://crownandcall.com/SR/) in Chrome. Confirm the collapsed default summary, then press Start. Listen while using Next/Previous Step and FC, Repeat FC through several passes, switching repeat modes, unchecking mid-card, Pause/Resume and Stop/Restart. Check that replay leaves saved dates intact and a fresh mastery choice applies once after its answer. Test final KNOWN/Reset confirmations only on material you intend to change. Audible cancellation, full narration, timing and actual assistive-technology announcements still require owner verification; automation does not certify sound. No new G6 or Android physical-device acceptance is claimed.

## Desktop player layout and step navigation — 2026-10-14

**Implementation and available automated checks PASS; audible interaction requires owner verification.** Based on main `bec67139d1ab259fed524cd5a1b8fb21aa9a653e`. Web player only; no Android application, schema, backup format, shared scheduler or editor changes.

### Changes

`index.html`, `player.css` and `js/player.js` provide vertical panels, initially expanded settings that collapse on Start, full-width flashcard/mastery/playback controls, Previous Step, Skip Step, Repeat Current Step and hover/focus/click help. The redundant KNOWN action is removed; mastery 10 and Reset FC retain their safeguards. Settings remain locked during playback and can be inspected without interrupting speech.

`js/review.js` cancels interrupted speech/timers and discards pending choices on navigation. Previous stays within the current card and navigation preserves a manual pause. Repeat resets on navigation, Stop and Restart. Step navigation is unavailable during an atomic completion write. `js/study.js` uses the existing FOCUSED completion path for replayed REVIEW steps, preserving saved credit without automatically rescheduling practice; new explicit mastery choices still save once after a completed answer. AUDIT remains unchanged.

`tests/study.test.js` and `tests/study.mjs` extend the existing harness. PLAYBACK, SPECIFICATION and BUILD_PLAN document these behaviors. The only non-SR change is a minimal `.github/workflows/sr-android.yml` guard: commits containing `[web-only]` skip Android build/publication, allowing this web deployment without an APK. Pages remains independent.

### Executed tests

**310/310 distinct scenarios PASS**, including 13 new domain and 4 new UI scenarios. Windows, Node 24.19.0, Chrome 155.0.0.0, JDK 17.0.20.1. Tests use synthetic libraries and disposable databases/profiles; speech is simulated and no owner library is accessed.

| Coverage | Pass |
|---|---:|
| Desktop study domain / UI | 50 + 15 |
| Original speech / shared plan / release / native engine | 33 + 6 + 6 + 16 |
| Persistence / editor / mastery domain / mastery UI | 38 + 17 + 40 + 7 |
| Authored native/focus/document / native integration / mobile UI | 28 + 13 + 6 |
| Desktop/Android Data workflow | 35 |

New checks cover Skip/Previous during question, recall and answer; stale callbacks; pending-choice cancellation; no cross-card Previous; full repeat cycles and unchecking; pause/resume; Stop/Skip/Restart reset; fresh mastery during practice; no duplicate scheduling; KNOWN propagation and replay of a selected step made KNOWN by propagation; commit-phase navigation protection; panel collapse and control placement; tooltip hover/focus/Escape/click/keyboard; responsive layout and keyboard controls. Existing regressions pass. Workflow `actionlint` passes. Chrome screenshots were inspected for expanded settings and collapsed playback at desktop and narrow widths; layout tests cover 1440, 900 and 390 pixels.

Reproduce using the full-suite commands below. The study runner now executes 50 domain and 15 UI scenarios: start `node SR/tests/serve.mjs`, then `node SR/tests/study.mjs` with SR_PLAYWRIGHT/SR_BROWSER configured as below. Set `SR_TEST_URL=https://crownandcall.com/SR` to verify deployment with isolated data.

### Owner verification and deployment

Implementation **`fa85acc63c25c0ad5f8a47416e45e8f31c464129`** is pushed to `origin/main`. [Pages deployment 38666649565](https://github.com/twpaige/CCTTRPG/actions/runs/38666649565) **PASS**. The deployed player passed **50/50 domain + 15/15 UI scenarios** in Chrome using isolated data and simulated speech; this repeat run is not counted again in the 310 total. [Android workflow 38666649636](https://github.com/twpaige/CCTTRPG/actions/runs/38666649636) confirms both **build and publish SKIPPED**. No APK was published for this task. Final review and whitespace checks pass.

Open [the desktop player](https://crownandcall.com/SR/) in Chrome and reload after deployment. With material you intend to review, start and confirm settings collapse. Expand them during audio, then try Skip Step and Previous during question, recall and answer. Repeat through several full cycles, pause/resume, uncheck and confirm advancement. Select new mastery during repetition and verify a single saved change. Check Stop/Restart clearing Repeat, final-step KNOWN confirmation, and keyboard or touch help. Audible cancellation/resumption, physical touch behavior and assistive-technology announcements remain owner checks; simulated speech does not certify these. Earlier acceptance gates retain their separately recorded status.

## Desktop one-click mastery — 2026-10-14

**Implementation and automated checks PASS; updated audible interaction still needs owner verification.** Authorized desktop Stage 6 usability correction only, based on main `0462891`. No shared scheduling/storage code, Android controls/native playback/Data, editor, standalone mastery page, schema, backup format or signing configuration changed.

### Implementation

`index.html`, desktop-only `js/player.js` / `js/study.js`, and new desktop-only `player.css` replace the dropdown/Queue button with eleven radio-style buttons. Numbers 0–10 sit above exact interval labels. One selected level, an outlined saved level and a distinct pending fill/text are shown. Arrow/Home/End navigation uses roving focus; native button Space/Enter works. Narrow layouts wrap the row without splitting KNOWN.

Ordinary choices and intermediate-step KNOWN use the captured step snapshot and existing `planMastery` / `StepCompletionController` APIs synchronously: no speech cancellation or asynchronous gap before queuing, and the final choice wins. Completion still uses the existing atomic scheduling/receipt API and successful-answer timestamp. Saved feedback appears only after the write succeeds and identifies the card/step. Stop/Skip discards unfinished choices. Final-step KNOWN pauses for its existing card/BOUND confirmation, then resumes only a previously playing, still-current step. Cancel retains its previous choice. Special Reset/KNOWN and AUDIT safeguards remain intact.

Updated PLAYBACK, SPECIFICATION and BUILD_PLAN remove obsolete desktop queue/pause instructions. `study.test.js` / `study.mjs` extend the existing harness; no new framework. Neither desktop module nor the new stylesheet is included in Android's asset allowlist/build inputs. No Android update is needed for this feature; the unchanged repository workflow may automatically rebuild on its existing broad desktop/test path triggers.

### Executed tests

**293/293 scenarios PASS**: all previous 282 scenarios, adapted for the intentionally changed desktop control, plus 7 domain and 4 UI scenarios. Windows, Node 24.19.0, Chrome **155.0.0.0** headless, JDK 17.0.20.1. Disposable browser profiles, synthetic libraries and simulated speech only; no owner data accessed.

| Coverage | Pass |
|---|---:|
| Desktop study domain / UI | 37 + 11 |
| Original speech / shared plan / release / native engine | 33 + 6 + 6 + 16 |
| Persistence / editor / mastery domain / mastery UI | 38 + 17 + 40 + 7 |
| Authored native/focus/document tests / native integration / mobile UI | 28 + 13 + 6 |
| Desktop/Android Data workflow | 35 |

New checks exercise uninterrupted question/recall/answer selection, synchronous last-choice wins, commit-only-after-answer, no leakage to the next step, intermediate KNOWN, card/final BOUND confirmation and propagation, cancellation with prior pending choice, preservation of manual pause, Stop during outstanding confirmation, all eleven labels, current/pending/saved display, removal of Queue, rapid clicks, playing Skip/Stop, keyboard navigation and 390px layout. Existing due/early/AUDIT scheduling, resets, retries, duplicate receipts, stale writes and all Android regressions pass. UI testing exposed focus loss when temporarily disabling controls; focus restoration was fixed and the suite rerun. UTF-8 validation and screenshot inspection also checked visible feedback text and compact layouts at 1440/900/390px.

Reproduce with the existing full-suite commands below. In particular, `node SR/tests/serve.mjs` then `node SR/tests/study.mjs` runs the 37 domain and 11 UI scenarios (set SR_PLAYWRIGHT/SR_BROWSER as documented). Same runner supports `SR_TEST_URL=https://crownandcall.com/SR` for isolated deployed verification. Native regression commands are unchanged; no Android build change is necessary.

### Owner verification and deployment

Reload [the desktop player](https://crownandcall.com/SR/) in your usual Chrome profile. During actual audio, click several ordinary levels and confirm narration continues without replay/pause, the last level saves after the answer, and the next step shows its own mastery. Check Stop/Skip cancellation and final-step KNOWN cancel/confirm on material you intend to change. The actual audible experience and assistive-technology announcement quality are not certified by silent automation. Earlier owner audio evidence and open G6 checks remain separate.

Implementation `fe917a56977e3dd477a81781ca28ef3dba95b5a7` plus line-ending cleanup **`f5fb8865a4e3042134d902a26f8eb6025423c66c`** are pushed to `origin/main`. [Pages deployment 38664372233](https://github.com/twpaige/CCTTRPG/actions/runs/38664372233) **PASS**. The deployed [desktop player](https://crownandcall.com/SR/) passed **37/37 domain + 11/11 UI scenarios** using the same Chrome runner, isolated database and simulated speech. This repeat verification is not added again to the 293 distinct-scenario total. The final combined diff passes whitespace checks and touches only desktop implementation/tests and directly affected documentation. No Android installation is required for this change.

## Data & Recovery simplification — 2026-10-14

**Implementation and available automation PASS; Samsung update retention and real OneDrive/Downloads picker behavior require owner verification.** This is the authorized shared Data correction, not Stage 8, 9 or 11. Baseline: current main `b6614e4`. Historical evidence below is retained as originally tested; its old recovery controls are no longer current instructions.

### Changes and safety

- `data/index.html` / `panel.js`: one shared two-action page, validated incoming counts, automatic complete outgoing backup, one modal Cancel/Confirm Import, prominent success and actual backup filename. New small `data/files.js` implements desktop local-time names and exact UTF-8 read-back. Chrome needs a fresh **Choose Backup Destination** click after validation; its picker receives the incoming handle as a folder hint. Android automatically opens its existing system creation picker with the incoming document location hint.
- `js/backup.js` / `db.js`: remove historical-copy export and new pre-import/pre-migration snapshot creation. Keep the same schema/version/store definition; existing records remain untouched. Atomic live-store replacement, exact stale-snapshot check, format-1/2 conversion, step progress and receipts remain.
- Import holds the existing library lock through backup and confirmation, refuses active native playback, reconciles available Android completions before export, and blocks replacement if more completions appear. No playback engine/service/queue change. Cancellation keeps legitimate completion credit and any already-verified external file.
- `MainActivity.java`: add the bundled file helper to its existing asset allowlist, pass SAF's incoming-document location hint, and reject new playback while a document operation is pending. App ID, origin, signing setup, version allocation and release workflow are unchanged.
- Update storage, authoring, listening, specification and build-plan instructions. Adapt retired recovery-control tests to external backup and inert-record preservation; extend the existing Data runner and add a small headless picker helper backed by disposable real files. No new framework.

### Executed tests

Windows, Node 24.19.0, installed Google Chrome **155.0.0.0** headless, JDK 17.0.20.1, Android API 35. **282/282 grouped scenarios PASS.** This is the previous 256 total with the old 10 Data scenarios replaced by 35 expanded scenarios, plus one historical-record preservation scenario. Tests use disposable profiles/databases/files; no personal library was opened.

| Suite | Passed |
|---|---:|
| Desktop speech / shared plans / release guards / original native engine | 33 + 6 + 6 + 16 |
| IndexedDB persistence / desktop editor | 38 + 17 |
| Mastery domain / UI | 40 + 7 |
| Desktop study domain / UI | 30 + 7 |
| Authored native Java, focus and document stream regressions | 28 |
| Native integration domain / mobile listening UI | 13 + 6 |
| Shared Data desktop / Android workflow | 35 |

The Data suite covers both platforms' two-action UI/removal/parity, validation-before-backup, input and destination cancellation, write/read-back failure, complete empty backup, confirmation cancellation, old-tab mutations before/after verification, exclusive playback/write locking, atomic rollback, populated version-1 import, version-2 mastery round trip, empty import, native active/late/unreconcilable completions and successful pending-credit reconciliation, local timestamps/suffixes, same-folder hints and refusal to overwrite existing files. Existing browser-process restart, offline storage and page-close-during-transaction rollback also pass. Existing historical pre-import and pre-migration records survive migration/reopen/replacement unchanged.

`gradlew.bat --no-daemon assembleRelease lintRelease` **PASS** locally: 0 lint errors, 2 existing warnings (`SetJavaScriptEnabled`, `DataExtractionRules`). Existing deprecated-API compiler note remains. Local SDK emitted a missing platform-tools/license warning but completed the build successfully; no license or signing configuration was changed. Local APK is unsigned; the existing CI signs/releases the distributable APK.

Reproduce using the existing commands: `node SR/tests/run.mjs`, mobile `plan.test.mjs`, `release.test.mjs`, `authored.test.mjs`, `run-native.ps1`; run `node SR/tests/serve.mjs`, then browser runners `browser.mjs`, `editor.mjs`, `mastery.mjs`, `study.mjs`, `native.mjs`, `android-recovery.mjs`. Configure `SR_PLAYWRIGHT`, `SR_BROWSER` and `SR_JAVA_HOME` as in earlier sections. CI runs the same suites with its existing pinned tools.

### Limits and owner checks

Chrome DOM/IndexedDB/Web Locks and desktop temporary-file writes/readbacks were exercised. Headless system pickers and Android bridge/provider responses are simulated; native document stream failure cases run in host Java. No audible test, real OneDrive cloud sync, actual directory-picker selection, or physical APK update retention is claimed here.

1. Open [desktop Data](https://crownandcall.com/SR/data/index.html) in Windows Chrome. Reload old tabs. Use **Save Complete JSON Backup** for a dated external backup. For a disposable test library use [isolated Data](https://crownandcall.com/SR/data/index.html?test=SRLearning-test-owner), not your personal library.
2. Import valid populated and empty JSON: check counts, choose the incoming folder in **Choose Backup Destination**, verify the timestamped file, cancel confirmation once, then repeat and Confirm Import. Test OneDrive and local Downloads, including two saves in the same minute, and compare exported representative content/mastery/dates. The picker may ignore the initial-location hint; explicitly choose the intended folder. Read-back does not certify cloud sync.
3. Before updating Android, keep a complete external backup. Install the signed update **over the existing app without uninstalling/clearing storage**. Verify counts, exact representative Q/A, step mastery/dates, close/reopen and export. This physical update/data-preservation check remains open.
4. On Samsung, Stop playback, open Data and perform the same import/cancel/confirm checks in OneDrive and Downloads. Confirm the automatic backup contains outgoing data and pending completed-step credit. Check the actual backup folder and filename; wait for OneDrive sync before another device. Verify existing locked-screen/Bluetooth listening still works.

### Publication

Implementation **`2b5b51ced22ef1edb5da9796a12bf48c8e0b0f31`** is on `origin/main`. [Android workflow 38657733045](https://github.com/twpaige/CCTTRPG/actions/runs/38657733045) **PASS**: full regressions, release build/lint, original-identity signing, increasing-version upgrade guards, publication and download verification. [Pages deployment 38657732182](https://github.com/twpaige/CCTTRPG/actions/runs/38657732182) succeeded. All **35/35 Data scenarios additionally passed against the deployed HTTPS site** in a disposable Chrome profile; this rerun is not added again to the 282 distinct-scenario total. An isolated 390px confirmation screenshot was inspected: counts, filename and Cancel/Confirm Import fit without horizontal overflow.

Signed **[SR.apk 0.2.100901](https://github.com/twpaige/CCTTRPG/releases/download/sr-android-100901/SR.apk)** is available in [release sr-android-100901](https://github.com/twpaige/CCTTRPG/releases/tag/sr-android-100901). Public metadata matches the implementation SHA, application ID **com.crownandcall.srproof**, versionCode **100901** (greater than 100801), and original certificate SHA-256 **ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb**. Independent public download hash matched **4fedfef6e301aa5b3cda75494c8f99f241216555565e589029883eae8b1d3287**. Local `apksigner verify` passed; certificate inspection matched the original identity. APK package metadata reports versionName **0.2.100901** and the unchanged application ID. Packaged Data HTML/JS/file helper and shared backup/database modules exactly match committed Git blobs (Windows checkout line endings differ).

No signing credentials or publishing configuration changed. The released APK's **physical in-place update/data retention and OneDrive/Downloads destination behavior remain OWNER VERIFICATION REQUIRED**. No later stage was begun.

## Stage 10 corrections — notification recovery and Android import, 2026-10-14

**G10: core authored locked-screen Samsung playback OWNER-VERIFIED on 0.2.100701; these corrections still require physical verification.** Stage 10 remains ACTIVE. Stage 7 is superseded; 8, 9 and 11 remain on hold.

### Actual owner observations, preceding this correction

On Samsung **SM-S931U**, the owner installed **0.2.100701 over the existing app**, saw the REVIEW/AUDIT interface correctly, imported the **1,000-card synthetic stress library**, heard authored flashcards through native Android TTS/Bluetooth, continued listening with the **screen locked**, and successfully used **lock-screen playback controls**. Text notifications played through the headphones but left SR paused until manual Resume. These are actual owner observations, not simulated results. They establish those specific behaviors only: exact pre-update record equality, all scheduling/manual-mastery cases, long recall, process loss, offline speech and OneDrive round-trip equality are not newly inferred as passed.

### Corrections and practical limits

- Native speech pauses for duckable focus loss and automatically resumes the interrupted segment/remaining recall only on Android focus GAIN. The focus request stays registered while waiting; no restart timer is used. Permanent loss, ambiguous transient loss (including calls), Bluetooth disconnect and intentional Pause/Stop cancel automatic recovery. Notification/UI Pause remains usable during a temporary interruption. Late/duplicate callbacks cannot credit an unfinished answer.
- Android audio focus identifies a loss category, not the originating app. Conservative policy: only **LOSS_TRANSIENT_CAN_DUCK → GAIN** resumes automatically. A notification reported as ordinary transient loss still needs manual Resume; a provider/device that misclassifies an interruption cannot be identified by this API. The updated Samsung notification/call behavior remains unverified. [Android audio-focus guidance](https://developer.android.com/media/optimize/audio-focus).
- Android validates incoming JSON, automatically exports the current library, asks for a destination through CREATE_DOCUMENT, closes and reopens the file, and requires exact UTF-8 byte equality before enabling one explicit replacement confirmation. The local timestamp name is **SR-Backup-YYYY-MM-DD-HHMM.json**; repeated same-minute requests use a suffix and the system picker resolves existing-name collisions. The actual provider filename is displayed. Nonempty returned documents are refused before writing. [Android document creation](https://developer.android.com/training/data-storage/shared/documents-files#create).
- Cancellation, write/read-back failure, invalid JSON and stale current-library contents block replacement. Existing atomic restore/recovery and final transaction-time safety match are unchanged. Playback must be stopped and completions saved; native and JS guards remain. Desktop export/reselect/checkbox recovery remains unchanged. Read-back verifies provider-accessible bytes, not completed OneDrive cloud synchronization.

### Executed automated evidence

**256/256 scenarios PASS: all 234 prior Stage 1–10 scenarios plus 22 correction scenarios.** Same isolated Windows/Node 24.19.0, Chrome 154 and JDK 17 environment as above; owner IndexedDB untouched.

| Coverage | Result |
|---|---|
| Existing suites | All 234 prior scenarios pass, including full desktop backup/reselect/recovery regression |
| Added focus tests | 7 pass: duckable loss/gain and final-answer completion, recall remainder, permanent/ambiguous transient loss, user Pause, Stop with late callbacks, Bluetooth/manual paused state, duplicate losses/gains |
| Added external-backup tests | 5 pass: local timestamp/suffix, exact Unicode read-back, refusal to overwrite nonempty document, write failure, truncated/changed/extra/unavailable verification |
| Added Android recovery UI | 10 pass: incoming picker cancel, invalid JSON, backup picker cancel, write/unverified failure, mutation during backup, mutation after verification, leaving without confirmation, atomic rollback, successful counts/filename/previous recovery, unsaved-completion guard |
| Production Java | Compiles against Android API 35; existing deprecated-API note only |

Native focus and document streams are simulated in host tests; Android picker/bridge is simulated in browser UI tests, with real IndexedDB transactions. The system's actual filename collision handling and OneDrive behavior require phone testing. Initial UI testing exposed a CSS display rule that kept the old checkbox visible; the native-only wrapper now hides it correctly. A test callback race was fixed by waiting until the simulated backup picker had opened. Both corrections were rerun successfully.

Reproduce with the existing regression commands plus `node SR/mobile/tests/authored.test.mjs` (now 28 scenarios) and `node SR/tests/android-recovery.mjs` (10 scenarios, server/Playwright configuration unchanged). An isolated 390px Android confirmation screenshot was also inspected: numbered instructions, counts, actual backup name and one confirmation button are readable; the desktop checkbox is hidden on Android.

### Published correction release

Implementation **`da8b917723cfb307c0f56c5c7b0e58f3bed35593`** is on `origin/main`. [Android workflow 38630172438](https://github.com/twpaige/CCTTRPG/actions/runs/38630172438) passed all suites, release build/lint, signing, identity/version upgrade guards and release-download verification. [Pages deployment 38630171653](https://github.com/twpaige/CCTTRPG/actions/runs/38630171653) succeeded.

Signed **[SR.apk 0.2.100801](https://github.com/twpaige/CCTTRPG/releases/download/sr-android-100801/SR.apk)** is available in [release sr-android-100801](https://github.com/twpaige/CCTTRPG/releases/tag/sr-android-100801). Public build metadata matches this implementation commit, versionCode **100801**, application ID **com.crownandcall.srproof**, and original certificate SHA-256 **ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb**. Independent public download SHA-256 matched **ddd56beae66e21ee5157d87e4c272a17fd8123d854d5e2167860d3d62c9b01da**; its packaged Data asset contains the new automatic-backup flow. Signing identity, origin and schema are unchanged. The new APK's physical notification recovery, provider verification and update behavior remain **OWNER VERIFICATION REQUIRED**. No subsequent stage was begun.

Owner verification: install the updated signed APK without uninstalling; while locked/Bluetooth, trigger SMS and another app notification, then test Pause/Stop during interruption, a phone call and disconnect/reconnect. Check no skipped answer/early credit. Import through OneDrive and Downloads, verify the timestamped backup and visible counts, cancel both pickers, leave confirmation without replacing, and restore only after verified backup. Test two backups in the same minute without overwriting. Reopen the old backup and compare representative JSON records. Wait for provider synchronization before cross-device transfer. See [Android guide](ANDROID_LISTENING.md).

## Stage 10 — authored Android listening, 2026-10-14

**G10: implementation, automated checks and signed release PASS; physical Samsung acceptance OPEN.** Stage 10 is ACTIVE; Stage 7 is SUPERSEDED and Stages 8, 9 and 11 are ON HOLD. No later stage is started. This section supersedes earlier statements that Android can only play fixed samples; all dated prior-stage evidence below is preserved.

Owner authorized the existing WebView/native TTS route with a **simple in-memory completion queue**, replacing the preflight's durable-journal requirement. Up to 512 completions / 16 MiB are retained without eviction; capacity pauses before the next step. Visible/reopened UI reconciles through existing atomic IndexedDB scheduling/receipt rules and removes only successfully handled records. Stop retains queued completions. Unexpected process death can lose every unsaved entry, so those steps may be reviewed again. No automatic speech recovery is implemented or promised.

### Implementation and compatibility

- `js/native-study.js` reuses shared REVIEW/AUDIT selection, exact Q/A/step order, revision/generation checks and the existing `completeStep` transaction. No scheduler, database-schema, migration or JSON-format change.
- Native version-2 plans carry per-step identity and original progress. `PlaybackEngine`, `Plan`, `CompletionQueue` and `PlaybackService` execute prepared steps without WebView dispatch, segment long text exactly, retain full recall waits with bounded wake renewal, credit only the last successful answer segment, skip whole cards and repeat AUDIT. Session handoff is bounded at 16 MiB and fails without truncation.
- Mobile Listening supplies selection, offline voice/recall/rate, native controls, saved mastery, confirmed manual changes and pending after-answer mastery. Pending changes require a fresh Start after completion. Data/JSON recovery keeps the existing safety verification and rollback, adds clear manual OneDrive guidance and prominent restore success, and blocks transfer until native playback is stopped and completions saved.
- Manifest/application ID `com.crownandcall.srproof`, original signing certificate, `https://sr.invalid/`, IndexedDB `SRLearning` and schema/JSON version 2 are preserved. Version-1 backups still migrate through the existing rules. No Capacitor, cloud API, account requirement, backend, Android content editor or new native learning database. The old sample/diagnostic path remains for regression compatibility.
- Workflow adds focused tests to the existing build/lint/sign/publish process; signing and version allocation policy are unchanged. Baseline was `89c6426` on `origin/main`, including the repository's synthetic 1,000-card/5,000-step stress file, which was used without modification. No owner database or private content was opened by automation.

### Executed local evidence

Windows, Node **24.19.0**, JDK **17.0.20.1**, Chrome headless **154.0.0.0** in disposable profiles. **234/234 scenarios PASS: all 199 existing + 35 focused Stage 10.** Grouped scenarios count once regardless of assertion count. Speech, Android bridge, native time and process-death state are simulated in these tests; IndexedDB, transaction rollback, DOM and browser reload behavior are real. Native Java is also compiled against Android API 35; only the existing deprecated-API note remains.

| Check | Result | Evidence |
|---|---|---|
| All existing scenarios | PASS, **199/199** | 33 desktop + 6 shared plans + 6 release + 16 native; 38 persistence; 17 editor; 39 + 7 mastery; 30 + 7 study. Browser process restart/offline storage/restore integration also passed |
| Authored native/parser/queue | PASS, **16/16** | Production JS plan parsed by Java; exact segmented Unicode; one-hour recall and remaining-time pause; final-answer-only credit; duplicate/stale callback rejection; partial Stop/Skip; native AUDIT repeat; no active occurrence before a paused step begins; 512-bound/no eviction/drain-resume; byte bound; batch/head removal; fresh idle state; error retry; 1,000-card synthetic plan |
| Shared native integration | PASS, **13/13** | REVIEW/AUDIT selection parity; exact text and long/zero/override recall; oversized rejection; due versus early-at-start; duplicate-safe acknowledgement retry; AUDIT isolation; stale revision/generation retention; transaction failure rollback/retry; confirmed pending final mastery; backwards clock rejection; JSON receipt/progress recovery |
| Mobile UI | PASS, **6/6** | Authored native-only Start; visible completion save/Data guard; paused pending mastery and fresh selection; confirmed KNOWN/AUDIT BOUND semantics; reload without speech; 390px layout/no uncaught errors. Bridge/audio simulated |
| Visual inspection | PASS (agent) | Disposable narrow-screen screenshot inspected; readable controls and no horizontal overflow. Not owner usability approval |
| Android identity/update | SOURCE PRESERVED; device OPEN | App ID/origin/schema/manifest/signing configuration unchanged; actual Samsung update/data preservation not performed |
| Locked/offline/Bluetooth/OneDrive | OWNER VERIFICATION REQUIRED | No Stage 10 physical-device result inferred from unit/browser tests or earlier fixed-sample observations |

The new parser suite uses a checksum-pinned **test-only** `org.json` JAR for host-JVM execution; it is not an APK/runtime dependency. The existing 1,000 × 10 storage/selection benchmarks also passed. No tests are recorded as passed without a successful rerun: the initial UI runner was corrected to wait for asynchronous AUDIT Start before inspecting its plan, and the full focused UI suite then passed. A paused-step occurrence edge case was fixed and covered before publication.

### Reproduce and owner qualification

Run the existing commands in the Stage 6 section below, including `study.mjs`, then add:

```powershell
# JDK 17; SR_PLAYWRIGHT / SR_BROWSER as in the existing browser runners.
$env:SR_JAVA_HOME = 'C:\path\to\jdk-17'
node SR/mobile/tests/authored.test.mjs
# With node SR/tests/serve.mjs running:
node SR/tests/native.mjs
```

[Android listening and Samsung checklist](ANDROID_LISTENING.md) documents installation over the existing APK, real authored REVIEW/early-date isolation, long locked Bluetooth/offline playback and recall, notification/interruption controls, AUDIT/manual mastery, queue reconciliation and accepted process-loss behavior, plus safe OneDrive JSON round-trip verification. Matching file sizes alone do not prove record equality. These checks remain OPEN; earlier G1–G6 and Stage 9 unperformed checks do not become passes through this implementation.

### Published release evidence

Implementation commit **`db0f93db37f5a57c9f29c7882c28d5c611d47526`** was pushed to `origin/main`. [Android workflow 38621770197](https://github.com/twpaige/CCTTRPG/actions/runs/38621770197) completed **successfully**, including the existing and focused test suites, release compilation/lint, signing, identity/version upgrade guards, publication and download verification. [Pages deployment 38621769805](https://github.com/twpaige/CCTTRPG/actions/runs/38621769805) also succeeded; the public Data page was fetched and contains the new prominent restore result and OneDrive guidance.

[Release `sr-android-100701`](https://github.com/twpaige/CCTTRPG/releases/tag/sr-android-100701) provides the signed [SR.apk — version 0.2.100701](https://github.com/twpaige/CCTTRPG/releases/download/sr-android-100701/SR.apk). Public `build-info.json` confirms source commit above, application ID **`com.crownandcall.srproof`**, versionCode **100701**, original certificate SHA-256 **`ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb`**, and APK SHA-256 **`d8756c53ca96d16af52a95f212b3d9f6fad92da2422b5ffc2288891012d817cf`**. The public APK was independently downloaded (67,195 bytes) and its SHA-256 matched. Signing credentials were neither changed nor exposed.

Install as an update **without uninstalling** after saving a dated backup. Physical installation/data retention, authored locked-screen/Bluetooth/offline speech, native lifecycle/long waits and actual OneDrive provider round trip remain **NOT YET VERIFIED for this APK**. No earlier stage's owner observations are reused as a Stage 10 device pass. Work stops here pending owner verification or separate authorization; no subsequent stage begins.

## Stage 6 — authored desktop REVIEW / AUDIT, 2026-10-13

**G6: CORE DESKTOP AUDIBLE PLAYBACK AND SCHEDULING OWNER-VERIFIED / formal full-checklist closure still OPEN.** Implementation and available local automation are complete. Stage 7 is not started. All owner content remains in its existing origin/profile; no personal database was opened, seeded, cleared or restored by automation. Schema/JSON format remain 2.

### Owner's actual desktop acceptance observations — 2026-10-13 (after deployment)

The owner used the live Stage 6 desktop player on their **home computer**, created a **new Delaware flashcard** locally because the daytime computer's States/Delaware library was not present on this computer, and confirmed that the authored card **played beautifully**. They specifically confirmed that playback traversed **all eligible steps in order**, spoke the questions, waited the **correct recall durations**, narrated the answers, and **automatically advanced** without intervening clicks. Afterward the owner opened the Mastery page and confirmed the **next-review dates changed as expected** following completed REVIEW playback. These are owner-observed audible and scheduling results, not simulated tests.

**Result: PASS for core real-content desktop REVIEW playback and owner-observed scheduling.** This resolves the previously unverified core Delaware audible milestone. It does **not** establish that every G6 manual checklist item passed: Pause/Resume/Skip/Stop/Restart in the new authored player, long recitation and long recall, second-tab conflict on the owner's profile, pending mastery during playback, AUDIT audible behavior, alternate voice, and detailed early-versus-due date isolation were not separately reported. Preserve their status as not owner-verified, despite automated coverage. Do not claim formal full G6 closure without that evidence or an explicit owner-approved reduced gate.

**Separate local libraries:** The home computer's new Delaware card and the daytime computer's earlier States/Delaware card are distinct local IndexedDB records. No synchronization or merge was performed. Export dated JSON backups before transferring or replacing either library. Physical Android authored-card playback remains unavailable; Stage 6 Android APK retains the sample listener.

Live player: **https://crownandcall.com/SR/**. Editor: **https://crownandcall.com/SR/library.html**. [Playback/Windows guide](PLAYBACK.md). Implementation commit **`34872c52dae44b0731a4e960fcd7df7cc8b9e2d1`** was pushed to `origin/main`. [Pages deployment 38501349232](https://github.com/twpaige/CCTTRPG/actions/runs/38501349232) succeeded. The deployed HTTPS player then passed the complete **30/30 domain + 7/7 UI** Stage 6 suite in a new disposable Chrome profile, including live second-tab exclusion and reload recovery. This used synthetic test data and simulated speech, never the owner's profile.

[Android workflow 38501349789](https://github.com/twpaige/CCTTRPG/actions/runs/38501349789) completed **successfully**, including all regressions/new browser scenarios, release compilation/lint, signing, upgrade checks, publication and download verification. [Release `sr-android-100601`](https://github.com/twpaige/CCTTRPG/releases/tag/sr-android-100601) provides [SR.apk](https://github.com/twpaige/CCTTRPG/releases/download/sr-android-100601/SR.apk). Its public `build-info.json` was fetched and confirms source commit `34872c52dae44b0731a4e960fcd7df7cc8b9e2d1`, application ID `com.crownandcall.srproof`, versionCode **100601**, original certificate SHA-256 `ee98699416f616b1707fee62d4311a9de26c30c848b6abd6206112db01f0f0cb`, and APK SHA-256 `0b97d9c6530262036bd1e58958c6adf9459dd6b2eebb30f27c0e39e5de5e2ba8`. Signing credentials were neither changed nor exposed.

This APK still contains the native fixed-sample listener and existing Data/storage functionality, including the updated shared transaction helper/native-safe Data navigation. It does **not** contain desktop authoring/mastery/player HTML, native authored REVIEW/AUDIT, long-recall native changes, or scheduling receipts from native playback. Physical installation as an update, data retention and audio regression on the owner's phone were **not performed** for version 100601. No phone update is needed to hear Delaware on the desktop website.

### Owner observations carried forward

The Stage 6 assignment reports that the owner personally used the live mastery page with the actual States series and Delaware card, adjusted and persisted mastery, confirmed final-step KNOWN propagation, and reset the entire card to mastery 0 with a 15-minute interval. This closes the previously unrecorded owner mastery observations for those actions. It is not agent inspection of private text, Stage 6 audio evidence, or Android upgrade/long-recitation evidence. Other historical device checks remain as recorded below.

### Files and behavior

- `index.html`, `js/player.js`, `js/study.js`: real IndexedDB REVIEW/AUDIT player; voice inventory/fallback, selectors, exact text/state, controls, mastery queue, confirmed resets/KNOWN, refreshed continuous AUDIT and safe scheduling retry.
- `js/review.js`: extend the existing speech controller with prepare/commit/cycle hooks, cancellation-safe asynchronous work, retained speech segment cursor, full recall overrides and chained long timers. `js/speech.js` and the original sample/`Joshua18.html` are unchanged.
- `js/db.js`: exclusive playback ownership and shared short-lived mutation locks. Read/export is allowed; competing playback/edit/mastery/import fails without overwriting. Existing revision/generation/transaction checks remain.
- `js/mastery.js`: special-action clock is evaluated after confirmation (explicit test timestamps still supported). The existing policy/completion/confirmation APIs remain authoritative.
- `library.html`: preserved editor relocated within the same origin. `js/editor.js`, `mastery.html`, `js/mastery-panel.js`, `data/panel.js`: updated navigation with isolated-test database propagation. Native Data's existing return route is preserved.
- `tests/study.test.js`, `study.html`, `study-runner.js`, `study.mjs`: dependency-free domain harness and existing development-only Playwright runner. Old editor/mastery runners now use the editor's new URL; prior coverage remains.
- `.github/workflows/sr-android.yml`: add the new suite and editor-path trigger; signing/version allocation/publication remain unchanged. No native Java, manifest, plan, asset allowlist, application ID or signing configuration changed.
- Specification, build plan, storage/authoring guides, this report and new `docs/PLAYBACK.md`: current contract, scope, owner steps and deferred native requirements.

### Executed local evidence

Windows, Node **24.19.0**, installed Google Chrome **155.0.0.0** headless in disposable profiles, existing Playwright runtime, JDK **17.0.20.1**. **199 scenarios passed: 162 prior + 37 Stage 6.** Scenario totals count grouped tests, not each assertion. Speech callbacks and clock advances in Stage 6 tests are simulated; IndexedDB, transactions, Web Locks, browser reloads, DOM controls and navigation are real.

| Check | Result | Evidence |
|---|---|---|
| Prior desktop / shared plan / native / release | PASS | 33 + 6 + 16 + 6 = **61/61**; unchanged native executor, signature/version safety tests |
| Persistence and backup | PASS | **38/38**, plus actual browser-process restart, offline storage, Data download/reselection/recovery and interrupted-import rollback; original 33 speech cases also execute in Chrome |
| Editor | PASS | **17/17**, including 100-step authoring, content equality, saved progress, revision conflicts and browser restart |
| Stage 5 domain / UI | PASS | **39/39 + 7/7**, migration, selection, per-step writes, receipts, recovery and mastery controls |
| Stage 6 domain/storage | PASS | **30/30**, real authored repository fixtures passed through the production player and completion API |
| Stage 6 browser UI | PASS | **7/7**, asynchronous preferred voice, authored Q/A/pending mastery, second-tab exclusion/editor draft retention, paused Skip/KNOWN confirmation, continuous AUDIT/reset refresh, reload/no false credit, narrow layout/keyboard/no uncaught errors |
| Selection and ordering | PASS | Due now/lookahead/Max Deferred, final anchor, individual eligibility, series scope, BOUND order, UNBOUND shuffle, exact ascending steps, no interleaving and multi-card progression |
| Timing and long text | PASS (simulated time/speech) | Zero/default/override recall; full wait beyond 2,147,483,647 ms chained without overflow; Unicode answer above 2,000 characters preserves concatenated wording; interrupted segment only repeats; Stop/Skip never credit partial answer; unrepresentable duration errors before speech |
| Completion and retry | PASS | No receipt before entire answer; due versus early-at-start; pending mastery; duplicate/late callback; speech failure/watchdog; receipt failure rolls back; same receipt/time retries without answer replay; lost acknowledgement cannot double-credit |
| Races and ownership | PASS | 20 repeated Stop/Restart cycles; repeated Start; Stop/Pause/Skip during preparation, speech/recall/save; Stop during delayed confirmation; old noncooperating progress write rejects stale completion; live second tab cannot narrate or save; read/export works |
| AUDIT and explicit actions | PASS | ALL/one series, final-only KNOWN targets, full BOUND collapse, repeated cycles with zero automatic writes, reset-final/card/series scopes, cancellation, pending final KNOWN and explicit series confirmation |
| Compatibility / data preservation | PASS | Existing complete schema-2/version-1 conversion and receipt round-trips; content/legacy progress/settings unaffected by automatic review; no schema migration |
| Workflow static check | PASS | Existing checksum-verified `actionlint`, no diagnostics |
| Visual inspection | PASS (agent) | Inspected isolated narrow-layout screenshot; controls/text readable, no horizontal overflow. Not owner usability approval |
| Actual audible Delaware / native voice output | BLOCKED | Not heard by the agent. Owner must follow the live-site checklist |
| Physical Android authored playback / long waits | NOT IMPLEMENTED / NOT VERIFIED | Fixed-sample native behavior retained; no claim from desktop tests |

During testing, one moved-editor URL replacement also changed a Data test URL; that test fixture was corrected and the complete Stage 5 runner passed. Two added save-race tests initially tried to poll a transaction that completed too quickly to observe; they now explicitly delay its acknowledgement and verify Pause/Stop deterministically. No failed test is classified as a pass without the corrected rerun.

### Reproduce and remaining acceptance

Start `node SR/tests/serve.mjs` from the repository root. In another PowerShell window:

```powershell
node SR/tests/run.mjs
node SR/mobile/tests/plan.test.mjs
node SR/mobile/tests/release.test.mjs
& .\SR\mobile\tests\run-native.ps1 -Jdk 'C:\path\to\jdk-17'
# Use an existing development Playwright installation and Chrome executable:
$env:SR_PLAYWRIGHT = 'C:\path\to\node_modules\playwright'
$env:SR_BROWSER = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
node SR/tests/browser.mjs
node SR/tests/editor.mjs
node SR/tests/mastery.mjs
node SR/tests/study.mjs
# To test deployed files in another disposable profile:
$env:SR_TEST_URL = 'https://crownandcall.com/SR'
node SR/tests/study.mjs
```

Use actual local tool paths. This chat's source is `C:\Users\tpaig\Documents\Codex\2026-10-12\files-pasted-by-the-user-dex\work\CCTTRPG\SR\index.html`; the exact live and localhost opening steps are in [PLAYBACK.md](PLAYBACK.md). Localhost does not contain the owner's live-site data. Do not double-click the HTML file.

Owner actions: listen to actual Delaware using REVIEW → States → Max Deferred (or AUDIT if KNOWN), confirm exact wording/order and recall duration, exercise controls, verify due/early/AUDIT outcomes and deliberate mastery choices, then report voice/browser and results. Long speech/recall, offline voice and background sound still need empirical checks. **No G6 PASS is claimed from simulated audio.**

Known limits: desktop HTTPS/localhost Chrome with Web Locks required for playback; old predeployment tabs must be closed/reloaded; no offline cold launch or crash-resume playback; the 120-second per-segment watchdog fails visibly rather than inventing success. Recall can be delayed by browser/system suspension. Native authored-step plans, durable step receipts, long-wait wake renewal and physical locked-screen qualification remain separately authorized future work. The new desktop player is not bundled into the APK.

---

## Historical Stage 5 delivery (superseded status notes)

## Stage 5 — step mastery, migration, REVIEW and AUDIT, 2026-10-13

**G5: PASS for implemented policy, migration and desktop UI automated acceptance. Owner verification of the private live library and physical Android upgrade remains pending. Stage 6 has not started.** Stage 4 remains formally CLOSED/PASS. Earlier test evidence below is preserved without reclassifying unperformed device checks.

Source baseline: `32cdd78c69aa0eb59d805696ba4ee9910dfe3706`, fetched and fast-forwarded from `origin/main`. The owner explicitly approved copying existing card progress to **every step**, preserving mastery, last-reviewed and next-due values, making level 10 KNOWN with null due, and **not** propagating KNOWN across cards during migration. That decision supersedes the older card-level/mastery-band/90-day-L10 proposals. The current specification/build plan document the new policy; the original build plan is retained as clearly superseded historical material.

Desktop entry points: **https://crownandcall.com/SR/** and **https://crownandcall.com/SR/mastery.html**. Implementation commit: `688ac4f1aebf026c0d56144278691ca784e84001`, pushed to `origin/main`. [Pages deployment](https://github.com/twpaige/CCTTRPG/actions/runs/38455279734) succeeded. The complete Stage 5 suite then passed against the deployed HTTPS site in a disposable Chrome profile: **39/39 domain/storage and 7/7 UI scenarios**. Its separate 1,000-card/10,000-step sample took 1,308.0 ms overall and 5.4 ms for selection. This exercised deployed assets with synthetic data, not the owner's private library.

### Implementation and data protection

[Android CI run 38455281314](https://github.com/twpaige/CCTTRPG/actions/runs/38455281314) completed successfully: prior desktop/shared/native/release regressions, all three browser suites, release build/lint, signing and publication. [Signed release `sr-android-100501`](https://github.com/twpaige/CCTTRPG/releases/tag/sr-android-100501) contains versionCode **100501**; its published build information identifies implementation commit `688ac4f1aebf026c0d56144278691ca784e84001`. Cloud success does not establish physical-device verification.

- Added `js/scheduler.js`, `js/mastery.js`, `js/mastery-panel.js`, `mastery.html`: exact intervals, UTC clamped calendar months, final-step REVIEW anchoring and same-window filtering, BOUND ordering/UNBOUND shuffle, final-only AUDIT ALL/single-series selection and repeat-until-stopped policy, confirmed propagation/resets, independent progress writes, learner-facing intervals/dates and selection previews. No authored-card audio player was connected.
- Updated `js/db.js`, `js/validation.js`, `js/backup.js`, `js/repository.js`: schema/format 2, compound-key step progress, idempotent receipt storage, validated atomic v1→v2 migration, preserved legacy card-progress archive and separate original pre-migration recovery. Version-1 snapshots remain importable; version-2 snapshots preserve independent steps and receipts. Existing content/IDs/order are not rewritten during migration. No migration from arbitrary illustrative JSON is invented.
- Updated `index.html`, `js/editor.js`, `styles.css`: mastery navigation, per-step read-only context and optional recall seconds (including zero and long values), progress-preserving step edits and accurate deletion wording. The full mastery panel is desktop-only.
- Updated `data/index.html`, `data/panel.js`: actual format-version/conversion preview, safety verification across supported conversion, original pre-migration backup download. Existing replacement confirmation, safety match and previous pre-import recovery remain required.
- Updated `mobile/app/build.gradle` and `MainActivity.java` **only** to package/allowlist the shared `scheduler.js` dependency of the repository. No native engine, plan builder/parser, service, Bluetooth, notification, signing identity or version-allocation behavior changed.
- Added `tests/mastery.test.js`, `tests/mastery.html`, `tests/mastery-runner.js`, `tests/mastery.mjs`; updated the existing workflow to run the new suite and trigger on mastery HTML. Existing persistence tests use the current schema version and valid step-progress scale fixtures; editor tests account for the new recall field in keyboard order and updated deletion wording. Their regression coverage/counts are preserved.
- Updated `SPECIFICATION.md`, `BUILD_PLAN.md`, `docs/STORAGE.md`, `docs/AUTHORING.md` and this report. Storage docs specify APIs, legacy archives, recovery compatibility and the Stage 6 boundary.

### Executed evidence

Windows, Node **24.19.0**, Google Chrome **154.0.0.0** headless, Playwright **1.62.1**, Temurin JDK **17.0.20.1**. All destructive tests use fresh disposable profiles and `SRLearning-test-*` databases. All Q/A fixtures are synthetic; the fixture named States/Delaware is **not the owner's private card text**.

| Check | Result | Evidence |
|---|---|---|
| Earlier speech/shared/native/release regressions | PASS | **61/61**: 33 desktop, 6 shared plans, 16 native executor, 6 release safety; desktop 33 also run in Chrome |
| Existing persistence/backup regressions | PASS | **38/38**, plus browser-process restart, offline storage, Data download/reselection/recovery, interrupted import rollback |
| Existing editor acceptance | PASS | **17/17** Chrome UI scenarios, including 100-step creation/reopen, restart, ordering, stable IDs, progress retention, cascades, backups and stale writes |
| Stage 5 domain/storage | PASS | **39/39** scenarios; grouped assertions, not inflated independent test counts |
| Stage 5 Chrome UI | PASS | **7/7** scenarios; actual controls/downloads/IndexedDB, not owner manual observation |
| All 11 levels and dates | PASS | Exact intervals including L0 15 minutes and L10 null; leap/nonleap month ends, three-month/year boundary, retained UTC time, elapsed days through DST, invalid/overflow rejection |
| REVIEW selection | PASS | Final anchor; earlier overdue step cannot select a card; seven-day example yields steps 1/4/5; inclusive boundaries, Max Deferred excludes KNOWN, BOUND sequence and deterministic UNBOUND shuffle preserve step order |
| AUDIT policy | PASS | ALL/one-series, KNOWN-only final steps, fully KNOWN BOUND final-card collapse, continuous cursor/repeated cycles until Stop or empty eligibility. This is policy verification, not continuous audio |
| KNOWN/reset controls | PASS | Shared final-step and I-know scopes, card/whole-bound-series confirmation, cancellation, lower-final-only behavior, reset-final/card/objective distinctions, unchanged content |
| Scheduling/completion | PASS | Due/overdue REVIEW restarts timer; early lookahead preserves original dates even when due passes while speaking; FOCUSED/AUDIT automatic isolation; no mastery increase; pending choices wait for successful step completion and disappear on interruption; duplicate/stale/restored/backwards-time rejection |
| Atomic action failure | PASS | Failure during multi-step propagation retains all prior levels; receipt insertion failure rolls back the progress update and allows exactly-once retry |
| Actual version-1 migration | PASS | Independent old-schema fixture upgrades through production IndexedDB code; all content/IDs/ordering and legacy progress compare equal; every step inherits its card; KNOWN null due; no cross-card propagation; original pre-import and pre-migration backups retained |
| Migration failure/idempotence | PASS | Missing legacy progress and actual asynchronous constraint failure abort versionchange, retaining version 1, original records and stores; second open/conversion preserves independent edits and original recovery |
| JSON compatibility | PASS | Version-1 import through approved conversion; complete version-2 round-trip including receipts and long recall overrides; missing/duplicate/dangling/invalid KNOWN progress and malformed receipts reject without mutation |
| Desktop controls | PASS (automated) | Per-step level/interval save, confirmation dismiss/accept, final-only AUDIT preview, all reset scopes, stale selection retained, keyboard activation and 390px layout; one-hour recall override saves/reopens; original v1 recovery actually downloads |
| Visual review | PASS (agent inspection) | Screenshot inspected for legible selectors, exact text, saved/proposed dates and clear REVIEW/AUDIT separation. This is not owner usability approval |
| 1,000 cards / 10,000 steps | PASS | Version-1 conversion/import, content equality, REVIEW selection and isolated step change. Latest local aggregate operation 1,284.4 ms; selection 5.6 ms. One measured Stage 5 sample, not a performance guarantee |

The existing five-run Stage 3 scale regression also passed under schema 2: 1,076.8, 1,521.3, 1,582.2, 1,581.2 and 1,568.9 ms (median 1,568.9 ms; slowest 1,582.2 ms). Extra step records/validation increase work relative to the historical v1 timings; all remain below the prior five-second export/restore target on this machine. The first UI run exposed a test assertion that did not wait for the browser's asynchronous details-toggle event; the corrected complete suite passed. The old editor keyboard assertion was extended for the new recall input, preserving its check that step controls are reachable.

### Reproduce

Run the prior regression commands and static server documented below, then with the existing Playwright/Chrome environment:

```powershell
node SR/tests/browser.mjs
node SR/tests/editor.mjs
node SR/tests/mastery.mjs
```

Browser-only runner: `/SR/tests/mastery.html`. Optional `SR_TEST_URL=https://crownandcall.com/SR` tests deployed assets in a disposable profile. No test targets the owner's live `SRLearning` database. CI runs the same three browser scripts before Android build/lint/publication.

### Remaining owner checks and Stage 6 dependencies

The owner should verify their **actual States series and Delaware card** in the same desktop profile after upgrade: exact wording/order, IDs via export, and the copied per-step mastery/timestamps. Download the original pre-migration backup and a new v2 export. The agent verified preservation for complete synthetic libraries, not by reading or mutating the owner's private browser data; no owner-specific migration observation is claimed.

Install the newly built Android update over the existing app without uninstalling, then verify schema-2 export/import, exact records, offline force-stop/reopen and retention across the update. Recheck existing audio/Bluetooth/locked-screen/notification behavior as needed. No physical Android test is claimed; previous G2/G3 gaps remain open. Version-2 files require the updated APK; old APKs reject them rather than dropping step progress.

Stored recall overrides are not limited to the old player's two-minute window. However, the unchanged native parser/shared plan caps waits at 120 seconds, speech text at 2,000 characters/action and actions at 100/unit; the service has a 120-second watchdog and 150-second wake lock. Stage 6 must qualify longer waits/recitations, step-success callbacks and native receipt reconciliation before audio integration. Full REVIEW/AUDIT playback, continuous audio, player UI mastery adjustment and cold offline launch are not implemented here.

Stage 5 provides the completion/controller API and repeat policy only. UI selectors read the complete personal-library snapshot; expanded preview text is lazy and preview lists page at 50. Browser drafts are not crash-persistent. Legacy card progress/preferences are retained for recovery but are not active scheduling authority. No Stage 6 work or new scheduling policy is implied by older archived planning text.

---

## Stage 4 — desktop authoring, 2026-10-13

**G4: CLOSED / PASS — desktop authoring automation and owner hands-on acceptance completed on 2026-10-13.** The owner's Stage 4 assignment explicitly authorizes this stage despite the outstanding G3 Android checks. It does not close those checks or authorize Stage 5. Earlier Stage 1, 2, 2.5 and 3 evidence below is preserved; statements about unavailable later stages describe their historical delivery dates.

Editor: **https://crownandcall.com/SR/**. [Authoring guide](AUTHORING.md). Source baseline: `0e25f07e7d0f3256ead1d1904f31ed44de5082d3`, freshly checked against `origin/main`. Implementation committed and pushed to `main` as **`fb5633071e5a96a10e87af0ea0956ccc49bf4fd3`**.

### Cloud and deployed verification

- Pages [run 38406118445](https://github.com/twpaige/CCTTRPG/actions/runs/38406118445): **SUCCESS**. The exact root URL `https://crownandcall.com/SR/` returns HTTP 200 and serves the editor.
- All **17/17 editor acceptance scenarios also passed against deployed crownandcall.com assets**, in a disposable Chrome profile with isolated test databases. This includes real browser-process restart and exported record comparison; it is not just an HTTP/source check and does not touch the owner's browser library.
- Android workflow [run 38406119712](https://github.com/twpaige/CCTTRPG/actions/runs/38406119712), implementation commit above: **build SUCCESS; publish SUCCESS**. The hosted run passed existing regressions, storage and editor browser tests, then release compilation/lint and the unchanged signing/publication guards. This does not establish physical-phone acceptance or close the remaining G3 checks.

### Delivered functionality and files

- Created `index.html`, `styles.css`, `js/editor.js`: plain HTML/CSS/ES-module desktop authoring. Create, rename, bind/unbind, order and delete series; create, reopen, edit, order, move and delete flashcards; add, insert, edit, delete and reorder individual multiline question/answer steps. Names/text render as text, never HTML. Series counts, one-based positions, binding explanations and read-only mastery are visible. Lists paginate at 50 summaries; only one chain is rendered. Save/Cancel remain accessible while scrolling long chains.
- Modified `js/repository.js`: optional transaction-local guard for editor writes. Schema/version-1 backup format and existing API defaults are unchanged. The editor compares its displayed library snapshot, including generation, inside each write transaction. Concurrent writes/restoration fail closed without losing the draft. A changed deletion count cannot silently expand a confirmed cascade. Web Locks serialize editor writes where available; transactions remain authoritative. Existing progress is never reset by editor saves.
- Modified `data/panel.js`: desktop-only return link to the editor, preserving isolated-test selection. Android retains its existing listening return link. The previously recorded recovery-interface improvements remain deferred; no restore safeguards were weakened.
- Created `tests/editor.mjs`: reproducible Chrome/Chromium UI and real IndexedDB acceptance scenarios in disposable profiles/databases. Modified `tests/serve.mjs` to serve the editor at the local root.
- Modified `.github/workflows/sr-android.yml`: editor HTML/CSS triggers and editor acceptance run alongside existing browser tests. Signing, identity, version policy and publishing steps are unchanged. The desktop editor is excluded by the existing Android asset allowlist; no Java, native speech, service, Bluetooth or notification code changed.
- Created `docs/AUTHORING.md`; updated `docs/STORAGE.md` and this report. No Stage 5 scheduling/mastery management, authored-card playback or Android authoring was implemented.

### Executed tests

Windows; Node **24.19.0**, actual Google Chrome **154.0.0.0** in headless mode, Playwright **1.62.1**, Temurin JDK **17.0.20.1**. Browser automation uses only `SRLearning-test-*` databases inside newly created disposable browser profiles. No personal library was changed. The tests are automated browser interaction, **not owner manual tests**.

| Check | Result | Evidence |
|---|---|---|
| Stage 1 desktop regressions | PASS | 33/33 Node tests, also 33/33 in Chrome |
| Stage 2 shared plans / native executor | PASS | 6/6 JavaScript and 16/16 Java tests |
| Stage 2.5 release safety | PASS | 6/6; all 61 earlier regressions pass |
| Stage 3 IndexedDB suite | PASS | 38/38; existing restart, offline storage, actual downloads/reselection/recovery and interrupted-restore integration also pass |
| Stage 4 actual editor UI | PASS | **17/17 acceptance scenarios**; each groups multiple assertions, not a count of individual unit tests |
| Series management | PASS | Create/rename, empty series, bound/unbound, series position and meaningful-order explanation |
| Variable chains and exact text | PASS | Created 1-, 6-, 10- and 100-step cards through the form; long stories/names, Unicode, leading/trailing whitespace, multiline and markup-looking text retained exactly |
| Step editing and identities | PASS | First/last moves, insertion, deletion and text edit followed by save/reopen; surviving step IDs retained and new step receives a new ID |
| Cards / progress / isolation | PASS | Card ordering and cross-series move normalize positions; nonzero mastery and review dates remain unchanged; ordinary content edit leaves all unrelated cards unchanged; new progress uses schema defaults |
| Draft/error protection | PASS | Cancel and navigation discard confirmations, dismissed browser reload warning, blank/whitespace rejection, simulated quota exception and successful retry without draft loss |
| Stale writes / safety | PASS | Second editor tab changes library; identical-content restore changes generation; both block stale save. Card added after series-deletion preview causes deletion to fail without cascade |
| Imported optional metadata | PASS | Role/direct-question/recall annotations survive edits. Referenced recitation step deletion/order changes are refused without altering those references |
| Destructive operations | PASS | Confirmation cancellation, named/count-based card/series cascade, progress removal, direct/series preset-reference cleanup, presets retained, empty-series deletion |
| Browser restart and complete backup | PASS | Actual Chrome process closed and relaunched with same disposable profile; record equality and all 100 Q/A fields checked through reopened UI; real JSON download; record-level equality after isolated restore |
| Keyboard and responsive UI | PASS (automated) | Editor action buttons exercised through focus + Enter, binding checkbox through Space; native inputs/selects; Tab reaches step controls. 390px viewport has no horizontal overflow. Desktop/small-screen screenshots visually inspected by agent; no owner usability approval inferred |
| List scale and isolation | PASS | 54-card list paginates as 50 + 4 summaries without unselected step forms; malformed test database name disables authoring |

The unchanged Stage 3 scale suite again verified 1,000 cards × 10 steps across five exports/restores: 267.8, 457.8, 394.6, 425.5 and 467.9 ms (local concurrent test run; not a device performance guarantee). No new physical-device/audio certification is inferred from these results. Initial editor test-runner issues (CSP blocking test helper evaluation and a fieldset-disabled assertion) were corrected in the test harness; the final complete run passed without weakening application CSP. Screenshot review prompted keeping Save/Cancel visible while scrolling.

### Reproduce Stage 4

Run the existing commands in Stage 3's Reproduce section (all 61 regressions plus `node SR/tests/browser.mjs`), with the static server running. In the same configured Playwright/Chrome environment also run:

```powershell
node SR/tests/editor.mjs
```

`SR_TEST_URL` can point to `https://crownandcall.com/SR` to exercise deployed assets in an isolated profile. `SR_SCREENSHOT` optionally saves desktop and small-screen PNGs to a development location. Development-only Playwright is not packaged in the website or Android app.

### Owner hands-on verification — 2026-10-13

**PASS / Stage 4 formally closed by owner request.** On the live website `https://crownandcall.com/SR/`, the owner created a real **States** series, authored and saved a **Delaware** flashcard with their own question/answer mnemonic content, navigated away/reopened the card, and confirmed **all content remained present**. The owner approved closing Stage 4. This confirms the central real-world create/save/reopen workflow in addition to the 17/17 Chrome acceptance scenarios and all existing passing regressions.

**Scope of observed manual acceptance:** The owner did not separately report keyboard-only navigation, every deletion/reordering operation, exact record-level export/restore of the Delaware card, or full usability checks from the disposable trial. Those are covered by automated tests where stated, but should not be described as individually owner-tested. The authored Delaware card is in the desktop browser's local IndexedDB; it does **not** yet play in the desktop proof or automatically synchronize to Android. Authored-card audio integration is Stage 6, not a Stage 4 defect. Recommend exporting a JSON backup of real authoring data.

**Outstanding independent work:** Earlier Android G2/G3 checklist items remain open. Stage 5 has not been authorized by this documentation update.

### Owner verification and limitations (historical instructions prior to acceptance)

No owner Stage 4 manual authoring result is claimed. Please use [the disposable trial](https://crownandcall.com/SR/index.html?test=SRLearning-test-owner-editor) to create a personally meaningful multi-step card, try Tab/Shift+Tab and Enter/Space, confirm the binding/ordering explanations, close/reopen the same browser/profile, and export/reselect a backup. Confirm that writing long stories and finding Save/Cancel are comfortable. Report any unexpected text or ordering change before entering a large real library. UI automation establishes G4's implemented behaviors; personal usability acceptance remains for the owner.

The editor conservatively rejects **any** intervening library change, including unrelated progress/settings changes. It has no automatic merge or persistent draft autosave. Errors retain the current draft; copy needed text before explicitly discarding it to reload. Browser crash/forced termination may lose unsaved work. Complete-snapshot comparison is appropriate to the tested personal-library size but is not a very-large-library performance claim. Imported recitation references are protected by refusing operations that would delete them or change their relative order; annotation management is deferred. No schema or format migration was introduced.

Cold offline website launch and authored-card playback remain later work. Android G3's exact JSON/round-trip comparison, offline/process-death check and retention through a subsequent APK update remain open, as do earlier unverified device checklist items. Owner feedback about clearer restore instructions and success messaging remains deferred in STORAGE.md. Stage 4 stops at authoring and backup; **Stage 5 is not started**.

---

## Stage 3 — storage implementation, 2026-10-13

The current owner assignment explicitly authorizes Stage 3 despite the remaining formal G1/G2 checklist items. Earlier evidence below is preserved. Source was freshly cloned from GitHub `main` at `76436b14af9f3afa97bdcc1abb15b36798085a99`; no prior local checkout was assumed current.

**G3: BLOCKED / open for remaining verification; core Android transfer/restore and audio smoke test PASS (owner-observed).** The owner successfully installed APK 0.2.100301, exported/imported the synthetic library with safety verification, observed a committed restore, reopened the app and exported again. Similar export sizes support persistence but do not establish record-level equality. Android offline storage and learning-data retention across a subsequent APK update remain unverified. Automated desktop storage, browser restart, real IndexedDB rollback and file recovery evidence below remains unchanged. No Stage 4 editor, scheduling, mastery presentation, Drive sync or playback integration has been started.

### Stage 3 owner verification — 2026-10-13

Device: **Samsung SM-S931U**. Installed APK: **0.2.100301**, installed over the existing application **without uninstalling**. These are actual physical-device observations reported by the owner, not agent-run, simulated or automated tests. They supersede the earlier Stage 3 pending-owner statements only for the behaviors explicitly observed.

| Check | Status | Owner-observed evidence |
|---|---|---|
| Application update and launch | PASS | Installed the new APK over the existing app and launched it successfully |
| Initial JSON export | PASS | Exported the initially empty library to a **376-byte** JSON file |
| Incoming JSON selection and validation preview | PASS | Selected the synthetic test backup; the app validated it and displayed **1 series, 2 flashcards, 4 steps, 0 presets (format 1)** |
| Current-library safety verification and acknowledgement | PASS | Selected and verified the previously exported current-library backup; after acknowledging playback was stopped, **Replace Local Library** became enabled |
| Successful restore path | PASS | Selected Replace Local Library and observed: **"Restore committed. Previous library is available with Save previous pre-import backup."** This confirms the reported successful commit path; it is not a physical-device interruption/rollback test |
| Post-import export | PASS | Exported the restored library to a **2.32 KB** JSON file |
| Close/reopen and export | PASS for observed workflow; content equality unverified | Closed the Android application, reopened it, and exported again; the file was approximately **2.32 KB**, consistent with the imported library persisting. Force-stop/process death was not explicitly reported |
| Android audio regression smoke test | PASS | Returned to the speech player and confirmed Android text-to-speech still works after the database changes |

The owner did **not** explicitly compare JSON contents. Matching approximate file sizes do not independently prove byte-for-byte or record-level equality, exact mnemonic text/order, or preservation of every field. Android offline IndexedDB operation was **not retested** in this Stage 3 session. The fixture was imported after installing 0.2.100301, so this update does **not** establish its persistence through a subsequent APK update. Earlier diagnostic-journal retention checks are not closed by these observations. No new Bluetooth, screen-lock or notification-control result is inferred from the audio smoke test.

Deferred restore-interface feedback is recorded in [STORAGE.md](STORAGE.md#deferred-restore-usability-improvements). It is usability work for later UI development, not a Stage 3 defect requiring immediate application changes. This documentation update does not rerun tests, alter their counts, or authorize Stage 4.

### Implementation and files

Created:
- `js/db.js`, `js/repository.js`, `js/validation.js`, `js/backup.js`: version-1 IndexedDB, indexed CRUD/progress/preset/settings API, validation, complete snapshots and atomic confirmed replacement with a pre-import recovery copy.
- `data/index.html`, `data/panel.js`: minimal shared export/preview/safety-file-reselection/confirmation/recovery panel.
- `tests/persistence.test.js`, `tests/persistence.html`, `tests/persistence-runner.js`: isolated real-IndexedDB tests and downloadable synthetic transfer fixture.
- `tests/browser.mjs`: development-only Playwright automation using a disposable browser profile, restart, offline access, file UI and interrupted-import verification.
- `docs/STORAGE.md`: API, exact version-1 contract, limitations and owner steps.

Modified:
- `mobile/app/src/main/java/com/crownandcall/srproof/MainActivity.java`: DOM storage enabled at the same local HTTPS origin; allowlisted Data assets/navigation; bounded Android document-picker import/export bridge. Native speech/executor/service code is unchanged.
- `mobile/app/build.gradle`: packages the same storage/Data modules and stylesheet, not a second implementation.
- `mobile/web/index.html`: Data link.
- `.github/workflows/sr-android.yml`: Data path trigger and real Chromium storage tests in the unsigned build job. Signing identity, signing steps, application ID and version progression remain unchanged.
- `docs/TEST_RESULTS.md`: this evidence. No unrelated files modified.

### Automated verification

Windows, Node v24.19.0; Chrome headless 154.0.0.0; available bundled Playwright 1.62.1; portable Temurin JDK 17.0.20.1; official Android platform-35-ext15 API jar. No global Java/SDK setting or signing credential was read or changed. SDK source compilation does not certify packaging or phone behavior.

| Check | Status | Evidence |
|---|---|---|
| Existing desktop controller/speech tests | PASS | 33/33 Node; same 33 also pass in actual Chrome |
| Existing shared playback plans | PASS | 6/6 |
| Existing native executor | PASS | 16/16 production Java tests |
| Existing release safety | PASS | 6/6; all 61 preexisting regressions pass |
| Real IndexedDB persistence suite | PASS | 38/38 in Chrome; includes initialization, CRUD, ordered/unlimited practical steps, stable IDs, indexed retrieval, progress isolation, settings, preset references, cascades, stale writes and complete round-trip |
| Invalid-import nonmutation | PASS | Truncated JSON, future format/schema, duplicate/missing IDs/progress, dangling references, invalid mastery/date/order, unsupported/unsafe keys and null-due illustrative data are rejected |
| Transaction failure/recovery | PASS | Explicit abort, simulated quota exception after clears, actual asynchronous constraint failure, unchanged previous recovery copy, safety-backup mismatch, explicit confirmation and successful previous-library restoration |
| Database upgrade safety | PASS | v0→v1 initialization, blocked v1→test-v2, aborted upgrade retaining v1/data, versionchange connection close, future-version refusal without deletion. Test v2 is disposable, not a shipped schema |
| Actual browser process restart | PASS | Close persistent Chrome context/process; relaunch same disposable profile/origin; exact saved content retained |
| Offline storage | PASS | Browser context networking disabled; read, individual progress write, export and restore succeed. Cold offline website launch is not claimed |
| Data file UI | PASS | Real download, file reselection, preview, disabled replacement without prerequisites, explicit confirmation, replacement, recovery download and page reload in an isolated test database |
| Page destruction during import | PASS | Held an actual replacement transaction active; closed its page; reopened and confirmed old content survived |
| 1,000 cards × 10 steps | PASS | Five export+restore runs; all 10,000 steps validated each time; indexed ID lookup and reopen retained 1,000 cards. Final local timings: 215.1, 371.8, 361.7, 375.1, 366.7 ms; median 366.7 ms, slowest 375.1 ms |
| Android API compilation | PASS | All production Java sources compile against SDK 35; existing deprecated API note only |
| GitHub browser tests, APK build/lint, signing/publication | PASS | [Run 38397826169](https://github.com/twpaige/CCTTRPG/actions/runs/38397826169), implementation commit `a3a805728dfe7f5e40c54f2c54b3da65c75396bd`: build and publish both succeeded. Existing signing/identity/version/download guards passed. Signed [SR.apk, version 0.2.100301](https://github.com/twpaige/CCTTRPG/releases/download/sr-android-100301/SR.apk) is published |
| Deployed website | PASS | Pages [run 38397825052](https://github.com/twpaige/CCTTRPG/actions/runs/38397825052) succeeded; Data/test URLs return HTTP 200; all 38 storage tests passed on the actual crownandcall.com origin in a disposable Chrome profile; Data panel opened successfully and was visually inspected |
| Android owner verification (separate from automation) | PASS for observed transfer/restore/update/audio workflows; G3 remains open | See the dated owner table above. Close/reopen export sizes support persistence; JSON equality, offline Android storage and retention through a subsequent APK update remain unverified |

Storage tests are separate from the 61 regression tests; the lifecycle/UI scenarios are additional integration assertions, not inflated into independent unit-test counts. Browser databases are disposable `SRLearning-test-*`; no personal library is reset. The tests use synthetic text only.

### Reproduce

From repository root, using Node 22+ and JDK 17+:

```powershell
node SR/tests/run.mjs
node SR/mobile/tests/plan.test.mjs
node SR/mobile/tests/release.test.mjs
& ./SR/mobile/tests/run-native.ps1 -Jdk 'C:/path/to/jdk-17'
node SR/tests/serve.mjs
```

With the static server still running, open `http://127.0.0.1:8765/tests/persistence.html`, or run:

```powershell
# Existing development-only Playwright installation; no dependency ships in SR.
$env:SR_PLAYWRIGHT = 'C:/path/to/node_modules/playwright'
$env:SR_BROWSER = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node SR/tests/browser.mjs
```

CI installs pinned Playwright 1.62.1 and Chromium into runner development storage, then runs the same script before APK compilation/signing. No application framework/build system is introduced. Expected public URLs after site deployment:
- `https://crownandcall.com/SR/tests/persistence.html`
- `https://crownandcall.com/SR/data/index.html`

### Remaining evidence and limits

The owner observations above establish successful Android update/launch, file export, import preview, safety verification, restore confirmation, subsequent export and an audio smoke test. They do not close every acceptance item. Follow [STORAGE.md](STORAGE.md#owner-verification) for the outstanding checks:

- Compare exported JSON records, exact Unicode/multiline mnemonic text, stable IDs, ordering and relevant fields after transfer and close/reopen; approximate file size alone is insufficient. Complete the desktop/phone round-trip comparison.
- Retest Android IndexedDB with networking disabled, including explicit force-stop/relaunch and another export. Ordinary close/reopen was observed; offline operation/process-death behavior was not.
- Keep the imported fixture across a **subsequent** APK update without uninstalling or clearing data, then verify its contents. Installation of 0.2.100301 preceded the import.
- Exercise Android file-picker cancellation, invalid-import nonmutation, interrupted-restore handling, and downloading/restoring the previous-library recovery backup. Existing automated desktop evidence does not substitute for unreported Android observations.
- Recheck Bluetooth, locked-screen progression and notification controls on this version as appropriate; the successful TTS smoke test is narrower evidence. Prior G1/G2 and diagnostic-journal retention checks remain open unless separately verified.

The illustrative specification JSON is not a historical shipped format. A null-due rejection fixture is tested; an unapproved legacy converter is not invented. `reviewEvents` is reserved/empty until Stage 6; native diagnostic entries remain separate and untouched. Current corrupted/unopenable storage fails closed without deletion; exceptional recovery without a readable safety snapshot remains a limitation, not an automated recovery claim. App uninstall/browser-data clearing can remove both working data and the local recovery copy; retain dated off-device backups. No offline desktop cold launch, authored-card playback, audio-setting UI integration or scheduling is claimed.

---

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
