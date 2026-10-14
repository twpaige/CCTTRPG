# SR — Test results

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

Reproduce with the existing regression commands plus `node SR/mobile/tests/authored.test.mjs` (now 28 scenarios) and `node SR/tests/android-recovery.mjs` (10 scenarios, server/Playwright configuration unchanged). GitHub build/lint/sign and release evidence will be appended after publication.

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
