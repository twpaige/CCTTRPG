# SR — Android listening, Stage 10

Stage 10 is ACTIVE. Implementation/automated evidence and the current signed APK are recorded in [TEST_RESULTS.md](TEST_RESULTS.md). Physical Samsung qualification remains open. Stages 8, 9 and 11 are on hold; Stage 7 is superseded. Desktop remains the authoring environment. Android listens and adjusts mastery; it does not edit flashcard content.

The owner verified installation of 0.2.100701 over the existing app, the REVIEW/AUDIT interface, import of the 1,000-card stress library, authored native TTS through Bluetooth with the screen locked, and lock-screen controls. Notifications required manual Resume in that release. The corrections below are automated-test passes pending updated-APK Samsung verification.

## Install and prepare

Export a dated backup from the existing app before updating. Install the signed APK **over the existing application without uninstalling or clearing storage**. App ID `com.crownandcall.srproof`, original signing identity, local `https://sr.invalid/` origin and IndexedDB `SRLearning` schema 2 are unchanged. Do not substitute a newly signed build if Android rejects the update. A compatible signature/build check is automated; actual in-place data retention still needs owner confirmation.

Open Data to transfer a library, then return to Listening. Choose REVIEW or AUDIT, ALL or one series, an installed offline English voice, rate and default recall seconds. Authored per-step recall overrides the default, including zero and long waits. REVIEW offers Due Now, N days or Max Deferred and optional UNBOUND shuffle. BOUND cards and all steps keep their approved order. AUDIT selects KNOWN final steps, with the existing wholly-KNOWN BOUND-series final-card rule. The screen shows selected counts or a clear empty-selection message.

## Android one-touch PLAY — current authority, 2026-10-15

This refinement replaces the separate visible PREPARE button; internal preparation, native batching and completion safeguards remain. Opening the app stays silent. PLAY restores saved choices, prepares automatically when required, and begins without a second tap. The first installation may require notification permission and a further PLAY after it is granted. Keep the app available during preparation; lock it after Playing begins.

The always-open top playback panel stays visible while scrolling where screen height permits. It displays activity/state, original prepared card number/total, authored step number/total, phase and brief save/errors. Filtering/pruning can leave gaps in the original numbers. No names, subjects, questions or answers appear in operational status. Knowledge Mastery, Choose a Session, Voice & Recall, and Data & JSON Recovery start collapsed. Native details/summary and touch-size buttons support keyboard and phone use. Mastery/reset actions target the active step/card with existing one-touch saving and confirmation safeguards.

Activity, series, review window/days, UNBOUND shuffle, voice, rate and default recall persist in the existing WebView localStorage under sr.android.listening.v1. This is device configuration, separate from library JSON; no new database/schema. Missing series falls back to ALL. An unavailable saved voice stays visible until explicitly changed. Invalid stored values use safe defaults and write errors are visible. Same app ID, signing and origin retain storage identity; actual phone restart/APK-update preservation still needs owner verification.

A ready, never-started playlist retained in the current native process may be reused only after a fresh hash of canonical library/generation, configuration and current eligible identities matches. Changes or uncertainty cause preparation again. STOP and process death discard material; the next PLAY starts from the beginning with fresh preparation. No persistent playlist cache is reconstructed. This conservative reuse policy avoids extra cache/recovery machinery.

Native TTS says "Preparing playlist." when needed, "Starting playlist." before content, and "Playlist complete." then "Replaying playlist." at natural pass boundaries. Skipping past the end says "Replaying playlist." only. Empty REVIEW says "No reviews available." These phrases share voice, Bluetooth routing, focus, Pause/Resume, Stop and watchdog behavior. They are not flashcards and never create progress or receipts. Batch transitions have no announcement. Retry repeats only the interrupted phrase; preparation and authored speech never overlap.

Previous Step goes to the preceding eligible step in the retained sequence, including across card boundaries; Next Step skips forward. Previous FC goes to the preceding retained card's first step; Next FC skips the remainder of this card. Backward movement is a no-op at the first boundary; forward movement past the end wraps for continuous replay. Paused navigation stays paused. Preserve BOUND/step order, no interrupted-answer credit and no duplicate credit after backward replay. Cross-card Previous Step follows the explicit Android request; desktop behavior is unchanged.

Stage 10 remains ACTIVE; Stage 7 SUPERSEDED; Stages 8, 9 and 11 ON HOLD. No new framework, cloud API, backend or recovery journal. The earlier prepare/play architecture below remains internal implementation context; current operation uses a single PLAY.

