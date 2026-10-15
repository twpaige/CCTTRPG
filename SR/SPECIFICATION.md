# SR — Audio Spaced Repetition System
Specification v0.10 · Android authored listening, approved Stage 5 rules · 2026-10-14

## Owner-approved roadmap revision — 2026-10-14

Stage 7 is **SUPERSEDED**: BOUND series preserve the authored order of **independent** flashcards; no automatic adjacent-card grouping or special full-passage playback feature is desired. Each flashcard retains its own final-step scheduling anchor, ordered steps and mastery. A final comprehensive flashcard may test the entire bound series, with the already-approved KNOWN propagation and AUDIT behavior unchanged.

Stages 8 (focused selections/presets), 9 (desktop qualification) and 11 (automatic cloud synchronization) are **ON HOLD**. **Stage 10 is ACTIVE and owner-authorized**: authored Android listening and manual JSON transfer, optionally through OneDrive's system document provider. This supersedes both the earlier Stage 11-first order and the original Stage 9 prerequisite. Unperformed gates remain open. No automatic sync, account requirement, Microsoft Graph, OAuth integration, backend or Capacitor is introduced. Another stage requires explicit authorization.

### Stage 10 owner-authorized corrections — 2026-10-14

Duckable audio-focus loss may pause and automatically resume on focus gain. Ambiguous transient/permanent loss, calls, disconnects and user Pause/Stop remain manual; no timer or crash restart. The initial Android backup correction is superseded by the shared Data correction below. See [Android guide](docs/ANDROID_LISTENING.md) and [owner/automated evidence](docs/TEST_RESULTS.md). These are authorized corrections, not a new stage.

### Owner-authorized Data simplification — 2026-10-14

Both platforms expose **Save Complete JSON Backup** and **Import JSON Library** as their two primary Data actions. Fully validate incoming JSON, display counts, automatically save and read back a complete external outgoing backup, then show one Cancel/Confirm Import dialog. Use local-minute filenames with collision suffixes; refuse nonempty destinations. Prefer the incoming folder through picker hints, with explicit owner destination selection. Chrome requires a fresh destination-button gesture; Android uses its existing document-creation picker.

Remove obsolete manual verification/checkbox/Replace controls and historical recovery-copy creation/export functions. Existing recovery records remain inert; retain the schema-2 store definition without a destructive migration. Refuse active playback, reconcile Android completions before backup, hold the existing library lock through confirmation, and preserve final stale-snapshot checks and atomic rollback. Schema, JSON versions, app ID, signing and native listening remain unchanged. No new stage or cloud integration. This supersedes older internal-copy requirements below; current instructions are in [STORAGE.md](docs/STORAGE.md).

## Purpose and scope

A personal, local-first audio memorization system for desktop Chrome and Android listening. The learner writes their own mnemonic associations; preserve every word, Unicode character, identifier and authored order. No AI-generated stories, subject-specific mandatory fields, accounts, public sharing, cloud database or backend. Desktop is the content/mastery authority. JSON file transfer remains independent of Google services.

Stage 4 is formally CLOSED/PASS. Stage 5 provides step mastery, scheduling policy, selection previews, migration and reusable completion APIs. Stage 6 connects these to desktop authored-card audio at `/SR/`; the editor remains available at `/SR/library.html` in the same origin/database. The owner verified actual Delaware desktop REVIEW audio (all eligible steps, correct pauses and automatic progression) and resulting due-date changes on 2026-10-13. G6 core audible/scheduling acceptance is PASS; full manual-checklist closure remains open. Historical evidence remains in [TEST_RESULTS.md](docs/TEST_RESULTS.md).

## Hierarchy and ordering

- **Series → Flashcards → Steps.** A BOUND series preserves card order. UNBOUND cards may be selected independently and shuffled. Both retain independent per-step progress.
- A flashcard is an indivisible playback unit: finish its eligible steps in ascending authored order before starting another card. Never interleave, shuffle or reverse steps.
- The final step represents complete retrieval by authoring convention. Do not inspect or restrict its wording. Old role/direct-question/recitation annotations remain stored but do not drive Stage 5 selection.
- A step contains its stable ID, question, answer, position and optional nonnegative recall duration in seconds. There is no small passage-duration cap in storage. An absent override uses the session default; zero is a valid override.

