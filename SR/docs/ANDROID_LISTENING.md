# SR — Android listening, Stage 10

Stage 10 is ACTIVE. Implementation/automated evidence and the current signed APK are recorded in [TEST_RESULTS.md](TEST_RESULTS.md). Physical Samsung qualification remains open. Stages 8, 9 and 11 are on hold; Stage 7 is superseded. Desktop remains the authoring environment. Android listens and adjusts mastery; it does not edit flashcard content.

The owner verified installation of 0.2.100701 over the existing app, the REVIEW/AUDIT interface, import of the 1,000-card stress library, authored native TTS through Bluetooth with the screen locked, and lock-screen controls. Notifications required manual Resume in that release. The corrections below are automated-test passes pending updated-APK Samsung verification.

## Install and prepare

Export a dated backup from the existing app before updating. Install the signed APK **over the existing application without uninstalling or clearing storage**. App ID `com.crownandcall.srproof`, original signing identity, local `https://sr.invalid/` origin and IndexedDB `SRLearning` schema 2 are unchanged. Do not substitute a newly signed build if Android rejects the update. A compatible signature/build check is automated; actual in-place data retention still needs owner confirmation.

Open Data to transfer a library, then return to Listening. Choose REVIEW or AUDIT, ALL or one series, an installed offline English voice, rate and default recall seconds. Authored per-step recall overrides the default, including zero and long waits. REVIEW offers Due Now, N days or Max Deferred and optional UNBOUND shuffle. BOUND cards and all steps keep their approved order. AUDIT selects KNOWN final steps, with the existing wholly-KNOWN BOUND-series final-card rule. The screen shows selected counts or a clear empty-selection message.

Press **PREPARE** and wait for **Ready — N steps**. Then press **PLAY**. All session material is already in app-private temporary files; native Android owns question → recall → answer and subsequent batches while the WebView sleeps. Both REVIEW and AUDIT repeat the fixed session until Stop. There is no user-facing card-count, duration or 16 MiB session limit. Available storage and memory remain practical limits; preparation errors never enable PLAY or silently truncate the selection.

## Controls and mastery

- **Pause / Resume:** retain the prepared session and position. Resume repeats an interrupted speech segment; recall resumes its remaining time. Exact long passages are segmented for TTS, with possible small native TTS gaps. A 120-second stalled-segment watchdog reports an error without guessing completion.
- **Skip card:** skip the unfinished step and remaining steps of that card. Previous completions remain valid; paused Skip stays paused. Skipped material returns on the next session repetition.
- **Stop:** release speech/playback resources and delete prepared playback files. Retain all pending completion records for saving. A new PREPARE reads current library eligibility before another PLAY.
- **Mastery 0–9:** one tap immediately pauses, saves prior completions, applies the chosen level now, updates affected prepared material and resumes at the next eligible step. The interrupted answer earns no automatic completion credit. Manual adjustment preserves last-reviewed time and schedules from adjustment time.
- **Mastery 10:** always confirm. An intermediate step affects only that step; a final step affects its entire flashcard; the final step of the final BOUND card affects the entire series. The dialog explains the scope and exclusion from REVIEW until lowered/reset. AUDIT remains available where applicable. Cancel resumes the interrupted position unchanged.
- **Reset FC / final / objective:** confirm existing scopes. Reset FC and objective advance past the current card; reset final retains the shared final-only scope. An AUDIT reset can leave no targets and end the session.
- **Errors:** a failed save or prepared-file update keeps playback paused. Read the error, resolve storage issues, then Stop and PREPARE again. Never assume a failed save succeeded. If the database save succeeded but temporary-session revision failed, the saved mastery remains valid; a fresh preparation uses it.

After explicit mastery/reset, prune only affected original steps/cards using the original REVIEW cutoff or existing AUDIT rules. Preserve order; introduce no newly eligible material. Automatic completion and repetition do not continuously recalculate eligibility. A successful change advances past the interrupted step, wrapping to the beginning only at the end of the retained session. If nothing remains, playback ends cleanly.

Notification Pause/Resume, Skip and Stop operate without the WebView. Brief duckable focus loss pauses and resumes on focus gain. Calls, ambiguous transient/permanent loss, Bluetooth disconnect and deliberate Pause/Stop require explicit action. Pause/Stop during confirmation or saving prevents automatic resumption. No timer blindly resumes speech and no crash restarts it.