## Approved transition chimes

### Samsung timeout correction

APK 0.2.102401 can play a chime but then hang with “Transition sound timed out. Resume retries.” Its earcon call supplied a separate utterance ID but no parameter Bundle. Android's audio-item callback lookup reads `TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID` from that Bundle, so the callback can be suppressed even after audio finishes. The corrected call supplies the same native token in both locations. The approved PCM files and 15-second watchdog are unchanged; progression still requires an actual completion callback, never an elapsed-duration guess.

Install the corrected signed release linked in [TEST_RESULTS.md](TEST_RESULTS.md) over the existing app. Retest the reported Psalm 23 series: PLAY, listen past the first chime through consecutive steps and another flashcard, then repeat with Bluetooth earbuds and the phone locked. Check Pause/Resume and Stop during a chime, plus navigation while a cue is pending. There should be no overlap, timeout, unfinished-answer credit or changed sound. These physical-device checks remain owner verification.

The native executor plays warm wood within a flashcard and the two-note cue across flashcards, including automatic replay and manual Next/Previous. These replace one another at a boundary; no spoken next-step/card phrase is added. Existing playlist announcements are preserved. Chimes run entirely in the native TTS audio queue, using two bundled mono 48 kHz PCM WAV resources rendered from the approved laboratory synthesis. Each includes 270 ms silence + 720 ms tone + 180 ms silence, with pitch 330 Hz, volume 32% and decay 69%. They do not depend on the WebView, consume completion-queue entries, change batching, or create learning events.

The existing TTS progress listener gates the next question on earcon completion; the same stop, audio-focus, media routing, watchdog and notification paths apply. Pause during a chime cancels it; Resume retries the cue before speaking the target question. Resume during ordinary speech has no new chime. Rapid navigation cancels stale cues. Initial Start and Stop are silent except for the existing playlist announcements. Settings are fixed for this release; there are no chime controls or new database/backup fields.

Owner Samsung verification for this release:

1. Install the new signed APK over the existing app without uninstalling. Confirm the existing library, native voice and rate survive.
2. Through Bluetooth earbuds, play multi-step/multi-card REVIEW and AUDIT. Check warm wood within a card, two-note across cards, never both, comfortable volume and no clipped beginning/tail.
3. Check Next/Previous Step and FC, including filtered/KNOWN gaps and a mastery change that prunes prepared material. Each actual destination gets the right cue with no unfinished-answer credit.
4. Pause and Stop during the leading silence, tone and trailing silence. Confirm prompt silence, no delayed question after Stop, and one cue retry on Resume. Pause/Resume ordinary speech must not add a cue.
5. Lock the phone and run across native batches and full-session replay. Check start/completion/replay announcements, notification Pause/Resume/Skip, audio-focus loss and Bluetooth disconnect. No cue should overlap question/answer speech.
6. Reopen the app and confirm progress reconciliation, repeat-pass credit protection, JSON export/import safeguards and manual transfer still work. Compare perceived sound against the desktop player with the same earbuds; OS/device media volume can differ.

Automated waveform and transition checks cannot certify physical routing, earbud sound quality or OEM focus behavior.

## Controls and mastery

- **Pause / Resume:** retain the prepared session and position. Resume repeats an interrupted speech segment; recall resumes its remaining time. Exact long passages are segmented for TTS, with possible small native TTS gaps. A 120-second stalled-segment watchdog reports an error without guessing completion.
- **Skip card:** skip the unfinished step and remaining steps of that card. Previous completions remain valid; paused Skip stays paused. Skipped material returns on the next session repetition.
- **Stop:** release speech/playback resources and delete prepared playback files. Retain all pending completion records for saving. The next PLAY prepares automatically using current library eligibility.
- **Mastery 0–9:** one tap immediately pauses, saves prior completions, applies the chosen level now, updates affected prepared material and resumes at the next eligible step. The interrupted answer earns no automatic completion credit. Manual adjustment preserves last-reviewed time and schedules from adjustment time.
- **Mastery 10:** always confirm. An intermediate step affects only that step; a final step affects its entire flashcard; the final step of the final BOUND card affects the entire series. The dialog explains the scope and exclusion from REVIEW until lowered/reset. AUDIT remains available where applicable. Cancel resumes the interrupted position unchanged.
- **Reset FC / final / objective:** confirm existing scopes. Reset FC and objective advance past the current card; reset final retains the shared final-only scope. An AUDIT reset can leave no targets and end the session.
- **Errors:** a failed save or prepared-file update keeps playback paused. Read the error, resolve storage issues, then Stop and PLAY again. Never assume a failed save succeeded. If the database save succeeded but temporary-session revision failed, the saved mastery remains valid; a fresh preparation uses it.

