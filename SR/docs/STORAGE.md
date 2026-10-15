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

Website **Paste Flashcards** uses the strict lightweight `{flashcards:[{name,steps:[{question,answer,recallSeconds?}]}]}` authoring format, validated by `validateFlashcardInput`. It does not accept recovery snapshots or change their format. `Repository.importCards(input, destination)` accepts either `{seriesId}` or `{name,bound}`, returning `{series,cards}`. One transaction appends the entire batch and, if needed, a new series. All new content uses generated IDs, ordinary timestamps and default progress, with no imported-card flags. Existing rows/history are untouched. The editor captures its canonical library guard at preview, refreshes it only on new validation, and requires a new preview after failure or input changes. Shared Web Locks, revision/generation guards and add/constraint rollback remain in force. No migration or Android UI/packaging change.

Desktop cloning uses `cloneCard(id, count, expectedRevision)` (1–10 copies, returns cards) and `cloneSeries(id, expectedRevision)` (one copy, returns `{series, cards}`). Each runs one repository write transaction over series, flashcards, legacy progress and stepProgress, plus the existing editor guard stores. Reads and sibling renumbering occur inside that transaction. New rows use add/constraint failure rather than overwriting an existing ID. Authored fields are copied, step IDs and recitation references remapped, and fresh progress follows the normal new-card contract. Original content/progress/history is retained; shifted siblings receive normal position/revision updates. Existing Web Locks and canonical snapshot/generation guards apply. No schema, JSON or scheduling changes.

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

Two private support stores hold library identity (`meta`) and inert historical snapshots (`recovery`). New imports and migrations no longer create recovery copies; existing records are never cleared or rewritten. The empty store definition remains for schema-2 initialization compatibility. Historical copies are not recursively embedded in portable backups. The library ID survives transfer; each successful restore generates a new active libraryGeneration UUID to distinguish stale sessions.

## Schema 2 migration and active progress

The owner approved copying existing flashcard progress to **every step**, retaining mastery, lastReviewedAt, nextDueAt and revision. Mastery 10 becomes KNOWN with null active due. Migration must not propagate to other cards in a BOUND series. All series/card/step text, IDs, ordering, timestamps, optional fields, archive progress, settings and presets remain untouched.

`openDatabase` upgrades 1→2 in one `versionchange` transaction: create `stepProgress` and `stepEvents`, read/validate the complete old snapshot, then add each independent step record. Existing historical recovery records remain intact. A validation/request/quota/constraint failure aborts the entire upgrade, leaving the old version/data/stores intact. Never delete the database to recover. A fresh installation performs initialization and the same validated conversion; reopening version 2 does not recopy or reset step progress. The pure `migrateSnapshot` converter is idempotent and does not mutate its input.

| Store | Contract |
|---|---|
| `stepProgress` | Compound key `[flashcardId,stepId]`; mastery, nullable lastReviewedAt, nextDueAt, positive revision. `byCard` and numeric `byDue` indexes. Every live step has exactly one row; IDs need only be unique within a card. KNOWN requires null due, other levels numeric due |
| `stepEvents` | Stable receipt id = JSON array encoding `[libraryGeneration,sessionId,occurrenceId,flashcardId,stepId]`; same identity fields plus completedAt. Atomically saved with affected progress, never with unfinished/early/AUDIT-only/FOCUSED-only completion. Explicit pending mastery changes may create a receipt in those modes to prevent duplicate application. Deleted content may remain referenced historically |
| `recovery` | Inert historical snapshots, retained without a schema change or user-facing export function. New backups are complete external JSON files |

Migration preserves due dates exactly (except KNOWN null), even if they reflect the older policy or are zero/overdue. Do not recompute them from the new table. Subsequent individual changes use the new intervals. Upgrading does not mark anything newly KNOWN across cards.

## Stage 5 policy and completion APIs

`scheduler.js` exports `nextDue(level,from)`, `cutoff(now,window)`, `selectReview(snapshot,options)`, `selectAudit(snapshot,{seriesId?})`, `auditCursor()` and `recallSeconds(step,sessionDefault)`. All policy functions accept explicit time/random inputs where applicable. See the current specification for the exact intervals, UTC month clamping, final-step anchor and same-cutoff filtering. Selectors return indivisible card units with ascending step IDs; AUDIT returns final steps only. The cursor repeats until stopped and accepts a refreshed eligibility list each cycle.

`mastery.js` exports:

- `planMastery(snapshot,action)`: compute affected members and the exact confirmation message. Actions: `step` with cardId/stepId/level; `known`, `resetCard`, `resetFinal`, `resetObjective` with cardId. Final-step level 10 and `known` have identical card/series scope. `resetCard` always means that card; audited `resetObjective` includes the whole BOUND series when targeting its final card.
- `changeMastery(db,{action,expectedKey,confirmed,now})`: compare canonical displayed library inside the same transaction; enforce confirmation; update only affected active progress. No content/legacy progress rewrite. Manual changes preserve last-reviewed and schedule from change time.
- `prepareCompletion(db,{cardId,stepId,mode,sessionId,occurrenceId,startedAt,window})`: validate REVIEW/AUDIT eligibility and capture content/progress revisions, library generation and due-at-step-start status. Mode is exactly `REVIEW`, `AUDIT` or `FOCUSED`.
- `completeStep(db,prepared,{successful,completedAt,pending})`: reject unsuccessful, stale or backwards-time work. Due REVIEW restarts the step timer from actual completion without raising mastery; early/focused/audit leaves progress unchanged unless a manual pending choice exists. Receipt lookup precedes revision checks, enabling exactly-once retry. Imported generations reject old callbacks.
- `StepCompletionController`: `begin` returns an occurrence token; `pendingMastery` queues a choice; `finish(token,time)` commits only after the caller reports genuine successful step completion; `interrupt` discards unfinished tokens/choices. `special(action,{pause,confirm,now})` requires playback pause and confirmation callbacks. `now` accepts a clock function (default Date.now), evaluated after confirmation, or an explicit timestamp for deterministic callers. A completion transaction already started after success may finish after Stop; no new completion starts for an invalidated token. Stage 6 `StudySession` connects these boundaries to the existing speech controller.

Android one-touch PLAY stores last session/voice/recall choices in the existing origin's localStorage key sr.android.listening.v1. Device configuration is separate from portable JSON; no database schema change. Same app ID/signing/origin preserves storage identity; physical phone restart/update retention remains to verify. Corrupt values use safe defaults; failed writes are visible. Ready native material is reused only after hashing canonical library/generation, configuration and current eligible identities. No playlist survives process death or STOP. Announcements are not learning units and never produce scheduling records.

Stage 10 PREPARE uses the existing selectors and streams exact version-2 step records into disposable app-private playback files. A disk offset index supports native batches of at most 16 steps, targeting approximately 1 MiB of text (one unusually large step may exceed it). Native code expands only requested speech substrings. Both modes repeat without WebView callbacks or live scheduling queries. No application database migration or backup-format change is involved.

Each stable session/step has one first-successful-completion opportunity. A native bitset suppresses repeats, including after reconciliation; early first successes consume their opportunity without changing due dates. A skipped first pass can still receive credit on a later successful pass. Due-at-actual-start REVIEW records use stable receipt identity and the existing atomic completeStep API. AUDIT never automatically writes progress. Native retains up to 512 records / 16 MiB in memory; further records go to a simple temporary overflow file. Up to 32 are reconciled at a time. Exact FIFO acknowledgement occurs only after successful commit, duplicate or no-op; failures retain records and are visible.

Stop discards playback files but preserves both memory and overflow completions. Visible polling, return to the app, new preparation and Data transfer reconcile whenever practical. Storage failures pause with an error, never silently truncate or evict. Fresh process initialization discards abandoned temporary files; process death may lose every uncommitted record by owner decision. This is not a durable journal or automatic recovery system, and reopening never starts speech.

Single-touch Android mastery pauses and holds native Resume, reconciles earlier successes, uses changeMastery from adjustment time (without rewriting lastReviewedAt), then streams a paused replacement of affected prepared units using the original cutoff. Confirm every 10 and all resets. Preserve order, stable credit flags and existing propagation; never add newly eligible material. Cancel restores the interrupted position; successful changes advance past it. Save/update failures remain paused. Native guards block file transfer for prepared, active/launching or unreconciled sessions. Identity, schema 2 and JSON recovery compatibility are unchanged. See [Android listening](ANDROID_LISTENING.md).

## Backup API and procedure

`exportSnapshot(db)` returns a validated object; `exportJSON(db)` serializes it. `previewImport(json)` validates without writes and returns `{snapshot, counts}`. `restoreJSON(db,json,{confirmed:true,safetyJSON})` requires a validated current safety backup, externally verified by the caller. Both platforms now write and read back that file automatically. No historical-copy export API remains.

New exports use `format: "sr-learning-backup"`, `formatVersion: 2`, `schemaVersion: 2`, `appVersion`, UTC ISO `exportedAt`, `libraryId`, `libraryGeneration`, `series`, `flashcards`, legacy `progress`, `presets`, `settings`, empty legacy `reviewEvents`, active `stepProgress` and `stepEvents`. Version-1 files retain their original contract and convert through `migrateSnapshot` on restore; preview identifies conversion. All required fields, IDs, references, ordering, enums, timestamps and settings are checked. Unknown versions/fields and unsafe keys fail closed. Export does not change record timestamps. Update an older Android APK before importing a version-2 file; no lossy version-1 downgrade is offered.

Unversioned illustrative JSON and null **legacy card** due dates remain invalid. Active KNOWN step dates are null in format 2. The actual shipped version-1 format is now supported through the owner-approved converter. Tests cover old-version upgrade/abort, duplicate reopen, blocked upgrades, connection close and future-version refusal without deletion.