## Scheduling and simple completion recovery

Each prepared step gets at most one normal REVIEW scheduling opportunity, on its **first successful completion**, even if skipped on earlier passes. Subsequent repetitions never update dates again. Actual step-start time distinguishes due from early; early first completion preserves the due date and consumes its opportunity even if a later repetition becomes due. AUDIT never automatically changes mastery or dates. Automatic completion never increases mastery.

Native retains at most 512 completion records / 16 MiB in memory, spilling additional records to a separate temporary app-private file. Reconciliation reads at most 32 records per batch while visible, on return, and before a new session or Data transfer. **Save queued progress / retry** retries explicitly. Acknowledgement follows the existing atomic IndexedDB progress/receipt transaction, so retries do not advance dates twice. Stop deletes playback material but preserves pending memory/file completions. File failures report errors and pause; they never silently evict records.

Prepared playback reads at most 16 steps per batch, targeting approximately 1 MiB of text. A single unusually large step can exceed that target; JavaScript also needs enough memory to validate the library and prepare it. No entire-session speech expansion is retained by native. Files are completely available before PLAY; native batch transitions do not depend on JavaScript. Actual audible timing and device memory behavior still require Samsung verification.

**Owner-approved tradeoff:** unexpected process death, force-stop or phone shutdown can lose all uncommitted completion records. Already committed IndexedDB progress persists; lost steps may need review again. Temporary files are abandoned work, cleared on fresh process startup, not a crash journal or checkpoint. Reopening stays silent and requires PREPARE / PLAY. There is no new learning database.

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
2. **Prepare/Play:** verify no speech during PREPARE; PLAY stays disabled until ready. Exercise Due Now, lookahead, Max Deferred and AUDIT. Confirm empty selection is clear, ordinary Pause/Resume preserves position, Stop discards readiness, and fresh PREPARE uses current data.
3. **Locked repetition/batches:** use the synthetic 1,000-card / 5,000-step library, short recall and an offline voice; listen over Bluetooth with the screen locked across multiple batch transitions. In a separate short session, verify multiple complete REVIEW and AUDIT loops, including skipping a first pass and completing that step later. Repeat two 30-minute locked runs (one offline) and a one-hour walk. Check long answers and recall longer than 150 seconds.
4. **Scheduling:** inspect representative JSON records after repeated passes. Due steps receive one completion/date update per prepared session; early steps keep due dates; AUDIT keeps all dates; partial answers receive none. A skipped first pass may earn credit on its later first successful completion.
5. **One touch:** during question, recall and answer, tap 0–9; confirm immediate pause, save, next eligible step and automatic resume. Test all KNOWN scopes, confirm/cancel, Reset FC/final/objective, final-anchor removal, original-cutoff filtering, and the empty-session outcome. Cancel must resume the interrupted position; no interrupted-answer credit. If a save error occurs, it must remain paused and visible.
6. **Focus and controls:** test notification Pause/Resume/Skip/Stop, SMS/email, calls, competing audio and Bluetooth disconnect/reconnect. Deliberate Pause/Stop during a confirmation must not restart audio. Stop must release resources. Verify Android inset/keyboard/dialog usability.
7. **Overflow/recovery:** with short synthetic steps and the WebView inactive, complete more than 512 distinct due steps; confirm continued playback. Return and let the queue drain, including after Stop. Check no duplicate dates after reopening/Activity recreation. Force-stop during an unfinished answer: relaunch stays silent. Uncommitted completed work may be lost by design; committed data must remain.
8. **Manual JSON/OneDrive:** perform desktop → phone → desktop with the existing external timestamped backup/read-back and confirmation. Compare representative content/progress records. Test cancelled/unavailable provider operations and confirm no replacement on failure. A readable saved file does not prove cloud synchronization.

G10 remains OPEN until required everyday device behavior is owner-verified. No unperformed G1/G2/G3/G5/G6 or Stage 9 check is declared passed. Stage 7 is SUPERSEDED; Stages 8, 9 and 11 remain ON HOLD. Stop after this Stage 10 refinement.
