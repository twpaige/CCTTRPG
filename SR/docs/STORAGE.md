# SR storage, desktop/Android playback and JSON recovery

The same storage ES modules run on the website and in the existing Android WebView. There is no application server, database package or native learning database. The [desktop player](PLAYBACK.md) is at `https://crownandcall.com/SR/`; the [editor](AUTHORING.md) is at `/SR/library.html`; mastery is at `/SR/mastery.html`. Moving HTML within this origin preserves the same database. Stage 10 packages a small native listening/mastery interface, Data and shared storage/scheduling modules; it excludes the desktop editor and browser speech adapter. Schema/JSON format remain 2, with version-1 import compatibility unchanged.

## Locations and identity

- Data panel: `https://crownandcall.com/SR/data/index.html`
- Isolated real-IndexedDB tests: `https://crownandcall.com/SR/tests/persistence.html`
- Desktop database: `SRLearning`, internal version 2, scoped to the website origin/browser profile.
- Android database: the same name and modules, scoped to the existing `https://sr.invalid/` bundled origin and app ID. Do not change that origin, app ID, or signing identity during updates.
- Tests create only `SRLearning-test-*` databases. Browser automation uses an entirely disposable browser profile as well. `data/index.html?test=SRLearning-test-example` opens an explicitly named isolated test database; invalid test names fail closed.

Local IndexedDB access needs no network. The desktop page must already be loaded before going offline; offline cold launch/service-worker caching is Stage 9. Android bundles its assets and retains its no-INTERNET-permission architecture. `setDomStorageEnabled(true)` enables WebView DOM storage; no deprecated Web SQL database setting or native database is added. The owner's October 13, 2026 phone test verified the successful file export/import/restore workflow and close/reopen export, with file sizes consistent with persistence; exact JSON equality, offline Android storage and retention across a subsequent APK update remain unverified. See [the owner evidence](TEST_RESULTS.md#stage-3-owner-verification--2026-10-13), [Android WebSettings](https://developer.android.com/reference/android/webkit/WebSettings#setDomStorageEnabled(boolean)) and [IndexedDB transactions/upgrades](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB).

## Repository API

Active learning uses `stepProgress`. The `progress` store and `getProgress`/`updateProgress`/`listDue` methods are retained **only for legacy archive compatibility**, not current scheduling. Existing archive values remain available for recovery and regression checks; changing one does not change step mastery. New application code must use the Stage 5 APIs below. A new card gets independent mastery-0 step records due in 15 minutes; adding a step does the same. Reordering/editing keeps existing step progress; deleting a step/card removes its corresponding live progress. Receipts remain historical.

```js
import { openDatabase } from './js/db.js';
import { Repository } from './js/repository.js';
const db = await openDatabase({ onBlocked: showMessage, onVersionChange: showReload });
const repository = new Repository(db);
const series = await repository.createSeries({ name: 'My series', bound: false });
const card = await repository.createCard({
  seriesId: series.id, name: 'My card',
  steps: [{ question: 'My question', answer: 'My exact authored answer' }]
});
const progress = await repository.getStepProgress(card.id, card.steps[0].id);
db.close();
```

The desktop editor uses this API. The Data panel itself has no authoring controls.

| Method | Contract |
|---|---|
| `createSeries({name,bound,id?,position?,recitationPrompt?})` | Generated UUID unless explicit stable ID supplied; append unless inserting at a specified zero-based position |
| `getSeries(id)`, `listSeries()` | Missing single record returns `undefined`; list is in position order |
| `updateSeries(id, patch, expectedRevision)` | Patch name/binding/position/prompt; stale revision fails |
| `deleteSeries(id, expectedRevision, {confirmed:true})` | Caller must display current affected-card count and obtain confirmation before calling; removes series/cards/progress and preset references atomically |
| `createCard({seriesId,name,steps,id?,position?,recitationStepIds?})` | Creates content and exactly one default progress record together; new steps receive IDs; input step array defines order |
| `getCard(id)`, `listCards(seriesId)` | Fetch one card or ordered full cards in a series |
| `listCardIds(seriesId)` | Indexed key-only retrieval; does not clone step payloads |
| `updateCard(id, patch, expectedRevision)` | Patch name/series/position/steps/recitation references; moving normalizes both series; existing supplied step IDs remain unchanged |
| `deleteCard(id, expectedRevision)` | Removes progress/direct preset references and normalizes siblings atomically |
| `getProgress(id)`, `updateProgress(id, patch, expectedRevision)` | Patch only mastery/lastReviewedAt/nextDueAt; only this progress record is written. No automatic mastery or date calculations |
| `getStepProgress(cardId,stepId)` | Read the independent active step record; use `changeMastery` for learner changes |
| `listDue(timestamp)` | Inclusive numeric `byDue` query; default timestamp is now; zero dates are included |
| `savePreset(input, expectedRevision?)` | Create or update name, unique seriesIds/cardIds, mode, order, grouping; references must exist; existing preset requires current revision |
| `getPreset(id)`, `listPresets()`, `deletePreset(id, expectedRevision)` | Preset retrieval/removal; empty selections are permitted |
| `setSetting(key,value)`, `getSettings()` | Validated nonsecret preferences only |

