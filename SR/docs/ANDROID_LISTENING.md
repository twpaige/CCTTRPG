# SR — Android listening, Stage 10

Stage 10 is ACTIVE. Implementation/automated evidence and the current signed APK are recorded in [TEST_RESULTS.md](TEST_RESULTS.md). Physical Samsung qualification remains open. Stages 8, 9 and 11 are on hold; Stage 7 is superseded. Desktop remains the authoring environment. Android listens and adjusts mastery; it does not edit flashcard content.

The owner verified installation of 0.2.100701 over the existing app, the REVIEW/AUDIT interface, import of the 1,000-card stress library, authored native TTS through Bluetooth with the screen locked, and lock-screen controls. Notifications required manual Resume in that release. The corrections below are automated-test passes pending updated-APK Samsung verification.

## Install and prepare

Export a dated backup from the existing app before updating. Install the signed APK **over the existing application without uninstalling or clearing storage**. App ID `com.crownandcall.srproof`, original signing identity, local `https://sr.invalid/` origin and IndexedDB `SRLearning` schema 2 are unchanged. Do not substitute a newly signed build if Android rejects the update. A compatible signature/build check is automated; actual in-place data retention still needs owner confirmation.

Open Data to transfer a library, then return to Listening. Choose REVIEW or AUDIT, ALL or one series, an installed offline English voice, rate and default recall seconds. Authored per-step recall overrides the default, including zero and long waits. REVIEW offers Due Now, N days or Max Deferred and optional UNBOUND shuffle. BOUND cards and all steps keep their approved order. AUDIT selects KNOWN final steps, with the existing wholly-KNOWN BOUND-series final-card rule. The screen shows selected counts or a clear empty-selection message.

Press Start. Android owns question → recall → answer and subsequent steps, including when the WebView sleeps. REVIEW ends after one selected pass; AUDIT repeats until stopped. Selection is prepared at Start. Since content edits/imports are unavailable during a session and mastery changes require a fresh Start, the prepared AUDIT targets remain valid. No browser speech adapter or JavaScript timer drives native playback.

## Controls and mastery

- Pause/Resume repeats only an interrupted speech segment; paused recall retains its remaining time. Long answers are divided into small exact text segments. Slight pauses between segments are possible. A stalled segment produces an error after 120 seconds; Resume retries it.
- Skip skips the unfinished step and remaining steps of its flashcard. Previously completed steps retain their credit. Paused Skip stays paused.
- Stop ends audio and releases playback resources. Completed work remains queued for saving. Restart stops, saves available work and rebuilds the last selection. After recreating the page, use Start to make a new selection.
- Notification Pause/Resume, Skip and Stop continue to operate without the WebView. Brief duckable interruptions pause and automatically resume only when Android returns audio focus, preserving the segment and recall time. Pause during the interruption cancels that automatic resume. Calls, other-media takeover, ambiguous transient loss, Bluetooth disconnect, deliberate Pause and Stop require explicit user action. No timer blindly restarts speech.
- Saved mastery is visible. While stopped, select a card/step and Apply a level. KNOWN and reset actions retain the shared confirmation/scope rules. During listening, these special actions pause first, then stop the session before applying a confirmed change. Cancelling leaves playback paused.
- “Queue after answer” pauses the current step and captures the chosen level after any required confirmation. Resume explicitly. It applies only after that step's entire answer finishes. Stop or Skip discards the unfinished choice. After a queued change completes, Stop then Start refreshes selection before further listening.

Automatic completion never increases mastery. Due-at-step-start REVIEW schedules from actual completion at the current mastery interval. Early REVIEW and AUDIT do not change dates automatically. Explicit mastery choices still follow the approved rules, including final-step/BOUND confirmations. No unfinished answer receives automatic completion credit.

## Simple completion recovery

The native process holds **at most 512 completed steps and 16 MiB**. The page saves in small batches whenever practical: while visible, on return, before a new session and before Data transfer. “Save queued progress” retries explicitly. The existing IndexedDB transaction saves scheduling plus its duplicate-protection receipt; only then is that queue entry removed. Stop and Activity recreation retain the in-memory queue while the process remains alive.

If the queue cannot accept another completion, playback pauses **before beginning the next step**, keeping every unsaved entry. Open SR, save queued progress, then Resume. A confirmed pending mastery change instead requires Stop/Start. Session handoff is limited to 16 MiB of UTF-8 JSON; oversized selections fail visibly without truncation. Select one series to reduce the plan.

**Owner-approved tradeoff:** Android/process death, force-stop or phone shutdown can lose all completions still waiting in memory, not just the latest one. Already committed IndexedDB progress persists. Lost steps may be reviewed again. There is no durable native completion journal, session checkpoint or automatic speech restart. After reopening, the app is idle and requires Start.

Storage, generation/revision or clock errors retain the queued record and show an error; they never overwrite newer progress or silently discard records. Stop audio and retry saving after resolving a temporary storage problem. If a persistent stale-record error occurs, preserve the message for diagnosis; do not keep retrying imports or assume those completions were saved. Data transfer is blocked until playback has stopped and the queue is empty. An unexpected process exit can still lose the unsaved queue as described above.

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

These are **unperformed owner checks**, not automated passes. Record APK version, voice, Bluetooth device, duration and observations in TEST_RESULTS; retain all older stage evidence.

1. **Update/data:** export first; install over the existing APK without uninstalling; confirm expected series/cards, exact representative Q/A, ordering, mastery and dates. Close/reopen and inspect/export again. Compare JSON fields rather than relying only on matching file size.
2. **Real content:** transfer a personally authored card using the safeguards above. Confirm audible exact questions, recall and complete answers, ordered multi-step/multi-card progression, selected voice and saved due dates. Compare a due REVIEW step with an early lookahead step; mastery must not increase automatically.
3. **Locked walk:** with an installed offline voice and Bluetooth headphones, start a representative long session, lock the phone and keep the WebView inactive. Check several card transitions and a long passage (>2,000 characters) plus a recall wait exceeding 150 seconds. Confirm continued audio and correct timing; test offline speech after the JSON is available locally.
4. **Controls/interruption:** while locked test notification Pause/Resume, Skip and Stop; test a call/competing audio and Bluetooth disconnect/reconnect. Partial answers/Skip/Stop must not earn credit. Confirm interrupted speech repeats only its segment, recall resumes remaining time and Stop releases the notification/audio resources.
5. **Save/recovery:** return after several completed steps and watch the queue drain. Reopen/rotate the Activity while the service is alive; verify no duplicate date updates. Deliberately force-stop during an unfinished answer: reopening must stay silent, with no credit for that answer. Unsaved completed work may be lost by design; saved progress must remain.
6. **AUDIT/mastery:** exercise ALL and one-series AUDIT with KNOWN finals, continuous locked playback and unchanged dates; queue a level for after an answer, cancel a confirmation, Skip/Stop a queued choice, and test confirmed KNOWN/reset scopes. Verify fresh Start is required after a pending change completes.
7. **OneDrive:** import and export through the Samsung provider, wait for sync, then verify the desktop round trip and representative JSON records. Try unavailable/offline/cancelled provider operations; confirm no replacement on failure and that the external outgoing backup remains available for reimport.
8. **Capacity (optional long stress run):** with synthetic short steps and the UI inactive, reach the queue bound; confirm a visible/native pause with all prior entries retained, then reopen/save/Resume. Automated coverage checks exact saturation; it does not establish Samsung lifecycle or battery behavior.

G10 remains OPEN until the required everyday device behaviors are owner-verified. The Stage 10 implementation does not close unperformed G1/G2/G3/G5/G6 or Stage 9 qualification checks.
