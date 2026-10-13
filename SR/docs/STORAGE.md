# Stage 3 storage and JSON recovery

The same native ES modules run on the website and in the existing Android WebView. There is no application server, database package or native learning database. Stage 4 adds a [desktop editor](AUTHORING.md) at `https://crownandcall.com/SR/`; Android continues to package only the existing listening/Data assets. Sample playback remains independent of this library; later stages integrate scheduling. The specification and build plan remain unchanged.

## Locations and identity

- Data panel: `https://crownandcall.com/SR/data/index.html`
- Isolated real-IndexedDB tests: `https://crownandcall.com/SR/tests/persistence.html`
- Desktop database: `SRLearning`, internal version 1, scoped to the website origin/browser profile.
- Android database: the same name and modules, scoped to the existing `https://sr.invalid/` bundled origin and app ID. Do not change that origin, app ID, or signing identity during updates.
- Tests create only `SRLearning-test-*` databases. Browser automation uses an entirely disposable browser profile as well. `data/index.html?test=SRLearning-test-example` opens an explicitly named isolated test database; invalid test names fail closed.

Local IndexedDB access needs no network. The desktop page must already be loaded before going offline; offline cold launch/service-worker caching is Stage 9. Android bundles its assets and retains its no-INTERNET-permission architecture. `setDomStorageEnabled(true)` enables WebView DOM storage; no deprecated Web SQL database setting or native database is added. The owner's October 13, 2026 phone test verified the successful file export/import/restore workflow and close/reopen export, with file sizes consistent with persistence; exact JSON equality, offline Android storage and retention across a subsequent APK update remain unverified. See [the owner evidence](TEST_RESULTS.md#stage-3-owner-verification--2026-10-13), [Android WebSettings](https://developer.android.com/reference/android/webkit/WebSettings#setDomStorageEnabled(boolean)) and [IndexedDB transactions/upgrades](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB).

## Repository API

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
const progress = await repository.getProgress(card.id);
await repository.updateProgress(card.id, { mastery: 3 }, progress.revision);
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
| `listDue(timestamp)` | Inclusive numeric `byDue` query; default timestamp is now; zero dates are included |
| `savePreset(input, expectedRevision?)` | Create or update name, unique seriesIds/cardIds, mode, order, grouping; references must exist; existing preset requires current revision |
| `getPreset(id)`, `listPresets()`, `deletePreset(id, expectedRevision)` | Preset retrieval/removal; empty selections are permitted |
| `setSetting(key,value)`, `getSettings()` | Validated nonsecret preferences only |

Every mutation resolves after transaction `complete`. Any exception, request error, abort, constraint or quota failure rejects and rolls back the whole transaction. Code within transaction callbacks may await IndexedDB requests only. Never hold a transaction across file dialogs, speech, network or timers. Connections close on `versionchange`; callers should reload then. Blocked upgrades display instructions to close other tabs; no database deletion is attempted.

Revision checks protect concurrent edits to content/progress/presets. Replacement also checks an exact logical safety-backup match inside its write transaction, detecting any intervening write or earlier replacement. The sample speech proof neither reads nor writes learning data. Stop it before file transfer; Android enforces stopping its native service. Full cross-tab playback ownership and session-generation checks belong to the later review integration, which must not treat a revision number alone as authority across restoration.

Stage 4 adds an optional `new Repository(db, {guardStores, writeGuard})` constructor hook. Every mutation invokes the guard inside its write transaction, including the declared guard stores. Existing callers need no changes. The desktop editor captures a validated snapshot when loading its view and compares its canonical content (including library generation) against `readSnapshot(tx)` before writing. Any intervening library change rejects the operation and retains the draft. This deliberately conservative whole-library check also protects deletion counts and sibling ordering; it does not merge unrelated concurrent changes. Where available, an origin-scoped Web Lock serializes editor writes, with the transaction guard remaining authoritative even without Web Locks or against other writers. Guard callbacks may await only IndexedDB requests. No schema, backup format or Android asset-list change is made.