After explicit mastery/reset, prune only affected original steps/cards using the original REVIEW cutoff or existing AUDIT rules. Preserve order; introduce no newly eligible material. Automatic completion and repetition do not continuously recalculate eligibility. A successful change advances past the interrupted step, wrapping to the beginning only at the end of the retained session. If nothing remains, playback ends cleanly.

Notification Pause/Resume, Skip and Stop operate without the WebView. Brief duckable focus loss pauses and resumes on focus gain. Calls, ambiguous transient/permanent loss, Bluetooth disconnect and deliberate Pause/Stop require explicit action. Pause/Stop during confirmation or saving prevents automatic resumption. No timer blindly resumes speech and no crash restarts it.

## Scheduling and simple completion recovery

Each prepared step gets at most one normal REVIEW scheduling opportunity, on its **first successful completion**, even if skipped on earlier passes. Subsequent repetitions never update dates again. Actual step-start time distinguishes due from early; early first completion preserves the due date and consumes its opportunity even if a later repetition becomes due. AUDIT never automatically changes mastery or dates. Automatic completion never increases mastery.

Native retains at most 512 completion records / 16 MiB in memory, spilling additional records to a separate temporary app-private file. Reconciliation reads at most 32 records per batch while visible, on return, and before a new session or Data transfer. **Save queued progress / retry** retries explicitly. Acknowledgement follows the existing atomic IndexedDB progress/receipt transaction, so retries do not advance dates twice. Stop deletes playback material but preserves pending memory/file completions. File failures report errors and pause; they never silently evict records.

Prepared playback reads at most 16 steps per batch, targeting approximately 1 MiB of text. A single unusually large step can exceed that target; JavaScript also needs enough memory to validate the library and prepare it. No entire-session speech expansion is retained by native. Files are completely available before PLAY; native batch transitions do not depend on JavaScript. Actual audible timing and device memory behavior still require Samsung verification.

**Owner-approved tradeoff:** unexpected process death, force-stop or phone shutdown can lose all uncommitted completion records. Already committed IndexedDB progress persists; lost steps may need review again. Temporary files are abandoned work, cleared on fresh process startup, not a crash journal or checkpoint. Reopening stays silent and requires an explicit PLAY. There is no new learning database.

Generation/revision, storage or clock errors retain the affected queued record and show an error. Do not discard it or bypass import guards. Preserve persistent errors for diagnosis. Data transfer is blocked until the prepared session has been stopped and pending completions are reconciled.

## Manual OneDrive JSON round trip

OneDrive is optional. Local files work without a Microsoft account. The app uses Android's existing document picker; it contains no Microsoft Graph/OAuth/cloud integration or automatic merge.

1. On desktop, open Data and **Save Complete JSON Backup** into OneDrive. Wait for synchronization.
2. On Android, Stop playback and open Data. Available completed steps are saved before backup; unresolved queue errors block transfer.
3. Tap **Import JSON Library**, select the JSON in OneDrive or local storage, and check the incoming counts.
4. The system save picker opens for the automatic complete backup, suggesting the incoming document’s location where supported. Check/select the same OneDrive folder or Downloads. Save **SR-Backup-YYYY-MM-DD-HHMM.json** (local time, collision suffix when needed).
5. SR closes/reopens and byte-verifies the backup, then shows **Import this library?** with counts and the actual filename. **Cancel** keeps the library; **Confirm Import** replaces it atomically and shows **Library Imported Successfully**. On failure, resolve the error and start Import again. No manual reselection or extra checkbox is required.
6. After listening, Stop, then **Save Complete JSON Backup** to export updated progress. Wait for OneDrive synchronization and verify the file appears on desktop.
7. On desktop use **Import JSON Library** for the same automatic backup and confirmation. Chrome’s **Choose Backup Destination** button opens its save picker after validation. Compare intended content and representative mastery/dates afterward.

**A snapshot replaces the whole destination library; it does not merge independent edits.** If both devices changed, keep both exports and decide which complete snapshot to restore. Never assume Android progress will merge with newer desktop authoring. Offline/unavailable provider errors leave the library intact; retry when available or use a local file. No persistent document grant is needed because each operation selects/creates its own document. JSON schema 2 and version-1 recovery compatibility remain unchanged.