### Example: 16th President
FC name "16th President"; unbound series "Presidents".
| Step | Question | Answer |
|---|---|---|
| 1 | Who is the sixteenth president and when did he take office? | Sixteen |
| 2 | Where does sixteen lead us in the list of presidents? | Ditch |
| 3 | What is the presidential story about the ditch? | Abraham Lincoln going into a ditch with a wagon full of freed slaves |
| 4 | Who was driving the wagon in the story? | Abraham Lincoln |
| 5 | What memory trick helps with the year he took office? | Turn sixteen around to get sixty-one |
| 6 | In what year did the sixteenth president take office? | Eighteen sixty-one |

Distinguish 1861 (took office) from 1860 (first elected). The author, not the application, creates associations.

### Example: Delaware
First state, capital Dover, admitted December 7, 1787; DE. Peg: **1 → tie → WEAR → DelaWARE**. Bend **OVER** while tying tie → **DOVER**. Major System **den (12) → key (7) → vac (87)** → December 7, 1787. Original short story: "In the den, pick up a key that turns on the vacuum." Keep the wording sparse to let the learner visualize the rest. One FC can contain all the facts and the mnemonic steps; do not force separate cards per fact. At higher mastery, questions can start from "Delaware" rather than the number 1.

### Example: Psalm 23
Bound series "Psalm 23", with one FC per natural phrase/location, not necessarily per biblical verse. Memory journey through childhood farmhouse: **Gate → Grass → Pond → Store → Porch → Door → Kitchen → Corner → Dining Room → Bathroom → Stairs → Window**. Gate FC may ask: Where are you? → Gate; Who is there? → Jesus; What is he doing? → Shepherd's crook and Big Macs, feeding you everything you want; What Scripture does it recall? → "The Lord is my shepherd; I shall not want." Subsequent cues include green grass, still pond, shoe soles/store/restore soul, righteous path and name on porch, VSD door, monster/no fear in kitchen, rod and staff in corner, enemy at dining table, oil and overflowing cup in bathtub, Shirley/Goodness/Mercy on stairs, cookies/dwarf/dwell at window. Preserve the original learner-authored stories and chosen KJV text; verify canonical Scripture wording rather than silently rewriting it.

Other intended content: Ten Commandments with number pegs **1 run, 2 zoo, 3 tree, 4 door, 5 dive, 6 sticks, 7 heaven, 8 gate, 9 dine, 10 den**; vocabulary ("reconcile"); presidents; states/capitals/admission order/date; Bible verses. Do not hardcode subject-specific fields into the engine.


## Learner-controlled mastery

Each step has integer mastery 0–10, a nullable last-reviewed timestamp, an independent due date and a revision. Playing never automatically increases mastery.

| Level | Interval |
|---|---|
| 0 | 15 minutes |
| 1 | 3 hours |
| 2 | 6 hours |
| 3 | 1 day |
| 4 | 2 days |
| 5 | 3 days |
| 6 | 1 week |
| 7 | 2 weeks |
| 8 | 1 calendar month |
| 9 | 3 calendar months |
| 10 | KNOWN — never scheduled for normal REVIEW |

Minutes/hours/days/weeks use elapsed UTC milliseconds (one day = 86,400,000 ms). Calendar months use UTC date components, retain the time of day, and clamp to the destination month's last day (January 31 → February 28/29). Local time is for display. Level 10 uses a null active due date. Levels below 10 require numeric due dates. Manual changes calculate due from the time of the change and retain last-reviewed time. New cards/steps start at 0, due in 15 minutes. Migrated dates are preserved rather than recomputed. Historical intervalDays preferences remain recoverable but do not override this approved table.

## KNOWN propagation and explicit reset

Setting a nonfinal step to 10 affects that step only. Setting the final step to 10 requires confirmation and makes all steps in that flashcard KNOWN. **I know this for sure** uses the same plan and confirmation. If that card is the final card of a BOUND series, explicitly confirm making every step of every card in the entire series KNOWN. No authored content is removed.

The final step's mastery determines whether a card is KNOWN. Lowering a previously KNOWN final step below 10 leaves earlier KNOWN steps unchanged. They remain available in storage and can be explicitly reset.

**Reset FC** confirms setting every step in the selected card to 0, due in 15 minutes. **Reset final step only** changes only the retrieval anchor to 0. When resetting an audited final comprehensive card's entire learning objective, **Reset entire flashcard / objective** confirms resetting the entire BOUND series; otherwise it resets that card. Resetting does not imply that speech was completed.

## REVIEW selection

REVIEW practices material below mastery 10. A card qualifies only if its **final step** is below 10 and due within the selected window. Earlier overdue steps never select a card independently.