This personal-library implementation reads the complete snapshot for the guard; it renders only 50 list summaries per page and the currently selected card's steps. Larger-library optimization and offline cold launch remain later acceptance work. Editing content never invokes the progress-writing API. Optional annotations and recitation references are preserved; the Stage 4 UI blocks deletion/reordering that would invalidate imported recitation references rather than silently rewriting them.

## Version 1 data contract

IDs are nonempty strings; new IDs are UUIDs. Text is preserved verbatim, including whitespace, multiline text, Unicode and markup-looking characters. The UI renders with textContent. Names/questions/answers cannot be entirely whitespace. Positions are contiguous zero-based integers; step array order and positions agree, as do series order and card order within each series in a snapshot. There is no step-count limit. Record timestamps are nonnegative, safe-integer UTC epoch milliseconds in JavaScript's Date range; createdAt ≤ updatedAt. Content and presets have positive integer revisions.

The `series`, `flashcards`, `progress`, `presets`, `settings` stores/indexes follow build-plan section 6. Optional step annotations (`role`, `directQuestion`, `recallSeconds`) and recitation references are preserved and structurally validated; no mastery-band/grouping policy is implemented. Unannotated steps remain available as targets. At least one explicit or implicit target is required.

Progress uses `flashcardId`, integer mastery 0–10, nullable `lastReviewedAt`, numeric `nextDueAt` and a positive revision. Creation uses mastery 0, lastReviewedAt null, nextDueAt 0. Updating mastery alone deliberately does not select the unapproved Stage 5 date policy. Presets store mode `focused|due`, order `sequential|random`, grouping `auto|individual|full`; storing one never schedules or plays anything.

Settings are a JSON object in snapshots and key/value records in IndexedDB. Allowed keys: `desktopVoice`, `androidVoice` (name/language, optional voiceURI); `rate` (0.1–10), `pitch` (0–2), `volume` (0–1); nonnegative `recallSeconds`/`passageMarginSeconds`; positive `passageWordsPerMinute`; and an optional 11-entry nonnegative `intervalDays` array. No interval defaults are imposed. Unknown keys, tokens, arbitrary sync metadata and platform voice objects are rejected. The speech proofs keep their current controls; these stored settings are a foundation for later integration.

`reviewEvents` and its unique session/unit index are reserved but empty in Stage 3. Nonempty history is rejected, never silently discarded or credited. The native Stage 2 diagnostic journal is separate and is neither imported nor erased. The actual scheduled-completion contract/writer remains Stage 6 work. A future change to the public contract must explicitly preserve/migrate version-1 snapshots; do not reinterpret this reservation as an approved scheduling policy.

Two private support stores hold library identity (`meta`) and the last successful pre-import snapshot (`recovery`). They contain no credentials. Recovery copies are not recursively embedded in portable backups. The library ID survives transfer; each successful restore generates a new active libraryGeneration UUID, as the plan requires to distinguish stale sessions. No device installation identity is cloned.

## Backup API and procedure

`exportSnapshot(db)` returns a validated object; `exportJSON(db)` serializes it. `previewImport(json)` validates without writes and returns `{snapshot, counts}`. `restoreJSON(db,json,{confirmed:true,safetyJSON})` requires a reselected, validated current backup. `recoveryJSON(db)` returns the last pre-import backup for downloading and ordinary confirmed restoration.

Envelope fields: `format: "sr-learning-backup"`, `formatVersion: 1`, `schemaVersion: 1`, `appVersion`, UTC ISO `exportedAt` with milliseconds, `libraryId`, `libraryGeneration`, `series`, `flashcards`, `progress`, `presets`, `settings`, `reviewEvents`. The portable and database versions are independent constants even though both initially equal 1. All required fields, IDs, references, ordering, types, enums, timestamps and settings are checked. Unknown versions/fields and unsafe object keys fail closed. Export does not change record timestamps.