The timestamped backup is outside app-private storage. Existing-name collisions are handled by Android's CREATE_DOCUMENT picker; repeated same-minute app requests also get a numeric suffix. SR refuses a nonempty returned document before writing. If the provider cannot reopen the new document or returns different/incomplete bytes, replacement remains blocked. A successful read-back proves provider-accessible content, not remote OneDrive synchronization. Desktop uses the same verified-backup and one-confirmation flow. Old recovery-copy actions are removed; existing historical records remain inert and untouched.

**Audio-focus limitation:** Android reports interruption categories, not “SMS” or “phone call.” SR automatically resumes only for LOSS_TRANSIENT_CAN_DUCK followed by GAIN; ordinary transient/permanent loss stays manually paused. If a Samsung notification uses an ambiguous category, it may still require Resume. This conservative policy avoids guessing from elapsed time or requesting phone permissions. Verify SMS/email, calls, deliberate Pause/Stop and Bluetooth behavior on the updated APK. [Android guidance](https://developer.android.com/media/optimize/audio-focus), [document creation/collision behavior](https://developer.android.com/training/data-storage/shared/documents-files#create).

## Remaining Samsung SM-S931U verification

These are **unperformed owner checks for this refinement**, not automated passes. Record APK version, voice, Bluetooth device, duration and observations in TEST_RESULTS. Earlier observations do not certify this build.

1. **Update/data:** export first, install over the current app without uninstalling/clearing storage, and compare representative Q/A, identifiers, ordering, mastery and dates before/after reopening. Compare JSON records, not just file sizes.
2. **One-touch PLAY/preferences:** configure activity/series/window/shuffle/voice/rate/recall. Close/reopen, restart the phone and update the APK; confirm choices persist without speech. Press PLAY once; hear Preparing/Starting, then content. Test failure/retry, empty REVIEW, and fresh preparation after settings/import/mastery changes or Stop. Check collapsed panels and content-free status.
3. **Locked repetition/batches:** use the synthetic 1,000-card / 5,000-step library, short recall and an offline voice; listen over Bluetooth with the screen locked across multiple batch transitions. In a separate short session, verify multiple complete REVIEW and AUDIT loops, including skipping a first pass and completing that step later. Repeat two 30-minute locked runs (one offline) and a one-hour walk. Check long answers and recall longer than 150 seconds.
4. **Scheduling:** inspect representative JSON records after repeated passes. Due steps receive one completion/date update per prepared session; early steps keep due dates; AUDIT keeps all dates; partial answers receive none. A skipped first pass may earn credit on its later first successful completion.
5. **One touch:** during question, recall and answer, tap 0–9; confirm immediate pause, save, next eligible step and automatic resume. Test all KNOWN scopes, confirm/cancel, Reset FC/final/objective, final-anchor removal, original-cutoff filtering, and the empty-session outcome. Cancel must resume the interrupted position; no interrupted-answer credit. If a save error occurs, it must remain paused and visible.
6. **Navigation, announcements and focus:** test all four navigation controls, first/last boundaries, paused navigation and backward replay without duplicate credit. Hear complete then replaying then the first question; no batch-transition announcement. During both status speech and authored content, test notification Pause/Resume/Skip/Stop, SMS/email, calls, competing audio and Bluetooth disconnect/reconnect. Deliberate Pause/Stop during a confirmation must not restart audio. Stop must release resources. Verify Android inset/keyboard/dialog usability.
7. **Overflow/recovery:** with short synthetic steps and the WebView inactive, complete more than 512 distinct due steps; confirm continued playback. Return and let the queue drain, including after Stop. Check no duplicate dates after reopening/Activity recreation. Force-stop during an unfinished answer: relaunch stays silent. Uncommitted completed work may be lost by design; committed data must remain.
8. **Manual JSON/OneDrive:** perform desktop → phone → desktop with the existing external timestamped backup/read-back and confirmation. Compare representative content/progress records. Test cancelled/unavailable provider operations and confirm no replacement on failure. A readable saved file does not prove cloud synchronization.

G10 remains OPEN until required everyday device behavior is owner-verified. No unperformed G1/G2/G3/G5/G6 or Stage 9 check is declared passed. Stage 7 is SUPERSEDED; Stages 8, 9 and 11 remain ON HOLD. Stop after this Stage 10 refinement.