The Data page has two primary actions: **Save Complete JSON Backup** and **Import JSON Library**. Both use complete version-2 exports; the current library may be empty.

1. Stop playback, open Data, and choose **Import JSON Library**. Select incoming JSON. SR fully validates it and displays series, flashcard and step counts before requesting a backup destination.
2. Save the automatically generated outgoing backup in the incoming file’s folder when possible. Chrome shows **Choose Backup Destination** to obtain the fresh gesture required for its save picker; Android opens its system creation picker. Check the folder explicitly, especially OneDrive. The local-time name is `SR-Backup-YYYY-MM-DD-HHMM.json`, with numeric suffixes for repeated same-minute saves. Nonempty destinations are refused, including after a reload resets the desktop suffix counter. Choose a new filename if needed.
3. SR writes/closes/reopens the selected file and compares every UTF-8 byte. Only successful verification opens **Import this library?**, showing counts and the actual saved filename. Choose **Cancel** or **Confirm Import** once.
4. Confirmation atomically replaces live stores and assigns a fresh generation. The transaction rechecks the exact outgoing snapshot; errors/aborts preserve the library. Historical recovery records are untouched. The success message shows imported counts and the outgoing backup filename.
5. To undo, import that external outgoing backup through the same procedure. A cancelled confirmation retains the verified file. Cancelled pickers or verification failures never replace the library. A failed provider write may leave a partial external file; SR does not treat it as a valid backup or delete it automatically.

**Folder permissions:** selecting a file does not grant its parent folder’s write access. Chrome’s `showSaveFilePicker({startIn: incomingHandle})` suggests the input directory; no directory-wide permission or persistent handle is needed. Secure desktop Chrome is required, with no unverifiable download fallback. Android uses `EXTRA_INITIAL_URI` with the incoming document as a location hint for `ACTION_CREATE_DOCUMENT`; providers may ignore it. The owner explicitly chooses the destination; SR never silently saves elsewhere. Android’s creation picker also resolves collisions. See [Chrome file access and user activation](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) and [Android document access and initial locations](https://developer.android.com/training/data-storage/shared/documents-files).

**Playback and concurrency:** import holds the existing exclusive library Web Lock from validated preview through backup and confirmation. Other cooperating tabs cannot start playback or mutate the library. Old noncooperating writes are caught by the backup match and final transaction check. Android refuses a prepared session or active/launching service, saves queued completions before the outgoing snapshot, and refuses replacement if new completions appear. Failed reconciliation retains the queue. Cancellation does not undo legitimate completed-step credit saved before backup. The Data workflow does not alter playback or crash recovery. Reload old tabs after updating.

No merge or Drive service is involved. Returning a whole phone snapshot to desktop also replaces content/mastery/preferences: preserve both copies if desktop content changed. Desktop is the intended content authority. Do not use a whole phone restore to merge later review results into newer desktop edits.

Both file UIs cap input at 32 MiB before any modification. The Android picker uses the Storage Access Framework with bounded reads and no broad storage permission, file/content URL access, external navigation or INTERNET permission. Cancel/error does not import. Android export reports success only after writing/closing and reopening the selected document for exact byte verification. This does not certify OneDrive cloud sync.

If storage cannot open, or the current data is unreadable/invalid, the panel fails closed and preserves it. It does not delete the database or pretend it made a safety backup. Recovery from physical/browser-store corruption without a readable current snapshot remains an explicit exceptional recovery limitation; retain external backups and investigate the cause before any destructive reset. Ordinary restoration into a fresh empty database is supported. Clearing site data or uninstalling loses both working data and the local recovery copy, so local recovery is not a substitute for dated external backups.

## Owner verification

Run the browser test page, then use **Download synthetic storage-test backup**. Its two artificial cards are not a content library. To keep desktop tests separate, import it at `data/index.html?test=SRLearning-test-owner` using the automatic backup and one confirmation. Close all browser windows, reopen the same URL/profile, export, and verify exact text/order. Do not test resets on personal data.

For Stage 5, preserve a dated pre-upgrade export, then reopen the same desktop profile and verify the owner's actual States series/Delaware wording, IDs, ordering and inherited step progress. Automated tests use synthetic content and do not constitute observation of the owner's private library.

On the schema-2 Android update: install over the existing app without uninstalling, stop audio, open Data and verify/export the migrated library. Compare records after desktop→phone→desktop transfer and offline force-stop/relaunch. Cancel both file pickers and reject malformed JSON. Keep the automatic external outgoing backup. Check voice choice, Bluetooth, locked-screen progression and notification controls. These physical-device checks remain owner work; installed version and approximate file sizes alone do not prove record equality.

## Historical usability feedback

The October 13, 2026 feedback about confusing restore steps led to the October 14 shared Data simplification above. The former manual reselection, checkbox and historical-copy download workflow is retired. Dated test evidence remains in TEST_RESULTS.md; it describes the interface as tested at that time, not current operating instructions.