The specification's example is explicitly illustrative, not a previously shipped backup format. Therefore unversioned illustrative JSON and null `nextDueAt` are rejected without mutation; no legacy converter is invented. The test suite includes this null-due rejection fixture. Conversion of a real older supported format needs a separately specified, validated migration and preview. The v0→v1 database initialization, blocked upgrade, aborted upgrade, automatic old-connection close and future-version refusal are tested; no fake production v2 migration is shipped merely for a test.

1. Stop playback. Choose a complete JSON file and inspect replacement counts.
2. Export the current library to an off-device file. Reselect that saved file using **Verify saved current backup**; both validation and exact current-content matching must pass.
3. Check the explicit replacement confirmation, then **Replace local library**.
4. The transaction rechecks the safety match, saves the current snapshot in `recovery`, clears/repopulates all live stores and assigns a fresh generation. Failure preserves the old library and its prior recovery copy. Closing the page mid-transaction also rolls back in the tested Chrome.
5. Reopen and verify counts; download another dated backup. Use **Save previous pre-import backup** if you need to undo, followed by the same safety/confirmation workflow.

No merge or Drive service is involved. Returning a whole phone snapshot to desktop also replaces content/mastery/preferences: preserve both copies if desktop content changed. Desktop is the intended content authority. Do not use a whole phone restore to merge later review results into newer desktop edits.

Both file UIs cap input at 32 MiB before any modification. The Android picker uses the Storage Access Framework with bounded reads and no broad storage permission, file/content URL access, external navigation or INTERNET permission. Cancel/error does not import. Android export reports success only after writing/closing the selected output stream; reselect it to verify.

If storage cannot open, or the current data is unreadable/invalid, the panel fails closed and preserves it. It does not delete the database or pretend it made a safety backup. Recovery from physical/browser-store corruption without a readable current snapshot remains an explicit exceptional recovery limitation; retain external backups and investigate the cause before any destructive reset. Ordinary restoration into a fresh empty database is supported. Clearing site data or uninstalling loses both working data and the local recovery copy, so local recovery is not a substitute for dated external backups.

## Owner verification

Run the browser test page, then use **Download synthetic storage-test backup**. Its two artificial cards are not a content library. To keep desktop tests separate, import it at `data/index.html?test=SRLearning-test-owner` after exporting/reselecting that empty test library's safety backup. Close all browser windows, reopen the same URL/profile, export, and verify the exact text/order. Do not test resets on personal data.

On the updated Android app: stop audio; open Data; export/reselect the current library; preview/import the synthetic file; verify 1 series/2 cards/4 steps. Export back to desktop, then close/force-stop/reopen Android with networking off and confirm counts/text via another export. Cancel both file pickers and reject malformed JSON. Verify the previous-library backup can be downloaded. Finally check the existing voice choice, Bluetooth, locked-screen progression and notification controls. Keep the fixture across the next APK update to verify IndexedDB retention without uninstalling or clearing app data. Record actual observations separately from automation.

## Deferred restore usability improvements

Owner feedback, October 13, 2026, after successful physical-device testing of APK 0.2.100301:

1. The JSON restore procedure feels confusing because the required sequence is not clear enough in use.
2. Make numbered instructions more explicit and visible: select the incoming JSON, verify the saved current-library backup, acknowledge playback is stopped, then authorize replacement. Existing instructions did not make this sequence sufficiently clear to the owner.
3. Make the success confirmation more prominent and informative; for example, **"Restore Successful — 2 Flashcards Imported"**, using the actual imported count. The current success message was easy to overlook.
4. Preserve all existing data-protection safeguards, including validation, safety-backup verification, explicit replacement authorization, atomic writes and the pre-import recovery copy.

These are **deferred usability improvements** for later UI development, not Stage 3 defects requiring immediate code changes. No interface change or Stage 4 work is authorized by recording this feedback.