Every mutation resolves after transaction `complete`. Any exception, request error, abort, constraint or quota failure rejects and rolls back the whole transaction. Code within transaction callbacks may await IndexedDB requests only. Never hold a transaction across file dialogs, speech, network or timers. Connections close on `versionchange`; callers should reload then. Blocked upgrades display instructions to close other tabs; no database deletion is attempted.

Revision checks protect concurrent edits to content/progress/presets. Replacement also checks an exact logical safety-backup match inside its write transaction, detecting any intervening write or earlier replacement. Android enforces stopping its native service and saving queued step completions before file transfer. The historical sample proof remains separate from learning data.

Stage 6 `acquirePlayback(db)` holds the exclusive Web Lock `SR-library-<database name>` for the active/paused/error desktop player. Other current-version `transaction(..., 'readwrite', ...)` calls request a short shared lock with `ifAvailable`, failing visibly if playback owns the library. Its owning connection can write completion/mastery; reads/exports remain unlocked. Locks protect cooperating pages; old loaded code cannot be retroactively locked. Close/reload old tabs after deployment. Existing content/progress revision and generation checks remain authoritative. No lock is stolen and no database is deleted. See the [Web Locks standard](https://www.w3.org/TR/web-locks/).

The player captures a step token before its question, calls `finish` only after all answer segments end, and retains that occurrence/timestamp over save retries. Successful due progress and its receipt commit atomically. Stop discards unfinished pending mastery, but a transaction already started for a finished answer may complete; earlier credit is retained. Release waits for pending operations. Reload has no automatic speech or receipt recovery replay. Schema-2 exports include all receipts. AUDIT/early steps without an explicit pending change leave the snapshot unchanged.

The optional `new Repository(db, {guardStores, writeGuard})` constructor hook invokes a guard inside each write transaction. The editor compares its displayed canonical snapshot, including independent progress and library generation, before writes. Intervening changes reject the operation and retain the draft. This conservative whole-library check protects deletion counts and sibling ordering; it does not merge concurrent changes. Web Locks serialize editor writes where available; transaction checks remain authoritative. Guard callbacks may await only IndexedDB requests. Stage 5 upgrades the schema/format to 2 and adds only the required shared scheduler dependency to Android's asset list.

This personal-library implementation reads the complete snapshot for the guard; it renders only 50 list summaries per page and the currently selected card's steps. Larger-library optimization and offline cold launch remain later acceptance work. Editing content never invokes the progress-writing API. Optional annotations and recitation references are preserved; the Stage 4 UI blocks deletion/reordering that would invalidate imported recitation references rather than silently rewriting them.

## Content contract retained from version 1

IDs are nonempty strings; new IDs are UUIDs. Text is preserved verbatim, including whitespace, multiline text, Unicode and markup-looking characters. The UI renders with textContent. Names/questions/answers cannot be entirely whitespace. Positions are contiguous zero-based integers; step array order and positions agree, as do series order and card order within each series in a snapshot. There is no step-count limit. Record timestamps are nonnegative, safe-integer UTC epoch milliseconds in JavaScript's Date range; createdAt ≤ updatedAt. Content and presets have positive integer revisions.

The original content stores/indexes remain. Optional step annotations (`role`, `directQuestion`, `recallSeconds`) and recitation references are preserved and structurally validated. Stage 5 uses the final authored step as the eligibility anchor rather than old cue/bridge/target bands. No role/target classification is required. The editor now exposes the optional recall override; blank means session default, zero is permitted, and long finite nonnegative durations remain storable. Existing recitation references still cannot be silently deleted/reordered by the editor.

Legacy archive progress uses `flashcardId`, integer mastery 0–10, nullable `lastReviewedAt`, numeric `nextDueAt` and a positive revision. Old values remain unchanged during migration, including old numeric level-10 dates. For compatibility, newly authored cards also have an inert archive record (0/null/0/revision 1); it is not active progress. Presets retain mode `focused|due`, order `sequential|random`, grouping `auto|individual|full`; storing one never schedules or plays anything. These legacy preset enums are not labels for the new REVIEW/AUDIT distinction.

Settings remain a JSON object in snapshots and key/value records in IndexedDB. Allowed keys: `desktopVoice`, `androidVoice` (name/language, optional voiceURI); `rate` (0.1–10), `pitch` (0–2), `volume` (0–1); nonnegative `recallSeconds`/`passageMarginSeconds`; positive `passageWordsPerMinute`; and the legacy 11-entry `intervalDays` array. That legacy array is preserved but does not override the owner-approved Stage 5 intervals. Unknown keys, tokens, arbitrary sync metadata and platform voice objects are rejected. Sample speech controls remain independent.

The legacy `reviewEvents` store/index remains reserved/empty; nonempty unsupported history is rejected, never silently discarded. Stage 5 adds the separately defined `stepEvents` receipt contract below. The native Stage 2 diagnostic journal remains separate and untouched. Stage 6 desktop and Stage 10 Android completions use the step-level API; diagnostic card history is never converted into learning credit.

Two private support stores hold library identity (`meta`) and the last successful pre-import snapshot (`recovery`). They contain no credentials. Recovery copies are not recursively embedded in portable backups. The library ID survives transfer; each successful restore generates a new active libraryGeneration UUID, as the plan requires to distinguish stale sessions. No device installation identity is cloned.

## Schema 2 migration and active progress

The owner approved copying existing flashcard progress to **every step**, retaining mastery, lastReviewedAt, nextDueAt and revision. Mastery 10 becomes KNOWN with null active due. Migration must not propagate to other cards in a BOUND series. All series/card/step text, IDs, ordering, timestamps, optional fields, archive progress, settings and presets remain untouched.

`openDatabase` upgrades 1→2 in one `versionchange` transaction: create `stepProgress` and `stepEvents`, read/validate the complete old snapshot, save `recovery['pre-migration']`, then add each independent step record. The existing `pre-import` copy remains intact. A validation/request/quota/constraint failure aborts the entire upgrade, leaving the old version/data/stores intact. Never delete the database to recover. A fresh installation performs initialization and the same validated conversion; reopening version 2 does not recopy or reset step progress. The pure `migrateSnapshot` converter is idempotent and does not mutate its input.

| Store | Contract |
|---|---|
| `stepProgress` | Compound key `[flashcardId,stepId]`; mastery, nullable lastReviewedAt, nextDueAt, positive revision. `byCard` and numeric `byDue` indexes. Every live step has exactly one row; IDs need only be unique within a card. KNOWN requires null due, other levels numeric due |
| `stepEvents` | Stable receipt id = JSON array encoding `[libraryGeneration,sessionId,occurrenceId,flashcardId,stepId]`; same identity fields plus completedAt. Atomically saved with affected progress, never with unfinished/early/AUDIT-only/FOCUSED-only completion. Explicit pending mastery changes may create a receipt in those modes to prevent duplicate application. Deleted content may remain referenced historically |
| `recovery` | Separate `pre-import` and `pre-migration` snapshots. **Save original pre-migration backup** downloads the original validated version-1 library; **Save previous pre-import backup** downloads the last replacement's prior library. Keep both externally if useful |

Migration preserves due dates exactly (except KNOWN null), even if they reflect the older policy or are zero/overdue. Do not recompute them from the new table. Subsequent individual changes use the new intervals. Upgrading does not mark anything newly KNOWN across cards.

## Stage 5 policy and completion APIs

`scheduler.js` exports `nextDue(level,from)`, `cutoff(now,window)`, `selectReview(snapshot,options)`, `selectAudit(snapshot,{seriesId?})`, `auditCursor()` and `recallSeconds(step,sessionDefault)`. All policy functions accept explicit time/random inputs where applicable. See the current specification for the exact intervals, UTC month clamping, final-step anchor and same-cutoff filtering. Selectors return indivisible card units with ascending step IDs; AUDIT returns final steps only. The cursor repeats until stopped and accepts a refreshed eligibility list each cycle.

`mastery.js` exports:

- `planMastery(snapshot,action)`: compute affected members and the exact confirmation message. Actions: `step` with cardId/stepId/level; `known`, `resetCard`, `resetFinal`, `resetObjective` with cardId. Final-step level 10 and `known` have identical card/series scope. `resetCard` always means that card; audited `resetObjective` includes the whole BOUND series when targeting its final card.
- `changeMastery(db,{action,expectedKey,confirmed,now})`: compare canonical displayed library inside the same transaction; enforce confirmation; update only affected active progress. No content/legacy progress rewrite. Manual changes preserve last-reviewed and schedule from change time.
- `prepareCompletion(db,{cardId,stepId,mode,sessionId,occurrenceId,startedAt,window})`: validate REVIEW/AUDIT eligibility and capture content/progress revisions, library generation and due-at-step-start status. Mode is exactly `REVIEW`, `AUDIT` or `FOCUSED`.
- `completeStep(db,prepared,{successful,completedAt,pending})`: reject unsuccessful, stale or backwards-time work. Due REVIEW restarts the step timer from actual completion without raising mastery; early/focused/audit leaves progress unchanged unless a manual pending choice exists. Receipt lookup precedes revision checks, enabling exactly-once retry. Imported generations reject old callbacks.
- `StepCompletionController`: `begin` returns an occurrence token; `pendingMastery` queues a choice; `finish(token,time)` commits only after the caller reports genuine successful step completion; `interrupt` discards unfinished tokens/choices. `special(action,{pause,confirm,now})` requires playback pause and confirmation callbacks. `now` accepts a clock function (default Date.now), evaluated after confirmation, or an explicit timestamp for deterministic callers. A completion transaction already started after success may finish after Stop; no new completion starts for an invalidated token. Stage 6 `StudySession` connects these boundaries to the existing speech controller.

Stage 10 `native-study.js` builds version-2 plans directly from `selectReview`/`selectAudit`, carrying exact Q/A, per-step recall, stable IDs/revisions and original due dates. The native service segments speech, waits without WebView timers, and records actual start/completion times. `reconcileNative` calls the existing atomic `completeStep`; due-at-start REVIEW schedules from completion, early REVIEW/AUDIT is unchanged unless a confirmed pending mastery choice exists. Only committed/duplicate/no-op records are removed from the native queue. Errors retain the entry and show a retry message. Generation/revision checks remain authoritative. Batches contain at most 32 records.

The owner approved an **in-memory queue**, not a durable native journal. It is shared across Activity/service instances within the process, capped at 512 records and 16 MiB. Execution pauses before a step that cannot reserve queue space, without evicting earlier work. Visible UI polls/reconciles every 1.5 seconds and on return; Stop/new sessions/Data transfer also save available work. Pending explicit mastery changes pause first and bind to the current occurrence; after successful answer/application, a fresh Start rebuilds eligibility. Special actions pause/confirm, stop, then apply. Native guards protect file transfer while the service is active/launching or the queue is nonempty, even if a Web Lock disappears with the WebView.

Unexpected process/phone shutdown can lose all unsaved queue entries; this accepted tradeoff means those steps may be reviewed again. Already committed IndexedDB progress remains. Plans and uncommitted queue entries are not JSON backup data. There is no automatic speech recovery, new database schema or native learning store. Long recalls use 30-second slices and 150-second bounded wake renewal; speech retains a 120-second per-segment error watchdog. See [Android listening](ANDROID_LISTENING.md).

## Backup API and procedure

`exportSnapshot(db)` returns a validated object; `exportJSON(db)` serializes it. `previewImport(json)` validates without writes and returns `{snapshot, counts}`. `restoreJSON(db,json,{confirmed:true,safetyJSON})` requires a validated current safety backup, externally verified by the caller. Desktop reselects the saved file; Android saves and reads it back automatically. `recoveryJSON(db)` returns the last pre-import backup for downloading and ordinary confirmed restoration.

New exports use `format: "sr-learning-backup"`, `formatVersion: 2`, `schemaVersion: 2`, `appVersion`, UTC ISO `exportedAt`, `libraryId`, `libraryGeneration`, `series`, `flashcards`, legacy `progress`, `presets`, `settings`, empty legacy `reviewEvents`, active `stepProgress` and `stepEvents`. Version-1 files retain their original contract and convert through `migrateSnapshot` on restore; preview identifies conversion. All required fields, IDs, references, ordering, enums, timestamps and settings are checked. Unknown versions/fields and unsafe keys fail closed. Export does not change record timestamps. Update an older Android APK before importing a version-2 file; no lossy version-1 downgrade is offered.

Unversioned illustrative JSON and null **legacy card** due dates remain invalid. Active KNOWN step dates are null in format 2. The actual shipped version-1 format is now supported through the owner-approved converter. Tests cover old-version upgrade/abort, duplicate reopen, blocked upgrades, connection close and future-version refusal without deletion.

The following is the unchanged **desktop** procedure. Android's owner-approved Stage 10 correction instead selects/validates incoming JSON, automatically exports the current snapshot to a timestamped CREATE_DOCUMENT file, closes/reopens and byte-verifies it, then enables one replacement confirmation. The native provider's actual filename is reported; cancellation/write/read-back errors leave replacement disabled. Existing-file collisions are handled by the creation picker and same-minute suffixes; nonempty destinations are refused. The same atomic restore API still rechecks the exact safety match inside the transaction, rejecting intervening changes. See [Android workflow](ANDROID_LISTENING.md).

1. Stop playback. Choose a complete JSON file and inspect replacement counts.
2. Export the current library to an off-device file. Reselect that saved file using **Verify saved current backup**; both validation and exact current-content matching must pass.
3. Check the explicit replacement confirmation, then **Replace local library**.
4. The transaction rechecks the safety match, saves the current snapshot in `recovery`, clears/repopulates all live stores and assigns a fresh generation. Failure preserves the old library and its prior recovery copy. Closing the page mid-transaction also rolls back in the tested Chrome.
5. Reopen and verify counts; download another dated backup. Use **Save previous pre-import backup** if you need to undo, followed by the same safety/confirmation workflow.

No merge or Drive service is involved. Returning a whole phone snapshot to desktop also replaces content/mastery/preferences: preserve both copies if desktop content changed. Desktop is the intended content authority. Do not use a whole phone restore to merge later review results into newer desktop edits.

Both file UIs cap input at 32 MiB before any modification. The Android picker uses the Storage Access Framework with bounded reads and no broad storage permission, file/content URL access, external navigation or INTERNET permission. Cancel/error does not import. Android export reports success only after writing/closing and reopening the selected document for exact byte verification. This does not certify OneDrive cloud sync.

If storage cannot open, or the current data is unreadable/invalid, the panel fails closed and preserves it. It does not delete the database or pretend it made a safety backup. Recovery from physical/browser-store corruption without a readable current snapshot remains an explicit exceptional recovery limitation; retain external backups and investigate the cause before any destructive reset. Ordinary restoration into a fresh empty database is supported. Clearing site data or uninstalling loses both working data and the local recovery copy, so local recovery is not a substitute for dated external backups.

## Owner verification

Run the browser test page, then use **Download synthetic storage-test backup**. Its two artificial cards are not a content library. To keep desktop tests separate, import it at `data/index.html?test=SRLearning-test-owner` after exporting/reselecting that empty test library's safety backup. Close all browser windows, reopen the same URL/profile, export, and verify the exact text/order. Do not test resets on personal data.

For Stage 5, preserve a dated pre-upgrade export, then reopen the same desktop profile and verify the owner's actual States series/Delaware wording, IDs, ordering and inherited step progress. Download the original pre-migration backup. Automated tests use synthetic content and do not constitute observation of the owner's private library.

On the schema-2 Android update: install over the existing app without uninstalling, stop audio, open Data and verify/export the migrated library. Compare records after desktop→phone→desktop transfer and offline force-stop/relaunch. Cancel both file pickers and reject malformed JSON. Download both available recovery copies. Check voice choice, Bluetooth, locked-screen progression and notification controls. These physical-device checks remain owner work; installed version and approximate file sizes alone do not prove record equality.

## Deferred restore usability improvements

Owner feedback, October 13, 2026, after successful physical-device testing of APK 0.2.100301:

1. The JSON restore procedure feels confusing because the required sequence is not clear enough in use.
2. Make numbered instructions more explicit and visible: select the incoming JSON, verify the saved current-library backup, acknowledge playback is stopped, then authorize replacement. Existing instructions did not make this sequence sufficiently clear to the owner.
3. Make the success confirmation more prominent and informative; for example, **"Restore Successful — 2 Flashcards Imported"**, using the actual imported count. The current success message was easy to overlook.
4. Preserve all existing data-protection safeguards, including validation, safety-backup verification, explicit replacement authorization, atomic writes and the pre-import recovery copy.

These are **deferred usability improvements** for later UI development, not Stage 3 defects requiring immediate code changes. No interface change or Stage 4 work is authorized by recording this feedback.

**Stage 10 follow-up (2026-10-14):** authorized listening/transfer work now adds explicit OneDrive round-trip instructions, retains the numbered replacement sequence, and displays a bold “Restore Successful — N Flashcards Imported” result using the actual count. Backup verification, stopped-playback acknowledgement, atomic replacement and previous-library recovery remain intact. Automated Data recovery tests pass; whether the revised presentation resolves the owner's confusion remains a physical-device usability check.