For a qualifying card, present only steps below 10 whose due dates fall within the **same** cutoff. Retain ascending step order. The final anchor is therefore included. BOUND cards preserve defined order while skipping nonqualifying/KNOWN cards; UNBOUND qualifying cards may be shuffled. Keep each card's selected steps together.

Windows: **Due now**, **Due within N days** (whole days starting at 1), or **Max Deferred** (all non-KNOWN anchors and steps, regardless of future due date). Boundaries are inclusive. At seven days of lookahead, step dates +6 days / KNOWN / +10 days / overdue / final +5 days yield steps **1 → 4 → 5**.

## AUDIT selection and outcome

AUDIT tests previously declared KNOWN material. It is **not a REVIEW mode** and is always labelled AUDIT. Support AUDIT ALL or one selected series, not multiple selected series. Only KNOWN cards qualify; present only their final steps. A completely KNOWN BOUND series contributes only its final comprehensive card, including during AUDIT ALL.

AUDIT playback repeats continuously until stopped, refreshing eligibility between cycles so reset cards leave AUDIT. Success leaves mastery and schedules unchanged. Failure also makes no automatic change: the learner explicitly chooses reset-final or reset-card/objective, with confirmation. An empty AUDIT selection terminates cleanly. Stage 6 implements desktop audio using Stage 5 selection.

## Completion and pending mastery contract

| Situation | Schedule effect |
|---|---|
| Due/overdue step successfully completes in REVIEW | Set last-reviewed to actual completion time; due = completion + current mastery interval |
| Future-due step included by lookahead | Preserve both timestamps, even if its due time passes while speaking |
| FOCUSED practice | Preserve mastery/scheduling unless the learner explicitly changes mastery |
| AUDIT success or failure | No automatic mastery/scheduling change |
| Explicit mastery change/reset | Calculate due from change time; KNOWN has no due date |
| Skipped, interrupted or unsuccessful step | No completion update; discard pending mastery |

Eligibility uses a shared window cutoff. A prepared step records whether it was due when it started; an overdue step in a lookahead session earns an update, an early step does not. Completion is step-level, not whole-card/group credit. Never credit unfinished steps. IDs combine library generation, session, occurrence, card and step. Store receipts and progress atomically; duplicate callbacks return already-applied before revision checks. Stale content/progress, restored generations and backwards completion times fail closed.

The reusable controller queues a mastery choice until that step finishes successfully. Stop/Skip invalidates the token and discards its pending choice. A due REVIEW with a pending choice records successful completion and uses the new level's interval. Special Reset/KNOWN actions pause via a supplied playback handler and require confirmation. A committed completion is not undone by a later Stop. Stage 10 uses the owner-approved in-memory native step queue described below; the old Android diagnostic card journal is not a scheduling receipt.

### Desktop playback contract

One existing `ReviewController` performs preparation → question → recall → answer → completion write, with cancellable generations. REVIEW freezes its eligible pass at Start; Restart starts a fresh eligible pass using the captured settings and retains previous credit. AUDIT refreshes between cycles. IDs, authored order and full wording remain unchanged.

The player segments long text into at most 400 Unicode code points per utterance, preferring whitespace boundaries and retaining every character. Resume repeats the interrupted segment only. Recall uses the full step override/default and remaining time after pauses, chaining waits above the browser's signed 32-bit timer limit. Unrepresentable durations fail visibly before speech; there is no 120-second recall cap. Each speech segment keeps the established 120-second missing-callback watchdog. No receipt precedes the final answer segment's successful end. A failed scheduling write keeps the same token/completion timestamp for Resume / retry without replaying speech.

Queue mastery pauses playback and displays the interval. Explicit Resume continues; final-step KNOWN propagation requires confirmation before queuing. Special actions invalidate the unfinished attempt, including its pending choice. Confirming skips that card; cancelling leaves it paused and starts that step again on Resume. Reset dates use confirmation time. Stop/Skip cannot undo a write already started for a successfully finished answer.

An exclusive Web Lock protects one player per origin/database, including paused/error states. Current-version editor/mastery/import writes request a compatible short-lived lock and fail visibly while playback owns the library. Reads/exports remain available. Content/progress revisions, whole-library pending-change checks and library generations also reject stale writes from old tabs. Close/reload old SR tabs after deployment. Stop releases ownership after outstanding operations settle; reload never automatically resumes or credits unfinished speech. No schema or backup-format change is required.

## Persistence and JSON recovery

One versioned IndexedDB database per origin/profile. Schema 2 adds **stepProgress** keyed by [flashcardId, stepId] and **stepEvents** receipts. Content, stable IDs, positions and existing stores remain. Original card-level **progress** is retained as a legacy recovery archive, not active scheduling authority. Old optional metadata is not discarded.

Approved migration: validate the complete version-1 library and copy each card's mastery, last-reviewed time, due date and revision to every step in one upgrade transaction. Existing recovery records remain untouched; no new internal snapshot is created. Mastery 10 becomes KNOWN with null due; **no cross-card/BOUND-series propagation during migration**. Reopening version 2 never reapplies the copy. Any validation/write/abort failure leaves the version-1 database intact. After migration, every step changes independently.

Export complete version-2 snapshots. Accept validated version-1 backups through the same idempotent conversion; require automatic external backup/read-back and one explicit import confirmation. Existing historical recovery copies remain untouched; no new internal copies are created. Version-2 backups are not readable by older APKs; update the APK before transfer. Unsupported/corrupt data fails closed without partial replacement. Clearing browser/app storage or uninstalling can destroy local copies: retain dated external files. Details and API: [STORAGE.md](docs/STORAGE.md).

## Audio/platform boundary

Desktop uses browser Web Speech, preferring Google UK English Male when available with an explicit working fallback. Android uses the already owner-approved native TextToSpeech executor. Preserve its identity, signing, Bluetooth, background and notification behavior. JavaScript owns learning policy and storage.

Stage 10 authored native plans use version 2 and retain selected card/step IDs, content/progress revisions and original due dates. Native code executes the complete ordered selection without an active WebView. REVIEW is finite; AUDIT repeats the selected final steps until Stop, capacity pause or a mastery change requiring refreshed selection. The sample version-1 builder/parser remains available for historical regressions, not the listening UI.

Native text segments retain exact substrings, up to 400 code points each; whitespace-only segments require no TTS request. Only successful final-answer completion produces a step record. Recall uses the full representable override/default, monotonic deadlines and 30-second timer slices. A 150-second wake lock is renewed during active waits/actions and released on pause/error/stop/finish. The missing-speech callback watchdog is 120 seconds per segment; it never guesses completion. Sessions above 16 MiB UTF-8 fail before playback without truncation; choose a smaller series.

**Owner-approved simple recovery:** native completions are process-local memory, capped at 512 entries and 16 MiB. Capacity pauses execution before the next step; entries are never silently evicted. Reconciliation uses existing IndexedDB progress/receipt transactions and captured actual step-start/completion times. Duplicate writes do not advance dates twice. UI suspension retains the native queue; Activity/service recreation within the same process retains it. Unexpected process/phone shutdown may lose all uncommitted queue entries, so affected steps may be reviewed again. There is deliberately no durable native journal or automatic crash-resume speech. Stop keeps completed entries. Import/export/new sessions require saving available completions first. Stale records fail visibly rather than overwrite newer progress.

Mobile manual mastery uses the same policy and confirmations. Queue a current-step choice while paused; commit only after the full answer. Then Stop/Start to rebuild eligibility. Reset/KNOWN actions pause and confirm, stop the captured session, and apply atomically. Content remains read-only. The approved data-protection rules are unchanged; full JSON transfer replaces, never merges. See [ANDROID_LISTENING.md](docs/ANDROID_LISTENING.md) for operation and required physical qualification.

## Acceptance and future scope

G5 requires all intervals and UTC month-end/leap arithmetic; final anchors and step filtering; BOUND/UNBOUND order; KNOWN propagation/reset confirmations; REVIEW/AUDIT separation and repeat policy; due/early/focused/interrupted/duplicate completion cases; independent progress; atomic idempotent migration and JSON recovery; stale protection; 1,000 × 10 scale; and desktop UI evidence. Run all prior regressions and preserve historical test results. Actual owner States/Delaware verification and physical Android qualification must be reported separately from synthetic fixtures.

G6 requires real-library selection, all controls/ordering, long text/waits, automatic progression, answer-only atomic scheduling, pending mastery and confirmation scopes, continuous AUDIT, safe retry, cross-tab protection, regression/backup compatibility and owner audible verification. Stage 7 is superseded. Desktop offline cold launch (9), broader presets (8) and automatic cloud synchronization (11) are on hold. G10 requires native ordering/completion/queue tests and actual Samsung locked/offline/Bluetooth/transfer/update verification. An automated pass never substitutes for that owner evidence. No backend, new framework or Android authoring is introduced.
